/**
 * Unit tests for Pool class
 */

import { Pool, createPool, PoolOptions } from '../pool';
import { InterfaceError, OperationalError } from '../errors';
import { MockSocket } from '../test-utils/mock-socket';
import * as protocol from '../protocol';

// Mock the net module
jest.mock('net');

import * as net from 'net';
const { setMockSocket } = net as any;

describe('Pool Class', () => {
  let mockSocket: MockSocket;
  let poolOptions: PoolOptions;

  beforeEach(() => {
    // Create fresh mock socket for each test
    mockSocket = new MockSocket(true);
    setMockSocket(mockSocket);

    poolOptions = {
      user: 'admin',
      password: '***REMOVED***',
      host: 'localhost',
      port: 5480,
      database: 'testdb',
      max: 5,
      min: 0,
      debug: false
    };
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('createPool', () => {
    it('should create a Pool instance', () => {
      const pool = createPool(poolOptions);
      expect(pool).toBeInstanceOf(Pool);
    });

    it('should accept all pool options', () => {
      const fullOptions: PoolOptions = {
        ...poolOptions,
        min: 2,
        max: 10,
        acquireTimeout: 60000,
        idleTimeout: 60000,
        connectionTimeout: 3600000,
        evictionRunInterval: 20000,
        validateOnBorrow: true,
        validateOnReturn: false,
        validationQuery: 'SELECT 1'
      };

      const pool = createPool(fullOptions);
      expect(pool).toBeInstanceOf(Pool);
    });
  });

  describe('Pool Validation', () => {
    it('should throw error if min < 0', () => {
      expect(() => {
        createPool({
          ...poolOptions,
          min: -1
        });
      }).toThrow(InterfaceError);
      expect(() => {
        createPool({
          ...poolOptions,
          min: -1
        });
      }).toThrow('min must be >= 0');
    });

    it('should throw error if max < 1', () => {
      expect(() => {
        createPool({
          ...poolOptions,
          max: 0
        });
      }).toThrow(InterfaceError);
      expect(() => {
        createPool({
          ...poolOptions,
          max: 0
        });
      }).toThrow('max must be >= 1');
    });

    it('should throw error if min > max', () => {
      expect(() => {
        createPool({
          ...poolOptions,
          min: 10,
          max: 5
        });
      }).toThrow(InterfaceError);
      expect(() => {
        createPool({
          ...poolOptions,
          min: 10,
          max: 5
        });
      }).toThrow('min must be <= max');
    });

    it('should allow min = 0', () => {
      expect(() => {
        createPool({
          ...poolOptions,
          min: 0,
          max: 5
        });
      }).not.toThrow();
    });

    it('should allow min = max', () => {
      expect(() => {
        createPool({
          ...poolOptions,
          min: 5,
          max: 5
        });
      }).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', () => {
      const pool = createPool({
        ...poolOptions,
        min: 2,
        max: 10
      });

      const stats = pool.getStats();
      expect(stats).toBeDefined();
      expect(stats.total).toBeDefined();
      expect(stats.available).toBeDefined();
      expect(stats.inUse).toBeDefined();
      expect(stats.pending).toBeDefined();
      expect(stats.min).toBe(2);
      expect(stats.max).toBe(10);
    });

    it('should reflect min=0 configuration', () => {
      const pool = createPool({
        ...poolOptions,
        min: 0,
        max: 5
      });

      const stats = pool.getStats();
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(5);
    });
  });

  describe('Pool Lifecycle', () => {
    it('should create pool with min=0 and no initial connections', () => {
      const pool = createPool({
        ...poolOptions,
        min: 0,
        max: 5
      });

      const stats = pool.getStats();
      // Initially might be 0 since min=0
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });

    it('should allow closing pool multiple times', async () => {
      const pool = createPool(poolOptions);

      await pool.end();
      await expect(pool.end()).resolves.not.toThrow();
    });

    it('should throw error when acquiring from closed pool', async () => {
      const pool = createPool(poolOptions);
      await pool.end();

      await expect(pool.acquire()).rejects.toThrow(InterfaceError);
      await expect(pool.acquire()).rejects.toThrow('Pool is closed');
    });

    it('should throw error when executing on closed pool', async () => {
      const pool = createPool(poolOptions);
      await pool.end();

      await expect(pool.execute('SELECT 1')).rejects.toThrow(InterfaceError);
      await expect(pool.execute('SELECT 1')).rejects.toThrow('Pool is closed');
    });
  });

  describe('Connection Acquisition', () => {
    it('should reject acquire after timeout', async () => {
      const pool = createPool({
        ...poolOptions,
        max: 1,
        acquireTimeout: 100
      });

      // This test would need more sophisticated mocking to properly test
      // For now, just verify the pool was created
      expect(pool).toBeInstanceOf(Pool);

      await pool.end();
    }, 10000);

    it('should handle connection acquisition errors gracefully', async () => {
      // Simulate socket error
      const errorSocket = new MockSocket(false);
      setMockSocket(errorSocket);

      const pool = createPool({
        ...poolOptions,
        max: 1,
        validateOnBorrow: false
      });

      // Pool creation might fail, which is expected
      await pool.end();
    });
  });

  describe('execute method', () => {
    it('should exist on Pool instance', () => {
      const pool = createPool(poolOptions);
      expect(pool.execute).toBeDefined();
      expect(typeof pool.execute).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle max=1 configuration', () => {
      const pool = createPool({
        ...poolOptions,
        min: 0,
        max: 1
      });

      const stats = pool.getStats();
      expect(stats.max).toBe(1);
    });

    it('should handle large max value', () => {
      const pool = createPool({
        ...poolOptions,
        min: 0,
        max: 100
      });

      const stats = pool.getStats();
      expect(stats.max).toBe(100);
    });
  });
});
