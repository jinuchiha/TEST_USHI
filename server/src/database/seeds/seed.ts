import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'debt_recovery_crm',
  username: process.env.DB_USER || 'crm_user',
  password: process.env.DB_PASSWORD || 'crm_local_pass',
  synchronize: false,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('Connected to database');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const passwordHash = await bcrypt.hash('password123', 12);

    // Create users
    const users = [
      { name: 'Admin User', email: 'admin@crm.com', role: 'Admin', agent_code: null, target: null, daily_target: null },
      { name: 'Sarah Manager', email: 'sarah@crm.com', role: 'Manager', agent_code: null, target: null, daily_target: null },
      { name: 'Ahmed Officer', email: 'ahmed@crm.com', role: 'Officer', agent_code: 'AGT-001', target: 500000, daily_target: 20000 },
      { name: 'Fatima Officer', email: 'fatima@crm.com', role: 'Officer', agent_code: 'AGT-002', target: 450000, daily_target: 18000 },
      { name: 'Ali Officer', email: 'ali@crm.com', role: 'Officer', agent_code: 'AGT-003', target: 400000, daily_target: 16000 },
      { name: 'Bilkish Coordinator', email: 'bilkish@crm.com', role: 'Officer', agent_code: 'AGT-004', target: 350000, daily_target: 14000 },
      { name: 'Finance User', email: 'finance@crm.com', role: 'Accountant', agent_code: null, target: null, daily_target: null },
      { name: 'CEO User', email: 'ceo@crm.com', role: 'CEO', agent_code: null, target: null, daily_target: null },
    ];

    const userIds: string[] = [];
    for (const u of users) {
      const result = await queryRunner.query(
        `INSERT INTO users (name, email, "passwordHash", role, "agentCode", target, "dailyTarget")
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [u.name, u.email, passwordHash, u.role, u.agent_code, u.target, u.daily_target],
      );
      userIds.push(result[0].id);
    }

    console.log(`Created ${users.length} users`);

    // Create debtors
    const debtors = [
      { name: 'Mohammad Khan', emails: ['m.khan@email.com'], phones: ['+971501234567'], address: 'Dubai Marina, Tower 5, Apt 1203', passport: 'AB1234567', cnic: '35201-1234567-8', eid: '784-1990-1234567-1', dob: '1990-05-15' },
      { name: 'Aisha Begum', emails: ['aisha.b@email.com'], phones: ['+971559876543'], address: 'Abu Dhabi, Corniche Road, Building 8', passport: 'CD9876543', cnic: '42101-9876543-2', eid: '784-1985-9876543-2', dob: '1985-11-22' },
      { name: 'Rashid Al-Maktoum', emails: ['r.almaktoum@email.com'], phones: ['+971507654321'], address: 'Sharjah, Al Majaz 3', passport: 'EF5432109', cnic: '31301-5432109-3', eid: '784-1988-5432109-3', dob: '1988-03-10' },
      { name: 'Zainab Hussain', emails: ['z.hussain@email.com'], phones: ['+971521112233'], address: 'Ajman, Al Rashidiya', passport: 'GH1122334', cnic: '36302-1122334-4', eid: '784-1992-1122334-4', dob: '1992-08-05' },
      { name: 'Omar Farooq', emails: ['o.farooq@email.com'], phones: ['+971544455566'], address: 'Ras Al Khaimah, Al Nakheel', passport: 'IJ4455667', cnic: '38403-4455667-5', eid: '784-1987-4455667-5', dob: '1987-01-20' },
    ];

    const debtorIds: string[] = [];
    for (const d of debtors) {
      const result = await queryRunner.query(
        `INSERT INTO debtors (name, emails, phones, address, passport, cnic, eid, dob)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [d.name, d.emails, d.phones, d.address, d.passport, d.cnic, d.eid, d.dob],
      );
      debtorIds.push(result[0].id);
    }

    console.log(`Created ${debtors.length} debtors`);

    // Create loans
    const banks = ['Emirates NBD', 'Abu Dhabi Commercial Bank', 'Dubai Islamic Bank', 'Mashreq Bank', 'RAKBANK'];
    const products = ['Personal Loan', 'Credit Card', 'Auto Loan', 'Mortgage', 'Business Loan'];

    const loanIds: string[] = [];
    for (let i = 0; i < debtorIds.length; i++) {
      const result = await queryRunner.query(
        `INSERT INTO loans ("debtorId", "accountNumber", "originalAmount", "currentBalance", product, bank, "subProduct", bucket, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          debtorIds[i],
          `ACC-${String(2024001 + i)}`,
          50000 + Math.floor(Math.random() * 200000),
          30000 + Math.floor(Math.random() * 150000),
          products[i % products.length],
          banks[i % banks.length],
          'Standard',
          `Bucket ${(i % 3) + 1}`,
          'AED',
        ],
      );
      loanIds.push(result[0].id);
    }

    console.log(`Created ${loanIds.length} loans`);

    // Create cases (assign to officers: userIds[2], userIds[3], userIds[4])
    const crmStatuses = ['CB', 'PTP', 'FIP', 'UNDER NEGO', 'CB'];
    const officerIds = [userIds[2], userIds[3], userIds[4], userIds[2], userIds[3]];

    const caseIds: string[] = [];
    for (let i = 0; i < debtorIds.length; i++) {
      const result = await queryRunner.query(
        `INSERT INTO cases ("debtorId", "loanId", "assignedOfficerId", "crmStatus", "subStatus", "contactStatus", "workStatus")
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          debtorIds[i],
          loanIds[i],
          officerIds[i],
          crmStatuses[i],
          '',
          i % 2 === 0 ? 'Contact' : 'Non Contact',
          i % 3 === 0 ? 'Work' : 'Non Work',
        ],
      );
      caseIds.push(result[0].id);
    }

    console.log(`Created ${caseIds.length} cases`);

    // Create some sample actions
    for (let i = 0; i < caseIds.length; i++) {
      await queryRunner.query(
        `INSERT INTO actions ("caseId", type, "officerId", notes)
         VALUES ($1, $2, $3, $4)`,
        [caseIds[i], 'Case Created', officerIds[i], 'Initial case creation'],
      );

      if (i < 3) {
        await queryRunner.query(
          `INSERT INTO actions ("caseId", type, "officerId", notes)
           VALUES ($1, $2, $3, $4)`,
          [caseIds[i], 'Soft Call', officerIds[i], 'Initial contact attempt made'],
        );
      }
    }

    console.log('Created sample actions');

    await queryRunner.commitTransaction();
    console.log('Seed completed successfully!');
    console.log('\nDefault credentials for all users: password123');
    console.log('Emails:', users.map((u) => u.email).join(', '));
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
