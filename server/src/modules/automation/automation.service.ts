import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Case } from '../cases/entities/case.entity';
import { Action } from '../actions/entities/action.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { WorkflowRule } from './entities/workflow-rule.entity';
import { CreateWorkflowRuleDto } from './dto/create-workflow-rule.dto';
import { Role } from '../../common/enums';
import { EventsService } from '../websocket/events.service';

/**
 * Smart Automation Engine
 *
 * Rule-based workflow engine that runs periodically:
 * 1. "If no contact in 3 days → auto reminder to officer"
 * 2. "If high-value case (>100K) → flag for senior officer"
 * 3. "If PTP broken 2+ times → escalate to manager"
 * 4. "If case in CB for 30+ days → auto change to NCC"
 * 5. "If officer has 100+ cases → alert manager for rebalancing"
 * 6. "AI predict: cases likely to be withdrawn soon"
 */

export interface AutomationRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
}

export interface AutomationResult {
  ruleName: string;
  casesAffected: number;
  actionsCreated: number;
  details: string[];
}

@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Action) private actionsRepo: Repository<Action>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(WorkflowRule) private rulesRepo: Repository<WorkflowRule>,
    @Optional() private eventsService?: EventsService,
  ) {}

  onModuleInit() {
    // Run every 60 minutes
    setInterval(() => this.runAllRules(), 60 * 60 * 1000);
    setTimeout(() => this.runAllRules(), 15000);
    this.logger.log('Automation engine initialized');
  }

  async runAllRules(): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];

    results.push(await this.ruleNoContactReminder());
    results.push(await this.ruleHighValueFlag());
    results.push(await this.ruleBrokenPtpEscalation());
    results.push(await this.ruleStaleCbAutoNcc());
    results.push(await this.ruleOverloadedOfficer());

    // Emit real-time event for each rule that affected cases
    for (const result of results) {
      if (result.casesAffected > 0 && this.eventsService) {
        this.eventsService.emitWorkflowTriggered(result.ruleName, result.casesAffected);
      }
    }

    this.logger.log(`Automation ran ${results.length} rules, affected ${results.reduce((s, r) => s + r.casesAffected, 0)} cases`);
    return results;
  }

  // ─── CRUD for custom workflow rules ──────────────────────────────────────

  async getRules(): Promise<WorkflowRule[]> {
    return this.rulesRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createRule(dto: CreateWorkflowRuleDto, createdBy?: string): Promise<WorkflowRule> {
    const rule = this.rulesRepo.create({
      ...dto,
      triggerParams: dto.triggerParams || {},
      conditions: dto.conditions || [],
      enabled: dto.enabled !== false,
      createdBy,
    });
    return this.rulesRepo.save(rule);
  }

  async updateRule(id: string, dto: Partial<CreateWorkflowRuleDto>): Promise<WorkflowRule | null> {
    await this.rulesRepo.update(id, dto);
    return this.rulesRepo.findOne({ where: { id } });
  }

  async toggleRule(id: string): Promise<WorkflowRule | null> {
    const rule = await this.rulesRepo.findOne({ where: { id } });
    if (!rule) return null;
    rule.enabled = !rule.enabled;
    return this.rulesRepo.save(rule);
  }

  async deleteRule(id: string): Promise<void> {
    await this.rulesRepo.delete(id);
  }

  async runRule(id: string): Promise<{ casesAffected: number; detail: string }> {
    const rule = await this.rulesRepo.findOne({ where: { id } });
    if (!rule) return { casesAffected: 0, detail: 'Rule not found' };

    // Execute the built-in equivalent if exists, otherwise generic notification
    let casesAffected = 0;
    let detail = `Rule "${rule.name}" executed`;

    if (rule.trigger === 'ptp_broken') {
      const result = await this.ruleBrokenPtpEscalation();
      casesAffected = result.casesAffected;
      detail = result.details.join('; ') || detail;
    } else if (rule.trigger === 'no_contact_days') {
      const result = await this.ruleNoContactReminder();
      casesAffected = result.casesAffected;
      detail = result.details.join('; ') || detail;
    } else if (rule.trigger === 'high_value') {
      const result = await this.ruleHighValueFlag();
      casesAffected = result.casesAffected;
      detail = result.details.join('; ') || detail;
    } else if (rule.trigger === 'officer_overloaded') {
      const result = await this.ruleOverloadedOfficer();
      casesAffected = result.actionsCreated;
      detail = result.details.join('; ') || detail;
    } else {
      detail = `Rule triggered — custom trigger type: ${rule.trigger}`;
    }

    await this.rulesRepo.update(id, { runCount: rule.runCount + 1, lastRun: new Date() });

    if (casesAffected > 0 && this.eventsService) {
      this.eventsService.emitWorkflowTriggered(rule.name, casesAffected);
    }

    return { casesAffected, detail };
  }

  /**
   * Rule 1: No contact in 3 days → reminder
   */
  private async ruleNoContactReminder(): Promise<AutomationResult> {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const cases = await this.casesRepo.find({
      where: {
        crmStatus: In(['CB', 'PTP', 'FIP', 'UNDER NEGO', 'WIP']),
      },
    });

    const staleCases = cases.filter(c =>
      !c.lastContactDate || new Date(c.lastContactDate) < threeDaysAgo
    );
    const details: string[] = [];

    const officerGroups = new Map<string, number>();
    for (const c of staleCases) {
      officerGroups.set(c.assignedOfficerId, (officerGroups.get(c.assignedOfficerId) || 0) + 1);
    }

    for (const [officerId, count] of officerGroups) {
      await this.notify(officerId, `Auto-reminder: You have ${count} cases with no contact in 3+ days. Please prioritize follow-ups.`, 'Normal');
      details.push(`Officer ${officerId.slice(0, 8)}: ${count} stale cases`);
    }

    return { ruleName: 'No Contact 3-Day Reminder', casesAffected: staleCases.length, actionsCreated: officerGroups.size, details };
  }

  /**
   * Rule 2: High-value cases (>100K) → flag
   */
  private async ruleHighValueFlag(): Promise<AutomationResult> {
    const cases = await this.casesRepo.createQueryBuilder('c')
      .leftJoin('c.loan', 'loan')
      .where("c.crmStatus NOT IN ('Closed', 'Withdrawn')")
      .andWhere('loan.currentBalance > 100000')
      .andWhere("c.statusCode IS NULL OR c.statusCode != 'HIGH_VALUE'")
      .select(['c.id', 'c.assignedOfficerId', 'c.statusCode'])
      .getMany();

    for (const c of cases) {
      await this.casesRepo.update(c.id, { statusCode: 'HIGH_VALUE' });
    }

    // Notify managers
    if (cases.length > 0) {
      const managers = await this.usersRepo.find({ where: { role: Role.MANAGER, isActive: true } });
      for (const m of managers) {
        await this.notify(m.id, `${cases.length} high-value cases (>100K AED) flagged for attention.`, 'Urgent');
      }
    }

    return { ruleName: 'High-Value Case Flag', casesAffected: cases.length, actionsCreated: cases.length, details: [`${cases.length} cases flagged`] };
  }

  /**
   * Rule 3: Broken PTP 2+ times → escalate
   */
  private async ruleBrokenPtpEscalation(): Promise<AutomationResult> {
    const ptpCases = await this.casesRepo.find({
      where: { crmStatus: 'PTP' },
      relations: ['history'],
    });

    const details: string[] = [];
    let escalated = 0;

    for (const c of ptpCases) {
      const ptpActions = (c.history || []).filter(a => a.promisedDate != null);
      const overduePtps = ptpActions.filter(a => new Date(a.promisedDate!) < new Date());

      if (overduePtps.length >= 2) {
        const managers = await this.usersRepo.find({ where: { role: Role.MANAGER, isActive: true } });
        for (const m of managers) {
          await this.notify(m.id, `Case ${c.id.slice(0, 8)} has ${overduePtps.length} broken PTPs. Consider escalation or legal action.`, 'Urgent');
        }
        escalated++;
        details.push(`Case ${c.id.slice(0, 8)}: ${overduePtps.length} broken PTPs`);
      }
    }

    return { ruleName: 'Broken PTP Escalation', casesAffected: escalated, actionsCreated: escalated, details };
  }

  /**
   * Rule 4: CB for 30+ days → auto NCC
   */
  private async ruleStaleCbAutoNcc(): Promise<AutomationResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const staleCb = await this.casesRepo.find({
      where: { crmStatus: 'CB', contactStatus: 'Non Contact' },
    });

    const affected = staleCb.filter(c => new Date(c.creationDate) < thirtyDaysAgo);
    for (const c of affected) {
      c.crmStatus = 'NCC';
      await this.casesRepo.save(c);
    }

    return { ruleName: 'Stale CB → NCC', casesAffected: affected.length, actionsCreated: affected.length, details: [`${affected.length} cases moved to NCC`] };
  }

  /**
   * Rule 5: Overloaded officer (100+ cases)
   */
  private async ruleOverloadedOfficer(): Promise<AutomationResult> {
    const officers = await this.usersRepo.find({ where: { role: Role.OFFICER, isActive: true } });
    const details: string[] = [];

    for (const officer of officers) {
      const count = await this.casesRepo.count({
        where: { assignedOfficerId: officer.id, crmStatus: In(['CB', 'PTP', 'FIP', 'UNDER NEGO', 'WIP', 'DXB', 'UTR']) },
      });

      if (count > 100) {
        const managers = await this.usersRepo.find({ where: { role: Role.MANAGER, isActive: true } });
        for (const m of managers) {
          await this.notify(m.id, `Officer ${officer.name} has ${count} active cases. Consider rebalancing workload.`, 'Normal');
        }
        details.push(`${officer.name}: ${count} cases`);
      }
    }

    return { ruleName: 'Overloaded Officer Alert', casesAffected: 0, actionsCreated: details.length, details };
  }

  /**
   * AI: Predict cases likely to be withdrawn
   */
  async predictLikelyWithdrawals(): Promise<Array<{
    caseId: string;
    debtorName: string;
    probability: number;
    reasons: string[];
  }>> {
    const cases = await this.casesRepo.find({
      where: { crmStatus: In(['NCC', 'UTR', 'NITP', 'Expire']) },
      relations: ['debtor', 'loan', 'history'],
    });

    return cases.map(c => {
      let probability = 30;
      const reasons: string[] = [];

      if (c.crmStatus === 'NCC') { probability += 20; reasons.push('Non-contactable'); }
      if (c.crmStatus === 'NITP') { probability += 25; reasons.push('Not interested to pay'); }
      if (c.crmStatus === 'Expire') { probability += 30; reasons.push('Case expired'); }

      // No contact in 60+ days
      if (!c.lastContactDate || (Date.now() - new Date(c.lastContactDate).getTime()) > 60 * 86400000) {
        probability += 15;
        reasons.push('No contact in 60+ days');
      }

      // No payments ever
      const payments = (c.history || []).filter(h => h.type === 'Payment Received');
      if (payments.length === 0) { probability += 10; reasons.push('Zero payments made'); }

      probability = Math.min(95, probability);

      return {
        caseId: c.id,
        debtorName: c.debtor?.name || 'Unknown',
        probability,
        reasons,
      };
    }).filter(c => c.probability >= 50).sort((a, b) => b.probability - a.probability);
  }

  private async notify(recipientId: string, message: string, priority: 'Normal' | 'Urgent') {
    const today = new Date().toISOString().split('T')[0];
    // Avoid duplicate notifications for same message today
    const existing = await this.notifRepo.createQueryBuilder('n')
      .where('n.recipientId = :recipientId', { recipientId })
      .andWhere('n.message = :message', { message })
      .andWhere("n.createdAt >= :today", { today: new Date(today) })
      .getCount();

    if (existing === 0) {
      await this.notifRepo.save(this.notifRepo.create({
        senderId: 'system',
        senderName: 'Automation Engine',
        recipientId,
        message,
        priority,
        isTask: priority === 'Urgent',
        taskStatus: priority === 'Urgent' ? 'pending' : null,
      }));
    }
  }
}
