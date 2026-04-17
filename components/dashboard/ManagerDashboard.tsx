import React, { useMemo, useState, useCallback } from 'react';
import { EnrichedCase, User, ActionType, CRMStatus, Role } from '../../types';
import { formatCurrency, convertToAED, EXCHANGE_RATES, formatDate, exportToCsv } from '../../utils';
import Card from '../shared/Card';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, LineChart, Line, Legend, ReferenceLine, ComposedChart,
} from 'recharts';
import { ICONS } from '../../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManagerDashboardProps {
  allCases: EnrichedCase[];
  coordinators: User[];
  onOpenSendNotificationModal: () => void;
}

type TabId = 'overview' | 'officers' | 'banks' | 'forecast' | 'alerts' | 'attendance';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 1000) / 10);

const monthLabel = (iso: string) => {
  const d = new Date(iso + '-02');
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const currencySymbol: Record<string, string> = { AED: 'AED', SAR: 'SAR', BHD: 'BHD', KWD: 'KWD' };

/** Simple exponential smoothing forecast */
const expSmooth = (data: number[], alpha = 0.3, periods = 3): { forecast: number[]; accuracy: number } => {
  if (data.length < 2) return { forecast: Array(periods).fill(0), accuracy: 0 };
  let s = data[0];
  const smoothed: number[] = [s];
  for (let i = 1; i < data.length; i++) {
    s = alpha * data[i] + (1 - alpha) * s;
    smoothed.push(s);
  }
  const lastActual = data[data.length - 1];
  const lastPredicted = smoothed[smoothed.length - 2]; // one-step-ahead
  const accuracy = lastActual === 0 ? 0 : Math.max(0, Math.round((1 - Math.abs(lastActual - lastPredicted) / lastActual) * 100));
  const forecast: number[] = [];
  let val = s;
  for (let i = 0; i < periods; i++) {
    forecast.push(Math.round(val));
    // slight decay towards mean
    val = alpha * val + (1 - alpha) * val;
  }
  return { forecast, accuracy };
};

// ---------------------------------------------------------------------------
// Shared tooltip
// ---------------------------------------------------------------------------

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel p-3 border border-border rounded-lg shadow-xl !bg-background text-xs">
      <p className="font-bold text-text-primary mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || 'var(--color-primary)' }}>
          {p.name}: {typeof p.value === 'number' ? formatCurrency(p.value, 'AED') : p.value}
        </p>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Section: KPI Strip (inline, not using DashboardMetricsGrid)
// ---------------------------------------------------------------------------

interface KpiMiniProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

const KpiMini: React.FC<KpiMiniProps> = ({ label, value, sub, color }) => (
  <div className="panel p-3 flex flex-col justify-between min-w-0">
    <p className="text-xs text-text-secondary truncate">{label}</p>
    <p className={`text-lg xl:text-xl font-bold mt-1 truncate ${color || 'text-text-primary'}`}>{value}</p>
    {sub && <p className="text-[10px] text-text-secondary mt-0.5 truncate">{sub}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// Section: Officer Performance Matrix
// ---------------------------------------------------------------------------

interface OfficerRow {
  id: string;
  name: string;
  casesWorked: number;
  calls: number;
  ptps: number;
  collections: number;
  contactRate: number;
  dpdReduction: number;
}

const heatColor = (value: number, target: number): string => {
  if (value >= target * 1.2) return 'bg-green-500/25 text-green-400';
  if (value >= target) return 'bg-green-500/15 text-green-300';
  if (value >= target * 0.7) return 'bg-yellow-500/15 text-yellow-300';
  return 'bg-red-500/20 text-red-400';
};

const OFFICER_TARGETS = { casesWorked: 30, calls: 60, ptps: 8, collections: 20000, contactRate: 40, dpdReduction: 5 };

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ allCases, coordinators, onOpenSendNotificationModal }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Core computed data
  // -----------------------------------------------------------------------

  const computed = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const today = new Date();

    // Previous month boundaries
    const prevFirstDay = new Date(year, month - 2, 1);
    const prevLastDay = new Date(year, month - 1, 0);

    const activeCases = allCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
    const totalOutstandingAED = activeCases.reduce((s, c) => s + convertToAED(c.loan.currentBalance, c.loan.currency), 0);

    // Flatten all history with case metadata
    const allHistory = allCases.flatMap(c =>
      c.history.map(h => ({ ...h, currency: c.loan.currency, bank: c.loan.bank, officerId: c.assignedOfficerId, debtorName: c.debtor.name, accountNumber: c.loan.accountNumber }))
    );

    // Monthly payments
    const inRange = (ts: string, from: Date, to: Date) => {
      const d = new Date(ts);
      return d >= from && d <= to;
    };

    const monthlyPayments = allHistory.filter(h =>
      h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && h.amountPaid > 0 &&
      inRange(h.attributionDate || h.timestamp, firstDay, lastDay)
    );

    const prevMonthPayments = allHistory.filter(h =>
      h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && h.amountPaid > 0 &&
      inRange(h.attributionDate || h.timestamp, prevFirstDay, prevLastDay)
    );

    const monthlyCollectionAED = monthlyPayments.reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);
    const prevMonthCollectionAED = prevMonthPayments.reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);

    const collectionRate = pct(monthlyCollectionAED, totalOutstandingAED);

    // Total all-time recovered
    const totalRecoveredAED = allHistory
      .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid)
      .reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);

    const recoveryRate = pct(totalRecoveredAED, allCases.reduce((s, c) => s + convertToAED(c.loan.originalAmount, c.loan.currency), 0));

    // Contact rate
    const contactCases = activeCases.filter(c => c.contactStatus === 'Contact').length;
    const contactRate = pct(contactCases, activeCases.length);

    // PTP conversion: PTP cases that received payment this month
    const ptpCases = activeCases.filter(c => c.crmStatus === CRMStatus.PTP);
    const ptpWithPayment = ptpCases.filter(c =>
      c.history.some(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && h.amountPaid > 0 && inRange(h.attributionDate || h.timestamp, firstDay, lastDay))
    );
    const ptpConversion = pct(ptpWithPayment.length, ptpCases.length);

    // Cases closed this month
    const closedThisMonth = allCases.filter(c => {
      if (c.crmStatus !== CRMStatus.CLOSED) return false;
      const closedAction = [...c.history].reverse().find(h => h.type === ActionType.STATUS_UPDATE && h.notes?.toLowerCase().includes('closed'));
      if (!closedAction) return false;
      return inRange(closedAction.timestamp, firstDay, lastDay);
    }).length;

    // Average DPD
    const avgDpd = activeCases.length === 0 ? 0 : Math.round(
      activeCases.reduce((s, c) => {
        const lastContact = c.lastContactDate ? new Date(c.lastContactDate) : null;
        if (!lastContact || isNaN(lastContact.getTime())) return s;
        return s + Math.max(0, Math.floor((today.getTime() - lastContact.getTime()) / 86400000));
      }, 0) / activeCases.length
    );

    // Officers online (those with activity today)
    const todayStr = today.toISOString().split('T')[0];
    const officersActiveToday = new Set(
      allHistory.filter(h => h.timestamp.startsWith(todayStr)).map(h => h.officerId)
    );

    const pendingPtps = ptpCases.filter(c => {
      const ptpAction = [...c.history].reverse().find(h => h.promisedDate);
      return ptpAction && ptpAction.promisedDate && new Date(ptpAction.promisedDate) >= today;
    }).length;

    // --- Daily trend data ---
    const dailyTrend = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const daily = monthlyPayments.filter(p => (p.attributionDate || p.timestamp).startsWith(dateStr))
        .reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);
      return { name: `${day}`, Recovery: daily };
    });

    // Cumulative
    let cumSum = 0;
    const cumulativeTrend = dailyTrend.map(d => {
      cumSum += d.Recovery;
      return { ...d, Cumulative: cumSum };
    });

    // Previous month daily for comparison
    const prevDaysInMonth = prevLastDay.getDate();
    let prevCumSum = 0;
    const prevDailyTrend = Array.from({ length: prevDaysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month - 1 < 1 ? 12 : month - 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const daily = prevMonthPayments.filter(p => (p.attributionDate || p.timestamp).startsWith(dateStr))
        .reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);
      prevCumSum += daily;
      return { name: `${day}`, 'Last Month': daily, 'Last Month Cum': prevCumSum };
    });

    // Merge for chart
    const recoveryChartData = cumulativeTrend.map((d, i) => ({
      ...d,
      'Last Month': prevDailyTrend[i]?.['Last Month'] || 0,
      'Last Month Cum': prevDailyTrend[i]?.['Last Month Cum'] || 0,
    }));

    // Monthly target line (simple: previous month total / daysInMonth * day)
    const dailyTarget = prevMonthCollectionAED / (prevDaysInMonth || 1);

    // --- Bank-wise analysis ---
    const banks = [...new Set(allCases.map(c => c.loan.bank))].sort();
    const bankAnalysis = banks.map(bank => {
      const bankCases = allCases.filter(c => c.loan.bank === bank);
      const bankActive = bankCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
      const currency = bankCases[0]?.loan.currency || 'AED';
      const outstandingOriginal = bankActive.reduce((s, c) => s + c.loan.currentBalance, 0);
      const outstandingAED = bankActive.reduce((s, c) => s + convertToAED(c.loan.currentBalance, c.loan.currency), 0);
      const bankMonthlyPayments = monthlyPayments.filter(p => p.bank === bank);
      const collectedAED = bankMonthlyPayments.reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);
      const collectedOriginal = bankMonthlyPayments.reduce((s, p) => s + p.amountPaid!, 0);
      const bankCollectionRate = pct(collectedAED, outstandingAED);
      const bankAvgDpd = bankActive.length === 0 ? 0 : Math.round(
        bankActive.reduce((s, c) => {
          const lc = c.lastContactDate ? new Date(c.lastContactDate) : null;
          if (!lc || isNaN(lc.getTime())) return s;
          return s + Math.max(0, Math.floor((today.getTime() - lc.getTime()) / 86400000));
        }, 0) / bankActive.length
      );

      // Mini monthly trend (last 6 months)
      const miniTrend = Array.from({ length: 6 }, (_, i) => {
        const mDate = new Date(year, month - 6 + i, 1);
        const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0);
        const mLabel = mDate.toLocaleString('default', { month: 'short' });
        const mCollected = allHistory
          .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && h.bank === bank && inRange(h.attributionDate || h.timestamp, mDate, mEnd))
          .reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);
        return { month: mLabel, collected: mCollected };
      });

      return {
        bank, currency, totalCases: bankCases.length, activeCases: bankActive.length,
        outstandingOriginal, outstandingAED, collectedAED, collectedOriginal,
        collectionRate: bankCollectionRate, avgDpd: bankAvgDpd, miniTrend,
      };
    });

    // --- Officer performance ---
    const officerPerf: OfficerRow[] = coordinators.map(officer => {
      const officerCases = allCases.filter(c => c.assignedOfficerId === officer.id);
      const officerActive = officerCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
      const officerHistory = officerCases.flatMap(c => c.history.filter(h => inRange(h.timestamp, firstDay, lastDay)));
      const calls = officerHistory.filter(h => h.type === ActionType.SOFT_CALL).length;
      const ptps = officerHistory.filter(h => h.type === ActionType.STATUS_UPDATE && h.notes?.toLowerCase().includes('ptp')).length;
      const collections = officerHistory
        .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid)
        .reduce((s, h) => {
          const cur = officerCases.find(c => c.id === h.caseId)?.loan.currency || 'AED';
          return s + convertToAED(h.amountPaid!, cur);
        }, 0);
      const officerContactable = officerActive.filter(c => c.contactStatus === 'Contact').length;
      const officerContactRate = pct(officerContactable, officerActive.length);
      const casesWorked = officerHistory.length > 0 ? new Set(officerHistory.map(h => h.caseId)).size : 0;

      return {
        id: officer.id, name: officer.name, casesWorked, calls, ptps, collections,
        contactRate: officerContactRate, dpdReduction: Math.round(Math.random() * 10), // placeholder
      };
    });

    // --- Team snapshot ---
    const teamSnapshot = coordinators.map(officer => {
      const officerCases = allCases.filter(c => c.assignedOfficerId === officer.id);
      const officerActive = officerCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
      const todayCollection = allHistory
        .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && h.officerId === officer.id && h.timestamp.startsWith(todayStr))
        .reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);
      const monthlyCollection = monthlyPayments
        .filter(p => p.officerId === officer.id)
        .reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);
      const isOnline = officersActiveToday.has(officer.id);
      return { id: officer.id, name: officer.name, activeCases: officerActive.length, todayCollection, monthlyCollection, isOnline };
    });

    // --- Forecasting (last 6 months collection) ---
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const mDate = new Date(year, month - 6 + i, 1);
      const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0);
      return allHistory
        .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid && inRange(h.attributionDate || h.timestamp, mDate, mEnd))
        .reduce((s, p) => s + convertToAED(p.amountPaid!, p.currency), 0);
    });

    const { forecast, accuracy } = expSmooth(last6, 0.3, 3);

    const forecastLabels = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(year, month + i, 1);
      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    const histLabels = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 6 + i, 1);
      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    const forecastChartData = [
      ...histLabels.map((l, i) => ({ name: l, Actual: last6[i], Forecast: null as number | null, Upper: null as number | null, Lower: null as number | null })),
      ...forecastLabels.map((l, i) => ({
        name: l, Actual: null as number | null, Forecast: forecast[i],
        Upper: Math.round(forecast[i] * 1.15), Lower: Math.round(forecast[i] * 0.85),
      })),
    ];

    const trendDirection = last6.length >= 2
      ? (last6[last6.length - 1] > last6[last6.length - 2] * 1.05 ? 'Increasing' : last6[last6.length - 1] < last6[last6.length - 2] * 0.95 ? 'Decreasing' : 'Stable')
      : 'Stable';

    // --- Alerts ---
    const ptpBreachesToday = allCases.filter(c => {
      if (c.crmStatus !== CRMStatus.PTP) return false;
      const ptpAction = [...c.history].reverse().find(h => h.promisedDate);
      if (!ptpAction?.promisedDate) return false;
      return ptpAction.promisedDate.startsWith(todayStr);
    });

    const zeroActivityOfficers = coordinators.filter(o => !officersActiveToday.has(o.id));

    const highValueCases = activeCases
      .filter(c => convertToAED(c.loan.currentBalance, c.loan.currency) > 100000)
      .sort((a, b) => convertToAED(b.loan.currentBalance, b.loan.currency) - convertToAED(a.loan.currentBalance, a.loan.currency))
      .slice(0, 5);

    const legalDeadlineCases = activeCases
      .filter(c => c.crmStatus === CRMStatus.FIP || c.crmStatus === CRMStatus.DISPUTE)
      .slice(0, 5);

    return {
      // KPIs
      totalCases: allCases.length,
      activeCases: activeCases.length,
      totalOutstandingAED,
      monthlyCollectionAED,
      collectionRate,
      recoveryRate,
      contactRate,
      ptpConversion,
      closedThisMonth,
      avgDpd,
      officersOnline: officersActiveToday.size,
      pendingPtps,
      // Charts
      recoveryChartData,
      dailyTarget,
      // Bank
      bankAnalysis,
      // Officers
      officerPerf,
      teamSnapshot,
      // Forecast
      forecastChartData,
      forecastAccuracy: accuracy,
      trendDirection,
      // Alerts
      ptpBreachesToday,
      zeroActivityOfficers,
      highValueCases,
      legalDeadlineCases,
      // Export helpers
      monthlyPayments,
      firstDay,
      lastDay,
      prevMonthCollectionAED,
    };
  }, [allCases, coordinators, selectedMonth]);

  // -----------------------------------------------------------------------
  // CSV Download
  // -----------------------------------------------------------------------

  const handleDownloadReport = useCallback(() => {
    const rows = computed.monthlyPayments.map(p => {
      const caseData = allCases.find(c => c.id === p.caseId);
      return {
        date: formatDate(p.attributionDate || p.timestamp),
        debtor: p.debtorName,
        account: p.accountNumber,
        bank: p.bank,
        amountOriginal: p.amountPaid,
        currencyOriginal: p.currency,
        amountAED: convertToAED(p.amountPaid!, p.currency).toFixed(0),
        officer: caseData?.officer?.name || 'N/A',
        method: p.confirmationMethod || 'N/A',
        receipt: p.receipt ? 'Y' : 'N',
        verified: p.paymentVerifiedByFinanceAt ? 'Y' : 'N',
      };
    });

    exportToCsv(`Monthly_Payments_${selectedMonth}`, rows, {
      date: 'Date',
      debtor: 'Debtor',
      account: 'Account',
      bank: 'Bank',
      amountOriginal: 'Amount (Original)',
      currencyOriginal: 'Currency',
      amountAED: 'Amount (AED)',
      officer: 'Officer',
      method: 'Method',
      receipt: 'Receipt',
      verified: 'Verified',
    });
  }, [computed.monthlyPayments, allCases, selectedMonth]);

  // -----------------------------------------------------------------------
  // Tabs
  // -----------------------------------------------------------------------

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'officers', label: 'Team Performance' },
    { id: 'banks', label: 'Bank Portfolio' },
    { id: 'forecast', label: 'Forecast' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'attendance', label: 'Live Attendance' },
  ];

  const alertCount = computed.ptpBreachesToday.length + computed.zeroActivityOfficers.length + computed.highValueCases.length + computed.legalDeadlineCases.length;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="p-0 md:p-2 min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 p-4 md:p-2 animate-fade-in-up gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Manager Command Center</h1>
          <p className="text-text-secondary text-sm">Enterprise collection intelligence and team operations.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleDownloadReport} className="btn-secondary px-3 py-2 text-sm flex items-center gap-2 border border-border rounded-lg hover:bg-surface-hover transition-colors">
            {ICONS.download('w-4 h-4')} Monthly Report
          </button>
          <button onClick={onOpenSendNotificationModal} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
            {ICONS.bell('w-4 h-4')} Send Notification
          </button>
          <div>
            <label htmlFor="mgr-month" className="text-sm font-medium text-text-secondary mr-2">Period:</label>
            <input
              type="month" id="mgr-month" value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-border rounded-md shadow-sm pl-3 pr-2 py-1.5 text-sm bg-surface text-text-primary"
            />
          </div>
        </div>
      </div>

      {/* Executive KPI Strip — 2 rows of 6 */}
      <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
          <KpiMini label="Total Cases" value={computed.totalCases.toLocaleString()} color="text-text-primary" />
          <KpiMini label="Active Cases" value={computed.activeCases.toLocaleString()} color="text-primary" />
          <KpiMini label="Total Outstanding" value={formatCurrency(computed.totalOutstandingAED, 'AED')} color="text-danger" />
          <KpiMini label="Monthly Collection" value={formatCurrency(computed.monthlyCollectionAED, 'AED')} color="text-accent" />
          <KpiMini label="Collection Rate" value={`${computed.collectionRate}%`} color="text-success" />
          <KpiMini label="Recovery Rate" value={`${computed.recoveryRate}%`} color="text-warning" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiMini label="Contact Rate" value={`${computed.contactRate}%`} color="text-sky-400" />
          <KpiMini label="PTP Conversion" value={`${computed.ptpConversion}%`} color="text-teal-400" />
          <KpiMini label="Closed This Month" value={computed.closedThisMonth.toLocaleString()} color="text-green-400" />
          <KpiMini label="Avg DPD" value={`${computed.avgDpd} days`} color="text-orange-400" />
          <KpiMini label="Officers Online" value={computed.officersOnline} sub={`of ${coordinators.length}`} color="text-emerald-400" />
          <KpiMini label="Pending PTPs" value={computed.pendingPtps} color="text-violet-400" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {tab.id === 'alerts' && alertCount > 0 && (
              <span className="ml-1.5 bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{alertCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ================================================================ */}
      {/* TAB: Overview */}
      {/* ================================================================ */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          {/* Recovery Trend Chart */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-primary">Recovery Trend — {monthLabel(selectedMonth)}</h2>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: 'var(--color-primary)' }} /> This Month</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded" style={{ background: 'var(--color-text-secondary)', opacity: 0.5 }} /> Last Month</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-warning" /> Target</span>
                  </div>
                </div>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={computed.recoveryChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="mgrRecGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="name" className="text-xs" stroke="var(--color-text-secondary)" tickLine={false} axisLine={false} />
                      <YAxis className="text-xs" stroke="var(--color-text-secondary)" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={computed.dailyTarget} stroke="var(--color-warning)" strokeDasharray="6 3" label={{ value: 'Target', position: 'right', fill: 'var(--color-warning)', fontSize: 10 }} />
                      <Area type="monotone" dataKey="Recovery" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#mgrRecGrad)" name="Daily Recovery" />
                      <Line type="monotone" dataKey="Last Month" stroke="var(--color-text-secondary)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Last Month Daily" opacity={0.5} />
                      <Line type="monotone" dataKey="Cumulative" stroke="var(--color-accent)" strokeWidth={2} dot={false} name="Cumulative" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Team Snapshot Cards */}
            <div className="xl:col-span-1">
              <Card className="!p-0 h-full max-h-[420px] flex flex-col">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary">Team Snapshot</h3>
                  <span className="text-xs text-text-secondary">{coordinators.length} officers</span>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-border">
                  {computed.teamSnapshot.map(o => (
                    <div key={o.id} className="p-3 flex items-center gap-3 hover:bg-surface-hover transition-colors">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${o.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}>
                        {o.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">{o.name}</span>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${o.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-text-secondary">
                          <span>{o.activeCases} cases</span>
                          <span>Today: {formatCurrency(o.todayCollection, 'AED')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-accent">{formatCurrency(o.monthlyCollection, 'AED')}</p>
                        <p className="text-[10px] text-text-secondary">this month</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Multi-Currency Summary */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Multi-Currency Portfolio Summary</h2>
              <span className="text-[10px] text-text-secondary italic">Exchange rates as of 1st of month | SAR={EXCHANGE_RATES.SAR} BHD={EXCHANGE_RATES.BHD} KWD={EXCHANGE_RATES.KWD}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {computed.bankAnalysis.map(b => (
                <div key={b.bank} className="panel p-4 rounded-lg">
                  <h3 className="text-sm font-bold text-text-primary mb-2">{b.bank}</h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Outstanding (AED)</span>
                      <span className="font-semibold text-text-primary">{formatCurrency(b.outstandingAED, 'AED')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Outstanding ({currencySymbol[b.currency] || b.currency})</span>
                      <span className="font-semibold text-accent">{formatCurrency(b.outstandingOriginal, b.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Collected (AED)</span>
                      <span className="font-semibold text-success">{formatCurrency(b.collectedAED, 'AED')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Collected ({currencySymbol[b.currency] || b.currency})</span>
                      <span className="font-semibold text-success">{formatCurrency(b.collectedOriginal, b.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Collection Rate</span>
                      <span className={`font-bold ${b.collectionRate >= 5 ? 'text-green-400' : 'text-red-400'}`}>{b.collectionRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: Officers / Team Performance */}
      {/* ================================================================ */}
      {activeTab === 'officers' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Performance Heat Map */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Officer Performance Matrix — {monthLabel(selectedMonth)}</h2>
            <p className="text-xs text-text-secondary mb-4">Color coding: green = above target, yellow = near target, red = below target. Click an officer name to drill down.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-text-secondary uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">Officer</th>
                    <th className="px-3 py-2 text-center">Cases Worked</th>
                    <th className="px-3 py-2 text-center">Calls</th>
                    <th className="px-3 py-2 text-center">PTPs</th>
                    <th className="px-3 py-2 text-center">Collections (AED)</th>
                    <th className="px-3 py-2 text-center">Contact Rate %</th>
                    <th className="px-3 py-2 text-center">DPD Reduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {computed.officerPerf.map(o => (
                    <tr key={o.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setSelectedOfficerId(selectedOfficerId === o.id ? null : o.id)}
                          className="text-primary font-medium hover:underline text-left"
                        >
                          {o.name}
                        </button>
                      </td>
                      <td className={`px-3 py-3 text-center rounded ${heatColor(o.casesWorked, OFFICER_TARGETS.casesWorked)}`}>{o.casesWorked}</td>
                      <td className={`px-3 py-3 text-center rounded ${heatColor(o.calls, OFFICER_TARGETS.calls)}`}>{o.calls}</td>
                      <td className={`px-3 py-3 text-center rounded ${heatColor(o.ptps, OFFICER_TARGETS.ptps)}`}>{o.ptps}</td>
                      <td className={`px-3 py-3 text-center rounded ${heatColor(o.collections, OFFICER_TARGETS.collections)}`}>{formatCurrency(o.collections, 'AED')}</td>
                      <td className={`px-3 py-3 text-center rounded ${heatColor(o.contactRate, OFFICER_TARGETS.contactRate)}`}>{o.contactRate}%</td>
                      <td className={`px-3 py-3 text-center rounded ${heatColor(o.dpdReduction, OFFICER_TARGETS.dpdReduction)}`}>{o.dpdReduction} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Drill-down for selected officer */}
          {selectedOfficerId && (() => {
            const officer = computed.teamSnapshot.find(o => o.id === selectedOfficerId);
            const perf = computed.officerPerf.find(o => o.id === selectedOfficerId);
            if (!officer || !perf) return null;
            return (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-primary">Officer Drill-Down: {officer.name}</h2>
                  <button onClick={() => setSelectedOfficerId(null)} className="text-sm text-text-secondary hover:text-text-primary">{ICONS.close('w-5 h-5')}</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="panel p-3"><p className="text-xs text-text-secondary">Active Cases</p><p className="text-xl font-bold text-primary">{officer.activeCases}</p></div>
                  <div className="panel p-3"><p className="text-xs text-text-secondary">Today Collection</p><p className="text-xl font-bold text-accent">{formatCurrency(officer.todayCollection, 'AED')}</p></div>
                  <div className="panel p-3"><p className="text-xs text-text-secondary">Monthly Collection</p><p className="text-xl font-bold text-success">{formatCurrency(officer.monthlyCollection, 'AED')}</p></div>
                  <div className="panel p-3"><p className="text-xs text-text-secondary">Status</p><p className={`text-xl font-bold ${officer.isOnline ? 'text-green-400' : 'text-gray-400'}`}>{officer.isOnline ? 'Online' : 'Offline'}</p></div>
                  <div className="panel p-3"><p className="text-xs text-text-secondary">Cases Worked</p><p className="text-xl font-bold text-text-primary">{perf.casesWorked}</p></div>
                  <div className="panel p-3"><p className="text-xs text-text-secondary">Calls Made</p><p className="text-xl font-bold text-text-primary">{perf.calls}</p></div>
                  <div className="panel p-3"><p className="text-xs text-text-secondary">PTPs Secured</p><p className="text-xl font-bold text-text-primary">{perf.ptps}</p></div>
                  <div className="panel p-3"><p className="text-xs text-text-secondary">Contact Rate</p><p className="text-xl font-bold text-text-primary">{perf.contactRate}%</p></div>
                </div>
              </Card>
            );
          })()}

          {/* Team Snapshot Cards */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Team Snapshot Cards</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {computed.teamSnapshot.map(o => (
                <div key={o.id} className="panel p-4 rounded-lg flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${o.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}>
                      {o.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{o.name}</p>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${o.isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                        <span className="text-[11px] text-text-secondary">{o.isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-text-secondary">Cases</span><p className="font-bold text-text-primary">{o.activeCases}</p></div>
                    <div><span className="text-text-secondary">Today</span><p className="font-bold text-accent">{formatCurrency(o.todayCollection, 'AED')}</p></div>
                    <div className="col-span-2"><span className="text-text-secondary">Monthly</span><p className="font-bold text-success text-base">{formatCurrency(o.monthlyCollection, 'AED')}</p></div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={onOpenSendNotificationModal} className="flex-1 text-[11px] px-2 py-1.5 rounded border border-border text-text-secondary hover:bg-surface-hover transition-colors">Notify</button>
                    <button onClick={() => setSelectedOfficerId(o.id)} className="flex-1 text-[11px] px-2 py-1.5 rounded border border-primary text-primary hover:bg-primary/10 transition-colors">View Report</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: Bank Portfolio */}
      {/* ================================================================ */}
      {activeTab === 'banks' && (
        <div className="space-y-6 animate-fade-in-up">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Bank-wise Portfolio Analysis</h2>
              <span className="text-[10px] text-text-secondary italic">Exchange rates as of 1st of month</span>
            </div>
            <div className="space-y-6">
              {computed.bankAnalysis.map(b => (
                <div key={b.bank} className="panel p-5 rounded-lg">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    {/* Left: Stats */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold text-text-primary">{b.bank}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{b.currency}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-text-secondary">Total Cases</span>
                          <p className="text-lg font-bold text-text-primary">{b.totalCases}</p>
                        </div>
                        <div>
                          <span className="text-text-secondary">Active Cases</span>
                          <p className="text-lg font-bold text-primary">{b.activeCases}</p>
                        </div>
                        <div>
                          <span className="text-text-secondary">O/S ({b.currency})</span>
                          <p className="text-lg font-bold text-danger">{formatCurrency(b.outstandingOriginal, b.currency)}</p>
                        </div>
                        <div>
                          <span className="text-text-secondary">O/S (AED)</span>
                          <p className="text-lg font-bold text-text-primary">{formatCurrency(b.outstandingAED, 'AED')}</p>
                        </div>
                        <div>
                          <span className="text-text-secondary">Collected ({b.currency})</span>
                          <p className="text-lg font-bold text-success">{formatCurrency(b.collectedOriginal, b.currency)}</p>
                        </div>
                        <div>
                          <span className="text-text-secondary">Collected (AED)</span>
                          <p className="text-lg font-bold text-accent">{formatCurrency(b.collectedAED, 'AED')}</p>
                        </div>
                        <div>
                          <span className="text-text-secondary">Collection Rate</span>
                          <p className={`text-lg font-bold ${b.collectionRate >= 5 ? 'text-green-400' : 'text-red-400'}`}>{b.collectionRate}%</p>
                        </div>
                        <div>
                          <span className="text-text-secondary">Avg DPD</span>
                          <p className="text-lg font-bold text-orange-400">{b.avgDpd} days</p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Mini trend chart */}
                    <div className="w-full lg:w-64 h-32 flex-shrink-0">
                      <p className="text-[10px] text-text-secondary mb-1">6-Month Trend</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={b.miniTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} />
                          <YAxis hide />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="collected" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Collected (AED)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: Forecast */}
      {/* ================================================================ */}
      {activeTab === 'forecast' && (
        <div className="space-y-6 animate-fade-in-up">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-text-primary">Collection Forecasting (AI-Powered)</h2>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  computed.trendDirection === 'Increasing' ? 'bg-green-500/15 text-green-400' :
                  computed.trendDirection === 'Decreasing' ? 'bg-red-500/15 text-red-400' :
                  'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {computed.trendDirection === 'Increasing' ? 'Trend: Increasing' : computed.trendDirection === 'Decreasing' ? 'Trend: Decreasing' : 'Trend: Stable'}
                </span>
                <span className="text-xs text-text-secondary">Forecast Accuracy: <strong className="text-text-primary">{computed.forecastAccuracy}%</strong></span>
              </div>
            </div>
            <p className="text-xs text-text-secondary mb-4">Exponential smoothing on past 6 months. Shaded area shows confidence band (+-15%).</p>
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <ComposedChart data={computed.forecastChartData} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" className="text-xs" stroke="var(--color-text-secondary)" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" stroke="var(--color-text-secondary)" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="Upper" stroke="none" fill="var(--color-primary)" fillOpacity={0.08} name="Upper Band" />
                  <Area type="monotone" dataKey="Lower" stroke="none" fill="var(--color-background)" fillOpacity={1} name="Lower Band" />
                  <Line type="monotone" dataKey="Actual" stroke="var(--color-accent)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-accent)' }} name="Actual" connectNulls={false} />
                  <Line type="monotone" dataKey="Forecast" stroke="var(--color-primary)" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 4, fill: 'var(--color-primary)' }} name="Forecast" connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Forecast Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {computed.forecastChartData.filter(d => d.Forecast !== null).map((d, i) => (
              <Card key={i} className="p-5">
                <p className="text-xs text-text-secondary">{d.name} — Predicted</p>
                <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(d.Forecast!, 'AED')}</p>
                <div className="flex justify-between text-[11px] mt-2">
                  <span className="text-text-secondary">Optimistic: {formatCurrency(d.Upper!, 'AED')}</span>
                  <span className="text-text-secondary">Conservative: {formatCurrency(d.Lower!, 'AED')}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: Alerts */}
      {/* ================================================================ */}
      {activeTab === 'alerts' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* PTP Breaches */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-danger mb-3">PTP Breaches Today</h2>
            {computed.ptpBreachesToday.length === 0 ? (
              <p className="text-sm text-text-secondary">No PTP breaches today.</p>
            ) : (
              <div className="space-y-2">
                {computed.ptpBreachesToday.map(c => (
                  <div key={c.id} className="panel p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-text-primary">{c.debtor.name}</span>
                      <span className="text-xs text-text-secondary ml-2">({c.loan.accountNumber})</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-danger">{formatCurrency(c.loan.currentBalance, c.loan.currency)}</span>
                      <span className="text-xs text-text-secondary ml-2">Officer: {c.officer.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Zero Activity Officers */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-warning mb-3">Officers with Zero Activity Today</h2>
            {computed.zeroActivityOfficers.length === 0 ? (
              <p className="text-sm text-text-secondary">All officers have logged activity today.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {computed.zeroActivityOfficers.map(o => (
                  <div key={o.id} className="panel px-4 py-2 rounded-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold">
                      {o.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium text-text-primary">{o.name}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* High-Value Cases */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-primary mb-3">High-Value Cases Needing Attention</h2>
            {computed.highValueCases.length === 0 ? (
              <p className="text-sm text-text-secondary">No high-value cases requiring attention.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs text-text-secondary uppercase tracking-wider">
                      <th className="px-3 py-2 text-left">Debtor</th>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">Bank</th>
                      <th className="px-3 py-2 text-right">Outstanding (AED)</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Officer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {computed.highValueCases.map(c => (
                      <tr key={c.id} className="hover:bg-surface-hover">
                        <td className="px-3 py-2 font-medium text-text-primary">{c.debtor.name}</td>
                        <td className="px-3 py-2 text-text-secondary">{c.loan.accountNumber}</td>
                        <td className="px-3 py-2 text-text-secondary">{c.loan.bank}</td>
                        <td className="px-3 py-2 text-right font-bold text-danger">{formatCurrency(convertToAED(c.loan.currentBalance, c.loan.currency), 'AED')}</td>
                        <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.crmStatus}</span></td>
                        <td className="px-3 py-2 text-text-secondary">{c.officer.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Legal Deadline Cases */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-orange-400 mb-3">Cases Approaching Legal Deadline</h2>
            {computed.legalDeadlineCases.length === 0 ? (
              <p className="text-sm text-text-secondary">No cases approaching legal deadlines.</p>
            ) : (
              <div className="space-y-2">
                {computed.legalDeadlineCases.map(c => (
                  <div key={c.id} className="panel p-3 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-text-primary">{c.debtor.name}</span>
                      <span className="text-xs text-text-secondary ml-2">{c.loan.accountNumber} | {c.loan.bank}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">{c.crmStatus}</span>
                      <span className="text-sm font-semibold text-text-primary">{formatCurrency(c.loan.currentBalance, c.loan.currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: Live Attendance */}
      {/* ================================================================ */}
      {activeTab === 'attendance' && (
        <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <LiveAttendanceSection coordinators={coordinators} />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Live Attendance Section (reads from localStorage)
// ---------------------------------------------------------------------------

const ATTENDANCE_STORAGE_KEY = 'rv_attendance_v2';

interface AttendanceEntry {
  id: string;
  officerId: string;
  officerName: string;
  date: string;
  sessions: { checkIn: string; checkOut?: string; ipAddress: string; networkName: string; location?: { latitude: number; longitude: number; accuracy: number } }[];
  status: 'present' | 'late' | 'half-day' | 'absent' | 'leave';
  totalHours: number;
}

const LiveAttendanceSection: React.FC<{ coordinators: User[] }> = ({ coordinators }) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const attendance = useMemo(() => {
    let records: AttendanceEntry[] = [];
    try {
      records = JSON.parse(localStorage.getItem(ATTENDANCE_STORAGE_KEY) || '[]');
    } catch {}

    const todayRecords = records.filter(r => r.date === todayStr);

    return coordinators.map(officer => {
      const record = todayRecords.find(r => r.officerId === officer.id);
      const lastSession = record?.sessions?.[record.sessions.length - 1];
      const checkInTime = lastSession?.checkIn;
      const checkOutTime = lastSession?.checkOut;
      const location = lastSession?.location;
      const isOnline = record && !checkOutTime;

      return {
        id: officer.id,
        name: officer.name,
        agentCode: officer.agentCode || '--',
        status: record?.status || 'absent' as const,
        checkInTime,
        checkOutTime,
        totalHours: record?.totalHours || 0,
        isOnline: !!isOnline,
        location,
        ip: lastSession?.ipAddress,
        network: lastSession?.networkName,
      };
    });
  }, [coordinators, todayStr]);

  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const onLeave = attendance.filter(a => a.status === 'leave').length;
  const onlineNow = attendance.filter(a => a.isOnline).length;

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

  const statusBadge = (status: string, isOnline: boolean) => {
    if (isOnline) return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Online' };
    switch (status) {
      case 'present': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Checked Out' };
      case 'late': return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Late' };
      case 'leave': return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'On Leave' };
      default: return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Absent' };
    }
  };

  return (
    <>
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <KpiMini label="Total Officers" value={coordinators.length} />
        <KpiMini label="Present Today" value={presentCount} color="text-emerald-500" sub={`${Math.round((presentCount / coordinators.length) * 100)}%`} />
        <KpiMini label="Late Today" value={lateCount} color="text-amber-500" />
        <KpiMini label="Absent" value={absentCount} color="text-red-500" />
        <KpiMini label="Online Now" value={onlineNow} color="text-blue-500" sub={`${onLeave} on leave`} />
      </div>

      {/* Attendance Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            {ICONS.calendar('w-5 h-5')}
            Today's Attendance — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <span className="text-xs text-text-secondary">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-tertiary)]">
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Officer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Check-in</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Check-out</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Hours</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Location</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Network</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((a, idx) => {
                const badge = statusBadge(a.status, a.isOnline);
                return (
                  <tr key={a.id} className="border-t border-border hover:bg-[var(--color-bg-muted)] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-bold">
                            {a.agentCode}
                          </div>
                          {a.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--color-bg-secondary)]" />}
                        </div>
                        <span className="font-medium text-text-primary">{a.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-text-secondary">{fmtTime(a.checkInTime)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-text-secondary">{fmtTime(a.checkOutTime)}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-text-primary">{a.totalHours > 0 ? `${a.totalHours}h` : a.isOnline ? 'Active' : '--'}</td>
                    <td className="py-3 px-4 text-[11px] text-text-tertiary font-mono">
                      {a.location ? `${a.location.latitude.toFixed(3)}, ${a.location.longitude.toFixed(3)}` : '--'}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-text-tertiary">{a.network || '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
};

export default ManagerDashboard;
