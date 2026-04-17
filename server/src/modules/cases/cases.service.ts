import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from './entities/case.entity';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';
import { CaseFilterDto } from './dto/case-filter.dto';
import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Action } from '../actions/entities/action.entity';
import { ActionType } from '../../common/enums';

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(Case)
    private casesRepo: Repository<Case>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
    @InjectRepository(Action)
    private actionsRepo: Repository<Action>,
  ) {}

  async findAll(filters: CaseFilterDto): Promise<PaginatedResponse<Case>> {
    const { page, limit } = filters;

    const qb = this.casesRepo
      .createQueryBuilder('case')
      .leftJoinAndSelect('case.debtor', 'debtor')
      .leftJoinAndSelect('case.loan', 'loan')
      .leftJoinAndSelect('case.officer', 'officer');

    if (filters.crmStatus) {
      qb.andWhere('case.crmStatus = :crmStatus', { crmStatus: filters.crmStatus });
    }
    if (filters.assignedOfficerId) {
      qb.andWhere('case.assignedOfficerId = :officerId', { officerId: filters.assignedOfficerId });
    }
    if (filters.contactStatus) {
      qb.andWhere('case.contactStatus = :contactStatus', { contactStatus: filters.contactStatus });
    }
    if (filters.workStatus) {
      qb.andWhere('case.workStatus = :workStatus', { workStatus: filters.workStatus });
    }
    if (filters.bank) {
      qb.andWhere('loan.bank = :bank', { bank: filters.bank });
    }
    if (filters.dateFrom) {
      qb.andWhere('case.creationDate >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('case.creationDate <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters.search) {
      qb.andWhere(
        '(debtor.name ILIKE :search OR loan.accountNumber ILIKE :search OR CAST(case.id AS TEXT) ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    qb.orderBy('case.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).getMany();

    return new PaginatedResponse(data, total, page, limit);
  }

  async findById(id: string): Promise<Case> {
    const caseEntity = await this.casesRepo.findOne({
      where: { id },
      relations: ['debtor', 'loan', 'officer', 'history', 'auditLog'],
    });
    if (!caseEntity) throw new NotFoundException('Case not found');
    return caseEntity;
  }

  async create(dto: CreateCaseDto, userId: string): Promise<Case> {
    const caseEntity = this.casesRepo.create({
      ...dto,
      subStatus: dto.subStatus || '',
      contactStatus: dto.contactStatus || 'Non Contact',
      workStatus: dto.workStatus || 'Non Work',
      cyber: dto.cyber || 'No',
    });
    const saved = await this.casesRepo.save(caseEntity);

    // Create initial action
    const action = this.actionsRepo.create({
      caseId: saved.id,
      type: ActionType.CASE_CREATED,
      officerId: userId,
      notes: 'Case created',
    });
    await this.actionsRepo.save(action);

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        caseId: saved.id,
        details: `Case created and assigned to officer ${dto.assignedOfficerId}`,
      }),
    );

    return this.findById(saved.id);
  }

  async updateStatus(
    id: string,
    dto: UpdateCaseStatusDto,
    userId: string,
  ): Promise<{ success: boolean; conflict?: { caseId: string; officerName: string } | null }> {
    const caseEntity = await this.casesRepo.findOne({
      where: { id },
      relations: ['officer'],
    });
    if (!caseEntity) throw new NotFoundException('Case not found');

    // Optimistic concurrency check
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== caseEntity.version) {
      return {
        success: false,
        conflict: {
          caseId: id,
          officerName: caseEntity.officer?.name || 'Unknown',
        },
      };
    }

    const oldStatus = caseEntity.crmStatus;
    caseEntity.crmStatus = dto.crmStatus;
    caseEntity.subStatus = dto.subStatus;
    caseEntity.contactStatus = dto.contactStatus;
    caseEntity.workStatus = dto.workStatus;
    caseEntity.lastContactDate = new Date();

    await this.casesRepo.save(caseEntity);

    // Log status change action
    const action = this.actionsRepo.create({
      caseId: id,
      type: ActionType.STATUS_UPDATE,
      officerId: userId,
      notes: dto.notes || `Status changed from ${oldStatus} to ${dto.crmStatus}`,
      promisedAmount: dto.promisedAmount || null,
      promisedDate: dto.promisedDate || null,
    });
    await this.actionsRepo.save(action);

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        caseId: id,
        details: `Status updated: ${oldStatus} → ${dto.crmStatus} / ${dto.subStatus}`,
      }),
    );

    return { success: true, conflict: null };
  }

  async reassign(caseId: string, newOfficerId: string, userId: string): Promise<Case> {
    const caseEntity = await this.findById(caseId);
    const oldOfficerId = caseEntity.assignedOfficerId;
    caseEntity.assignedOfficerId = newOfficerId;
    await this.casesRepo.save(caseEntity);

    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        caseId,
        details: `Case reassigned from ${oldOfficerId} to ${newOfficerId}`,
      }),
    );

    return this.findById(caseId);
  }

  async bulkReassign(caseIds: string[], newOfficerId: string, userId: string): Promise<void> {
    await this.casesRepo
      .createQueryBuilder()
      .update(Case)
      .set({ assignedOfficerId: newOfficerId })
      .whereInIds(caseIds)
      .execute();

    for (const caseId of caseIds) {
      await this.auditRepo.save(
        this.auditRepo.create({
          userId,
          caseId,
          details: `Case bulk-reassigned to ${newOfficerId}`,
        }),
      );
    }
  }

  async findByStatus(status: string): Promise<Case[]> {
    return this.casesRepo.find({
      where: { crmStatus: status },
      relations: ['debtor', 'loan', 'officer'],
      order: { createdAt: 'DESC' },
    });
  }
}
