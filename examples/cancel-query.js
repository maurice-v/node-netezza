/**
 * Example: Cancelling a running query
 * 
 * This example demonstrates how to cancel a long-running query.
 * The execute() method always returns a cancellable query by default.
 */

const { connect } = require('../dist');
const config = require('./config');

async function main() {
  const conn = await connect({
    ...config,
    debug: false
  });

  console.log('Connected to Netezza');
  console.log('Backend Process ID:', conn.processId);

  // Example 1: Cancel a query after a timeout
  console.log('\n--- Example 1: Cancel query after timeout ---');
  await cancelWithTimeout(conn);

  // Example 2: Cancel a query on user request (simulated)
  console.log('\n--- Example 2: Cancel query on demand ---');
  await cancelOnDemand(conn);

  // Example 3: Using with AbortController pattern
  console.log('\n--- Example 3: AbortController-style pattern ---');
  await cancelWithAbortPattern(conn);

  await conn.close();
  console.log('\nConnection closed');
}

/**
 * Example 1: Cancel a query after a specific timeout
 */
async function cancelWithTimeout(conn) {
  // Start a potentially long-running query
  const query = conn.execute(`
    SELECT COUNT(*) 
    FROM _v_relation_column a, _v_relation_column b 
    WHERE a.name LIKE '%' || b.name || '%'
  `);

  // Set up a timeout to cancel after 2 seconds
  const timeoutId = setTimeout(async () => {
    console.log('Query timeout reached, cancelling...');
    await query.cancel();
  }, 2000);

  try {
    console.log('Executing long query (will be cancelled after 2s)...');
    const result = await query;
    clearTimeout(timeoutId);
    console.log('Query completed:', result.rowCount, 'rows');
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.code === 'QUERY_CANCELLED') {
      console.log('✓ Query was successfully cancelled');
    } else {
      console.log('Query error:', error.message);
    }
  }
}

/**
 * Example 2: Cancel a query on demand (e.g., user clicks cancel button)
 */
async function cancelOnDemand(conn) {
  // Use a cross join with _v_vector_idx to create a slow query
  const query = conn.execute(`
    SELECT COUNT(*) 
    FROM _v_vector_idx a, _v_vector_idx b, _v_vector_idx c
  `);

  // Simulate user cancellation after 500ms (faster than Example 1's 2s)
  const cancelPromise = new Promise(resolve => {
    setTimeout(async () => {
      if (!query.isCancelled) {
        console.log('User requested cancellation...');
        await query.cancel();
      }
      resolve();
    }, 500);
  });

  try {
    console.log('Executing query (user will cancel in 500ms)...');
    const result = await query;
    console.log('Query completed:', result.rowCount, 'rows');
  } catch (error) {
    if (error.code === 'QUERY_CANCELLED') {
      console.log('✓ Query cancelled by user');
    } else {
      console.log('Query error:', error.message);
    }
  }

  await cancelPromise;
}

/**
 * Example 3: AbortController-style pattern for multiple queries
 */
async function cancelWithAbortPattern(conn) {
  // Create a simple abort controller
  const controller = {
    aborted: false,
    queries: [],
    timeoutId: null,
    abort: async function() {
      this.aborted = true;
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      for (const query of this.queries) {
        if (!query.isCancelled) {
          try {
            await query.cancel();
          } catch (e) {
            // Ignore errors if connection is already closed
          }
        }
      }
    },
    track: function(query) {
      this.queries.push(query);
      return query;
    },
    clear: function() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
    }
  };

  // Start multiple queries
  const query1 = controller.track(
    conn.execute('SELECT 1')
  );
  
  // Abort all queries after 50ms
  controller.timeoutId = setTimeout(() => {
    console.log('Aborting all queries...');
    controller.abort();
  }, 50);

  try {
    console.log('Executing tracked query...');
    const result = await query1;
    controller.clear(); // Clear timeout if query completes
    console.log('Query 1 completed:', result.rows);
  } catch (error) {
    controller.clear();
    if (error.code === 'QUERY_CANCELLED') {
      console.log('✓ Query 1 was aborted');
    } else {
      console.log('Query 1 error:', error.message);
    }
  }
}

// Run the examples
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
