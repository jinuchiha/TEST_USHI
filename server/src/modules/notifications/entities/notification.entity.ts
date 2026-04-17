import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { NotificationReply } from './notification-reply.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ length: 255 })
  senderName: string;

  @Column({ length: 255 })
  recipientId: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 10, default: 'unread' })
  status: 'unread' | 'read';

  @Column({ type: 'varchar', length: 10, default: 'Normal' })
  priority: 'Normal' | 'Urgent';

  @Column({ default: false })
  isTask: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  taskStatus: 'pending' | 'done' | null;

  @OneToMany(() => NotificationReply, (reply) => reply.notification, {
    cascade: true,
  })
  replies: NotificationReply[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
