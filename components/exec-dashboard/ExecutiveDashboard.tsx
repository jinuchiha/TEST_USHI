import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EnrichedCase, User, Role, ActionType, CRMStatus } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';

interface ExecutiveDashboardProps {
  cases: EnrichedCase[];
  users: User[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const daysSince = (iso?: string | null): number => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ cases, users, currentUser, onSelectCase }) => {
  const [pulse, setPulse] = useState(0); // for live ticker animation
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => { setPulse(p => p + 1); setNow(new Date()); }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Live recovery ticker (sum of all payments today, animated) ──────────
  const todayPayments = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return cases.flatMap(c => (c.history || [])
      .filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid && a.timestamp.startsWith(today))
      .map(a => ({ amount: a.amountPaid!, currency: c.loan.currency, debtor: c.debtor.name, time: a.timestamp, caseId: c.id }))
    ).sort((a, b) => b.time.localeCompare(a.time));
  }, [cases]);

  const todayRecoveredAed = todayPayments.reduce((s, p) => s + p.amount, 0); // simplification: assume all AED-equiv

  // ── Officer race (today's leaderboard) ──────────────────────────────────
  const officerRace = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const officers = users.filter(u => u.role === Role.OFFICER);
    const stats = officers.map(o => {
      const myCases = cases.filter(c => c.assignedOfficerId === o.id);
      const todayActions = myCases.flatMap(c => (c.history || []).filter(a => a.officerId === o.id && a.timestamp.startsWith(today)));
      const todayRecovery = todayActions.filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid).reduce((s, a) => s + (a.amountPaid || 0), 0);
      const todayPtp = todayActions.filter(a => a.promisedAmount && a.promisedAmount > 0).length;
      return {
        officer: o,
        actions: todayActions.length,
        recovery: todayRecovery,
        ptp: todayPtp,
        target: o.dailyTarget || 5000,
        percent: Math.min(100, (todayRecovery / (o.dailyTarget || 5000)) * 100),
      };
    }).sort((a, b) => b.recovery - a.recovery);
    return stats;
  }, [users, cases]);

  // ── KPI tiles ───────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalOutstanding = cases.reduce((s, c) => s + c.loan.currentBalance, 0);
    const activeCases = cases.filter(c => ![CRMStatus.CLOSED, CRMStatus.WITHDRAWN, CRMStatus.WDS, CRMStatus.EXPIRE].includes(c.crmStatus)).length;

    const today = new Date().toISOString().split('T')[0];
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthPayments = cases.flatMap(c => (c.history || []).filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid && a.timestamp >= monthStart));
    const monthRecovery = monthPayments.reduce((s, a) => s + (a.amountPaid || 0), 0);

    const ptpsLive = cases.filter(c => (c.history || []).some(a => a.promisedAmount && a.promisedDate && new Date(a.promisedDate) >= new Date())).length;
    const overduePtps = cases.filter(c => (c.history || []).some(a => {
      if (!a.promisedAmount || !a.promisedDate) return false;
      const due = new Date(a.promisedDate);
      const paid = (c.history || []).some(p => p.type === ActionType.PAYMENT_RECEIVED && new Date(p.timestamp).getTime() >= new Date(a.timestamp).getTime());
      return due < new Date() && !paid;
    })).length;

    const cyberCases = cases.filter(c => c.cyber === 'Yes').length;
    const nonContact = cases.filter(c => c.contactStatus === 'Non Contact').length;

    return {
      totalOutstanding, activeCases, monthRecovery, monthPayments: monthPayments.length,
      ptpsLive, overduePtps, cyberCases, nonContact,
    };
  }, [cases]);

  // ── Today's mission for current user ────────────────────────────────────
  const myMission = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const myActions = cases.flatMap(c => (c.history || []).filter(a => a.officerId === currentUser.id && a.timestamp.startsWith(today)));
    const myRecovery = myActions.filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid).reduce((s, a) => s + (a.amountPaid || 0), 0);
    const myPtp = myActions.filter(a => a.promisedAmount).length;
    const myCalls = myActions.filter(a => a.type === ActionType.SOFT_CALL).length;
    return {
      target: currentUser.dailyTarget || 5000,
      recovery: myRecovery,
      percent: Math.min(100, (myRecovery / (currentUser.dailyTarget || 5000)) * 100),
      ptp: myPtp,
      calls: myCalls,
      total: myActions.length,
    };
  }, [cases, currentUser]);

  // ── Live alerts (rotating ticker) ───────────────────────────────────────
  const alerts = useMemo(() => {
    const alerts: { type: string; emoji: string; text: string; color: string; caseId?: string }[] = [];
    todayPayments.slice(0, 5).forEach(p => {
      alerts.push({ type: 'payment', emoji: '💰', text: `${p.debtor} paid ${formatCurrency(p.amount, p.currency)}`, color: 'text-emerald-600', caseId: p.caseId });
    });
    if (kpi.overduePtps > 0) alerts.push({ type: 'ptp_overdue', emoji: '⚠️', text: `${kpi.overduePtps} overdue PTP${kpi.overduePtps > 1 ? 's' : ''} need recall`, color: 'text-red-600' });
    if (kpi.cyberCases > 0) alerts.push({ type: 'cyber', emoji: '🚨', text: `${kpi.cyberCases} cyber-flagged case${kpi.cyberCases > 1 ? 's' : ''}`, color: 'text-red-600' });
    return alerts;
  }, [todayPayments, kpi]);

  // ── Bank distribution (top 5) ──────────────────────────────────────────
  const bankDist = useMemo(() => {
    const byBank = new Map<string, { count: number; balance: number }>();
    cases.forEach(c => {
      if (!byBank.has(c.loan.bank)) byBank.set(c.loan.bank, { count: 0, balance: 0 });
      const e = byBank.get(c.loan.bank)!;
      e.count++; e.balance += c.loan.currentBalance;
    });
    return Array.from(byBank.entries())
      .map(([bank, v]) => ({ bank, ...v }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 6);
  }, [cases]);

  // ── Pakistan city distribution ──────────────────────────────────────────
  const cityDist = useMemo(() => {
    const cities = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Sialkot'];
    const byCity = new Map<string, number>();
    cases.forEach(c => {
      const addr = (c.debtor.address || '').toLowerCase();
      for (const city of cities) {
        if (addr.includes(city.toLowerCase())) {
          byCity.set(city, (byCity.get(city) || 0) + 1);
          break;
        }
      }
    });
    return Array.from(byCity.entries()).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
  }, [cases]);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Hero — live ticker */}
      <div className="panel p-6 bg-gradient-to-br from-[var(--color-primary)] via-purple-500 to-blue-500 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3), transparent)' }} />
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70">Today's Recovery</p>
            <p className="text-5xl font-bold mt-1 tabular-nums">
              {formatCurrency(todayRecoveredAed, 'AED')}
            </p>
            <p className="text-[11px] opacity-70 mt-1">{todayPayments.length} payments • {now.toLocaleTimeString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70">Month Recovery</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(kpi.monthRecovery, 'AED')}</p>
            <p className="text-[11px] opacity-70 mt-1">{kpi.monthPayments} transactions this month</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70">Live Pulse</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-3 h-3 rounded-full bg-emerald-400 ${pulse % 2 === 0 ? 'opacity-100' : 'opacity-40'} transition-opacity`} />
              <p className="text-sm font-semibold">{kpi.activeCases} active cases</p>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(kpi.totalOutstanding, 'AED')}</p>
            <p className="text-[11px] opacity-70">total portfolio</p>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Active Cases', value: kpi.activeCases, color: 'text-text-primary' },
          { label: 'Live PTPs', value: kpi.ptpsLive, color: 'text-cyan-600' },
          { label: 'Overdue PTPs', value: kpi.overduePtps, color: 'text-red-600' },
          { label: 'Non Contact', value: kpi.nonContact, color: 'text-amber-600' },
          { label: 'Cyber Flags', value: kpi.cyberCases, color: 'text-red-600' },
          { label: 'Today Payments', value: todayPayments.length, color: 'text-emerald-600' },
          { label: 'Banks', value: bankDist.length, color: 'text-text-primary' },
          { label: 'Cities', value: cityDist.length, color: 'text-text-primary' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's Mission */}
        <div className="panel p-5 bg-gradient-to-br from-emerald-500 to-blue-500 text-white">
          <p className="text-[10px] uppercase tracking-widest opacity-70">Today's Mission</p>
          <p className="text-3xl font-bold mt-1">{Math.round(myMission.percent)}%</p>
          <div className="h-2 rounded-full bg-white/20 mt-2 overflow-hidden">
            <div className="h-full bg-white transition-all duration-500" style={{ width: `${myMission.percent}%` }} />
          </div>
          <p className="text-[11px] opacity-90 mt-2">{formatCurrency(myMission.recovery, 'AED')} of {formatCurrency(myMission.target, 'AED')}</p>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
            <div><p className="text-[10px] opacity-70">Calls</p><p className="text-lg font-bold">{myMission.calls}</p></div>
            <div><p className="text-[10px] opacity-70">PTPs</p><p className="text-lg font-bold">{myMission.ptp}</p></div>
            <div><p className="text-[10px] opacity-70">Actions</p><p className="text-lg font-bold">{myMission.total}</p></div>
          </div>
        </div>

        {/* Officer Race */}
        <div className="panel overflow-hidden lg:col-span-2">
          <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-bold">🏆 Officer Race — Today</h3>
            <p className="text-[10px] text-text-tertiary">Live</p>
          </div>
          <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto">
            {officerRace.length === 0 ? (
              <p className="text-center text-xs text-text-tertiary py-4">No officers yet.</p>
            ) : officerRace.map((o, i) => (
              <div key={o.officer.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[11px] font-bold">{i + 1}</span>
                    <p className="font-semibold">{o.officer.name}</p>
                    {i === 0 && <span>🥇</span>}
                    {i === 1 && <span>🥈</span>}
                    {i === 2 && <span>🥉</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                    <span>{o.actions} actions</span>
                    <span>{o.ptp} PTPs</span>
                    <span className="font-bold text-text-primary">{formatCurrency(o.recovery, 'AED')}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${o.percent >= 100 ? 'bg-emerald-500' : o.percent >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${o.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Live alerts */}
        <div className="panel overflow-hidden">
          <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-bold">📡 Live Alerts</h3>
            <span className={`w-2 h-2 rounded-full bg-emerald-500 ${pulse % 2 === 0 ? 'opacity-100' : 'opacity-30'} transition-opacity`} />
          </div>
          <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-center text-xs text-text-tertiary py-4">No alerts. ✓ All clear.</p>
            ) : alerts.map((a, i) => (
              <button
                key={i}
                onClick={() => a.caseId && onSelectCase(a.caseId)}
                disabled={!a.caseId}
                className="w-full text-left flex items-start gap-2 p-2 rounded hover:bg-[var(--color-bg-muted)] disabled:hover:bg-transparent"
              >
                <span className="text-lg">{a.emoji}</span>
                <p className={`text-xs ${a.color}`}>{a.text}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Bank distribution bars */}
        <div className="panel overflow-hidden">
          <div className="p-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold">🏦 Top Banks</h3>
          </div>
          <div className="p-3 space-y-2.5 max-h-[280px] overflow-y-auto">
            {bankDist.map(b => {
              const pct = (b.balance / kpi.totalOutstanding) * 100;
              return (
                <div key={b.bank}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-semibold truncate flex-1">{b.bank}</span>
                    <span className="text-text-tertiary ml-2">{b.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[var(--color-primary)] to-purple-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{formatCurrency(b.balance, 'AED')} ({pct.toFixed(1)}%)</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* PK city heat map */}
        <div className="panel overflow-hidden">
          <div className="p-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold">🇵🇰 Pakistan Distribution</h3>
          </div>
          <div className="p-3 space-y-1.5 max-h-[280px] overflow-y-auto">
            {cityDist.length === 0 ? (
              <p className="text-center text-xs text-text-tertiary py-4">No city data yet.</p>
            ) : cityDist.map(c => {
              const max = cityDist[0].count;
              const heat = c.count / max;
              return (
                <div key={c.city} className="flex items-center gap-2">
                  <p className="text-xs font-semibold w-20 flex-shrink-0">{c.city}</p>
                  <div className="flex-1 h-5 rounded bg-[var(--color-bg-tertiary)] relative overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${heat * 100}%`, background: `rgba(239, 68, 68, ${0.3 + heat * 0.5})` }}
                    />
                    <p className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold">{c.count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent payments stream */}
      <div className="panel">
        <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-bold">💰 Today's Payment Stream</h3>
          <p className="text-[10px] text-text-tertiary">Latest first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-tertiary)]">
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Time</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Debtor</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Amount</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary"></th>
              </tr>
            </thead>
            <tbody>
              {todayPayments.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-xs text-text-tertiary">No payments today yet — let's go 💪</td></tr>
              ) : todayPayments.slice(0, 20).map((p, i) => (
                <tr key={i} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]">
                  <td className="py-2 px-3 text-xs text-text-secondary">{new Date(p.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-2 px-3 text-xs font-semibold">{p.debtor}</td>
                  <td className="py-2 px-3 text-xs font-bold text-emerald-600">+{formatCurrency(p.amount, p.currency)}</td>
                  <td className="py-2 px-3"><button onClick={() => onSelectCase(p.caseId)} className="text-[11px] text-[var(--color-primary)] hover:underline">Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
