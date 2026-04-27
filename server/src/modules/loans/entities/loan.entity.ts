import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Debtor } from '../../debtors/entities/debtor.entity';
import { Currency } from '../../../common/enums';

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  debtorId: string;

  @Column({ length: 100 })
  accountNumber: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  originalAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  currentBalance: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  product: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subProduct: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bucket: string | null;

  @Column({ type: 'varchar', length: 3 })
  currency: Currency;

  @Column({ type: 'date', nullable: true })
  lpd: string | null;

  @Column({ type: 'date', nullable: true })
  wod: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cif: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ica: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  bankCoordinator: string | null;

  @Column({ type: 'jsonb', nullable: true })
  bankMetadata: Record<string, string> | null;

  @ManyToOne(() => Debtor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debtorId' })
  debtor: Debtor;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
