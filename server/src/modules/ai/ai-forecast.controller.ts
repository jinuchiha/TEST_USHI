import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { Case } from '../cases/entities/case.entity';
import { Action } from '../actions/entities/action.entity';
import { generateForecast, MonthlyDataPoint } from './engines/forecasting.engine';

@ApiTags('AI - Forecasting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/ai/forecast')
export class AiForecastController {
  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Action) private actionsRepo: Repository<Action>,
  ) {}

  @Get()
  @Roles(Role.CEO, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get AI-powered recovery forecast' })
  async getForecast(@Query('months') months?: number) {
    // Fetch historical monthly collections
    const monthlyData = await this.actionsRepo
      .createQueryBuilder('action')
      .where('action.type = :type', { type: 'Payment Received' })
      .select("TO_CHAR(action.createdAt, 'YYYY-MM')", 'month')
      .addSelect('COALESCE(SUM(action.amountPaid), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(action.createdAt, 'YYYY-MM')")
      .orderBy('month', 'ASC')
      .getRawMany();

    const historical: MonthlyDataPoint[] = monthlyData.map(m => ({
      month: m.month,
      actual: parseFloat(m.total),
      casesClosed: parseInt(m.count, 10),
    }));

    // Pipeline value (active cases total balance)
    const pipelineResult = await this.casesRepo
      .createQueryBuilder('case')
      .leftJoin('case.loan', 'loan')
      .where("case.crmStatus NOT IN (:...excluded)", {
        excluded: ['Closed', 'Withdrawn'],
      })
      .select('COALESCE(SUM(loan.currentBalance), 0)', 'total')
      .getRawOne();

    const activePipelineValue = parseFloat(pipelineResult?.total || '0');

    // Average recovery score (simplified — use 40% as default)
    const avgRecoveryScore = 40;

    const forecast = generateForecast(
      historical,
      activePipelineValue,
      avgRecoveryScore,
      months || 12,
    );

    return { data: forecast };
  }
}
