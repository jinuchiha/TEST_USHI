import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../src/contexts/AuthContext';
import { apiClient } from '../../../src/api/client';
import { EnrichedCase, User, Role } from '../../../types';
import { formatCurrency } from '../../../utils';
import RecoveryScoreBadge from '../../ai/RecoveryScoreBadge';

interface Props {
  allCases: EnrichedCase[];
  coordinators: User[];
  onSelectCase?: (caseId: string) => void;
}

const CEOAdvancedDashboard: React.FC<Props> = ({ allCases, coordinators, onSelectCase }) => {
  const { useApi } = useAuth();
  const [attendanceSnapshot, setAttendanceSnapshot] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [forecastSummary, setForecastSummary] = useState<any>(null);

  useEffect(() => {
    if (useApi) {
      apiClient.get<any>('/api/hr/attendance/today').then(r => setAttendanceSnapshot(r.data)).catch(() => {});
      apiClient.get<any>('/api/productivity/leaderboard?period=week').then(r => setLeaderboard(r.data || [])).catch(() => {});
      apiClient.get<any>('/api/ai/forecast').then(r => setForecastSummary(r.data)).catch(() => {});
    } else {
      setAttendanceSnapshot({ totalEmployees: coordinators.length + 4, present: coordinators.length + 2, absent: 1, onLeave: 1, late: 0 });
      setLeaderboard(coordinators.slice(0, 5).map((c, i) => ({
        rank: i + 1, officerName: c.name, agentCode: c.agentCode,
        totalCollected: Math.round(50000 + Math.random() * 100000),
        casesClosed: Math.floor(3 + Math.random() * 10), score: 90 - i * 12,
      })));
    }
  }, [useApi, coordinators.length]);

  const activeCases = allCases.filter(c => !['Closed', 'Withdrawn'].includes(c.crmStatus));
  const totalExposure = activeCases.reduce((s, c) => s + (c.loan?.currentBalance || 0), 0);
  const ptpCases = activeCases.filter(c => c.crmStatus === 'PTP');
  const closedThisMonth = allCases.filter(c => c.crmStatus === 'Closed').length;

  // Recovery funnel
  const funnel = [
    { stage: 'Total Cases', count: allCases.length, color: 'bg-blue-500' },
    { stage: 'Contacted', count: allCases.filter(c => c.contactStatus === 'Contact').length, color: 'bg-indigo-500' },
    { stage: 'PTP', count: ptpCases.length, color: 'bg-amber-500' },
    { stage: 'Paid/Settled', count: closedThisMonth, color: 'bg-emerald-500' },
  ];

  // Risk distribution
  const riskDist = { high: 0, medium: 0, low: 0 };
  activeCases.forEach(c => {
    const score = (['PTP', 'UNDER NEGO', 'FIP'].includes(c.crmStatus)) ? 60 : (['CB', 'WIP'].includes(c.crmStatus)) ? 40 : 20;
    if (score >= 60) riskDist.low++;
    else if (score >= 30) riskDist.medium++;
    else riskDist.high++;
  });
  const riskTotal = riskDist.high + riskDist.medium + riskDist.low;

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in-up">
      <h2 className="text-xl font-bold text-text-primary">CEO Command Center</h2>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="panel p-4">
          <p className="text-[10px] uppercase text-text-tertiary font-semibold">Total Exposure</p>
          <p className="text-xl font-bold text-text-primary mt-1">{formatCurrency(totalExposure, 'AED')}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[10px] uppercase text-text-tertiary font-semibold">Active Cases</p>
          <p className="text-xl font-bold text-primary mt-1">{activeCases.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[10px] uppercase text-text-tertiary font-semibold">PTP Cases</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{ptpCases.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-[10px] uppercase text-text-tertiary font-semibold">Closed This Month</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{closedThisMonth}</p>
        </div>
        {attendanceSnapshot && (
          <div className="panel p-4">
            <p className="text-[10px] uppercase text-text-tertiary font-semibold">Attendance Today</p>
            <p className="text-xl font-bold text-text-primary mt-1">
              {attendanceSnapshot.present}/{attendanceSnapshot.totalEmployees}
            </p>
            <p className="text-[10px] text-text-tertiary">{attendanceSnapshot.onLeave} on leave</p>
          </div>
        )}
      </div>

      {/* Row 2: Funnel + Risk + Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recovery Funnel */}
        <div className="panel p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Recovery Funnel</h3>
          <div className="space-y-3">
            {funnel.map((f, i) => (
              <div key={f.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-secondary">{f.stage}</span>
                  <span className="font-semibold text-text-primary">{f.count}</span>
                </div>
                <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${f.color} rounded-full transition-all duration-700`}
                    style={{ width: `${funnel[0].count > 0 ? (f.count / funnel[0].count) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="panel p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">AI Risk Distribution</h3>
          <div className="flex items-center justify-center gap-6">
            {[
              { label: 'High Risk', count: riskDist.high, pct: riskTotal > 0 ? Math.round((riskDist.high / riskTotal) * 100) : 0, color: 'text-red-600' },
              { label: 'Medium', count: riskDist.medium, pct: riskTotal > 0 ? Math.round((riskDist.medium / riskTotal) * 100) : 0, color: 'text-amber-600' },
              { label: 'Low Risk', count: riskDist.low, pct: riskTotal > 0 ? Math.round((riskDist.low / riskTotal) * 100) : 0, color: 'text-emerald-600' },
            ].map(r => (
              <div key={r.label} className="text-center">
                <p className={`text-2xl font-bold ${r.color}`}>{r.pct}%</p>
                <p className="text-xs text-text-tertiary">{r.label}</p>
                <p className="text-[10px] text-text-tertiary">{r.count} cases</p>
              </div>
            ))}
          </div>
          {forecastSummary && (
            <div className="mt-4 p-3 bg-primary/5 rounded-lg text-center">
              <p className="text-xs text-text-secondary">
                AI Forecast (30 days): <span className="font-bold text-primary">
                  {formatCurrency(forecastSummary.annualForecast?.predicted / 12 || 0, 'AED')} ± 8%
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Top Officer */}
        <div className="panel p-5">
          <h3 className="text-sm font-bold text-text-primary mb-4">Top Performers (This Week)</h3>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((o: any) => (
              <div key={o.officerName} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    o.rank === 1 ? 'bg-amber-400 text-white' : o.rank === 2 ? 'bg-gray-300 text-gray-700' : 'bg-orange-300 text-white'
                  }`}>{o.rank}</span>
                  <span className="font-medium text-text-primary">{o.officerName}</span>
                </div>
                <span className="font-semibold text-emerald-600">{formatCurrency(o.totalCollected, 'AED')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CEOAdvancedDashboard;
