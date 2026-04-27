import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role, ActionType, CRMStatus, SubStatus } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency, formatDate } from '../../utils';

// ── 7-day forecast — predicts case trajectory ──────────────────────────────
type ForecastEvent =
  | 'likely_payment'
  | 'broken_ptp'
  | 'no_response'
  | 'escalation_trigger'
  | 'settlement_window'
  | 'aging_milestone'
  | 'auto_recall'
  | 'nothing';

interface DayForecast {
  date: string;
  dayLabel: string;
  events: { type: ForecastEvent; probability: number; description: string; emoji: string }[];
  recommendedActions: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

const daysSince = (iso?: string | null): number => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
};

interface CrystalBallProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const CrystalBall: React.FC<CrystalBallProps> = ({ cases, currentUser, onSelectCase }) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [search, setSearch] = useState('');

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const filteredCases = useMemo(() => {
    if (!search) return myCases.slice(0, 200);
    const q = search.toLowerCase();
    return myCases.filter(c =>
      c.debtor.name.toLowerCase().includes(q) ||
      c.loan.accountNumber.toLowerCase().includes(q),
    ).slice(0, 200);
  }, [myCases, search]);

  const selected = cases.find(c => c.id === selectedCaseId);

  // ── Forecast generator — for selected case, project 7 days ahead ────────
  const forecast = useMemo<DayForecast[]>(() => {
    if (!selected) return [];

    const days: DayForecast[] = [];
    const history = selected.history || [];
    const sinceContact = daysSince(selected.lastContactDate);
    const caseAge = daysSince(selected.creationDate);
    const ptp = history.filter(a => a.promisedAmount && a.promisedDate).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const ptpDayDelta = ptp?.promisedDate ? daysUntil(ptp.promisedDate) : null;
    const recentActions = history.filter(a => daysSince(a.timestamp) <= 30).length;
    const totalPayments = history.filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid).length;

    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      const iso = date.toISOString().split('T')[0];
      const dayLabel = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      const events: DayForecast['events'] = [];
      const actions: string[] = [];

      // PTP-related events
      if (ptpDayDelta !== null) {
        if (ptpDayDelta === d) {
          events.push({
            type: 'broken_ptp',
            probability: totalPayments === 0 ? 75 : 50,
            description: `PTP due — ${ptp?.promisedAmount ? formatCurrency(ptp.promisedAmount, selected.loan.currency) : 'amount on record'}`,
            emoji: '⏰',
          });
          actions.push(`Call BEFORE noon to confirm PTP fulfilment`);
        }
        if (ptpDayDelta === d - 1 && d > 0) {
          events.push({
            type: 'broken_ptp',
            probability: 70,
            description: `PTP went overdue yesterday — recall window`,
            emoji: '🚨',
          });
          actions.push(`Aggressive recall — broken PTP`);
        }
      }

      // No response decay
      if (sinceContact + d > 30 && d <= 3) {
        events.push({
          type: 'no_response',
          probability: 60 + d * 5,
          description: `Contact silence will exceed ${sinceContact + d}d — recovery probability dropping`,
          emoji: '📵',
        });
        actions.push(`Try alt phone, WhatsApp, family contact`);
      }

      // Aging milestones
      if (caseAge + d === 90) {
        events.push({ type: 'aging_milestone', probability: 100, description: 'Case crosses 90-day mark — bucket shifts', emoji: '📅' });
      }
      if (caseAge + d === 180) {
        events.push({ type: 'aging_milestone', probability: 100, description: 'Case crosses 6-month mark — typical settlement window', emoji: '📅' });
        actions.push('Open settlement at 60-70% of balance');
      }
      if (caseAge + d === 365) {
        events.push({ type: 'aging_milestone', probability: 100, description: '1-year anniversary — recovery probability has decayed significantly', emoji: '⚠️' });
        actions.push('Final settlement push or write-off recommendation');
      }

      // Settlement window
      if (caseAge + d > 180 && totalPayments === 0 && d <= 4) {
        events.push({
          type: 'settlement_window',
          probability: 55,
          description: 'Optimal window for settlement offer (aged + dry case)',
          emoji: '💼',
        });
        if (d === 0) actions.push('Send settlement letter today, 7-day deadline');
      }

      // Auto recall
      if (recentActions === 0 && sinceContact > 14 && d === 0) {
        events.push({ type: 'auto_recall', probability: 100, description: 'Recall Engine will flag this case if untouched today', emoji: '🔔' });
        actions.push('Take ANY action today (call, SMS, note) to avoid auto-flag');
      }

      // Escalation trigger
      if (selected.crmStatus === CRMStatus.DISPUTE && caseAge + d > 60) {
        events.push({ type: 'escalation_trigger', probability: 70, description: 'Dispute aging beyond 60d — bank legal may intervene', emoji: '⚖️' });
        actions.push('Document dispute, push for bank resolution');
      }

      // Likely payment (if engaged + recent contact)
      if (sinceContact <= 7 && totalPayments > 0 && d >= 1 && d <= 3) {
        events.push({
          type: 'likely_payment',
          probability: 35,
          description: 'Profile suggests likely partial payment in next 3 days',
          emoji: '💰',
        });
        if (d === 1) actions.push('Light follow-up call — keep momentum');
      }

      if (events.length === 0) events.push({ type: 'nothing', probability: 0, description: 'Quiet day — no major triggers', emoji: '☀️' });

      // Risk level
      const maxProb = Math.max(...events.filter(e => e.type !== 'likely_payment' && e.type !== 'nothing').map(e => e.probability), 0);
      const riskLevel: DayForecast['riskLevel'] = maxProb >= 70 ? 'critical' : maxProb >= 50 ? 'high' : maxProb >= 25 ? 'medium' : 'low';

      days.push({ date: iso, dayLabel, events, recommendedActions: actions, riskLevel });
    }
    return days;
  }, [selected]);

  // ── Overall trajectory ──────────────────────────────────────────────────
  const trajectory = useMemo(() => {
    if (!selected) return null;
    const history = selected.history || [];
    const ptp = history.filter(a => a.promisedAmount).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const totalPayments = history.filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid).length;
    const recentActivity = history.filter(a => daysSince(a.timestamp) <= 14).length;

    let direction: 'improving' | 'stable' | 'declining' | 'critical';
    let summary: string;

    if (totalPayments > 0 && recentActivity > 0) {
      direction = 'improving';
      summary = 'Engaged debtor with payment history. Maintain pressure, capture full balance.';
    } else if (recentActivity > 0 && ptp) {
      direction = 'stable';
      summary = 'Active dialogue, PTP on file. Watch for fulfilment, escalate if missed.';
    } else if (daysSince(selected.lastContactDate) > 30) {
      direction = 'declining';
      summary = 'Silence — debtor disengaging. Aggressive multi-channel push needed THIS week.';
    } else if (selected.cyber === 'Yes' || selected.subStatus === SubStatus.DC_DEATH_CERTIFICATE) {
      direction = 'critical';
      summary = 'Hard kill flag — recovery near zero. Document for write-off.';
    } else {
      direction = 'stable';
      summary = 'Neutral profile — execute standard playbook this week.';
    }

    return { direction, summary };
  }, [selected]);

  const dirIcon: Record<string, string> = {
    improving: '📈', stable: '➡️', declining: '📉', critical: '🚨',
  };
  const dirColor: Record<string, string> = {
    improving: 'text-emerald-600',
    stable: 'text-blue-600',
    declining: 'text-orange-600',
    critical: 'text-red-600',
  };

  const riskColor: Record<DayForecast['riskLevel'], string> = {
    low: 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10',
    medium: 'border-amber-400 bg-amber-50/40 dark:bg-amber-900/10',
    high: 'border-orange-400 bg-orange-50/40 dark:bg-orange-900/10',
    critical: 'border-red-400 bg-red-50/40 dark:bg-red-900/10',
  };
  const riskBadge: Record<DayForecast['riskLevel'], string> = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">🔮</span>
            Crystal Ball — 7-Day Forecast
          </h1>
          <p className="text-sm text-text-secondary mt-1">Pick a case — see what's coming this week + what to do each day</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Case picker */}
        <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="p-3 border-b border-[var(--color-border)]">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search case..." className="w-full px-3 py-2 text-xs rounded-lg" />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
            {filteredCases.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className={`w-full text-left p-3 hover:bg-[var(--color-bg-muted)] ${selectedCaseId === c.id ? 'bg-[var(--color-primary-glow)] border-l-2 border-[var(--color-primary)]' : ''}`}
              >
                <p className="text-sm font-semibold truncate">{c.debtor.name}</p>
                <p className="text-[10px] text-text-tertiary truncate">{c.loan.bank} • {formatCurrency(c.loan.currentBalance, c.loan.currency)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Forecast */}
        <div className="lg:col-span-3 space-y-4">
          {!selected ? (
            <div className="panel p-12 text-center">
              <p className="text-6xl mb-4">🔮</p>
              <p className="text-sm text-text-secondary">Pick a case to see its 7-day forecast.</p>
              <p className="text-xs text-text-tertiary mt-2">Crystal Ball uses payment history, PTPs, contact silence, age milestones to predict each day.</p>
            </div>
          ) : (
            <>
              {/* Trajectory header */}
              <div className="panel p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-[10px] uppercase opacity-70 tracking-wider">Case Trajectory</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-3xl">{dirIcon[trajectory?.direction || 'stable']}</span>
                      <div>
                        <p className="text-xl font-bold uppercase">{trajectory?.direction}</p>
                        <p className="text-xs opacity-90">{selected.debtor.name} • {selected.loan.bank}</p>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => onSelectCase(selected.id)} className="text-xs underline opacity-90 hover:opacity-100">Open full case →</button>
                </div>
                <p className="text-xs opacity-95 mt-3 leading-relaxed">{trajectory?.summary}</p>
              </div>

              {/* Day cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {forecast.slice(0, 4).map(day => (
                  <div key={day.date} className={`panel p-3 border-l-4 ${riskColor[day.riskLevel]}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold">{day.dayLabel}</p>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${riskBadge[day.riskLevel]}`}>
                        {day.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {day.events.map((e, i) => (
                        <div key={i} className="text-[11px]">
                          <p className="font-semibold flex items-center gap-1">
                            <span>{e.emoji}</span>
                            {e.type !== 'nothing' && <span className="text-text-tertiary">{e.probability}%</span>}
                          </p>
                          <p className="text-text-secondary leading-tight">{e.description}</p>
                        </div>
                      ))}
                    </div>
                    {day.recommendedActions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                        {day.recommendedActions.map((a, i) => (
                          <p key={i} className="text-[10px] text-[var(--color-primary)] font-semibold">→ {a}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Days 5-7 in second row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {forecast.slice(4, 7).map(day => (
                  <div key={day.date} className={`panel p-3 border-l-4 ${riskColor[day.riskLevel]}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold">{day.dayLabel}</p>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${riskBadge[day.riskLevel]}`}>
                        {day.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {day.events.map((e, i) => (
                        <div key={i} className="text-[11px]">
                          <p className="font-semibold flex items-center gap-1">
                            <span>{e.emoji}</span>
                            {e.type !== 'nothing' && <span className="text-text-tertiary">{e.probability}%</span>}
                          </p>
                          <p className="text-text-secondary leading-tight">{e.description}</p>
                        </div>
                      ))}
                    </div>
                    {day.recommendedActions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                        {day.recommendedActions.map((a, i) => (
                          <p key={i} className="text-[10px] text-[var(--color-primary)] font-semibold">→ {a}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrystalBall;
