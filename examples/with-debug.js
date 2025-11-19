const { connect } = require('../dist/index');
const config = require('./config');

async function example() {
  // Create connection with debug mode enabled
  console.log('Connecting to Netezza with DEBUG mode enabled...');
  
  const conn = await connect({
    ...config,
    debug: true  // Enable debug logging
  });

  try {
    console.log('\nConnected successfully!\n');
    
    // Run a simple query
    const result = await conn.execute('SELECT CURRENT_TIMESTAMP');
    console.log('\nQuery result:', result.rows[0]);
  } finally {
    await conn.close();
    console.log('\nConnection closed');
  }
}

example().catch(console.error);
