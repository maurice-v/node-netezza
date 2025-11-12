/**
 * Protocol constants and message types for IBM Netezza
 */

// Connection Protocol Versions
export const CP_VERSION_1 = 1;
export const CP_VERSION_2 = 2;
export const CP_VERSION_3 = 3;
export const CP_VERSION_4 = 4;
export const CP_VERSION_5 = 5;
export const CP_VERSION_6 = 6;

// Handshake version opcodes
export const HSV2_INVALID_OPCODE = 0;
export const HSV2_CLIENT_BEGIN = 1;
export const HSV2_DB = 2;
export const HSV2_USER = 3;
export const HSV2_OPTIONS = 4;
export const HSV2_TTY = 5;
export const HSV2_REMOTE_PID = 6;
export const HSV2_PRIOR_PID = 7;
export const HSV2_CLIENT_TYPE = 8;
export const HSV2_PROTOCOL = 9;
export const HSV2_HOSTCASE = 10;
export const HSV2_SSL_NEGOTIATE = 11;
export const HSV2_SSL_CONNECT = 12;
export const HSV2_APPNAME = 13;
export const HSV2_CLIENT_OS = 14;
export const HSV2_CLIENT_HOST_NAME = 15;
export const HSV2_CLIENT_OS_USER = 16;
export const HSV2_64BIT_VARLENA_ENABLED = 17;
export const HSV2_CLIENT_DONE = 1000;

// PostgreSQL Protocol versions
export const PG_PROTOCOL_3 = 3;
export const PG_PROTOCOL_4 = 4;
export const PG_PROTOCOL_5 = 5;

// Authentication types
export const AUTH_REQ_OK = 0;
export const AUTH_REQ_KRB4 = 1;
export const AUTH_REQ_KRB5 = 2;
export const AUTH_REQ_PASSWORD = 3;
export const AUTH_REQ_CRYPT = 4;
export const AUTH_REQ_MD5 = 5;
export const AUTH_REQ_SHA256 = 6;

// Client types
export const NPS_CLIENT = 0;
export const IPS_CLIENT = 1;
export const NPSCLIENT_TYPE_NODEJS = 14; // Custom type for Node.js

// Message types (backend to frontend)
export const MESSAGE_TYPE_AUTHENTICATION = 'R'.charCodeAt(0);
export const MESSAGE_TYPE_BACKEND_KEY_DATA = 'K'.charCodeAt(0);
export const MESSAGE_TYPE_BIND_COMPLETE = '2'.charCodeAt(0);
export const MESSAGE_TYPE_CLOSE_COMPLETE = '3'.charCodeAt(0);
export const MESSAGE_TYPE_COMMAND_COMPLETE = 'C'.charCodeAt(0);
export const MESSAGE_TYPE_DATA_ROW = 'D'.charCodeAt(0);
export const MESSAGE_TYPE_EMPTY_QUERY = 'I'.charCodeAt(0);
export const MESSAGE_TYPE_ERROR_RESPONSE = 'E'.charCodeAt(0);
export const MESSAGE_TYPE_NO_DATA = 'n'.charCodeAt(0);
export const MESSAGE_TYPE_NOTICE_RESPONSE = 'N'.charCodeAt(0);
export const MESSAGE_TYPE_NOTIFICATION = 'A'.charCodeAt(0);
export const MESSAGE_TYPE_PARAMETER_STATUS = 'S'.charCodeAt(0);
export const MESSAGE_TYPE_PARSE_COMPLETE = '1'.charCodeAt(0);
export const MESSAGE_TYPE_PORTAL_SUSPENDED = 's'.charCodeAt(0);
export const MESSAGE_TYPE_READY_FOR_QUERY = 'Z'.charCodeAt(0);
export const MESSAGE_TYPE_ROW_DESCRIPTION = 'T'.charCodeAt(0);

// Message types (frontend to backend)
export const MESSAGE_TYPE_BIND = 'B'.charCodeAt(0);
export const MESSAGE_TYPE_CLOSE = 'C'.charCodeAt(0);
export const MESSAGE_TYPE_DESCRIBE = 'D'.charCodeAt(0);
export const MESSAGE_TYPE_EXECUTE = 'E'.charCodeAt(0);
export const MESSAGE_TYPE_FLUSH = 'H'.charCodeAt(0);
export const MESSAGE_TYPE_PARSE = 'P'.charCodeAt(0);
export const MESSAGE_TYPE_QUERY = 'Q'.charCodeAt(0);
export const MESSAGE_TYPE_SYNC = 'S'.charCodeAt(0);
export const MESSAGE_TYPE_TERMINATE = 'X'.charCodeAt(0);

// Transaction status
export const TRANSACTION_STATUS_IDLE = 'I'.charCodeAt(0);
export const TRANSACTION_STATUS_IN_BLOCK = 'T'.charCodeAt(0);
export const TRANSACTION_STATUS_FAILED = 'E'.charCodeAt(0);
