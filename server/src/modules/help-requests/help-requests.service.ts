import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpRequest } from './entities/help-request.entity';
import { HelpRequestReply } from './entities/help-request-reply.entity';

@Injectable()
export class HelpRequestsService {
  constructor(
    @InjectRepository(HelpRequest)
    private helpRepo: Repository<HelpRequest>,
    @InjectRepository(HelpRequestReply)
    private replyRepo: Repository<HelpRequestReply>,
  ) {}

  async findAll(): Promise<HelpRequest[]> {
    return this.helpRepo.find({
      relations: ['adminReplies'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: string, userName: string, userRole: string, query: string): Promise<HelpRequest> {
    return this.helpRepo.save(
      this.helpRepo.create({ userId, userName, userRole, query }),
    );
  }

  async addReply(helpRequestId: string, adminName: string, message: string): Promise<HelpRequestReply> {
    const hr = await this.helpRepo.findOne({ where: { id: helpRequestId } });
    if (!hr) throw new NotFoundException('Help request not found');

    return this.replyRepo.save(
      this.replyRepo.create({ helpRequestId, adminName, message }),
    );
  }

  async resolve(id: string, resolvedBy: string): Promise<void> {
    const hr = await this.helpRepo.findOne({ where: { id } });
    if (!hr) throw new NotFoundException('Help request not found');

    hr.status = 'resolved';
    hr.resolvedBy = resolvedBy;
    hr.resolvedAt = new Date();
    await this.helpRepo.save(hr);
  }
}
