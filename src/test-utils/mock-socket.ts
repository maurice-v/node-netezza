import { EventEmitter } from 'events';
import * as protocol from '../protocol';

/**
 * Mock socket for testing connection and protocol behavior
 */
export class MockSocket extends EventEmitter {
  public written: Buffer[] = [];
  public destroyed: boolean = false;
  public ended: boolean = false;
  private responseQueue: Buffer[] = [];
  private autoRespond: boolean = true;

  constructor(autoRespond: boolean = true) {
    super();
    this.autoRespond = autoRespond;
  }

  write(data: Buffer): boolean {
    this.written.push(data);

    if (this.autoRespond) {
      // Auto-respond based on message type
      this.processMessage(data);
    }

    return true;
  }

  destroy(): void {
    this.destroyed = true;
    this.emit('close');
  }

  end(): void {
    this.ended = true;
    this.emit('end');
  }

  /**
   * Queue a response to be emitted
   */
  queueResponse(data: Buffer): void {
    this.responseQueue.push(data);
  }

  /**
   * Emit all queued responses
   */
  emitResponses(): void {
    for (const data of this.responseQueue) {
      this.emit('data', data);
    }
    this.responseQueue = [];
  }

  /**
   * Emit data immediately
   */
  emitData(data: Buffer): void {
    this.emit('data', data);
  }

  /**
   * Simulate connection established
   */
  simulateConnect(): void {
    setImmediate(() => this.emit('connect'));
  }

  /**
   * Simulate an error
   */
  simulateError(error: Error): void {
    this.emit('error', error);
  }

  /**
   * Simulate timeout
   */
  simulateTimeout(): void {
    this.emit('timeout');
  }

  /**
   * Process incoming message and generate appropriate response
   */
  private processMessage(data: Buffer): void {
    // Check if this is a handshake message (length-prefixed)
    if (data.length >= 4) {
      const length = data.readInt32BE(0);

      if (length === data.length) {
        // This is a handshake message
        if (data.length >= 6) {
          const opcode = data.readUInt16BE(4);
          this.handleHandshakeMessage(opcode, data);
        }
      } else if (data.length >= 5) {
        // This might be a query message
        const messageType = data[0];
        this.handleProtocolMessage(messageType, data);
      }
    }
  }

  /**
   * Handle handshake messages
   */
  private handleHandshakeMessage(opcode: number, data: Buffer): void {
    switch (opcode) {
      case protocol.HSV2_CLIENT_BEGIN:
        // Respond with 'N' (OK)
        this.queueResponse(Buffer.from([0x4E]));
        break;

      case protocol.HSV2_DB:
      case protocol.HSV2_USER:
      case protocol.HSV2_PROTOCOL:
      case protocol.HSV2_REMOTE_PID:
      case protocol.HSV2_CLIENT_TYPE:
        // Respond with 'N' (OK)
        this.queueResponse(Buffer.from([0x4E]));
        break;

      case protocol.HSV2_SSL_NEGOTIATE:
        // Respond with 'N' (no SSL needed)
        this.queueResponse(Buffer.from([0x4E]));
        break;

      case protocol.HSV2_CLIENT_DONE:
        // No response needed, authentication will follow
        break;
    }

    // Emit queued responses after a short delay
    setImmediate(() => this.emitResponses());
  }

  /**
   * Handle protocol messages (queries, etc.)
   */
  private handleProtocolMessage(messageType: number, data: Buffer): void {
    if (messageType === protocol.MESSAGE_TYPE_QUERY) {
      // Respond with a simple query response
      this.respondToQuery();
    } else if (messageType === protocol.MESSAGE_TYPE_TERMINATE) {
      // Connection closed
      this.end();
    }
  }

  /**
   * Send authentication request
   */
  sendAuthRequest(authType: number = protocol.AUTH_REQ_OK): void {
    const authMessage = Buffer.alloc(5);
    authMessage[0] = protocol.MESSAGE_TYPE_AUTHENTICATION;
    authMessage.writeInt32BE(authType, 1);
    this.emitData(authMessage);
  }

  /**
   * Send ready for query
   */
  sendReadyForQuery(): void {
    // Type + unused (4) + length (4) + status (1)
    const message = Buffer.alloc(10);
    let offset = 0;

    message[offset++] = protocol.MESSAGE_TYPE_READY_FOR_QUERY;
    message.writeInt32BE(0, offset); // unused
    offset += 4;
    message.writeInt32BE(1, offset); // length
    offset += 4;
    message[offset] = protocol.TRANSACTION_STATUS_IDLE;

    this.emitData(message);
  }

  /**
   * Respond to a query with empty result
   */
  private respondToQuery(): void {
    // Send Command Complete
    const commandStr = 'SELECT 0\0';
    const commandData = Buffer.from(commandStr, 'utf8');

    const cmdComplete = Buffer.alloc(9 + commandData.length);
    let offset = 0;

    cmdComplete[offset++] = protocol.MESSAGE_TYPE_COMMAND_COMPLETE;
    cmdComplete.writeInt32BE(0, offset); // unused
    offset += 4;
    cmdComplete.writeInt32BE(commandData.length, offset); // length
    offset += 4;
    commandData.copy(cmdComplete, offset);

    this.queueResponse(cmdComplete);

    // Send Ready for Query
    const readyMsg = Buffer.alloc(10);
    offset = 0;
    readyMsg[offset++] = protocol.MESSAGE_TYPE_READY_FOR_QUERY;
    readyMsg.writeInt32BE(0, offset); // unused
    offset += 4;
    readyMsg.writeInt32BE(1, offset); // length
    offset += 4;
    readyMsg[offset] = protocol.TRANSACTION_STATUS_IDLE;

    this.queueResponse(readyMsg);

    setImmediate(() => this.emitResponses());
  }

  /**
   * Get the last written message
   */
  getLastWritten(): Buffer | undefined {
    return this.written[this.written.length - 1];
  }

  /**
   * Clear written messages
   */
  clearWritten(): void {
    this.written = [];
  }
}

/**
 * Create a mock socket that simulates successful connection
 */
export function createMockSocket(autoRespond: boolean = true): MockSocket {
  return new MockSocket(autoRespond);
}
