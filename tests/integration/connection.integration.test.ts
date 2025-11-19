/**
 * Integration tests for basic connection and CRUD operations
 */

import { connect, Connection } from '../../src/index';
const config = require('../../test.config');

describe('Connection Integration Tests', () => {
  let conn: Connection;

  beforeEach(async () => {
    conn = await connect(config);
  });

  afterEach(async () => {
    if (conn) {
      await conn.close();
    }
  });

  test('should connect successfully', async () => {
    expect(conn).toBeDefined();
  });

  test('should execute simple query', async () => {
    const result = await conn.execute('SELECT 1 as test');
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as any).test).toBe(1);
  });

  test('should handle parameterized queries', async () => {
    const result = await conn.execute('SELECT ? as value', [42]);
    expect((result.rows[0] as any).value).toBe(42);
  });

  test('should create, insert, query, update, and drop table', async () => {
    // Create table
    await conn.execute(
      `CREATE TEMP TABLE test_customers (
        id INTEGER,
        name VARCHAR(50),
        email VARCHAR(100),
        age INTEGER
      )`
    );

    // Insert data
    await conn.execute(
      'INSERT INTO test_customers VALUES (?, ?, ?, ?)',
      [1, 'John Doe', 'john@example.com', 30]
    );
    await conn.execute(
      'INSERT INTO test_customers VALUES (?, ?, ?, ?)',
      [2, 'Jane Smith', 'jane@example.com', 25]
    );

    // Query all
    const allResults = await conn.execute('SELECT * FROM test_customers ORDER BY id');
    expect(allResults.rowCount).toBe(2);
    expect((allResults.rows[0] as any).name).toBe('John Doe');
    expect((allResults.rows[1] as any).name).toBe('Jane Smith');

    // Query with parameter
    const singleResult = await conn.execute(
      'SELECT * FROM test_customers WHERE id = ?',
      [2]
    );
    expect((singleResult.rows[0] as any).name).toBe('Jane Smith');
    expect((singleResult.rows[0] as any).age).toBe(25);

    // Update
    await conn.execute(
      'UPDATE test_customers SET age = ? WHERE id = ?',
      [26, 2]
    );

    // Verify update
    const updatedResult = await conn.execute(
      'SELECT * FROM test_customers WHERE id = ?',
      [2]
    );
    expect((updatedResult.rows[0] as any).age).toBe(26);

    // Delete
    await conn.execute('DELETE FROM test_customers WHERE id = ?', [1]);

    // Count
    const countResult = await conn.execute('SELECT COUNT(*) as count FROM test_customers');
    expect((countResult.rows[0] as any).count).toBe(1);

    // Temp tables are automatically dropped at session end
  });

  test('should get current timestamp', async () => {
    const result = await conn.execute('SELECT CURRENT_TIMESTAMP as now');
    expect((result.rows[0] as any).now).toBeDefined();
  });
});
