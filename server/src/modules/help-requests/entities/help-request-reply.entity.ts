import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HelpRequest } from './help-request.entity';

@Entity('help_request_replies')
export class HelpRequestReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  helpRequestId: string;

  @Column({ length: 255 })
  adminName: string;

  @Column({ type: 'text' })
  message: string;

  @ManyToOne(() => HelpRequest, (hr) => hr.adminReplies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'helpRequestId' })
  helpRequest: HelpRequest;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
