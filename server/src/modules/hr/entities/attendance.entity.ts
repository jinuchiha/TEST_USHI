import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'timestamptz' })
  checkIn: Date;

  @Column({ type: 'timestamptz', nullable: true })
  checkOut: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'present' })
  status: 'present' | 'late' | 'half_day' | 'absent' | 'leave' | 'holiday';

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  hoursWorked: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  overtimeHours: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
