import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const useSsl = process.env.DB_SSL === 'true';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'defaultdb',
  username: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'crm_local_pass',
  synchronize: false,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  extra: useSsl ? { ssl: { rejectUnauthorized: false } } : {},
});

async function seed() {
  await AppDataSource.initialize();
  console.log('Connected to database');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Create users — RecoVantage real team
    // Each user has password = `<emailPrefix>123` — e.g. aleena@recovantage.com → aleena123
    const users = [
      { name: 'Admin', email: 'admin@recovantage.com', password: 'admin123', role: 'Admin', agent_code: null, target: null, daily_target: null },
      { name: 'Manager', email: 'manager@recovantage.com', password: 'manager123', role: 'Manager', agent_code: null, target: null, daily_target: null },
      { name: 'CEO', email: 'ceo@recovantage.com', password: 'ceo123', role: 'CEO', agent_code: null, target: null, daily_target: null },
      { name: 'Aleena', email: 'aleena@recovantage.com', password: 'aleena123', role: 'Officer', agent_code: 'AM', target: 30000, daily_target: 1500 },
      { name: 'Hirra', email: 'hirra@recovantage.com', password: 'hirra123', role: 'Officer', agent_code: 'HI', target: 30000, daily_target: 1500 },
      { name: 'Mehar', email: 'mehar@recovantage.com', password: 'mehar123', role: 'Officer', agent_code: 'MB', target: 30000, daily_target: 1500 },
      { name: 'Gulaly', email: 'gulaly@recovantage.com', password: 'gulaly123', role: 'Officer', agent_code: 'GS', target: 30000, daily_target: 1500 },
      { name: 'Mahreen', email: 'mahreen@recovantage.com', password: 'mahreen123', role: 'Officer', agent_code: 'MG', target: 30000, daily_target: 1500 },
      { name: 'Finance', email: 'finance@recovantage.com', password: 'finance123', role: 'Accountant', agent_code: null, target: null, daily_target: null },
    ];

    const userIds: string[] = [];
    for (const u of users) {
      const passwordHash = await bcrypt.hash(u.password, 12);
      const result = await queryRunner.query(
        `INSERT INTO users (name, email, "passwordHash", role, "agentCode", target, "dailyTarget")
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [u.name, u.email, passwordHash, u.role, u.agent_code, u.target, u.daily_target],
      );
      userIds.push(result[0].id);
    }

    console.log(`Created ${users.length} users`);
    console.log('No dummy debtors / loans / cases — use CSV import to load real data.');

    await queryRunner.commitTransaction();
    console.log('\nSeed completed successfully!');
    console.log('\nLogin credentials (password = name + 123):');
    users.forEach(u => console.log(`  ${u.email.padEnd(35)} → ${u.password}`));
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
