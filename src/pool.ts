/**
 * Connection pooling for node-netezza
 */

import { Connection, ConnectionOptions, QueryResult } from './connection';
import { InterfaceError, OperationalError } from './errors';

/**
 * Connection pool options
 */
export interface PoolOptions extends ConnectionOptions {
  /**
   * Minimum number of connections to maintain
   * @default 0
   */
  min?: number;

  /**
   * Maximum number of connections in the pool
   * @default 10
   */
  max?: number;

  /**
   * Maximum time (ms) to wait for connection from pool
   * @default 30000
   */
  acquireTimeout?: number;

  /**
   * Time (ms) after which idle connections are removed
   * @default 30000
   */
  idleTimeout?: number;

  /**
   * Maximum lifetime (ms) of a connection before removal
   * @default 1800000 (30 minutes)
   */
  connectionTimeout?: number;

  /**
   * Interval (ms) for eviction checks
   * @default 10000
   */
  evictionRunInterval?: number;

  /**
   * Validate connection before returning from pool
   * @default true
   */
  validateOnBorrow?: boolean;

  /**
   * Validate connection before returning to pool
   * @default false
   */
  validateOnReturn?: boolean;

  /**
   * Test query for connection validation
   * @default "SELECT 1"
   */
  validationQuery?: string;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  total: number;        // Total connections
  available: number;    // Available connections
  inUse: number;        // Connections in use
  pending: number;      // Pending acquire requests
  min: number;          // Min pool size
  max: number;          // Max pool size
}

/**
 * Connection metadata for pool management
 */
interface ConnectionMetadata {
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
}

/**
 * Pending acquire request
 */
interface PendingAcquire {
  resolve: (conn: Connection) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Connection pool class
 */
export class Pool {
  private options: PoolOptions & {
    min: number;
    max: number;
    acquireTimeout: number;
    idleTimeout: number;
    connectionTimeout: number;
    evictionRunInterval: number;
    validateOnBorrow: boolean;
    validateOnReturn: boolean;
    validationQuery: string;
  };
  private connections: Map<Connection, ConnectionMetadata> = new Map();
  private availableConnections: Connection[] = [];
  private pendingAcquires: PendingAcquire[] = [];
  private evictionTimer?: NodeJS.Timeout;
  private closing: boolean = false;
  private closed: boolean = false;

  constructor(options: PoolOptions) {
    // Only set pool-specific defaults, Connection class handles connection defaults
    this.options = {
      ...options,
      min: options.min ?? 0,
      max: options.max ?? 10,
      acquireTimeout: options.acquireTimeout ?? 30000,
      idleTimeout: options.idleTimeout ?? 30000,
      connectionTimeout: options.connectionTimeout ?? 1800000, // 30 minutes
      evictionRunInterval: options.evictionRunInterval ?? 10000,
      validateOnBorrow: options.validateOnBorrow ?? false,
      validateOnReturn: options.validateOnReturn ?? false,
      validationQuery: options.validationQuery ?? 'SELECT 1'
    };

    // Validate options
    if (this.options.min < 0) {
      throw new InterfaceError('min must be >= 0');
    }

    if (this.options.max < 1) {
      throw new InterfaceError('max must be >= 1');
    }

    if (this.options.min > this.options.max) {
      throw new InterfaceError('min must be <= max');
    }

    // Initialize pool
    this.initialize();
  }

  /**
   * Initialize the pool
   */
  private async initialize(): Promise<void> {
    // Create minimum connections if min > 0
    if (this.options.min > 0) {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < this.options.min; i++) {
        promises.push(
          this.createConnection()
            .then(conn => {
              this.availableConnections.push(conn);
            })
            .catch(err => {
              // Ignore errors during initialization
              console.error('Failed to create initial connection:', err.message);
            })
        );
      }
      await Promise.allSettled(promises);
    }

    // Start eviction timer
    this.startEvictionTimer();
  }

  /**
   * Execute query using a connection from the pool
   */
  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    if (this.closed) {
      throw new InterfaceError('Pool is closed');
    }

    if (this.closing) {
      throw new InterfaceError('Pool is closing');
    }

    const conn = await this.acquire();
    try {
      return await conn.execute(sql, params);
    } finally {
      await this.release(conn);
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<Connection> {
    if (this.closed) {
      throw new InterfaceError('Pool is closed');
    }

    if (this.closing) {
      throw new InterfaceError('Pool is closing');
    }

    // Check if available connection exists
    while (this.availableConnections.length > 0) {
      const conn = this.availableConnections.shift()!;

      // Validate if needed
      if (this.options.validateOnBorrow) {
        const isValid = await this.validateConnection(conn);
        if (!isValid) {
          // Remove invalid connection
          this.removeConnection(conn);
          continue;
        }
      }

      // Update metadata
      const metadata = this.connections.get(conn);
      if (metadata) {
        metadata.lastUsedAt = Date.now();
        metadata.useCount++;
      }

      return conn;
    }

    // Try to create new connection if below max
    if (this.connections.size < this.options.max) {
      try {
        const conn = await this.createConnection();

        const metadata = this.connections.get(conn);
        if (metadata) {
          metadata.lastUsedAt = Date.now();
          metadata.useCount++;
        }

        return conn;
      } catch (err) {
        // If creation failed and no connections available, throw error
        if (this.availableConnections.length === 0 && this.connections.size === 0) {
          throw err;
        }
        // Otherwise, fall through to wait for connection
      }
    }

    // Wait for connection to become available
    return new Promise<Connection>((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from pending queue
        const index = this.pendingAcquires.findIndex(p => p.resolve === resolve);
        if (index >= 0) {
          this.pendingAcquires.splice(index, 1);
        }
        reject(new OperationalError(`Acquire timeout after ${this.options.acquireTimeout}ms`));
      }, this.options.acquireTimeout);

      this.pendingAcquires.push({
        resolve,
        reject,
        timeout
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: Connection): Promise<void> {
    if (!this.connections.has(connection)) {
      throw new InterfaceError('Connection does not belong to this pool');
    }

    // Validate if needed
    if (this.options.validateOnReturn) {
      const isValid = await this.validateConnection(connection);
      if (!isValid) {
        this.removeConnection(connection);
        return;
      }
    }

    // Update metadata
    const metadata = this.connections.get(connection);
    if (metadata) {
      metadata.lastUsedAt = Date.now();
    }

    // Check if pending acquires exist
    if (this.pendingAcquires.length > 0) {
      const pending = this.pendingAcquires.shift()!;
      clearTimeout(pending.timeout);
      pending.resolve(connection);
      return;
    }

    // Return to available pool
    this.availableConnections.push(connection);
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return {
      total: this.connections.size,
      available: this.availableConnections.length,
      inUse: this.connections.size - this.availableConnections.length,
      pending: this.pendingAcquires.length,
      min: this.options.min,
      max: this.options.max
    };
  }

  /**
   * Close all connections and shut down pool
   */
  async end(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closing = true;

    // Stop eviction timer
    this.stopEvictionTimer();

    // Reject all pending acquires
    for (const pending of this.pendingAcquires) {
      clearTimeout(pending.timeout);
      pending.reject(new InterfaceError('Pool is closing'));
    }
    this.pendingAcquires = [];

    // Close all connections
    const closePromises: Promise<void>[] = [];
    for (const conn of this.connections.keys()) {
      closePromises.push(
        conn.close().catch(err => {
          // Ignore errors during close
          console.error('Error closing connection:', err.message);
        })
      );
    }

    await Promise.allSettled(closePromises);

    this.connections.clear();
    this.availableConnections = [];
    this.closed = true;
    this.closing = false;
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<Connection> {
    const conn = new Connection(this.options);
    await conn.connect();

    const metadata: ConnectionMetadata = {
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 0
    };

    this.connections.set(conn, metadata);

    return conn;
  }

  /**
   * Validate a connection
   */
  private async validateConnection(connection: Connection): Promise<boolean> {
    try {
      await connection.execute(this.options.validationQuery);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Remove a connection from the pool
   */
  private removeConnection(connection: Connection): void {
    this.connections.delete(connection);

    // Remove from available connections
    const index = this.availableConnections.indexOf(connection);
    if (index >= 0) {
      this.availableConnections.splice(index, 1);
    }

    // Close connection
    connection.close().catch(err => {
      // Ignore errors
    });
  }

  /**
   * Start eviction timer
   */
  private startEvictionTimer(): void {
    if (this.evictionTimer) {
      return;
    }

    this.evictionTimer = setInterval(() => {
      this.evictIdleConnections();
      this.evictExpiredConnections();
      this.backfillConnections();
    }, this.options.evictionRunInterval);

    // Don't keep process alive
    if (this.evictionTimer.unref) {
      this.evictionTimer.unref();
    }
  }

  /**
   * Stop eviction timer
   */
  private stopEvictionTimer(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = undefined;
    }
  }

  /**
   * Evict idle connections
   */
  private evictIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: Connection[] = [];

    for (const [conn, metadata] of this.connections.entries()) {
      // Only evict available connections
      if (!this.availableConnections.includes(conn)) {
        continue;
      }

      // Check if idle too long
      if (now - metadata.lastUsedAt > this.options.idleTimeout) {
        // Keep at least min connections
        if (this.connections.size - connectionsToRemove.length > this.options.min) {
          connectionsToRemove.push(conn);
        }
      }
    }

    for (const conn of connectionsToRemove) {
      this.removeConnection(conn);
    }
  }

  /**
   * Evict expired connections
   */
  private evictExpiredConnections(): void {
    const now = Date.now();
    const connectionsToRemove: Connection[] = [];

    for (const [conn, metadata] of this.connections.entries()) {
      // Only evict available connections
      if (!this.availableConnections.includes(conn)) {
        continue;
      }

      // Check if too old
      if (now - metadata.createdAt > this.options.connectionTimeout) {
        connectionsToRemove.push(conn);
      }
    }

    for (const conn of connectionsToRemove) {
      this.removeConnection(conn);
    }
  }

  /**
   * Backfill connections to reach min size
   */
  private backfillConnections(): void {
    if (this.options.min === 0) {
      return;
    }

    const deficit = this.options.min - this.connections.size;
    if (deficit > 0) {
      for (let i = 0; i < deficit; i++) {
        this.createConnection()
          .then(conn => {
            if (!this.closed && !this.closing) {
              this.availableConnections.push(conn);
            } else {
              conn.close().catch(() => {});
            }
          })
          .catch(err => {
            // Ignore errors during backfill
          });
      }
    }
  }
}

/**
 * Create a new connection pool
 */
export function createPool(options: PoolOptions): Pool {
  return new Pool(options);
}
