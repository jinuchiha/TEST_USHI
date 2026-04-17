import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationReply } from './entities/notification-reply.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @InjectRepository(NotificationReply)
    private replyRepo: Repository<NotificationReply>,
  ) {}

  async findForUser(userId: string): Promise<Notification[]> {
    return this.notifRepo.find({
      where: [{ recipientId: userId }, { recipientId: 'all' }],
      relations: ['replies'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.count({
      where: [
        { recipientId: userId, status: 'unread' },
        { recipientId: 'all', status: 'unread' },
      ],
    });
  }

  async create(
    dto: CreateNotificationDto,
    senderId: string,
    senderName: string,
  ): Promise<Notification> {
    const notif = this.notifRepo.create({
      senderId,
      senderName,
      recipientId: dto.recipientId,
      message: dto.message,
      priority: dto.priority || 'Normal',
      isTask: dto.isTask || false,
      taskStatus: dto.isTask ? 'pending' : null,
    });
    return this.notifRepo.save(notif);
  }

  async markRead(id: string): Promise<void> {
    await this.notifRepo.update(id, { status: 'read' });
  }

  async markTaskDone(id: string): Promise<void> {
    await this.notifRepo.update(id, { taskStatus: 'done' });
  }

  async addReply(
    notificationId: string,
    senderId: string,
    senderName: string,
    message: string,
  ): Promise<NotificationReply> {
    const notif = await this.notifRepo.findOne({ where: { id: notificationId } });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.replyRepo.save(
      this.replyRepo.create({ notificationId, senderId, senderName, message }),
    );
  }
}
