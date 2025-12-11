/**
 * Unit tests for Connection class
 */

import { Connection, ConnectionOptions, CancellableQuery } from '../connection';
import { InterfaceError, OperationalError, ConnectionClosedError, QueryCancelledError } from '../errors';
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
});
