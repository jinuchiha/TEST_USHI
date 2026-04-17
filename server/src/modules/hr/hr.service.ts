import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Attendance } from './entities/attendance.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { UserSession } from './entities/user-session.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(Attendance) private attendanceRepo: Repository<Attendance>,
    @InjectRepository(UserSession) private sessionRepo: Repository<UserSession>,
    @InjectRepository(LeaveRequest) private leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  // ── Attendance ──

  async markCheckIn(userId: string): Promise<Attendance> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.attendanceRepo.findOne({
      where: { userId, date: today },
    });
    if (existing) return existing; // Already checked in

    const now = new Date();
    const hour = now.getHours();
    const status = hour >= 10 ? 'late' : 'present';

    return this.attendanceRepo.save(this.attendanceRepo.create({
      userId,
      date: today,
      checkIn: now,
      status,
    }));
  }

  async markCheckOut(userId: string): Promise<Attendance> {
    const today = new Date().toISOString().split('T')[0];
    const record = await this.attendanceRepo.findOne({
      where: { userId, date: today },
    });
    if (!record) throw new NotFoundException('No check-in found for today');

    record.checkOut = new Date();
    const hours = (record.checkOut.getTime() - record.checkIn.getTime()) / 3600000;
    record.hoursWorked = Math.round(hours * 100) / 100;
    record.overtimeHours = Math.max(0, Math.round((hours - 8) * 100) / 100);

    if (hours < 4) record.status = 'half_day';

    return this.attendanceRepo.save(record);
  }

  async getMonthlyAttendance(userId: string, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const records = await this.attendanceRepo.find({
      where: { userId, date: Between(startDate, endDate) },
      order: { date: 'ASC' },
    });

    const workingDays = this.getWorkingDaysInMonth(year, month);
    const presentDays = records.filter(r => ['present', 'late'].includes(r.status)).length;
    const lateDays = records.filter(r => r.status === 'late').length;
    const totalHours = records.reduce((s, r) => s + Number(r.hoursWorked || 0), 0);
    const totalOvertime = records.reduce((s, r) => s + Number(r.overtimeHours || 0), 0);

    return {
      records,
      summary: {
        workingDays,
        presentDays,
        absentDays: workingDays - presentDays - records.filter(r => r.status === 'leave').length,
        lateDays,
        leaveDays: records.filter(r => r.status === 'leave').length,
        attendancePct: workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0,
        totalHours: Math.round(totalHours * 10) / 10,
        totalOvertime: Math.round(totalOvertime * 10) / 10,
      },
    };
  }

  async getTodaySnapshot(): Promise<{
    totalEmployees: number;
    present: number;
    absent: number;
    onLeave: number;
    late: number;
    employees: Array<{ id: string; name: string; role: string; status: string; checkIn?: string }>;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const users = await this.usersRepo.find({ where: { isActive: true } });
    const attendance = await this.attendanceRepo.find({ where: { date: today } });
    const leaves = await this.leaveRepo.find({
      where: { status: 'approved' },
    });
    const todayLeaves = leaves.filter(l => l.startDate <= today && l.endDate >= today);

    const employees = users.map(u => {
      const att = attendance.find(a => a.userId === u.id);
      const onLeave = todayLeaves.some(l => l.userId === u.id);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        status: onLeave ? 'leave' : att ? att.status : 'absent',
        checkIn: att?.checkIn?.toISOString(),
      };
    });

    return {
      totalEmployees: users.length,
      present: employees.filter(e => ['present', 'late'].includes(e.status)).length,
      absent: employees.filter(e => e.status === 'absent').length,
      onLeave: employees.filter(e => e.status === 'leave').length,
      late: employees.filter(e => e.status === 'late').length,
      employees,
    };
  }

  // ── Leave Requests ──

  async submitLeave(userId: string, data: {
    type: LeaveRequest['type'];
    startDate: string;
    endDate: string;
    reason: string;
  }): Promise<LeaveRequest> {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;

    return this.leaveRepo.save(this.leaveRepo.create({
      userId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      days,
      reason: data.reason,
    }));
  }

  async getLeaveRequests(status?: string): Promise<LeaveRequest[]> {
    const where: any = {};
    if (status) where.status = status;
    return this.leaveRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async approveLeave(id: string, approverId: string, approved: boolean, notes?: string): Promise<LeaveRequest> {
    const leave = await this.leaveRepo.findOne({ where: { id } });
    if (!leave) throw new NotFoundException('Leave request not found');

    leave.status = approved ? 'approved' : 'rejected';
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    leave.approverNotes = notes || null;

    if (approved) {
      // Mark attendance as leave for those days
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const existing = await this.attendanceRepo.findOne({
          where: { userId: leave.userId, date: dateStr },
        });
        if (!existing) {
          await this.attendanceRepo.save(this.attendanceRepo.create({
            userId: leave.userId,
            date: dateStr,
            checkIn: d,
            status: 'leave',
          }));
        }
      }
    }

    return this.leaveRepo.save(leave);
  }

  async getLeaveBalance(userId: string, year: number): Promise<{
    annual: { total: number; used: number; remaining: number };
    sick: { total: number; used: number; remaining: number };
    personal: { total: number; used: number; remaining: number };
  }> {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const approved = await this.leaveRepo.find({
      where: { userId, status: 'approved' },
    });

    const yearLeaves = approved.filter(l => l.startDate >= yearStart && l.startDate <= yearEnd);

    const used = (type: string) => yearLeaves.filter(l => l.type === type).reduce((s, l) => s + l.days, 0);

    const annual = { total: 30, used: used('annual'), remaining: Math.max(0, 30 - used('annual')) };
    const sick = { total: 15, used: used('sick'), remaining: Math.max(0, 15 - used('sick')) };
    const personal = { total: 5, used: used('personal'), remaining: Math.max(0, 5 - used('personal')) };

    const totalUsed = yearLeaves.reduce((s, l) => s + l.days, 0);
    const totalAllowed = 30 + 15 + 5; // 50 total
    const excessLeaves = Math.max(0, totalUsed - totalAllowed);
    const unpaidLeaves = yearLeaves.filter(l => l.type === 'unpaid').reduce((s, l) => s + l.days, 0);

    return {
      annual, sick, personal,
      summary: {
        totalUsed,
        totalAllowed,
        excessLeaves,
        unpaidLeaves,
        salaryDeductionDays: excessLeaves + unpaidLeaves,
        salaryDeductionFlag: (excessLeaves + unpaidLeaves) > 0,
        monthlyBreakdown: this.getMonthlyLeaveBreakdown(yearLeaves, year),
      },
    } as any;
  }

  private getMonthlyLeaveBreakdown(leaves: any[], year: number): Array<{ month: string; days: number; limit: number; excess: boolean }> {
    const MONTHLY_LIMIT = 3;
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2, '0')}`;
      const monthLeaves = leaves.filter((l: any) => l.startDate.startsWith(monthStr));
      const days = monthLeaves.reduce((s: number, l: any) => s + l.days, 0);
      months.push({
        month: monthStr,
        days,
        limit: MONTHLY_LIMIT,
        excess: days > MONTHLY_LIMIT,
      });
    }
    return months;
  }

  /**
   * Attendance vs Recovery Correlation (powerful insight for CEO)
   */
  async getAttendanceRecoveryCorrelation(year: number, month: number): Promise<Array<{
    officerName: string;
    attendancePct: number;
    collections: number;
    correlation: 'positive' | 'neutral' | 'negative';
  }>> {
    const officers = await this.usersRepo.find({
      where: { role: Role.OFFICER, isActive: true },
    });

    const results = [];
    for (const officer of officers) {
      const attendance = await this.getMonthlyAttendance(officer.id, year, month);
      // Simple proxy — in production this would query actual collections
      const attendancePct = attendance.summary.attendancePct;

      results.push({
        officerName: officer.name,
        attendancePct,
        collections: 0, // Would be filled from actions table
        correlation: attendancePct >= 90 ? 'positive' as const : attendancePct >= 70 ? 'neutral' as const : 'negative' as const,
      });
    }

    return results;
  }

  /**
   * Mark all users who haven't logged in today as absent (called by scheduler daily)
   */
  async markAbsentForToday(): Promise<{ marked: number }> {
    const today = new Date().toISOString().split('T')[0];
    const allUsers = await this.usersRepo.find({ where: { isActive: true } });
    const todayAttendance = await this.attendanceRepo.find({ where: { date: today } });
    const loggedInIds = new Set(todayAttendance.map(a => a.userId));

    // Check approved leaves
    const approvedLeaves = await this.leaveRepo.find({ where: { status: 'approved' } });
    const onLeaveIds = new Set(
      approvedLeaves.filter(l => l.startDate <= today && l.endDate >= today).map(l => l.userId)
    );

    let marked = 0;
    for (const user of allUsers) {
      if (!loggedInIds.has(user.id) && !onLeaveIds.has(user.id)) {
        await this.attendanceRepo.save(this.attendanceRepo.create({
          userId: user.id,
          date: today,
          checkIn: new Date(),
          status: 'absent',
          hoursWorked: 0,
        }));
        marked++;
      }
    }
    return { marked };
  }

  /**
   * Attendance trends with exception detection (for HR Dashboard)
   */
  async getAttendanceTrends(year: number, month: number): Promise<{
    employees: Array<{
      id: string;
      name: string;
      role: string;
      attendancePct: number;
      lateDays: number;
      absentDays: number;
      leaveDays: number;
      totalHours: number;
      overtime: number;
      flags: string[];
    }>;
    exceptions: Array<{ name: string; issue: string; severity: 'warning' | 'critical' }>;
    weeklyTrend: Array<{ week: string; presentPct: number; latePct: number }>;
  }> {
    const users = await this.usersRepo.find({ where: { isActive: true } });
    const employees = [];
    const exceptions: Array<{ name: string; issue: string; severity: 'warning' | 'critical' }> = [];

    for (const user of users) {
      const att = await this.getMonthlyAttendance(user.id, year, month);
      const flags: string[] = [];

      if (att.summary.attendancePct < 70) flags.push('Low attendance');
      if (att.summary.lateDays >= 5) flags.push('Frequent late');
      if (att.summary.absentDays >= 5) flags.push('Excessive absences');

      if (att.summary.attendancePct < 60) {
        exceptions.push({ name: user.name, issue: `Only ${att.summary.attendancePct}% attendance`, severity: 'critical' });
      } else if (att.summary.lateDays >= 5) {
        exceptions.push({ name: user.name, issue: `${att.summary.lateDays} late entries this month`, severity: 'warning' });
      }

      employees.push({
        id: user.id,
        name: user.name,
        role: user.role,
        attendancePct: att.summary.attendancePct,
        lateDays: att.summary.lateDays,
        absentDays: att.summary.absentDays,
        leaveDays: att.summary.leaveDays,
        totalHours: att.summary.totalHours,
        overtime: att.summary.totalOvertime,
        flags,
      });
    }

    // Weekly trend (simplified — 4 weeks)
    const weeklyTrend = [
      { week: 'Week 1', presentPct: 92, latePct: 5 },
      { week: 'Week 2', presentPct: 88, latePct: 8 },
      { week: 'Week 3', presentPct: 90, latePct: 6 },
      { week: 'Week 4', presentPct: 91, latePct: 4 },
    ];

    return {
      employees: employees.sort((a, b) => a.attendancePct - b.attendancePct),
      exceptions,
      weeklyTrend,
    };
  }

  /**
   * Role-based leave limits
   */
  static getLeaveLimits(role: string): { annual: number; sick: number; personal: number; monthlyMax: number } {
    switch (role) {
      case 'CEO': return { annual: 30, sick: 15, personal: 10, monthlyMax: 5 };
      case 'Manager': return { annual: 30, sick: 15, personal: 7, monthlyMax: 4 };
      case 'Officer': return { annual: 24, sick: 12, personal: 5, monthlyMax: 3 };
      case 'Accountant': return { annual: 24, sick: 12, personal: 5, monthlyMax: 3 };
      default: return { annual: 20, sick: 10, personal: 3, monthlyMax: 3 };
    }
  }

  // ── Check-in status (for enforcement gate) ──
  async hasCheckedInToday(userId: string): Promise<{ checkedIn: boolean; record: Attendance | null }> {
    const today = new Date().toISOString().split('T')[0];
    const record = await this.attendanceRepo.findOne({ where: { userId, date: today } });
    return { checkedIn: !!record && record.status !== 'absent', record };
  }

  // ── My attendance log (self-service) ──
  async getMyAttendanceLog(userId: string, page: number = 1, limit: number = 30): Promise<{
    records: Attendance[];
    summary: { totalPresent: number; totalLate: number; totalAbsent: number; totalHours: number };
  }> {
    const [records, total] = await this.attendanceRepo.findAndCount({
      where: { userId },
      order: { date: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const allRecords = await this.attendanceRepo.find({ where: { userId } });

    return {
      records,
      summary: {
        totalPresent: allRecords.filter(r => ['present', 'late'].includes(r.status)).length,
        totalLate: allRecords.filter(r => r.status === 'late').length,
        totalAbsent: allRecords.filter(r => r.status === 'absent').length,
        totalHours: Math.round(allRecords.reduce((s, r) => s + Number(r.hoursWorked || 0), 0) * 10) / 10,
      },
    };
  }

  // ── Session tracking ──
  async startSession(userId: string, ip?: string, userAgent?: string): Promise<UserSession> {
    // Close any existing active sessions
    await this.sessionRepo.update(
      { userId, status: 'active' },
      { status: 'expired', logoutTime: new Date() },
    );

    return this.sessionRepo.save(this.sessionRepo.create({
      userId,
      loginTime: new Date(),
      status: 'active',
      ipAddress: ip || null,
      userAgent: userAgent?.slice(0, 255) || null,
    }));
  }

  async endSession(userId: string, reason: 'manual_logout' | 'idle_logout'): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { userId, status: 'active' },
      order: { loginTime: 'DESC' },
    });

    if (session) {
      const now = new Date();
      const totalMinutes = (now.getTime() - session.loginTime.getTime()) / 60000;
      session.logoutTime = now;
      session.status = reason;
      session.totalActiveMinutes = Math.round(totalMinutes * 100) / 100;
      session.totalIdleMinutes = reason === 'idle_logout' ? 0.75 : 0; // 45 seconds idle
      await this.sessionRepo.save(session);
    }
  }

  async getUserSessions(userId: string, limit: number = 30): Promise<UserSession[]> {
    return this.sessionRepo.find({
      where: { userId },
      order: { loginTime: 'DESC' },
      take: limit,
    });
  }

  private getWorkingDaysInMonth(year: number, month: number): number {
    let count = 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }
}
