import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('court_cases')
export class CourtCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  caseId: string;

  @Column({ type: 'uuid' })
  debtorId: string;

  @Column({ length: 100 })
  courtCaseNumber: string;

  @Column({ length: 255, nullable: true })
  court: string | null;

  @Column({ length: 255, nullable: true })
  lawyerName: string | null;

  @Column({ length: 100, nullable: true })
  lawyerPhone: string | null;

  @Column({ type: 'varchar', length: 20, default: 'filed' })
  status: 'filed' | 'hearing_scheduled' | 'judgment' | 'appeal' | 'closed' | 'dismissed';

  @Column({ type: 'date', nullable: true })
  filedDate: string | null;

  @Column({ type: 'date', nullable: true })
  nextHearingDate: string | null;

  @Column({ type: 'text', nullable: true })
  judgmentSummary: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  claimAmount: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
