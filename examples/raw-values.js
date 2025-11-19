/**
 * Raw values example - avoiding overflow and timezone issues
 */

const { connect } = require('../dist/index');
const config = require('./config');

async function rawValuesExample() {
  // Without raw values (default behavior)
  console.log('=== Without Raw Values ===');
  const conn1 = await connect(config);

  try {
    const result1 = await conn1.execute(`
      SELECT
        9223372036854775807 as max_bigint,
        9007199254740992 as overflow_value,
        TIMESTAMP '2024-11-16 10:30:00' as created_at,
        DATE '2024-11-16' as event_date,
        123.456789012345 as precise_number
    `);

    console.log('Default conversion:');
    console.log('max_bigint:', result1.rows[0].max_bigint);
    console.log('  (loses precision, becomes:', result1.rows[0].max_bigint, ')');
    console.log('overflow_value:', result1.rows[0].overflow_value);
    console.log('  (2^53, beyond safe integer)');
    console.log('created_at:', result1.rows[0].created_at);
    console.log('  (Date object, may have timezone conversion)');
    console.log('event_date:', result1.rows[0].event_date);
    console.log('precise_number:', result1.rows[0].precise_number);
    console.log('  (may lose precision as float)');

  } finally {
    await conn1.close();
  }

  console.log('\n=== With Raw Values ===');

  // With raw values
  const conn2 = await connect({
    ...config,
    rawTypes: {
      bigint: true,
      timestamp: true,
      date: true,
      numeric: true
    }
  });

  try {
    const result2 = await conn2.execute(`
      SELECT
        9223372036854775807 as max_bigint,
        9007199254740992 as overflow_value,
        TIMESTAMP '2024-11-16 10:30:00' as created_at,
        DATE '2024-11-16' as event_date,
        123.456789012345 as precise_number
    `);

    console.log('Raw string values:');
    console.log('max_bigint:', result2.rows[0].max_bigint);
    console.log('  (exact string: "9223372036854775807")');
    console.log('overflow_value:', result2.rows[0].overflow_value);
    console.log('  (exact string: "9007199254740992")');
    console.log('created_at:', result2.rows[0].created_at);
    console.log('  (exact string from DB, no timezone conversion)');
    console.log('event_date:', result2.rows[0].event_date);
    console.log('  (exact string: "2024-11-16")');
    console.log('precise_number:', result2.rows[0].precise_number);
    console.log('  (exact decimal string, no precision loss)');

    console.log('\n=== Use Cases ===');
    console.log('✓ Use raw values when:');
    console.log('  - Working with BIGINT values > 2^53');
    console.log('  - Need exact decimal precision');
    console.log('  - Want to preserve original date/time format');
    console.log('  - Avoiding timezone conversions');
    console.log('  - Passing values to other systems as-is');

  } finally {
    await conn2.close();
  }
}

rawValuesExample().catch(console.error);
