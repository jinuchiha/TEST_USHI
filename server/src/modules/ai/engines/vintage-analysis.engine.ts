/**
 * Vintage/Cohort Analysis
 *
 * Track recovery performance by allocation month.
 * Shows which cohorts perform best and strategy effectiveness over time.
 */

export interface VintageCohort {
  allocationMonth: string;
  totalCases: number;
  totalBalance: number;
  recoveredAmount: number;
  recoveryRate: number;
  closedCases: number;
  avgDaysToFirstPayment: number;
  activeRemaining: number;
}

export function buildVintageAnalysis(cases: Array<{
  creationDate: string;
  crmStatus: string;
  balance: number;
  originalAmount: number;
  totalPayments: number;
  firstPaymentDate: string | null;
}>): VintageCohort[] {
  const cohorts = new Map<string, {
    cases: number;
    balance: number;
    original: number;
    recovered: number;
    closed: number;
    active: number;
    daysToFirst: number[];
  }>();

  for (const c of cases) {
    const month = c.creationDate.slice(0, 7); // YYYY-MM
    const d = cohorts.get(month) || { cases: 0, balance: 0, original: 0, recovered: 0, closed: 0, active: 0, daysToFirst: [] };
    d.cases++;
    d.balance += c.balance;
    d.original += c.originalAmount;
    d.recovered += c.totalPayments;
    if (c.crmStatus === 'Closed') d.closed++;
    else if (!['Withdrawn', 'NIP'].includes(c.crmStatus)) d.active++;

    if (c.firstPaymentDate) {
      const days = Math.round((new Date(c.firstPaymentDate).getTime() - new Date(c.creationDate).getTime()) / 86400000);
      if (days > 0) d.daysToFirst.push(days);
    }

    cohorts.set(month, d);
  }

  return Array.from(cohorts.entries()).map(([month, d]) => ({
    allocationMonth: month,
    totalCases: d.cases,
    totalBalance: Math.round(d.balance),
    recoveredAmount: Math.round(d.recovered),
    recoveryRate: d.original > 0 ? Math.round((d.recovered / d.original) * 100) : 0,
    closedCases: d.closed,
    avgDaysToFirstPayment: d.daysToFirst.length > 0 ? Math.round(d.daysToFirst.reduce((a, b) => a + b, 0) / d.daysToFirst.length) : 0,
    activeRemaining: d.active,
  })).sort((a, b) => b.allocationMonth.localeCompare(a.allocationMonth));
}
