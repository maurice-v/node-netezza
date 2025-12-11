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
    
    console.log('Testing pool with multiple queries (one will fail)...\n');
    
    // Query 1: Success
    const result1 = await pool.execute('SELECT 1 as test_value');
    console.log('✓ Query 1 succeeded:', result1.rows);

    // Query 2: This will fail with invalid SQL
    try {
      await pool.execute('SELECT * FROM non_existent_table_xyz');
      console.log('✗ Query 2 succeeded (unexpected)');
    } catch (err) {
      console.log('✓ Query 2 failed as expected:', err.message);
    }

    // Query 3: Success - pool should still work after error
    const result3 = await pool.execute('SELECT CURRENT_TIMESTAMP as now');
    console.log('✓ Query 3 succeeded:', result3.rows);

    // Query 4: Success with parameters
    const result4 = await pool.execute('SELECT ? as param_test', ['Pool is healthy!']);
    console.log('✓ Query 4 succeeded:', result4.rows);

    // Check pool statistics - should show healthy pool
    const stats = pool.getStats();
    console.log('\n✓ Pool Stats (healthy):', {
      total: stats.total,
      available: stats.available,
      inUse: stats.inUse,
      pending: stats.pending
    });

    // Final health check
    const healthCheck = await pool.execute('SELECT 999 as health_check');
    console.log('✓ Pool health check passed:', healthCheck.rows);

  } finally {
    // Always close the pool when done
    await pool.end();
    console.log('Pool closed');
  }
}

basicPoolExample().catch(console.error);
