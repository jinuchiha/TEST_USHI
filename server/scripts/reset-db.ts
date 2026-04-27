// @ts-nocheck
// Drops all tables in current DB so synchronize can re-create them fresh.
// Run: npx ts-node --transpile-only scripts/reset-db.ts

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '26257', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
    query_timeout: 60000,
  });

  try {
    console.log(`Connecting to ${process.env.DB_NAME}...`);
    await client.connect();
    console.log('Connected.\n');

    // List all tables in public schema
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (res.rows.length === 0) {
      console.log('✓ No tables to drop. Database is already clean.');
      return;
    }

    console.log(`Found ${res.rows.length} tables:`);
    res.rows.forEach(r => console.log(' -', r.table_name));

    console.log('\nDropping all tables (CASCADE)...');
    const tableNames = res.rows.map(r => `"${r.table_name}"`).join(', ');
    await client.query(`DROP TABLE IF EXISTS ${tableNames} CASCADE`);
    console.log('✓ All tables dropped.\n');

    // Verify
    const verify = await client.query(`
      SELECT count(*) AS cnt FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    console.log(`Tables remaining: ${verify.rows[0].cnt}`);
    console.log('\n✓ Ready. Now restart backend (npm run start:dev) — synchronize will create fresh tables.');
  } catch (err) {
    console.error('\n✗ Failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
