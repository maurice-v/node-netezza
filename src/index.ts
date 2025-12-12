/**
 * node-netezza - Pure Node.js driver for IBM Netezza
 */

export { connect, Connection, ConnectionOptions, QueryResult, QueryRow, CancellableQuery } from './connection';
export { createPool, Pool, PoolOptions, PoolStats } from './pool';
export * from './errors';
export { getTypeConverter, TypeConverterContext } from './types';

// Version
export const version = '1.3.0';
