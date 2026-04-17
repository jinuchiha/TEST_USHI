import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactRecord } from './entities/contact-record.entity';

@Injectable()
export class TracingService {
  constructor(
    @InjectRepository(ContactRecord) private contactRepo: Repository<ContactRecord>,
  ) {}

  async addContact(data: Partial<ContactRecord>): Promise<ContactRecord> {
    return this.contactRepo.save(this.contactRepo.create(data));
  }

  async getContactsByDebtor(debtorId: string): Promise<ContactRecord[]> {
    return this.contactRepo.find({
      where: { debtorId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateContactStatus(id: string, status: ContactRecord['status'], notes?: string): Promise<ContactRecord> {
    const record = await this.contactRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Contact record not found');
    record.status = status;
    if (notes) record.notes = notes;
    return this.contactRepo.save(record);
  }

  async logAttempt(id: string, success: boolean): Promise<ContactRecord> {
    const record = await this.contactRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Contact record not found');
    record.attemptCount += 1;
    if (success) record.successCount += 1;
    record.lastAttemptAt = new Date();
    if (!success && record.attemptCount >= 5 && record.successCount === 0) {
      record.status = 'invalid';
    }
    return this.contactRepo.save(record);
  }

  async getContactSuccessRate(debtorId: string): Promise<{
    totalContacts: number;
    validContacts: number;
    totalAttempts: number;
    totalSuccesses: number;
    successRate: number;
  }> {
    const contacts = await this.getContactsByDebtor(debtorId);
    const totalAttempts = contacts.reduce((s, c) => s + c.attemptCount, 0);
    const totalSuccesses = contacts.reduce((s, c) => s + c.successCount, 0);
    return {
      totalContacts: contacts.length,
      validContacts: contacts.filter(c => c.status === 'valid').length,
      totalAttempts,
      totalSuccesses,
      successRate: totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : 0,
    };
  }

  async getTracingTimeline(debtorId: string): Promise<Array<{
    date: string;
    type: string;
    value: string;
    status: string;
    event: string;
  }>> {
    const contacts = await this.contactRepo.find({
      where: { debtorId },
      order: { createdAt: 'ASC' },
    });

    return contacts.map(c => ({
      date: c.createdAt.toISOString(),
      type: c.type,
      value: c.value,
      status: c.status,
      event: c.status === 'new_found' ? 'New contact discovered' :
             c.status === 'invalid' ? 'Contact marked invalid' :
             c.status === 'valid' ? 'Contact verified' :
             `Contact added (${c.source || 'Manual'})`,
    }));
  }
}
