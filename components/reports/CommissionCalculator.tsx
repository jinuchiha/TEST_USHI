import React, { useMemo } from 'react';
import { EnrichedCase, User, ActionType, Role } from '../../types';
import { formatCurrency, convertToAED } from '../../utils';

interface Props {
  allCases: EnrichedCase[];
  coordinators: User[];
}

const AGENT_RATE = 0.0075;   // 0.75%
const MANAGER_RATE = 0.0025; // 0.25% of total team recovery

const CommissionCalculator: React.FC<Props> = ({ allCases, coordinators }) => {
  const now = new Date();

  // Build 6 months of data (current + 5 previous)
  const months = useMemo(() => {
    const result: Array<{
      label: string;
      monthKey: string;
      start: Date;
      end: Date;
      isPayable: boolean;  // 3+ months old = payable
      isPending: boolean;  // less than 3 months = pending
      monthsUntilPayable: number;
    }> = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthsAgo = i;
      result.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        start: d,
        end,
        isPayable: monthsAgo >= 3,
        isPending: monthsAgo < 3,
        monthsUntilPayable: Math.max(0, 3 - monthsAgo),
      });
    }
    return result;
  }, []);

  // Agent commission data
  const agentData = useMemo(() => {
    return coordinators.map(officer => {
      const cases = allCases.filter(c => c.assignedOfficerId === officer.id);

      const monthlyData = months.map(m => {
        const payments = cases.flatMap(c => c.history).filter(h =>
          h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid &&
          new Date(h.attributionDate || h.timestamp) >= m.start &&
          new Date(h.attributionDate || h.timestamp) <= m.end
        );
        const collected = payments.reduce((s, h) => s + convertToAED(h.amountPaid!, cases.find(c => c.id === h.caseId)?.loan?.currency || 'AED'), 0);
        const commission = collected * AGENT_RATE;

        return {
          ...m,
          collected,
          commission,
          paymentCount: payments.length,
        };
      });

      const totalCollected = monthlyData.reduce((s, m) => s + m.collected, 0);
      const totalCommission = monthlyData.reduce((s, m) => s + m.commission, 0);
      const payableCommission = monthlyData.filter(m => m.isPayable).reduce((s, m) => s + m.commission, 0);
      const pendingCommission = monthlyData.filter(m => m.isPending).reduce((s, m) => s + m.commission, 0);

      return {
        name: officer.name,
        agentCode: officer.agentCode,
        monthlyData,
        totalCollected,
        totalCommission,
        payableCommission,
        pendingCommission,
        currentMonth: monthlyData[0],
      };
    }).sort((a, b) => b.currentMonth.collected - a.currentMonth.collected);
  }, [allCases, coordinators, months]);

  // Manager commission (0.25% of total team recovery)
  const managerData = useMemo(() => {
    return months.map(m => {
      const teamTotal = agentData.reduce((s, a) => s + (a.monthlyData.find(md => md.monthKey === m.monthKey)?.collected || 0), 0);
      return {
        ...m,
        teamTotal,
        managerCommission: teamTotal * MANAGER_RATE,
      };
    });
  }, [agentData, months]);

  const managerTotalPayable = managerData.filter(m => m.isPayable).reduce((s, m) => s + m.managerCommission, 0);
  const managerTotalPending = managerData.filter(m => m.isPending).reduce((s, m) => s + m.managerCommission, 0);
  const teamGrandTotal = agentData.reduce((s, a) => s + a.currentMonth.collected, 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: '#1B2A4A' }}>Commission Report</h2>
          <p className="text-xs text-text-secondary">Agent: 0.75% of collections · Manager: 0.25% of team total · Payable after 3 months</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <div className="panel p-4 hover-lift kpi-shine">
          <p className="text-[10px] text-text-tertiary uppercase font-semibold">Current Month Recovery</p>
          <p className="text-xl font-extrabold animate-number-pop" style={{ color: '#1B2A4A' }}>{formatCurrency(teamGrandTotal, 'AED')}</p>
        </div>
        <div className="panel p-4 hover-lift kpi-shine">
          <p className="text-[10px] text-text-tertiary uppercase font-semibold">Agent Commissions (Pending)</p>
          <p className="text-xl font-extrabold animate-number-pop" style={{ color: '#F28C28', animationDelay: '0.1s' }}>{formatCurrency(agentData.reduce((s, a) => s + a.pendingCommission, 0), 'AED')}</p>
          <p className="text-[10px] text-text-tertiary mt-0.5">Payable in 3 months</p>
        </div>
        <div className="panel p-4 hover-lift kpi-shine">
          <p className="text-[10px] text-text-tertiary uppercase font-semibold">Agent Commissions (Payable)</p>
          <p className="text-xl font-extrabold animate-number-pop text-emerald-600" style={{ animationDelay: '0.2s' }}>{formatCurrency(agentData.reduce((s, a) => s + a.payableCommission, 0), 'AED')}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Ready to disburse</p>
        </div>
        <div className="panel p-4 hover-lift kpi-shine border-l-4" style={{ borderLeftColor: '#F28C28' }}>
          <p className="text-[10px] text-text-tertiary uppercase font-semibold">Manager Commission</p>
          <p className="text-xl font-extrabold animate-number-pop" style={{ color: '#F28C28', animationDelay: '0.3s' }}>{formatCurrency(managerTotalPayable + managerTotalPending, 'AED')}</p>
          <p className="text-[10px] text-text-tertiary mt-0.5">{formatCurrency(managerTotalPayable, 'AED')} payable · {formatCurrency(managerTotalPending, 'AED')} pending</p>
        </div>
      </div>

      {/* Rate Info */}
      <div className="panel p-3 flex items-center gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded" style={{ background: '#1B2A4A' }} />
          <span><strong>Agent Rate:</strong> 0.75% of own collections</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded" style={{ background: '#F28C28' }} />
          <span><strong>Manager Rate:</strong> 0.25% of total team recovery</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-emerald-500" />
          <span><strong>Payment:</strong> After 3 months from collection month</span>
        </div>
      </div>

      {/* Agent Commission Table */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-bold text-text-primary">Agent Commissions (0.75%)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] whitespace-nowrap">
            <thead>
              <tr style={{ background: '#1B2A4A' }} className="text-white">
                <th className="px-3 py-2.5 text-left font-semibold sticky left-0" style={{ background: '#1B2A4A' }}>Agent</th>
                {months.map(m => (
                  <th key={m.monthKey} className="px-3 py-2.5 text-center font-semibold" colSpan={2}>
                    <div>{m.label}</div>
                    <div className="text-[9px] font-normal opacity-70">{m.isPayable ? '✅ Payable' : `⏳ ${m.monthsUntilPayable}m left`}</div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-semibold" style={{ background: '#F28C28' }}>Total Payable</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total Pending</th>
              </tr>
              <tr className="text-[9px] text-text-tertiary bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
                <th className="px-3 py-1 sticky left-0 bg-[var(--color-bg-tertiary)]"></th>
                {months.map(m => (
                  <React.Fragment key={m.monthKey + '-sub'}>
                    <th className="px-2 py-1 text-right">Collected</th>
                    <th className="px-2 py-1 text-right">Commission</th>
                  </React.Fragment>
                ))}
                <th className="px-3 py-1"></th>
                <th className="px-3 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {agentData.map((agent, i) => (
                <tr key={agent.name} className={`border-b border-[var(--color-border)] ${i % 2 ? 'bg-[var(--color-bg-tertiary)]' : ''}`}>
                  <td className={`px-3 py-2 font-semibold sticky left-0 ${i % 2 ? 'bg-[var(--color-bg-tertiary)]' : 'bg-[var(--color-bg-secondary)]'}`} style={{ color: '#1B2A4A' }}>
                    {agent.name}
                    {agent.agentCode && <span className="text-text-tertiary font-normal ml-1">({agent.agentCode})</span>}
                  </td>
                  {agent.monthlyData.map(md => (
                    <React.Fragment key={md.monthKey}>
                      <td className="px-2 py-2 text-right font-mono">{md.collected > 0 ? formatCurrency(md.collected, 'AED') : '—'}</td>
                      <td className={`px-2 py-2 text-right font-mono ${md.isPayable ? 'text-emerald-600 font-semibold' : 'text-text-tertiary'}`}>
                        {md.commission > 0 ? formatCurrency(md.commission, 'AED') : '—'}
                      </td>
                    </React.Fragment>
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">{formatCurrency(agent.payableCommission, 'AED')}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: '#F28C28' }}>{formatCurrency(agent.pendingCommission, 'AED')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold" style={{ background: '#1B2A4A', color: 'white' }}>
                <td className="px-3 py-2.5 sticky left-0" style={{ background: '#1B2A4A' }}>TOTAL AGENTS</td>
                {months.map(m => {
                  const mTotal = agentData.reduce((s, a) => s + (a.monthlyData.find(md => md.monthKey === m.monthKey)?.collected || 0), 0);
                  const mComm = agentData.reduce((s, a) => s + (a.monthlyData.find(md => md.monthKey === m.monthKey)?.commission || 0), 0);
                  return (
                    <React.Fragment key={m.monthKey + '-total'}>
                      <td className="px-2 py-2.5 text-right font-mono">{formatCurrency(mTotal, 'AED')}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{formatCurrency(mComm, 'AED')}</td>
                    </React.Fragment>
                  );
                })}
                <td className="px-3 py-2.5 text-right font-mono" style={{ color: '#34D399' }}>{formatCurrency(agentData.reduce((s, a) => s + a.payableCommission, 0), 'AED')}</td>
                <td className="px-3 py-2.5 text-right font-mono" style={{ color: '#F2A860' }}>{formatCurrency(agentData.reduce((s, a) => s + a.pendingCommission, 0), 'AED')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Manager Commission Table */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-bold text-text-primary">Manager Commission (0.25% of Total Team Recovery)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] whitespace-nowrap">
            <thead>
              <tr style={{ background: '#F28C28' }} className="text-white">
                <th className="px-3 py-2.5 text-left font-semibold">Month</th>
                <th className="px-3 py-2.5 text-right font-semibold">Team Total Recovery</th>
                <th className="px-3 py-2.5 text-right font-semibold">Manager Commission (0.25%)</th>
                <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                <th className="px-3 py-2.5 text-center font-semibold">Payable Date</th>
              </tr>
            </thead>
            <tbody>
              {managerData.map((m, i) => {
                const payableDate = new Date(m.start);
                payableDate.setMonth(payableDate.getMonth() + 3);
                return (
                  <tr key={m.monthKey} className={`border-b border-[var(--color-border)] ${i % 2 ? 'bg-[var(--color-bg-tertiary)]' : ''}`}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: '#1B2A4A' }}>{m.label}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatCurrency(m.teamTotal, 'AED')}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold" style={{ color: '#F28C28' }}>{formatCurrency(m.managerCommission, 'AED')}</td>
                    <td className="px-3 py-2.5 text-center">
                      {m.isPayable ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">PAYABLE</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">PENDING ({m.monthsUntilPayable}m)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-text-secondary">
                      {payableDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold" style={{ background: '#1B2A4A', color: 'white' }}>
                <td className="px-3 py-2.5">TOTAL</td>
                <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(managerData.reduce((s, m) => s + m.teamTotal, 0), 'AED')}</td>
                <td className="px-3 py-2.5 text-right font-mono" style={{ color: '#F2A860' }}>{formatCurrency(managerData.reduce((s, m) => s + m.managerCommission, 0), 'AED')}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-emerald-400">{formatCurrency(managerTotalPayable, 'AED')} payable</span>
                </td>
                <td className="px-3 py-2.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CommissionCalculator;
