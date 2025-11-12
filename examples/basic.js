const { connect } = require('./dist/index');

async function example() {
  // Create connection
  console.log('Connecting to Netezza...');
  
  const conn = await connect({
    user: 'admin',
    password: 'password',
    host: 'localhost',
    port: 5480,
    database: 'testdb',
    securityLevel: 1
  });

  try {
    console.log('Connected successfully!');
    
    // Create a table
    console.log('\nCreating table...');
    await conn.execute(
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER,
        name VARCHAR(50),
        email VARCHAR(100),
        age INTEGER
      )`
    );
    console.log('Table created');

    // Insert data with parameters
    console.log('\nInserting data...');
    await conn.execute(
      'INSERT INTO customers VALUES (?, ?, ?, ?)',
      [1, 'John Doe', 'john@example.com', 30]
    );
    await conn.execute(
      'INSERT INTO customers VALUES (?, ?, ?, ?)',
      [2, 'Jane Smith', 'jane@example.com', 25]
    );
    await conn.execute(
      'INSERT INTO customers VALUES (?, ?, ?, ?)',
      [3, 'Bob Johnson', 'bob@example.com', 35]
    );
    console.log('Data inserted');

    // Query all data
    console.log('\nQuerying all customers...');
    const allResults = await conn.execute('SELECT * FROM customers ORDER BY id');
    console.log('Found', allResults.rowCount, 'customers:');
    for (const row of allResults.rows) {
      console.log('  -', row);
    }

    // Query with parameter
    console.log('\nQuerying customer with id = 2...');
    const singleResult = await conn.execute(
      'SELECT * FROM customers WHERE id = ?',
      [2]
    );
    console.log('Result:', singleResult.rows[0]);

    // Update data
    console.log('\nUpdating customer age...');
    await conn.execute(
      'UPDATE customers SET age = ? WHERE id = ?',
      [26, 2]
    );
    console.log('Updated');

    // Query updated data
    console.log('\nQuerying updated customer...');
    const updatedResult = await conn.execute(
      'SELECT * FROM customers WHERE id = ?',
      [2]
    );
    console.log('Result:', updatedResult.rows[0]);

    // Delete data
    console.log('\nDeleting customer...');
    await conn.execute('DELETE FROM customers WHERE id = ?', [3]);
    console.log('Deleted');

    // Count remaining rows
    console.log('\nCounting remaining customers...');
    const countResult = await conn.execute('SELECT COUNT(*) as count FROM customers');
    console.log('Remaining customers:', countResult.rows[0].count);

    // Drop table
    console.log('\nDropping table...');
    await conn.execute('DROP TABLE customers');
    console.log('Table dropped');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close connection
    console.log('\nClosing connection...');
    await conn.close();
    console.log('Connection closed');
  }
}

// Run the example
if (require.main === module) {
  example()
    .then(() => {
      console.log('\nExample completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nExample failed:', error);
      process.exit(1);
    });
}

module.exports = example;
