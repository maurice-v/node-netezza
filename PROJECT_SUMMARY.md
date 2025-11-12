# node-netezza - Project Summary

## What is node-netezza?

**node-netezza** is a pure JavaScript/TypeScript driver for IBM Netezza databases, designed for Node.js applications.

## Project Structure

```
node-netezza/
├── src/                      # TypeScript source files
│   ├── connection.ts         # Main connection & query execution logic
│   ├── protocol.ts           # Netezza protocol constants
│   ├── types.ts             # Type converters (SQL ↔ JavaScript)
│   ├── errors.ts            # Error class hierarchy
│   └── index.ts             # Public API exports
├── examples/                 # Usage examples
│   ├── basic.js             # Simple CRUD operations
│   └── advanced.js          # Transactions, pooling
├── dist/                    # Compiled JavaScript (generated)
├── package.json             # NPM package definition
├── tsconfig.json            # TypeScript configuration
├── README.md                # User documentation
├── DEVELOPMENT.md           # Developer guide with protocol details
├── CONTRIBUTING.md          # Contribution guidelines
├── CHANGELOG.md             # Version history
├── LICENSE                  # BSD-3-Clause
└── .gitignore              # Git ignore rules
```

## Key Features

✅ **Pure JavaScript** - No native dependencies, works everywhere  
✅ **TypeScript Support** - Full type definitions included  
✅ **Promise-based** - Modern async/await API  
✅ **Parameterized Queries** - `?` placeholders for safe SQL  
✅ **Multiple Auth** - Password, MD5, SHA256 authentication  
✅ **Type Conversion** - Automatic SQL ↔ JavaScript type mapping  
✅ **Transaction Support** - BEGIN, COMMIT, ROLLBACK  
✅ **Error Handling** - Comprehensive error types  

## Quick Start

```bash
# Install
npm install node-netezza

# Use in your code
const { connect } = require('node-netezza');

const conn = await connect({
  user: 'admin',
  password: 'password',
  host: 'localhost',
  port: 5480,
  database: 'testdb'
});

const result = await conn.execute('SELECT * FROM customers WHERE id = ?', [1]);
console.log(result.rows);

await conn.close();
```

## Architecture

### Protocol Implementation

The driver implements the PostgreSQL wire protocol that Netezza uses:

1. **Handshake** - Negotiates protocol version (CP_VERSION_2 through CP_VERSION_6)
2. **Authentication** - Supports password, MD5, and SHA256
3. **Query Execution** - Both simple and extended (parameterized) queries
4. **Type Conversion** - Automatic conversion between Netezza and JavaScript types

### Connection Flow

```
Client → Handshake Negotiate → Server
      ← Version Response ←
      → Database/User Info →
      → Client Metadata →
      ← Authentication Request ←
      → Password/Hash →
      ← Auth OK ←
      ← Ready for Query ←
```

### Query Flow

**Simple Query** (no parameters):
```
Client → Query ('Q') → Server
       ← Row Description ←
       ← Data Rows ←
       ← Command Complete ←
       ← Ready for Query ←
```

**Extended Query** (with parameters):
```
Client → Parse, Bind, Describe, Execute, Sync → Server
       ← Parse Complete ←
       ← Bind Complete ←
       ← Row Description ←
       ← Data Rows ←
       ← Command Complete ←
       ← Ready for Query ←
```

## Development

### Building

```bash
cd node-netezza
npm install
npm run build
```

This compiles TypeScript → JavaScript in the `dist/` folder.

### Testing

Run the example scripts (update connection details first):

```bash
node examples/basic.js
node examples/advanced.js
```

### Adding Type Converters

```javascript
import { typeConverters } from 'node-netezza';

// Add custom type converter
typeConverters[customOid] = {
  decode: (buffer) => { /* convert buffer to JS value */ },
  encode: (value) => { /* convert JS value to buffer */ }
};
```

## Comparison to Other Drivers

| Aspect | Other Drivers | node-netezza |
|--------|---------------|--------------|
| Language | Various | JavaScript/TypeScript |
| API | Varies (cursor/callback) | Promise-based |
| Parameters | Named or positional | `?` (converted to `$1`) |
| Connection | Varies | Async/await |
| Dependencies | External packages | Pure Node.js |

## License

**BSD-3-Clause** - A permissive open-source license that:

✅ Allows commercial use  
✅ Allows modifications  
✅ Allows distribution  
✅ Protects contributors from liability  
✅ Requires attribution  
✅ Prohibits using contributor names for endorsement  

See `LICENSE` file for full text.

## Roadmap

Future enhancements planned:

- [ ] Built-in connection pooling
- [ ] SSL/TLS connection support
- [ ] External table operations
- [ ] Prepared statement caching
- [ ] Streaming large result sets
- [ ] COPY command support
- [ ] Comprehensive test suite
- [ ] Performance benchmarks
- [ ] Official npm publication

## Contributing

We welcome contributions! See `CONTRIBUTING.md` for guidelines.

## Questions?

- Open an issue on GitHub
- Check `DEVELOPMENT.md` for protocol details
- Review examples in `examples/` folder

---

**Status**: Initial release (v1.0.0)  
**Maintained by**: node-netezza contributors
