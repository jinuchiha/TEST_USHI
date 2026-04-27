import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  name: process.env.DB_NAME || 'defaultdb',
  user: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'crm_local_pass',
  ssl: process.env.DB_SSL === 'true',
  // CockroachDB Serverless requires SSL with verify-full or require
  sslMode: process.env.DB_SSL_MODE || 'require',
}));
