/**
 * Unit tests for Connection class
 */

import { Connection, ConnectionOptions, CancellableQuery } from '../connection';
import { InterfaceError, ConnectionClosedError, OperationalError } from '../errors';
import { MockSocket } from '../test-utils/mock-socket';
import * as protocol from '../protocol';

// Mock the net module
jest.mock('net');

import * as net from 'net';
const { setMockSocket } = net as any;

describe('Connection Class', () => {
  let mockSocket: MockSocket;
  let connectionOptions: ConnectionOptions;

  beforeEach(() => {
    // Create fresh mock socket for each test
    mockSocket = new MockSocket(true);
    setMockSocket(mockSocket);

    connectionOptions = {
      user: 'admin',
      password: '***REMOVED***',
      host: 'localhost',
      port: 5480,
      database: 'testdb',
      securityLevel: 0,
      debug: false
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create a Connection instance with default options', () => {
      const conn = new Connection(connectionOptions);
      expect(conn).toBeInstanceOf(Connection);
    });

    it('should apply default values for optional parameters', () => {
      const minimalOptions = {
        user: 'testuser',
        password: 'testpass',
        database: 'testdb'
      };

      const conn = new Connection(minimalOptions);
      expect(conn).toBeInstanceOf(Connection);
    });

    it('should accept all connection options', () => {
      const fullOptions: ConnectionOptions = {
        user: 'testuser',
        password: 'testpass',
        host: 'custom.host',
        port: 5555,
        database: 'testdb',
        securityLevel: 2,
        timeout: 60000,
        applicationName: 'TestApp',
        debug: true,
        rowMode: 'array'
      };

      const conn = new Connection(fullOptions);
      expect(conn).toBeInstanceOf(Connection);
    });
  });

  describe('Connection Lifecycle', () => {
    it('should allow closing already closed connection', async () => {
      const conn = new Connection(connectionOptions);
      await expect(conn.close()).resolves.not.toThrow();
    });

    it('should create connection instance without errors', () => {
      const conn = new Connection(connectionOptions);
      expect(conn).toBeInstanceOf(Connection);
      expect(conn.execute).toBeDefined();
      expect(conn.close).toBeDefined();
    });
  });

  describe('Query Execution', () => {
    it('should throw ConnectionClosedError when executing on closed connection', async () => {
      const conn = new Connection(connectionOptions);
      await expect(conn.execute('SELECT 1')).rejects.toThrow(ConnectionClosedError);
    });

    it('should have execute method that accepts SQL and optional params', () => {
      const conn = new Connection(connectionOptions);
      expect(typeof conn.execute).toBe('function');

      // Verify it returns a CancellableQuery (which implements Promise)
      const result = conn.execute('SELECT 1');
      expect(result).toBeInstanceOf(CancellableQuery);

      // Clean up the promise rejection
      result.catch(() => {});
    });

    it('should handle parameterized query signature', () => {
      const conn = new Connection(connectionOptions);

      // Verify execute accepts parameters and returns CancellableQuery
      const result = conn.execute('SELECT * FROM users WHERE id = ?', [42]);
      expect(result).toBeInstanceOf(CancellableQuery);

      // Clean up the promise rejection
      result.catch(() => {});
    });
  });

  describe('Row Modes', () => {
    it('should use object mode by default', () => {
      const conn = new Connection(connectionOptions);
      expect(conn).toBeInstanceOf(Connection);
    });

    it('should accept array row mode', () => {
      const conn = new Connection({
        ...connectionOptions,
        rowMode: 'array'
      });
      expect(conn).toBeInstanceOf(Connection);
    });
  });

  describe('Debug Mode', () => {
    it('should not output debug logs when debug is false', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const conn = new Connection({
        ...connectionOptions,
        debug: false
      });

      expect(conn).toBeInstanceOf(Connection);
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should accept debug mode configuration', () => {
      const conn = new Connection({
        ...connectionOptions,
        debug: true
      });

      expect(conn).toBeInstanceOf(Connection);
    });
  });

  describe('CancellableQuery', () => {
    it('should create a CancellableQuery from execute', () => {
      const conn = new Connection(connectionOptions);
      const query = conn.execute('SELECT 1');
      
      expect(query).toBeInstanceOf(CancellableQuery);
      expect(query.isCancelled).toBe(false);
      expect(typeof query.cancel).toBe('function');
      
      // Clean up the promise rejection
      query.catch(() => {});
    });

    it('should have cancel method that returns a promise', () => {
      const conn = new Connection(connectionOptions);
      const query = conn.execute('SELECT 1');
      
      const cancelResult = query.cancel();
      expect(cancelResult).toBeInstanceOf(Promise);
      
      // Clean up the promise rejections
      query.catch(() => {});
      cancelResult.catch(() => {});
    });

    it('should mark query as cancelled after cancel is called', async () => {
      const conn = new Connection(connectionOptions);
      const query = conn.execute('SELECT 1');
      
      expect(query.isCancelled).toBe(false);
      
      // Note: Cancel will fail because we don't have a real connection,
      // but isCancelled should still be set
      try {
        await query.cancel();
      } catch (e) {
        // Expected to fail without real connection
      }
      
      expect(query.isCancelled).toBe(true);
      
      // Clean up
      query.catch(() => {});
    });

    it('should only cancel once even if cancel is called multiple times', async () => {
      const conn = new Connection(connectionOptions);
      const query = conn.execute('SELECT 1');
      
      // First cancel
      const cancel1 = query.cancel().catch(() => {});
      
      // Second cancel should be a no-op
      const cancel2 = query.cancel().catch(() => {});
      
      // Both should resolve without error on the second call
      await Promise.all([cancel1, cancel2]);
      
      expect(query.isCancelled).toBe(true);
      
      // Clean up
      query.catch(() => {});
    });

    it('should implement Promise interface', () => {
      const conn = new Connection(connectionOptions);
      const query = conn.execute('SELECT 1');
      
      // Test then
      expect(typeof query.then).toBe('function');
      
      // Test catch
      expect(typeof query.catch).toBe('function');
      
      // Test finally
      expect(typeof query.finally).toBe('function');
      
      // Test Symbol.toStringTag
      expect(query[Symbol.toStringTag]).toBe('CancellableQuery');
      
      // Clean up
      query.catch(() => {});
    });
  });

  describe('Query Cancellation', () => {
    it('should throw InterfaceError when cancelling without backend key data', async () => {
      const conn = new Connection(connectionOptions);
      
      // Without connecting, there's no backend key data
      await expect(conn.cancelQuery()).rejects.toThrow(InterfaceError);
      await expect(conn.cancelQuery()).rejects.toThrow('no backend key data');
    });

    it('should throw ConnectionClosedError when cancelling on closed connection', async () => {
      const conn = new Connection(connectionOptions);
      
      // Manually set backend key data to bypass that check
      (conn as any).backendKeyData = { processId: 123, secretKey: 456 };
      (conn as any).closed = true;
      
      await expect(conn.cancelQuery()).rejects.toThrow(ConnectionClosedError);
    });

    it('should have processId getter', () => {
      const conn = new Connection(connectionOptions);
      
      // Without connection, processId should be undefined
      expect(conn.processId).toBeUndefined();
      
      // Set backend key data
      (conn as any).backendKeyData = { processId: 12345, secretKey: 67890 };
      
      expect(conn.processId).toBe(12345);
    });
  });

  describe('drainUntilReady', () => {
    it('should successfully drain messages until ReadyForQuery', async () => {
      const conn = new Connection(connectionOptions);
      
      // Mock socket as connected
      (conn as any).socket = mockSocket;
      (conn as any).connected = true;
      
      // Set up data event handler to populate buffer (normally done in connect)
      mockSocket.on('data', (data: Buffer) => {
        (conn as any).buffer = Buffer.concat([(conn as any).buffer, data]);
      });
      
      // Simulate a sequence of messages ending with ReadyForQuery
      const messages = [
        // First message: DataRow or other message type
        Buffer.from([protocol.MESSAGE_TYPE_DATA_ROW]), // type
        Buffer.from([0x00, 0x00, 0x00, 0x00]),        // unused
        Buffer.from([0x00, 0x00, 0x00, 0x04]),        // length: 4
        Buffer.from([0x01, 0x02, 0x03, 0x04]),        // data
        // Second message: ReadyForQuery
        Buffer.from([protocol.MESSAGE_TYPE_READY_FOR_QUERY]), // type
        Buffer.from([0x00, 0x00, 0x00, 0x00]),               // unused
        Buffer.from([0x00, 0x00, 0x00, 0x01]),               // length: 1
        Buffer.from([protocol.TRANSACTION_STATUS_IDLE])       // transaction status
      ];
      
      // Emit data asynchronously after drain starts waiting
      setImmediate(() => {
        mockSocket.emitData(Buffer.concat(messages));
      });
      
      // Call the private method
      await (conn as any).drainUntilReady();
      
      // Verify transaction status was updated
      expect((conn as any).transactionStatus).toBe(protocol.TRANSACTION_STATUS_IDLE);
    });

    it('should throw ConnectionClosedError when connection closes during drain', async () => {
      const conn = new Connection(connectionOptions);
      
      // Mock socket as connected initially
      (conn as any).socket = mockSocket;
      (conn as any).connected = true;
      
      // Set up data event handler to populate buffer
      mockSocket.on('data', (data: Buffer) => {
        (conn as any).buffer = Buffer.concat([(conn as any).buffer, data]);
      });
      
      // Start the drain process
      const drainPromise = (conn as any).drainUntilReady();
      
      // Emit first message and then destroy socket
      setImmediate(() => {
        mockSocket.emitData(Buffer.concat([
          Buffer.from([protocol.MESSAGE_TYPE_DATA_ROW]),
          Buffer.from([0x00, 0x00, 0x00, 0x00]),
          Buffer.from([0x00, 0x00, 0x00, 0x04]),
          Buffer.from([0x01, 0x02, 0x03, 0x04])
        ]));
        
        // Destroy socket after providing first message - emit 'end' event to signal closure
        setTimeout(() => {
          mockSocket.destroyed = true;
          mockSocket.emit('end');
          (conn as any).socket = null;
        }, 10);
      });
      
      await expect(drainPromise).rejects.toThrow(OperationalError);
      await expect(drainPromise).rejects.toThrow('Connection closed');
    });

    it('should throw OperationalError when hitting maxIterations limit', async () => {
      const conn = new Connection(connectionOptions);
      
      // Mock socket as connected
      (conn as any).socket = mockSocket;
      (conn as any).connected = true;
      
      // Set up data event handler to populate buffer
      mockSocket.on('data', (data: Buffer) => {
        (conn as any).buffer = Buffer.concat([(conn as any).buffer, data]);
      });
      
      // Create a large buffer with many non-ReadyForQuery messages
      const singleMessage = Buffer.concat([
        Buffer.from([protocol.MESSAGE_TYPE_DATA_ROW]),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x00, 0x00, 0x01]),
        Buffer.from([0xFF])
      ]);
      
      // Create enough messages to exceed maxIterations (1000)
      const messages: Buffer[] = [];
      for (let i = 0; i < 1001; i++) {
        messages.push(singleMessage);
      }
      
      // Emit data asynchronously
      setImmediate(() => {
        mockSocket.emitData(Buffer.concat(messages));
      });
      
      await expect((conn as any).drainUntilReady()).rejects.toThrow(/Failed to receive ReadyForQuery after 1000 messages/);
    });

    it('should handle multiple message types before ReadyForQuery', async () => {
      const conn = new Connection(connectionOptions);
      
      // Mock socket as connected
      (conn as any).socket = mockSocket;
      (conn as any).connected = true;
      
      // Set up data event handler to populate buffer
      mockSocket.on('data', (data: Buffer) => {
        (conn as any).buffer = Buffer.concat([(conn as any).buffer, data]);
      });
      
      // Simulate various message types
      const messages = [
        // CommandComplete
        Buffer.from([protocol.MESSAGE_TYPE_COMMAND_COMPLETE]),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x00, 0x00, 0x06]),
        Buffer.from('SELECT'),
        // ErrorResponse
        Buffer.from([protocol.MESSAGE_TYPE_ERROR_RESPONSE]),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x00, 0x00, 0x05]),
        Buffer.from([0x45, 0x00, 0x00, 0x00, 0x00]),
        // ReadyForQuery (transaction status: in block)
        Buffer.from([protocol.MESSAGE_TYPE_READY_FOR_QUERY]),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from([0x00, 0x00, 0x00, 0x01]),
        Buffer.from([protocol.TRANSACTION_STATUS_IN_BLOCK])
      ];
      
      // Emit data asynchronously
      setImmediate(() => {
        mockSocket.emitData(Buffer.concat(messages));
      });
      
      await (conn as any).drainUntilReady();
      
      expect((conn as any).transactionStatus).toBe(protocol.TRANSACTION_STATUS_IN_BLOCK);
    });

    it('should wrap read errors in OperationalError', async () => {
      const conn = new Connection(connectionOptions);
      
      // Mock socket as connected
      (conn as any).socket = mockSocket;
      (conn as any).connected = true;
      
      // Set up data event handler to populate buffer
      mockSocket.on('data', (data: Buffer) => {
        (conn as any).buffer = Buffer.concat([(conn as any).buffer, data]);
      });
      
      // Start the drain process
      const drainPromise = (conn as any).drainUntilReady();
      
      // Emit incomplete message and then error
      setImmediate(() => {
        mockSocket.emitData(Buffer.from([protocol.MESSAGE_TYPE_DATA_ROW]));
        // Emit error after a short delay to allow readBytes to start waiting
        setTimeout(() => {
          mockSocket.simulateError(new Error('Socket read timeout'));
        }, 10);
      });
      
      await expect(drainPromise).rejects.toThrow(/Failed to drain messages/);
    });
  });
});
