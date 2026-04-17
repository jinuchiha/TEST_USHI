import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workflow_rules')
export class WorkflowRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  trigger: string; // ptp_broken | case_stale | dpd_threshold | status_changed | payment_received | ...

  @Column({ type: 'jsonb', default: '{}' })
  triggerParams: Record<string, string>;

  @Column({ type: 'jsonb', default: '[]' })
  conditions: Array<{ field: string; operator: string; value: string }>;

  @Column({ type: 'jsonb', default: '[]' })
  actions: Array<{ type: string; params: Record<string, string> }>;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 0 })
  runCount: number;

  @Column({ nullable: true })
  lastRun: Date;

  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
