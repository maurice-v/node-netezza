# node-netezza: Pure Node.js driver for IBM Netezza

A pure JavaScript/TypeScript driver for IBM Netezza that provides a modern Node.js interface for connecting to and querying Netezza databases.

## Features

- Pure JavaScript implementation - no native dependencies
- TypeScript support with full type definitions
- Promise-based API
- Native connection pooling with min/max sizing and automatic eviction
- Parameterized queries with `?` placeholders
- **Query cancellation support** - cancel long-running queries programmatically
- Support for all major Netezza data types
- Raw value option for BIGINT, DATE, TIMESTAMP to avoid overflow and timezone issues
- Transaction support
- Comprehensive error handling
- Row mode options (object or array format)

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

### Listing Databases

You can connect without specifying a database (defaults to `SYSTEM`) and query available databases:

```javascript
const { connect } = require('node-netezza');

async function listDatabases() {
  // Connect without specifying database - defaults to SYSTEM
  const conn = await connect({
    user: 'admin',
    password: 'password',
    host: 'localhost',
    port: 5480,
    securityLevel: 1
  });

  try {
    const result = await conn.execute(`
      SELECT DATABASE, OBJID
      FROM _V_DATABASE
      ORDER BY DATABASE
    `);

    console.log('Available databases:');
    result.rows.forEach(row => {
      console.log(`  ${row.database}`);
    });
  } finally {
    await conn.close();
  }
}
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

## Query Cancellation

All queries are cancellable by default. The `execute()` method returns a `CancellableQuery` which implements the Promise interface, so you can await it normally or use the `.cancel()` method to cancel long-running queries.

### Cancelling Queries

```javascript
const { connect } = require('node-netezza');

async function runCancellableQuery() {
  const conn = await connect({
    user: 'admin',
    password: 'password',
    database: 'db1'
  });

  // Start a potentially long-running query
  const query = conn.execute('SELECT * FROM huge_table WHERE complex_condition');

  // Set up a timeout to cancel after 30 seconds
  const timeoutId = setTimeout(async () => {
    console.log('Query is taking too long, cancelling...');
    await query.cancel();
  }, 30000);

  try {
    const result = await query;
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.code === 'QUERY_CANCELLED') {
      console.log('Query was cancelled successfully');
      return null;
    }
    throw error;
  } finally {
    await conn.close();
  }
}
```

### Using cancelQuery() Directly

You can also call `cancelQuery()` directly on the connection:

```javascript
const conn = await connect({...});

// Start query (don't await yet)
const queryPromise = conn.execute('SELECT * FROM large_table');

// Cancel after some condition
setTimeout(() => {
  conn.cancelQuery().catch(console.error);
}, 5000);

try {
  const result = await queryPromise;
} catch (error) {
  if (error.code === 'QUERY_CANCELLED') {
    console.log('Query was cancelled');
  }
}
```

### CancellableQuery Properties

The `CancellableQuery` object returned by `execute()` has:

- `cancel()`: Async method to cancel the running query
- `isCancelled`: Boolean indicating if cancellation was requested
- Implements `Promise` interface (can be awaited directly)

### Error Handling

When a query is cancelled, a `QueryCancelledError` is thrown with:

- `name`: `'QueryCancelledError'`
- `code`: `'QUERY_CANCELLED'` (use this for reliable error type checking)
- `message`: Error message from the server

```javascript
const { QueryCancelledError } = require('node-netezza');

try {
  const result = await query;
} catch (error) {
  if (error instanceof QueryCancelledError) {
    // Handle cancellation
  } else if (error.code === 'QUERY_CANCELLED') {
    // Alternative check using error code
  }
}
```

## Connection Pooling

For production applications, use connection pooling to efficiently manage multiple database connections:

### Basic Pooling

```javascript
const { createPool } = require('node-netezza');

const pool = createPool({
  // Connection options
  user: 'admin',
  password: 'password',
  host: 'localhost',
  port: 5480,
  database: 'db1',
  securityLevel: 1,
  // Pool-specific options
  max: 10,  // Maximum 10 connections
  min: 2    // Maintain at least 2 connections
});

// Execute directly on pool (recommended for single queries)
const result = await pool.execute('SELECT * FROM customers');
console.log(result.rows);

// Get pool statistics
const stats = pool.getStats();
console.log(`Active: ${stats.inUse}, Available: ${stats.available}`);

// Always close pool when done
await pool.end();
```

### Acquire/Release Pattern

For transactions or multiple queries on the same connection:

```javascript
const pool = createPool({
  // Connection options
  user: 'admin',
  password: 'password',
  host: 'localhost',
  port: 5480,
  database: 'db1',
  securityLevel: 1,
  // Pool-specific options
  max: 10
});

// Acquire connection for transaction
const conn = await pool.acquire();
try {
  await conn.execute('BEGIN');
  await conn.execute('INSERT INTO orders VALUES (?, ?)', [1, 100]);
  await conn.execute('UPDATE inventory SET qty = qty - 1 WHERE id = ?', [1]);
  await conn.execute('COMMIT');
} catch (err) {
  await conn.execute('ROLLBACK');
  throw err;
} finally {
  await pool.release(conn);  // Always release back to pool
}

await pool.end();
```

### Pool Configuration

The pool accepts all standard connection options (`user`, `password`, `host`, `port`, `database`, etc.) plus pool-specific options:

**Pool-Specific Options:**
- `min` (number, default: 0): Minimum connections to maintain
- `max` (number, default: 10): Maximum connections in pool
- `acquireTimeout` (number, default: 30000): Max wait time for connection (ms)
- `idleTimeout` (number, default: 30000): Time before idle connections are removed (ms)
- `connectionTimeout` (number, default: 1800000): Max lifetime of a connection (ms)
- `validateOnBorrow` (boolean, default: true): Validate connection before use
- `validateOnReturn` (boolean, default: false): Validate connection after use
- `validationQuery` (string, default: "SELECT 1"): Query to validate connections

All connection options from the `connect()` function are also supported (see API Documentation below).

## Raw Values for Data Types

To avoid JavaScript number overflow and timezone conversion issues, you can request raw string values for certain data types:

```javascript
const { connect } = require('node-netezza');

const conn = await connect({
  user: 'admin',
  password: 'password',
  database: 'db1',
  rawTypes: {
    bigint: true,      // Return BIGINT as string
    timestamp: true,   // Return TIMESTAMP as string
    date: true,        // Return DATE as string
    numeric: true      // Return NUMERIC/DECIMAL as string
  }
});

const result = await conn.execute('SELECT big_id, created_at FROM logs');
console.log(result.rows[0]);
// { big_id: "9223372036854775807", created_at: "2024-11-16 10:30:00.123456" }
// Instead of { big_id: 9223372036854776000, created_at: Date(...) }
```

**Why use raw values?**

- **BIGINT overflow**: JavaScript's `Number.MAX_SAFE_INTEGER` is 2^53-1 (9,007,199,254,740,991), but Netezza BIGINT supports up to 2^63-1. Values beyond the safe integer range lose precision when converted to JavaScript numbers.
- **Timezone issues**: Date/timestamp parsing may apply unwanted timezone conversions, altering the actual database values.
- **Numeric precision**: Decimal values may lose precision when converted to JavaScript floats.

## API Documentation

### Connection

#### `connect(options)`

Creates a new connection to Netezza.

**Options:**
- `user` (string, required): Database user
- `password` (string, required): User password
- `host` (string, default: 'localhost'): Database host
- `port` (number, default: 5480): Database port
- `database` (string, default: 'SYSTEM'): Database name
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
- `rawTypes` (object, optional): Return raw string values for specific types
  - `bigint` (boolean, default: false): Return BIGINT as string
  - `date` (boolean, default: false): Return DATE as string
  - `timestamp` (boolean, default: false): Return TIMESTAMP as string
  - `numeric` (boolean, default: false): Return NUMERIC/DECIMAL as string

#### `connection.execute(sql, params?)`

Executes a SQL statement and returns a cancellable query.

**Parameters:**
- `sql` (string): SQL statement with `?` placeholders
- `params` (array, optional): Query parameters array

**Returns:** CancellableQuery<QueryResult>
- Can be awaited like a normal Promise
- `cancel()`: Async method to cancel the query
- `isCancelled`: Boolean indicating if cancel was called

**Examples:**
```typescript
// Regular query
await conn.execute('SELECT * FROM users');

// Query with parameters
await conn.execute('SELECT * FROM users WHERE id = ?', [42]);

// Cancellable query
const query = conn.execute('SELECT * FROM large_table');
setTimeout(() => query.cancel(), 5000);
```

#### `connection.cancelQuery()`

Cancels the currently running query on this connection.

**Returns:** Promise<void>

**Throws:**
- `InterfaceError`: If no backend key data is available (not connected)
- `ConnectionClosedError`: If the connection is closed

#### `connection.processId`

Returns the backend process ID for this connection, or `undefined` if not connected.

**Type:** number | undefined

#### `connection.close()`

Closes the connection.

## License

BSD-3-Clause
