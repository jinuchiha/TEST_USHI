import { Controller, Get, Post, Body, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WithdrawalService, WithdrawalReason } from './withdrawal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('Withdrawals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/withdrawals')
export class WithdrawalController {
  constructor(private withdrawalService: WithdrawalService) {}

  @Post('bulk')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Bulk withdraw cases with reason code' })
  async bulkWithdraw(
    @Body() body: { caseIds: string[]; reason: WithdrawalReason; notes: string },
    @CurrentUser() user: any,
  ) {
    const data = await this.withdrawalService.bulkWithdraw(
      body.caseIds, body.reason, body.notes, user.id, user.name,
    );
    return { data };
  }

  @Get('history')
  @Roles(Role.MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'Get withdrawal history' })
  async getHistory(
    @Query('reason') reason?: WithdrawalReason,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.withdrawalService.getWithdrawalHistory({ reason, dateFrom, dateTo });
    return { data };
  }

  @Get('export')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Export withdrawn cases as CSV' })
  async exportCsv(@Res() res: Response) {
    const csv = await this.withdrawalService.exportToCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=withdrawn_cases_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  }
}
