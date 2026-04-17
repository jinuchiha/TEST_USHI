import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResponse<AuditLog>> {
    const { page, limit } = pagination;
    const [data, total] = await this.auditRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponse(data, total, page, limit);
  }

  async findByCaseId(caseId: string): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { caseId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: string, caseId: string | null, details: string): Promise<AuditLog> {
    return this.auditRepo.save(this.auditRepo.create({ userId, caseId, details }));
  }
}
