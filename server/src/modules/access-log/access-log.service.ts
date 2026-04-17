import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';

/**
 * Access Log Service
 *
 * Tracks:
 * - Login events with IP + user agent
 * - Case view events (who viewed which case)
 * - Data export events
 * - Failed login attempts
 */

@Injectable()
export class AccessLogService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async logLogin(userId: string, ip: string, userAgent: string) {
    await this.auditRepo.save(this.auditRepo.create({
      userId,
      caseId: null,
      details: `LOGIN from IP: ${ip} | UA: ${userAgent.slice(0, 100)}`,
    }));
  }

  async logFailedLogin(email: string, ip: string) {
    await this.auditRepo.save(this.auditRepo.create({
      userId: 'system',
      caseId: null,
      details: `FAILED LOGIN attempt for ${email} from IP: ${ip}`,
    }));
  }

  async logCaseView(userId: string, caseId: string) {
    await this.auditRepo.save(this.auditRepo.create({
      userId,
      caseId,
      details: `Case viewed by user ${userId}`,
    }));
  }

  async logDataExport(userId: string, exportType: string, recordCount: number) {
    await this.auditRepo.save(this.auditRepo.create({
      userId,
      caseId: null,
      details: `DATA EXPORT: ${exportType} — ${recordCount} records exported`,
    }));
  }

  async getAccessLogs(filters?: {
    userId?: string;
    type?: 'login' | 'view' | 'export' | 'failed';
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.auditRepo.createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (filters?.userId) qb.andWhere('log.userId = :userId', { userId: filters.userId });
    if (filters?.dateFrom) qb.andWhere('log.createdAt >= :from', { from: filters.dateFrom });
    if (filters?.dateTo) qb.andWhere('log.createdAt <= :to', { to: filters.dateTo });

    if (filters?.type === 'login') qb.andWhere("log.details LIKE '%LOGIN%'");
    if (filters?.type === 'view') qb.andWhere("log.details LIKE '%viewed%'");
    if (filters?.type === 'export') qb.andWhere("log.details LIKE '%EXPORT%'");
    if (filters?.type === 'failed') qb.andWhere("log.details LIKE '%FAILED%'");

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
