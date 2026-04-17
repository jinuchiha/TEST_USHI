import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { OfficerTask } from './entities/task.entity';
import { Badge } from './entities/badge.entity';
import { Case } from '../cases/entities/case.entity';
import { Action } from '../actions/entities/action.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums';

@Injectable()
export class ProductivityService {
  constructor(
    @InjectRepository(OfficerTask) private taskRepo: Repository<OfficerTask>,
    @InjectRepository(Badge) private badgeRepo: Repository<Badge>,
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Action) private actionsRepo: Repository<Action>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  // ── AI Task Generation ──
  async generateDailyTasks(officerId: string): Promise<OfficerTask[]> {
    const today = new Date().toISOString().split('T')[0];

    // Check if already generated today
    const existing = await this.taskRepo.find({
      where: { officerId, dueDate: today, source: 'ai_generated' },
    });
    if (existing.length > 0) return existing;

    const tasks: Partial<OfficerTask>[] = [];

    // 1. PTP follow-ups due today
    const ptpCases = await this.actionsRepo.createQueryBuilder('a')
      .innerJoin('a.case', 'c')
      .where('a.promisedDate = :today', { today })
      .andWhere('c.assignedOfficerId = :officerId', { officerId })
      .andWhere("c.crmStatus = 'PTP'")
      .select(['a.caseId', 'a.promisedAmount'])
      .getMany();

    for (const ptp of ptpCases) {
      tasks.push({
        officerId,
        caseId: ptp.caseId,
        title: `Follow up on PTP case — payment due today`,
        description: `Promised amount: ${ptp.promisedAmount || 'N/A'}`,
        priority: 'high',
        source: 'ai_generated',
        dueDate: today,
      });
    }

    // 2. Stale cases needing contact
    const staleCases = await this.casesRepo.createQueryBuilder('c')
      .where('c.assignedOfficerId = :officerId', { officerId })
      .andWhere("c.crmStatus NOT IN ('Closed', 'Withdrawn', 'NIP')")
      .andWhere("(c.lastContactDate IS NULL OR c.lastContactDate < :stale)", {
        stale: new Date(Date.now() - 7 * 86400000),
      })
      .select(['c.id'])
      .take(5)
      .getMany();

    for (const c of staleCases) {
      tasks.push({
        officerId,
        caseId: c.id,
        title: `Contact stale case — no activity in 7+ days`,
        priority: 'medium',
        source: 'ai_generated',
        dueDate: today,
      });
    }

    // 3. General task
    if (tasks.length === 0) {
      tasks.push({
        officerId,
        title: 'Review and update case statuses',
        description: 'Ensure all active cases have accurate contact and work statuses.',
        priority: 'low',
        source: 'ai_generated',
        dueDate: today,
      });
    }

    const saved = [];
    for (const t of tasks) {
      saved.push(await this.taskRepo.save(this.taskRepo.create(t)));
    }
    return saved;
  }

  async getMyTasks(officerId: string, status?: string): Promise<OfficerTask[]> {
    const where: any = { officerId };
    if (status) where.status = status;
    return this.taskRepo.find({ where, order: { priority: 'ASC', dueDate: 'ASC' } });
  }

  async updateTaskStatus(id: string, status: OfficerTask['status']): Promise<OfficerTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new Error('Task not found');
    task.status = status;
    if (status === 'completed') task.completedAt = new Date();
    return this.taskRepo.save(task);
  }

  // ── Gamification / Leaderboard ──
  async getLeaderboard(period: 'week' | 'month' | 'all'): Promise<Array<{
    rank: number;
    officerId: string;
    officerName: string;
    agentCode: string | null;
    totalCollected: number;
    casesClosed: number;
    tasksCompleted: number;
    badges: number;
    score: number;
  }>> {
    const officers = await this.usersRepo.find({
      where: { role: Role.OFFICER, isActive: true },
    });

    let dateFilter = '';
    const now = new Date();
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      dateFilter = `AND a."createdAt" >= '${weekAgo}'`;
    } else if (period === 'month') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      dateFilter = `AND a."createdAt" >= '${monthStart}'`;
    }

    const results = [];
    for (const officer of officers) {
      const collections = await this.actionsRepo.query(
        `SELECT COALESCE(SUM(a."amountPaid"), 0) as total, COUNT(*) as count
         FROM actions a WHERE a."officerId" = $1 AND a.type = 'Payment Received' ${dateFilter}`,
        [officer.id],
      );

      const tasksCompleted = await this.taskRepo.count({
        where: { officerId: officer.id, status: 'completed' },
      });

      const badgeCount = await this.badgeRepo.count({
        where: { userId: officer.id },
      });

      const totalCollected = parseFloat(collections[0]?.total || '0');
      const casesClosed = parseInt(collections[0]?.count || '0', 10);

      // Composite score: collections weighted most
      const score = Math.round(totalCollected / 1000 + casesClosed * 10 + tasksCompleted * 5 + badgeCount * 20);

      results.push({
        rank: 0,
        officerId: officer.id,
        officerName: officer.name,
        agentCode: officer.agentCode,
        totalCollected,
        casesClosed,
        tasksCompleted,
        badges: badgeCount,
        score,
      });
    }

    results.sort((a, b) => b.score - a.score);
    results.forEach((r, i) => r.rank = i + 1);
    return results;
  }

  async getOfficerBadges(userId: string): Promise<Badge[]> {
    return this.badgeRepo.find({ where: { userId }, order: { earnedAt: 'DESC' } });
  }

  async awardBadge(userId: string, type: Badge['type'], title: string, description?: string, period?: string): Promise<Badge> {
    // Check for duplicates
    const existing = await this.badgeRepo.findOne({
      where: { userId, type, period: period || undefined } as any,
    });
    if (existing) return existing;

    return this.badgeRepo.save(this.badgeRepo.create({
      userId, type, title, description, period,
    }));
  }

  // ── Performance Review Data ──
  async getPerformanceReview(officerId: string, year: number, month: number): Promise<{
    collections: number;
    casesClosed: number;
    avgResponseTime: number;
    tasksCompletionRate: number;
    ptpConversionRate: number;
    attendancePct: number;
    badges: Badge[];
    strengths: string[];
    improvements: string[];
  }> {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const startDate = `${monthStr}-01`;
    const endDate = `${monthStr}-31`;

    const collectionsResult = await this.actionsRepo.query(
      `SELECT COALESCE(SUM("amountPaid"), 0) as total, COUNT(*) as count
       FROM actions WHERE "officerId" = $1 AND type = 'Payment Received'
       AND "createdAt" >= $2 AND "createdAt" <= $3`,
      [officerId, startDate, endDate + 'T23:59:59'],
    );

    const totalTasks = await this.taskRepo.count({ where: { officerId } });
    const completedTasks = await this.taskRepo.count({ where: { officerId, status: 'completed' } });

    const badges = await this.badgeRepo.find({ where: { userId: officerId } });
    const collections = parseFloat(collectionsResult[0]?.total || '0');
    const casesClosed = parseInt(collectionsResult[0]?.count || '0', 10);
    const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const strengths: string[] = [];
    const improvements: string[] = [];

    if (collections > 50000) strengths.push('Strong collection performance');
    if (taskRate > 80) strengths.push('Excellent task completion rate');
    if (casesClosed > 5) strengths.push('Good case closure rate');

    if (collections < 20000) improvements.push('Increase collection focus');
    if (taskRate < 50) improvements.push('Improve task completion discipline');

    return {
      collections,
      casesClosed,
      avgResponseTime: 24, // placeholder
      tasksCompletionRate: taskRate,
      ptpConversionRate: 35, // placeholder
      attendancePct: 95, // placeholder
      badges,
      strengths,
      improvements,
    };
  }
}
