import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/loans')
export class LoansController {
  constructor(private loansService: LoansService) {}

  @Get()
  @ApiOperation({ summary: 'List all loans' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.loansService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get loan by ID' })
  async findOne(@Param('id') id: string) {
    const loan = await this.loansService.findById(id);
    return { data: loan };
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a loan' })
  async create(@Body() dto: CreateLoanDto) {
    const loan = await this.loansService.create(dto);
    return { data: loan };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update loan details' })
  async update(@Param('id') id: string, @Body() dto: UpdateLoanDto) {
    const loan = await this.loansService.update(id, dto);
    return { data: loan };
  }
}
