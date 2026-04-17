import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Case } from '../../cases/entities/case.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  caseId: string | null;

  @Column({ type: 'text' })
  details: string;

  @ManyToOne(() => Case, (c) => c.auditLog, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'caseId' })
  case: Case;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
