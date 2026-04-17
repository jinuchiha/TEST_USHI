import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalNotice } from './entities/legal-notice.entity';
import { CourtCase } from './entities/court-case.entity';
import { Document } from './entities/document.entity';

@Injectable()
export class LegalService {
  constructor(
    @InjectRepository(LegalNotice) private noticeRepo: Repository<LegalNotice>,
    @InjectRepository(CourtCase) private courtRepo: Repository<CourtCase>,
    @InjectRepository(Document) private docRepo: Repository<Document>,
  ) {}

  // ── Legal Notices ──
  async createNotice(data: Partial<LegalNotice>): Promise<LegalNotice> {
    return this.noticeRepo.save(this.noticeRepo.create(data));
  }

  async getNoticesByCaseId(caseId: string): Promise<LegalNotice[]> {
    return this.noticeRepo.find({ where: { caseId }, order: { createdAt: 'DESC' } });
  }

  async updateNoticeStatus(id: string, status: LegalNotice['status'], deliveredDate?: string): Promise<LegalNotice> {
    const notice = await this.noticeRepo.findOne({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');
    notice.status = status;
    if (deliveredDate) notice.deliveredDate = deliveredDate;
    if (status === 'sent' && !notice.sentDate) notice.sentDate = new Date().toISOString().split('T')[0];
    return this.noticeRepo.save(notice);
  }

  // ── Court Cases ──
  async createCourtCase(data: Partial<CourtCase>): Promise<CourtCase> {
    return this.courtRepo.save(this.courtRepo.create(data));
  }

  async getCourtCases(caseId?: string): Promise<CourtCase[]> {
    const where: any = {};
    if (caseId) where.caseId = caseId;
    return this.courtRepo.find({ where, order: { nextHearingDate: 'ASC' } });
  }

  async updateCourtCase(id: string, data: Partial<CourtCase>): Promise<CourtCase> {
    const court = await this.courtRepo.findOne({ where: { id } });
    if (!court) throw new NotFoundException('Court case not found');
    Object.assign(court, data);
    return this.courtRepo.save(court);
  }

  async getUpcomingHearings(days: number = 30): Promise<CourtCase[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    return this.courtRepo.createQueryBuilder('court')
      .where('court.nextHearingDate IS NOT NULL')
      .andWhere('court.nextHearingDate <= :future', { future: futureDate.toISOString().split('T')[0] })
      .andWhere("court.status NOT IN ('closed', 'dismissed')")
      .orderBy('court.nextHearingDate', 'ASC')
      .getMany();
  }

  // ── Document Vault ──
  async uploadDocument(data: Partial<Document>): Promise<Document> {
    return this.docRepo.save(this.docRepo.create(data));
  }

  async getDocuments(debtorId?: string, caseId?: string): Promise<Document[]> {
    const qb = this.docRepo.createQueryBuilder('doc');
    if (debtorId) qb.andWhere('doc.debtorId = :debtorId', { debtorId });
    if (caseId) qb.andWhere('doc.caseId = :caseId', { caseId });
    return qb.orderBy('doc.createdAt', 'DESC').getMany();
  }

  async deleteDocument(id: string): Promise<void> {
    await this.docRepo.delete(id);
  }
}
