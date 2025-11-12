/**
 * Error types for node-netezza
 */

export class NzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NzError';
  }
}

export class InterfaceError extends NzError {
  constructor(message: string) {
    super(message);
    this.name = 'InterfaceError';
  }
}

export class DatabaseError extends NzError {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class OperationalError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = 'OperationalError';
  }
}

export class IntegrityError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}

export class InternalError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = 'InternalError';
  }
}

export class ProgrammingError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = 'ProgrammingError';
  }
}

export class NotSupportedError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = 'NotSupportedError';
  }
}

export class ConnectionClosedError extends InterfaceError {
  constructor(message: string = 'Connection is closed') {
    super(message);
    this.name = 'ConnectionClosedError';
  }
}
