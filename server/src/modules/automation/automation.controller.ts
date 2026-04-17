import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { CreateWorkflowRuleDto } from './dto/create-workflow-rule.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/automation')
export class AutomationController {
  constructor(private automationService: AutomationService) {}

  // ─── System rules ───────────────────────────────────────────────────────

  @Post('run')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Manually trigger all built-in automation rules' })
  async runAll() {
    const data = await this.automationService.runAllRules();
    return { data };
  }

  @Get('predict-withdrawals')
  @Roles(Role.MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'AI-predicted cases likely to be withdrawn' })
  async predictWithdrawals() {
    const data = await this.automationService.predictLikelyWithdrawals();
    return { data };
  }

  // ─── Custom workflow rules CRUD ─────────────────────────────────────────

  @Get('rules')
  @Roles(Role.MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'List all custom workflow rules' })
  async getRules() {
    const data = await this.automationService.getRules();
    return { data };
  }

  @Post('rules')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new custom workflow rule' })
  async createRule(@Body() dto: CreateWorkflowRuleDto, @Request() req: any) {
    const data = await this.automationService.createRule(dto, req.user?.id);
    return { data };
  }

  @Put('rules/:id')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a custom workflow rule' })
  async updateRule(@Param('id') id: string, @Body() dto: Partial<CreateWorkflowRuleDto>) {
    const data = await this.automationService.updateRule(id, dto);
    return { data };
  }

  @Patch('rules/:id/toggle')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Toggle a rule enabled/disabled' })
  async toggleRule(@Param('id') id: string) {
    const data = await this.automationService.toggleRule(id);
    return { data };
  }

  @Post('rules/:id/run')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Run a specific rule immediately' })
  async runRule(@Param('id') id: string) {
    const data = await this.automationService.runRule(id);
    return { data };
  }

  @Delete('rules/:id')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a custom workflow rule' })
  async deleteRule(@Param('id') id: string) {
    await this.automationService.deleteRule(id);
    return { message: 'Rule deleted' };
  }
}
