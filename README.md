# node-netezza: Pure Node.js driver for IBM Netezza

A pure JavaScript/TypeScript driver for IBM Netezza that provides a modern Node.js interface for connecting to and querying Netezza databases.

## Features

- Pure JavaScript implementation - no native dependencies
- TypeScript support with full type definitions
- Promise-based API
- Connection pooling
- Parameterized queries with `?` placeholders
- Support for all major Netezza data types
- Transaction support
- Comprehensive error handling

## Installation

```bash
npm install node-netezza
```

## Quick Start

```javascript
const { connect } = require('node-netezza');

async function example() {
  const conn = await connect({
    user: 'admin',
    password: 'password',
    host: 'localhost',
    port: 5480,
    database: 'db1',
    securityLevel: 1
  });

  try {
    // Create a table
    await conn.execute(
      "CREATE TABLE customers(id INT, name VARCHAR(50), email VARCHAR(100))"
    );

    // Insert data with parameters
    await conn.execute(
      "INSERT INTO customers VALUES (?, ?, ?)",
      [1, 'John Doe', 'john@example.com']
    );

    // Query data
    const results = await conn.execute(
      "SELECT * FROM customers WHERE id = ?",
      [1]
    );

    for (const row of results.rows) {
      console.log(row);  // { id: 1, name: 'John Doe', email: 'john@example.com' }
    }
  } finally {
    await conn.close();
  }
}

example().catch(console.error);
```

### Array Row Mode

For handling duplicate column names or improved performance, use `rowMode: 'array'`:

```javascript
const conn = await connect({
  user: 'admin',
  password: 'password',
  database: 'db1',
  rowMode: 'array'  // Return rows as arrays
});

const results = await conn.execute('SELECT id, name, email FROM customers');
for (const row of results.rows) {
  console.log(row);  // [1, 'John Doe', 'john@example.com']
  console.log('ID:', row[0], 'Name:', row[1], 'Email:', row[2]);
}

// Handles duplicate column names
const dupes = await conn.execute('SELECT 1 as value, 2 as value');
console.log(dupes.rows[0]);  // [1, 2] - all values preserved!
```

## Debugging

Enable debug mode to see detailed protocol-level logging for troubleshooting connection and query issues:

```javascript
const conn = await connect({
  user: 'admin',
  password: 'password',
  host: 'localhost',
  port: 5480,
  database: 'db1',
  debug: true  // Enable debug logging
});
```

When enabled, debug output is prefixed with `[node-netezza]` and includes:
- SSL/TLS negotiation details
- Authentication protocol messages
- Query execution flow
- Protocol message types and data
- Field descriptions and data parsing

**Note:** Debug mode should only be used during development as it produces verbose output.

## API Documentation

### Connection

#### `connect(options)`

Creates a new connection to Netezza.

**Options:**
- `user` (string, required): Database user
- `password` (string, required): User password
- `host` (string, default: 'localhost'): Database host
- `port` (number, default: 5480): Database port
- `database` (string, required): Database name
- `securityLevel` (number, default: 0): Security level (0-3)
  - 0: Preferred unsecured session
  - 1: Only unsecured session
  - 2: Preferred secured session
  - 3: Only secured session
- `timeout` (number, optional): Connection timeout in milliseconds
- `debug` (boolean, default: false): Enable debug logging to console
- `rowMode` (string, default: 'object'): Row return format
  - `'object'`: Returns rows as objects with column names as keys (e.g., `{ id: 1, name: 'John' }`)
  - `'array'`: Returns rows as arrays with values in column order (e.g., `[1, 'John']`)
  - Array mode is useful for handling duplicate column names and can be slightly more efficient
- `ssl` (object, optional): SSL/TLS options
  - `ca` (string | Buffer, optional): CA certificate for server verification
  - `rejectUnauthorized` (boolean, default: true): Whether to reject unauthorized connections

#### `connection.execute(sql, params?)`

Executes a SQL statement and returns results.

**Parameters:**
- `sql` (string): SQL statement with `?` placeholders
- `params` (array, optional): Parameter values

**Returns:** Promise<QueryResult>

#### `connection.close()`

Closes the connection.

## License

BSD-3-Clause
