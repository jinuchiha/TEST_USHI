import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role, ActionType, CRMStatus } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency, formatDate } from '../../utils';

// ── Recall scoring — flag cases that need attention NOW ─────────────────────
type RecallReason =
  | 'no_action_7d'
  | 'no_action_14d'
  | 'no_action_30d'
  | 'broken_ptp_overdue'
  | 'ptp_due_today'
  | 'ptp_due_3d'
  | 'silent_60d'
  | 'aging_critical'
  | 'high_value_no_contact'
  | 'cb_no_progress';

interface FlaggedCase {
  case: EnrichedCase;
  reasons: { code: RecallReason; label: string; severity: 'urgent' | 'high' | 'medium'; detail: string }[];
  priority: number; // higher = more urgent
}

const REASON_META: Record<RecallReason, { label: string; severity: 'urgent' | 'high' | 'medium'; weight: number }> = {
  no_action_7d:           { label: 'No action 7+ days',           severity: 'medium', weight: 10 },
  no_action_14d:          { label: 'No action 14+ days',          severity: 'high',   weight: 25 },
  no_action_30d:          { label: 'No action 30+ days',          severity: 'urgent', weight: 50 },
  broken_ptp_overdue:     { label: 'PTP overdue',                  severity: 'urgent', weight: 60 },
  ptp_due_today:          { label: 'PTP due TODAY',                severity: 'urgent', weight: 70 },
  ptp_due_3d:             { label: 'PTP due in 3 days',            severity: 'high',   weight: 30 },
  silent_60d:             { label: 'Debtor silent 60+ days',       severity: 'high',   weight: 35 },
  aging_critical:         { label: 'Case aging > 1 year',          severity: 'medium', weight: 15 },
  high_value_no_contact:  { label: 'High value + non-contact',     severity: 'urgent', weight: 55 },
  cb_no_progress:         { label: 'CB status, no progress 14d',   severity: 'high',   weight: 30 },
};

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

function flagCase(c: EnrichedCase): FlaggedCase | null {
  const reasons: FlaggedCase['reasons'] = [];

  // Skip closed cases
  if ([CRMStatus.CLOSED, CRMStatus.WITHDRAWN, CRMStatus.WDS, CRMStatus.EXPIRE].includes(c.crmStatus)) return null;

  const lastAction = (c.history || []).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const sinceLastAction = lastAction ? daysSince(lastAction.timestamp) : daysSince(c.creationDate);
  const sinceContact = daysSince(c.lastContactDate);

  // PTP / promise
  const ptp = (c.history || []).filter(a => a.promisedAmount && a.promisedDate).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (ptp?.promisedDate) {
    const du = daysUntil(ptp.promisedDate);
    if (du !== null) {
      const paid = (c.history || []).some(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid && new Date(a.timestamp).getTime() >= new Date(ptp.timestamp).getTime());
      if (!paid) {
        if (du < 0) reasons.push({ code: 'broken_ptp_overdue', label: REASON_META.broken_ptp_overdue.label, severity: 'urgent', detail: `Promised ${formatCurrency(ptp.promisedAmount!, c.loan.currency)} on ${formatDate(ptp.promisedDate)} — ${Math.abs(du)}d overdue` });
        else if (du === 0) reasons.push({ code: 'ptp_due_today', label: REASON_META.ptp_due_today.label, severity: 'urgent', detail: `${formatCurrency(ptp.promisedAmount!, c.loan.currency)} due today` });
        else if (du <= 3) reasons.push({ code: 'ptp_due_3d', label: REASON_META.ptp_due_3d.label, severity: 'high', detail: `${formatCurrency(ptp.promisedAmount!, c.loan.currency)} due in ${du}d` });
      }
    }
  }

  // No action staleness
  if (sinceLastAction >= 30) reasons.push({ code: 'no_action_30d', label: REASON_META.no_action_30d.label, severity: 'urgent', detail: `${sinceLastAction} days no activity` });
  else if (sinceLastAction >= 14) reasons.push({ code: 'no_action_14d', label: REASON_META.no_action_14d.label, severity: 'high', detail: `${sinceLastAction} days no activity` });
  else if (sinceLastAction >= 7) reasons.push({ code: 'no_action_7d', label: REASON_META.no_action_7d.label, severity: 'medium', detail: `${sinceLastAction} days no activity` });

  // Debtor silence
  if (sinceContact >= 60) reasons.push({ code: 'silent_60d', label: REASON_META.silent_60d.label, severity: 'high', detail: `Debtor silent for ${sinceContact}d` });

  // High value + non-contact
  if (c.contactStatus === 'Non Contact' && c.loan.currentBalance > 50000) {
    reasons.push({ code: 'high_value_no_contact', label: REASON_META.high_value_no_contact.label, severity: 'urgent', detail: `${formatCurrency(c.loan.currentBalance, c.loan.currency)} balance, untraceable` });
  }

  // CB no progress
  if (c.crmStatus === CRMStatus.CB && sinceLastAction >= 14) {
    reasons.push({ code: 'cb_no_progress', label: REASON_META.cb_no_progress.label, severity: 'high', detail: `${sinceLastAction}d in CB without progress` });
  }

  // Aging critical
  const caseAge = daysSince(c.creationDate);
  if (caseAge > 365) reasons.push({ code: 'aging_critical', label: REASON_META.aging_critical.label, severity: 'medium', detail: `${caseAge}d old` });

  if (reasons.length === 0) return null;

  // Dedup — pick highest severity per code already done. Compute priority:
  const priority = reasons.reduce((s, r) => s + REASON_META[r.code].weight, 0);

  return { case: c, reasons, priority };
}

// ── Component ────────────────────────────────────────────────────────────────
interface RecallEngineProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const RecallEngine: React.FC<RecallEngineProps> = ({ cases, currentUser, onSelectCase }) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'urgent' | 'high' | 'medium'>('all');
  const [filterReason, setFilterReason] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [filterOfficerId, setFilterOfficerId] = useState<string>('all');

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const flagged = useMemo(() => {
    return myCases
      .map(flagCase)
      .filter((x): x is FlaggedCase => x !== null)
      .sort((a, b) => b.priority - a.priority);
  }, [myCases]);

  const filtered = useMemo(() => {
    return flagged.filter(f => {
      if (filterSeverity !== 'all' && !f.reasons.some(r => r.severity === filterSeverity)) return false;
      if (filterReason !== 'all' && !f.reasons.some(r => r.code === filterReason)) return false;
      if (filterOfficerId !== 'all' && f.case.assignedOfficerId !== filterOfficerId) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!f.case.debtor.name.toLowerCase().includes(q) &&
            !f.case.loan.accountNumber.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [flagged, filterSeverity, filterReason, search, filterOfficerId]);

  const stats = useMemo(() => {
    const urgent = flagged.filter(f => f.reasons.some(r => r.severity === 'urgent')).length;
    const high = flagged.filter(f => f.reasons.some(r => r.severity === 'high') && !f.reasons.some(r => r.severity === 'urgent')).length;
    const medium = flagged.filter(f => f.reasons.every(r => r.severity === 'medium')).length;
    const totalBalance = flagged.reduce((s, f) => s + f.case.loan.currentBalance, 0);
    const ptpToday = flagged.filter(f => f.reasons.some(r => r.code === 'ptp_due_today')).length;
    const overduePtp = flagged.filter(f => f.reasons.some(r => r.code === 'broken_ptp_overdue')).length;
    return { total: flagged.length, urgent, high, medium, totalBalance, ptpToday, overduePtp };
  }, [flagged]);

  const officers = useMemo(() => {
    const ids = new Set(myCases.map(c => c.assignedOfficerId));
    return Array.from(ids);
  }, [myCases]);

  const severityColor: Record<string, string> = {
    urgent: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-amber-500 text-white',
  };
  const severityBadge: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.bell('w-7 h-7')}
            Recall Engine
          </h1>
          <p className="text-sm text-text-secondary mt-1">Auto-flagged cases needing attention now</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Flagged', value: stats.total, color: 'text-text-primary' },
          { label: 'Urgent', value: stats.urgent, color: 'text-red-600' },
          { label: 'High', value: stats.high, color: 'text-orange-600' },
          { label: 'Medium', value: stats.medium, color: 'text-amber-600' },
          { label: 'PTP Due Today', value: stats.ptpToday, color: 'text-red-600' },
          { label: 'PTP Overdue', value: stats.overduePtp, color: 'text-red-600' },
          { label: 'At Risk', value: formatCurrency(stats.totalBalance, 'AED'), color: 'text-text-primary' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-base font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search debtor / account..." className="px-3 py-2 text-sm rounded-lg flex-1 min-w-[200px]" />
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as any)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Severities</option>
          <option value="urgent">🔴 Urgent only</option>
          <option value="high">🟠 High only</option>
          <option value="medium">🟡 Medium only</option>
        </select>
        <select value={filterReason} onChange={e => setFilterReason(e.target.value)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Reasons</option>
          {Object.entries(REASON_META).map(([code, m]) => <option key={code} value={code}>{m.label}</option>)}
        </select>
        {currentUser.role !== Role.OFFICER && (
          <select value={filterOfficerId} onChange={e => setFilterOfficerId(e.target.value)} className="px-3 py-2 text-sm rounded-lg">
            <option value="all">All Officers</option>
            {officers.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        )}
      </div>

      {/* Flagged list */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-text-secondary text-sm">No cases need attention. ✓ Team is on top of things.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 100).map(f => {
            const topSeverity = f.reasons.find(r => r.severity === 'urgent') || f.reasons.find(r => r.severity === 'high') || f.reasons[0];
            return (
              <div
                key={f.case.id}
                onClick={() => onSelectCase(f.case.id)}
                className="panel p-4 cursor-pointer hover:bg-[var(--color-bg-muted)] flex items-start gap-4"
              >
                <div className={`w-2 self-stretch rounded-full ${topSeverity.severity === 'urgent' ? 'bg-red-500' : topSeverity.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-bold">{f.case.debtor.name}</p>
                      <p className="text-[11px] text-text-tertiary">{f.case.loan.bank} • {f.case.loan.accountNumber} • {formatCurrency(f.case.loan.currentBalance, f.case.loan.currency)}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${severityColor[topSeverity.severity]}`}>
                      Priority {f.priority}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {f.reasons.map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${severityBadge[r.severity]}`}>{r.label}</span>
                        <span className="text-[10px] text-text-tertiary">{r.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length > 100 && <p className="text-center text-xs text-text-tertiary">Showing top 100 of {filtered.length}</p>}
        </div>
      )}
    </div>
  );
};

export default RecallEngine;
