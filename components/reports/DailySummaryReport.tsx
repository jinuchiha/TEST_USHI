import React, { useMemo, useState } from 'react';
import { EnrichedCase, User, ActionType, SubStatus, CRMStatus } from '../../types';
import { formatCurrency, convertToAED } from '../../utils';
import Card from '../shared/Card';
import { ICONS } from '../../constants';
import KpiCard from '../shared/KpiCard';
import Avatar from '../shared/Avatar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from 'recharts';


interface TeamPerformanceReportProps {
  cases: EnrichedCase[];
  coordinators: User[];
  date: string;
  setDate: (date: string) => void;
  onSelectOfficer?: (officerId: string) => void;
  onBack?: () => void;
  getDailySummaryAI?: (notes: string) => Promise<string>;
  onSelectCase: (caseId: string) => void;
}

// ─── Brand Constants ────────────────────────────────────────────────────────────
const NAVY = 'var(--color-primary)';
const ORANGE = 'var(--color-accent)';
const CHART_COLORS = [NAVY, ORANGE, '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#f97316', '#84cc16', '#d946ef'];
const CONTACT_COLORS = { contact: '#14b8a6', nonContact: '#ef4444' };

// ─── Productivity Targets (configurable) ────────────────────────────────────────
const DAILY_CASE_TARGET = 30;
const DAILY_COLLECTION_TARGET_AED = 5000;

// ─── Shared Table Classes ───────────────────────────────────────────────────────
const TH_CLASS = "px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider bg-surface-muted";
const TD_CLASS = "px-4 py-3 whitespace-nowrap text-sm text-text-primary";

// ─── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomActivityTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface/95 backdrop-blur-sm p-3 border border-border rounded-lg shadow-xl">
        <p className="text-sm text-text-primary font-semibold">{payload[0].payload.status || payload[0].payload.name}</p>
        <p className="text-xs text-text-secondary mt-1">Cases: <span className="font-bold text-text-primary">{payload[0].value}</span></p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface/95 backdrop-blur-sm p-3 border border-border rounded-lg shadow-xl">
        <p className="text-sm font-semibold text-text-primary">{payload[0].name}</p>
        <p className="text-xs text-text-secondary mt-1">Cases: <span className="font-bold">{payload[0].value}</span></p>
      </div>
    );
  }
  return null;
};

// ─── Helper: Format time from ISO string ────────────────────────────────────────
const formatTime = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return '--:--'; }
};

const getHourBucket = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    const h = d.getHours();
    if (h < 10) return 'Before 10 AM';
    if (h < 12) return '10 AM - 12 PM';
    if (h < 14) return '12 PM - 2 PM';
    if (h < 16) return '2 PM - 4 PM';
    if (h < 18) return '4 PM - 6 PM';
    return 'After 6 PM';
  } catch { return 'Unknown'; }
};

const HOUR_BUCKET_ORDER = ['Before 10 AM', '10 AM - 12 PM', '12 PM - 2 PM', '2 PM - 4 PM', '4 PM - 6 PM', 'After 6 PM'];

// ─── Productivity Score Calculator ──────────────────────────────────────────────
interface ProductivityBreakdown {
  casesWorked: number;
  caseTarget: number;
  casesScore: number;
  contactRate: number;
  contactRateScore: number;
  collected: number;
  collectionTarget: number;
  collectionScore: number;
  ptpAccuracy: number;
  ptpAccuracyScore: number;
  totalScore: number;
}

function computeProductivityScore(
  casesWorked: number,
  contactCount: number,
  nonContactCount: number,
  collected: number,
  ptpsCreated: number,
  ptpsConverted: number,
  caseTarget: number,
  collectionTarget: number,
): ProductivityBreakdown {
  const totalAttempts = contactCount + nonContactCount;
  const contactRate = totalAttempts > 0 ? (contactCount / totalAttempts) * 100 : 0;
  const ptpAccuracy = ptpsCreated > 0 ? (ptpsConverted / ptpsCreated) * 100 : (ptpsCreated === 0 ? 50 : 0);

  // Scores, capped at 100
  const casesScore = Math.min((casesWorked / Math.max(caseTarget, 1)) * 100, 100);
  const contactRateScore = Math.min(contactRate, 100);
  const collectionScore = Math.min((collected / Math.max(collectionTarget, 1)) * 100, 100);
  const ptpAccuracyScore = Math.min(ptpAccuracy, 100);

  // Weighted total
  const totalScore = Math.round(
    casesScore * 0.30 +
    contactRateScore * 0.25 +
    collectionScore * 0.25 +
    ptpAccuracyScore * 0.20
  );

  return {
    casesWorked, caseTarget, casesScore,
    contactRate, contactRateScore,
    collected, collectionTarget, collectionScore,
    ptpAccuracy, ptpAccuracyScore,
    totalScore: Math.min(totalScore, 100),
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Strong';
  if (score >= 65) return 'On Track';
  if (score >= 50) return 'Needs Improvement';
  if (score >= 30) return 'Below Expectations';
  return 'Critical';
}

// ─── AI Analysis Generator (local, no external API) ─────────────────────────────
interface AIAnalysis {
  summary: string;
  collectionAlert: { type: 'success' | 'warning'; message: string };
  contactRateInsight: string;
  ptpFollowUps: number;
  staleCasesCount: number;
  withdrawalRiskCases: { id: string; debtorName: string; account: string; reason: string }[];
  priorityCases: { id: string; debtorName: string; account: string; reason: string }[];
}

function generateAIAnalysis(
  casesWorked: number,
  callsMade: number,
  ptpsSet: number,
  ptpTotalAmount: number,
  collected: number,
  contactRate: number,
  ptpFollowUps: number,
  staleCases: EnrichedCase[],
  withdrawalRiskCases: EnrichedCase[],
  priorityCases: EnrichedCase[],
  allDailyActions: any[],
): AIAnalysis {
  // Summary line
  const summary = `Today you worked ${casesWorked} case${casesWorked !== 1 ? 's' : ''}, made ${callsMade} call${callsMade !== 1 ? 's' : ''}, and set ${ptpsSet} PTP${ptpsSet !== 1 ? 's' : ''}${ptpsSet > 0 ? ` worth ${formatCurrency(ptpTotalAmount, 'AED')}` : ''}.`;

  // Collection alert
  const collectionAlert = collected > 0
    ? { type: 'success' as const, message: `You collected ${formatCurrency(collected, 'AED')} today.` }
    : { type: 'warning' as const, message: 'No payments were collected today.' };

  // Contact rate insight
  const avgBenchmark = 40; // industry average contact rate
  const contactRateInsight = contactRate > 0
    ? `Your contact rate was ${contactRate.toFixed(1)}% -- ${contactRate >= avgBenchmark ? 'above' : 'below'} the ${avgBenchmark}% benchmark.`
    : 'No contact attempts were recorded today.';

  // Withdrawal risk
  const withdrawalRisk = withdrawalRiskCases.slice(0, 5).map(c => ({
    id: c.id,
    debtorName: c.debtor.name,
    account: c.loan.accountNumber,
    reason: c.crmStatus === CRMStatus.WDS ? 'Marked for withdrawal' :
            c.crmStatus === CRMStatus.EXPIRE ? 'Case expired' :
            'No contact in 7+ days with high balance',
  }));

  // Priority cases for tomorrow
  const priority = priorityCases.slice(0, 3).map(c => {
    let reason = 'High balance, follow-up needed';
    if (c.crmStatus === CRMStatus.PTP) reason = 'PTP due -- confirm payment receipt';
    else if (c.crmStatus === CRMStatus.UNDER_NEGO) reason = 'Active negotiation -- maintain momentum';
    else if (c.crmStatus === CRMStatus.CB) reason = 'Callback scheduled -- do not miss';
    return { id: c.id, debtorName: c.debtor.name, account: c.loan.accountNumber, reason };
  });

  return {
    summary,
    collectionAlert,
    contactRateInsight,
    ptpFollowUps,
    staleCasesCount: staleCases.length,
    withdrawalRiskCases: withdrawalRisk,
    priorityCases: priority,
  };
}

// ─── Productivity Score Card ────────────────────────────────────────────────────
const ProductivityScoreCard: React.FC<{ breakdown: ProductivityBreakdown }> = ({ breakdown }) => {
  const scoreColor = getScoreColor(breakdown.totalScore);
  const scoreBg = getScoreBg(breakdown.totalScore);
  const scoreLabel = getScoreLabel(breakdown.totalScore);

  const metrics = [
    { label: 'Cases Worked', score: breakdown.casesScore, detail: `${breakdown.casesWorked} / ${breakdown.caseTarget}`, weight: '30%' },
    { label: 'Contact Rate', score: breakdown.contactRateScore, detail: `${breakdown.contactRate.toFixed(1)}%`, weight: '25%' },
    { label: 'Collections', score: breakdown.collectionScore, detail: `${formatCurrency(breakdown.collected, 'AED')} / ${formatCurrency(breakdown.collectionTarget, 'AED')}`, weight: '25%' },
    { label: 'PTP Accuracy', score: breakdown.ptpAccuracyScore, detail: `${breakdown.ptpAccuracy.toFixed(0)}%`, weight: '20%' },
  ];

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          {ICONS.performance('w-6 h-6 text-text-secondary')}
          <h3 className="text-lg font-bold text-text-primary">Productivity Score</h3>
        </div>
        <div className="text-right">
          <span className={`text-4xl font-black ${scoreColor}`}>{breakdown.totalScore}</span>
          <span className="text-lg text-text-secondary font-medium">/100</span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className={`w-3 h-3 rounded-full ${scoreBg}`} />
          <span className={`text-sm font-semibold ${scoreColor}`}>{scoreLabel}</span>
        </div>
        <div className="space-y-4">
          {metrics.map(m => (
            <div key={m.label}>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-medium text-text-secondary">{m.label} <span className="text-text-secondary/60">({m.weight})</span></span>
                <span className="font-bold text-text-primary">{m.detail}</span>
              </div>
              <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${m.score >= 80 ? 'bg-emerald-500' : m.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(m.score, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

// ─── AI Analysis Panel ──────────────────────────────────────────────────────────
const AIAnalysisPanel: React.FC<{ analysis: AIAnalysis; onSelectCase: (id: string) => void }> = ({ analysis, onSelectCase }) => (
  <div className="panel !p-0 overflow-hidden border-l-4" style={{ borderLeftColor: 'var(--color-primary)' }}>
    <div className="px-5 py-4 border-b border-border" style={{ background: 'linear-gradient(135deg, var(--color-primary-glow), var(--color-accent-glow))' }}>
      <div className="flex items-center gap-3">
        {ICONS.lightbulb('w-6 h-6 text-amber-500')}
        <div>
          <h3 className="text-lg font-bold text-text-primary">AI Daily Analysis</h3>
          <p className="text-xs text-text-secondary">Automated assessment based on today's case data</p>
        </div>
      </div>
    </div>
    <div className="p-5 space-y-4">
      {/* Summary */}
      <p className="text-sm text-text-primary leading-relaxed">{analysis.summary}</p>

      {/* Collection Alert */}
      <div className={`flex items-start gap-3 p-3 rounded-lg ${analysis.collectionAlert.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
        {analysis.collectionAlert.type === 'success'
          ? ICONS.success('w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5')
          : ICONS.danger('w-5 h-5 text-red-500 flex-shrink-0 mt-0.5')
        }
        <p className={`text-sm font-semibold ${analysis.collectionAlert.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {analysis.collectionAlert.message}
        </p>
      </div>

      {/* Contact Rate */}
      <p className="text-sm text-text-secondary">{analysis.contactRateInsight}</p>

      {/* PTP Follow-ups & Stale Cases */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-muted p-3 rounded-lg">
          <p className="text-xs font-medium text-text-secondary">PTP Follow-ups Pending</p>
          <p className={`text-2xl font-bold mt-1 ${analysis.ptpFollowUps > 0 ? 'text-amber-500' : 'text-text-primary'}`}>{analysis.ptpFollowUps}</p>
          <p className="text-xs text-text-secondary mt-0.5">cases need attention tomorrow</p>
        </div>
        <div className="bg-surface-muted p-3 rounded-lg">
          <p className="text-xs font-medium text-text-secondary">Stale Cases Alert</p>
          <p className={`text-2xl font-bold mt-1 ${analysis.staleCasesCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{analysis.staleCasesCount}</p>
          <p className="text-xs text-text-secondary mt-0.5">cases with no contact in 3+ days</p>
        </div>
      </div>

      {/* Withdrawal Risk */}
      {analysis.withdrawalRiskCases.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
            {ICONS.danger('w-4 h-4 text-red-500')}
            Withdrawal Risk Assessment
          </h4>
          <div className="space-y-1.5">
            {analysis.withdrawalRiskCases.map(c => (
              <div key={c.id} onClick={() => onSelectCase(c.id)} className="flex items-center justify-between p-2 bg-red-500/5 border border-red-500/10 rounded-md cursor-pointer hover:bg-red-500/10 transition-colors">
                <div>
                  <span className="text-sm font-medium text-text-primary">{c.debtorName}</span>
                  <span className="text-xs text-text-secondary ml-2">({c.account})</span>
                </div>
                <span className="text-xs text-red-500 font-medium">{c.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Cases */}
      {analysis.priorityCases.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
            {ICONS.bolt('w-4 h-4 text-amber-500')}
            Top Priority Cases for Tomorrow
          </h4>
          <div className="space-y-1.5">
            {analysis.priorityCases.map((c, i) => (
              <div key={c.id} onClick={() => onSelectCase(c.id)} className="flex items-start gap-3 p-2 bg-surface-muted rounded-md cursor-pointer hover:bg-surface-muted/80 transition-colors">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <span className="text-sm font-medium text-text-primary">{c.debtorName}</span>
                  <span className="text-xs text-text-secondary ml-2">({c.account})</span>
                  <p className="text-xs text-text-secondary mt-0.5">{c.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

// ─── Officer Card (team view) ───────────────────────────────────────────────────
const OfficerPerformanceSnapshot: React.FC<{ data: any; onSelect?: () => void }> = ({ data, onSelect }) => {
  const dailyTargetProgress = data.target > 0 ? (data.dailyPaid / (data.target / 22)) * 100 : 0;
  const monthlyTargetProgress = data.target > 0 ? (data.monthlyPaid / data.target) * 100 : 0;

  return (
    <Card className="!p-0 overflow-hidden flex flex-col" isHoverable onClick={onSelect}>
      <div className="p-4 flex items-center gap-4 border-b border-border">
        <Avatar name={data.name} />
        <div className="flex-grow">
          <h4 className="font-bold text-lg text-text-primary">{data.name}</h4>
          <p className="text-xs text-text-secondary">Performance Snapshot</p>
        </div>
        {onSelect && (
          <span className="text-xs font-medium text-primary hover:underline cursor-pointer">View Report</span>
        )}
      </div>
      <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="bg-surface-muted p-2 rounded-lg">
          <p className="text-xs font-medium text-text-secondary">Cases Worked</p>
          <p className="text-2xl font-bold text-primary">{data.dailyDOE}</p>
        </div>
        <div className="bg-surface-muted p-2 rounded-lg">
          <p className="text-xs font-medium text-text-secondary">Calls Made</p>
          <p className="text-2xl font-bold text-sky-500">{data.dailyCalls}</p>
        </div>
        <div className="bg-surface-muted p-2 rounded-lg">
          <p className="text-xs font-medium text-text-secondary">PTPs Set</p>
          <p className="text-2xl font-bold text-warning">{data.dailyPTPsCreated}</p>
        </div>
        <div className="bg-surface-muted p-2 rounded-lg">
          <p className="text-xs font-medium text-text-secondary">Collected</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(data.dailyPaid, 'AED')}</p>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-text-secondary">Daily Target</span>
            <span className="font-bold text-text-primary">{formatCurrency(data.target / 22, 'AED')}</span>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.min(dailyTargetProgress, 100)}%` }} /></div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-text-secondary">Monthly Target (MTD)</span>
            <span className="font-bold text-text-primary">{formatCurrency(data.target, 'AED')}</span>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-2"><div className="bg-success h-2 rounded-full transition-all" style={{ width: `${Math.min(monthlyTargetProgress, 100)}%` }} /></div>
        </div>
      </div>
    </Card>
  );
};

// ─── Filtered Cases View (drill-down) ───────────────────────────────────────────
const FilteredCasesView: React.FC<{
  status: string;
  cases: EnrichedCase[];
  onBack: () => void;
  onSelectCase: (caseId: string) => void;
}> = ({ status, cases, onBack, onSelectCase }) => (
  <Card className="p-4">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xl font-semibold text-text-primary">
        Cases moved to "<span className="text-primary">{status}</span>"
      </h3>
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {ICONS.arrow('w-4 h-4')} Back to Report
      </button>
    </div>
    <div className="overflow-auto border-t border-border">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr>
            <th className={TH_CLASS}>Debtor</th>
            <th className={TH_CLASS}>Account</th>
            <th className={TH_CLASS}>Bank</th>
            <th className={TH_CLASS}>O/S Balance</th>
            <th className={TH_CLASS}>Coordinator</th>
          </tr>
        </thead>
        <tbody className="bg-surface divide-y divide-border">
          {cases.map(c => (
            <tr key={c.id} onClick={() => onSelectCase(c.id)} className="hover:bg-surface-muted cursor-pointer transition-colors">
              <td className={TD_CLASS}>{c.debtor.name}</td>
              <td className={TD_CLASS}>{c.loan.accountNumber}</td>
              <td className={TD_CLASS}>{c.loan.bank}</td>
              <td className={`${TD_CLASS} font-semibold text-red-500`}>{formatCurrency(c.loan.currentBalance, c.loan.currency)}</td>
              <td className={TD_CLASS}>{c.officer.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cases.length === 0 && <p className="text-center p-8 text-text-secondary">No cases found for this status on the selected date.</p>}
    </div>
  </Card>
);


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TeamPerformanceReport: React.FC<TeamPerformanceReportProps> = ({
  cases, coordinators, date, setDate, onSelectOfficer, onBack, getDailySummaryAI, onSelectCase
}) => {
  const [selectedCrmStatus, setSelectedCrmStatus] = useState<string | null>(null);
  const [selectedOfficerFilter, setSelectedOfficerFilter] = useState<string>('all');
  const [casesTableExpanded, setCasesTableExpanded] = useState(false);

  const isTeamView = coordinators.length > 1;

  // Determine the active coordinators (all, or filtered by officer selector)
  const activeCoordinators = useMemo(() => {
    if (!isTeamView || selectedOfficerFilter === 'all') return coordinators;
    return coordinators.filter(c => c.id === selectedOfficerFilter);
  }, [coordinators, isTeamView, selectedOfficerFilter]);

  // ─── Core Data Computation ──────────────────────────────────────────────────
  const computedData = useMemo(() => {
    const relevantCaseIds = new Set(activeCoordinators.map(c => c.id));
    const relevantCases = cases.filter(c => relevantCaseIds.has(c.assignedOfficerId));

    // Daily actions
    const dailyActions = relevantCases.flatMap(c =>
      c.history
        .filter(h => (h.attributionDate || h.timestamp).startsWith(date))
        .map(h => ({ ...h, caseData: c }))
    );

    const allDailyNotes = dailyActions.map(a => a.notes).join('\n');

    // Monthly actions
    const firstDayOfMonth = new Date(new Date(date).getFullYear(), new Date(date).getMonth(), 1);
    const monthlyActions = relevantCases.flatMap(c =>
      c.history
        .filter(h => new Date(h.attributionDate || h.timestamp) >= firstDayOfMonth)
        .map(h => ({ ...h, caseData: c }))
    );

    // ── Team Totals ──
    const casesWorkedSet = new Set(dailyActions.map(a => a.caseId));
    const dailyPaid = dailyActions
      .filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid)
      .reduce((sum, a) => sum + convertToAED(a.amountPaid!, a.caseData.loan.currency), 0);
    const dailyCalls = dailyActions.filter(a => a.type === ActionType.SOFT_CALL).length;
    const dailyEmails = dailyActions.filter(a => a.type === ActionType.EMAIL_NOTICE).length;
    const casesWorkedCount = casesWorkedSet.size;

    // ── PTPs ──
    const todaysPTPs = new Set<string>();
    const ptpTotalAmount = { value: 0 };
    relevantCases.forEach(c => {
      c.auditLog.forEach(log => {
        if (log.details.includes("Status changed to PTP") && log.timestamp.startsWith(date)) {
          todaysPTPs.add(c.id);
        }
      });
    });
    // Also count from actions with promised amounts
    dailyActions.forEach(a => {
      if (a.promisedAmount) ptpTotalAmount.value += convertToAED(a.promisedAmount, a.caseData.loan.currency);
    });
    const dailyPTPsCreated = todaysPTPs.size;

    // ── Contact vs Non-Contact ──
    let contactCount = 0;
    let nonContactCount = 0;
    const caseContactMap = new Map<string, boolean>();
    dailyActions.forEach(a => {
      if (!caseContactMap.has(a.caseId)) {
        const isContact = a.caseData.contactStatus === 'Contact';
        caseContactMap.set(a.caseId, isContact);
        if (isContact) contactCount++; else nonContactCount++;
      }
    });

    // ── PTP Conversions (PTPs from past that resulted in payment) ──
    let ptpsConverted = 0;
    relevantCases.forEach(c => {
      const hadPTP = c.auditLog.some(log => log.details.includes("Status changed to PTP"));
      const hadPayment = c.history.some(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && h.amountPaid > 0);
      if (hadPTP && hadPayment) ptpsConverted++;
    });

    // ── PTP Follow-ups Pending ──
    const ptpFollowUps = relevantCases.filter(c =>
      c.crmStatus === CRMStatus.PTP &&
      c.history.some(h => h.nextFollowUp && new Date(h.nextFollowUp) <= new Date(date + 'T23:59:59'))
    ).length;

    // ── Stale Cases (no contact in 3+ days) ──
    const threeDaysAgo = new Date(date);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const staleCases = relevantCases.filter(c => {
      if (c.crmStatus === CRMStatus.CLOSED || c.crmStatus === CRMStatus.WITHDRAWN) return false;
      const lastContact = c.lastContactDate ? new Date(c.lastContactDate) : null;
      return !lastContact || lastContact < threeDaysAgo;
    });

    // ── Withdrawal Risk ──
    const withdrawalRiskCases = relevantCases.filter(c =>
      c.crmStatus === CRMStatus.WDS ||
      c.crmStatus === CRMStatus.EXPIRE ||
      (c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN && (() => {
        const lastContact = c.lastContactDate ? new Date(c.lastContactDate) : null;
        const sevenDaysAgo = new Date(date);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return (!lastContact || lastContact < sevenDaysAgo) && c.loan.currentBalance > 10000;
      })())
    );

    // ── Priority Cases for Tomorrow ──
    const priorityCases = relevantCases
      .filter(c =>
        c.crmStatus !== CRMStatus.CLOSED &&
        c.crmStatus !== CRMStatus.WITHDRAWN &&
        c.crmStatus !== CRMStatus.NIP
      )
      .sort((a, b) => {
        // PTP first, then UNDER_NEGO, then CB, then by balance
        const statusPriority: Record<string, number> = {
          [CRMStatus.PTP]: 1,
          [CRMStatus.UNDER_NEGO]: 2,
          [CRMStatus.CB]: 3,
        };
        const pa = statusPriority[a.crmStatus] || 10;
        const pb = statusPriority[b.crmStatus] || 10;
        if (pa !== pb) return pa - pb;
        return convertToAED(b.loan.currentBalance, b.loan.currency) - convertToAED(a.loan.currentBalance, a.loan.currency);
      });

    // ── Officer Snapshots (for team view) ──
    const snapshots = coordinators.map(coordinator => {
      const officerDailyActions = dailyActions.filter(a => a.officerId === coordinator.id);
      const officerDailyPaid = officerDailyActions
        .filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid)
        .reduce((s, a) => s + convertToAED(a.amountPaid!, a.caseData.loan.currency), 0);
      const officerDailyDOE = new Set(officerDailyActions.map(a => a.caseId)).size;
      const officerDailyCalls = officerDailyActions.filter(a => a.type === ActionType.SOFT_CALL).length;

      const officerPTPs = new Set<string>();
      relevantCases.forEach(c => {
        c.auditLog.forEach(log => {
          if (log.details.includes("Status changed to PTP") && log.timestamp.startsWith(date) && log.userId === coordinator.id) {
            officerPTPs.add(c.id);
          }
        });
      });

      const monthlyPaid = monthlyActions
        .filter(a => a.officerId === coordinator.id && a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid)
        .reduce((sum, a) => sum + convertToAED(a.amountPaid!, a.caseData.loan.currency), 0);

      return {
        id: coordinator.id,
        name: coordinator.name,
        monthlyPaid,
        target: coordinator.target || 0,
        dailyPaid: officerDailyPaid,
        dailyDOE: officerDailyDOE,
        dailyCalls: officerDailyCalls,
        dailyPTPsCreated: officerPTPs.size,
        contribution: dailyPaid > 0 ? (officerDailyPaid / dailyPaid) * 100 : 0,
      };
    }).sort((a, b) => b.dailyPaid - a.dailyPaid);

    // ── Status Breakdowns ──
    const caseStatusesAfterWork: Record<string, { crmStatus: CRMStatus; subStatus: SubStatus }> = {};
    dailyActions.forEach(action => {
      caseStatusesAfterWork[action.caseId] = {
        crmStatus: action.caseData.crmStatus,
        subStatus: action.caseData.subStatus,
      };
    });
    const finalStatuses = Object.values(caseStatusesAfterWork);

    const crmStatusCounts = finalStatuses.reduce((acc, { crmStatus }) => {
      acc[crmStatus] = (acc[crmStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const subStatusCounts = finalStatuses.reduce((acc, { subStatus }) => {
      acc[subStatus] = (acc[subStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const crmStatusBreakdown = Object.entries(crmStatusCounts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
    const subStatusBreakdown = Object.entries(subStatusCounts).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

    // ── Activity Timeline (hour-by-hour) ──
    const hourBucketCounts: Record<string, number> = {};
    dailyActions.forEach(a => {
      const bucket = getHourBucket(a.timestamp);
      hourBucketCounts[bucket] = (hourBucketCounts[bucket] || 0) + 1;
    });
    const activityTimeline = HOUR_BUCKET_ORDER
      .map(bucket => ({ name: bucket, count: hourBucketCounts[bucket] || 0 }))
      .filter(b => b.count > 0 || dailyActions.length > 0);

    // ── Contact vs Non-Contact Pie ──
    const contactPieData = [
      { name: 'Contact', value: contactCount },
      { name: 'Non-Contact', value: nonContactCount },
    ].filter(d => d.value > 0);

    // ── Payments Breakdown ──
    const payments = dailyActions
      .filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid)
      .map(a => ({
        caseId: a.caseId,
        debtor: a.caseData.debtor.name,
        account: a.caseData.loan.accountNumber,
        bank: a.caseData.loan.bank,
        amount: a.amountPaid!,
        currency: a.caseData.loan.currency,
        amountAED: convertToAED(a.amountPaid!, a.caseData.loan.currency),
        type: a.paymentType || 'Payment',
        method: a.confirmationMethod || '--',
        time: formatTime(a.timestamp),
      }));

    // ── Cases Worked Detail ──
    const casesWorkedDetail: {
      caseId: string; debtor: string; account: string; bank: string;
      fromStatus: string; toStatus: string; actionType: string; notes: string; time: string;
    }[] = [];

    const caseActionMap = new Map<string, typeof dailyActions>();
    dailyActions.forEach(a => {
      if (!caseActionMap.has(a.caseId)) caseActionMap.set(a.caseId, []);
      caseActionMap.get(a.caseId)!.push(a);
    });

    caseActionMap.forEach((actions, caseId) => {
      const sorted = [...actions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const lastAction = sorted[sorted.length - 1];
      const firstAction = sorted[0];

      // Try to find status transitions from audit log
      const caseObj = lastAction.caseData;
      const relevantAuditLogs = caseObj.auditLog.filter(l => l.timestamp.startsWith(date));
      const statusChangeLog = relevantAuditLogs.find(l => l.details.includes('Status changed'));
      let fromStatus = caseObj.crmStatus;
      let toStatus = caseObj.crmStatus;
      if (statusChangeLog) {
        const match = statusChangeLog.details.match(/from (\S+) to (\S+)/);
        if (match) {
          fromStatus = match[1] as CRMStatus;
          toStatus = match[2] as CRMStatus;
        }
      }

      casesWorkedDetail.push({
        caseId,
        debtor: caseObj.debtor.name,
        account: caseObj.loan.accountNumber,
        bank: caseObj.loan.bank,
        fromStatus: String(fromStatus),
        toStatus: String(toStatus),
        actionType: sorted.map(a => a.type).filter((v, i, arr) => arr.indexOf(v) === i).join(', '),
        notes: lastAction.notes ? (lastAction.notes.length > 80 ? lastAction.notes.substring(0, 80) + '...' : lastAction.notes) : '--',
        time: formatTime(lastAction.timestamp),
      });
    });

    // ── Productivity Score ──
    const caseTarget = activeCoordinators.reduce((sum, c) => sum + (c.dailyTarget || DAILY_CASE_TARGET), 0);
    const collectionTarget = activeCoordinators.reduce((sum, c) => sum + ((c.target || 0) / 22 || DAILY_COLLECTION_TARGET_AED), 0);

    const productivityScore = computeProductivityScore(
      casesWorkedCount,
      contactCount,
      nonContactCount,
      dailyPaid,
      dailyPTPsCreated,
      ptpsConverted,
      caseTarget,
      collectionTarget,
    );

    // ── AI Analysis ──
    const contactRateTotal = (contactCount + nonContactCount) > 0
      ? (contactCount / (contactCount + nonContactCount)) * 100 : 0;

    const aiAnalysis = generateAIAnalysis(
      casesWorkedCount,
      dailyCalls,
      dailyPTPsCreated,
      ptpTotalAmount.value,
      dailyPaid,
      contactRateTotal,
      ptpFollowUps,
      staleCases,
      withdrawalRiskCases,
      priorityCases,
      dailyActions,
    );

    // ── Recovery Strategy: Top 5 high-value cases by balance * recovery probability ──
    const recoveryCases = relevantCases
      .filter(c =>
        c.crmStatus !== CRMStatus.CLOSED &&
        c.crmStatus !== CRMStatus.WITHDRAWN &&
        c.crmStatus !== CRMStatus.NIP &&
        c.loan.currentBalance > 0
      )
      .map(c => {
        const balanceAED = convertToAED(c.loan.currentBalance, c.loan.currency);
        // Estimate recovery probability based on status
        let probability = 0.1;
        if (c.crmStatus === CRMStatus.PTP) probability = 0.7;
        else if (c.crmStatus === CRMStatus.UNDER_NEGO) probability = 0.5;
        else if (c.crmStatus === CRMStatus.CB) probability = 0.4;
        else if (c.crmStatus === CRMStatus.RTP) probability = 0.6;
        else if (c.crmStatus === CRMStatus.WIP) probability = 0.35;
        else if (c.crmStatus === CRMStatus.FIP) probability = 0.3;
        else if (c.crmStatus === CRMStatus.NEW) probability = 0.2;
        else if (c.crmStatus === CRMStatus.DISPUTE) probability = 0.15;
        else if (c.crmStatus === CRMStatus.NCC) probability = 0.05;

        // Determine recommended action
        let action: 'call' | 'email' | 'legal' | 'settlement' = 'call';
        if (c.crmStatus === CRMStatus.PTP) action = 'call';
        else if (c.crmStatus === CRMStatus.UNDER_NEGO) action = 'settlement';
        else if (balanceAED > 50000 && probability < 0.2) action = 'legal';
        else if (c.contactStatus === 'Non Contact') action = 'email';

        return {
          id: c.id,
          debtorName: c.debtor.name,
          account: c.loan.accountNumber,
          balanceAED,
          probability,
          score: balanceAED * probability,
          action,
          crmStatus: c.crmStatus,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const recoveryPotential = recoveryCases.reduce((sum, c) => sum + c.balanceAED * c.probability, 0);

    // Weekly target gap calculation
    const weeklyTarget = collectionTarget * 5; // 5 working days
    const weeklyCollected = monthlyActions
      .filter(a => {
        const actionDate = new Date(a.attributionDate || a.timestamp);
        const reportDate = new Date(date);
        const startOfWeek = new Date(reportDate);
        startOfWeek.setDate(reportDate.getDate() - reportDate.getDay() + 1); // Monday
        return actionDate >= startOfWeek && actionDate <= reportDate;
      })
      .filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid)
      .reduce((sum, a) => sum + convertToAED(a.amountPaid!, a.caseData.loan.currency), 0);
    const weeklyGap = Math.max(weeklyTarget - weeklyCollected, 0);

    // ── Additional KPIs ──
    const estimatedMonthlySalary = 8000; // AED estimated per officer
    const totalEstimatedSalary = activeCoordinators.length * estimatedMonthlySalary / 22; // daily
    const costPerCollection = dailyPaid > 0 ? totalEstimatedSalary / dailyPaid : 0;

    const teamContactRate = (contactCount + nonContactCount) > 0
      ? (contactCount / (contactCount + nonContactCount)) * 100 : 0;

    // Best and worst performing officers
    const sortedByCollection = [...snapshots].sort((a, b) => b.dailyPaid - a.dailyPaid);
    const bestOfficer = sortedByCollection.length > 0 ? sortedByCollection[0] : null;
    const worstOfficer = sortedByCollection.length > 1 ? sortedByCollection[sortedByCollection.length - 1] : null;

    // ── AI Strategy Recommendations ──
    // 1. Focus Area: status with most stale cases
    const statusStaleCounts: Record<string, number> = {};
    staleCases.forEach(c => {
      statusStaleCounts[c.crmStatus] = (statusStaleCounts[c.crmStatus] || 0) + 1;
    });
    const focusAreaEntries = Object.entries(statusStaleCounts).sort((a, b) => b[1] - a[1]);
    const focusArea = focusAreaEntries.length > 0
      ? `${focusAreaEntries[0][0]} has ${focusAreaEntries[0][1]} stale case${focusAreaEntries[0][1] !== 1 ? 's' : ''} with no contact in 3+ days. Prioritize outreach to prevent withdrawal.`
      : 'No stale cases detected -- great job maintaining contact across all statuses.';

    // 2. Quick Wins: cases close to settlement (UNDER_NEGO with moderate balance)
    const quickWinCases = relevantCases
      .filter(c => c.crmStatus === CRMStatus.UNDER_NEGO || c.crmStatus === CRMStatus.PTP)
      .sort((a, b) => convertToAED(a.loan.currentBalance, a.loan.currency) - convertToAED(b.loan.currentBalance, b.loan.currency))
      .slice(0, 3);
    const quickWins = quickWinCases.length > 0
      ? `${quickWinCases.length} case${quickWinCases.length !== 1 ? 's' : ''} in negotiation/PTP with balances under ${formatCurrency(quickWinCases[quickWinCases.length - 1] ? convertToAED(quickWinCases[quickWinCases.length - 1].loan.currentBalance, quickWinCases[quickWinCases.length - 1].loan.currency) : 0, 'AED')} -- these are close to resolution. Push for settlement.`
      : 'No cases currently in active negotiation or PTP status.';

    // 3. Risk Alert: high-value cases with no contact in 5+ days
    const fiveDaysAgo = new Date(date);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const riskAlertCases = relevantCases.filter(c => {
      if (c.crmStatus === CRMStatus.CLOSED || c.crmStatus === CRMStatus.WITHDRAWN) return false;
      const balanceAED = convertToAED(c.loan.currentBalance, c.loan.currency);
      if (balanceAED < 10000) return false;
      const lastContact = c.lastContactDate ? new Date(c.lastContactDate) : null;
      return !lastContact || lastContact < fiveDaysAgo;
    });
    const riskAlert = riskAlertCases.length > 0
      ? `${riskAlertCases.length} high-value case${riskAlertCases.length !== 1 ? 's' : ''} (balance > AED 10,000) with no contact in 5+ days. Total at-risk balance: ${formatCurrency(riskAlertCases.reduce((s, c) => s + convertToAED(c.loan.currentBalance, c.loan.currency), 0), 'AED')}.`
      : 'All high-value cases have been contacted within the last 5 days.';

    // 4. Resource Suggestion
    const officerCaseCounts = snapshots.map(s => ({ name: s.name, cases: s.dailyDOE, id: s.id })).sort((a, b) => a.cases - b.cases);
    const resourceSuggestion = officerCaseCounts.length >= 2 && officerCaseCounts[0].cases < officerCaseCounts[officerCaseCounts.length - 1].cases * 0.5
      ? `${officerCaseCounts[officerCaseCounts.length - 1].name} handled ${officerCaseCounts[officerCaseCounts.length - 1].cases} cases while ${officerCaseCounts[0].name} handled only ${officerCaseCounts[0].cases}. Consider reallocating cases for balanced workload.`
      : officerCaseCounts.length >= 2
        ? 'Workload is relatively balanced across officers. No reallocation needed.'
        : 'Single officer view -- workload balancing not applicable.';

    return {
      teamTotal: { dailyPaid, dailyDOE: casesWorkedCount, dailyCalls, dailyEmails },
      snapshots,
      activityBreakdown: { crm: crmStatusBreakdown, sub: subStatusBreakdown },
      activityTimeline,
      contactPieData,
      payments,
      casesWorkedDetail,
      productivityScore,
      aiAnalysis,
      dailyNotes: allDailyNotes,
      // New professional features
      recoveryCases,
      recoveryPotential,
      weeklyGap,
      weeklyCollected,
      weeklyTarget,
      costPerCollection,
      teamContactRate,
      bestOfficer,
      worstOfficer,
      aiStrategy: { focusArea, quickWins, riskAlert, resourceSuggestion },
    };
  }, [cases, coordinators, activeCoordinators, date]);

  // ─── Drill-down for CRM status ────────────────────────────────────────────────
  const casesForSelectedStatus = useMemo(() => {
    if (!selectedCrmStatus) return [];
    const relevantCaseIds = new Set(activeCoordinators.map(c => c.id));
    const relevantCases = cases.filter(c => relevantCaseIds.has(c.assignedOfficerId));
    const dailyActions = relevantCases.flatMap(c =>
      c.history
        .filter(h => (h.attributionDate || h.timestamp).startsWith(date))
        .map(h => ({ ...h, caseData: c }))
    );
    const lastStatusMap = new Map<string, EnrichedCase>();
    for (const action of dailyActions) {
      lastStatusMap.set(action.caseId, action.caseData);
    }
    return Array.from(lastStatusMap.values()).filter(c => c.crmStatus === selectedCrmStatus);
  }, [selectedCrmStatus, cases, date, activeCoordinators]);

  // ─── Render: Filtered View ────────────────────────────────────────────────────
  if (selectedCrmStatus) {
    return (
      <div className="p-4 sm:p-6 min-h-full bg-background text-text-primary">
        <FilteredCasesView
          status={selectedCrmStatus}
          cases={casesForSelectedStatus}
          onBack={() => setSelectedCrmStatus(null)}
          onSelectCase={onSelectCase}
        />
      </div>
    );
  }

  // ─── Render: Main Report ──────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 min-h-full bg-background text-text-primary">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          {onBack && coordinators.length === 1 && (
            <button onClick={onBack} className="flex-shrink-0 w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-surface-muted transition-colors">
              {ICONS.arrow('w-5 h-5 text-text-secondary')}
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
              {isTeamView ? 'Day-End Report' : `Day-End Report`}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {isTeamView
                ? 'Team performance summary for the selected date'
                : `${coordinators[0]?.name || 'Officer'} -- Daily activity and performance review`
              }
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Officer selector for managers */}
          {isTeamView && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-text-secondary">Officer:</label>
              <select
                value={selectedOfficerFilter}
                onChange={e => setSelectedOfficerFilter(e.target.value)}
                className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Officers</option>
                {coordinators.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date picker */}
          <div className="flex items-center gap-2">
            <label htmlFor="report-date" className="text-xs font-medium text-text-secondary">Date:</label>
            <div className="relative">
              <input
                type="date"
                id="report-date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-surface border border-border rounded-lg shadow-sm pl-3 pr-10 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                {ICONS.calendar('h-4 w-4 text-text-secondary')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Team KPI Bar (team view) ── */}
      {isTeamView && selectedOfficerFilter === 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard title="Total Collected" value={formatCurrency(computedData.teamTotal.dailyPaid, 'AED')} icon={ICONS.recovered('w-7 h-7 text-accent')} valueColor="text-accent" iconBg="bg-accent/10" />
          <KpiCard title="Total Calls" value={computedData.teamTotal.dailyCalls.toLocaleString()} icon={ICONS.phone('w-7 h-7 text-sky-500')} valueColor="text-sky-500" iconBg="bg-sky-500/10" />
          <KpiCard title="Cases Worked" value={computedData.teamTotal.dailyDOE.toLocaleString()} icon={ICONS.clients('w-7 h-7 text-primary')} valueColor="text-primary" iconBg="bg-primary/10" />
          <KpiCard title="Emails Sent" value={computedData.teamTotal.dailyEmails.toLocaleString()} icon={ICONS.email('w-7 h-7 text-violet-500')} valueColor="text-violet-500" iconBg="bg-violet-500/10" />
        </div>
      )}

      {/* ── Additional Performance KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="!p-4">
          <p className="text-xs font-medium text-text-secondary mb-1">Cost per Collection</p>
          <p className="text-2xl font-black text-text-primary">
            {computedData.costPerCollection > 0 ? `${(computedData.costPerCollection * 100).toFixed(1)}%` : '--'}
          </p>
          <p className="text-[10px] text-text-secondary mt-1">Est. daily salary cost / collections</p>
        </Card>
        {isTeamView && computedData.bestOfficer && (
          <Card className="!p-4 border-l-4 border-l-emerald-500">
            <p className="text-xs font-medium text-text-secondary mb-1">Best Performing Officer</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">{computedData.bestOfficer.name}</p>
            <p className="text-sm font-semibold text-text-primary">{formatCurrency(computedData.bestOfficer.dailyPaid, 'AED')}</p>
          </Card>
        )}
        {isTeamView && computedData.worstOfficer && (
          <Card className="!p-4 border-l-4 border-l-red-500">
            <p className="text-xs font-medium text-text-secondary mb-1">Needs Attention</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400 truncate">{computedData.worstOfficer.name}</p>
            <p className="text-sm font-semibold text-text-primary">{formatCurrency(computedData.worstOfficer.dailyPaid, 'AED')}</p>
          </Card>
        )}
        <Card className="!p-4">
          <p className="text-xs font-medium text-text-secondary mb-1">Team Contact Rate</p>
          <p className={`text-2xl font-black ${computedData.teamContactRate >= 40 ? 'text-emerald-500' : computedData.teamContactRate >= 25 ? 'text-amber-500' : 'text-red-500'}`}>
            {computedData.teamContactRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-text-secondary mt-1">Contacts / total attempts</p>
        </Card>
      </div>

      {/* ── AI Analysis Panel (prominent, at top) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <AIAnalysisPanel analysis={computedData.aiAnalysis} onSelectCase={onSelectCase} />
        </div>
        <div className="lg:col-span-1">
          <ProductivityScoreCard breakdown={computedData.productivityScore} />
        </div>
      </div>

      {/* ── Recovery Strategy Panel ── */}
      <div className="mb-6">
        <div className="panel !p-0 overflow-hidden border-l-4" style={{ borderLeftColor: 'var(--color-accent)' }}>
          <div className="px-5 py-4 border-b border-border" style={{ background: 'linear-gradient(135deg, var(--color-accent-glow), var(--color-primary-glow))' }}>
            <div className="flex items-center gap-3">
              {ICONS.bolt('w-6 h-6 text-amber-500')}
              <div>
                <h3 className="text-lg font-bold text-text-primary">Recovery Strategy</h3>
                <p className="text-xs text-text-secondary">Top 5 high-value cases to focus on tomorrow (ranked by balance x recovery probability)</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Target Gap Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-primary/5 border border-primary/15 p-3 rounded-lg">
                <p className="text-xs font-medium text-text-secondary">If we recover these 5 cases</p>
                <p className="text-xl font-black text-primary mt-1">
                  {formatCurrency(computedData.recoveryPotential, 'AED')}
                </p>
                <p className="text-[10px] text-text-secondary mt-0.5">Potential weighted collection</p>
              </div>
              <div className={`p-3 rounded-lg ${computedData.weeklyGap > 0 ? 'bg-red-500/5 border border-red-500/15' : 'bg-emerald-500/5 border border-emerald-500/15'}`}>
                <p className="text-xs font-medium text-text-secondary">Weekly Target Gap</p>
                <p className={`text-xl font-black mt-1 ${computedData.weeklyGap > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {computedData.weeklyGap > 0 ? formatCurrency(computedData.weeklyGap, 'AED') : 'On Track!'}
                </p>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  {computedData.weeklyGap > 0
                    ? `Need ${formatCurrency(computedData.weeklyGap, 'AED')} more this week to hit target`
                    : `Collected ${formatCurrency(computedData.weeklyCollected, 'AED')} of ${formatCurrency(computedData.weeklyTarget, 'AED')} weekly target`
                  }
                </p>
              </div>
            </div>

            {/* Recovery Cases Table */}
            {computedData.recoveryCases.length > 0 ? (
              <div className="overflow-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>#</th>
                      <th className={TH_CLASS}>Debtor</th>
                      <th className={TH_CLASS}>Account</th>
                      <th className={TH_CLASS}>Balance (AED)</th>
                      <th className={TH_CLASS}>Recovery Prob.</th>
                      <th className={TH_CLASS}>Score</th>
                      <th className={TH_CLASS}>Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-border">
                    {computedData.recoveryCases.map((rc, i) => {
                      const actionColors: Record<string, string> = {
                        call: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
                        email: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
                        legal: 'bg-red-500/10 text-red-600 dark:text-red-400',
                        settlement: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                      };
                      const actionLabels: Record<string, string> = {
                        call: 'Call',
                        email: 'Email',
                        legal: 'Legal Action',
                        settlement: 'Settlement',
                      };
                      return (
                        <tr key={rc.id} onClick={() => onSelectCase(rc.id)} className="hover:bg-surface-muted cursor-pointer transition-colors">
                          <td className={`${TD_CLASS} font-bold text-primary`}>{i + 1}</td>
                          <td className={`${TD_CLASS} font-medium`}>{rc.debtorName}</td>
                          <td className={`${TD_CLASS} font-mono text-xs`}>{rc.account}</td>
                          <td className={`${TD_CLASS} font-bold text-red-500`}>{formatCurrency(rc.balanceAED, 'AED')}</td>
                          <td className={TD_CLASS}>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-surface-muted rounded-full h-1.5 overflow-hidden">
                                <div className={`h-1.5 rounded-full ${rc.probability >= 0.5 ? 'bg-emerald-500' : rc.probability >= 0.3 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rc.probability * 100}%` }} />
                              </div>
                              <span className="text-xs font-medium">{(rc.probability * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className={`${TD_CLASS} font-semibold text-primary`}>{formatCurrency(rc.score, 'AED')}</td>
                          <td className={TD_CLASS}>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${actionColors[rc.action] || ''}`}>
                              {actionLabels[rc.action] || rc.action}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-text-secondary text-sm">No open cases available for recovery strategy.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Payment Summary ── */}
      <div className="mb-6">
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            {ICONS.money('w-5 h-5 text-text-secondary')}
            <h3 className="text-lg font-bold text-text-primary">Payment Summary</h3>
            {computedData.payments.length > 0 && (
              <span className="ml-auto text-sm font-bold text-emerald-500">
                Total: {formatCurrency(computedData.payments.reduce((s, p) => s + p.amountAED, 0), 'AED')}
              </span>
            )}
          </div>
          {computedData.payments.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Debtor</th>
                    <th className={TH_CLASS}>Account</th>
                    <th className={TH_CLASS}>Bank</th>
                    <th className={TH_CLASS}>Amount</th>
                    <th className={TH_CLASS}>Type</th>
                    <th className={TH_CLASS}>Method</th>
                    <th className={TH_CLASS}>Time</th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                  {computedData.payments.map((p, i) => (
                    <tr key={i} onClick={() => onSelectCase(p.caseId)} className="hover:bg-surface-muted cursor-pointer transition-colors">
                      <td className={TD_CLASS}>{p.debtor}</td>
                      <td className={`${TD_CLASS} font-mono text-xs`}>{p.account}</td>
                      <td className={TD_CLASS}>{p.bank}</td>
                      <td className={`${TD_CLASS} font-bold text-emerald-600 dark:text-emerald-400`}>{formatCurrency(p.amount, p.currency)}</td>
                      <td className={TD_CLASS}><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{p.type}</span></td>
                      <td className={TD_CLASS}>{p.method}</td>
                      <td className={`${TD_CLASS} text-text-secondary`}>{p.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                {ICONS.danger('w-5 h-5 text-red-500')}
                <span className="text-sm font-bold text-red-600 dark:text-red-400">No payments recorded today</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* CRM Status Breakdown */}
        <Card className="!p-0 flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-base font-bold text-text-primary">Activity by CRM Status</h3>
            <p className="text-xs text-text-secondary mt-0.5">Click a bar to view filtered cases</p>
          </div>
          <div className="p-4 flex-grow" style={{ minHeight: '280px' }}>
            {computedData.activityBreakdown.crm.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={computedData.activityBreakdown.crm} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/50" />
                  <XAxis type="number" stroke="currentColor" className="text-xs" hide />
                  <YAxis type="category" dataKey="status" stroke="currentColor" className="text-xs" width={100} interval={0} />
                  <Tooltip content={<CustomActivityTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="count" name="Cases" barSize={16} className="cursor-pointer" onClick={(data: any) => setSelectedCrmStatus(data.payload.status)}>
                    {computedData.activityBreakdown.crm.map((_entry, index) => <Cell key={`crm-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-text-secondary text-sm">No activities recorded.</div>}
          </div>
        </Card>

        {/* Sub-Status Breakdown */}
        <Card className="!p-0 flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-base font-bold text-text-primary">Activity by Sub-Status</h3>
          </div>
          <div className="p-4 flex-grow" style={{ minHeight: '280px' }}>
            {computedData.activityBreakdown.sub.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={computedData.activityBreakdown.sub} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/50" />
                  <XAxis type="number" stroke="currentColor" className="text-xs" hide />
                  <YAxis type="category" dataKey="status" stroke="currentColor" className="text-xs" width={130} interval={0} />
                  <Tooltip content={<CustomActivityTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="count" name="Cases" barSize={16}>
                    {computedData.activityBreakdown.sub.map((_entry, index) => <Cell key={`sub-${index}`} fill={CHART_COLORS[(index + 4) % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-text-secondary text-sm">No activities recorded.</div>}
          </div>
        </Card>

        {/* Activity Timeline */}
        <Card className="!p-0 flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-base font-bold text-text-primary">Activity Timeline</h3>
            <p className="text-xs text-text-secondary mt-0.5">Hour-by-hour distribution of work</p>
          </div>
          <div className="p-4 flex-grow" style={{ minHeight: '250px' }}>
            {computedData.activityTimeline.some(t => t.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={computedData.activityTimeline} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" className="text-xs" stroke="currentColor" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" stroke="currentColor" allowDecimals={false} />
                  <Tooltip content={<CustomActivityTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="count" name="Actions" barSize={32} radius={[4, 4, 0, 0]}>
                    {computedData.activityTimeline.map((_entry, index) => {
                      // Gradient: morning=navy, afternoon=orange
                      const c = index < 2 ? NAVY : index < 4 ? ORANGE : '#8b5cf6';
                      return <Cell key={`time-${index}`} fill={c} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-text-secondary text-sm">No timeline data available.</div>}
          </div>
        </Card>

        {/* Contact vs Non-Contact Pie */}
        <Card className="!p-0 flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-base font-bold text-text-primary">Contact vs Non-Contact</h3>
          </div>
          <div className="p-4 flex-grow flex items-center justify-center" style={{ minHeight: '250px' }}>
            {computedData.contactPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={computedData.contactPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                  >
                    {computedData.contactPieData.map((entry, index) => (
                      <Cell key={`pie-${index}`} fill={entry.name === 'Contact' ? CONTACT_COLORS.contact : CONTACT_COLORS.nonContact} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="text-text-secondary text-sm">No contact data available.</div>}
            {/* Legend overlay */}
            {computedData.contactPieData.length > 0 && (
              <div className="absolute flex flex-col gap-2">
                {computedData.contactPieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.name === 'Contact' ? CONTACT_COLORS.contact : CONTACT_COLORS.nonContact }} />
                    <span className="text-xs font-medium text-text-secondary">{d.name}: <span className="font-bold text-text-primary">{d.value}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Cases Worked Table ── */}
      <div className="mb-6">
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              {ICONS.activities('w-5 h-5 text-text-secondary')}
              <h3 className="text-lg font-bold text-text-primary">Cases Worked Today</h3>
              <span className="text-xs font-medium text-text-secondary bg-surface-muted px-2 py-0.5 rounded-full">
                {computedData.casesWorkedDetail.length} case{computedData.casesWorkedDetail.length !== 1 ? 's' : ''}
              </span>
            </div>
            {computedData.casesWorkedDetail.length > 10 && (
              <button
                onClick={() => setCasesTableExpanded(!casesTableExpanded)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {casesTableExpanded ? 'Show Less' : `Show All (${computedData.casesWorkedDetail.length})`}
              </button>
            )}
          </div>
          {computedData.casesWorkedDetail.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Debtor</th>
                    <th className={TH_CLASS}>Account</th>
                    <th className={TH_CLASS}>Bank</th>
                    <th className={TH_CLASS}>Status Change</th>
                    <th className={TH_CLASS}>Action Type</th>
                    <th className={TH_CLASS}>Notes</th>
                    <th className={TH_CLASS}>Time</th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-border">
                  {(casesTableExpanded ? computedData.casesWorkedDetail : computedData.casesWorkedDetail.slice(0, 10)).map((row, i) => (
                    <tr key={i} onClick={() => onSelectCase(row.caseId)} className="hover:bg-surface-muted cursor-pointer transition-colors">
                      <td className={`${TD_CLASS} font-medium`}>{row.debtor}</td>
                      <td className={`${TD_CLASS} font-mono text-xs`}>{row.account}</td>
                      <td className={TD_CLASS}>{row.bank}</td>
                      <td className={TD_CLASS}>
                        {row.fromStatus === row.toStatus ? (
                          <span className="text-xs text-text-secondary">{row.toStatus}</span>
                        ) : (
                          <span className="text-xs">
                            <span className="text-text-secondary">{row.fromStatus}</span>
                            <span className="mx-1 text-text-secondary/50">→</span>
                            <span className="font-semibold text-primary">{row.toStatus}</span>
                          </span>
                        )}
                      </td>
                      <td className={TD_CLASS}>
                        <span className="inline-flex flex-wrap gap-1">
                          {row.actionType.split(', ').map((t, j) => (
                            <span key={j} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-muted text-text-secondary">{t}</span>
                          ))}
                        </span>
                      </td>
                      <td className={`${TD_CLASS} max-w-[200px] truncate text-text-secondary text-xs`} title={row.notes}>{row.notes}</td>
                      <td className={`${TD_CLASS} text-text-secondary text-xs`}>{row.time}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Summary Row */}
                <tfoot>
                  <tr className="bg-surface-muted">
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-text-primary">
                      Total: {computedData.casesWorkedDetail.length} case{computedData.casesWorkedDetail.length !== 1 ? 's' : ''} worked
                    </td>
                    <td colSpan={4} className="px-4 py-3 text-sm text-text-secondary text-right">
                      {computedData.teamTotal.dailyCalls} call{computedData.teamTotal.dailyCalls !== 1 ? 's' : ''} | {computedData.teamTotal.dailyEmails} email{computedData.teamTotal.dailyEmails !== 1 ? 's' : ''} | Collected: <span className="font-bold text-emerald-500">{formatCurrency(computedData.teamTotal.dailyPaid, 'AED')}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-text-secondary text-sm">No cases were worked on the selected date.</div>
          )}
        </Card>
      </div>

      {/* ── Officer Snapshots (Team View) ── */}
      {isTeamView && selectedOfficerFilter === 'all' && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-text-primary">Officer Performance Snapshots</h3>
            <span className="text-xs text-text-secondary">{computedData.snapshots.length} officer{computedData.snapshots.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {computedData.snapshots.map(data => (
              <OfficerPerformanceSnapshot
                key={data.id}
                data={data}
                onSelect={onSelectOfficer ? () => onSelectOfficer(data.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── AI Strategy Recommendations ── */}
      <div className="mb-6">
        <div className="panel !p-0 overflow-hidden border-t-4" style={{ borderTopColor: 'var(--color-primary)' }}>
          <div className="px-5 py-4 border-b border-border" style={{ background: 'linear-gradient(135deg, var(--color-primary-glow), transparent)' }}>
            <div className="flex items-center gap-3">
              {ICONS.lightbulb('w-6 h-6 text-amber-500')}
              <div>
                <h3 className="text-lg font-bold text-text-primary">AI Strategy Recommendations</h3>
                <p className="text-xs text-text-secondary">Based on today's performance analysis</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* 1. Focus Area */}
            <div className="flex items-start gap-4 p-4 bg-surface-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 text-red-500 text-sm font-bold flex items-center justify-center">1</div>
              <div>
                <h4 className="text-sm font-bold text-text-primary mb-1">Focus Area</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{computedData.aiStrategy.focusArea}</p>
              </div>
            </div>

            {/* 2. Quick Wins */}
            <div className="flex items-start gap-4 p-4 bg-surface-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 text-sm font-bold flex items-center justify-center">2</div>
              <div>
                <h4 className="text-sm font-bold text-text-primary mb-1">Quick Wins</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{computedData.aiStrategy.quickWins}</p>
              </div>
            </div>

            {/* 3. Risk Alert */}
            <div className="flex items-start gap-4 p-4 bg-surface-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 text-sm font-bold flex items-center justify-center">3</div>
              <div>
                <h4 className="text-sm font-bold text-text-primary mb-1">Risk Alert</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{computedData.aiStrategy.riskAlert}</p>
              </div>
            </div>

            {/* 4. Resource Suggestion */}
            <div className="flex items-start gap-4 p-4 bg-surface-muted rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 text-sm font-bold flex items-center justify-center">4</div>
              <div>
                <h4 className="text-sm font-bold text-text-primary mb-1">Resource Suggestion</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{computedData.aiStrategy.resourceSuggestion}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamPerformanceReport;
