# Changelog

All notable changes to node-netezza will be documented in this file.

## [1.2.0] - 2025-11-19

### Added
- **Connection pooling** with built-in Pool class
  - Configurable min/max connections
  - Automatic connection lifecycle management
  - Connection reuse and resource pooling
  - Pool statistics and monitoring
  - Transaction support within pool
- **Raw type handling** for precision-critical data types
  - BIGINT values returned as strings to prevent JavaScript number overflow
  - DATE, TIMESTAMP, and NUMERIC types preserved as strings
  - Maintains precision for financial and scientific calculations
- **SSL connection fixes** and improvements
- **Unit tests** with Jest framework
  - Comprehensive test coverage for core functionality
  - Integration tests for production systems
  - Centralized test configuration

### Changed
- Enhanced type handling to preserve data precision
- Improved error handling in connection management

### Examples
- Added `pool-basic.js` - Basic connection pooling usage
- Added `pool-transactions.js` - Transaction handling with pools
- Added `raw-values.js` - Raw type handling demonstration
- Centralized configuration for examples and tests

## [1.1.0] - 2025-11-13

### Added
- **Row mode option** (`rowMode`) for controlling row return format
  - `'object'` mode (default): Returns rows as objects with column names as keys
  - `'array'` mode: Returns rows as arrays with values in column order
- Array mode solves the duplicate column name issue (e.g., `SELECT 1 as a, 2 as a`)
- New example `array-rows.js` demonstrating both row modes and duplicate column handling

### Changed
- `QueryResult.rows` type updated to support both `QueryRow[]` and `any[][]`

### Improved
- Documentation updated with array mode usage examples
- All examples validated and connection details updated

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
