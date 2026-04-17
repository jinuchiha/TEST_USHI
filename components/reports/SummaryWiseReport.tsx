import React, { useMemo } from 'react';
import { EnrichedCase, User, ActionType, CRMStatus } from '../../types';
import { formatCurrency, convertToAED } from '../../utils';

interface Props {
  allCases: EnrichedCase[];
  coordinators: User[];
  onSelectCase?: (caseId: string) => void;
}

const SummaryWiseReport: React.FC<Props> = ({ allCases, coordinators }) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const officerData = useMemo(() => {
    return coordinators.map((officer, idx) => {
      const cases = allCases.filter(c => c.assignedOfficerId === officer.id);
      const activeCases = cases.filter(c => !['Closed', 'Withdrawn'].includes(c.crmStatus));

      const totalCasesHandled = cases.length;
      const assignedCases = activeCases.length;

      // Accounts overview = unique debtor IDs
      const accountsOverview = new Set(cases.map(c => c.debtorId)).size;

      // Calling queue = CB + NCC cases
      const callingQueue = cases.filter(c => ['CB', 'NCC', 'RNR'].includes(c.crmStatus) || c.subStatus === 'RNR').length;

      // DOE = cases worked today
      const today = now.toISOString().split('T')[0];
      const todayActions = cases.flatMap(c => c.history).filter(h => (h.attributionDate || h.timestamp)?.startsWith(today));
      const doe = new Set(todayActions.map(h => h.caseId)).size;

      // Contactable / Workable
      const contactableWorkable = cases.filter(c => c.contactStatus === 'Contact' && c.workStatus === 'Work').length;

      // Contactable / Non-Workable
      const contactableNonWorkable = cases.filter(c => c.contactStatus === 'Contact' && c.workStatus === 'Non Work').length;

      // Under Negotiation
      const underNego = cases.filter(c => c.crmStatus === CRMStatus.UNDER_NEGO).length;

      // PTP in Progress
      const ptpInProgress = cases.filter(c => c.crmStatus === CRMStatus.PTP).length;

      // Work in Process
      const wip = cases.filter(c => c.crmStatus === CRMStatus.WIP).length;

      // Negotiation Amount (sum of promised amounts from PTP actions)
      const negoAmount = cases.flatMap(c => c.history).filter(h => h.promisedAmount && h.promisedAmount > 0).reduce((s, h) => s + (h.promisedAmount || 0), 0);

      // Ongoing PTP = total promised but not yet paid
      const ongoingPtp = cases.filter(c => c.crmStatus === CRMStatus.PTP).reduce((s, c) => {
        const ptpActions = c.history.filter(h => h.promisedAmount && h.promisedAmount > 0);
        return s + ptpActions.reduce((sum, h) => sum + (h.promisedAmount || 0), 0);
      }, 0);

      // Paid this month
      const monthPayments = cases.flatMap(c => c.history).filter(h =>
        h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid &&
        new Date(h.attributionDate || h.timestamp) >= monthStart
      );
      const paid = monthPayments.reduce((s, h) => s + convertToAED(h.amountPaid!, cases.find(c => c.id === h.caseId)?.loan?.currency || 'AED'), 0);

      // Projection (simple: paid + ongoing PTP)
      const projection = paid + ongoingPtp;

      // Target
      const target = officer.target || 30000;

      // Closure %
      const closurePct = target > 0 ? Math.round((paid / target) * 100) : 0;

      return {
        sNo: idx + 1,
        name: officer.name.split(' ')[0], // First name only like the report
        totalCasesHandled,
        assignedCases,
        accountsOverview,
        callingQueue,
        doe,
        contactableWorkable,
        contactableNonWorkable,
        underNego,
        ptpInProgress,
        wip,
        negoAmount,
        ongoingPtp,
        paid,
        projection,
        target,
        closurePct,
      };
    });
  }, [allCases, coordinators]);

  // Totals
  const totals = useMemo(() => {
    const t = { totalCasesHandled: 0, assignedCases: 0, accountsOverview: 0, callingQueue: 0, doe: 0, contactableWorkable: 0, contactableNonWorkable: 0, underNego: 0, ptpInProgress: 0, wip: 0, negoAmount: 0, ongoingPtp: 0, paid: 0, projection: 0, target: 0, closurePct: 0 };
    officerData.forEach(o => {
      t.totalCasesHandled += o.totalCasesHandled;
      t.assignedCases += o.assignedCases;
      t.accountsOverview += o.accountsOverview;
      t.callingQueue += o.callingQueue;
      t.doe += o.doe;
      t.contactableWorkable += o.contactableWorkable;
      t.contactableNonWorkable += o.contactableNonWorkable;
      t.underNego += o.underNego;
      t.ptpInProgress += o.ptpInProgress;
      t.wip += o.wip;
      t.negoAmount += o.negoAmount;
      t.ongoingPtp += o.ongoingPtp;
      t.paid += o.paid;
      t.projection += o.projection;
      t.target += o.target;
    });
    t.closurePct = t.target > 0 ? Math.round((t.paid / t.target) * 100) : 0;
    return t;
  }, [officerData]);

  const closureColor = (pct: number) => pct >= 100 ? 'bg-emerald-500 text-white' : pct >= 50 ? 'bg-amber-400 text-amber-900' : 'bg-red-400 text-white';
  const targetColor = (pct: number) => pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';

  const topOfficer = officerData.reduce((a, b) => a.paid > b.paid ? a : b, officerData[0]);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const dailyRunRate = daysLeft > 0 ? Math.max(0, (totals.target - totals.paid)) / daysLeft : 0;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: '#1B2A4A' }}>Summary Report</h2>
          <p className="text-xs text-text-secondary">1 {monthName} — {now.getDate()} {monthName} · {daysLeft} days remaining</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${totals.closurePct >= 100 ? 'bg-emerald-100 text-emerald-700' : totals.closurePct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {totals.closurePct}% Closure
          </span>
        </div>
      </div>

      {/* KPI Cards — Animated */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 stagger-children">
        {[
          { label: 'Total Cases', value: totals.totalCasesHandled.toLocaleString(), color: '#7B68EE', icon: '📋' },
          { label: 'Active', value: totals.assignedCases.toLocaleString(), color: '#6495ED', icon: '📂' },
          { label: 'DOE Today', value: totals.doe.toLocaleString(), color: '#4682B4', icon: '⚡' },
          { label: 'PTP Pipeline', value: formatCurrency(totals.ongoingPtp, 'AED'), color: '#FFD700', icon: '🤝' },
          { label: 'Collected', value: formatCurrency(totals.paid, 'AED'), color: '#3CB371', icon: '💰' },
          { label: 'Target', value: formatCurrency(totals.target, 'AED'), color: '#F28C28', icon: '🎯' },
        ].map((kpi, i) => (
          <div key={kpi.label} className="panel p-3 hover-lift kpi-shine">
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{kpi.icon}</span>
              <span className="text-[10px] text-text-tertiary">{kpi.label}</span>
            </div>
            <p className="text-lg font-extrabold animate-number-pop" style={{ color: kpi.color, animationDelay: `${i * 0.1}s` }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Progress toward target */}
      <div className="panel p-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-primary">Monthly Target Progress</span>
          <span className="text-xs font-bold" style={{ color: totals.closurePct >= 100 ? '#16A34A' : '#F28C28' }}>{formatCurrency(totals.paid, 'AED')} / {formatCurrency(totals.target, 'AED')}</span>
        </div>
        <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div className="h-full rounded-full animate-progress" style={{ width: `${Math.min(100, totals.closurePct)}%`, background: totals.closurePct >= 100 ? '#16A34A' : totals.closurePct >= 50 ? '#F28C28' : '#DC2626' }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-text-tertiary">
          <span>Daily run rate needed: <strong className="text-text-primary">{formatCurrency(dailyRunRate, 'AED')}</strong>/day</span>
          <span>Top performer: <strong style={{ color: '#1B2A4A' }}>{topOfficer?.name}</strong> ({formatCurrency(topOfficer?.paid || 0, 'AED')})</span>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] whitespace-nowrap">
            <thead>
              <tr style={{ background: '#7B68EE' }} className="text-white">
                <th className="px-2 py-2.5 text-center font-semibold">S No</th>
                <th className="px-2 py-2.5 text-left font-semibold">Name</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#9370DB' }}>Total Cases</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#6495ED' }}>Assigned</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#6495ED' }}>Accounts</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#6495ED' }}>Calling Queue</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#4682B4' }}>DOE</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#20B2AA' }}>Contact/Work</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#20B2AA' }}>Contact/NW</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#FFD700', color: '#333' }}>Under Nego</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#FFD700', color: '#333' }}>PTP</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#FFD700', color: '#333' }}>WIP</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#FFD700', color: '#333' }}>Nego Amt</th>
                <th className="px-2 py-2.5 text-right font-semibold" style={{ background: '#3CB371', color: 'white' }}>Ongoing PTP</th>
                <th className="px-2 py-2.5 text-right font-semibold" style={{ background: '#3CB371', color: 'white' }}>PAID</th>
                <th className="px-2 py-2.5 text-right font-semibold" style={{ background: '#3CB371', color: 'white' }}>PROJECTION</th>
                <th className="px-2 py-2.5 text-right font-semibold" style={{ background: '#F28C28', color: 'white' }}>TARGET</th>
                <th className="px-2 py-2.5 text-center font-semibold" style={{ background: '#F28C28', color: 'white' }}>CLOSURE %</th>
              </tr>
            </thead>
            <tbody>
              {officerData.map((o, i) => (
                <tr key={o.sNo} className={`border-b border-[var(--color-border)] ${i % 2 === 0 ? 'bg-[var(--color-bg-secondary)]' : 'bg-[var(--color-bg-tertiary)]'} hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors`}>
                  <td className="px-2 py-2 text-center font-semibold">{o.sNo}</td>
                  <td className="px-2 py-2 font-semibold" style={{ color: '#1B2A4A' }}>{o.name}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(155,135,235,0.1)' }}>{o.totalCasesHandled}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(100,149,237,0.1)' }}>{o.assignedCases}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(100,149,237,0.1)' }}>{o.accountsOverview}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(100,149,237,0.1)' }}>{o.callingQueue}</td>
                  <td className="px-2 py-2 text-center font-bold" style={{ background: 'rgba(70,130,180,0.1)' }}>{o.doe}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(32,178,170,0.08)' }}>{o.contactableWorkable}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(32,178,170,0.08)' }}>{o.contactableNonWorkable}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(255,215,0,0.08)' }}>{o.underNego}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(255,215,0,0.08)' }}>{o.ptpInProgress}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(255,215,0,0.08)' }}>{o.wip}</td>
                  <td className="px-2 py-2 text-center" style={{ background: 'rgba(255,215,0,0.08)' }}>{o.negoAmount.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-mono" style={{ background: 'rgba(60,179,113,0.08)' }}>{o.ongoingPtp.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold" style={{ background: 'rgba(60,179,113,0.1)' }}>{o.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-right font-mono" style={{ background: 'rgba(60,179,113,0.08)' }}>{o.projection.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className={`px-2 py-2 text-right font-mono font-bold ${targetColor(o.closurePct)}`}>{o.target.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${closureColor(o.closurePct)}`}>
                      {o.closurePct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals Row */}
            <tfoot>
              <tr className="font-bold text-white" style={{ background: '#1B2A4A' }}>
                <td className="px-2 py-2.5 text-center" colSpan={2}>TOTAL</td>
                <td className="px-2 py-2.5 text-center">{totals.totalCasesHandled}</td>
                <td className="px-2 py-2.5 text-center">{totals.assignedCases}</td>
                <td className="px-2 py-2.5 text-center">{totals.accountsOverview}</td>
                <td className="px-2 py-2.5 text-center">{totals.callingQueue}</td>
                <td className="px-2 py-2.5 text-center">{totals.doe}</td>
                <td className="px-2 py-2.5 text-center">{totals.contactableWorkable}</td>
                <td className="px-2 py-2.5 text-center">{totals.contactableNonWorkable}</td>
                <td className="px-2 py-2.5 text-center">{totals.underNego}</td>
                <td className="px-2 py-2.5 text-center">{totals.ptpInProgress}</td>
                <td className="px-2 py-2.5 text-center">{totals.wip}</td>
                <td className="px-2 py-2.5 text-center">{totals.negoAmount.toFixed(2)}</td>
                <td className="px-2 py-2.5 text-right font-mono">{totals.ongoingPtp.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="px-2 py-2.5 text-right font-mono">{totals.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="px-2 py-2.5 text-right font-mono">{totals.projection.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="px-2 py-2.5 text-right font-mono">{totals.target.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="px-2 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${closureColor(totals.closurePct)}`}>{totals.closurePct}%</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* AI Insights below the table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel p-4 border-l-4" style={{ borderLeftColor: '#F28C28' }}>
          <h4 className="text-xs font-bold text-text-primary mb-2">🧠 AI Performance Insights</h4>
          <div className="space-y-1.5 text-[11px] text-text-secondary">
            {officerData.filter(o => o.closurePct >= 100).length > 0 && (
              <p>🏆 <span className="font-semibold text-emerald-600">{officerData.filter(o => o.closurePct >= 100).map(o => o.name).join(', ')}</span> exceeded target this month!</p>
            )}
            {officerData.filter(o => o.doe === 0).length > 0 && (
              <p>⚠️ <span className="font-semibold text-red-600">{officerData.filter(o => o.doe === 0).map(o => o.name).join(', ')}</span> — zero DOE today, needs attention</p>
            )}
            {officerData.some(o => o.callingQueue > o.assignedCases * 0.8) && (
              <p>📞 High calling queue detected — consider redistributing cases</p>
            )}
            <p>📊 Team closure rate: <span className={`font-bold ${totals.closurePct >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{totals.closurePct}%</span> of {formatCurrency(totals.target, 'AED')} target</p>
          </div>
        </div>

        <div className="panel p-4 border-l-4 border-blue-500">
          <h4 className="text-xs font-bold text-text-primary mb-2">📈 AI Forecast</h4>
          <div className="space-y-1.5 text-[11px] text-text-secondary">
            <p>Projected month-end collection: <span className="font-bold text-text-primary">{formatCurrency(totals.projection, 'AED')}</span></p>
            <p>Days remaining: <span className="font-semibold">{new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()}</span></p>
            <p>Required daily run rate: <span className="font-semibold text-text-primary">
              {formatCurrency(Math.max(0, (totals.target - totals.paid)) / Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()), 'AED')}
            </span>/day</p>
            {totals.projection >= totals.target
              ? <p className="text-emerald-600 font-semibold">✅ On track to meet target</p>
              : <p className="text-amber-600 font-semibold">⚠️ {Math.round(((totals.target - totals.projection) / totals.target) * 100)}% shortfall expected</p>
            }
          </div>
        </div>

        <div className="panel p-4 border-l-4 border-purple-500">
          <h4 className="text-xs font-bold text-text-primary mb-2">🎯 AI Recommendations</h4>
          <div className="space-y-1.5 text-[11px] text-text-secondary">
            {officerData.filter(o => o.ptpInProgress > 5).map(o => (
              <p key={o.name}>📌 {o.name}: {o.ptpInProgress} PTPs — follow up on all promises today</p>
            ))}
            {officerData.filter(o => o.contactableNonWorkable > o.contactableWorkable).map(o => (
              <p key={o.name}>🔄 {o.name}: More non-workable than workable — reassess case statuses</p>
            ))}
            <p>💡 Focus officers with low DOE on high-scoring PTP cases for quick wins</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryWiseReport;
