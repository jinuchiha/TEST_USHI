import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DB_SSL === 'true';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'defaultdb',
  username: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'crm_local_pass',
  entities: ['src/modules/**/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  extra: useSsl ? { ssl: { rejectUnauthorized: false } } : {},
});
