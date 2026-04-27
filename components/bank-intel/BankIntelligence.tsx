import React, { useMemo, useState } from 'react';
import { EnrichedCase, User, ActionType, CRMStatus } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';
import { findMerger } from '../pakistan-tracing/bankMergers';

// ── Per-bank analytics ──────────────────────────────────────────────────────
interface BankStats {
  bank: string;
  caseCount: number;
  totalOutstanding: number;
  totalRecovered: number;
  recoveryRate: number;
  closedCases: number;
  activeCases: number;
  withdrawnCases: number;
  cyberCases: number;
  avgDpd: number;
  avgBalance: number;
  topProducts: { product: string; count: number; recoveryRate: number }[];
  successfulPaymentTypes: Record<string, number>;
  bestSettlementPercent: number; // average successful settlement %
  ptpFulfillment: number;        // % of PTPs that converted to payment
  avgDaysToFirstPayment: number;
  bestOfficerForBank: string;
  worstStatusFor: string;        // most common stuck status
  mergedFrom?: string;           // if this bank was merged into
}

const daysSince = (iso?: string | null): number => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

interface BankIntelligenceProps {
  cases: EnrichedCase[];
  currentUser: User;
}

const BankIntelligence: React.FC<BankIntelligenceProps> = ({ cases }) => {
  const [selectedBank, setSelectedBank] = useState<string>('');

  const bankStats = useMemo<BankStats[]>(() => {
    const byBank = new Map<string, EnrichedCase[]>();
    cases.forEach(c => {
      const k = c.loan.bank || 'Unknown';
      if (!byBank.has(k)) byBank.set(k, []);
      byBank.get(k)!.push(c);
    });

    const result: BankStats[] = [];
    byBank.forEach((bankCases, bank) => {
      const totalOutstanding = bankCases.reduce((s, c) => s + c.loan.currentBalance, 0);
      const allPayments = bankCases.flatMap(c => (c.history || []).filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid));
      const totalRecovered = allPayments.reduce((s, a) => s + (a.amountPaid || 0), 0);
      const totalOriginal = bankCases.reduce((s, c) => s + c.loan.originalAmount, 0);
      const recoveryRate = totalOriginal > 0 ? (totalRecovered / totalOriginal) * 100 : 0;

      const closedCases = bankCases.filter(c => c.crmStatus === CRMStatus.CLOSED).length;
      const withdrawnCases = bankCases.filter(c => c.crmStatus === CRMStatus.WITHDRAWN || c.crmStatus === CRMStatus.WDS).length;
      const activeCases = bankCases.length - closedCases - withdrawnCases;
      const cyberCases = bankCases.filter(c => c.cyber === 'Yes').length;

      const avgDpd = bankCases.reduce((s, c) => s + daysSince(c.creationDate), 0) / Math.max(1, bankCases.length);
      const avgBalance = totalOutstanding / Math.max(1, bankCases.length);

      // Top products
      const productMap = new Map<string, { count: number; paid: number; total: number }>();
      bankCases.forEach(c => {
        const p = c.loan.product || 'Unknown';
        if (!productMap.has(p)) productMap.set(p, { count: 0, paid: 0, total: 0 });
        const entry = productMap.get(p)!;
        entry.count++;
        entry.total += c.loan.originalAmount;
        entry.paid += (c.history || [])
          .filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid)
          .reduce((s, a) => s + (a.amountPaid || 0), 0);
      });
      const topProducts = Array.from(productMap.entries())
        .map(([product, v]) => ({ product, count: v.count, recoveryRate: v.total > 0 ? (v.paid / v.total) * 100 : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Payment type breakdown
      const successfulPaymentTypes: Record<string, number> = {};
      allPayments.forEach(a => {
        const t = a.paymentType || 'Unknown';
        successfulPaymentTypes[t] = (successfulPaymentTypes[t] || 0) + 1;
      });

      // Settlement %
      const settlements = allPayments.filter(a => a.paymentType === 'Settlement');
      const bestSettlementPercent = settlements.length > 0
        ? settlements.reduce((s, a) => {
            const c = bankCases.find(x => x.history.some(h => h.id === a.id));
            const orig = c?.loan.originalAmount || 1;
            return s + ((a.amountPaid || 0) / orig) * 100;
          }, 0) / settlements.length
        : 0;

      // PTP fulfillment
      const ptpActions = bankCases.flatMap(c => (c.history || []).filter(a => a.promisedAmount && a.promisedAmount > 0));
      const ptpFulfillment = ptpActions.length > 0
        ? (allPayments.length / ptpActions.length) * 100
        : 0;

      // Avg days to first payment
      const firstPayments = bankCases.map(c => {
        const fp = (c.history || []).filter(a => a.type === ActionType.PAYMENT_RECEIVED).sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];
        if (!fp) return null;
        return Math.floor((new Date(fp.timestamp).getTime() - new Date(c.creationDate).getTime()) / 86400000);
      }).filter((d): d is number => d !== null);
      const avgDaysToFirstPayment = firstPayments.length > 0 ? firstPayments.reduce((s, d) => s + d, 0) / firstPayments.length : 0;

      // Best officer for this bank (by recovery)
      const officerRecovery = new Map<string, number>();
      bankCases.forEach(c => {
        (c.history || []).filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid).forEach(a => {
          officerRecovery.set(a.officerId, (officerRecovery.get(a.officerId) || 0) + (a.amountPaid || 0));
        });
      });
      const bestOfficerEntry = Array.from(officerRecovery.entries()).sort((a, b) => b[1] - a[1])[0];
      const bestOfficerForBank = bestOfficerEntry ? bestOfficerEntry[0] : '—';

      // Most stuck status
      const statusMap = new Map<string, number>();
      bankCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN).forEach(c => {
        const k = `${c.crmStatus}/${c.subStatus || 'none'}`;
        statusMap.set(k, (statusMap.get(k) || 0) + 1);
      });
      const worstStatusFor = Array.from(statusMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

      const merger = findMerger(bank);

      result.push({
        bank,
        caseCount: bankCases.length,
        totalOutstanding, totalRecovered, recoveryRate,
        closedCases, activeCases, withdrawnCases, cyberCases,
        avgDpd: Math.round(avgDpd), avgBalance: Math.round(avgBalance),
        topProducts, successfulPaymentTypes,
        bestSettlementPercent: Math.round(bestSettlementPercent * 10) / 10,
        ptpFulfillment: Math.round(ptpFulfillment * 10) / 10,
        avgDaysToFirstPayment: Math.round(avgDaysToFirstPayment),
        bestOfficerForBank,
        worstStatusFor,
        mergedFrom: merger ? merger.original : undefined,
      });
    });

    return result.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [cases]);

  const selected = bankStats.find(b => b.bank === selectedBank) || bankStats[0];

  // Pre-select first bank if none chosen
  React.useEffect(() => {
    if (!selectedBank && bankStats.length > 0) setSelectedBank(bankStats[0].bank);
  }, [selectedBank, bankStats]);

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">🏦</span>
            Bank Intelligence
          </h1>
          <p className="text-sm text-text-secondary mt-1">Per-bank patterns — what works, what doesn't, where to focus</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Bank list */}
        <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="p-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold">Banks ({bankStats.length})</h3>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-[var(--color-border)]">
            {bankStats.map(b => (
              <button
                key={b.bank}
                onClick={() => setSelectedBank(b.bank)}
                className={`w-full text-left p-3 hover:bg-[var(--color-bg-muted)] ${selectedBank === b.bank ? 'bg-[var(--color-primary-glow)] border-l-4 border-[var(--color-primary)]' : ''}`}
              >
                <p className="text-sm font-bold">{b.bank}</p>
                <p className="text-[10px] text-text-tertiary">{b.caseCount} cases • {formatCurrency(b.totalOutstanding, 'AED')}</p>
                <div className="mt-1 h-1 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                  <div
                    className={`h-full ${b.recoveryRate >= 30 ? 'bg-emerald-500' : b.recoveryRate >= 15 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, b.recoveryRate)}%` }}
                  />
                </div>
                <p className="text-[10px] mt-0.5">{b.recoveryRate.toFixed(1)}% recovered</p>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-3 space-y-4">
          {!selected ? (
            <div className="panel p-12 text-center">
              <p className="text-text-secondary">No bank data yet.</p>
            </div>
          ) : (
            <>
              {/* Header card */}
              <div className="panel p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{selected.bank}</h2>
                    {selected.mergedFrom && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                        ⚠️ This bank merged from <strong>{selected.mergedFrom}</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-text-tertiary uppercase">Recovery Rate</p>
                    <p className={`text-3xl font-bold ${selected.recoveryRate >= 30 ? 'text-emerald-600' : selected.recoveryRate >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                      {selected.recoveryRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Cases', value: selected.caseCount },
                  { label: 'Active', value: selected.activeCases, color: 'text-blue-600' },
                  { label: 'Closed', value: selected.closedCases, color: 'text-emerald-600' },
                  { label: 'Withdrawn', value: selected.withdrawnCases, color: 'text-text-tertiary' },
                  { label: 'Outstanding', value: formatCurrency(selected.totalOutstanding, 'AED') },
                  { label: 'Recovered', value: formatCurrency(selected.totalRecovered, 'AED'), color: 'text-emerald-600' },
                  { label: 'Avg DPD', value: `${selected.avgDpd}d`, color: selected.avgDpd > 365 ? 'text-red-600' : 'text-text-secondary' },
                  { label: 'Avg Balance', value: formatCurrency(selected.avgBalance, 'AED') },
                  { label: 'Cyber Flags', value: selected.cyberCases, color: 'text-red-600' },
                  { label: 'PTP Fulfilment', value: `${selected.ptpFulfillment}%`, color: selected.ptpFulfillment >= 30 ? 'text-emerald-600' : 'text-amber-600' },
                  { label: 'Avg Days to 1st Pay', value: `${selected.avgDaysToFirstPayment}d` },
                  { label: 'Avg Settlement %', value: `${selected.bestSettlementPercent}%` },
                ].map(k => (
                  <div key={k.label} className="panel p-3">
                    <p className="text-[10px] text-text-secondary">{k.label}</p>
                    <p className={`text-base font-bold mt-0.5 ${k.color || 'text-text-primary'}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Top products */}
              <div className="panel">
                <div className="p-3 border-b border-[var(--color-border)]">
                  <h3 className="text-sm font-bold">Product Mix & Recovery</h3>
                </div>
                <div className="p-3 space-y-2">
                  {selected.topProducts.map(p => (
                    <div key={p.product} className="flex items-center gap-3">
                      <p className="text-xs font-semibold w-32 flex-shrink-0">{p.product}</p>
                      <div className="flex-1 h-6 rounded bg-[var(--color-bg-tertiary)] overflow-hidden flex items-center">
                        <div
                          className={`h-full ${p.recoveryRate >= 30 ? 'bg-emerald-500/30' : p.recoveryRate >= 15 ? 'bg-amber-500/30' : 'bg-red-500/30'}`}
                          style={{ width: `${Math.min(100, p.recoveryRate)}%` }}
                        />
                        <p className="text-[10px] font-bold ml-2 absolute" style={{ marginLeft: '8px' }}>
                          {p.count} cases • {p.recoveryRate.toFixed(1)}% recovery
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI insights */}
              <div className="panel p-4 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>🧠</span>
                  AI Insights for {selected.bank}
                </h3>
                <ul className="space-y-2 text-xs">
                  {selected.recoveryRate < 15 && (
                    <li className="text-red-600 dark:text-red-400">⚠️ Recovery rate below 15% — review portfolio quality, consider deeper settlements (60-70% off).</li>
                  )}
                  {selected.recoveryRate >= 30 && (
                    <li className="text-emerald-600 dark:text-emerald-400">✓ Strong recovery rate. Replicate playbook on other banks.</li>
                  )}
                  {selected.ptpFulfillment < 25 && (
                    <li className="text-amber-600 dark:text-amber-400">⚠️ PTP fulfilment under 25% — debtors agree but don't pay. Demand cash-on-action instead of verbal commitments.</li>
                  )}
                  {selected.cyberCases > selected.caseCount * 0.05 && (
                    <li className="text-red-600 dark:text-red-400">🚨 Cyber flag rate {((selected.cyberCases / selected.caseCount) * 100).toFixed(1)}% — alert bank for fraud review.</li>
                  )}
                  {selected.avgDpd > 730 && (
                    <li className="text-amber-600 dark:text-amber-400">📅 Avg case 2+ years old — focus on settlement closures, not full recovery.</li>
                  )}
                  {selected.avgDaysToFirstPayment > 0 && selected.avgDaysToFirstPayment < 30 && (
                    <li className="text-emerald-600 dark:text-emerald-400">✓ Fast first-payment ({selected.avgDaysToFirstPayment}d avg) — bank's debtors respond quickly. Keep call cadence weekly.</li>
                  )}
                  {selected.bestSettlementPercent > 0 && (
                    <li className="text-text-secondary">💼 Successful settlements average <strong>{selected.bestSettlementPercent}%</strong> of original balance. Open negotiations near this number.</li>
                  )}
                  {selected.worstStatusFor !== '—' && (
                    <li className="text-text-secondary">📊 Most cases stuck in <strong>{selected.worstStatusFor}</strong>. Review playbook to break this status.</li>
                  )}
                  {selected.mergedFrom && (
                    <li className="text-blue-600 dark:text-blue-400">🏦 Originally <strong>{selected.mergedFrom}</strong> — debtors may be confused which bank owns debt. Reference both names.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankIntelligence;
