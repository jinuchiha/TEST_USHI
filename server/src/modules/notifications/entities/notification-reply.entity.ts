import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Notification } from './notification.entity';

@Entity('notification_replies')
export class NotificationReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  notificationId: string;

  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ length: 255 })
  senderName: string;

  @Column({ type: 'text' })
  message: string;

  @ManyToOne(() => Notification, (n) => n.replies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
