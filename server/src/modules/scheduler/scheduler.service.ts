import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { Case } from '../cases/entities/case.entity';
import { Action } from '../actions/entities/action.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums';

/**
 * Scheduler Service
 *
 * Runs periodic tasks:
 * - PTP follow-up reminders (promise-to-pay due dates)
 * - Stale case alerts (no contact in X days)
 * - Daily summary notifications to managers
 * - Overdue payment reminders
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private intervals: NodeJS.Timeout[] = [];

  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Action) private actionsRepo: Repository<Action>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  onModuleInit() {
    // Run checks every 30 minutes
    this.intervals.push(
      setInterval(() => this.runScheduledTasks(), 30 * 60 * 1000),
    );
    // Run initial check after 10 seconds (let app boot)
    setTimeout(() => this.runScheduledTasks(), 10000);
    this.logger.log('Scheduler initialized');
  }

  async runScheduledTasks() {
    try {
      await this.checkPtpDueDates();
      await this.checkStaleCases();
      this.logger.log('Scheduled tasks completed');
    } catch (err) {
      this.logger.error('Scheduled task error', err);
    }
  }

  /**
   * Check for PTP cases with promised dates that are today or overdue
   */
  async checkPtpDueDates() {
    const today = new Date().toISOString().split('T')[0];

    // Find actions with promised dates that are due today or past
    const dueActions = await this.actionsRepo
      .createQueryBuilder('action')
      .innerJoin('action.case', 'case')
      .where('action.promisedDate IS NOT NULL')
      .andWhere('action.promisedDate <= :today', { today })
      .andWhere("case.crmStatus = 'PTP'")
      .select(['action.id', 'action.caseId', 'action.promisedDate', 'action.promisedAmount', 'action.officerId'])
      .getMany();

    for (const action of dueActions) {
      // Check if we already sent a reminder for this action
      const existing = await this.notifRepo
        .createQueryBuilder('notif')
        .where("notif.message LIKE :pattern", {
          pattern: `%PTP reminder%${action.caseId}%`,
        })
        .andWhere("notif.createdAt >= :today", { today: new Date(today) })
        .getCount();

      if (existing === 0) {
        await this.notifRepo.save(
          this.notifRepo.create({
            senderId: 'system',
            senderName: 'AI Assistant',
            recipientId: action.officerId,
            message: `PTP reminder: Case ${action.caseId.slice(0, 8)}... has a promised payment of ${action.promisedAmount || 'N/A'} due on ${action.promisedDate}. Follow up with the debtor today.`,
            priority: 'Urgent',
            isTask: true,
            taskStatus: 'pending',
          }),
        );
      }
    }

    if (dueActions.length > 0) {
      this.logger.log(`Sent ${dueActions.length} PTP reminders`);
    }
  }

  /**
   * Find cases with no contact in 14+ days and alert the assigned officer
   */
  async checkStaleCases() {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 14);

    const staleCases = await this.casesRepo
      .createQueryBuilder('case')
      .where("case.crmStatus NOT IN (:...excluded)", {
        excluded: ['Closed', 'Withdrawn', 'NIP'],
      })
      .andWhere('(case.lastContactDate IS NULL OR case.lastContactDate < :staleDate)', {
        staleDate,
      })
      .select(['case.id', 'case.assignedOfficerId', 'case.lastContactDate', 'case.crmStatus'])
      .getMany();

    // Group by officer
    const officerCases = new Map<string, string[]>();
    for (const c of staleCases) {
      const list = officerCases.get(c.assignedOfficerId) || [];
      list.push(c.id);
      officerCases.set(c.assignedOfficerId, list);
    }

    const today = new Date().toISOString().split('T')[0];

    for (const [officerId, caseIds] of officerCases) {
      // Only send one stale alert per officer per day
      const existing = await this.notifRepo
        .createQueryBuilder('notif')
        .where("notif.message LIKE :pattern", { pattern: '%stale cases%' })
        .andWhere('notif.recipientId = :officerId', { officerId })
        .andWhere("notif.createdAt >= :today", { today: new Date(today) })
        .getCount();

      if (existing === 0 && caseIds.length > 0) {
        await this.notifRepo.save(
          this.notifRepo.create({
            senderId: 'system',
            senderName: 'AI Assistant',
            recipientId: officerId,
            message: `You have ${caseIds.length} stale cases with no contact in 14+ days. Please prioritize follow-ups to maintain recovery momentum.`,
            priority: caseIds.length > 5 ? 'Urgent' : 'Normal',
            isTask: true,
            taskStatus: 'pending',
          }),
        );
      }
    }

    if (staleCases.length > 0) {
      this.logger.log(`Found ${staleCases.length} stale cases across ${officerCases.size} officers`);
    }
  }

  /**
   * Generate daily summary for managers (call from cron or manual trigger)
   */
  async generateDailySummary(): Promise<{
    totalActiveCases: number;
    paymentsToday: { count: number; total: number };
    ptpDueToday: number;
    staleCaseCount: number;
    topPerformers: Array<{ name: string; collections: number }>;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const totalActiveCases = await this.casesRepo.count({
      where: [
        { crmStatus: In(['CB', 'PTP', 'FIP', 'UNDER NEGO', 'WIP', 'DXB', 'UTR']) },
      ],
    });

    const paymentsResult = await this.actionsRepo
      .createQueryBuilder('action')
      .where('action.type = :type', { type: 'Payment Received' })
      .andWhere('DATE(action.createdAt) = :today', { today })
      .select('COALESCE(SUM(action.amountPaid), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .getRawOne();

    const ptpDueToday = await this.actionsRepo
      .createQueryBuilder('action')
      .innerJoin('action.case', 'case')
      .where('action.promisedDate = :today', { today })
      .andWhere("case.crmStatus = 'PTP'")
      .getCount();

    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 14);
    const staleCaseCount = await this.casesRepo
      .createQueryBuilder('case')
      .where("case.crmStatus NOT IN (:...excluded)", { excluded: ['Closed', 'Withdrawn', 'NIP'] })
      .andWhere('(case.lastContactDate IS NULL OR case.lastContactDate < :staleDate)', { staleDate })
      .getCount();

    // Top performers today
    const topPerformers = await this.actionsRepo
      .createQueryBuilder('action')
      .innerJoin(User, 'user', 'user.id = action.officerId')
      .where('action.type = :type', { type: 'Payment Received' })
      .andWhere('DATE(action.createdAt) = :today', { today })
      .select('user.name', 'name')
      .addSelect('COALESCE(SUM(action.amountPaid), 0)', 'collections')
      .groupBy('user.name')
      .orderBy('collections', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      totalActiveCases,
      paymentsToday: {
        count: parseInt(paymentsResult?.count || '0', 10),
        total: parseFloat(paymentsResult?.total || '0'),
      },
      ptpDueToday,
      staleCaseCount,
      topPerformers: topPerformers.map(p => ({
        name: p.name,
        collections: parseFloat(p.collections),
      })),
    };
  }
}
