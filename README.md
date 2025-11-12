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
      console.log(row);
    }
  } finally {
    await conn.close();
  }
}

example().catch(console.error);
```

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
- `timeout` (number, optional): Connection timeout in milliseconds

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
