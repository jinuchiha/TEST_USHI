import { Controller, Get, Post, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductivityService } from './productivity.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('Productivity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/productivity')
export class ProductivityController {
  constructor(private productivityService: ProductivityService) {}

  @Post('tasks/generate')
  @Roles(Role.OFFICER)
  @ApiOperation({ summary: 'Generate AI daily tasks for current officer' })
  async generateTasks(@CurrentUser('id') officerId: string) {
    const data = await this.productivityService.generateDailyTasks(officerId);
    return { data };
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Get my tasks' })
  async getMyTasks(@CurrentUser('id') officerId: string, @Query('status') status?: string) {
    const data = await this.productivityService.getMyTasks(officerId, status);
    return { data };
  }

  @Patch('tasks/:id/:status')
  @ApiOperation({ summary: 'Update task status' })
  async updateTask(@Param('id') id: string, @Param('status') status: 'in_progress' | 'completed' | 'skipped') {
    const data = await this.productivityService.updateTaskStatus(id, status);
    return { data };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get officer leaderboard' })
  async leaderboard(@Query('period') period?: 'week' | 'month' | 'all') {
    const data = await this.productivityService.getLeaderboard(period || 'month');
    return { data };
  }

  @Get('badges')
  @ApiOperation({ summary: 'Get my badges' })
  async myBadges(@CurrentUser('id') userId: string) {
    const data = await this.productivityService.getOfficerBadges(userId);
    return { data };
  }

  @Get('badges/:userId')
  @Roles(Role.MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'Get badges for a specific officer' })
  async officerBadges(@Param('userId') userId: string) {
    const data = await this.productivityService.getOfficerBadges(userId);
    return { data };
  }

  @Get('review/:officerId')
  @Roles(Role.MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'Get performance review data' })
  async performanceReview(
    @Param('officerId') officerId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const data = await this.productivityService.getPerformanceReview(
      officerId,
      parseInt(year || '') || now.getFullYear(),
      parseInt(month || '') || now.getMonth() + 1,
    );
    return { data };
  }
}
