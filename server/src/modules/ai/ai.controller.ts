import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('recovery-score/:caseId')
  @ApiOperation({ summary: 'Get AI recovery probability score for a case' })
  async getRecoveryScore(@Param('caseId') caseId: string) {
    const data = await this.aiService.scoreCaseRecovery(caseId);
    return { data };
  }

  @Get('recovery-scores')
  @ApiOperation({ summary: 'Get recovery scores for all active cases' })
  async getAllRecoveryScores(@Query('officerId') officerId?: string) {
    const data = await this.aiService.scoreAllCases(officerId);
    return { data };
  }

  @Get('suggest-officer/:caseId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get AI-suggested officer allocation for a case' })
  async suggestOfficer(@Param('caseId') caseId: string) {
    const data = await this.aiService.suggestOfficerForCase(caseId);
    return { data };
  }

  @Get('fraud-check/:debtorId')
  @Roles(Role.MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'Run fraud detection on a debtor' })
  async fraudCheck(@Param('debtorId') debtorId: string) {
    const data = await this.aiService.assessDebtorFraud(debtorId);
    return { data };
  }

  @Get('portfolio-insights')
  @Roles(Role.CEO, Role.MANAGER)
  @ApiOperation({ summary: 'Get AI portfolio insights for executive dashboard' })
  async portfolioInsights() {
    const data = await this.aiService.getPortfolioInsights();
    return { data };
  }

  @Get('my-insights')
  @Roles(Role.OFFICER)
  @ApiOperation({ summary: 'Get AI insights for current officer' })
  async myInsights(@CurrentUser('id') officerId: string) {
    const data = await this.aiService.scoreAllCases(officerId);
    return { data };
  }

  @Get('next-best-action/:caseId')
  @ApiOperation({ summary: 'Get AI-recommended next best action for a case' })
  async nextBestAction(@Param('caseId') caseId: string) {
    const data = await this.aiService.getNextBestAction(caseId);
    return { data };
  }

  @Get('smart-queue')
  @Roles(Role.OFFICER)
  @ApiOperation({ summary: 'Get AI-prioritized case queue for current officer' })
  async smartQueue(@CurrentUser('id') officerId: string) {
    const data = await this.aiService.getSmartQueue(officerId);
    return { data };
  }

  @Get('smart-queue/:officerId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get AI-prioritized case queue for a specific officer' })
  async officerSmartQueue(@Param('officerId') officerId: string) {
    const data = await this.aiService.getSmartQueue(officerId);
    return { data };
  }
}
