import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('daily-summary')
  @Roles(Role.MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'Get daily summary report' })
  async dailySummary(@Query('date') date?: string) {
    const data = await this.reportsService.getDailySummary(date);
    return { data };
  }

  @Get('officer-performance')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get officer performance metrics' })
  async officerPerformance() {
    const data = await this.reportsService.getOfficerPerformance();
    return { data };
  }

  @Get('recovery-funnel')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get recovery funnel data' })
  async recoveryFunnel() {
    const data = await this.reportsService.getRecoveryFunnel();
    return { data };
  }

  @Get('status-matrix')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get status distribution matrix' })
  async statusMatrix() {
    const data = await this.reportsService.getStatusMatrix();
    return { data };
  }

  @Get('annual-forecast')
  @Roles(Role.CEO)
  @ApiOperation({ summary: 'Get annual forecast data' })
  async annualForecast() {
    const data = await this.reportsService.getAnnualForecast();
    return { data };
  }

  @Get('bank-breakdown')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get collections breakdown by bank' })
  async bankBreakdown() {
    const data = await this.reportsService.getBankBreakdown();
    return { data };
  }

  @Get('day-end')
  @ApiOperation({ summary: 'Day-end report (role-specific)' })
  async dayEndReport(
    @Query('date') date?: string,
    @Query('officerId') officerId?: string,
  ) {
    const data = await this.reportsService.getDayEndReport(date, officerId);
    return { data };
  }
}
