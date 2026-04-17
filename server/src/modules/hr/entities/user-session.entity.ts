import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'timestamptz' })
  loginTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  logoutTime: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'idle_logout' | 'manual_logout' | 'expired';

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  totalActiveMinutes: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  totalIdleMinutes: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
