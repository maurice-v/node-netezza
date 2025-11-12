# Changelog

All notable changes to node-netezza will be documented in this file.

## [1.0.0] - 2025-01-01

### Added
- Initial release of node-netezza - Pure Node.js driver for IBM Netezza
- Connection management with authentication support (password, MD5, SHA256)
- Simple and extended query protocols
- Parameterized queries with `?` placeholders
- Type conversion for common Netezza data types
- Transaction support (BEGIN, COMMIT, ROLLBACK)
- Comprehensive error handling with custom error types
- TypeScript support with full type definitions
- Example scripts for basic and advanced usage
- Complete API documentation

### Features
- Pure JavaScript implementation (no native dependencies)
- Promise-based async/await API
- Support for multiple authentication methods
- Automatic parameter placeholder conversion (? to $1, $2, etc.)
- Connection pooling examples
- Compatible with Node.js 14+

### Supported Data Types
- INTEGER, SMALLINT, BIGINT
- FLOAT, DOUBLE, NUMERIC
- VARCHAR, CHAR, TEXT
- BOOLEAN
- DATE, TIME, TIMESTAMP
- BYTEA (binary data)

## [Unreleased]

### Planned
- Connection pooling built-in support
- SSL/TLS connection support
- External table operations
- Prepared statement caching
- Streaming result sets
- More comprehensive test suite
