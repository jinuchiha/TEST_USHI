// @ts-nocheck
// Diagnostic: shows which DB you're on, table count, user count
// Run: npx ts-node --transpile-only scripts/check-db.ts

const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  console.log('\n━━━ Connection Info ━━━');
  console.log('Host:', process.env.DB_HOST);
  console.log('Database:', process.env.DB_NAME);
  console.log('User:', process.env.DB_USER);
  console.log('SSL:', process.env.DB_SSL);

  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '26257', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30000,
  });

  try {
    await client.connect();
    console.log('\n✓ Connected to', process.env.DB_NAME);

    // List databases
    const dbs = await client.query("SELECT datname FROM pg_database WHERE datname NOT IN ('system', 'postgres') ORDER BY datname");
    console.log('\n━━━ Available Databases ━━━');
    dbs.rows.forEach(r => console.log(' -', r.datname));

    // Tables in current DB
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log(`\n━━━ Tables in ${process.env.DB_NAME} (${tables.rows.length}) ━━━`);
    tables.rows.forEach(r => console.log(' -', r.table_name));

    // User count + emails (if users table exists)
    const usersTable = tables.rows.find(r => r.table_name === 'users');
    if (usersTable) {
      const users = await client.query('SELECT email, role, name FROM users ORDER BY email');
      console.log(`\n━━━ Users in this DB (${users.rows.length}) ━━━`);
      if (users.rows.length === 0) {
        console.log(' ⚠️  NO USERS — seed has not run yet. Run: npm run seed');
      } else {
        users.rows.forEach(u => console.log(` - ${u.email} (${u.role}) — ${u.name}`));
      }
    } else {
      console.log('\n⚠️  No "users" table — backend has not created tables yet.');
      console.log('   Make sure DB_SYNC=true and restart backend (npm run start:dev).');
    }
  } catch (err) {
    console.error('\n✗ Connection failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
