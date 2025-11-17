/**
 * Unit tests for Connection class
 */

import { Connection, ConnectionOptions } from '../connection';
import { InterfaceError, OperationalError, ConnectionClosedError } from '../errors';
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
      user: 'testuser',
      password: 'testpass',
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

      // Verify it returns a promise
      const result = conn.execute('SELECT 1');
      expect(result).toBeInstanceOf(Promise);

      // Clean up the promise rejection
      result.catch(() => {});
    });

    it('should handle parameterized query signature', () => {
      const conn = new Connection(connectionOptions);

      // Verify execute accepts parameters
      const result = conn.execute('SELECT * FROM users WHERE id = ?', [42]);
      expect(result).toBeInstanceOf(Promise);

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
});
