import React, { useMemo, useState } from 'react';
import { EnrichedCase, User, Role, ActionType, CRMStatus } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';

// ── Daily Focus — Officer's prioritized worklist for today ──────────────────
// Sorts cases by ACTIONABILITY, not just status. Tells officer what to do NOW.

type FocusReason =
  | 'ptp_today'
  | 'ptp_overdue'
  | 'ptp_at_risk'         // due in 1-2 days, last contact > 5 days
  | 'callback_today'      // explicit callback scheduled
  | 'callback_overdue'    // missed callback
  | 'fresh_high_value'    // new case, high balance, never contacted
  | 'reachable'           // known good contact + been silent
  | 'silent_alert'        // 14+ days no contact, was responsive earlier
  | 'aged_settlement'     // 180+ day case eligible for settlement push
  | 'just_engaged';       // recent positive contact, follow up

interface FocusItem {
  case: EnrichedCase;
  reason: FocusReason;
  priority: number;       // higher = act first
  badge: string;
  description: string;
  suggestedAction: string;
}

const daysSince = (iso?: string | null): number => {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 9999;
  return Math.floor((Date.now() - t) / 86400000);
};

const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / 86400000);
};

function buildFocus(c: EnrichedCase): FocusItem | null {
  // Skip closed cases
  if ([CRMStatus.CLOSED, CRMStatus.WITHDRAWN, CRMStatus.WDS, CRMStatus.EXPIRE].includes(c.crmStatus)) return null;
  if (c.cyber === 'Yes') return null; // skip cyber flagged

  const history = c.history || [];
  const sinceContact = daysSince(c.lastContactDate);
  const ptp = history.filter(a => a.promisedAmount && a.promisedDate).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const ptpDue = ptp?.promisedDate ? daysUntil(ptp.promisedDate) : null;

  // Has PTP been paid?
  const ptpPaid = ptp ? history.some(h =>
    h.type === ActionType.PAYMENT_RECEIVED &&
    h.amountPaid &&
    new Date(h.timestamp).getTime() >= new Date(ptp.timestamp).getTime()
  ) : false;

  // Callbacks
  const callbacks = history.filter(a => a.nextFollowUp);
  const lastCallback = callbacks.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const callbackDue = lastCallback?.nextFollowUp ? daysUntil(lastCallback.nextFollowUp) : null;

  const totalPayments = history.filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid).length;
  const caseAge = daysSince(c.creationDate);

  // ── Priority: PTP today (act NOW) ────────────────────────────────
  if (ptp && !ptpPaid && ptpDue === 0) {
    return {
      case: c, reason: 'ptp_today', priority: 100,
      badge: '⏰ PTP TODAY',
      description: `${formatCurrency(ptp.promisedAmount!, c.loan.currency)} promised today`,
      suggestedAction: 'Call before noon — confirm payment in same call. Get bank reference number.',
    };
  }

  // ── PTP overdue ──────────────────────────────────────────────────
  if (ptp && !ptpPaid && ptpDue !== null && ptpDue < 0) {
    return {
      case: c, reason: 'ptp_overdue', priority: 95,
      badge: '🚨 PTP OVERDUE',
      description: `Broke promise ${Math.abs(ptpDue)}d ago`,
      suggestedAction: 'Aggressive recall. No more verbal commitments — demand cash now or escalate.',
    };
  }

  // ── Callback today ───────────────────────────────────────────────
  if (lastCallback && callbackDue === 0) {
    return {
      case: c, reason: 'callback_today', priority: 90,
      badge: '📞 CALLBACK TODAY',
      description: `You scheduled callback for today`,
      suggestedAction: 'You promised to call. Honor it — reliability builds trust with debtor.',
    };
  }

  // ── Callback overdue ─────────────────────────────────────────────
  if (lastCallback && callbackDue !== null && callbackDue < 0 && callbackDue > -7) {
    return {
      case: c, reason: 'callback_overdue', priority: 85,
      badge: '⚠️ MISSED CALLBACK',
      description: `Callback was due ${Math.abs(callbackDue)}d ago`,
      suggestedAction: 'Apologize for delay, immediately reschedule. Don\'t let pattern continue.',
    };
  }

  // ── PTP at risk (due in 1-2 days, debtor went silent) ────────────
  if (ptp && !ptpPaid && ptpDue !== null && ptpDue >= 1 && ptpDue <= 2 && sinceContact > 5) {
    return {
      case: c, reason: 'ptp_at_risk', priority: 75,
      badge: '⚠️ PTP AT RISK',
      description: `${formatCurrency(ptp.promisedAmount!, c.loan.currency)} due in ${ptpDue}d, silent ${sinceContact}d`,
      suggestedAction: 'Pre-confirmation call. Verify debtor still intends to pay tomorrow.',
    };
  }

  // ── Fresh high-value case (never contacted) ──────────────────────
  if (caseAge < 14 && history.length === 0 && c.loan.currentBalance > 30000) {
    return {
      case: c, reason: 'fresh_high_value', priority: 70,
      badge: '💰 FRESH CASE',
      description: `${formatCurrency(c.loan.currentBalance, c.loan.currency)} • never contacted`,
      suggestedAction: 'First contact crucial. Set tone: professional, firm, document-driven.',
    };
  }

  // ── Just engaged (recent positive contact) ───────────────────────
  if (sinceContact <= 3 && c.contactStatus === 'Contact' && totalPayments === 0) {
    return {
      case: c, reason: 'just_engaged', priority: 60,
      badge: '✅ ENGAGED',
      description: `Last contact ${sinceContact}d ago — momentum window`,
      suggestedAction: 'Strike while warm. Push for PTP commitment + bank transfer reference today.',
    };
  }

  // ── Aged settlement candidate ────────────────────────────────────
  if (caseAge > 180 && totalPayments === 0 && sinceContact < 30) {
    return {
      case: c, reason: 'aged_settlement', priority: 50,
      badge: '💼 SETTLE NOW',
      description: `${caseAge}d old, no payments — settlement window`,
      suggestedAction: 'Send formal settlement offer (60-70%). Make 7-day deadline.',
    };
  }

  // ── Silent alert (was reachable, gone quiet) ─────────────────────
  if (c.contactStatus === 'Contact' && sinceContact > 14 && sinceContact < 60) {
    return {
      case: c, reason: 'silent_alert', priority: 40,
      badge: '📵 GONE QUIET',
      description: `Was reachable, silent ${sinceContact}d`,
      suggestedAction: 'Try alt number, WhatsApp, family contact. Don\'t lose them.',
    };
  }

  return null;
}

interface DailyFocusProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const DailyFocus: React.FC<DailyFocusProps> = ({ cases, currentUser, onSelectCase }) => {
  const [filter, setFilter] = useState<'all' | FocusReason>('all');

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const focusList = useMemo(() => {
    return myCases
      .map(buildFocus)
      .filter((x): x is FocusItem => x !== null)
      .sort((a, b) => b.priority - a.priority);
  }, [myCases]);

  const filtered = useMemo(() => {
    if (filter === 'all') return focusList;
    return focusList.filter(f => f.reason === filter);
  }, [focusList, filter]);

  const stats = useMemo(() => {
    const today = focusList.filter(f => f.reason === 'ptp_today' || f.reason === 'callback_today').length;
    const overdue = focusList.filter(f => f.reason === 'ptp_overdue' || f.reason === 'callback_overdue').length;
    const fresh = focusList.filter(f => f.reason === 'fresh_high_value').length;
    const engaged = focusList.filter(f => f.reason === 'just_engaged').length;
    const aged = focusList.filter(f => f.reason === 'aged_settlement').length;
    const totalValue = focusList.reduce((s, f) => s + f.case.loan.currentBalance, 0);
    return { total: focusList.length, today, overdue, fresh, engaged, aged, totalValue };
  }, [focusList]);

  const reasonColor: Record<FocusReason, string> = {
    ptp_today: 'border-red-500 bg-red-50/50 dark:bg-red-900/20',
    ptp_overdue: 'border-red-600 bg-red-50/50 dark:bg-red-900/20',
    callback_today: 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/20',
    callback_overdue: 'border-orange-600 bg-orange-50/50 dark:bg-orange-900/20',
    ptp_at_risk: 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20',
    fresh_high_value: 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20',
    just_engaged: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20',
    aged_settlement: 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20',
    silent_alert: 'border-gray-500 bg-gray-50/50 dark:bg-gray-900/20',
    reachable: 'border-blue-400 bg-blue-50/30 dark:bg-blue-900/10',
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">🎯</span>
            Today's Focus
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {currentUser.role === Role.OFFICER
              ? `Aap ke ${stats.total} priority cases — sorted by jo abhi karna hai`
              : `Team's prioritized worklist — ${stats.total} active focus items`}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-text-primary', filter: 'all' as const },
          { label: 'Today', value: stats.today, color: 'text-red-600', filter: 'ptp_today' as const },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-600', filter: 'ptp_overdue' as const },
          { label: 'Fresh', value: stats.fresh, color: 'text-blue-600', filter: 'fresh_high_value' as const },
          { label: 'Engaged', value: stats.engaged, color: 'text-emerald-600', filter: 'just_engaged' as const },
          { label: 'Aged', value: stats.aged, color: 'text-purple-600', filter: 'aged_settlement' as const },
        ].map(k => (
          <button
            key={k.label}
            onClick={() => setFilter(k.filter)}
            className={`panel p-3 text-left hover:bg-[var(--color-bg-muted)] transition-colors ${filter === k.filter ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
          >
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </button>
        ))}
      </div>

      {/* Total at-risk value */}
      <div className="panel p-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
        <p className="text-[10px] uppercase opacity-70">At-risk balance in today's focus</p>
        <p className="text-2xl font-bold">{formatCurrency(stats.totalValue, 'AED')}</p>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-sm font-bold">No urgent focus items.</p>
          <p className="text-xs text-text-tertiary mt-1">All caught up — work through your case list as normal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 50).map(f => (
            <button
              key={f.case.id}
              onClick={() => onSelectCase(f.case.id)}
              className={`panel p-4 w-full text-left hover:bg-[var(--color-bg-muted)] border-l-4 transition-all ${reasonColor[f.reason]}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold">{f.badge}</span>
                    <span className="text-sm font-semibold">{f.case.debtor.name}</span>
                    <span className="text-[11px] text-text-tertiary">{f.case.loan.bank} • {f.case.loan.accountNumber}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{f.description}</p>
                  <p className="text-[11px] text-[var(--color-primary)] font-semibold mt-1">→ {f.suggestedAction}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-sm font-bold">{formatCurrency(f.case.loan.currentBalance, f.case.loan.currency)}</span>
                  <span className="text-[9px] text-text-tertiary">priority {f.priority}</span>
                </div>
              </div>
            </button>
          ))}
          {filtered.length > 50 && <p className="text-center text-xs text-text-tertiary">Showing top 50 of {filtered.length} focus items</p>}
        </div>
      )}
    </div>
  );
};

export default DailyFocus;
