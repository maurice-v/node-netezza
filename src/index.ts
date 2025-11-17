/**
 * node-netezza - Pure Node.js driver for IBM Netezza
 */

export { connect, Connection, ConnectionOptions, QueryResult, QueryRow } from './connection';
export { createPool, Pool, PoolOptions, PoolStats } from './pool';
export * from './errors';
export { getTypeConverter, TypeConverterContext } from './types';

// API level and compatibility information
export const apilevel = '2.0';
export const threadsafety = 1;
export const paramstyle = 'qmark'; // Uses ? for parameters

// Version
export const version = '1.0.0';
