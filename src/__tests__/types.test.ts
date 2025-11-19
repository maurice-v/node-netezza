/**
 * Unit tests for type conversion utilities
 */

import {
  bufferToString,
  stringToBuffer,
  bufferToInt,
  bufferToFloat,
  bufferToBoolean,
  bufferToDate,
  bufferToTimestamp,
  getTypeConverter
} from '../types';

describe('Type Conversion Utilities', () => {
  describe('bufferToString', () => {
    it('should convert buffer to UTF-8 string', () => {
      const buffer = Buffer.from('Hello, World!', 'utf8');
      expect(bufferToString(buffer)).toBe('Hello, World!');
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.from('', 'utf8');
      expect(bufferToString(buffer)).toBe('');
    });

    it('should handle unicode characters', () => {
      const buffer = Buffer.from('Hello 世界 🌍', 'utf8');
      expect(bufferToString(buffer)).toBe('Hello 世界 🌍');
    });
  });

  describe('stringToBuffer', () => {
    it('should convert string to UTF-8 buffer', () => {
      const result = stringToBuffer('Test');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('utf8')).toBe('Test');
    });

    it('should handle empty string', () => {
      const result = stringToBuffer('');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });
  });

  describe('bufferToInt', () => {
    it('should convert buffer to integer', () => {
      const buffer = Buffer.from('42', 'utf8');
      expect(bufferToInt(buffer)).toBe(42);
    });

    it('should handle negative integers', () => {
      const buffer = Buffer.from('-123', 'utf8');
      expect(bufferToInt(buffer)).toBe(-123);
    });

    it('should handle zero', () => {
      const buffer = Buffer.from('0', 'utf8');
      expect(bufferToInt(buffer)).toBe(0);
    });

    it('should handle large integers', () => {
      const buffer = Buffer.from('999999999', 'utf8');
      expect(bufferToInt(buffer)).toBe(999999999);
    });
  });

  describe('bufferToFloat', () => {
    it('should convert buffer to float', () => {
      const buffer = Buffer.from('123.45', 'utf8');
      expect(bufferToFloat(buffer)).toBeCloseTo(123.45);
    });

    it('should handle negative floats', () => {
      const buffer = Buffer.from('-99.99', 'utf8');
      expect(bufferToFloat(buffer)).toBeCloseTo(-99.99);
    });

    it('should handle scientific notation', () => {
      const buffer = Buffer.from('1.23e10', 'utf8');
      expect(bufferToFloat(buffer)).toBe(1.23e10);
    });

    it('should handle integers as floats', () => {
      const buffer = Buffer.from('100', 'utf8');
      expect(bufferToFloat(buffer)).toBe(100.0);
    });
  });

  describe('bufferToBoolean', () => {
    it('should convert "t" to true', () => {
      const buffer = Buffer.from('t', 'utf8');
      expect(bufferToBoolean(buffer)).toBe(true);
    });

    it('should convert "true" to true', () => {
      const buffer = Buffer.from('true', 'utf8');
      expect(bufferToBoolean(buffer)).toBe(true);
    });

    it('should convert "1" to true', () => {
      const buffer = Buffer.from('1', 'utf8');
      expect(bufferToBoolean(buffer)).toBe(true);
    });

    it('should convert "f" to false', () => {
      const buffer = Buffer.from('f', 'utf8');
      expect(bufferToBoolean(buffer)).toBe(false);
    });

    it('should convert "false" to false', () => {
      const buffer = Buffer.from('false', 'utf8');
      expect(bufferToBoolean(buffer)).toBe(false);
    });

    it('should convert "0" to false', () => {
      const buffer = Buffer.from('0', 'utf8');
      expect(bufferToBoolean(buffer)).toBe(false);
    });
  });

  describe('bufferToDate', () => {
    it('should convert ISO date string to Date', () => {
      const buffer = Buffer.from('2024-11-16', 'utf8');
      const date = bufferToDate(buffer);
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toContain('2024-11-16');
    });

    it('should handle timestamp strings', () => {
      const buffer = Buffer.from('2024-11-16T10:30:00Z', 'utf8');
      const date = bufferToDate(buffer);
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
    });
  });

  describe('bufferToTimestamp', () => {
    it('should convert timestamp string to Date', () => {
      const buffer = Buffer.from('2024-11-16 10:30:00', 'utf8');
      const date = bufferToTimestamp(buffer);
      expect(date).toBeInstanceOf(Date);
    });

    it('should handle ISO format', () => {
      const buffer = Buffer.from('2024-11-16T10:30:00.000Z', 'utf8');
      const date = bufferToTimestamp(buffer);
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
    });
  });

  describe('getTypeConverter', () => {
    it('should return converter for BIGINT (OID 20)', () => {
      const converter = getTypeConverter(20);
      expect(converter).toBeDefined();
      const buffer = Buffer.from('9223372036854775807', 'utf8');
      const result = converter.decode(buffer);
      expect(typeof result).toBe('number');
    });

    it('should return converter for INTEGER (OID 23)', () => {
      const converter = getTypeConverter(23);
      expect(converter).toBeDefined();
      const buffer = Buffer.from('42', 'utf8');
      expect(converter.decode(buffer)).toBe(42);
    });

    it('should return converter for VARCHAR (OID 1043)', () => {
      const converter = getTypeConverter(1043);
      expect(converter).toBeDefined();
      const buffer = Buffer.from('test string', 'utf8');
      expect(converter.decode(buffer)).toBe('test string');
    });

    it('should return converter for BOOLEAN (OID 16)', () => {
      const converter = getTypeConverter(16);
      expect(converter).toBeDefined();
      const buffer = Buffer.from('t', 'utf8');
      expect(converter.decode(buffer)).toBe(true);
    });

    it('should return converter for TIMESTAMP (OID 1114)', () => {
      const converter = getTypeConverter(1114);
      expect(converter).toBeDefined();
      const buffer = Buffer.from('2024-11-16 10:30:00', 'utf8');
      const result = converter.decode(buffer);
      expect(result).toBeInstanceOf(Date);
    });

    it('should return default string converter for unknown OID', () => {
      const converter = getTypeConverter(99999);
      expect(converter).toBeDefined();
      const buffer = Buffer.from('unknown type', 'utf8');
      expect(converter.decode(buffer)).toBe('unknown type');
    });

    it('should encode number to buffer', () => {
      const converter = getTypeConverter(23); // INTEGER
      const buffer = converter.encode(42);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8')).toBe('42');
    });

    it('should encode boolean to buffer', () => {
      const converter = getTypeConverter(16); // BOOLEAN
      const trueBuffer = converter.encode(true);
      expect(trueBuffer.toString('utf8')).toBe('t');

      const falseBuffer = converter.encode(false);
      expect(falseBuffer.toString('utf8')).toBe('f');
    });
  });

  describe('Type Converter Edge Cases', () => {
    it('should handle BIGINT values beyond JavaScript safe integer', () => {
      const converter = getTypeConverter(20);
      const buffer = Buffer.from('9007199254740992', 'utf8'); // 2^53
      const result = converter.decode(buffer);
      // Note: This will lose precision, which is why we need rawTypes option
      expect(typeof result).toBe('number');
    });

    it('should handle FLOAT8 special values', () => {
      const converter = getTypeConverter(701);

      const infBuffer = Buffer.from('Infinity', 'utf8');
      expect(converter.decode(infBuffer)).toBe(Infinity);

      const negInfBuffer = Buffer.from('-Infinity', 'utf8');
      expect(converter.decode(negInfBuffer)).toBe(-Infinity);

      const nanBuffer = Buffer.from('NaN', 'utf8');
      expect(isNaN(converter.decode(nanBuffer))).toBe(true);
    });

    it('should handle NULL-like values gracefully', () => {
      const converter = getTypeConverter(1043); // VARCHAR
      const emptyBuffer = Buffer.from('', 'utf8');
      expect(converter.decode(emptyBuffer)).toBe('');
    });
  });
});
