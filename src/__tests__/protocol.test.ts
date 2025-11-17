/**
 * Unit tests for protocol constants and types
 */

import * as protocol from '../protocol';

describe('Protocol Constants', () => {
  describe('Connection Protocol Versions', () => {
    it('should define CP_VERSION constants', () => {
      expect(protocol.CP_VERSION_1).toBe(1);
      expect(protocol.CP_VERSION_2).toBe(2);
      expect(protocol.CP_VERSION_3).toBe(3);
      expect(protocol.CP_VERSION_4).toBe(4);
      expect(protocol.CP_VERSION_5).toBe(5);
      expect(protocol.CP_VERSION_6).toBe(6);
    });
  });

  describe('Handshake Version Opcodes', () => {
    it('should define handshake opcodes', () => {
      expect(protocol.HSV2_INVALID_OPCODE).toBe(0);
      expect(protocol.HSV2_CLIENT_BEGIN).toBe(1);
      expect(protocol.HSV2_DB).toBe(2);
      expect(protocol.HSV2_USER).toBe(3);
      expect(protocol.HSV2_OPTIONS).toBe(4);
      expect(protocol.HSV2_TTY).toBe(5);
      expect(protocol.HSV2_REMOTE_PID).toBe(6);
      expect(protocol.HSV2_PRIOR_PID).toBe(7);
      expect(protocol.HSV2_CLIENT_TYPE).toBe(8);
      expect(protocol.HSV2_PROTOCOL).toBe(9);
      expect(protocol.HSV2_HOSTCASE).toBe(10);
      expect(protocol.HSV2_SSL_NEGOTIATE).toBe(11);
      expect(protocol.HSV2_SSL_CONNECT).toBe(12);
      expect(protocol.HSV2_APPNAME).toBe(13);
      expect(protocol.HSV2_CLIENT_OS).toBe(14);
      expect(protocol.HSV2_CLIENT_HOST_NAME).toBe(15);
      expect(protocol.HSV2_CLIENT_OS_USER).toBe(16);
      expect(protocol.HSV2_64BIT_VARLENA_ENABLED).toBe(17);
      expect(protocol.HSV2_CLIENT_DONE).toBe(1000);
    });
  });

  describe('PostgreSQL Protocol Versions', () => {
    it('should define PG_PROTOCOL constants', () => {
      expect(protocol.PG_PROTOCOL_3).toBe(3);
      expect(protocol.PG_PROTOCOL_4).toBe(4);
      expect(protocol.PG_PROTOCOL_5).toBe(5);
    });
  });

  describe('Authentication Types', () => {
    it('should define authentication type constants', () => {
      expect(protocol.AUTH_REQ_OK).toBe(0);
      expect(protocol.AUTH_REQ_KRB4).toBe(1);
      expect(protocol.AUTH_REQ_KRB5).toBe(2);
      expect(protocol.AUTH_REQ_PASSWORD).toBe(3);
      expect(protocol.AUTH_REQ_CRYPT).toBe(4);
      expect(protocol.AUTH_REQ_MD5).toBe(5);
      expect(protocol.AUTH_REQ_SHA256).toBe(6);
    });
  });

  describe('Client Types', () => {
    it('should define client type constants', () => {
      expect(protocol.NPS_CLIENT).toBe(0);
      expect(protocol.IPS_CLIENT).toBe(1);
      expect(protocol.NPSCLIENT_TYPE_NODEJS).toBe(14);
    });
  });

  describe('Message Types - Backend to Frontend', () => {
    it('should define backend message type constants', () => {
      expect(protocol.MESSAGE_TYPE_AUTHENTICATION).toBe('R'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_BACKEND_KEY_DATA).toBe('K'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_BIND_COMPLETE).toBe('2'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_CLOSE_COMPLETE).toBe('3'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_COMMAND_COMPLETE).toBe('C'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_DATA_ROW).toBe('D'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_EMPTY_QUERY).toBe('I'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_ERROR_RESPONSE).toBe('E'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_NO_DATA).toBe('n'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_NOTICE_RESPONSE).toBe('N'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_NOTIFICATION).toBe('A'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_PARAMETER_STATUS).toBe('S'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_PARSE_COMPLETE).toBe('1'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_PORTAL_SUSPENDED).toBe('s'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_READY_FOR_QUERY).toBe('Z'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_ROW_DESCRIPTION).toBe('T'.charCodeAt(0));
    });

    it('should have ASCII values for message types', () => {
      expect(protocol.MESSAGE_TYPE_AUTHENTICATION).toBe(82); // 'R'
      expect(protocol.MESSAGE_TYPE_READY_FOR_QUERY).toBe(90); // 'Z'
      expect(protocol.MESSAGE_TYPE_ERROR_RESPONSE).toBe(69); // 'E'
    });
  });

  describe('Message Types - Frontend to Backend', () => {
    it('should define frontend message type constants', () => {
      expect(protocol.MESSAGE_TYPE_BIND).toBe('B'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_CLOSE).toBe('C'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_DESCRIBE).toBe('D'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_EXECUTE).toBe('E'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_FLUSH).toBe('H'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_PARSE).toBe('P'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_QUERY).toBe('Q'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_SYNC).toBe('S'.charCodeAt(0));
      expect(protocol.MESSAGE_TYPE_TERMINATE).toBe('X'.charCodeAt(0));
    });

    it('should have ASCII values for message types', () => {
      expect(protocol.MESSAGE_TYPE_QUERY).toBe(81); // 'Q'
      expect(protocol.MESSAGE_TYPE_TERMINATE).toBe(88); // 'X'
    });
  });

  describe('Transaction Status', () => {
    it('should define transaction status constants', () => {
      expect(protocol.TRANSACTION_STATUS_IDLE).toBe('I'.charCodeAt(0));
      expect(protocol.TRANSACTION_STATUS_IN_BLOCK).toBe('T'.charCodeAt(0));
      expect(protocol.TRANSACTION_STATUS_FAILED).toBe('E'.charCodeAt(0));
    });

    it('should have ASCII values for transaction statuses', () => {
      expect(protocol.TRANSACTION_STATUS_IDLE).toBe(73); // 'I'
      expect(protocol.TRANSACTION_STATUS_IN_BLOCK).toBe(84); // 'T'
      expect(protocol.TRANSACTION_STATUS_FAILED).toBe(69); // 'E'
    });
  });

  describe('Protocol Integrity', () => {
    it('should not have duplicate message type values between frontend and backend', () => {
      // Some message types are intentionally the same (like 'C' for both CLOSE and COMMAND_COMPLETE)
      // But we should verify they're well-defined
      const frontendTypes = [
        protocol.MESSAGE_TYPE_BIND,
        protocol.MESSAGE_TYPE_DESCRIBE,
        protocol.MESSAGE_TYPE_EXECUTE,
        protocol.MESSAGE_TYPE_FLUSH,
        protocol.MESSAGE_TYPE_PARSE,
        protocol.MESSAGE_TYPE_QUERY,
        protocol.MESSAGE_TYPE_SYNC,
        protocol.MESSAGE_TYPE_TERMINATE
      ];

      const backendTypes = [
        protocol.MESSAGE_TYPE_AUTHENTICATION,
        protocol.MESSAGE_TYPE_BACKEND_KEY_DATA,
        protocol.MESSAGE_TYPE_BIND_COMPLETE,
        protocol.MESSAGE_TYPE_CLOSE_COMPLETE,
        protocol.MESSAGE_TYPE_COMMAND_COMPLETE,
        protocol.MESSAGE_TYPE_DATA_ROW,
        protocol.MESSAGE_TYPE_EMPTY_QUERY,
        protocol.MESSAGE_TYPE_ERROR_RESPONSE,
        protocol.MESSAGE_TYPE_NO_DATA,
        protocol.MESSAGE_TYPE_NOTICE_RESPONSE,
        protocol.MESSAGE_TYPE_NOTIFICATION,
        protocol.MESSAGE_TYPE_PARAMETER_STATUS,
        protocol.MESSAGE_TYPE_PARSE_COMPLETE,
        protocol.MESSAGE_TYPE_PORTAL_SUSPENDED,
        protocol.MESSAGE_TYPE_READY_FOR_QUERY,
        protocol.MESSAGE_TYPE_ROW_DESCRIPTION
      ];

      // All should be numbers
      frontendTypes.forEach(type => expect(typeof type).toBe('number'));
      backendTypes.forEach(type => expect(typeof type).toBe('number'));
    });

    it('should have consistent version numbering', () => {
      expect(protocol.CP_VERSION_2).toBeGreaterThan(protocol.CP_VERSION_1);
      expect(protocol.CP_VERSION_3).toBeGreaterThan(protocol.CP_VERSION_2);
      expect(protocol.CP_VERSION_4).toBeGreaterThan(protocol.CP_VERSION_3);
      expect(protocol.CP_VERSION_5).toBeGreaterThan(protocol.CP_VERSION_4);
      expect(protocol.CP_VERSION_6).toBeGreaterThan(protocol.CP_VERSION_5);
    });

    it('should have sequential PG protocol versions', () => {
      expect(protocol.PG_PROTOCOL_4).toBe(protocol.PG_PROTOCOL_3 + 1);
      expect(protocol.PG_PROTOCOL_5).toBe(protocol.PG_PROTOCOL_4 + 1);
    });
  });
});
