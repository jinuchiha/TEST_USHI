import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('legal_notices')
export class LegalNotice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  caseId: string;

  @Column({ type: 'uuid' })
  debtorId: string;

  @Column({ type: 'varchar', length: 30 })
  type: 'demand_letter' | 'legal_warning' | 'court_notice' | 'final_notice';

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: 'draft' | 'sent' | 'delivered' | 'returned' | 'acknowledged';

  @Column({ type: 'date', nullable: true })
  sentDate: string | null;

  @Column({ type: 'date', nullable: true })
  deliveredDate: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deliveryMethod: 'email' | 'courier' | 'registered_mail' | 'hand_delivered' | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentPath: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
