import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@ApiTags('Scheduler')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/scheduler')
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  @Post('run')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually trigger scheduled tasks' })
  async runNow() {
    await this.schedulerService.runScheduledTasks();
    return { message: 'Scheduled tasks executed' };
  }

  @Get('daily-summary')
  @Roles(Role.MANAGER, Role.CEO, Role.ADMIN)
  @ApiOperation({ summary: 'Get today\'s daily summary' })
  async dailySummary() {
    const data = await this.schedulerService.generateDailySummary();
    return { data };
  }
}
