import React, { useMemo } from 'react';
import { EnrichedCase, User } from '../../../types';
import { formatCurrency } from '../../../utils';

interface Props {
  allCases: EnrichedCase[];
  coordinators: User[];
  onSelectCase?: (caseId: string) => void;
}

const PortfolioIntelligence: React.FC<Props> = ({ allCases, coordinators, onSelectCase }) => {
  const activeCases = useMemo(() => allCases.filter(c => !['Closed', 'Withdrawn'].includes(c.crmStatus)), [allCases]);

  // Bank-wise efficiency
  const bankData = useMemo(() => {
    const map = new Map<string, { cases: number; balance: number; closed: number; contacted: number }>();
    allCases.forEach(c => {
      const bank = c.loan?.bank || 'Unknown';
      const d = map.get(bank) || { cases: 0, balance: 0, closed: 0, contacted: 0 };
      d.cases++;
      d.balance += c.loan?.currentBalance || 0;
      if (c.crmStatus === 'Closed') d.closed++;
      if (c.contactStatus === 'Contact') d.contacted++;
      map.set(bank, d);
    });
    return Array.from(map.entries())
      .map(([bank, d]) => ({
        bank,
        ...d,
        recoveryRate: d.cases > 0 ? Math.round((d.closed / d.cases) * 100) : 0,
        contactRate: d.cases > 0 ? Math.round((d.contacted / d.cases) * 100) : 0,
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [allCases]);

  // Status heatmap data
  const statusHeatmap = useMemo(() => {
    const statuses = ['CB', 'PTP', 'FIP', 'UNDER NEGO', 'WIP', 'NCC', 'UTR', 'DXB', 'NITP', 'Dispute'];
    return statuses.map(status => {
      const cases = activeCases.filter(c => c.crmStatus === status);
      const balance = cases.reduce((s, c) => s + (c.loan?.currentBalance || 0), 0);
      return { status, count: cases.length, balance };
    }).filter(s => s.count > 0);
  }, [activeCases]);

  // Officer comparison
  const officerComparison = useMemo(() => {
    return coordinators.map(officer => {
      const cases = allCases.filter(c => c.assignedOfficerId === officer.id);
      const active = cases.filter(c => !['Closed', 'Withdrawn'].includes(c.crmStatus));
      const closed = cases.filter(c => c.crmStatus === 'Closed');
      const contacted = cases.filter(c => c.contactStatus === 'Contact');
      const payments = cases.flatMap(c => c.history.filter(h => h.type === 'Payment Received'));
      const totalCollected = payments.reduce((s, p) => s + (p.amountPaid || 0), 0);

      return {
        id: officer.id,
        name: officer.name,
        agentCode: officer.agentCode,
        totalCases: cases.length,
        activeCases: active.length,
        closedCases: closed.length,
        contactRate: cases.length > 0 ? Math.round((contacted.length / cases.length) * 100) : 0,
        recoveryRate: cases.length > 0 ? Math.round((closed.length / cases.length) * 100) : 0,
        totalCollected,
        target: officer.target || 0,
        targetPct: officer.target ? Math.round((totalCollected / officer.target) * 100) : 0,
      };
    }).sort((a, b) => b.totalCollected - a.totalCollected);
  }, [allCases, coordinators]);

  const maxBalance = Math.max(...statusHeatmap.map(s => s.balance), 1);

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in-up">
      <h2 className="text-xl font-bold text-text-primary">Portfolio Intelligence</h2>

      {/* Status Heatmap */}
      <div className="panel p-5">
        <h3 className="text-sm font-bold text-text-primary mb-4">Recovery Probability Heatmap (by Status)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {statusHeatmap.map(s => {
            const intensity = s.balance / maxBalance;
            const hue = Math.round((1 - intensity) * 120); // 0=red, 120=green inverted
            return (
              <div
                key={s.status}
                className="p-3 rounded-lg text-center border border-[var(--color-border)]"
                style={{ backgroundColor: `hsla(${hue}, 70%, 50%, ${0.1 + intensity * 0.2})` }}
              >
                <p className="text-xs font-bold text-text-primary">{s.status}</p>
                <p className="text-lg font-bold text-text-primary">{s.count}</p>
                <p className="text-[10px] text-text-tertiary">{formatCurrency(s.balance, 'AED')}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bank Efficiency Table */}
      <div className="panel p-5">
        <h3 className="text-sm font-bold text-text-primary mb-4">Bank-wise Recovery Efficiency</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-tertiary border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-3">Bank</th>
                <th className="text-right py-2 px-3">Cases</th>
                <th className="text-right py-2 px-3">Outstanding</th>
                <th className="text-right py-2 px-3">Contact %</th>
                <th className="text-right py-2 px-3">Recovery %</th>
                <th className="text-left py-2 px-3 w-32">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {bankData.slice(0, 15).map(b => (
                <tr key={b.bank} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-tertiary)]">
                  <td className="py-2 px-3 font-medium text-text-primary">{b.bank}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{b.cases}</td>
                  <td className="py-2 px-3 text-right font-medium text-text-primary">{formatCurrency(b.balance, 'AED')}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{b.contactRate}%</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{b.recoveryRate}%</td>
                  <td className="py-2 px-3">
                    <div className="w-full h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${b.recoveryRate >= 20 ? 'bg-emerald-500' : b.recoveryRate >= 10 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, b.recoveryRate * 3)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Officer Comparison */}
      <div className="panel p-5">
        <h3 className="text-sm font-bold text-text-primary mb-4">Officer Performance Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-tertiary border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-3">Officer</th>
                <th className="text-right py-2 px-3">Active</th>
                <th className="text-right py-2 px-3">Closed</th>
                <th className="text-right py-2 px-3">Contact %</th>
                <th className="text-right py-2 px-3">Collected</th>
                <th className="text-left py-2 px-3 w-28">Target %</th>
              </tr>
            </thead>
            <tbody>
              {officerComparison.map((o, i) => (
                <tr key={o.id} className={`border-b border-[var(--color-border)]/50 ${i === 0 ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}>
                  <td className="py-2 px-3">
                    <span className="font-medium text-text-primary">{o.name}</span>
                    {o.agentCode && <span className="text-text-tertiary ml-1">({o.agentCode})</span>}
                  </td>
                  <td className="py-2 px-3 text-right text-text-secondary">{o.activeCases}</td>
                  <td className="py-2 px-3 text-right text-emerald-600 font-medium">{o.closedCases}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{o.contactRate}%</td>
                  <td className="py-2 px-3 text-right font-bold text-text-primary">{formatCurrency(o.totalCollected, 'AED')}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${o.targetPct >= 80 ? 'bg-emerald-500' : o.targetPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, o.targetPct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-text-tertiary w-8">{o.targetPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PortfolioIntelligence;
