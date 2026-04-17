import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ length: 50 })
  type: 'top_collector' | 'streak_7' | 'streak_30' | 'first_payment' | 'case_closer' | 'perfect_attendance' | 'ptp_king' | 'early_bird';

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  period: string | null; // e.g., '2025-03' for monthly badges

  @CreateDateColumn({ type: 'timestamptz' })
  earnedAt: Date;
}
