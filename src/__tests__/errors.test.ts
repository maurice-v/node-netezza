/**
 * Unit tests for error classes
 */

import {
  InterfaceError,
  OperationalError,
  DatabaseError,
  ProgrammingError,
  ConnectionClosedError
} from '../errors';

describe('Error Classes', () => {
  describe('InterfaceError', () => {
    it('should create an InterfaceError instance', () => {
      const error = new InterfaceError('Test interface error');
      expect(error).toBeInstanceOf(InterfaceError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test interface error');
      expect(error.name).toBe('InterfaceError');
    });

    it('should have a stack trace', () => {
      const error = new InterfaceError('Stack test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('InterfaceError');
    });

    it('should be catchable as Error', () => {
      try {
        throw new InterfaceError('Catchable error');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(InterfaceError);
        if (err instanceof InterfaceError) {
          expect(err.message).toBe('Catchable error');
        }
      }
    });
  });

  describe('OperationalError', () => {
    it('should create an OperationalError instance', () => {
      const error = new OperationalError('Test operational error');
      expect(error).toBeInstanceOf(OperationalError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test operational error');
      expect(error.name).toBe('OperationalError');
    });

    it('should handle connection errors', () => {
      const error = new OperationalError('Connection timeout');
      expect(error.message).toContain('timeout');
    });

    it('should handle authentication errors', () => {
      const error = new OperationalError('Authentication failed');
      expect(error.message).toContain('Authentication');
    });
  });

  describe('DatabaseError', () => {
    it('should create a DatabaseError instance', () => {
      const error = new DatabaseError('Test database error');
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test database error');
      expect(error.name).toBe('DatabaseError');
    });

    it('should handle SQL syntax errors', () => {
      const error = new DatabaseError('Syntax error at position 15');
      expect(error.message).toContain('Syntax error');
    });

    it('should handle table not found errors', () => {
      const error = new DatabaseError('Table "users" does not exist');
      expect(error.message).toContain('does not exist');
    });
  });

  describe('ProgrammingError', () => {
    it('should create a ProgrammingError instance', () => {
      const error = new ProgrammingError('Test programming error');
      expect(error).toBeInstanceOf(ProgrammingError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test programming error');
      expect(error.name).toBe('ProgrammingError');
    });

    it('should handle invalid parameter errors', () => {
      const error = new ProgrammingError('Invalid parameter type');
      expect(error.message).toContain('Invalid parameter');
    });
  });

  describe('ConnectionClosedError', () => {
    it('should create a ConnectionClosedError instance with default message', () => {
      const error = new ConnectionClosedError();
      expect(error).toBeInstanceOf(ConnectionClosedError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Connection is closed');
      expect(error.name).toBe('ConnectionClosedError');
    });

    it('should create a ConnectionClosedError instance with custom message', () => {
      const error = new ConnectionClosedError('Connection closed by server');
      expect(error).toBeInstanceOf(ConnectionClosedError);
      expect(error.message).toBe('Connection closed by server');
    });

    it('should be distinguishable from OperationalError', () => {
      const closedError = new ConnectionClosedError();
      const opError = new OperationalError('Connection error');

      expect(closedError).toBeInstanceOf(ConnectionClosedError);
      expect(closedError).not.toBeInstanceOf(OperationalError);
      expect(opError).toBeInstanceOf(OperationalError);
      expect(opError).not.toBeInstanceOf(ConnectionClosedError);
    });
  });

  describe('Error Inheritance', () => {
    it('should maintain proper inheritance chain', () => {
      const errors = [
        new InterfaceError('test'),
        new OperationalError('test'),
        new DatabaseError('test'),
        new ProgrammingError('test'),
        new ConnectionClosedError('test')
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeDefined();
        expect(error.name).toBeDefined();
        expect(error.stack).toBeDefined();
      });
    });

    it('should maintain proper inheritance relationships', () => {
      const interfaceError = new InterfaceError('test');
      const operationalError = new OperationalError('test');
      const databaseError = new DatabaseError('test');

      // InterfaceError should not be a DatabaseError or OperationalError
      expect(interfaceError).not.toBeInstanceOf(OperationalError);
      expect(interfaceError).not.toBeInstanceOf(DatabaseError);

      // OperationalError IS a DatabaseError (extends DatabaseError)
      expect(operationalError).toBeInstanceOf(DatabaseError);
      expect(operationalError).not.toBeInstanceOf(InterfaceError);

      // DatabaseError should not be InterfaceError or OperationalError
      expect(databaseError).not.toBeInstanceOf(InterfaceError);
      expect(databaseError).not.toBeInstanceOf(OperationalError);
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should allow instanceof checks in catch blocks', () => {
      const throwError = (type: string) => {
        switch (type) {
          case 'interface':
            throw new InterfaceError('Interface issue');
          case 'operational':
            throw new OperationalError('Operational issue');
          case 'database':
            throw new DatabaseError('Database issue');
          case 'programming':
            throw new ProgrammingError('Programming issue');
          case 'closed':
            throw new ConnectionClosedError('Connection closed');
          default:
            throw new Error('Generic error');
        }
      };

      try {
        throwError('interface');
      } catch (err) {
        expect(err).toBeInstanceOf(InterfaceError);
      }

      try {
        throwError('operational');
      } catch (err) {
        expect(err).toBeInstanceOf(OperationalError);
      }

      try {
        throwError('database');
      } catch (err) {
        expect(err).toBeInstanceOf(DatabaseError);
      }

      try {
        throwError('programming');
      } catch (err) {
        expect(err).toBeInstanceOf(ProgrammingError);
      }

      try {
        throwError('closed');
      } catch (err) {
        expect(err).toBeInstanceOf(ConnectionClosedError);
      }
    });

    it('should preserve error messages through the chain', () => {
      const messages = [
        'Specific interface error',
        'Specific operational error',
        'Specific database error',
        'Specific programming error',
        'Specific connection closed error'
      ];

      const errors = [
        new InterfaceError(messages[0]),
        new OperationalError(messages[1]),
        new DatabaseError(messages[2]),
        new ProgrammingError(messages[3]),
        new ConnectionClosedError(messages[4])
      ];

      errors.forEach((error, index) => {
        expect(error.message).toBe(messages[index]);
      });
    });
  });
});
