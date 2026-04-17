import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('document_vault')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  debtorId: string | null;

  @Column({ type: 'uuid', nullable: true })
  caseId: string | null;

  @Column({ length: 50 })
  type: 'emirates_id' | 'cnic' | 'passport' | 'contract' | 'settlement_letter' | 'court_order' | 'death_certificate' | 'other';

  @Column({ length: 255 })
  fileName: string;

  @Column({ length: 500 })
  filePath: string;

  @Column({ type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'boolean', default: false })
  isConfidential: boolean;

  @Column({ type: 'uuid' })
  uploadedBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
