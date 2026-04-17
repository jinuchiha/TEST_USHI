import {
  Controller, Get, Post, Patch, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ReplyNotificationDto } from './dto/reply-notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  async findAll(@CurrentUser('id') userId: string) {
    const data = await this.notificationsService.findForUser(userId);
    return { data };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { data: { count } };
  }

  @Post()
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Send a notification' })
  async create(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.notificationsService.create(dto, user.id, user.name);
    return { data };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Param('id') id: string) {
    await this.notificationsService.markRead(id);
    return { message: 'Marked as read' };
  }

  @Patch(':id/task-done')
  @ApiOperation({ summary: 'Mark task as done' })
  async markTaskDone(@Param('id') id: string) {
    await this.notificationsService.markTaskDone(id);
    return { message: 'Task marked as done' };
  }

  @Post(':id/replies')
  @ApiOperation({ summary: 'Reply to a notification' })
  async addReply(
    @Param('id') id: string,
    @Body() dto: ReplyNotificationDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.notificationsService.addReply(id, user.id, user.name, dto.message);
    return { data };
  }
}
