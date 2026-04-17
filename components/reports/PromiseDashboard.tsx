import React, { useMemo } from 'react';
import { EnrichedCase, User, CRMStatus } from '../../types';
import { formatCurrency } from '../../utils';

interface Props {
  allCases: EnrichedCase[];
  coordinators: User[];
  onSelectCase?: (id: string) => void;
}

const PromiseDashboard: React.FC<Props> = ({ allCases, coordinators, onSelectCase }) => {
  const now = new Date();

  const ptpData = useMemo(() => {
    const ptpCases = allCases.filter(c => c.crmStatus === CRMStatus.PTP);
    const allPtpActions = ptpCases.flatMap(c =>
      c.history.filter(h => h.promisedDate && h.promisedAmount).map(h => ({
        ...h,
        debtorName: c.debtor.name,
        accountNumber: c.loan?.accountNumber || '',
        bank: c.loan?.bank || '',
        officerName: c.officer?.name || '',
        currency: c.loan?.currency || 'AED',
      }))
    );

    const today = now.toISOString().split('T')[0];
    const dueToday = allPtpActions.filter(a => a.promisedDate === today);
    const overdue = allPtpActions.filter(a => a.promisedDate! < today);
    const upcoming7 = allPtpActions.filter(a => {
      const d = a.promisedDate!;
      const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
      return d > today && d <= in7;
    });
    const upcoming30 = allPtpActions.filter(a => {
      const d = a.promisedDate!;
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0];
      return d > today && d <= in30;
    });

    // Calendar heatmap — next 30 days
    const calendar: Array<{ date: string; day: string; count: number; amount: number }> = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayActions = allPtpActions.filter(a => a.promisedDate === dateStr);
      calendar.push({
        date: dateStr,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        count: dayActions.length,
        amount: dayActions.reduce((s, a) => s + (a.promisedAmount || 0), 0),
      });
    }

    // Per-officer PTP summary
    const officerPtp = coordinators.map(o => {
      const cases = ptpCases.filter(c => c.assignedOfficerId === o.id);
      const actions = cases.flatMap(c => c.history.filter(h => h.promisedDate && h.promisedAmount));
      const totalPromised = actions.reduce((s, a) => s + (a.promisedAmount || 0), 0);
      const overdueCount = actions.filter(a => a.promisedDate! < today).length;
      return { name: o.name, caseCount: cases.length, totalPromised, overdueCount };
    }).filter(o => o.caseCount > 0).sort((a, b) => b.totalPromised - a.totalPromised);

    return { ptpCases, dueToday, overdue, upcoming7, upcoming30, calendar, officerPtp, allPtpActions };
  }, [allCases, coordinators]);

  const maxCalAmount = Math.max(...ptpData.calendar.map(c => c.amount), 1);

  return (
    <div className="p-4 sm:p-6 space-y-5 animate-fade-in-up">
      <div>
        <h2 className="text-xl font-extrabold" style={{ color: '#1B2A4A' }}>Promise Management</h2>
        <p className="text-xs text-text-secondary">PTP tracking, calendar, and conversion analytics</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        {[
          { label: 'Active PTPs', value: ptpData.ptpCases.length, color: '#F28C28', icon: '🤝' },
          { label: 'Due Today', value: ptpData.dueToday.length, color: '#DC2626', icon: '🔴' },
          { label: 'Overdue', value: ptpData.overdue.length, color: '#DC2626', icon: '⚠️' },
          { label: 'Next 7 Days', value: ptpData.upcoming7.length, color: '#6495ED', icon: '📅' },
        ].map(kpi => (
          <div key={kpi.label} className="panel p-3 hover-lift kpi-shine">
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{kpi.icon}</span>
              <span className="text-[10px] text-text-tertiary">{kpi.label}</span>
            </div>
            <p className="text-2xl font-extrabold animate-number-pop" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Calendar Heatmap */}
      <div className="panel p-4">
        <h3 className="text-sm font-bold text-text-primary mb-3">PTP Calendar — Next 30 Days</h3>
        <div className="grid grid-cols-10 sm:grid-cols-15 gap-1">
          {ptpData.calendar.map(d => {
            const intensity = d.amount / maxCalAmount;
            const bg = d.count === 0 ? 'var(--color-bg-tertiary)' : `rgba(242, 140, 40, ${0.15 + intensity * 0.7})`;
            const isToday = d.date === now.toISOString().split('T')[0];
            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.count} PTPs — ${formatCurrency(d.amount, 'AED')}`}
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-[9px] cursor-pointer transition-transform hover:scale-110 ${isToday ? 'ring-2 ring-offset-1' : ''}`}
                style={{ background: bg, '--tw-ring-color': isToday ? '#1B2A4A' : undefined } as React.CSSProperties}
              >
                <span className="font-bold" style={{ color: d.count > 0 ? '#1B2A4A' : 'var(--color-text-tertiary)' }}>{d.date.slice(8)}</span>
                <span className="text-[8px]" style={{ color: 'var(--color-text-tertiary)' }}>{d.day}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--color-bg-tertiary)' }} /> No PTPs</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'rgba(242,140,40,0.3)' }} /> Low</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'rgba(242,140,40,0.7)' }} /> High</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Due Today List */}
        <div className="panel p-4">
          <h3 className="text-sm font-bold text-text-primary mb-2">Due Today ({ptpData.dueToday.length})</h3>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {ptpData.dueToday.length > 0 ? ptpData.dueToday.map((a, i) => (
              <div key={i} onClick={() => onSelectCase?.(a.caseId)} className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 cursor-pointer hover-lift text-[11px]">
                <div>
                  <span className="font-semibold text-text-primary">{a.debtorName}</span>
                  <span className="text-text-tertiary ml-2">{a.bank}</span>
                </div>
                <span className="font-bold" style={{ color: '#F28C28' }}>{formatCurrency(a.promisedAmount || 0, a.currency)}</span>
              </div>
            )) : <p className="text-center text-text-tertiary py-4 text-[11px]">No PTPs due today</p>}
          </div>
        </div>

        {/* Per-Officer PTP */}
        <div className="panel p-4">
          <h3 className="text-sm font-bold text-text-primary mb-2">Officer PTP Summary</h3>
          <div className="space-y-1.5">
            {ptpData.officerPtp.map(o => (
              <div key={o.name} className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[11px]">
                <div>
                  <span className="font-semibold text-text-primary">{o.name}</span>
                  <span className="text-text-tertiary ml-2">{o.caseCount} cases</span>
                  {o.overdueCount > 0 && <span className="text-red-600 ml-2">({o.overdueCount} overdue)</span>}
                </div>
                <span className="font-bold" style={{ color: '#1B2A4A' }}>{formatCurrency(o.totalPromised, 'AED')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromiseDashboard;
