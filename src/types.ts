/**
 * Type conversion utilities for Netezza data types
 */

export interface TypeConverter {
  decode: (data: Buffer) => any;
  encode: (value: any) => Buffer;
}

/**
 * Convert buffer to string using UTF-8 encoding
 */
export function bufferToString(buffer: Buffer): string {
  return buffer.toString('utf8');
}

/**
 * Convert string to buffer using UTF-8 encoding
 */
export function stringToBuffer(str: string): Buffer {
  return Buffer.from(str, 'utf8');
}

/**
 * Convert buffer to integer
 */
export function bufferToInt(buffer: Buffer): number {
  const str = bufferToString(buffer);
  return parseInt(str, 10);
}

/**
 * Convert buffer to float
 */
export function bufferToFloat(buffer: Buffer): number {
  const str = bufferToString(buffer);
  return parseFloat(str);
}

/**
 * Convert buffer to boolean
 */
export function bufferToBoolean(buffer: Buffer): boolean {
  const str = bufferToString(buffer);
  return str === 't' || str === 'true' || str === '1';
}

/**
 * Convert buffer to Date
 */
export function bufferToDate(buffer: Buffer): Date {
  const str = bufferToString(buffer);
  return new Date(str);
}

/**
 * Convert buffer to timestamp
 */
export function bufferToTimestamp(buffer: Buffer): Date {
  const str = bufferToString(buffer);
  // Handle Netezza timestamp format
  return new Date(str);
}

/**
 * Default type converters for common Netezza types
 */
export const typeConverters: { [key: number]: TypeConverter } = {
  // INTEGER types
  20: { // BIGINT
    decode: bufferToInt,
    encode: (value: number) => stringToBuffer(value.toString())
  },
  21: { // SMALLINT
    decode: bufferToInt,
    encode: (value: number) => stringToBuffer(value.toString())
  },
  23: { // INTEGER
    decode: bufferToInt,
    encode: (value: number) => stringToBuffer(value.toString())
  },
  
  // NUMERIC types
  700: { // FLOAT4
    decode: bufferToFloat,
    encode: (value: number) => stringToBuffer(value.toString())
  },
  701: { // FLOAT8
    decode: bufferToFloat,
    encode: (value: number) => stringToBuffer(value.toString())
  },
  1700: { // NUMERIC
    decode: bufferToFloat,
    encode: (value: number) => stringToBuffer(value.toString())
  },
  
  // STRING types
  25: { // TEXT
    decode: bufferToString,
    encode: stringToBuffer
  },
  1043: { // VARCHAR
    decode: bufferToString,
    encode: stringToBuffer
  },
  1042: { // CHAR
    decode: bufferToString,
    encode: stringToBuffer
  },
  
  // BOOLEAN
  16: {
    decode: bufferToBoolean,
    encode: (value: boolean) => stringToBuffer(value ? 't' : 'f')
  },
  
  // DATE/TIME types
  1082: { // DATE
    decode: bufferToDate,
    encode: (value: Date) => stringToBuffer(value.toISOString().split('T')[0])
  },
  1083: { // TIME
    decode: bufferToString,
    encode: (value: Date | string) => {
      if (value instanceof Date) {
        return stringToBuffer(value.toISOString().split('T')[1].split('Z')[0]);
      }
      return stringToBuffer(value);
    }
  },
  1114: { // TIMESTAMP
    decode: bufferToTimestamp,
    encode: (value: Date) => stringToBuffer(value.toISOString())
  },
  
  // BYTEA
  17: {
    decode: (buffer: Buffer) => buffer,
    encode: (value: Buffer) => value
  }
};

/**
 * Get converter for a specific type OID
 */
export function getTypeConverter(oid: number): TypeConverter {
  return typeConverters[oid] || {
    decode: bufferToString,
    encode: stringToBuffer
  };
}
