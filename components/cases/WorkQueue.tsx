import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { EnrichedCase, User, CRMStatus, Role } from '../../types';
import { formatCurrency } from '../../utils';

interface WorkQueueProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

type FilterType = 'all' | 'ptp_due' | 'high_value' | 'new_cases' | 'stale' | 'callbacks';

interface ScoredCase {
  caseData: EnrichedCase;
  score: number;
  reasons: string[];
}

const STORAGE_PREFIX = 'rv_queue_worked_';

const getWorkedKey = (): string => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  return `${STORAGE_PREFIX}${dateStr}`;
};

const getWorkedCases = (): Set<string> => {
  try {
    const raw = localStorage.getItem(getWorkedKey());
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
};

const markCaseWorked = (caseId: string): void => {
  const worked = getWorkedCases();
  worked.add(caseId);
  try {
    localStorage.setItem(getWorkedKey(), JSON.stringify([...worked]));
  } catch { /* ignore */ }
};

const computePriorityScore = (c: EnrichedCase): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // PTP due today/overdue: +40
  if (c.crmStatus === CRMStatus.PTP) {
    const ptpAction = [...(c.history || [])].reverse().find(
      a => a.promisedDate
    );
    if (ptpAction?.promisedDate) {
      const promisedDate = new Date(ptpAction.promisedDate);
      const promisedDay = new Date(promisedDate.getFullYear(), promisedDate.getMonth(), promisedDate.getDate());
      if (promisedDay <= today) {
        score += 40;
        reasons.push(promisedDay.getTime() === today.getTime() ? 'PTP Due Today' : 'PTP Overdue');
      }
    }
  }

  // High balance (>50K AED): +15
  const balance = c.loan?.currentBalance || 0;
  if (balance > 50000) {
    score += 15;
    reasons.push('High Value');
  }

  // No contact in 3+ days: +10
  if (c.lastContactDate) {
    const lastContact = new Date(c.lastContactDate);
    const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceContact >= 3) {
      score += 10;
      reasons.push(`Stale ${daysSinceContact}d`);
    }
  } else {
    score += 10;
    reasons.push('No Contact');
  }

  // New/Re-assigned case: +12
  if (c.crmStatus === CRMStatus.NEW || c.crmStatus === CRMStatus.RTP) {
    score += 12;
    reasons.push('New Case');
  }

  // Contact status = Contact (previously reached): +8
  if (c.contactStatus === 'Contact') {
    score += 8;
    reasons.push('Contacted');
  }

  // DPD calculation from statusCode
  const dpd = parseInt(c.statusCode, 10) || 0;

  // Low DPD (<30): +5
  if (dpd > 0 && dpd < 30) {
    score += 5;
    reasons.push('Fresh DPD');
  }

  // High DPD (>180): +10
  if (dpd > 180) {
    score += 10;
    reasons.push('Urgent DPD');
  }

  // Case has callback scheduled: +15
  if (c.crmStatus === CRMStatus.CB) {
    const cbAction = [...(c.history || [])].reverse().find(a => a.nextFollowUp);
    if (cbAction?.nextFollowUp) {
      const followUpDate = new Date(cbAction.nextFollowUp);
      const followUpDay = new Date(followUpDate.getFullYear(), followUpDate.getMonth(), followUpDate.getDate());
      if (followUpDay <= today) {
        score += 15;
        reasons.push('Callback Due');
      }
    }
  }

  // FIP/Under Nego status: +8
  if (c.crmStatus === CRMStatus.FIP || c.crmStatus === CRMStatus.UNDER_NEGO) {
    score += 8;
    reasons.push('Active Negotiation');
  }

  return { score: Math.min(score, 100), reasons };
};

const WorkQueue: React.FC<WorkQueueProps> = ({ cases, currentUser, onSelectCase }) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [workedSet, setWorkedSet] = useState<Set<string>>(getWorkedCases);

  // Auto-refresh on tab focus
  useEffect(() => {
    const handleFocus = () => {
      setWorkedSet(getWorkedCases());
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Filter officer's cases, exclude Closed/Withdrawn
  const officerCases = useMemo(() => {
    return cases.filter(c =>
      c.assignedOfficerId === currentUser.id &&
      c.crmStatus !== CRMStatus.CLOSED &&
      c.crmStatus !== CRMStatus.WITHDRAWN
    );
  }, [cases, currentUser.id]);

  // Score and sort all officer cases
  const scoredCases = useMemo((): ScoredCase[] => {
    const scored = officerCases.map(c => {
      const { score, reasons } = computePriorityScore(c);
      return { caseData: c, score, reasons };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [officerCases]);

  // Apply quick filter
  const filteredCases = useMemo(() => {
    if (activeFilter === 'all') return scoredCases;

    return scoredCases.filter(({ caseData: c, reasons }) => {
      switch (activeFilter) {
        case 'ptp_due':
          return c.crmStatus === CRMStatus.PTP;
        case 'high_value':
          return (c.loan?.currentBalance || 0) > 50000;
        case 'new_cases':
          return c.crmStatus === CRMStatus.NEW || c.crmStatus === CRMStatus.RTP;
        case 'stale': {
          if (!c.lastContactDate) return true;
          const daysSince = Math.floor(
            (Date.now() - new Date(c.lastContactDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSince >= 3;
        }
        case 'callbacks':
          return c.crmStatus === CRMStatus.CB;
        default:
          return true;
      }
    });
  }, [scoredCases, activeFilter]);

  const workedToday = useMemo(() => {
    return officerCases.filter(c => workedSet.has(c.id)).length;
  }, [officerCases, workedSet]);

  const remaining = officerCases.length - workedToday;

  const handleSelectCase = useCallback((caseId: string) => {
    markCaseWorked(caseId);
    setWorkedSet(prev => new Set([...prev, caseId]));
    onSelectCase(caseId);
  }, [onSelectCase]);

  const handleNextCase = useCallback(() => {
    if (filteredCases.length > 0) {
      handleSelectCase(filteredCases[0].caseData.id);
    }
  }, [filteredCases, handleSelectCase]);

  const getScoreColor = (score: number): string => {
    if (score > 80) return 'var(--color-success)';
    if (score >= 50) return 'var(--color-accent)';
    return 'var(--color-danger)';
  };

  const getScoreBg = (score: number): string => {
    if (score > 80) return 'rgba(34,197,94,0.12)';
    if (score >= 50) return 'rgba(249,115,22,0.12)';
    return 'rgba(239,68,68,0.12)';
  };

  const getDPD = (c: EnrichedCase): number => parseInt(c.statusCode, 10) || 0;

  const getLastActionInfo = (c: EnrichedCase): { date: string; type: string } => {
    if (c.history && c.history.length > 0) {
      const lastAction = c.history[c.history.length - 1];
      const date = new Date(lastAction.timestamp);
      return {
        date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        type: lastAction.type,
      };
    }
    return { date: 'N/A', type: 'None' };
  };

  const filters: { key: FilterType; label: string; count: number }[] = useMemo(() => [
    { key: 'all', label: 'All', count: scoredCases.length },
    { key: 'ptp_due', label: 'PTP Due', count: scoredCases.filter(s => s.caseData.crmStatus === CRMStatus.PTP).length },
    { key: 'high_value', label: 'High Value', count: scoredCases.filter(s => (s.caseData.loan?.currentBalance || 0) > 50000).length },
    { key: 'new_cases', label: 'New Cases', count: scoredCases.filter(s => s.caseData.crmStatus === CRMStatus.NEW || s.caseData.crmStatus === CRMStatus.RTP).length },
    { key: 'stale', label: 'Stale', count: scoredCases.filter(s => {
      if (!s.caseData.lastContactDate) return true;
      return Math.floor((Date.now() - new Date(s.caseData.lastContactDate).getTime()) / 86400000) >= 3;
    }).length },
    { key: 'callbacks', label: 'Callbacks', count: scoredCases.filter(s => s.caseData.crmStatus === CRMStatus.CB).length },
  ], [scoredCases]);

  return (
    <div className="p-4 sm:p-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: 'var(--color-text-primary)' }}>
                Smart Work Queue
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                AI-prioritized cases for maximum recovery
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{officerCases.length}</span> in queue
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{workedToday}</span> worked
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{remaining}</span> remaining
          </div>
          {/* Next Case button */}
          <button
            onClick={handleNextCase}
            disabled={filteredCases.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--color-accent)' }}
          >
            Next Case →
          </button>
        </div>
      </div>

      {/* Mobile stats */}
      <div className="flex sm:hidden items-center gap-2 text-xs mb-4 px-1" style={{ color: 'var(--color-text-secondary)' }}>
        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{officerCases.length}</span> in queue
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{workedToday}</span> worked
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{remaining}</span> remaining
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border"
            style={{
              background: activeFilter === f.key ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
              color: activeFilter === f.key ? '#fff' : 'var(--color-text-secondary)',
              borderColor: activeFilter === f.key ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          >
            {f.label}
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: activeFilter === f.key ? 'rgba(255,255,255,0.2)' : 'var(--color-border)',
                color: activeFilter === f.key ? '#fff' : 'var(--color-text-tertiary)',
              }}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Queue List */}
      {filteredCases.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl border"
          style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mb-3" style={{ color: 'var(--color-text-tertiary)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>No cases match this filter</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Try selecting a different category</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCases.map(({ caseData: c, score, reasons }, index) => {
            const isWorked = workedSet.has(c.id);
            const lastAction = getLastActionInfo(c);
            const dpd = getDPD(c);

            return (
              <div
                key={c.id}
                onClick={() => handleSelectCase(c.id)}
                className="group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                style={{
                  background: isWorked ? 'var(--color-bg-tertiary)' : 'var(--glass-bg)',
                  borderColor: 'var(--color-border)',
                  opacity: isWorked ? 0.65 : 1,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Rank */}
                <div
                  className="hidden sm:flex flex-shrink-0 w-7 h-7 rounded-full items-center justify-center text-[10px] font-extrabold"
                  style={{
                    background: index < 3 ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                    color: index < 3 ? '#fff' : 'var(--color-text-tertiary)',
                  }}
                >
                  {index + 1}
                </div>

                {/* Score Badge */}
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center"
                  style={{ background: getScoreBg(score) }}
                >
                  <span className="text-sm font-extrabold leading-none" style={{ color: getScoreColor(score) }}>
                    {score}
                  </span>
                  <span className="text-[8px] font-bold uppercase" style={{ color: getScoreColor(score) }}>
                    pts
                  </span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {c.debtor?.name || 'Unknown'}
                    </span>
                    {isWorked && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--color-success)', color: '#fff' }}
                      >
                        WORKED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    <span className="font-mono">{c.loan?.accountNumber || 'N/A'}</span>
                    <span>·</span>
                    <span>{c.loan?.bank || 'N/A'}</span>
                  </div>
                  {/* Reason tags */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {reasons.slice(0, 3).map((reason, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          background: 'var(--color-bg-tertiary)',
                          color: 'var(--color-text-accent)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {reason}
                      </span>
                    ))}
                    {reasons.length > 3 && (
                      <span className="text-[9px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        +{reasons.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Balance */}
                <div className="hidden md:block text-right flex-shrink-0" style={{ minWidth: '100px' }}>
                  <div className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(c.loan?.currentBalance, c.loan?.currency)}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Outstanding</div>
                </div>

                {/* Last Action */}
                <div className="hidden lg:block text-right flex-shrink-0" style={{ minWidth: '80px' }}>
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    {lastAction.date}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--color-text-tertiary)', maxWidth: '80px' }}>
                    {lastAction.type}
                  </div>
                </div>

                {/* Status + DPD */}
                <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {c.crmStatus}
                  </span>
                  {dpd > 0 && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: dpd > 180 ? 'rgba(239,68,68,0.1)' : dpd > 90 ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)',
                        color: dpd > 180 ? 'var(--color-danger)' : dpd > 90 ? 'var(--color-accent)' : 'var(--color-success)',
                      }}
                    >
                      {dpd} DPD
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--color-primary)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer summary */}
      {filteredCases.length > 0 && (
        <div
          className="mt-4 flex items-center justify-between px-3 py-2 rounded-lg text-xs"
          style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
        >
          <span>
            Showing <strong style={{ color: 'var(--color-text-secondary)' }}>{filteredCases.length}</strong> of{' '}
            <strong style={{ color: 'var(--color-text-secondary)' }}>{officerCases.length}</strong> cases
          </span>
          <span>
            Total O/S:{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {formatCurrency(
                filteredCases.reduce((sum, s) => sum + (s.caseData.loan?.currentBalance || 0), 0),
                'AED'
              )}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default WorkQueue;
