/**
 * Integration tests for array row mode
 */

import { connect, Connection } from '../../src/index';
const config = require('../../test.config');

describe('Array Row Mode Integration Tests', () => {
  let conn: Connection;

  beforeEach(async () => {
    conn = await connect({
      ...config,
      rowMode: 'array'
    });
  });

  afterEach(async () => {
    if (conn) {
      await conn.close();
    }
  });

  test('should return rows as arrays', async () => {
    await conn.execute(
      `CREATE TEMP TABLE test_array_rows (
        id INTEGER,
        name VARCHAR(50),
        score NUMERIC(10,2)
      )`
    );

    await conn.execute(
      'INSERT INTO test_array_rows VALUES (?, ?, ?)',
      [1, 'Alice', 95.5]
    );

    const result = await conn.execute('SELECT * FROM test_array_rows');
    
    expect(Array.isArray(result.rows[0])).toBe(true);
    expect((result.rows[0] as any)[0]).toBe(1);
    expect((result.rows[0] as any)[1]).toBe('Alice');
    expect((result.rows[0] as any)[2]).toBe(95.5);
  });

  test('should handle duplicate column names', async () => {
    const result = await conn.execute('SELECT 1 as value, 2 as value, 3 as value');
    
    // Array mode preserves all values even with duplicate names
    expect(Array.isArray(result.rows[0])).toBe(true);
    expect(result.rows[0]).toEqual([1, 2, 3]);
  });

  test('should provide field names', async () => {
    await conn.execute(
      `CREATE TEMP TABLE test_fields (
        id INTEGER,
        name VARCHAR(50)
      )`
    );

    const result = await conn.execute('SELECT * FROM test_fields');
    
    expect(result.fields).toHaveLength(2);
    expect(result.fields![0].name).toBe('id');
    expect(result.fields![1].name).toBe('name');
  });

  test('should handle calculated columns with duplicate names', async () => {
    await conn.execute(
      `CREATE TEMP TABLE test_calc (
        id INTEGER,
        score NUMERIC(10,2)
      )`
    );

    await conn.execute('INSERT INTO test_calc VALUES (?, ?)', [1, 100]);

    const result = await conn.execute(`
      SELECT 
        id,
        score,
        score * 1.1 as score,
        score * 0.9 as score
      FROM test_calc
    `);
    
    expect(result.fields).toHaveLength(4);
    expect(Array.isArray(result.rows[0])).toBe(true);
    expect((result.rows[0] as any)).toHaveLength(4);
    
    // All four values are accessible by position
    expect((result.rows[0] as any)[0]).toBe(1);     // id
    expect((result.rows[0] as any)[1]).toBe(100);   // original score
    expect((result.rows[0] as any)[2]).toBe(110);   // score * 1.1
    expect((result.rows[0] as any)[3]).toBe(90);    // score * 0.9
  });
});

describe('Object Row Mode Integration Tests', () => {
  let conn: Connection;

  beforeEach(async () => {
    conn = await connect(config); // Default is 'object' mode
  });

  afterEach(async () => {
    if (conn) {
      await conn.close();
    }
  });

  test('should return rows as objects', async () => {
    await conn.execute(
      `CREATE TEMP TABLE test_object_rows (
        id INTEGER,
        name VARCHAR(50)
      )`
    );

    await conn.execute('INSERT INTO test_object_rows VALUES (?, ?)', [1, 'Alice']);

    const result = await conn.execute('SELECT * FROM test_object_rows');
    
    expect(typeof result.rows[0]).toBe('object');
    expect((result.rows[0] as any).id).toBe(1);
    expect((result.rows[0] as any).name).toBe('Alice');
  });

  test('should handle duplicate column names (last wins)', async () => {
    const result = await conn.execute('SELECT 1 as value, 2 as value');
    
    // Object mode loses first value when names duplicate
    expect((result.rows[0] as any).value).toBe(2);
  });
});
