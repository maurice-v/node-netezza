import * as net from 'net';
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
}

/**
 * Query result row
 */
export interface QueryRow {
  [key: string]: any;
}

/**
 * Query result
 */
export interface QueryResult {
  rows: QueryRow[];
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
  private socket?: net.Socket;
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
      ...options
    };
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
        host: this.options.host,
        port: this.options.port,
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
   * Send handshake information
   */
  private async sendHandshakeInfo(): Promise<void> {
    // Send database
    await this.sendHandshakeField(protocol.HSV2_DB, this.options.database);
    
    // Send user
    await this.sendHandshakeField(protocol.HSV2_USER, this.options.user);
    
    // Send client type
    await this.sendHandshakeField(
      protocol.HSV2_CLIENT_TYPE,
      protocol.NPSCLIENT_TYPE_NODEJS.toString()
    );
    
    // Send protocol
    this.protocol1 = protocol.PG_PROTOCOL_5;
    await this.sendHandshakeField(
      protocol.HSV2_PROTOCOL,
      this.protocol1.toString()
    );
    
    // Send application name
    if (this.options.applicationName) {
      await this.sendHandshakeField(
        protocol.HSV2_APPNAME,
        this.options.applicationName
      );
    }
    
    // Send client OS
    await this.sendHandshakeField(protocol.HSV2_CLIENT_OS, os.platform());
    
    // Send client hostname
    await this.sendHandshakeField(protocol.HSV2_CLIENT_HOST_NAME, os.hostname());
    
    // Send client OS user
    await this.sendHandshakeField(protocol.HSV2_CLIENT_OS_USER, os.userInfo().username);
    
    // Send remote PID
    await this.sendHandshakeField(protocol.HSV2_REMOTE_PID, process.pid.toString());
    
    // Send done
    await this.sendHandshakeField(protocol.HSV2_CLIENT_DONE, '');
  }

  /**
   * Send a handshake field
   */
  private sendHandshakeField(opcode: number, value: string): void {
    const valueBuffer = Buffer.from(value, 'utf8');
    const payload = Buffer.alloc(4 + valueBuffer.length);
    
    payload.writeUInt16BE(opcode, 0);
    payload.writeUInt16BE(valueBuffer.length, 2);
    valueBuffer.copy(payload, 4);
    
    this.sendMessage(payload);
  }

  /**
   * Authenticate with the server
   */
  private async authenticate(): Promise<void> {
    // Read authentication request
    const messageType = await this.readBytes(1);
    
    if (messageType[0] !== protocol.MESSAGE_TYPE_AUTHENTICATION) {
      throw new InterfaceError('Expected authentication request');
    }
    
    const length = await this.readInt32();
    const authType = await this.readInt32();
    
    if (authType === protocol.AUTH_REQ_OK) {
      return; // No authentication required
    } else if (authType === protocol.AUTH_REQ_PASSWORD) {
      // Send password
      const passwordBuffer = Buffer.from(this.options.password + '\0', 'utf8');
      const payload = Buffer.alloc(1 + 4 + passwordBuffer.length);
      
      payload[0] = 0x70; // 'p'
      payload.writeInt32BE(4 + passwordBuffer.length, 1);
      passwordBuffer.copy(payload, 5);
      
      this.sendRawMessage(payload);
      
      // Wait for auth OK
      await this.waitForAuthOk();
    } else if (authType === protocol.AUTH_REQ_MD5) {
      // MD5 authentication
      const salt = await this.readBytes(4);
      const hash = this.md5Password(this.options.user, this.options.password, salt);
      
      const hashBuffer = Buffer.from('md5' + hash + '\0', 'utf8');
      const payload = Buffer.alloc(1 + 4 + hashBuffer.length);
      
      payload[0] = 0x70; // 'p'
      payload.writeInt32BE(4 + hashBuffer.length, 1);
      hashBuffer.copy(payload, 5);
      
      this.sendRawMessage(payload);
      
      // Wait for auth OK
      await this.waitForAuthOk();
    } else if (authType === protocol.AUTH_REQ_SHA256) {
      // SHA256 authentication
      const salt = await this.readBytes(length - 8);
      const hash = this.sha256Password(this.options.password, salt);
      
      const hashBuffer = Buffer.from(hash + '\0', 'utf8');
      const payload = Buffer.alloc(1 + 4 + hashBuffer.length);
      
      payload[0] = 0x70; // 'p'
      payload.writeInt32BE(4 + hashBuffer.length, 1);
      hashBuffer.copy(payload, 5);
      
      this.sendRawMessage(payload);
      
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
    
    if (messageType[0] !== protocol.MESSAGE_TYPE_AUTHENTICATION) {
      throw new InterfaceError('Expected authentication response');
    }
    
    const length = await this.readInt32();
    const authType = await this.readInt32();
    
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
      const length = await this.readInt32();
      const data = await this.readBytes(length - 4);
      
      if (messageType[0] === protocol.MESSAGE_TYPE_READY_FOR_QUERY) {
        this.transactionStatus = data[0];
        return;
      } else if (messageType[0] === protocol.MESSAGE_TYPE_PARAMETER_STATUS) {
        // Ignore parameter status for now
      } else if (messageType[0] === protocol.MESSAGE_TYPE_BACKEND_KEY_DATA) {
        this.backendKeyData = {
          processId: data.readInt32BE(0),
          secretKey: data.readInt32BE(4)
        };
      } else if (messageType[0] === protocol.MESSAGE_TYPE_ERROR_RESPONSE) {
        const error = this.parseErrorResponse(data);
        throw new DatabaseError(error.message);
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

    // Replace ? placeholders with $1, $2, etc.
    let paramIndex = 1;
    const convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

    if (params && params.length > 0) {
      // Use extended query protocol
      return await this.executeExtended(convertedSql, params);
    } else {
      // Use simple query protocol
      return await this.executeSimple(convertedSql);
    }
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
      const length = await this.readInt32();
      const data = await this.readBytes(length - 4);
      
      if (messageType[0] === protocol.MESSAGE_TYPE_ROW_DESCRIPTION) {
        fields = this.parseRowDescription(data);
        result.fields = fields;
      } else if (messageType[0] === protocol.MESSAGE_TYPE_DATA_ROW) {
        if (fields) {
          const row = this.parseDataRow(data, fields);
          result.rows.push(row);
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
      const length = await this.readInt32();
      const data = await this.readBytes(length - 4);
      
      if (messageType[0] === protocol.MESSAGE_TYPE_PARSE_COMPLETE) {
        // Parse complete
      } else if (messageType[0] === protocol.MESSAGE_TYPE_BIND_COMPLETE) {
        // Bind complete
      } else if (messageType[0] === protocol.MESSAGE_TYPE_ROW_DESCRIPTION) {
        fields = this.parseRowDescription(data);
        result.fields = fields;
      } else if (messageType[0] === protocol.MESSAGE_TYPE_NO_DATA) {
        // No data (for non-SELECT queries)
      } else if (messageType[0] === protocol.MESSAGE_TYPE_DATA_ROW) {
        if (fields) {
          const row = this.parseDataRow(data, fields);
          result.rows.push(row);
        }
      } else if (messageType[0] === protocol.MESSAGE_TYPE_COMMAND_COMPLETE) {
        const commandStr = data.toString('utf8', 0, data.length - 1);
        result.command = commandStr;
        
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
      }
    }
  }

  /**
   * Parse row description
   */
  private parseRowDescription(data: Buffer): FieldDescription[] {
    const fieldCount = data.readInt16BE(0);
    const fields: FieldDescription[] = [];
    
    let offset = 2;
    for (let i = 0; i < fieldCount; i++) {
      // Read field name (null-terminated string)
      const nameEnd = data.indexOf(0, offset);
      const name = data.toString('utf8', offset, nameEnd);
      offset = nameEnd + 1;
      
      const tableOid = data.readInt32BE(offset);
      offset += 4;
      const columnNumber = data.readInt16BE(offset);
      offset += 2;
      const typeOid = data.readInt32BE(offset);
      offset += 4;
      const typeSize = data.readInt16BE(offset);
      offset += 2;
      const typeMod = data.readInt32BE(offset);
      offset += 4;
      const formatCode = data.readInt16BE(offset);
      offset += 2;
      
      fields.push({
        name,
        tableOid,
        columnNumber,
        typeOid,
        typeSize,
        typeMod,
        formatCode
      });
    }
    
    return fields;
  }

  /**
   * Parse data row
   */
  private parseDataRow(data: Buffer, fields: FieldDescription[]): QueryRow {
    const columnCount = data.readInt16BE(0);
    const row: QueryRow = {};
    
    let offset = 2;
    for (let i = 0; i < columnCount; i++) {
      const field = fields[i];
      const length = data.readInt32BE(offset);
      offset += 4;
      
      if (length === -1) {
        // NULL value
        row[field.name] = null;
      } else {
        const valueBuffer = data.slice(offset, offset + length);
        offset += length;
        
        // Convert value based on type
        const converter = getTypeConverter(field.typeOid);
        try {
          row[field.name] = converter.decode(valueBuffer);
        } catch (err) {
          // Fallback to string
          row[field.name] = valueBuffer.toString('utf8');
        }
      }
    }
    
    return row;
  }

  /**
   * Parse error response
   */
  private parseErrorResponse(data: Buffer): { message: string; code?: string } {
    let message = 'Unknown error';
    let code: string | undefined;
    
    let offset = 0;
    while (offset < data.length) {
      const fieldType = data[offset++];
      if (fieldType === 0) break;
      
      const endOffset = data.indexOf(0, offset);
      if (endOffset === -1) break;
      
      const value = data.toString('utf8', offset, endOffset);
      offset = endOffset + 1;
      
      if (fieldType === 0x4D) { // 'M' - message
        message = value;
      } else if (fieldType === 0x43) { // 'C' - code
        code = value;
      }
    }
    
    return { message, code };
  }

  /**
   * MD5 password hash
   */
  private md5Password(user: string, password: string, salt: Buffer): string {
    const hash1 = crypto.createHash('md5').update(password + user).digest('hex');
    const hash2 = crypto.createHash('md5')
      .update(Buffer.concat([Buffer.from(hash1), salt]))
      .digest('hex');
    return hash2;
  }

  /**
   * SHA256 password hash
   */
  private sha256Password(password: string, salt: Buffer): string {
    return crypto.createHash('sha256')
      .update(Buffer.concat([Buffer.from(password, 'utf8'), salt]))
      .digest('hex');
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
        this.socket.end(() => {
          this.closed = true;
          resolve();
        });
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
