import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DebtorsService } from './debtors.service';
import { CreateDebtorDto } from './dto/create-debtor.dto';
import { UpdateDebtorDto } from './dto/update-debtor.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('Debtors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/debtors')
export class DebtorsController {
  constructor(private debtorsService: DebtorsService) {}

  @Get()
  @ApiOperation({ summary: 'List debtors with pagination and search' })
  async findAll(@Query() pagination: PaginationDto, @Query('search') search?: string) {
    return this.debtorsService.findAll(pagination, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get debtor by ID with tracing history' })
  async findOne(@Param('id') id: string) {
    const debtor = await this.debtorsService.findById(id);
    return { data: debtor };
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a debtor' })
  async create(@Body() dto: CreateDebtorDto) {
    const debtor = await this.debtorsService.create(dto);
    return { data: debtor };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update debtor details' })
  async update(@Param('id') id: string, @Body() dto: UpdateDebtorDto) {
    const debtor = await this.debtorsService.update(id, dto);
    return { data: debtor };
  }

  @Post(':id/tracing-logs')
  @Roles(Role.OFFICER, Role.MANAGER)
  @ApiOperation({ summary: 'Add tracing log entry' })
  async addTracingLog(
    @Param('id') id: string,
    @Body('note') note: string,
    @CurrentUser('id') officerId: string,
  ) {
    const log = await this.debtorsService.addTracingLog(id, officerId, note);
    return { data: log };
  }
}
