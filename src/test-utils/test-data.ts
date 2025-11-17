import { FieldDescription } from '../connection';

/**
 * Test data fixtures for unit tests
 */

/**
 * Sample connection options
 */
export const testConnectionOptions = {
  user: 'testuser',
  password: 'testpass',
  host: 'localhost',
  port: 5480,
  database: 'testdb',
  securityLevel: 0,
  debug: false
};

/**
 * Sample field descriptions
 */
export const sampleFields: FieldDescription[] = [
  {
    name: 'id',
    tableOid: 0,
    columnNumber: 0,
    typeOid: 23, // INTEGER
    typeSize: 4,
    typeMod: -1,
    formatCode: 0
  },
  {
    name: 'name',
    tableOid: 0,
    columnNumber: 1,
    typeOid: 1043, // VARCHAR
    typeSize: -1,
    typeMod: 54,
    formatCode: 0
  },
  {
    name: 'amount',
    tableOid: 0,
    columnNumber: 2,
    typeOid: 701, // FLOAT8
    typeSize: 8,
    typeMod: -1,
    formatCode: 0
  },
  {
    name: 'created_at',
    tableOid: 0,
    columnNumber: 3,
    typeOid: 1114, // TIMESTAMP
    typeSize: 8,
    typeMod: -1,
    formatCode: 0
  }
];

/**
 * Sample field descriptions for BIGINT test
 */
export const bigintFields: FieldDescription[] = [
  {
    name: 'big_id',
    tableOid: 0,
    columnNumber: 0,
    typeOid: 20, // BIGINT
    typeSize: 8,
    typeMod: -1,
    formatCode: 0
  }
];

/**
 * Create a Netezza data row buffer with bitmap
 */
export function createDataRowBuffer(values: (string | null)[]): Buffer {
  const columnCount = values.length;
  const bitmapLen = Math.ceil(columnCount / 8);

  // Create bitmap
  const bitmap = Buffer.alloc(bitmapLen);
  for (let i = 0; i < columnCount; i++) {
    if (values[i] !== null) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = 7 - (i % 8);
      bitmap[byteIndex] |= (1 << bitIndex);
    }
  }

  // Create value buffers
  const valueBuffers: Buffer[] = [];
  for (const value of values) {
    if (value !== null) {
      const valueData = Buffer.from(value, 'utf8');
      const lengthBuf = Buffer.alloc(4);
      lengthBuf.writeInt32BE(valueData.length + 4, 0);
      valueBuffers.push(Buffer.concat([lengthBuf, valueData]));
    }
  }

  return Buffer.concat([bitmap, ...valueBuffers]);
}

/**
 * Create a Netezza row description buffer
 */
export function createRowDescriptionBuffer(fields: FieldDescription[]): Buffer {
  const buffers: Buffer[] = [];

  // Field count (2 bytes)
  const countBuf = Buffer.alloc(2);
  countBuf.writeInt16BE(fields.length, 0);
  buffers.push(countBuf);

  // Each field
  for (const field of fields) {
    // Name (null-terminated string)
    buffers.push(Buffer.from(field.name + '\0', 'utf8'));

    // Type OID (4 bytes)
    const oidBuf = Buffer.alloc(4);
    oidBuf.writeInt32BE(field.typeOid, 0);
    buffers.push(oidBuf);

    // Type size (2 bytes)
    const sizeBuf = Buffer.alloc(2);
    sizeBuf.writeInt16BE(field.typeSize, 0);
    buffers.push(sizeBuf);

    // Type modifier (4 bytes)
    const modBuf = Buffer.alloc(4);
    modBuf.writeInt32BE(field.typeMod, 0);
    buffers.push(modBuf);

    // Format code (1 byte)
    const formatBuf = Buffer.alloc(1);
    formatBuf.writeUInt8(field.formatCode, 0);
    buffers.push(formatBuf);
  }

  return Buffer.concat(buffers);
}

/**
 * Sample test values
 */
export const testValues = {
  integer: '42',
  bigint: '9223372036854775807', // Max BIGINT value
  bigintOverflow: '9007199254740992', // Beyond JS safe integer
  varchar: 'Test String',
  float: '123.45',
  timestamp: '2024-11-16 10:30:00',
  date: '2024-11-16',
  boolean: 't'
};

/**
 * Create a complete Netezza protocol message
 */
export function createProtocolMessage(messageType: number, data: Buffer): Buffer {
  const message = Buffer.alloc(9 + data.length);
  let offset = 0;

  message[offset++] = messageType;
  message.writeInt32BE(0, offset); // unused
  offset += 4;
  message.writeInt32BE(data.length, offset); // length
  offset += 4;
  data.copy(message, offset);

  return message;
}
