import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Debtor } from './entities/debtor.entity';
import { TracingLog } from './entities/tracing-log.entity';
import { CreateDebtorDto } from './dto/create-debtor.dto';
import { UpdateDebtorDto } from './dto/update-debtor.dto';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class DebtorsService {
  constructor(
    @InjectRepository(Debtor)
    private debtorsRepo: Repository<Debtor>,
    @InjectRepository(TracingLog)
    private tracingRepo: Repository<TracingLog>,
  ) {}

  async findAll(pagination: PaginationDto, search?: string): Promise<PaginatedResponse<Debtor>> {
    const { page, limit } = pagination;
    const qb = this.debtorsRepo.createQueryBuilder('debtor')
      .leftJoinAndSelect('debtor.tracingHistory', 'tracing')
      .orderBy('debtor.name', 'ASC');

    if (search) {
      qb.where('debtor.name ILIKE :search OR debtor.eid ILIKE :search OR debtor.cnic ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).getMany();

    return new PaginatedResponse(data, total, page, limit);
  }

  async findById(id: string): Promise<Debtor> {
    const debtor = await this.debtorsRepo.findOne({
      where: { id },
      relations: ['tracingHistory'],
    });
    if (!debtor) throw new NotFoundException('Debtor not found');
    return debtor;
  }

  async create(dto: CreateDebtorDto): Promise<Debtor> {
    const debtor = this.debtorsRepo.create({
      ...dto,
      emails: dto.emails || [],
      phones: dto.phones || [],
    });
    return this.debtorsRepo.save(debtor);
  }

  async update(id: string, dto: UpdateDebtorDto): Promise<Debtor> {
    const debtor = await this.findById(id);
    Object.assign(debtor, dto);
    return this.debtorsRepo.save(debtor);
  }

  async addTracingLog(debtorId: string, officerId: string, note: string): Promise<TracingLog> {
    await this.findById(debtorId);
    const log = this.tracingRepo.create({ debtorId, officerId, note });
    return this.tracingRepo.save(log);
  }
}
