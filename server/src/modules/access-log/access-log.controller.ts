import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccessLogService } from './access-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Access Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/access-logs')
export class AccessLogController {
  constructor(private accessLogService: AccessLogService) {}

  @Get()
  @Roles(Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'Get access logs with filters' })
  async getLogs(
    @Query('userId') userId?: string,
    @Query('type') type?: 'login' | 'view' | 'export' | 'failed',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accessLogService.getAccessLogs({
      userId, type, dateFrom, dateTo,
      page: parseInt(page || '1'),
      limit: parseInt(limit || '50'),
    });
  }
}
