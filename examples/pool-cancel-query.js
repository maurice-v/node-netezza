/**
 * Example: Query cancellation with connection pooling
 * 
 * This example demonstrates how to cancel queries when using a connection pool.
 * It shows both:
 * 1. Cancelling a query on an acquired connection
 * 2. Validating the connection can be reused after cancellation
 */

const { createPool } = require('../dist');
const config = require('./config');

async function main() {
  // Create a connection pool
  const pool = createPool({
    ...config,
    max: 5,
    min: 1,
    debug: false
  });

  console.log('Pool created');
  console.log('Initial pool stats:', formatStats(pool.getStats()));

  try {
    // Example 1: Cancel query on acquired connection, then reuse it
    console.log('\n--- Example 1: Cancel and reuse connection ---');
    await cancelAndReuseConnection(pool);

    // Example 2: Multiple concurrent queries with selective cancellation
    console.log('\n--- Example 2: Concurrent queries with cancellation ---');
    await concurrentQueriesWithCancellation(pool);

    // Example 3: Timeout pattern with pool
    console.log('\n--- Example 3: Query timeout pattern ---');
    await queryTimeoutPattern(pool);

    console.log('\nFinal pool stats:', formatStats(pool.getStats()));

  } finally {
    await pool.end();
    console.log('\nPool closed');
  }
}

/**
 * Example 1: Cancel a query and verify the connection can be reused
 */
async function cancelAndReuseConnection(pool) {
  // Acquire a connection from the pool
  const conn = await pool.acquire();
  console.log('Acquired connection, PID:', conn.processId);
  console.log('Pool stats after acquire:', formatStats(pool.getStats()));

  // Start a long-running cancellable query
  const query = conn.execute(`
    SELECT COUNT(*) 
    FROM _v_relation_column a, _v_relation_column b 
    WHERE a.name LIKE '%' || b.name || '%'
  `);

  // Cancel after 1 second
  setTimeout(async () => {
    console.log('Cancelling query...');
    await query.cancel();
  }, 1000);

  try {
    console.log('Executing long query...');
    const result = await query;
    console.log('Query completed (unexpected):', result.rowCount, 'rows');
  } catch (error) {
    if (error.code === 'QUERY_CANCELLED') {
      console.log('✓ Query cancelled successfully');
    } else {
      console.log('Query error:', error.message);
    }
  }

  // Verify connection is still usable
  console.log('Verifying connection is still usable...');
  const testResult = await conn.execute('SELECT 123 as verification');
  console.log('✓ Verification query result:', testResult.rows[0]);

  // Release connection back to pool
  await pool.release(conn);
  console.log('Connection released back to pool');
  console.log('Pool stats after release:', formatStats(pool.getStats()));
}

/**
 * Example 2: Run multiple concurrent queries and cancel some
 */
async function concurrentQueriesWithCancellation(pool) {
  // Acquire multiple connections
  const conn1 = await pool.acquire();
  const conn2 = await pool.acquire();
  const conn3 = await pool.acquire();

  console.log('Acquired 3 connections');
  console.log('Pool stats:', formatStats(pool.getStats()));

  // Start queries on each connection
  const query1 = conn1.execute(`
    SELECT COUNT(*) FROM _v_relation_column a, _v_relation_column b 
    WHERE a.name LIKE '%' || b.name || '%'
  `);
  
  const query2 = conn2.execute('SELECT 1 as fast_query');
  
  const query3 = conn3.execute(`
    SELECT COUNT(*) FROM _v_relation_column a, _v_relation_column b 
    WHERE a.name LIKE '%' || b.name || '%'
  `);

  // Cancel query1 and query3 after 500ms, let query2 complete
  setTimeout(async () => {
    console.log('Cancelling query 1 and 3...');
    await Promise.all([query1.cancel(), query3.cancel()]);
  }, 500);

  // Wait for all queries to complete or be cancelled
  const results = await Promise.allSettled([query1, query2, query3]);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Query ${index + 1}: completed with ${result.value.rows.length} rows`);
    } else {
      const reason = result.reason.code === 'QUERY_CANCELLED' ? 'cancelled' : result.reason.message;
      console.log(`Query ${index + 1}: ${reason}`);
    }
  });

  // Release all connections
  await Promise.all([pool.release(conn1), pool.release(conn2), pool.release(conn3)]);
  console.log('All connections released');
}

/**
 * Example 3: Implement a query timeout pattern with the pool
 */
async function queryTimeoutPattern(pool) {
  /**
   * Execute a query with a timeout using the pool
   */
  async function executeWithTimeout(sql, timeoutMs) {
    const conn = await pool.acquire();
    const query = conn.execute(sql);
    
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          await query.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        reject(new Error(`Query timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([query, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    } finally {
      await pool.release(conn);
    }
  }

  // Test 1: Fast query that completes within timeout
  try {
    console.log('Running fast query with 5s timeout...');
    const result = await executeWithTimeout('SELECT 1 as value', 5000);
    console.log('✓ Fast query completed:', result.rows[0]);
  } catch (error) {
    console.log('Fast query failed:', error.message);
  }

  // Test 2: Slow query that exceeds timeout
  try {
    console.log('Running slow query with 1s timeout...');
    const result = await executeWithTimeout(`
      SELECT COUNT(*) FROM _v_relation_column a, _v_relation_column b 
      WHERE a.name LIKE '%' || b.name || '%'
    `, 1000);
    console.log('Slow query completed (unexpected):', result.rows);
  } catch (error) {
    if (error.message.includes('timeout') || error.code === 'QUERY_CANCELLED') {
      console.log('✓ Slow query timed out as expected');
    } else {
      console.log('Slow query failed:', error.message);
    }
  }

  // Verify pool is still healthy
  const healthCheck = await pool.execute('SELECT 999 as health_check');
  console.log('✓ Pool health check:', healthCheck.rows[0]);
}

/**
 * Format pool stats for display
 */
function formatStats(stats) {
  return `total=${stats.total}, available=${stats.available}, inUse=${stats.inUse}, pending=${stats.pending}`;
}

// Run the examples
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
