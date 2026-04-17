import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('HR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/hr')
export class HrController {
  constructor(private hrService: HrService) {}

  // ── Attendance (self-service — any authenticated user) ──
  @Post('attendance/check-in')
  @ApiOperation({ summary: 'Mark check-in (auto on login)' })
  async checkIn(@CurrentUser('id') userId: string) {
    const data = await this.hrService.markCheckIn(userId);
    return { data };
  }

  @Post('attendance/check-out')
  @ApiOperation({ summary: 'Mark check-out' })
  async checkOut(@CurrentUser('id') userId: string) {
    const data = await this.hrService.markCheckOut(userId);
    return { data };
  }

  // ── Attendance (Manager/CEO only) ──
  @Get('attendance/today')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get today\'s attendance snapshot' })
  async todaySnapshot() {
    const data = await this.hrService.getTodaySnapshot();
    return { data };
  }

  @Get('attendance/trends')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get attendance trends and exception alerts' })
  async attendanceTrends(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = parseInt(year || '') || new Date().getFullYear();
    const m = parseInt(month || '') || new Date().getMonth() + 1;
    const data = await this.hrService.getAttendanceTrends(y, m);
    return { data };
  }

  @Get('attendance/correlation')
  @Roles(Role.CEO)
  @ApiOperation({ summary: 'Attendance vs Recovery correlation' })
  async attendanceCorrelation(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = parseInt(year || '') || new Date().getFullYear();
    const m = parseInt(month || '') || new Date().getMonth() + 1;
    const data = await this.hrService.getAttendanceRecoveryCorrelation(y, m);
    return { data };
  }

  @Get('attendance/:userId')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get monthly attendance for a user' })
  async monthlyAttendance(
    @Param('userId') userId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const data = await this.hrService.getMonthlyAttendance(
      userId,
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1,
    );
    return { data };
  }

  // ── Leave (self-service submit, Manager/CEO view all) ──
  @Post('leave')
  @ApiOperation({ summary: 'Submit leave request' })
  async submitLeave(
    @CurrentUser('id') userId: string,
    @Body() body: { type: 'annual' | 'sick' | 'personal' | 'emergency' | 'unpaid'; startDate: string; endDate: string; reason: string },
  ) {
    const data = await this.hrService.submitLeave(userId, body);
    return { data };
  }

  @Get('leave')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'List all leave requests (Manager/CEO only)' })
  async getLeaveRequests(@Query('status') status?: string) {
    const data = await this.hrService.getLeaveRequests(status);
    return { data };
  }

  @Patch('leave/:id/approve')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Approve or reject leave request (Manager only)' })
  async approveLeave(
    @Param('id') id: string,
    @Body() body: { approved: boolean; notes?: string },
    @CurrentUser('id') approverId: string,
  ) {
    const data = await this.hrService.approveLeave(id, approverId, body.approved, body.notes);
    return { data };
  }

  @Get('leave/balance/:userId')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get leave balance (Manager/CEO only)' })
  async leaveBalance(@Param('userId') userId: string, @Query('year') year?: string) {
    const data = await this.hrService.getLeaveBalance(userId, parseInt(year || '') || new Date().getFullYear());
    return { data };
  }

  @Get('leave/my-balance')
  @ApiOperation({ summary: 'Get own leave balance' })
  async myLeaveBalance(@CurrentUser('id') userId: string, @Query('year') year?: string) {
    const data = await this.hrService.getLeaveBalance(userId, parseInt(year || '') || new Date().getFullYear());
    return { data };
  }

  // ── Daily absent marking (called by scheduler) ──
  @Post('attendance/mark-absent')
  @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Mark all non-logged-in users as absent for today' })
  async markAbsent() {
    const data = await this.hrService.markAbsentForToday();
    return { data };
  }

  // ── Check-in enforcement gate ──
  @Get('attendance/check-in-status')
  @ApiOperation({ summary: 'Check if current user has checked in today' })
  async checkInStatus(@CurrentUser('id') userId: string) {
    const data = await this.hrService.hasCheckedInToday(userId);
    return { data };
  }

  // ── My attendance log (self-service) ──
  @Get('attendance/my-log')
  @ApiOperation({ summary: 'Get own attendance history' })
  async myLog(@CurrentUser('id') userId: string, @Query('page') page?: string) {
    const data = await this.hrService.getMyAttendanceLog(userId, parseInt(page || '1'));
    return { data };
  }

  // ── Session tracking ──
  @Post('sessions/start')
  @ApiOperation({ summary: 'Start a new session (on login)' })
  async startSession(
    @CurrentUser('id') userId: string,
    @Body() body: { ip?: string; userAgent?: string },
  ) {
    const data = await this.hrService.startSession(userId, body.ip, body.userAgent);
    return { data };
  }

  @Post('sessions/end')
  @ApiOperation({ summary: 'End session (on logout or idle timeout)' })
  async endSession(
    @CurrentUser('id') userId: string,
    @Body() body: { reason: 'manual_logout' | 'idle_logout' },
  ) {
    await this.hrService.endSession(userId, body.reason);
    return { message: 'Session ended' };
  }

  @Get('sessions/:userId')
  @Roles(Role.MANAGER, Role.CEO)
  @ApiOperation({ summary: 'Get session history for a user' })
  async userSessions(@Param('userId') userId: string) {
    const data = await this.hrService.getUserSessions(userId);
    return { data };
  }
}
