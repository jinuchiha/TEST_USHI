import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Debtor } from './debtor.entity';

@Entity('tracing_logs')
export class TracingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  debtorId: string;

  @Column({ type: 'uuid' })
  officerId: string;

  @Column({ type: 'text' })
  note: string;

  @ManyToOne(() => Debtor, (debtor) => debtor.tracingHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'debtorId' })
  debtor: Debtor;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
