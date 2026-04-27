import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { HelpRequestReply } from './help-request-reply.entity';

@Entity('help_requests')
export class HelpRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ length: 255 })
  userName: string;

  @Column({ type: 'varchar', length: 20 })
  userRole: string;

  @Column({ type: 'text' })
  query: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: 'pending' | 'resolved';

  @Column({ type: 'varchar', length: 255, nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @OneToMany(() => HelpRequestReply, (reply) => reply.helpRequest, {
    cascade: true,
  })
  adminReplies: HelpRequestReply[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
