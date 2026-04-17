import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Case } from '../../cases/entities/case.entity';

@Entity('actions')
export class Action {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  caseId: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'uuid' })
  officerId: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  nextFollowUp: Date | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  amountPaid: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  outstandingBalanceBeforePayment: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  paymentConfirmedBy: 'Bank' | 'User' | null;

  @Column({ type: 'timestamptz', nullable: true })
  paymentVerifiedByFinanceAt: Date | null;

  @Column({ type: 'date', nullable: true })
  attributionDate: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  paymentType: 'Full Payment' | 'Settlement' | 'Installment' | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  confirmationMethod: 'Slip' | 'Bank Confirmation' | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  promisedAmount: number | null;

  @Column({ type: 'date', nullable: true })
  promisedDate: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  receiptPath: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  deathCertificatePath: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  settlementLetterPath: string | null;

  @ManyToOne(() => Case, (c) => c.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: Case;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
