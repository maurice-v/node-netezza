# node-netezza - Node.js Driver Development Guide

## Project Overview

**node-netezza** is a pure JavaScript/TypeScript driver for IBM Netezza. It provides a modern, Promise-based API for Node.js applications to connect to and query Netezza databases.

## Architecture

### Core Components

1. **Connection Management** (`src/connection.ts`)
   - Socket-based TCP connection
   - Handshake negotiation (CP_VERSION_2 through CP_VERSION_6)
   - Multiple authentication methods (password, MD5, SHA256)
   - Connection lifecycle management

2. **Protocol Implementation** (`src/protocol.ts`)
   - PostgreSQL wire protocol compatibility
   - Message type constants
   - Authentication and handshake opcodes
   - Transaction status tracking

3. **Type System** (`src/types.ts`)
   - Data type converters for Netezza types
   - Buffer encoding/decoding
   - Support for common SQL types (INTEGER, VARCHAR, DATE, etc.)

4. **Error Handling** (`src/errors.ts`)
   - Comprehensive error hierarchy
   - DB-API 2.0 compliant error types

## Protocol Flow

### 1. Connection Establishment
```
Client                          Server
  |                               |
  |--- Handshake Negotiate ------>|
  |<-- Version Response ----------|
  |--- Database Info ------------->|
  |--- User Info ----------------->|
  |--- Client Metadata ----------->|
  |<-- Authentication Request ----|
  |--- Password/Hash ------------->|
  |<-- Auth OK --------------------|
  |<-- Ready for Query ------------|
```

### 2. Query Execution

**Simple Query** (no parameters):
```
Client                          Server
  |--- Query ('Q') --------------->|
  |<-- Row Description ------------|
  |<-- Data Row(s) ----------------|
  |<-- Command Complete -----------|
  |<-- Ready for Query ------------|
```

**Extended Query** (with parameters):
```
Client                          Server
  |--- Parse ('P') --------------->|
  |--- Bind ('B') ---------------->|
  |--- Describe ('D') ------------->|
  |--- Execute ('E') -------------->|
  |--- Sync ('S') ---------------->|
  |<-- Parse Complete -------------|
  |<-- Bind Complete --------------|
  |<-- Row Description ------------|
  |<-- Data Row(s) ----------------|
  |<-- Command Complete -----------|
  |<-- Ready for Query ------------|
```

## Key Features

### 1. Connection Options
```typescript
interface ConnectionOptions {
  user: string;           // Database user
  password: string;       // User password
  host?: string;          // Default: 'localhost'
  port?: number;          // Default: 5480
  database: string;       // Database name
  securityLevel?: number; // Security level 0-3
  timeout?: number;       // Connection timeout (ms)
  applicationName?: string; // Optional app identifier
}
```

### 2. Query Execution
```javascript
// Simple query
const result = await conn.execute('SELECT * FROM users');

// Parameterized query (? placeholders)
const result = await conn.execute(
  'SELECT * FROM users WHERE id = ? AND age > ?',
  [123, 18]
);

// Result format
{
  rows: [{ id: 123, name: 'John', age: 25 }],
  rowCount: 1,
  command: 'SELECT 1',
  fields: [
    { name: 'id', typeOid: 23, ... },
    { name: 'name', typeOid: 1043, ... }
  ]
}
```

### 3. Transaction Support
```javascript
await conn.execute('BEGIN');
try {
  await conn.execute('INSERT INTO ...');
  await conn.execute('UPDATE ...');
  await conn.execute('COMMIT');
} catch (error) {
  await conn.execute('ROLLBACK');
  throw error;
}
```

## Type Mapping

| Netezza Type | JavaScript Type | Type OID |
|--------------|-----------------|----------|
| INTEGER      | number          | 23       |
| BIGINT       | number          | 20       |
| SMALLINT     | number          | 21       |
| FLOAT        | number          | 700/701  |
| NUMERIC      | number          | 1700     |
| VARCHAR      | string          | 1043     |
| CHAR         | string          | 1042     |
| TEXT         | string          | 25       |
| BOOLEAN      | boolean         | 16       |
| DATE         | Date            | 1082     |
| TIME         | string          | 1083     |
| TIMESTAMP    | Date            | 1114     |
| BYTEA        | Buffer          | 17       |

## Installation & Usage

### Installation
```bash
cd node-netezza
npm install
npm run build
```

### Basic Usage
```javascript
const { connect } = require('./dist/index');

async function main() {
  const conn = await connect({
    user: 'admin',
    password: 'password',
    host: 'localhost',
    port: 5480,
    database: 'testdb'
  });

  try {
    const result = await conn.execute('SELECT * FROM customers');
    console.log(result.rows);
  } finally {
    await conn.close();
  }
}
```

### Examples
- **Basic**: `examples/basic.js` - CRUD operations, parameterized queries
- **Advanced**: `examples/advanced.js` - Transactions, connection pooling

## Differences from Other Drivers

| Feature | Other Drivers | node-netezza |
|---------|---------------|--------------|
| API Style | Varies (cursor/callback) | Promise-based |
| Parameter Style | Named or positional | `?` (converted to `$1`, `$2`) |
| Type System | Language-specific | JavaScript types |
| Connection | Varies | Async/await |
| Dependencies | External packages | Pure Node.js (built-ins) |

## Extension Points

### Custom Type Converters
```typescript
import { typeConverters } from 'node-netezza';

// Add custom converter for a type
typeConverters[customOid] = {
  decode: (buffer: Buffer) => { /* custom decode */ },
  encode: (value: any) => { /* custom encode */ }
};
```

### Connection Pooling
See `examples/advanced.js` for a simple connection pool implementation. 
For production, consider using a third-party pool like `generic-pool`.

## Testing

To test the driver:

1. Set up a Netezza instance (or compatible database)
2. Update connection parameters in examples
3. Run examples:
   ```bash
   node examples/basic.js
   node examples/advanced.js
   ```

## Future Enhancements

- [ ] Built-in connection pooling
- [ ] SSL/TLS support
- [ ] External table operations
- [ ] Prepared statement caching
- [ ] Streaming large result sets
- [ ] COPY command support
- [ ] Comprehensive test suite with mocks
- [ ] Performance benchmarks

## Contributing

See `CONTRIBUTING.md` for development guidelines.

## License

BSD-3-Clause - A permissive open-source license

---

## Quick Reference

### API Methods

**Connection**
- `connect(options)` - Create and connect
- `connection.execute(sql, params?)` - Execute query
- `connection.close()` - Close connection

**Errors**
- `NzError` - Base error class
- `InterfaceError` - Interface/connection errors
- `DatabaseError` - Database-related errors
- `OperationalError` - Operational errors
- `ProgrammingError` - Programming errors
- `NotSupportedError` - Unsupported operations

### Protocol Constants
- Handshake versions: `CP_VERSION_2` through `CP_VERSION_6`
- Authentication: `AUTH_REQ_PASSWORD`, `AUTH_REQ_MD5`, `AUTH_REQ_SHA256`
- Transaction status: `TRANSACTION_STATUS_IDLE`, `TRANSACTION_STATUS_IN_BLOCK`

