import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan } from './entities/loan.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private loansRepo: Repository<Loan>,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResponse<Loan>> {
    const { page, limit } = pagination;
    const [data, total] = await this.loansRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return new PaginatedResponse(data, total, page, limit);
  }

  async findById(id: string): Promise<Loan> {
    const loan = await this.loansRepo.findOne({ where: { id } });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }

  async create(dto: CreateLoanDto): Promise<Loan> {
    const loan = this.loansRepo.create(dto);
    return this.loansRepo.save(loan);
  }

  async update(id: string, dto: UpdateLoanDto): Promise<Loan> {
    const loan = await this.findById(id);
    Object.assign(loan, dto);
    return this.loansRepo.save(loan);
  }
}
