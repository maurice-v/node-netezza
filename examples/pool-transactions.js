/**
 * Connection pooling with transactions example
 */

const { createPool } = require('../dist/index');
const config = require('./config');

async function transactionExample() {
  const pool = createPool({
    ...config,
    // Pool-specific options
    max: 10
  });

  try {
    // Acquire a connection from the pool for a transaction
    const conn = await pool.acquire();

    try {
      // Start transaction
      await conn.execute('BEGIN');
      console.log('Transaction started');

      // Create a temp table for demonstration
      await conn.execute(
        `CREATE TEMP TABLE temp_orders (
          id INTEGER,
          customer_id INTEGER,
          amount NUMERIC(10,2)
        )`
      );
      console.log('Created temp table');

      // Perform multiple operations
      await conn.execute(
        'INSERT INTO temp_orders (id, customer_id, amount) VALUES (?, ?, ?)',
        [101, 1, 250.00]
      );
      console.log('Inserted order 101');

      await conn.execute(
        'INSERT INTO temp_orders (id, customer_id, amount) VALUES (?, ?, ?)',
        [102, 1, 150.00]
      );
      console.log('Inserted order 102');

      // Query the data
      const result = await conn.execute('SELECT * FROM temp_orders');
      console.log('Orders in transaction:', result.rows);

      // Commit transaction
      await conn.execute('COMMIT');
      console.log('Transaction completed successfully');

    } catch (error) {
      // Rollback on error
      console.error('Transaction error:', error.message);
      await conn.execute('ROLLBACK');
      throw error;

    } finally {
      // Always release connection back to pool
      await pool.release(conn);
      console.log('Connection released back to pool');
    }

  } finally {
    // Close pool
    await pool.end();
    console.log('Pool closed');
  }
}

transactionExample().catch(console.error);
