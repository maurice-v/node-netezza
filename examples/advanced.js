const { connect } = require('../dist/index');
const config = require('./config');

/**
 * Example using async/await with connection pooling simulation
 */
class ConnectionPool {
  constructor(options, poolSize = 5) {
    this.options = options;
    this.poolSize = poolSize;
    this.connections = [];
    this.available = [];
    this.waiting = [];
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const conn = await connect(this.options);
      this.connections.push(conn);
      this.available.push(conn);
    }
  }

  async acquire() {
    if (this.available.length > 0) {
      return this.available.pop();
    }
    
    // Wait for a connection to become available
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(conn) {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      resolve(conn);
    } else {
      this.available.push(conn);
    }
  }

  async closeAll() {
    for (const conn of this.connections) {
      await conn.close();
    }
    this.connections = [];
    this.available = [];
  }
}

async function advancedExample() {
  console.log('Creating connection pool...');
  
  const pool = new ConnectionPool(config, 3); // Pool of 3 connections

  try {
    await pool.initialize();
    console.log('Connection pool initialized');

    // Use transactions
    console.log('\nExecuting transaction...');
    const conn = await pool.acquire();
    
    try {
      // Start transaction
      await conn.execute('BEGIN');
      
      // Create temp table
      await conn.execute(
        `CREATE TEMP TABLE order_items (
          order_id INTEGER,
          item_name VARCHAR(100),
          quantity INTEGER,
          price NUMERIC(10,2)
        )`
      );
      
      // Insert multiple items
      await conn.execute(
        'INSERT INTO order_items VALUES (?, ?, ?, ?)',
        [1, 'Widget A', 5, 19.99]
      );
      await conn.execute(
        'INSERT INTO order_items VALUES (?, ?, ?, ?)',
        [1, 'Widget B', 3, 29.99]
      );
      await conn.execute(
        'INSERT INTO order_items VALUES (?, ?, ?, ?)',
        [2, 'Widget C', 2, 39.99]
      );
      
      // Query aggregate
      const result = await conn.execute(
        `SELECT order_id, 
                SUM(quantity) as total_items,
                SUM(quantity * price) as total_amount
         FROM order_items
         GROUP BY order_id
         ORDER BY order_id`
      );
      
      console.log('Order summary:');
      for (const row of result.rows) {
        console.log(`  Order ${row.order_id}: ${row.total_items} items, $${row.total_amount}`);
      }
      
      // Commit transaction
      await conn.execute('COMMIT');
      console.log('Transaction committed');
      
    } catch (error) {
      // Rollback on error
      await conn.execute('ROLLBACK');
      console.error('Transaction rolled back:', error);
    } finally {
      pool.release(conn);
    }

    // Parallel queries using pool
    console.log('\nExecuting parallel queries...');
    
    const queries = [
      (async () => {
        const c = await pool.acquire();
        try {
          const result = await c.execute('SELECT 1 as value');
          console.log('  Query 1 result:', result.rows[0]);
        } finally {
          pool.release(c);
        }
      })(),
      (async () => {
        const c = await pool.acquire();
        try {
          const result = await c.execute('SELECT 2 as value');
          console.log('  Query 2 result:', result.rows[0]);
        } finally {
          pool.release(c);
        }
      })(),
      (async () => {
        const c = await pool.acquire();
        try {
          const result = await c.execute('SELECT 3 as value');
          console.log('  Query 3 result:', result.rows[0]);
        } finally {
          pool.release(c);
        }
      })()
    ];
    
    await Promise.all(queries);
    console.log('All parallel queries completed');

  } finally {
    console.log('\nClosing all connections...');
    await pool.closeAll();
    console.log('All connections closed');
  }
}

// Run the example
if (require.main === module) {
  advancedExample()
    .then(() => {
      console.log('\nAdvanced example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nAdvanced example failed:', error);
      process.exit(1);
    });
}

module.exports = advancedExample;
