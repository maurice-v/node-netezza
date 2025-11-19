# Integration Tests

This directory contains integration tests that connect to a real Netezza database.

## Configuration

Tests use the centralized configuration from `test.config.js` in the root directory.

You can override connection settings using environment variables:

```bash
export NETEZZA_HOST=your-netezza-host
export NETEZZA_PORT=5480
export NETEZZA_DATABASE=your-database
export NETEZZA_USER=your-user
export NETEZZA_PASSWORD=your-password
export NETEZZA_SECURITY_LEVEL=1
```

## Running Tests

```bash
# Run all tests (unit + integration)
npm test

# Run only unit tests (src/__tests__)
npm run test:unit

# Run only integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Files

- `connection.integration.test.ts` - Basic connection and CRUD operations
- `pool.integration.test.ts` - Connection pooling and transactions
- `raw-types.integration.test.ts` - Raw type handling (BIGINT, DATE, TIMESTAMP, NUMERIC)
- `row-modes.integration.test.ts` - Array and object row modes

## Notes

- Integration tests require a working Netezza database connection
- Tests use temporary tables when possible to avoid side effects
- Tests clean up after themselves
- Some TypeScript strict type errors are expected due to dynamic query results
