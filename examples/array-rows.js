const { connect } = require('../dist/index');

async function example() {
  // Create connection with rowMode set to 'array'
  console.log('Connecting to Netezza with rowMode: array...');
  
  const conn = await connect({
    user: 'admin',
    password: 'password',
    host: 'localhost',
    port: 5480,
    database: 'testdb',
    securityLevel: 1,
    rowMode: 'array'  // Return rows as arrays instead of objects
  });

  try {
    console.log('Connected successfully!');
    
    // Create a test table
    console.log('\nCreating table...');
    await conn.execute(
      `CREATE TABLE IF NOT EXISTS test_array_rows (
        id INTEGER,
        name VARCHAR(50),
        score NUMERIC(10,2)
      )`
    );
    console.log('Table created');

    // Insert test data
    console.log('\nInserting data...');
    await conn.execute(
      'INSERT INTO test_array_rows VALUES (?, ?, ?)',
      [1, 'Alice', 95.5]
    );
    await conn.execute(
      'INSERT INTO test_array_rows VALUES (?, ?, ?)',
      [2, 'Bob', 87.3]
    );
    await conn.execute(
      'INSERT INTO test_array_rows VALUES (?, ?, ?)',
      [3, 'Charlie', 92.1]
    );
    console.log('Data inserted');

    // Query with array rows
    console.log('\nQuerying with rowMode: array...');
    const results = await conn.execute('SELECT * FROM test_array_rows ORDER BY id');
    console.log('Found', results.rowCount, 'rows:');
    console.log('Field names:', results.fields.map(f => f.name).join(', '));
    console.log('\nRows as arrays:');
    for (const row of results.rows) {
      console.log('  ', row);  // Arrays: [1, 'Alice', 95.5]
    }

    // Demonstrate duplicate column name handling
    console.log('\n\nDemonstrating duplicate column names...');
    console.log('Query: SELECT 1 as value, 2 as value, 3 as value');
    const duplicateResults = await conn.execute('SELECT 1 as value, 2 as value, 3 as value');
    console.log('Result (array mode handles duplicates):');
    console.log('  ', duplicateResults.rows[0]);  // [1, 2, 3]
    
    // Show another example with calculated columns
    console.log('\n\nQuery with calculated columns:');
    const calcResults = await conn.execute(
      `SELECT 
        id,
        score,
        score * 1.1 as score,
        score * 0.9 as score
      FROM test_array_rows 
      WHERE id = ?`,
      [1]
    );
    console.log('Field names:', calcResults.fields.map(f => f.name).join(', '));
    console.log('Result:', calcResults.rows[0]);
    console.log('  - All values accessible by position, even with duplicate column names!');

    // Accessing by index
    console.log('\n\nAccessing values by index:');
    const row = results.rows[0];
    console.log('Row:', row);
    console.log('ID (index 0):', row[0]);
    console.log('Name (index 1):', row[1]);
    console.log('Score (index 2):', row[2]);

    // Drop table
    console.log('\nDropping table...');
    await conn.execute('DROP TABLE test_array_rows');
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

// Compare with object mode
async function compareWithObjectMode() {
  console.log('\n\n========================================');
  console.log('COMPARISON: Object mode (default)');
  console.log('========================================\n');

  const conn = await connect({
    user: 'admin',
    password: 'password',
    host: 'localhost',
    port: 5480,
    database: 'testdb',
    securityLevel: 1
    // rowMode defaults to 'object'
  });

  try {
    // Create and populate table
    await conn.execute(
      `CREATE TABLE IF NOT EXISTS test_object_rows (
        id INTEGER,
        name VARCHAR(50)
      )`
    );
    await conn.execute('INSERT INTO test_object_rows VALUES (?, ?)', [1, 'Alice']);

    // Query with duplicate column names
    console.log('Query: SELECT 1 as value, 2 as value');
    const result = await conn.execute('SELECT 1 as value, 2 as value');
    console.log('Result (object mode - last value wins):');
    console.log('  ', result.rows[0]);  // { value: 2 } - first value is lost!

    // Cleanup
    await conn.execute('DROP TABLE test_object_rows');
    await conn.close();

  } catch (error) {
    console.error('Error:', error);
    try { await conn.close(); } catch {}
  }
}

// Run both examples
example()
  .then(() => compareWithObjectMode())
  .catch(console.error);
