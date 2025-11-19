/**
 * Basic connection pooling example
 */

const { createPool } = require('../dist/index');
const config = require('./config');

async function basicPoolExample() {
  // Create a connection pool
  const pool = createPool({
    ...config,
    // Pool-specific options
    max: 10,       // Maximum 10 connections
    min: 2         // Maintain at least 2 connections
  });

  try {
    // Execute queries directly on the pool
    // The pool automatically acquires and releases connections
    
    // Simple test queries
    console.log('Testing pool with simple queries...');
    const result1 = await pool.execute('SELECT 1 as test_value');
    console.log('Query 1:', result1.rows);

    const result2 = await pool.execute('SELECT CURRENT_TIMESTAMP as now');
    console.log('Query 2:', result2.rows);

    const result3 = await pool.execute('SELECT ? as param_test', ['Hello from pool!']);
    console.log('Query 3:', result3.rows);

    // Check pool statistics
    const stats = pool.getStats();
    console.log('\nPool Stats:', {
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
