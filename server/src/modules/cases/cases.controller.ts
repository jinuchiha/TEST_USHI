import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';
import { ReassignCaseDto, BulkReassignDto } from './dto/reassign-case.dto';
import { CaseFilterDto } from './dto/case-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/cases')
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Get()
  @ApiOperation({ summary: 'List cases with filters and pagination' })
  async findAll(@Query() filters: CaseFilterDto) {
    return this.casesService.findAll(filters);
  }

  @Get('withdrawn')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'List withdrawn cases' })
  async findWithdrawn() {
    const data = await this.casesService.findByStatus('Withdrawn');
    return { data };
  }

  @Get('pending-withdrawals')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'List pending withdrawal cases' })
  async findPendingWithdrawals() {
    const data = await this.casesService.findByStatus('NIP');
    return { data };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search cases' })
  async search(@Query() filters: CaseFilterDto) {
    return this.casesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get enriched case by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.casesService.findById(id);
    return { data };
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a case' })
  async create(@Body() dto: CreateCaseDto, @CurrentUser('id') userId: string) {
    const data = await this.casesService.create(dto, userId);
    return { data };
  }

  @Patch(':id/status')
  @Roles(Role.OFFICER, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Update case CRM status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCaseStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.casesService.updateStatus(id, dto, userId);
  }

  @Patch(':id/reassign')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Reassign case to different officer' })
  async reassign(
    @Param('id') id: string,
    @Body() dto: ReassignCaseDto,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.casesService.reassign(id, dto.newOfficerId, userId);
    return { data };
  }

  @Post('bulk-reassign')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Bulk reassign cases' })
  async bulkReassign(
    @Body() dto: BulkReassignDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.casesService.bulkReassign(dto.caseIds, dto.newOfficerId, userId);
    return { message: `${dto.caseIds.length} cases reassigned` };
  }
}
