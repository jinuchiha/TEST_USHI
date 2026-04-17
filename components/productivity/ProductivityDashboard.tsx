import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Role, EnrichedCase, CRMStatus, Action, Case, Debtor, Loan } from '../../types';
import { CASES, DEBTORS, LOANS, USERS, UNASSIGNED_USER } from '../../constants';
import { formatCurrency } from '../../utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  currentUser: User;
}

type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';

interface DailyTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  caseId: string;
  debtorName: string;
  completed: boolean;
  category: 'ptp' | 'callback' | 'new_case' | 'stale' | 'email' | 'follow_up';
}

interface DailyStats {
  casesWorked: number;
  callsMade: number;
  ptpsSet: number;
  amountCollected: number;
}

interface StreakDay {
  date: string;
  label: string;
  met: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTodayKey = (): string => new Date().toISOString().split('T')[0];

const getDayOfWeek = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const daysBetween = (dateA: string, dateB: string): number => {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.floor(Math.abs(a - b) / (1000 * 60 * 60 * 24));
};

const getDateNDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const getWeekDates = (): string[] => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const loadEnrichedCases = (officerId: string): EnrichedCase[] => {
  let cases: Case[] = [];
  try {
    const s = localStorage.getItem('rv_cases');
    cases = s ? JSON.parse(s) : CASES;
  } catch {
    cases = CASES;
  }

  let debtors: Debtor[] = [];
  try {
    const s = localStorage.getItem('rv_debtors');
    debtors = s ? JSON.parse(s) : DEBTORS;
  } catch {
    debtors = DEBTORS;
  }

  let loans: Loan[] = [];
  try {
    const s = localStorage.getItem('rv_loans');
    loans = s ? JSON.parse(s) : LOANS;
  } catch {
    loans = LOANS;
  }

  let users: User[] = [];
  try {
    const s = localStorage.getItem('rv_users');
    users = s ? JSON.parse(s) : USERS;
  } catch {
    users = USERS;
  }

  return cases
    .filter(c => c.assignedOfficerId === officerId)
    .map(c => {
      const debtor = debtors.find(d => d.id === c.debtorId);
      const loan = loans.find(l => l.id === c.loanId);
      if (!debtor || !loan) return null;
      const officer = users.find(u => u.id === c.assignedOfficerId) || UNASSIGNED_USER;
      const sortedHistory = [...c.history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return {
        ...c,
        debtor,
        loan,
        officer,
        history: sortedHistory,
        lastActionDate: sortedHistory.length > 0 ? sortedHistory[0].timestamp : c.creationDate,
      } as EnrichedCase;
    })
    .filter((c): c is EnrichedCase => c !== null);
};

const loadCallbacks = (officerId: string): any[] => {
  try {
    const s = localStorage.getItem('rv_callbacks');
    const all = s ? JSON.parse(s) : [];
    return all.filter((cb: any) => cb.officerId === officerId);
  } catch {
    return [];
  }
};

const loadDailyStats = (date: string, officerId: string): DailyStats => {
  try {
    const s = localStorage.getItem(`rv_daily_stats_${date}_${officerId}`);
    if (s) return JSON.parse(s);
  } catch { /* empty */ }
  return { casesWorked: 0, callsMade: 0, ptpsSet: 0, amountCollected: 0 };
};

const saveDailyStats = (date: string, officerId: string, stats: DailyStats) => {
  try {
    localStorage.setItem(`rv_daily_stats_${date}_${officerId}`, JSON.stringify(stats));
  } catch { /* empty */ }
};

// ─── Task Generation ──────────────────────────────────────────────────────────

const generateDailyTasks = (officerId: string): DailyTask[] => {
  const cases = loadEnrichedCases(officerId);
  const callbacks = loadCallbacks(officerId);
  const today = getTodayKey();
  const tasks: DailyTask[] = [];
  let taskId = 1;

  // 1. PTP cases — promises due today or overdue
  const ptpCases = cases.filter(c =>
    c.crmStatus === CRMStatus.PTP && c.history.some(h => h.promisedDate)
  );
  for (const c of ptpCases.slice(0, 3)) {
    const ptpAction = c.history.find(h => h.promisedDate);
    const promisedDate = ptpAction?.promisedDate?.split('T')[0] || '';
    const isOverdue = promisedDate <= today;
    tasks.push({
      id: `task-${today}-${taskId++}`,
      title: `Follow up with ${c.debtor.name}`,
      description: isOverdue
        ? `PTP of ${formatCurrency(ptpAction?.promisedAmount || 0, c.loan.currency)} was due ${promisedDate} — confirm payment`
        : `PTP of ${formatCurrency(ptpAction?.promisedAmount || 0, c.loan.currency)} due today — confirm payment`,
      priority: isOverdue ? 'Critical' : 'High',
      caseId: c.id,
      debtorName: c.debtor.name,
      completed: false,
      category: 'ptp',
    });
  }

  // 2. Callbacks scheduled
  const todayCallbacks = callbacks.filter((cb: any) => {
    const cbDate = cb.callbackTime?.split('T')[0] || '';
    return cbDate <= today;
  });
  for (const cb of todayCallbacks.slice(0, 2)) {
    tasks.push({
      id: `task-${today}-${taskId++}`,
      title: `Call back ${cb.debtorName}`,
      description: cb.note || 'Scheduled callback — follow up on previous conversation',
      priority: 'High',
      caseId: cb.caseId,
      debtorName: cb.debtorName,
      completed: false,
      category: 'callback',
    });
  }

  // 3. New / Re-assigned cases
  const newCases = cases.filter(c =>
    c.statusCode === 'NEW' || c.statusCode === 'RE-ASSIGN' || c.statusCode === 'FRESHCASE'
  );
  for (const c of newCases.slice(0, 2)) {
    tasks.push({
      id: `task-${today}-${taskId++}`,
      title: `Attempt new case: ${c.debtor.name}`,
      description: `${c.loan.bank} — ${c.loan.product} — O/S ${formatCurrency(c.loan.currentBalance, c.loan.currency)}`,
      priority: 'Medium',
      caseId: c.id,
      debtorName: c.debtor.name,
      completed: false,
      category: 'new_case',
    });
  }

  // 4. Stale cases — no contact for 3+ days (excluding closed/withdrawn)
  const staleCases = cases.filter(c => {
    if (c.crmStatus === CRMStatus.CLOSED || c.crmStatus === CRMStatus.WITHDRAWN || c.crmStatus === CRMStatus.NIP) return false;
    const lastContact = c.lastContactDate?.split('T')[0] || c.creationDate?.split('T')[0] || '';
    return daysBetween(lastContact, today) >= 3;
  });
  for (const c of staleCases.slice(0, 2)) {
    const daysSince = daysBetween(c.lastContactDate?.split('T')[0] || today, today);
    tasks.push({
      id: `task-${today}-${taskId++}`,
      title: `Update stale case: ${c.debtor.name}`,
      description: `No contact for ${daysSince} days — ${c.loan.bank}, status: ${c.crmStatus}`,
      priority: daysSince >= 7 ? 'High' : 'Medium',
      caseId: c.id,
      debtorName: c.debtor.name,
      completed: false,
      category: 'stale',
    });
  }

  // 5. High DPD cases needing email/liability notice
  const highDpdCases = cases.filter(c => {
    if (c.crmStatus === CRMStatus.CLOSED || c.crmStatus === CRMStatus.WITHDRAWN) return false;
    const lpd = c.loan.lpd;
    if (!lpd) return false;
    return daysBetween(lpd, today) >= 90;
  });
  for (const c of highDpdCases.slice(0, 2)) {
    tasks.push({
      id: `task-${today}-${taskId++}`,
      title: `Send liability email for ${c.debtor.name}`,
      description: `High DPD case — ${c.loan.bank}, O/S ${formatCurrency(c.loan.currentBalance, c.loan.currency)}`,
      priority: 'Medium',
      caseId: c.id,
      debtorName: c.debtor.name,
      completed: false,
      category: 'email',
    });
  }

  // 6. General follow-ups from next follow-up dates
  const followUpCases = cases.filter(c => {
    if (c.crmStatus === CRMStatus.CLOSED || c.crmStatus === CRMStatus.WITHDRAWN) return false;
    const lastAction = c.history[0];
    if (!lastAction?.nextFollowUp) return false;
    const fuDate = lastAction.nextFollowUp.split('T')[0];
    return fuDate <= today;
  });
  for (const c of followUpCases.slice(0, 2)) {
    tasks.push({
      id: `task-${today}-${taskId++}`,
      title: `Follow up: ${c.debtor.name}`,
      description: `Scheduled follow-up — ${c.loan.bank}, ${c.crmStatus}`,
      priority: 'Medium',
      caseId: c.id,
      debtorName: c.debtor.name,
      completed: false,
      category: 'follow_up',
    });
  }

  // Deduplicate by caseId, keeping highest priority
  const priorityOrder: Record<TaskPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const seen = new Map<string, DailyTask>();
  for (const t of tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])) {
    if (!seen.has(t.caseId)) {
      seen.set(t.caseId, t);
    }
  }

  const deduped = Array.from(seen.values());

  // Ensure we have at least 8 tasks; pad with general work items
  if (deduped.length < 8) {
    const remainingCases = cases.filter(c =>
      c.crmStatus !== CRMStatus.CLOSED &&
      c.crmStatus !== CRMStatus.WITHDRAWN &&
      c.crmStatus !== CRMStatus.NIP &&
      !seen.has(c.id)
    );
    for (const c of remainingCases.slice(0, 12 - deduped.length)) {
      deduped.push({
        id: `task-${today}-${taskId++}`,
        title: `Work case: ${c.debtor.name}`,
        description: `${c.loan.bank} — ${c.crmStatus} — O/S ${formatCurrency(c.loan.currentBalance, c.loan.currency)}`,
        priority: 'Low',
        caseId: c.id,
        debtorName: c.debtor.name,
        completed: false,
        category: 'follow_up',
      });
    }
  }

  // Sort: Critical > High > Medium > Low
  return deduped
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 12);
};

// ─── Productivity Score Calculation ───────────────────────────────────────────

const calculateProductivityScore = (
  completedTasks: number,
  totalTasks: number,
  stats: DailyStats
): number => {
  const taskScore = totalTasks > 0 ? (completedTasks / totalTasks) * 40 : 0;
  const callScore = Math.min(stats.callsMade / 10, 1) * 20;     // target: 10 calls
  const caseScore = Math.min(stats.casesWorked / 8, 1) * 20;    // target: 8 cases
  const collectScore = Math.min(stats.amountCollected / 5000, 1) * 20; // target: 5000
  return Math.round(taskScore + callScore + caseScore + collectScore);
};

// ─── SVG Icons (inline, no emoji) ─────────────────────────────────────────────

const TaskIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const FireIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
  </svg>
);

const TrendUpIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
  </svg>
);

const TrendDownIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.306-4.306a11.95 11.95 0 015.814 5.518l2.74 1.22m0 0l-5.94 2.281m5.94-2.28l-2.28-5.941" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.073c0 .476-.177.942-.508 1.29a21.17 21.17 0 01-7.742 0 1.816 1.816 0 01-.508-1.29V14.15M12 12.75h.008v.008H12v-.008zM12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M15.002 7.5h.008v.008h-.008V7.5zM8.998 7.5h.008v.008h-.008V7.5zM20.25 10.5V6.75a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25v3.75m16.5 0a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25m16.5 0V10.5" />
  </svg>
);

const CurrencyIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const HandshakeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

// ─── Circular Progress Ring ───────────────────────────────────────────────────

const CircularProgress: React.FC<{ score: number; size?: number }> = ({ score, size = 120 }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#F28C28' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="var(--color-border)" strokeWidth={strokeWidth} fill="none" opacity={0.2}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-text-primary">{score}</span>
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
};

// ─── Priority Badge ───────────────────────────────────────────────────────────

const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const styles: Record<TaskPriority, string> = {
    Critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800',
    High: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800',
    Medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800',
    Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${styles[priority]}`}>
      {priority}
    </span>
  );
};

// ─── Category Icon ────────────────────────────────────────────────────────────

const CategoryLabel: React.FC<{ category: DailyTask['category'] }> = ({ category }) => {
  const labels: Record<string, { text: string; color: string }> = {
    ptp: { text: 'PTP Follow-up', color: 'text-red-500' },
    callback: { text: 'Callback', color: 'text-blue-500' },
    new_case: { text: 'New Case', color: 'text-emerald-500' },
    stale: { text: 'Stale Case', color: 'text-amber-500' },
    email: { text: 'Email Notice', color: 'text-purple-500' },
    follow_up: { text: 'Follow-up', color: 'text-slate-500' },
  };
  const { text, color } = labels[category] || labels.follow_up;
  return <span className={`text-[10px] font-medium ${color}`}>{text}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

const ProductivityDashboard: React.FC<Props> = ({ currentUser }) => {
  const today = getTodayKey();
  const storageKey = `rv_daily_tasks_${today}_${currentUser.id}`;

  // ─── State ────────────────────────────────────────────────────────────────

  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats>({ casesWorked: 0, callsMade: 0, ptpsSet: 0, amountCollected: 0 });
  const [yesterdayStats, setYesterdayStats] = useState<DailyStats>({ casesWorked: 0, callsMade: 0, ptpsSet: 0, amountCollected: 0 });
  const [yesterdayScore, setYesterdayScore] = useState(0);

  // ─── Initialize / Load ────────────────────────────────────────────────────

  useEffect(() => {
    // Load or generate today's tasks
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setTasks(JSON.parse(stored));
      } else {
        const generated = generateDailyTasks(currentUser.id);
        setTasks(generated);
        localStorage.setItem(storageKey, JSON.stringify(generated));
      }
    } catch {
      const generated = generateDailyTasks(currentUser.id);
      setTasks(generated);
    }

    // Derive today's stats from case data
    const cases = loadEnrichedCases(currentUser.id);
    const todayCases = cases.filter(c => {
      const lastAction = c.history[0];
      return lastAction && lastAction.timestamp.split('T')[0] === today;
    });
    const ptps = todayCases.filter(c => c.crmStatus === CRMStatus.PTP);
    const collected = todayCases.reduce((sum, c) => {
      const payments = c.history.filter(h => h.type === 'Payment Received' && h.timestamp.split('T')[0] === today);
      return sum + payments.reduce((s, p) => s + (p.amountPaid || 0), 0);
    }, 0);

    const stats: DailyStats = {
      casesWorked: todayCases.length,
      callsMade: Math.max(todayCases.length, Math.floor(todayCases.length * 1.5)),
      ptpsSet: ptps.length,
      amountCollected: collected,
    };
    setDailyStats(stats);
    saveDailyStats(today, currentUser.id, stats);

    // Load yesterday's stats for comparison
    const yesterday = getDateNDaysAgo(1);
    const yStats = loadDailyStats(yesterday, currentUser.id);
    // Seed reasonable yesterday stats if none exist (demo mode)
    if (yStats.casesWorked === 0 && yStats.callsMade === 0) {
      const seeded: DailyStats = {
        casesWorked: Math.floor(Math.random() * 6) + 3,
        callsMade: Math.floor(Math.random() * 8) + 4,
        ptpsSet: Math.floor(Math.random() * 3) + 1,
        amountCollected: Math.floor(Math.random() * 4000) + 1000,
      };
      setYesterdayStats(seeded);
      saveDailyStats(yesterday, currentUser.id, seeded);
      setYesterdayScore(calculateProductivityScore(
        Math.floor(Math.random() * 6) + 3, 10, seeded
      ));
    } else {
      setYesterdayStats(yStats);
      // Estimate yesterday's task completion from stats
      const yTaskCompletion = Math.min(Math.round(yStats.casesWorked * 1.2), 10);
      setYesterdayScore(calculateProductivityScore(yTaskCompletion, 10, yStats));
    }
  }, [currentUser.id, today, storageKey]);

  // ─── Task Toggle ──────────────────────────────────────────────────────────

  const toggleTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const updated = prev.map(t =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch { /* empty */ }

      // Update daily stats based on completions
      const completedCount = updated.filter(t => t.completed).length;
      setDailyStats(s => {
        const newStats = {
          ...s,
          casesWorked: Math.max(s.casesWorked, completedCount),
          callsMade: Math.max(s.callsMade, completedCount),
        };
        saveDailyStats(today, currentUser.id, newStats);
        return newStats;
      });

      return updated;
    });
  }, [storageKey, today, currentUser.id]);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const completedCount = useMemo(() => tasks.filter(t => t.completed).length, [tasks]);
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const productivityScore = useMemo(
    () => calculateProductivityScore(completedCount, totalCount, dailyStats),
    [completedCount, totalCount, dailyStats]
  );
  const scoreDelta = productivityScore - yesterdayScore;

  // ─── Weekly Streak ────────────────────────────────────────────────────────

  const weekStreak = useMemo((): StreakDay[] => {
    const dates = getWeekDates();
    return dates.map(date => {
      const stats = loadDailyStats(date, currentUser.id);
      // Consider target met if at least 4 cases worked or 50%+ tasks done
      const met = stats.casesWorked >= 4 || (date === today && completedCount >= Math.ceil(totalCount * 0.5));
      return {
        date,
        label: getDayOfWeek(date),
        met: date <= today ? met : false,
      };
    });
  }, [currentUser.id, today, completedCount, totalCount]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    // Count backwards from today
    for (let i = 0; i < 30; i++) {
      const date = getDateNDaysAgo(i);
      const stats = loadDailyStats(date, currentUser.id);
      const met = stats.casesWorked >= 4 || (date === today && completedCount >= Math.ceil(totalCount * 0.5));
      if (met) {
        streak++;
      } else if (i > 0) {
        break; // skip today if not met yet, but break on past days
      }
    }
    return streak;
  }, [currentUser.id, today, completedCount, totalCount]);

  const bestStreak = useMemo(() => {
    try {
      const stored = localStorage.getItem(`rv_best_streak_${currentUser.id}`);
      const prev = stored ? parseInt(stored, 10) : 0;
      if (currentStreak > prev) {
        localStorage.setItem(`rv_best_streak_${currentUser.id}`, String(currentStreak));
        return currentStreak;
      }
      return prev;
    } catch {
      return currentStreak;
    }
  }, [currentStreak, currentUser.id]);

  // ─── Stat Comparison Helper ───────────────────────────────────────────────

  const StatTrend: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
    if (current > previous) {
      return <span className="inline-flex items-center gap-0.5 text-emerald-500"><TrendUpIcon /> <span className="text-[10px]">+{current - previous}</span></span>;
    }
    if (current < previous) {
      return <span className="inline-flex items-center gap-0.5 text-red-400"><TrendDownIcon /> <span className="text-[10px]">{current - previous}</span></span>;
    }
    return <span className="text-[10px] text-text-tertiary">--</span>;
  };

  // ═══ Render ═══════════════════════════════════════════════════════════════

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in-up">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#1B2A4A] text-white">
              <TaskIcon />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary leading-tight">My Tasks</h2>
              <p className="text-xs text-text-tertiary mt-0.5">{formatDate(today)}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-text-secondary italic">
          Stay focused. Every call, every follow-up counts.
        </p>
      </div>

      {/* ─── Quick Stats Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Cases Worked', value: dailyStats.casesWorked, prev: yesterdayStats.casesWorked, icon: <BriefcaseIcon /> },
          { label: 'Calls Made', value: dailyStats.callsMade, prev: yesterdayStats.callsMade, icon: <PhoneIcon /> },
          { label: 'PTPs Set', value: dailyStats.ptpsSet, prev: yesterdayStats.ptpsSet, icon: <HandshakeIcon /> },
          { label: 'Collected', value: dailyStats.amountCollected, prev: yesterdayStats.amountCollected, icon: <CurrencyIcon />, isCurrency: true },
        ].map((stat, i) => (
          <div key={i} className="panel p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-text-tertiary">{stat.icon}</span>
              <StatTrend current={stat.value} previous={stat.prev} />
            </div>
            <span className="text-lg font-bold text-text-primary leading-none">
              {(stat as any).isCurrency ? formatCurrency(stat.value, 'AED') : stat.value}
            </span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* ─── Main Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ─── Daily Task Board (spans 2 cols) ────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="panel">
            {/* Progress Header */}
            <div className="p-4 pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-text-primary">Daily Task Board</h3>
                <span className="text-xs font-medium text-text-secondary">
                  {completedCount}/{totalCount} completed
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progressPercent}%`,
                    background: progressPercent === 100
                      ? '#22c55e'
                      : progressPercent >= 50
                        ? 'linear-gradient(90deg, #F28C28, #f59e0b)'
                        : 'linear-gradient(90deg, #1B2A4A, #334155)',
                  }}
                />
              </div>
              {progressPercent === 100 && (
                <p className="text-[11px] text-emerald-500 font-medium mt-1.5">
                  All tasks completed — outstanding work today!
                </p>
              )}
            </div>

            {/* Task List */}
            <div className="divide-y divide-[var(--color-border)]">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3.5 transition-all duration-200 hover:bg-[var(--color-bg-tertiary)] ${
                    task.completed ? 'opacity-50' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      task.completed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-[var(--color-border)] hover:border-[#F28C28]'
                    }`}
                  >
                    {task.completed && <CheckIcon />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium leading-tight ${
                        task.completed ? 'line-through text-text-tertiary' : 'text-text-primary'
                      }`}>
                        {task.title}
                      </span>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${
                      task.completed ? 'text-text-tertiary' : 'text-text-secondary'
                    }`}>
                      {task.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <CategoryLabel category={task.category} />
                      <span className="text-[10px] text-text-tertiary">
                        Case: {task.caseId}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-sm text-text-tertiary">No tasks generated — no active cases found.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Right Column: Score + Streak ───────────────────────────── */}
        <div className="space-y-4">

          {/* Productivity Score Card */}
          <div className="panel p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4">Productivity Score</h3>
            <div className="flex flex-col items-center gap-3">
              <CircularProgress score={productivityScore} />
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  {scoreDelta > 0 && <span className="text-emerald-500"><TrendUpIcon /></span>}
                  {scoreDelta < 0 && <span className="text-red-400"><TrendDownIcon /></span>}
                  <span className={`text-xs font-medium ${
                    scoreDelta > 0 ? 'text-emerald-500' : scoreDelta < 0 ? 'text-red-400' : 'text-text-tertiary'
                  }`}>
                    {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta < 0 ? `${scoreDelta}` : 'Same as'} vs yesterday
                  </span>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="mt-4 space-y-2">
              {[
                { label: 'Tasks Completed', pct: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0, weight: '40%' },
                { label: 'Calls Made', pct: Math.min(Math.round((dailyStats.callsMade / 10) * 100), 100), weight: '20%' },
                { label: 'Cases Worked', pct: Math.min(Math.round((dailyStats.casesWorked / 8) * 100), 100), weight: '20%' },
                { label: 'Collections', pct: Math.min(Math.round((dailyStats.amountCollected / 5000) * 100), 100), weight: '20%' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-text-secondary">{item.label}</span>
                    <span className="text-[10px] text-text-tertiary">{item.pct}% ({item.weight})</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#1B2A4A] dark:bg-[#F28C28] transition-all duration-500"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Streak Tracker */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-text-primary">Weekly Streak</h3>
              <div className="flex items-center gap-1 text-[#F28C28]">
                <FireIcon />
                <span className="text-xs font-bold">{currentStreak}d</span>
              </div>
            </div>

            {/* Day boxes */}
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {weekStreak.map((day, i) => {
                const isToday = day.date === today;
                const isFuture = day.date > today;
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className={`text-[9px] font-medium uppercase ${
                      isToday ? 'text-[#F28C28]' : 'text-text-tertiary'
                    }`}>
                      {day.label}
                    </span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                      isFuture
                        ? 'bg-[var(--color-bg-tertiary)] text-text-tertiary'
                        : day.met
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : isToday
                            ? 'bg-[#F28C28]/20 text-[#F28C28] ring-2 ring-[#F28C28]/40'
                            : 'bg-red-100 text-red-400 dark:bg-red-900/20'
                    }`}>
                      {isFuture ? '' : day.met ? (
                        <CheckIcon />
                      ) : isToday ? (
                        <span className="text-[10px]">...</span>
                      ) : (
                        <span className="text-[10px]">X</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Streak Stats */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-text-primary">{currentStreak}</p>
                <p className="text-[10px] text-text-tertiary uppercase">Current</p>
              </div>
              <div className="w-px h-8 bg-[var(--color-border)]" />
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-[#F28C28]">{bestStreak}</p>
                <p className="text-[10px] text-text-tertiary uppercase">Best</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductivityDashboard;
