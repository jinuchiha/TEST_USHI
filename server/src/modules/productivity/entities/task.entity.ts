import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('officer_tasks')
export class OfficerTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  officerId: string;

  @Column({ type: 'uuid', nullable: true })
  caseId: string | null;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';

  @Column({ type: 'varchar', length: 10, default: 'medium' })
  priority: 'high' | 'medium' | 'low';

  @Column({ type: 'varchar', length: 30 })
  source: 'ai_generated' | 'manager_assigned' | 'system' | 'self';

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
