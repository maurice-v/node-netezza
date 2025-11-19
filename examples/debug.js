const { connect } = require('../dist/index');
const config = require('./config');

async function example() {
  // Create connection
  console.log('Connecting to Netezza...');
  
  let conn = null;
  try {
    conn = await connect(config);

    console.log('Connected successfully!');
    
    // Simple query to test
    const result = await conn.execute('SELECT 1 as test');
    console.log('Query result:', result.rows);
    
    await conn.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error.message);
    if (conn) {
      try {
        await conn.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    process.exit(1);
  }
}

example()
  .then(() => {
    console.log('Example completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
