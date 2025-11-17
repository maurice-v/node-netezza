/**
 * Connection pooling with transactions example
 */

const { createPool } = require('node-netezza');

async function transactionExample() {
  const pool = createPool({
    // Connection options
    user: 'admin',
    password: 'password',
    host: 'localhost',
    port: 5480,
    database: 'db1',
    securityLevel: 1,
    // Pool-specific options
    max: 10
  });

  try {
    // Acquire a connection from the pool for a transaction
    const conn = await pool.acquire();

    try {
      // Start transaction
      await conn.execute('BEGIN');

      // Perform multiple operations
      await conn.execute(
        'INSERT INTO orders (id, customer_id, amount) VALUES (?, ?, ?)',
        [101, 1, 250.00]
      );

      await conn.execute(
        'UPDATE customers SET total_spent = total_spent + ? WHERE id = ?',
        [250.00, 1]
      );

      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)',
        [101, 50, 2]
      );

      await conn.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [2, 50]
      );

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
