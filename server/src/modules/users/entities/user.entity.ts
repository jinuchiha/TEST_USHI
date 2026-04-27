import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../../common/enums';
import { Exclude } from 'class-transformer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 255 })
  @Exclude()
  passwordHash: string;

  @Column({ type: 'varchar', length: 20 })
  role: Role;

  @Column({ type: 'varchar', length: 50, nullable: true })
  agentCode: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  target: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dailyTarget: number | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
