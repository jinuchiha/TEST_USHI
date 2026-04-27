// @ts-nocheck
// One-time script to create the recovery_crm database
// Run: npx ts-node --transpile-only scripts/create-db.ts

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  // Connect to defaultdb (always exists)
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '26257', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
    query_timeout: 60000,
  });

  try {
    console.log('Connecting to CockroachDB...');
    await client.connect();
    console.log('Connected.');

    // Check if recovery_crm already exists
    const check = await client.query("SELECT 1 FROM pg_database WHERE datname = 'recovery_crm'");
    if (check.rows.length > 0) {
      console.log('✓ recovery_crm database already exists.');
      return;
    }

    console.log('Creating database recovery_crm...');
    await client.query('CREATE DATABASE recovery_crm');
    console.log('✓ Database recovery_crm created successfully.');
  } catch (err: any) {
    console.error('✗ Failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
