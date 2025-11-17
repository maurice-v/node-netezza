/**
 * Basic connection pooling example
 */

const { createPool } = require('node-netezza');

async function basicPoolExample() {
  // Create a connection pool
  const pool = createPool({
    // Connection options
    user: 'admin',
    password: 'password',
    host: 'localhost',
    port: 5480,
    database: 'db1',
    securityLevel: 1,
    // Pool-specific options
    max: 10,       // Maximum 10 connections
    min: 2         // Maintain at least 2 connections
  });

  try {
    // Execute queries directly on the pool
    // The pool automatically acquires and releases connections
    const customers = await pool.execute('SELECT * FROM customers LIMIT 10');
    console.log('Customers:', customers.rows);

    const orders = await pool.execute(
      'SELECT * FROM orders WHERE customer_id = ?',
      [1]
    );
    console.log('Orders:', orders.rows);

    // Check pool statistics
    const stats = pool.getStats();
    console.log('Pool Stats:', {
      total: stats.total,
      available: stats.available,
      inUse: stats.inUse,
      pending: stats.pending
    });

  } finally {
    // Always close the pool when done
    await pool.end();
    console.log('Pool closed');
  }
}

basicPoolExample().catch(console.error);
