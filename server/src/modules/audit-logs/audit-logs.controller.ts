import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/audit-logs')
export class AuditLogsController {
  constructor(private auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'List all audit logs' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.auditLogsService.findAll(pagination);
  }

  @Get('case/:caseId')
  @ApiOperation({ summary: 'Get audit logs for a specific case' })
  async findByCase(@Param('caseId') caseId: string) {
    const data = await this.auditLogsService.findByCaseId(caseId);
    return { data };
  }
}
