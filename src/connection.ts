import * as net from 'net';
import * as tls from 'tls';
import * as os from 'os';
import * as crypto from 'crypto';
import {
  InterfaceError,
  OperationalError,
  ConnectionClosedError,
  DatabaseError,
  ProgrammingError
} from './errors';
import * as protocol from './protocol';
import { getTypeConverter } from './types';

/**
 * Connection options
 */
export interface ConnectionOptions {
  user: string;
  password: string;
  host?: string;
  port?: number;
  database: string;
  securityLevel?: number;
  timeout?: number;
  applicationName?: string;
  debug?: boolean;
  rowMode?: 'object' | 'array';
  ssl?: {
    ca?: string | Buffer;
    rejectUnauthorized?: boolean;
  };
}

/**
 * Query result row (object format)
 */
export interface QueryRow {
  [key: string]: any;
}

/**
 * Query result
 */
export interface QueryResult {
  rows: QueryRow[] | any[][];
  rowCount: number;
  command?: string;
  fields?: FieldDescription[];
}

/**
 * Field description from row description message
 */
export interface FieldDescription {
  name: string;
  tableOid: number;
  columnNumber: number;
  typeOid: number;
  typeSize: number;
  typeMod: number;
  formatCode: number;
}

/**
 * Connection to IBM Netezza database
 */
export class Connection {
  private options: ConnectionOptions;
  private socket?: net.Socket | tls.TLSSocket;
  private buffer: Buffer = Buffer.alloc(0);
  private closed: boolean = false;
  private transactionStatus: number = protocol.TRANSACTION_STATUS_IDLE;
  private backendKeyData?: { processId: number; secretKey: number };
  private hsVersion?: number;
  private protocol1?: number;
  private protocol2: number = 0;

  constructor(options: ConnectionOptions) {
    this.options = {
      host: 'localhost',
      port: 5480,
      securityLevel: 0,
      timeout: 30000,
      debug: false,
      rowMode: 'object',
      ...options
    };
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private debugLog(...args: any[]): void {
    if (this.options.debug) {
      console.log('[node-netezza]', ...args);
    }
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    if (this.socket) {
      throw new InterfaceError('Connection already established');
    }

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({
        host: this.options.host!,
        port: this.options.port!,
        timeout: this.options.timeout
      });

      this.socket.on('error', (err) => {
        reject(new OperationalError(`Connection error: ${err.message}`));
      });

      this.socket.on('timeout', () => {
        reject(new OperationalError('Connection timeout'));
      });

      this.socket.on('connect', async () => {
        try {
          await this.performHandshake();
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.socket.on('data', (data) => {
        this.buffer = Buffer.concat([this.buffer, data]);
      });
    });
  }

  /**
   * Perform connection handshake
   */
  private async performHandshake(): Promise<void> {
    // Negotiate handshake version
    await this.negotiateHandshake();
    
    // Send handshake information
    await this.sendHandshakeInfo();
    
    // Authenticate
    await this.authenticate();
    
    // Wait for ready for query
    await this.waitForReady();
  }

  /**
   * Negotiate handshake version
   */
  private async negotiateHandshake(): Promise<void> {
    let version = protocol.CP_VERSION_6;
    
    while (true) {
      // Send handshake version
      const payload = Buffer.alloc(4);
      payload.writeUInt16BE(protocol.HSV2_CLIENT_BEGIN, 0);
      payload.writeUInt16BE(version, 2);
      
      this.sendMessage(payload);
      
      // Wait for response
      const response = await this.readBytes(1);
      
      if (response[0] === 0x4E) { // 'N'
        this.hsVersion = version;
        this.protocol2 = 0;
        return;
      } else if (response[0] === 0x4D) { // 'M'
        const versionByte = await this.readBytes(1);
        version = versionByte[0] - 0x30; // Convert ASCII to number
        
        if (version < protocol.CP_VERSION_2) {
          throw new InterfaceError('Unsupported handshake version');
        }
      } else if (response[0] === 0x45) { // 'E'
        throw new InterfaceError('Bad attribute value error');
      } else {
        throw new InterfaceError('Bad protocol error');
      }
    }
  }

  /**
   * Upgrade the connection to TLS
   */
  private async upgradeToTLS(): Promise<void> {
    if (!this.socket) {
      throw new InterfaceError('No socket available for TLS upgrade');
    }

    return new Promise((resolve, reject) => {
      const tlsOptions: tls.ConnectionOptions = {
        socket: this.socket as net.Socket,
        rejectUnauthorized: this.options.ssl?.rejectUnauthorized !== false,
      };

      // Add CA cert if provided
      if (this.options.ssl?.ca) {
        tlsOptions.ca = this.options.ssl.ca;
      }

      const secureSocket = tls.connect(tlsOptions);

      secureSocket.on('secureConnect', async () => {
        this.debugLog('TLS connection established');
        
        // Replace the socket with the TLS socket
        this.socket = secureSocket;
        
        // Re-attach data handler to TLS socket
        secureSocket.on('data', (data) => {
          this.buffer = Buffer.concat([this.buffer, data]);
        });

        // Send HSV2_SSL_CONNECT to confirm SSL connection
        const connectPayload = Buffer.alloc(6);
        connectPayload.writeUInt16BE(protocol.HSV2_SSL_CONNECT, 0);
        connectPayload.writeInt32BE(this.options.securityLevel || 0, 2);
        const connectMessage = Buffer.alloc(4 + connectPayload.length);
        connectMessage.writeInt32BE(connectPayload.length + 4, 0);
        connectPayload.copy(connectMessage, 4);
        this.sendRawMessage(connectMessage);

        // Wait for confirmation
        try {
          const confirmResp = await this.readBytes(1);
          if (confirmResp[0] === 0x4E) { // 'N' - SSL connection confirmed
            this.debugLog('SSL connection confirmed by server');
            resolve();
          } else if (confirmResp[0] === 0x45) { // 'E' - Error
            const errorMsg = [];
            while (true) {
              const byte = await this.readBytes(1);
              if (byte[0] === 0x00) break;
              errorMsg.push(byte[0]);
            }
            reject(new InterfaceError(`SSL connection error: ${Buffer.from(errorMsg).toString('utf8')}`));
          } else {
            reject(new InterfaceError('Unexpected SSL connection response'));
          }
        } catch (err) {
          reject(err);
        }
      });

      secureSocket.on('error', (err) => {
        reject(new OperationalError(`TLS connection error: ${err.message}`));
      });
    });
  }

  /**
   * Send handshake information
   */
  private async sendHandshakeInfo(): Promise<void> {
    // 1. Send database FIRST (Netezza needs this before security negotiation)
    await this.sendHandshakeField(protocol.HSV2_DB, this.options.database);
    
    // Wait for database acknowledgment
    const dbResp = await this.readBytes(1);
    if (dbResp[0] !== 0x4E) { // 'N'
      throw new InterfaceError('Expected database acknowledgment');
    }
    
    // 2. Then negotiate SSL/security (REQUIRED by Netezza)
    const sslLevel = this.options.securityLevel !== undefined ? this.options.securityLevel : 0;
    // SSL negotiation uses different format: opcode (2 bytes) + value (4 bytes int32)
    const sslPayload = Buffer.alloc(6);
    sslPayload.writeUInt16BE(protocol.HSV2_SSL_NEGOTIATE, 0);
    sslPayload.writeInt32BE(sslLevel, 2);
    const sslMessage = Buffer.alloc(4 + sslPayload.length);
    sslMessage.writeInt32BE(sslPayload.length + 4, 0);
    sslPayload.copy(sslMessage, 4);
    this.sendRawMessage(sslMessage);
    
    // Wait for SSL response
    const sslResp = await this.readBytes(1);
    
    if (sslResp[0] === 0x4E) { // 'N' - OK, no SSL needed
      this.debugLog('SSL negotiated: no encryption');
    } else if (sslResp[0] === 0x53) { // 'S' - SSL required
      this.debugLog('Server requires SSL, establishing secure connection...');
      await this.upgradeToTLS();
    } else if (sslResp[0] === 0x45) { // 'E' - Error
      const errorMsg = [];
      while (true) {
        const byte = await this.readBytes(1);
        if (byte[0] === 0x00) break;
        errorMsg.push(byte[0]);
      }
      throw new InterfaceError(`SSL negotiation error: ${Buffer.from(errorMsg).toString('utf8')}`);
    }
    
    // 3. Now send user and other information (following nzpy order for VERSION_2)
    await this.sendHandshakeField(protocol.HSV2_USER, this.options.user);
    
    // Wait for acknowledgment after user
    let resp = await this.readBytes(1);
    this.debugLog('User response:', resp[0], 'hex:', resp[0].toString(16), 'char:', String.fromCharCode(resp[0]));
    if (resp[0] !== 0x4E) throw new InterfaceError('Expected user acknowledgment');
    
    // Send protocol (special format: opcode + protocol1 + protocol2)
    this.protocol1 = protocol.PG_PROTOCOL_3;
    this.protocol2 = protocol.PG_PROTOCOL_5;
    const protocolPayload = Buffer.alloc(6);
    protocolPayload.writeUInt16BE(protocol.HSV2_PROTOCOL, 0);
    protocolPayload.writeUInt16BE(this.protocol1, 2);
    protocolPayload.writeUInt16BE(this.protocol2, 4);
    const protocolMessage = Buffer.alloc(4 + protocolPayload.length);
    protocolMessage.writeInt32BE(protocolPayload.length + 4, 0);
    protocolPayload.copy(protocolMessage, 4);
    this.sendRawMessage(protocolMessage);
    
    resp = await this.readBytes(1);
    this.debugLog('Protocol response:', resp[0], 'hex:', resp[0].toString(16), 'char:', String.fromCharCode(resp[0]));
    if (resp[0] === 0x45) { // 'E' - Error
      const errorMsg = [];
      while (true) {
        const byte = await this.readBytes(1);
        if (byte[0] === 0x00) break;
        errorMsg.push(byte[0]);
      }
      this.debugLog('Protocol error:', Buffer.from(errorMsg).toString('utf8'));
      throw new InterfaceError(`Protocol error: ${Buffer.from(errorMsg).toString('utf8')}`);
    }
    if (resp[0] !== 0x4E) throw new InterfaceError('Expected protocol acknowledgment');
    
    // Send remote PID (special format: opcode + pid as int32)
    const pidPayload = Buffer.alloc(6);
    pidPayload.writeUInt16BE(protocol.HSV2_REMOTE_PID, 0);
    pidPayload.writeInt32BE(process.pid, 2);
    const pidMessage = Buffer.alloc(4 + pidPayload.length);
    pidMessage.writeInt32BE(pidPayload.length + 4, 0);
    pidPayload.copy(pidMessage, 4);
    this.sendRawMessage(pidMessage);
    
    resp = await this.readBytes(1);
    this.debugLog('Remote PID response:', resp[0], 'hex:', resp[0].toString(16), 'char:', String.fromCharCode(resp[0]));
    if (resp[0] !== 0x4E) throw new InterfaceError('Expected PID acknowledgment');
    
    // Send OPTIONS if provided (string format)
    // Skip for now - typically not used
    
    // Send client type (special format: opcode + client type as int16)
    const clientTypePayload = Buffer.alloc(4);
    clientTypePayload.writeUInt16BE(protocol.HSV2_CLIENT_TYPE, 0);
    clientTypePayload.writeUInt16BE(protocol.NPSCLIENT_TYPE_NODEJS, 2);
    const clientTypeMessage = Buffer.alloc(4 + clientTypePayload.length);
    clientTypeMessage.writeInt32BE(clientTypePayload.length + 4, 0);
    clientTypePayload.copy(clientTypeMessage, 4);
    this.sendRawMessage(clientTypeMessage);
    
    resp = await this.readBytes(1);
    this.debugLog('Client type response:', resp[0], 'hex:', resp[0].toString(16), 'char:', String.fromCharCode(resp[0]));
    if (resp[0] !== 0x4E) throw new InterfaceError('Expected client type acknowledgment');
    
    // Send CLIENT_DONE (just opcode, no value)
    const donePayload = Buffer.alloc(2);
    donePayload.writeUInt16BE(protocol.HSV2_CLIENT_DONE, 0);
    const doneMessage = Buffer.alloc(4 + donePayload.length);
    doneMessage.writeInt32BE(donePayload.length + 4, 0);
    donePayload.copy(doneMessage, 4);
    this.sendRawMessage(doneMessage);
    
    // NO response expected after CLIENT_DONE - authentication comes next
  }

  /**
   * Send a handshake field
   */
  private sendHandshakeField(opcode: number, value: string): void {
    const valueBuffer = Buffer.from(value + '\0', 'utf8'); // Add null terminator
    const payload = Buffer.alloc(2 + valueBuffer.length);
    
    payload.writeUInt16BE(opcode, 0);
    valueBuffer.copy(payload, 2);
    
    this.sendMessage(payload);
  }

  /**
   * Authenticate with the server
   */
  private async authenticate(): Promise<void> {
    // Read authentication request
    const messageType = await this.readBytes(1);
    
    this.debugLog('Received message type:', messageType[0], 'hex:', messageType[0].toString(16), 'char:', String.fromCharCode(messageType[0]));
    this.debugLog('Expected:', protocol.MESSAGE_TYPE_AUTHENTICATION, 'hex:', protocol.MESSAGE_TYPE_AUTHENTICATION.toString(16), 'char:', String.fromCharCode(protocol.MESSAGE_TYPE_AUTHENTICATION));
    this.debugLog('Current buffer length:', this.buffer.length);
    this.debugLog('Buffer content (first 100 bytes):', this.buffer.slice(0, 100).toString('hex'));
    this.debugLog('Buffer as text:', this.buffer.slice(0, 100).toString('utf8'));
    
    // Handle error message
    if (messageType[0] === protocol.MESSAGE_TYPE_ERROR_RESPONSE) {
      const lengthBytes = await this.readBytes(4);
      this.debugLog('Length bytes:', lengthBytes.toString('hex'));
      const length = lengthBytes.readInt32BE(0);
      this.debugLog('Error message length (BE):', length);
      const errorData = await this.readBytes(length - 4);
      const errorFields = this.parseErrorResponse(errorData);
      throw new OperationalError(`Server error: ${errorFields.message}`);
    }
    
    if (messageType[0] !== protocol.MESSAGE_TYPE_AUTHENTICATION) {
      throw new InterfaceError('Expected authentication request');
    }
    
    // Note: Netezza doesn't send a length field for authentication messages
    // Just read the auth type directly
    const authType = await this.readInt32();
    this.debugLog('Auth type:', authType);
    
    if (authType === protocol.AUTH_REQ_OK) {
      return; // No authentication required
    } else if (authType === protocol.AUTH_REQ_PASSWORD) {
      // Send plain password
      const passwordBuffer = Buffer.from(this.options.password + '\0', 'utf8');
      // Send with length prefix
      const lengthBuf = Buffer.alloc(4);
      lengthBuf.writeInt32BE(passwordBuffer.length + 4, 0);
      this.sendRawMessage(Buffer.concat([lengthBuf, passwordBuffer]));
      
      // Wait for auth OK
      await this.waitForAuthOk();
    } else if (authType === protocol.AUTH_REQ_MD5) {
      // MD5 authentication - read 2 bytes salt
      const salt = await this.readBytes(2);
      this.debugLog('MD5 salt:', salt.toString('hex'));
      const hash = this.md5Password(this.options.user, this.options.password, salt);
      
      const hashBuffer = Buffer.from(hash + '\0', 'utf8');
      // Send with length prefix
      const lengthBuf = Buffer.alloc(4);
      lengthBuf.writeInt32BE(hashBuffer.length + 4, 0);
      this.sendRawMessage(Buffer.concat([lengthBuf, hashBuffer]));
      
      // Wait for auth OK
      await this.waitForAuthOk();
    } else if (authType === protocol.AUTH_REQ_SHA256) {
      // SHA256 authentication - read 2 bytes salt
      const salt = await this.readBytes(2);
      this.debugLog('SHA256 salt:', salt.toString('hex'));
      const hash = this.sha256Password(this.options.password, salt);
      
      const hashBuffer = Buffer.from(hash + '\0', 'utf8');
      // Send with length prefix
      const lengthBuf = Buffer.alloc(4);
      lengthBuf.writeInt32BE(hashBuffer.length + 4, 0);
      this.sendRawMessage(Buffer.concat([lengthBuf, hashBuffer]));
      
      // Wait for auth OK
      await this.waitForAuthOk();
    } else {
      throw new InterfaceError(`Unsupported authentication type: ${authType}`);
    }
  }

  /**
   * Wait for authentication OK
   */
  private async waitForAuthOk(): Promise<void> {
    const messageType = await this.readBytes(1);
    this.debugLog('Auth response message type:', messageType[0], 'hex:', messageType[0].toString(16), 'char:', String.fromCharCode(messageType[0]));
    
    if (messageType[0] !== protocol.MESSAGE_TYPE_AUTHENTICATION) {
      throw new InterfaceError('Expected authentication response');
    }
    
    // No length field for auth messages
    const authType = await this.readInt32();
    this.debugLog('Auth response type:', authType);
    
    if (authType !== protocol.AUTH_REQ_OK) {
      throw new OperationalError('Authentication failed');
    }
  }

  /**
   * Wait for ready for query message
   */
  private async waitForReady(): Promise<void> {
    while (true) {
      const messageType = await this.readBytes(1);
      this.debugLog('waitForReady message type:', messageType[0], 'hex:', messageType[0].toString(16), 'char:', String.fromCharCode(messageType[0]));
      
      // During handshake phase, Netezza uses: type (1 byte) + unused (4 bytes) + length (4 bytes) + data
      // Exception: AUTHENTICATION_REQUEST only has type + auth type (4 bytes)
      
      if (messageType[0] === protocol.MESSAGE_TYPE_AUTHENTICATION) {
        // Additional auth message (should be AUTH_REQ_OK)
        const authType = await this.readInt32();
        this.debugLog('Additional auth type:', authType);
        if (authType !== protocol.AUTH_REQ_OK) {
          throw new OperationalError('Authentication failed in waitForReady');
        }
        continue;
      }
      
      // For all other message types during handshake: read 4 unused bytes, then length, then data
      const unused = await this.readBytes(4);
      this.debugLog('Unused bytes:', unused.toString('hex'));
      const length = await this.readInt32();
      this.debugLog('Message length:', length);
      
      if (messageType[0] === protocol.MESSAGE_TYPE_READY_FOR_QUERY) {
        this.debugLog('Ready for query!');
        // Read transaction status
        const data = await this.readBytes(length);
        this.transactionStatus = data[0];
        return;
      } else if (messageType[0] === protocol.MESSAGE_TYPE_PARAMETER_STATUS) {
        const data = await this.readBytes(length);
        this.debugLog('Parameter status:', data.toString('utf8'));
      } else if (messageType[0] === protocol.MESSAGE_TYPE_BACKEND_KEY_DATA) {
        // Backend key data - read PID and Key
        const pidBytes = await this.readBytes(4);
        const keyBytes = await this.readBytes(4);
        this.backendKeyData = {
          processId: pidBytes.readInt32BE(0),
          secretKey: keyBytes.readInt32BE(0)
        };
        this.debugLog('Backend key data - PID:', this.backendKeyData.processId, 'Key:', this.backendKeyData.secretKey);
      } else if (messageType[0] === protocol.MESSAGE_TYPE_ERROR_RESPONSE) {
        const data = await this.readBytes(length);
        this.debugLog('Error response data:', data.toString('hex'));
        this.debugLog('Error response text:', data.toString('utf8'));
        const error = this.parseErrorResponse(data);
        this.debugLog('Parsed error:', error);
        throw new DatabaseError(error.message);
      } else if (messageType[0] === protocol.MESSAGE_TYPE_NOTICE_RESPONSE) {
        const data = await this.readBytes(length);
        this.debugLog('Notice:', data.toString('utf8'));
      } else {
        this.debugLog('Unknown message type in waitForReady:', messageType[0], 'char:', String.fromCharCode(messageType[0]));
        const data = await this.readBytes(length);
        this.debugLog('Unknown message data:', data.toString('hex'));
      }
    }
  }

  /**
   * Execute a query
   */
  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    if (this.closed || !this.socket) {
      throw new ConnectionClosedError();
    }

    // Replace ? placeholders with $1, $2, etc. and substitute parameters
    if (params && params.length > 0) {
      let paramIndex = 0;
      sql = sql.replace(/\?/g, () => {
        const param = params[paramIndex++];
        // Simple parameter escaping - for production, use proper escaping
        if (param === null || param === undefined) {
          return 'NULL';
        } else if (typeof param === 'string') {
          // Escape single quotes by doubling them
          return `'${param.replace(/'/g, "''")}'`;
        } else if (typeof param === 'number') {
          return String(param);
        } else if (typeof param === 'boolean') {
          return param ? 'TRUE' : 'FALSE';
        } else if (param instanceof Date) {
          return `'${param.toISOString()}'`;
        } else {
          return `'${String(param).replace(/'/g, "''")}'`;
        }
      });
    }

    // Always use simple query protocol
    return await this.executeSimple(sql);
  }

  /**
   * Execute simple query (no parameters)
   */
  private async executeSimple(sql: string): Promise<QueryResult> {
    // Send query message
    const sqlBuffer = Buffer.from(sql + '\0', 'utf8');
    const payload = Buffer.alloc(1 + 4 + sqlBuffer.length);
    
    payload[0] = protocol.MESSAGE_TYPE_QUERY;
    payload.writeInt32BE(4 + sqlBuffer.length, 1);
    sqlBuffer.copy(payload, 5);
    
    this.sendRawMessage(payload);
    
    // Read response
    return await this.readQueryResponse();
  }

  /**
   * Execute extended query (with parameters)
   */
  private async executeExtended(sql: string, params: any[]): Promise<QueryResult> {
    const portalName = '';
    const statementName = '';
    
    // Parse
    await this.sendParse(statementName, sql);
    
    // Bind
    await this.sendBind(portalName, statementName, params);
    
    // Describe
    await this.sendDescribe('P', portalName);
    
    // Execute
    await this.sendExecute(portalName, 0);
    
    // Sync
    await this.sendSync();
    
    // Read responses
    return await this.readExtendedQueryResponse();
  }

  /**
   * Send Parse message
   */
  private sendParse(statementName: string, sql: string): void {
    const stmtBuffer = Buffer.from(statementName + '\0', 'utf8');
    const sqlBuffer = Buffer.from(sql + '\0', 'utf8');
    const paramTypes = Buffer.alloc(2); // No type OIDs
    paramTypes.writeUInt16BE(0, 0);
    
    const payload = Buffer.alloc(
      1 + 4 + stmtBuffer.length + sqlBuffer.length + paramTypes.length
    );
    
    let offset = 0;
    payload[offset++] = protocol.MESSAGE_TYPE_PARSE;
    payload.writeInt32BE(
      4 + stmtBuffer.length + sqlBuffer.length + paramTypes.length,
      offset
    );
    offset += 4;
    stmtBuffer.copy(payload, offset);
    offset += stmtBuffer.length;
    sqlBuffer.copy(payload, offset);
    offset += sqlBuffer.length;
    paramTypes.copy(payload, offset);
    
    this.sendRawMessage(payload);
  }

  /**
   * Send Bind message
   */
  private sendBind(portalName: string, statementName: string, params: any[]): void {
    const portalBuffer = Buffer.from(portalName + '\0', 'utf8');
    const stmtBuffer = Buffer.from(statementName + '\0', 'utf8');
    
    // Format codes for parameters (0 = text)
    const formatCodes = Buffer.alloc(2);
    formatCodes.writeUInt16BE(0, 0);
    
    // Encode parameters
    const paramBuffers: Buffer[] = [];
    const paramCount = Buffer.alloc(2);
    paramCount.writeUInt16BE(params.length, 0);
    
    for (const param of params) {
      if (param === null || param === undefined) {
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeInt32BE(-1, 0);
        paramBuffers.push(lenBuf);
      } else {
        const valueStr = String(param);
        const valueBuf = Buffer.from(valueStr, 'utf8');
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeInt32BE(valueBuf.length, 0);
        paramBuffers.push(Buffer.concat([lenBuf, valueBuf]));
      }
    }
    
    // Result format codes (0 = text)
    const resultFormats = Buffer.alloc(2);
    resultFormats.writeUInt16BE(0, 0);
    
    const totalLength =
      1 + 4 + portalBuffer.length + stmtBuffer.length +
      formatCodes.length + paramCount.length +
      paramBuffers.reduce((sum, buf) => sum + buf.length, 0) +
      resultFormats.length;
    
    const payload = Buffer.alloc(totalLength);
    let offset = 0;
    
    payload[offset++] = protocol.MESSAGE_TYPE_BIND;
    payload.writeInt32BE(totalLength - 1, offset);
    offset += 4;
    portalBuffer.copy(payload, offset);
    offset += portalBuffer.length;
    stmtBuffer.copy(payload, offset);
    offset += stmtBuffer.length;
    formatCodes.copy(payload, offset);
    offset += formatCodes.length;
    paramCount.copy(payload, offset);
    offset += paramCount.length;
    
    for (const paramBuf of paramBuffers) {
      paramBuf.copy(payload, offset);
      offset += paramBuf.length;
    }
    
    resultFormats.copy(payload, offset);
    
    this.sendRawMessage(payload);
  }

  /**
   * Send Describe message
   */
  private sendDescribe(type: string, name: string): void {
    const nameBuffer = Buffer.from(name + '\0', 'utf8');
    const payload = Buffer.alloc(1 + 4 + 1 + nameBuffer.length);
    
    let offset = 0;
    payload[offset++] = protocol.MESSAGE_TYPE_DESCRIBE;
    payload.writeInt32BE(4 + 1 + nameBuffer.length, offset);
    offset += 4;
    payload[offset++] = type.charCodeAt(0);
    nameBuffer.copy(payload, offset);
    
    this.sendRawMessage(payload);
  }

  /**
   * Send Execute message
   */
  private sendExecute(portalName: string, maxRows: number): void {
    const nameBuffer = Buffer.from(portalName + '\0', 'utf8');
    const payload = Buffer.alloc(1 + 4 + nameBuffer.length + 4);
    
    let offset = 0;
    payload[offset++] = protocol.MESSAGE_TYPE_EXECUTE;
    payload.writeInt32BE(4 + nameBuffer.length + 4, offset);
    offset += 4;
    nameBuffer.copy(payload, offset);
    offset += nameBuffer.length;
    payload.writeInt32BE(maxRows, offset);
    
    this.sendRawMessage(payload);
  }

  /**
   * Send Sync message
   */
  private sendSync(): void {
    const payload = Buffer.alloc(5);
    payload[0] = protocol.MESSAGE_TYPE_SYNC;
    payload.writeInt32BE(4, 1);
    this.sendRawMessage(payload);
  }

  /**
   * Read simple query response
   */
  private async readQueryResponse(): Promise<QueryResult> {
    const result: QueryResult = {
      rows: [],
      rowCount: 0
    };
    
    let fields: FieldDescription[] | undefined;
    
    while (true) {
      const messageType = await this.readBytes(1);
      this.debugLog('Query response message type:', messageType[0], 'hex:', messageType[0].toString(16), 'char:', String.fromCharCode(messageType[0]));
      
      // Netezza uses the handshake format even for queries: type + unused (4 bytes) + length (4 bytes) + data
      const unused = await this.readBytes(4);
      this.debugLog('Unused bytes:', unused.toString('hex'));
      const length = await this.readInt32();
      this.debugLog('Query response length:', length);
      const data = await this.readBytes(length);
      this.debugLog('Query response data (first 100 bytes):', data.slice(0, 100).toString('hex'));
      
      if (messageType[0] === protocol.MESSAGE_TYPE_ROW_DESCRIPTION) {
        fields = this.parseRowDescription(data);
        result.fields = fields;
      } else if (messageType[0] === protocol.MESSAGE_TYPE_DATA_ROW) {
        if (fields) {
          const row = this.parseDataRow(data, fields);
          (result.rows as any[]).push(row);
        }
      } else if (messageType[0] === protocol.MESSAGE_TYPE_COMMAND_COMPLETE) {
        const commandStr = data.toString('utf8', 0, data.length - 1);
        result.command = commandStr;
        
        // Extract row count from command string
        const match = commandStr.match(/(\d+)$/);
        if (match) {
          result.rowCount = parseInt(match[1], 10);
        } else {
          result.rowCount = result.rows.length;
        }
      } else if (messageType[0] === protocol.MESSAGE_TYPE_READY_FOR_QUERY) {
        this.transactionStatus = data[0];
        return result;
      } else if (messageType[0] === protocol.MESSAGE_TYPE_ERROR_RESPONSE) {
        const error = this.parseErrorResponse(data);
        throw new DatabaseError(error.message);
      } else if (messageType[0] === protocol.MESSAGE_TYPE_EMPTY_QUERY) {
        // Empty query
      } else if (messageType[0] === protocol.MESSAGE_TYPE_NOTICE_RESPONSE) {
        // Ignore notices for now
      }
    }
  }

  /**
   * Read extended query response
   */
  private async readExtendedQueryResponse(): Promise<QueryResult> {
    const result: QueryResult = {
      rows: [],
      rowCount: 0
    };
    
    let fields: FieldDescription[] | undefined;
    
    while (true) {
      const messageType = await this.readBytes(1);
      this.debugLog('Extended query response message type:', messageType[0], 'hex:', messageType[0].toString(16), 'char:', String.fromCharCode(messageType[0]));
      
      // Netezza uses handshake format: type + unused (4 bytes) + length (4 bytes) + data
      const unused = await this.readBytes(4);
      this.debugLog('Extended unused bytes:', unused.toString('hex'));
      const length = await this.readInt32();
      this.debugLog('Extended query response length:', length);
      const data = await this.readBytes(length);
      this.debugLog('Extended query response data (first 100 bytes):', data.slice(0, 100).toString('hex'));
      
      if (messageType[0] === protocol.MESSAGE_TYPE_PARSE_COMPLETE) {
        this.debugLog('Parse complete');
        // Parse complete
      } else if (messageType[0] === protocol.MESSAGE_TYPE_BIND_COMPLETE) {
        this.debugLog('Bind complete');
        // Bind complete
      } else if (messageType[0] === protocol.MESSAGE_TYPE_ROW_DESCRIPTION) {
        fields = this.parseRowDescription(data);
        result.fields = fields;
      } else if (messageType[0] === protocol.MESSAGE_TYPE_NO_DATA) {
        this.debugLog('No data');
        // No data (for non-SELECT queries)
      } else if (messageType[0] === protocol.MESSAGE_TYPE_DATA_ROW) {
        if (fields) {
          const row = this.parseDataRow(data, fields);
          (result.rows as any[]).push(row);
        }
      } else if (messageType[0] === protocol.MESSAGE_TYPE_COMMAND_COMPLETE) {
        const commandStr = data.toString('utf8', 0, data.length - 1);
        result.command = commandStr;
        this.debugLog('Command complete:', commandStr);
        
        const match = commandStr.match(/(\d+)$/);
        if (match) {
          result.rowCount = parseInt(match[1], 10);
        } else {
          result.rowCount = result.rows.length;
        }
      } else if (messageType[0] === protocol.MESSAGE_TYPE_READY_FOR_QUERY) {
        this.debugLog('Ready for query in extended');
        this.transactionStatus = data[0];
        return result;
      } else if (messageType[0] === protocol.MESSAGE_TYPE_ERROR_RESPONSE) {
        const error = this.parseErrorResponse(data);
        throw new DatabaseError(error.message);
      }
    }
  }

  /**
   * Parse row description
   */
  private parseRowDescription(data: Buffer): FieldDescription[] {
    this.debugLog('parseRowDescription data length:', data.length, 'hex:', data.toString('hex'));
    const fieldCount = data.readInt16BE(0);
    this.debugLog('Field count:', fieldCount);
    const fields: FieldDescription[] = [];
    
    let offset = 2;
    for (let i = 0; i < fieldCount; i++) {
      this.debugLog('Parsing field', i, 'offset:', offset);
      // Read field name (null-terminated string)
      const nameEnd = data.indexOf(0, offset);
      this.debugLog('Name end at:', nameEnd);
      const name = data.toString('utf8', offset, nameEnd).toLowerCase();
      this.debugLog('Field name:', name);
      offset = nameEnd + 1;
      
      // Netezza format: type_oid (4), type_size (2), type_modifier (4), format (1) = 11 bytes total
      this.debugLog('Reading typeOid at offset:', offset);
      const typeOid = data.readInt32BE(offset);
      offset += 4;
      const typeSize = data.readInt16BE(offset);
      offset += 2;
      const typeMod = data.readInt32BE(offset);
      offset += 4;
      const formatCode = data.readUInt8(offset);
      offset += 1;
      
      this.debugLog('Field:', { name, typeOid, typeSize, typeMod, formatCode });
      
      fields.push({
        name,
        tableOid: 0, // Not provided by Netezza
        columnNumber: i,
        typeOid,
        typeSize,
        typeMod,
        formatCode
      });
    }
    
    return fields;
  }

  /**
   * Parse data row (Netezza format with bitmap for NULL values)
   */
  private parseDataRow(data: Buffer, fields: FieldDescription[]): QueryRow | any[] {
    const isArrayMode = this.options.rowMode === 'array';
    const row: QueryRow | any[] = isArrayMode ? [] : {};
    
    // Calculate bitmap length
    const columnCount = fields.length;
    const bitmapLen = Math.ceil(columnCount / 8);
    
    // Read bitmap
    const bitmap: number[] = [];
    for (let i = 0; i < bitmapLen; i++) {
      const byte = data[i];
      for (let bit = 7; bit >= 0; bit--) {
        bitmap.push((byte >> bit) & 1);
      }
    }
    
    this.debugLog('Bitmap:', bitmap.slice(0, columnCount));
    
    let dataIdx = bitmapLen;
    for (let i = 0; i < columnCount; i++) {
      const field = fields[i];
      
      if (bitmap[i] === 0) {
        // NULL value
        if (isArrayMode) {
          (row as any[]).push(null);
        } else {
          (row as QueryRow)[field.name] = null;
        }
      } else {
        // Read length (4 bytes) and data
        const valueLength = data.readInt32BE(dataIdx);
        dataIdx += 4;
        const valueBuffer = data.slice(dataIdx, dataIdx + valueLength - 4);
        dataIdx += valueLength - 4;
        
        this.debugLog('Column', field.name, 'length:', valueLength, 'data:', valueBuffer.toString('hex'));
        
        // Convert value based on type
        const converter = getTypeConverter(field.typeOid);
        let value: any;
        try {
          value = converter.decode(valueBuffer);
        } catch (err) {
          // Fallback to string
          value = valueBuffer.toString('utf8');
        }
        
        if (isArrayMode) {
          (row as any[]).push(value);
        } else {
          (row as QueryRow)[field.name] = value;
        }
      }
    }
    
    return row;
  }

  /**
   * Parse error response (Netezza format)
   */
  private parseErrorResponse(data: Buffer): { message: string; code?: string } {
    // Netezza error format: length (4 bytes) + error text
    if (data.length < 4) {
      return { message: 'Unknown error' };
    }
    
    const messageLength = data.readInt32BE(0);
    const messageText = data.toString('utf8', 4, 4 + messageLength);
    
    return { message: messageText };
  }

  /**
   * MD5 password hash (Netezza style)
   */
  private md5Password(user: string, password: string, salt: Buffer): string {
    const passwordBuffer = Buffer.from(password, 'utf8');
    const hash = crypto.createHash('md5')
      .update(Buffer.concat([salt, passwordBuffer]))
      .digest();
    // Base64 encode and remove padding
    return Buffer.from(hash).toString('base64').replace(/=+$/, '');
  }

  /**
   * SHA256 password hash (Netezza style)
   */
  private sha256Password(password: string, salt: Buffer): string {
    const passwordBuffer = Buffer.from(password, 'utf8');
    const hash = crypto.createHash('sha256')
      .update(Buffer.concat([salt, passwordBuffer]))
      .digest();
    // Base64 encode and remove padding
    return Buffer.from(hash).toString('base64').replace(/=+$/, '');
  }

  /**
   * Send a message with length prefix
   */
  private sendMessage(data: Buffer): void {
    const length = Buffer.alloc(4);
    length.writeInt32BE(data.length + 4, 0);
    
    if (!this.socket) {
      throw new ConnectionClosedError();
    }
    
    this.socket.write(Buffer.concat([length, data]));
  }

  /**
   * Send a raw message (already has type and length)
   */
  private sendRawMessage(data: Buffer): void {
    if (!this.socket) {
      throw new ConnectionClosedError();
    }
    
    this.socket.write(data);
  }

  /**
   * Read a specific number of bytes
   */
  private async readBytes(count: number): Promise<Buffer> {
    while (this.buffer.length < count) {
      await this.waitForData();
    }
    
    const result = this.buffer.slice(0, count);
    this.buffer = this.buffer.slice(count);
    return result;
  }

  /**
   * Read a 32-bit integer
   */
  private async readInt32(): Promise<number> {
    const bytes = await this.readBytes(4);
    return bytes.readInt32BE(0);
  }

  /**
   * Wait for data to arrive
   */
  private async waitForData(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new ConnectionClosedError());
        return;
      }
      
      const onData = () => {
        cleanup();
        resolve();
      };
      
      const onError = (err: Error) => {
        cleanup();
        reject(new OperationalError(`Socket error: ${err.message}`));
      };
      
      const onEnd = () => {
        cleanup();
        reject(new ConnectionClosedError('Connection closed by server'));
      };
      
      const cleanup = () => {
        if (this.socket) {
          this.socket.off('data', onData);
          this.socket.off('error', onError);
          this.socket.off('end', onEnd);
        }
      };
      
      this.socket.once('data', onData);
      this.socket.once('error', onError);
      this.socket.once('end', onEnd);
    });
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.closed || !this.socket) {
      return;
    }
    
    try {
      // Send terminate message
      const payload = Buffer.alloc(5);
      payload[0] = protocol.MESSAGE_TYPE_TERMINATE;
      payload.writeInt32BE(4, 1);
      this.sendRawMessage(payload);
    } catch (err) {
      // Ignore errors when closing
    }
    
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.destroy();
        this.socket = undefined;
        this.closed = true;
        resolve();
      } else {
        this.closed = true;
        resolve();
      }
    });
  }
}

/**
 * Create a new connection
 */
export async function connect(options: ConnectionOptions): Promise<Connection> {
  const conn = new Connection(options);
  await conn.connect();
  return conn;
}
