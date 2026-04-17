import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TracingLog } from './tracing-log.entity';

@Entity('debtors')
export class Debtor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column('text', { array: true, default: '{}' })
  emails: string[];

  @Column('text', { array: true, default: '{}' })
  phones: string[];

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ length: 50, nullable: true })
  passport: string | null;

  @Column({ length: 50, nullable: true })
  cnic: string | null;

  @Column({ length: 50, nullable: true })
  eid: string | null;

  @Column({ type: 'date', nullable: true })
  dob: string | null;

  @OneToMany(() => TracingLog, (log) => log.debtor, { cascade: true })
  tracingHistory: TracingLog[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
