import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { Debtor } from '../../debtors/entities/debtor.entity';
import { Loan } from '../../loans/entities/loan.entity';
import { User } from '../../users/entities/user.entity';
import { Action } from '../../actions/entities/action.entity';
import { AuditLog } from '../../audit-logs/entities/audit-log.entity';

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  debtorId: string;

  @Column({ type: 'uuid' })
  loanId: string;

  @Column({ type: 'uuid' })
  assignedOfficerId: string;

  @Column({ type: 'varchar', length: 30 })
  crmStatus: string;

  @Column({ type: 'varchar', length: 60, default: '' })
  subStatus: string;

  @Column({ type: 'varchar', length: 15, default: 'Non Contact' })
  contactStatus: 'Contact' | 'Non Contact';

  @Column({ type: 'varchar', length: 15, default: 'Non Work' })
  workStatus: 'Work' | 'Non Work';

  @Column({ type: 'varchar', length: 100, nullable: true })
  tracingStatus: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  statusCode: string | null;

  @Column({ type: 'varchar', length: 3, default: 'No' })
  cyber: 'Yes' | 'No';

  @Column({ type: 'timestamptz', nullable: true })
  lastContactDate: Date | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  creationDate: Date;

  @VersionColumn()
  version: number;

  @ManyToOne(() => Debtor, { eager: false })
  @JoinColumn({ name: 'debtorId' })
  debtor: Debtor;

  @ManyToOne(() => Loan, { eager: false })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'assignedOfficerId' })
  officer: User;

  @OneToMany(() => Action, (action) => action.case, { cascade: true })
  history: Action[];

  @OneToMany(() => AuditLog, (log) => log.case, { cascade: true })
  auditLog: AuditLog[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
