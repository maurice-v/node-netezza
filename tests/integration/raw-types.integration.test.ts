/**
 * Integration tests for raw type handling
 */

import { connect, Connection } from '../../src/index';
const config = require('../../test.config');

describe('Raw Types Integration Tests', () => {
  test('should handle BIGINT without raw types (loses precision)', async () => {
    const conn = await connect(config);

    try {
      const result = await conn.execute('SELECT 9223372036854775807 as max_bigint');
      
      // JavaScript loses precision on large numbers - becomes 9223372036854776000
      const value = (result.rows[0] as any).max_bigint;
      expect(typeof value).toBe('number');
      // The value will be different due to JS number precision limits
      expect(value).not.toBe('9223372036854775807'); // Not the exact string
    } finally {
      await conn.close();
    }
  });

  test('should handle BIGINT with raw types (preserves precision)', async () => {
    const conn = await connect({
      ...config,
      rawTypes: {
        bigint: true
      }
    });

    try {
      const result = await conn.execute('SELECT 9223372036854775807 as max_bigint');
      
      // Raw type returns string preserving exact value
      expect((result.rows[0] as any).max_bigint).toBe('9223372036854775807');
      expect(typeof (result.rows[0] as any).max_bigint).toBe('string');
    } finally {
      await conn.close();
    }
  });

  test('should handle TIMESTAMP with raw types', async () => {
    const conn = await connect({
      ...config,
      rawTypes: {
        timestamp: true
      }
    });

    try {
      const result = await conn.execute(
        "SELECT TIMESTAMP '2024-11-16 10:30:00' as created_at"
      );
      
      // Raw timestamp is a string
      expect(typeof (result.rows[0] as any).created_at).toBe('string');
      expect((result.rows[0] as any).created_at).toBe('2024-11-16 10:30:00');
    } finally {
      await conn.close();
    }
  });

  test('should handle DATE with raw types', async () => {
    const conn = await connect({
      ...config,
      rawTypes: {
        date: true
      }
    });

    try {
      const result = await conn.execute("SELECT DATE '2024-11-16' as event_date");
      
      // Raw date is a string
      expect(typeof (result.rows[0] as any).event_date).toBe('string');
      expect((result.rows[0] as any).event_date).toBe('2024-11-16');
    } finally {
      await conn.close();
    }
  });

  test('should handle NUMERIC with raw types (preserves precision)', async () => {
    const conn = await connect({
      ...config,
      rawTypes: {
        numeric: true
      }
    });

    try {
      const result = await conn.execute('SELECT 123.456789012345 as precise_number');
      
      // Raw numeric is a string preserving all digits
      expect(typeof (result.rows[0] as any).precise_number).toBe('string');
      expect((result.rows[0] as any).precise_number).toBe('123.456789012345');
    } finally {
      await conn.close();
    }
  });

  test('should handle all raw types together', async () => {
    const conn = await connect({
      ...config,
      rawTypes: {
        bigint: true,
        timestamp: true,
        date: true,
        numeric: true
      }
    });

    try {
      const result = await conn.execute(`
        SELECT
          9223372036854775807 as max_bigint,
          TIMESTAMP '2024-11-16 10:30:00' as created_at,
          DATE '2024-11-16' as event_date,
          123.456789012345 as precise_number
      `);
      
      const row = result.rows[0] as any;
      
      expect(typeof row.max_bigint).toBe('string');
      expect(row.max_bigint).toBe('9223372036854775807');
      
      expect(typeof row.created_at).toBe('string');
      expect(row.created_at).toBe('2024-11-16 10:30:00');
      
      expect(typeof row.event_date).toBe('string');
      expect(row.event_date).toBe('2024-11-16');
      
      expect(typeof row.precise_number).toBe('string');
      expect(row.precise_number).toBe('123.456789012345');
    } finally {
      await conn.close();
    }
  });
});
