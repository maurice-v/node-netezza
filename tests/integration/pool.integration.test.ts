/**
 * Integration tests for connection pooling
 */

import { createPool, Pool } from '../../src/index';
const config = require('../../test.config');

describe('Pool Integration Tests', () => {
  let pool: Pool;

  beforeEach(() => {
    pool = createPool({
      ...config,
      max: 10,
      min: 2
    });
  });

  afterEach(async () => {
    if (pool) {
      await pool.end();
    }
  });

  test('should create pool and execute queries', async () => {
    const result = await pool.execute('SELECT 1 as test_value');
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as any).test_value).toBe(1);
  });

  test('should execute parameterized queries', async () => {
    const result = await pool.execute('SELECT ? as param_test', ['Hello from pool!']);
    expect((result.rows[0] as any).param_test).toBe('Hello from pool!');
  });

  test('should handle multiple concurrent queries', async () => {
    const queries = [
      pool.execute('SELECT 1 as value'),
      pool.execute('SELECT 2 as value'),
      pool.execute('SELECT 3 as value')
    ];

    const results = await Promise.all(queries);
    
    expect(results).toHaveLength(3);
    expect((results[0].rows[0] as any).value).toBe(1);
    expect((results[1].rows[0] as any).value).toBe(2);
    expect((results[2].rows[0] as any).value).toBe(3);
  });

  test('should return pool statistics', async () => {
    // Execute a query to create connections
    await pool.execute('SELECT 1');

    const stats = pool.getStats();
    
    expect(stats.total).toBeGreaterThanOrEqual(0);
    expect(stats.available).toBeGreaterThanOrEqual(0);
    expect(stats.inUse).toBeGreaterThanOrEqual(0);
    expect(stats.pending).toBe(0);
    expect(stats.max).toBe(10);
    expect(stats.min).toBe(2);
  });

  test('should support transactions with acquired connection', async () => {
    const conn = await pool.acquire();

    try {
      // Start transaction
      await conn.execute('BEGIN');

      // Create temp table
      await conn.execute(
        `CREATE TEMP TABLE temp_orders (
          id INTEGER,
          customer_id INTEGER,
          amount NUMERIC(10,2)
        )`
      );

      // Insert data
      await conn.execute(
        'INSERT INTO temp_orders VALUES (?, ?, ?)',
        [101, 1, 250.00]
      );
      await conn.execute(
        'INSERT INTO temp_orders VALUES (?, ?, ?)',
        [102, 1, 150.00]
      );

      // Query
      const result = await conn.execute('SELECT * FROM temp_orders');
      expect(result.rowCount).toBe(2);

      // Commit
      await conn.execute('COMMIT');
    } finally {
      await pool.release(conn);
    }
  });

  test('should handle transaction rollback', async () => {
    const conn = await pool.acquire();

    try {
      await conn.execute('BEGIN');
      
      await conn.execute(
        `CREATE TEMP TABLE temp_test (id INTEGER)`
      );
      
      await conn.execute('INSERT INTO temp_test VALUES (?)', [1]);
      
      // Rollback
      await conn.execute('ROLLBACK');
      
      // Table should not exist after rollback
      await expect(
        conn.execute('SELECT * FROM temp_test')
      ).rejects.toThrow();
      
    } finally {
      await pool.release(conn);
    }
  });
});
