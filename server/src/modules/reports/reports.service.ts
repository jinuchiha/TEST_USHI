import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/entities/case.entity';
import { Action } from '../actions/entities/action.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Case)
    private casesRepo: Repository<Case>,
    @InjectRepository(Action)
    private actionsRepo: Repository<Action>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async getDailySummary(date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const totalCases = await this.casesRepo.count();
    const activeCases = await this.casesRepo.count({
      where: [
        { crmStatus: 'CB' }, { crmStatus: 'PTP' }, { crmStatus: 'FIP' },
        { crmStatus: 'UNDER NEGO' }, { crmStatus: 'WIP' },
      ],
    });

    const paymentsToday = await this.actionsRepo
      .createQueryBuilder('action')
      .where('action.type = :type', { type: 'Payment Received' })
      .andWhere('DATE(action.createdAt) = :date', { date: targetDate })
      .select('COALESCE(SUM(action.amountPaid), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .getRawOne();

    const statusDistribution = await this.casesRepo
      .createQueryBuilder('case')
      .select('case.crmStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('case.crmStatus')
      .getRawMany();

    return {
      date: targetDate,
      totalCases,
      activeCases,
      paymentsToday: {
        total: parseFloat(paymentsToday?.total || '0'),
        count: parseInt(paymentsToday?.count || '0', 10),
      },
      statusDistribution,
    };
  }

  async getOfficerPerformance() {
    const officers = await this.usersRepo.find({
      where: { role: Role.OFFICER, isActive: true },
    });

    const results = [];
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

      results.push({
        officer: { id: officer.id, name: officer.name, agentCode: officer.agentCode },
        caseCount,
        totalCollected: parseFloat(collections?.total || '0'),
        paymentCount: parseInt(collections?.count || '0', 10),
        target: officer.target,
      });
    }

    return results.sort((a, b) => b.totalCollected - a.totalCollected);
  }

  async getRecoveryFunnel() {
    const statuses = ['CB', 'PTP', 'UNDER NEGO', 'FIP', 'WIP', 'Closed', 'Withdrawn', 'NIP'];
    const funnel = [];

    for (const status of statuses) {
      const count = await this.casesRepo.count({ where: { crmStatus: status } });
      funnel.push({ status, count });
    }

    return funnel;
  }

  async getStatusMatrix() {
    const matrix = await this.casesRepo
      .createQueryBuilder('case')
      .select('case.crmStatus', 'crmStatus')
      .addSelect('case.subStatus', 'subStatus')
      .addSelect('COUNT(*)', 'count')
      .groupBy('case.crmStatus')
      .addGroupBy('case.subStatus')
      .orderBy('count', 'DESC')
      .getRawMany();

    return matrix;
  }

  async getAnnualForecast() {
    const monthlyData = await this.actionsRepo
      .createQueryBuilder('action')
      .where('action.type = :type', { type: 'Payment Received' })
      .select("TO_CHAR(action.createdAt, 'YYYY-MM')", 'month')
      .addSelect('COALESCE(SUM(action.amountPaid), 0)', 'total')
      .addSelect('COUNT(*)', 'count')
      .groupBy("TO_CHAR(action.createdAt, 'YYYY-MM')")
      .orderBy('month', 'ASC')
      .getRawMany();

    return monthlyData.map((m) => ({
      month: m.month,
      total: parseFloat(m.total),
      count: parseInt(m.count, 10),
    }));
  }

  async getBankBreakdown() {
    const breakdown = await this.casesRepo
      .createQueryBuilder('case')
      .leftJoin('case.loan', 'loan')
      .select('loan.bank', 'bank')
      .addSelect('COUNT(*)', 'caseCount')
      .addSelect('COALESCE(SUM(loan.currentBalance), 0)', 'totalOutstanding')
      .groupBy('loan.bank')
      .orderBy('totalOutstanding', 'DESC')
      .getRawMany();

    return breakdown.map((b) => ({
      bank: b.bank,
      caseCount: parseInt(b.caseCount, 10),
      totalOutstanding: parseFloat(b.totalOutstanding),
    }));
  }

  async getDayEndReport(date?: string, officerId?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Per-officer breakdown
    const officers = officerId
      ? [await this.usersRepo.findOne({ where: { id: officerId } })]
      : await this.usersRepo.find({ where: { role: Role.OFFICER, isActive: true } });

    const officerReports = [];
    let totalCollections = 0;
    let totalPayments = 0;
    let totalCalls = 0;
    let totalPtps = 0;

    for (const officer of officers.filter(Boolean)) {
      const actions = await this.actionsRepo.createQueryBuilder('a')
        .where('a.officerId = :id', { id: officer!.id })
        .andWhere('DATE(a.createdAt) = :date', { date: targetDate })
        .getMany();

      const payments = actions.filter(a => a.type === 'Payment Received');
      const calls = actions.filter(a => ['Soft Call', 'Email Notice'].includes(a.type));
      const ptps = actions.filter(a => a.promisedAmount != null && Number(a.promisedAmount) > 0);
      const statusUpdates = actions.filter(a => a.type === 'Status Update');
      const collected = payments.reduce((s, a) => s + Number(a.amountPaid || 0), 0);

      totalCollections += collected;
      totalPayments += payments.length;
      totalCalls += calls.length;
      totalPtps += ptps.length;

      officerReports.push({
        officerId: officer!.id,
        officerName: officer!.name,
        agentCode: officer!.agentCode,
        casesHandled: actions.length,
        callsMade: calls.length,
        paymentsCollected: payments.length,
        amountCollected: collected,
        ptpCreated: ptps.length,
        statusUpdates: statusUpdates.length,
      });
    }

    // Team summary
    const activeCases = await this.casesRepo.count({
      where: [
        { crmStatus: 'CB' }, { crmStatus: 'PTP' }, { crmStatus: 'FIP' },
        { crmStatus: 'UNDER NEGO' }, { crmStatus: 'WIP' },
      ],
    });

    return {
      date: targetDate,
      team: {
        totalOfficers: officerReports.length,
        totalCollections,
        totalPayments,
        totalCalls,
        totalPtps,
        activeCases,
      },
      officers: officerReports.sort((a, b) => b.amountCollected - a.amountCollected),
    };
  }
}
