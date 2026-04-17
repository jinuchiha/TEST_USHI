import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Case } from '../cases/entities/case.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';

export type WithdrawalReason = 'legal' | 'debtor_unreachable' | 'bank_request' | 'paid_closed' | 'death_certificate' | 'duplicate' | 'other';

export interface WithdrawalRecord {
  caseId: string;
  debtorName: string;
  accountNumber: string;
  bank: string;
  balance: number;
  currency: string;
  reason: WithdrawalReason;
  withdrawnBy: string;
  withdrawnAt: string;
  notes: string;
}

@Injectable()
export class WithdrawalService {
  constructor(
    @InjectRepository(Case) private casesRepo: Repository<Case>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async bulkWithdraw(
    caseIds: string[],
    reason: WithdrawalReason,
    notes: string,
    userId: string,
    userName: string,
  ): Promise<{ withdrawn: number; errors: string[] }> {
    const errors: string[] = [];
    let withdrawn = 0;

    const cases = await this.casesRepo.find({
      where: { id: In(caseIds) },
    });

    for (const c of cases) {
      if (c.crmStatus === 'Withdrawn' || c.crmStatus === 'Closed') {
        errors.push(`Case ${c.id.slice(0, 8)}: Already ${c.crmStatus}`);
        continue;
      }

      c.crmStatus = 'Withdrawn';
      c.subStatus = this.reasonToSubStatus(reason);
      await this.casesRepo.save(c);

      await this.auditRepo.save(this.auditRepo.create({
        userId,
        caseId: c.id,
        details: `Bulk withdrawal by ${userName}. Reason: ${reason}. Notes: ${notes}`,
      }));

      withdrawn++;
    }

    return { withdrawn, errors };
  }

  async getWithdrawalHistory(filters?: {
    reason?: WithdrawalReason;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<WithdrawalRecord[]> {
    const qb = this.casesRepo.createQueryBuilder('case')
      .leftJoinAndSelect('case.debtor', 'debtor')
      .leftJoinAndSelect('case.loan', 'loan')
      .leftJoinAndSelect('case.officer', 'officer')
      .leftJoinAndSelect('case.auditLog', 'audit')
      .where("case.crmStatus = 'Withdrawn'")
      .orderBy('case.updatedAt', 'DESC');

    if (filters?.dateFrom) {
      qb.andWhere('case.updatedAt >= :from', { from: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('case.updatedAt <= :to', { to: filters.dateTo });
    }

    const cases = await qb.getMany();

    return cases.map(c => {
      const withdrawalLog = c.auditLog?.find(a => a.details.includes('withdrawal')) || c.auditLog?.[c.auditLog.length - 1];
      return {
        caseId: c.id,
        debtorName: c.debtor?.name || 'Unknown',
        accountNumber: c.loan?.accountNumber || '',
        bank: c.loan?.bank || '',
        balance: Number(c.loan?.currentBalance || 0),
        currency: c.loan?.currency || 'AED',
        reason: this.subStatusToReason(c.subStatus),
        withdrawnBy: withdrawalLog?.userId || '',
        withdrawnAt: c.updatedAt?.toISOString() || '',
        notes: withdrawalLog?.details || '',
      };
    });
  }

  async exportToCsv(): Promise<string> {
    const records = await this.getWithdrawalHistory();
    const headers = ['Case ID', 'Debtor Name', 'Account Number', 'Bank', 'Balance', 'Currency', 'Reason', 'Withdrawn Date'];
    const rows = records.map(r =>
      [r.caseId, r.debtorName, r.accountNumber, r.bank, r.balance, r.currency, r.reason, r.withdrawnAt].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  private reasonToSubStatus(reason: WithdrawalReason): string {
    const map: Record<WithdrawalReason, string> = {
      legal: 'Withdrawal Status',
      debtor_unreachable: 'Not Contactable',
      bank_request: 'Bank Recall',
      paid_closed: 'Paid & Withdrawn',
      death_certificate: 'DC-(Death Certificate)',
      duplicate: 'Archived - Bank Recall',
      other: 'Withdrawal Status',
    };
    return map[reason] || 'Withdrawal Status';
  }

  private subStatusToReason(subStatus: string): WithdrawalReason {
    if (subStatus.includes('Bank Recall')) return 'bank_request';
    if (subStatus.includes('Death')) return 'death_certificate';
    if (subStatus.includes('Paid')) return 'paid_closed';
    if (subStatus.includes('Not Contactable')) return 'debtor_unreachable';
    return 'other';
  }
}
