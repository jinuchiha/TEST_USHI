import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('contact_records')
export class ContactRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  debtorId: string;

  @Column({ type: 'uuid', nullable: true })
  caseId: string | null;

  @Column({ type: 'varchar', length: 20 })
  type: 'phone' | 'email' | 'employer' | 'address' | 'social';

  @Column({ length: 255 })
  value: string;

  @Column({ length: 100, nullable: true })
  label: string | null; // "Primary", "Alternate", "Work", "Spouse"

  @Column({ type: 'varchar', length: 20, default: 'unverified' })
  status: 'valid' | 'invalid' | 'switched_off' | 'new_found' | 'unverified';

  @Column({ length: 100, nullable: true })
  source: string | null; // "Manual", "Credit Bureau", "Third Party", "Debtor Provided"

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid' })
  addedBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
