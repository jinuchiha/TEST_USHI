import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/entities/case.entity';
import { Action } from '../actions/entities/action.entity';
import { User } from '../users/entities/user.entity';
import { Loan } from '../loans/entities/loan.entity';
import { Debtor } from '../debtors/entities/debtor.entity';
import { Role } from '../../common/enums';
import {
  calculateRecoveryScore,
  ScoringInput,
  RecoveryScore,
} from './engines/recovery-scoring.engine';
import {
  suggestAllocation,
  OfficerProfile,
  AllocationSuggestion,
} from './engines/smart-allocation.engine';
import {
  assessFraud,
  FraudInput,
  FraudAssessment,
} from './engines/fraud-detection.engine';
import { getNextBestAction, CaseContext, NextBestAction } from './engines/next-best-action.engine';
import { buildSmartQueue, QueuedCase } from './engines/smart-queue.engine';

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(Action) private actionsRepo: Repository<Action>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Loan) private loansRepo: Repository<Loan>,
    @InjectRepository(Debtor) private debtorsRepo: Repository<Debtor>,
  ) {}

  /**
   * Calculate recovery probability for a single case
   */
  async scoreCaseRecovery(caseId: string): Promise<RecoveryScore> {
    const caseEntity = await this.casesRepo.findOne({
      where: { id: caseId },
      relations: ['debtor', 'loan', 'history'],
    });
    if (!caseEntity) throw new NotFoundException('Case not found');

    const input = await this.buildScoringInput(caseEntity);
    return calculateRecoveryScore(input);
  }

  /**
   * Batch score all cases (or filtered subset) — for dashboard widgets
   */
  async scoreAllCases(officerId?: string): Promise<{
    scores: Array<{ caseId: string; debtorName: string; score: number; riskLevel: string; balance: number }>;
    summary: { avg: number; high: number; medium: number; low: number; total: number };
  }> {
    const qb = this.casesRepo.createQueryBuilder('case')
      .leftJoinAndSelect('case.debtor', 'debtor')
      .leftJoinAndSelect('case.loan', 'loan')
      .leftJoinAndSelect('case.history', 'history')
      .where("case.crmStatus NOT IN (:...excluded)", {
        excluded: ['Closed', 'Withdrawn'],
      });

    if (officerId) {
      qb.andWhere('case.assignedOfficerId = :officerId', { officerId });
    }

    const cases = await qb.getMany();
    const scores = [];
    let totalScore = 0;
    let high = 0, medium = 0, low = 0;

    for (const c of cases) {
      const input = await this.buildScoringInput(c);
      const result = calculateRecoveryScore(input);
      scores.push({
        caseId: c.id,
        debtorName: c.debtor?.name || 'Unknown',
        score: result.score,
        riskLevel: result.riskLevel,
        balance: Number(c.loan?.currentBalance || 0),
      });
      totalScore += result.score;

      if (result.score >= 60) high++;
      else if (result.score >= 30) medium++;
      else low++;
    }

    return {
      scores: scores.sort((a, b) => b.score - a.score),
      summary: {
        avg: cases.length > 0 ? Math.round(totalScore / cases.length) : 0,
        high,
        medium,
        low,
        total: cases.length,
      },
    };
  }

  /**
   * Smart allocation: suggest best officer for a case
   */
  async suggestOfficerForCase(caseId: string): Promise<AllocationSuggestion[]> {
    const caseEntity = await this.casesRepo.findOne({
      where: { id: caseId },
      relations: ['loan'],
    });
    if (!caseEntity) throw new NotFoundException('Case not found');

    const officers = await this.usersRepo.find({
      where: { role: Role.OFFICER, isActive: true },
    });

    const profiles: OfficerProfile[] = [];
    for (const officer of officers) {
      const caseCount = await this.casesRepo.count({
        where: { assignedOfficerId: officer.id },
      });

      const collections = await this.actionsRepo
        .createQueryBuilder('action')
        .where('action.officerId = :id', { id: officer.id })
        .andWhere('action.type = :type', { type: 'Payment Received' })
        .select('COALESCE(SUM(action.amountPaid), 0)', 'total')
        .addSelect('COUNT(*)', 'count')
        .getRawOne();

      const ptpCount = await this.casesRepo.count({
        where: { assignedOfficerId: officer.id, crmStatus: 'PTP' },
      });

      const totalCollected = parseFloat(collections?.total || '0');
      const totalCases = Math.max(caseCount, 1);

      profiles.push({
        id: officer.id,
        name: officer.name,
        agentCode: officer.agentCode,
        target: officer.target ? Number(officer.target) : null,
        caseCount,
        totalCollected,
        recoveryRate: totalCases > 0 ? (totalCollected / (totalCases * 50000)) * 100 : 0,
        avgDaysToResolve: 45, // placeholder — would need historical case resolution data
        activePtpCount: ptpCount,
      });
    }

    return suggestAllocation(
      profiles,
      Number(caseEntity.loan?.currentBalance || 0),
      caseEntity.crmStatus,
    );
  }

  /**
   * Fraud detection for a debtor
   */
  async assessDebtorFraud(debtorId: string): Promise<FraudAssessment> {
    const debtor = await this.debtorsRepo.findOne({ where: { id: debtorId } });
    if (!debtor) throw new NotFoundException('Debtor not found');

    // Find all cases for this debtor
    const cases = await this.casesRepo.find({
      where: { debtorId },
      relations: ['loan', 'history'],
    });

    const banks = new Set(cases.map(c => c.loan?.bank).filter(Boolean));
    const totalOutstanding = cases.reduce((sum, c) => sum + Number(c.loan?.currentBalance || 0), 0);
    const totalOriginal = cases.reduce((sum, c) => sum + Number(c.loan?.originalAmount || 0), 0);

    // Check for payment reversals (simplified — check if any payment was followed by balance increase)
    const hasPaymentReversals = false; // placeholder

    // Status change frequency
    const allActions = cases.flatMap(c => c.history || []);
    const statusChanges = allActions.filter(a => a.type === 'Status Update');
    const weeksSinceFirst = cases.length > 0
      ? Math.max(1, Math.round((Date.now() - new Date(cases[0].creationDate).getTime()) / (7 * 86400000)))
      : 1;
    const statusChangeFrequency = statusChanges.length / weeksSinceFirst;

    // Check if debtor is outside UAE
    const isOutUAE = cases.some(c =>
      c.subStatus === 'OUT-UAE' || c.subStatus === 'Out-UAE/Pakistan'
    );

    const input: FraudInput = {
      debtorId: debtor.id,
      debtorName: debtor.name,
      eid: debtor.eid,
      cnic: debtor.cnic,
      passport: debtor.passport,
      caseCount: cases.length,
      bankCount: banks.size,
      totalOutstanding,
      totalOriginal,
      hasPaymentReversals,
      statusChangeFrequency,
      daysSinceCreation: cases.length > 0
        ? Math.round((Date.now() - new Date(cases[0].creationDate).getTime()) / 86400000)
        : 0,
      isOutUAE,
    };

    return assessFraud(input);
  }

  /**
   * Portfolio-level AI insights for CEO/Manager dashboards
   */
  async getPortfolioInsights(): Promise<{
    totalExposure: number;
    predictedRecovery: number;
    highRiskCount: number;
    topOpportunities: Array<{ caseId: string; debtorName: string; score: number; balance: number }>;
    riskDistribution: { veryHigh: number; high: number; medium: number; low: number; veryLow: number };
  }> {
    const allScores = await this.scoreAllCases();

    const totalExposure = allScores.scores.reduce((sum, s) => sum + s.balance, 0);
    const predictedRecovery = allScores.scores.reduce((sum, s) => {
      return sum + (s.balance * s.score / 100);
    }, 0);

    const riskDistribution = { veryHigh: 0, high: 0, medium: 0, low: 0, veryLow: 0 };
    for (const s of allScores.scores) {
      if (s.riskLevel === 'Very High') riskDistribution.veryHigh++;
      else if (s.riskLevel === 'High') riskDistribution.high++;
      else if (s.riskLevel === 'Medium') riskDistribution.medium++;
      else if (s.riskLevel === 'Low') riskDistribution.low++;
      else riskDistribution.veryLow++;
    }

    return {
      totalExposure: Math.round(totalExposure),
      predictedRecovery: Math.round(predictedRecovery),
      highRiskCount: riskDistribution.veryHigh + riskDistribution.high,
      topOpportunities: allScores.scores.slice(0, 10),
      riskDistribution,
    };
  }

  /**
   * Next-best-action recommendation for a case
   */
  async getNextBestAction(caseId: string): Promise<NextBestAction> {
    const caseEntity = await this.casesRepo.findOne({
      where: { id: caseId },
      relations: ['debtor', 'loan', 'history'],
    });
    if (!caseEntity) throw new NotFoundException('Case not found');

    const history = caseEntity.history || [];
    const payments = history.filter(h => h.type === 'Payment Received');
    const ptps = history.filter(h => h.promisedAmount != null);
    const brokenPtps = ptps.filter(h => h.promisedDate && new Date(h.promisedDate) < new Date());

    const input = await this.buildScoringInput(caseEntity);
    const score = calculateRecoveryScore(input);

    const ctx: CaseContext = {
      crmStatus: caseEntity.crmStatus,
      subStatus: caseEntity.subStatus,
      contactStatus: caseEntity.contactStatus,
      daysSinceLastContact: caseEntity.lastContactDate
        ? Math.round((Date.now() - new Date(caseEntity.lastContactDate).getTime()) / 86400000)
        : 999,
      paymentCount: payments.length,
      ptpCount: ptps.length,
      brokenPtpCount: brokenPtps.length,
      balance: Number(caseEntity.loan?.currentBalance || 0),
      hasPhone: (caseEntity.debtor?.phones?.length || 0) > 0,
      hasEmail: (caseEntity.debtor?.emails?.length || 0) > 0,
      isInUAE: !(caseEntity.subStatus === 'OUT-UAE' || caseEntity.subStatus === 'Out-UAE/Pakistan'),
      caseAgeDays: Math.round((Date.now() - new Date(caseEntity.creationDate).getTime()) / 86400000),
      lastActionType: history.length > 0 ? history[0].type : null,
      recoveryScore: score.score,
    };

    return getNextBestAction(ctx);
  }

  /**
   * Smart prioritized queue for an officer
   */
  async getSmartQueue(officerId: string): Promise<QueuedCase[]> {
    const cases = await this.casesRepo.find({
      where: { assignedOfficerId: officerId },
      relations: ['debtor', 'loan', 'history'],
    });

    const today = new Date().toISOString().split('T')[0];
    const activeCases = cases.filter(c => !['Closed', 'Withdrawn'].includes(c.crmStatus));

    const queueInput = await Promise.all(activeCases.map(async (c) => {
      const input = await this.buildScoringInput(c);
      const score = calculateRecoveryScore(input);
      const history = c.history || [];
      const ptpActions = history.filter(h => h.promisedDate != null);
      const hasPtpDueToday = ptpActions.some(h => h.promisedDate === today);
      const ptpAmount = ptpActions.find(h => h.promisedDate === today)?.promisedAmount || 0;

      return {
        id: c.id,
        debtorName: c.debtor?.name || 'Unknown',
        balance: Number(c.loan?.currentBalance || 0),
        crmStatus: c.crmStatus,
        daysSinceLastContact: c.lastContactDate
          ? Math.round((Date.now() - new Date(c.lastContactDate).getTime()) / 86400000)
          : 999,
        hasPtpDueToday,
        ptpAmount: Number(ptpAmount),
        recoveryScore: score.score,
        paymentCount: history.filter(h => h.type === 'Payment Received').length,
        caseAgeDays: Math.round((Date.now() - new Date(c.creationDate).getTime()) / 86400000),
      };
    }));

    return buildSmartQueue(queueInput);
  }

  private async buildScoringInput(caseEntity: Case): Promise<ScoringInput> {
    const debtor = caseEntity.debtor;
    const loan = caseEntity.loan;
    const history = caseEntity.history || [];

    const payments = history.filter(h => h.type === 'Payment Received');
    const ptpActions = history.filter(h =>
      h.promisedAmount != null || h.type === 'Payment Plan Agreed'
    );

    const daysSinceLastContact = caseEntity.lastContactDate
      ? Math.round((Date.now() - new Date(caseEntity.lastContactDate).getTime()) / 86400000)
      : 999;

    const caseAgeDays = Math.round(
      (Date.now() - new Date(caseEntity.creationDate).getTime()) / 86400000
    );

    const isInUAE = !(
      caseEntity.subStatus === 'OUT-UAE' ||
      caseEntity.subStatus === 'Out-UAE/Pakistan'
    );

    const hasMOLActive = caseEntity.subStatus === 'MOL-Active' || caseEntity.subStatus === 'MOL-A';

    // Enhanced: calculate overdue and write-off data
    const lastPayment = payments.length > 0
      ? payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;
    const daysSinceLastPayment = lastPayment
      ? Math.round((Date.now() - new Date(lastPayment.createdAt).getTime()) / 86400000)
      : 999;

    const lpdDate = loan?.lpd ? new Date(loan.lpd) : null;
    const daysOverdue = lpdDate ? Math.max(0, Math.round((Date.now() - lpdDate.getTime()) / 86400000)) : caseAgeDays;

    const wodDate = loan?.wod ? new Date(loan.wod) : null;
    const daysUntilWriteOff = wodDate && wodDate > new Date()
      ? Math.round((wodDate.getTime() - Date.now()) / 86400000)
      : null;

    const partialPayments = payments.filter(p => {
      const promised = Number(p.promisedAmount || 0);
      const paid = Number(p.amountPaid || 0);
      return promised > 0 && paid < promised;
    });

    const brokenPtps = ptpActions.filter(p =>
      p.promisedDate && new Date(p.promisedDate) < new Date()
    );

    const settlementOffered = history.some(h =>
      h.notes?.toLowerCase().includes('settlement') || h.type === 'Payment Plan Agreed'
    );

    return {
      crmStatus: caseEntity.crmStatus,
      subStatus: caseEntity.subStatus,
      contactStatus: caseEntity.contactStatus,
      workStatus: caseEntity.workStatus,
      daysSinceLastContact,
      caseAgeDays,
      totalPayments: payments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0),
      paymentCount: payments.length,
      originalAmount: Number(loan?.originalAmount || 0),
      currentBalance: Number(loan?.currentBalance || 0),
      promiseToPayCount: ptpActions.length,
      brokenPromiseCount: brokenPtps.length,
      isInUAE,
      hasMOLActive,
      hasEmail: (debtor?.emails?.length || 0) > 0,
      hasPhone: (debtor?.phones?.length || 0) > 0,
      currency: loan?.currency || 'AED',
      daysOverdue,
      daysSinceLastPayment,
      writeOffDate: loan?.wod || null,
      daysUntilWriteOff,
      emiAmount: 0,
      partialPaymentCount: partialPayments.length,
      settlementOffered,
    };
  }
}
