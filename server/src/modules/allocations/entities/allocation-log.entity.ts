import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('allocation_logs')
export class AllocationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  allocatorId: string;

  @Column({ type: 'uuid' })
  recipientId: string;

  @Column('uuid', { array: true })
  caseIds: string[];

  @Column({ type: 'int' })
  count: number;

  @Column({ type: 'varchar', length: 20 })
  type: 'Initial Assignment' | 'Re-Assignment' | 'Re-Activation';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
