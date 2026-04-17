import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllocationLog } from './entities/allocation-log.entity';
import { AllocateCasesDto } from './dto/allocate-cases.dto';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class AllocationsService {
  constructor(
    @InjectRepository(AllocationLog)
    private allocRepo: Repository<AllocationLog>,
  ) {}

  async allocate(dto: AllocateCasesDto, allocatorId: string): Promise<AllocationLog> {
    const log = this.allocRepo.create({
      allocatorId,
      recipientId: dto.recipientId,
      caseIds: dto.caseIds,
      count: dto.caseIds.length,
      type: dto.type,
    });
    return this.allocRepo.save(log);
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResponse<AllocationLog>> {
    const { page, limit } = pagination;
    const [data, total] = await this.allocRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponse(data, total, page, limit);
  }
}
