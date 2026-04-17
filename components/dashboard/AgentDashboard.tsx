import React, { useMemo, useState, useEffect } from 'react';
import { EnrichedCase, User, CRMStatus, ActionType } from '../../types';
import { formatCurrency, convertToAED } from '../../utils';
import KpiCard from '../shared/KpiCard';
import PtpCasesList from './TopPtpCases';
import { ICONS } from '../../constants';
import Card from '../shared/Card';
import Avatar from '../shared/Avatar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { generateDailyBrief } from '../../src/ai/brain';

const COMMISSION_THRESHOLD = 30000; // AED — must collect this before commission unlocks
const COMMISSION_RATE = 0.0075; // 0.75% of all collections, earned only after target hit

interface CallbackItem {
    id: string;
    caseId: string;
    debtorName: string;
    officerId: string;
    callbackTime: string;
    note: string;
}

interface AgentDashboardProps {
  currentUser: User;
  allCases: EnrichedCase[];
  onSelectCase: (caseId: string) => void;
}

const Greeting: React.FC<{ name: string }> = ({ name }) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    const getGreeting = () => {
        const hour = time.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const dateString = time.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div>
            <h1 className="text-base font-bold text-[var(--color-text-primary)]">{getGreeting()}, <span className="text-[var(--color-text-accent)]">{name.split(' ')[0]}</span></h1>
            <p className="text-xs text-[var(--color-text-tertiary)]">{dateString}</p>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="panel p-2 rounded-md shadow-lg border-border !bg-background">
        <p className="label text-sm text-text-primary font-bold">{`Day ${label}`}</p>
        <p className="intro text-sm text-primary">{`Collected : ${formatCurrency(payload[0].value, 'AED')}`}</p>
      </div>
    );
  }
  return null;
};

const COLORS = ['#3B82F6', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

const AgentDashboard: React.FC<AgentDashboardProps> = ({ currentUser, allCases, onSelectCase }) => {

    const agentStats = useMemo(() => {
        const agentCases = allCases.filter(c => c.assignedOfficerId === currentUser.id);
        const activeAgentCases = agentCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
        const now = new Date();
        const todayString = now.toISOString().split('T')[0];
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayString = yesterday.toISOString().split('T')[0];
        
        const allAgentHistory = agentCases.flatMap(c => c.history.map(h => ({ ...h, currency: c.loan.currency, caseId: c.id, contactStatus: c.contactStatus })));

        // Today's stats
        const todayHistory = allAgentHistory.filter(h => (h.attributionDate || h.timestamp).startsWith(todayString));
        const doeToday = new Set(todayHistory.map(h => h.caseId)).size;
        const totalCallsToday = todayHistory.filter(h => h.type === ActionType.SOFT_CALL).length;
        const paidToday = todayHistory
            .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid)
            .reduce((sum, h) => sum + convertToAED(h.amountPaid!, h.currency), 0);
        const ptpsSetToday = new Set(
            agentCases.flatMap(c => c.auditLog)
                .filter(log => log.details.includes("Status changed to PTP") && log.timestamp.startsWith(todayString) && log.userId === currentUser.id)
                .map(log => log.caseId)
        ).size;
        
        const generationToday = agentCases
            .filter(c => c.creationDate.startsWith(todayString))
            .reduce((sum, c) => sum + convertToAED(c.loan.currentBalance, c.loan.currency), 0);


        // Yesterday's stats
        const yesterdayHistory = allAgentHistory.filter(h => (h.attributionDate || h.timestamp).startsWith(yesterdayString));
        const doeYesterday = new Set(yesterdayHistory.map(h => h.caseId)).size;
        const callsYesterday = yesterdayHistory.filter(h => h.type === ActionType.SOFT_CALL).length;
        const paidYesterday = yesterdayHistory
            .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid)
            .reduce((sum, h) => sum + convertToAED(h.amountPaid!, h.currency), 0);
        const yesterdaysPTPs = new Set(
            agentCases.flatMap(c => c.auditLog)
                .filter(log => log.details.includes("Status changed to PTP") && log.timestamp.startsWith(yesterdayString) && log.userId === currentUser.id)
                .map(log => log.caseId)
        ).size;
        
        const calculateTrend = (todayVal: number, yesterdayVal: number) => {
            const change = todayVal - yesterdayVal;
            if (Math.abs(change) < 0.01) return { value: '0%', direction: 'neutral' as const };
            if (yesterdayVal === 0) {
                 return { value: 'New', direction: 'up' as const };
            }
            const percentChange = (change / yesterdayVal) * 100;
            return {
                value: `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(0)}%`,
                direction: percentChange > 0 ? 'up' as const : 'down' as const,
            };
        };

        const monthlyHistory = allAgentHistory.filter(h => new Date(h.attributionDate || h.timestamp) >= firstDayOfMonth);

        const monthlyCollections = monthlyHistory
            .filter(h => h.amountPaid)
            .reduce((sum, h) => sum + convertToAED(h.amountPaid || 0, h.currency), 0);
        
        const monthlyTouchedSet = new Set(monthlyHistory.map(h => h.caseId));
        const monthlyContactedSet = new Set(monthlyHistory.filter(h => h.contactStatus === 'Contact').map(h => h.caseId));
        // Fix: Explicitly cast Set.size properties to Number to resolve a potential arithmetic operation error.
        const contactRate = monthlyTouchedSet.size > 0 ? (Number(monthlyContactedSet.size) / Number(monthlyTouchedSet.size)) * 100 : 0;
        
        const monthlyTrendData = Array.from({ length: now.getDate() }, (_, i) => {
            const day = i + 1;
            const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dailyTotal = monthlyHistory
                .filter(p => p.amountPaid && (p.attributionDate || p.timestamp).startsWith(dateString))
                .reduce((sum: number, p) => sum + convertToAED(p.amountPaid!, p.currency), 0);
            return { name: day, Collected: dailyTotal };
        });
            
        return {
            activeAgentCases,
            monthlyCollections,
            ptpCases: agentCases.filter(c => c.crmStatus === CRMStatus.PTP),
            monthlyTrendData,
            doeToday,
            totalCallsToday,
            ptpsSetToday,
            paidToday,
            generationToday,
            contactRate: `${contactRate.toFixed(1)}%`,
            doeTrend: calculateTrend(doeToday, doeYesterday),
            callsTrend: calculateTrend(totalCallsToday, callsYesterday),
            ptpsTrend: calculateTrend(ptpsSetToday, yesterdaysPTPs),
            paidTrend: calculateTrend(paidToday, paidYesterday),
        };
    }, [allCases, currentUser]);

    const bankBreakdown = useMemo(() => {
        if (!agentStats) return [];
        const counts = agentStats.activeAgentCases.reduce((acc, c) => {
            const bank = c.loan.bank;
            acc[bank] = (acc[bank] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const MAX_SLICES = 6;
        const sortedData = Object.entries(counts).map(([name, value]) => ({ name, value: value as number })).sort((a, b) => b.value - a.value);

        if (sortedData.length <= MAX_SLICES) {
            return sortedData;
        }

        const mainData = sortedData.slice(0, MAX_SLICES - 1);
        const otherValue = sortedData.slice(MAX_SLICES - 1).reduce((acc, curr) => acc + (curr.value as number), 0);

        mainData.push({ name: 'Other', value: otherValue });
        return mainData;
    }, [agentStats]);


    const targetProgress = currentUser.dailyTarget && currentUser.dailyTarget > 0
        ? Math.min(100, Math.round((agentStats.paidToday / currentUser.dailyTarget) * 100))
        : 0;

    const dailyBrief = useMemo(() => generateDailyBrief(currentUser, allCases, [currentUser]), [currentUser, allCases]);

    // Commission with 30K threshold
    const commissionData = useMemo(() => {
        const threshold = currentUser.target || COMMISSION_THRESHOLD;
        const collected = agentStats.monthlyCollections;
        const progress = Math.min(100, (collected / threshold) * 100);
        const unlocked = collected >= threshold;
        const earned = unlocked ? collected * COMMISSION_RATE : 0;
        const remaining = Math.max(0, threshold - collected);
        return { threshold, progress, unlocked, earned, remaining };
    }, [agentStats.monthlyCollections, currentUser.target]);

    // Monthly Target & DRR Tracker data
    const monthlyDrrData = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const currentYYYYMM = `${year}-${String(month + 1).padStart(2, '0')}`;

        // Total active cases for this officer
        const totalActive = agentStats.activeAgentCases.length;

        // Cases attempted this month: cases with at least 1 history entry this month
        const agentCases = allCases.filter(c => c.assignedOfficerId === currentUser.id);
        const allAgentHistory = agentCases.flatMap(c => c.history.map(h => ({ ...h, caseId: c.id, currency: c.loan.currency })));
        const monthlyHistory = allAgentHistory.filter(h => (h.attributionDate || h.timestamp).startsWith(currentYYYYMM));
        const casesAttempted = new Set(monthlyHistory.map(h => h.caseId)).size;
        const remaining = Math.max(0, totalActive - casesAttempted);

        // Working days left this month (Mon-Fri, excluding today)
        const lastDay = new Date(year, month + 1, 0).getDate();
        let workingDaysLeft = 0;
        for (let d = now.getDate() + 1; d <= lastDay; d++) {
            const day = new Date(year, month, d).getDay();
            if (day !== 0 && day !== 6) workingDaysLeft++;
        }
        // Include today if before 5pm
        if (now.getHours() < 17) {
            const todayDay = now.getDay();
            if (todayDay !== 0 && todayDay !== 6) workingDaysLeft++;
        }
        if (workingDaysLeft === 0) workingDaysLeft = 1; // avoid division by zero

        const requiredDrr = Math.ceil(remaining / workingDaysLeft);
        const attemptPct = totalActive > 0 ? Math.round((casesAttempted / totalActive) * 100) : 0;

        // Monthly collection target vs actual
        const collectionTarget = currentUser.target || 30000;
        const collectedThisMonth = monthlyHistory
            .filter(h => h.amountPaid)
            .reduce((sum, h) => sum + convertToAED(h.amountPaid || 0, h.currency), 0);
        const collectionPct = collectionTarget > 0 ? Math.min(100, Math.round((collectedThisMonth / collectionTarget) * 100)) : 0;
        const collectionRemaining = Math.max(0, collectionTarget - collectedThisMonth);
        const dailyCollectionDrr = collectionRemaining / workingDaysLeft;

        return {
            totalActive,
            casesAttempted,
            remaining,
            workingDaysLeft,
            requiredDrr,
            attemptPct,
            collectionTarget,
            collectedThisMonth,
            collectionPct,
            collectionRemaining,
            dailyCollectionDrr,
        };
    }, [allCases, currentUser, agentStats.activeAgentCases]);

    // PTP alerts: due today and overdue
    const ptpAlerts = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const agentPtpCases = allCases.filter(c =>
            c.assignedOfficerId === currentUser.id && c.crmStatus === CRMStatus.PTP
        );
        const dueToday = agentPtpCases.filter(c => {
            const a = c.history.find(h => h.promisedDate);
            return a?.promisedDate === todayStr;
        });
        const overdue = agentPtpCases.filter(c => {
            const a = c.history.find(h => h.promisedDate);
            return a?.promisedDate && a.promisedDate < todayStr;
        });
        return { dueToday, overdue };
    }, [allCases, currentUser.id]);

    // Callbacks from localStorage
    const [callbacks] = useState<CallbackItem[]>(() => {
        try { const s = localStorage.getItem('rv_callbacks'); return s ? JSON.parse(s) : []; } catch { return []; }
    });
    const myCallbacks = useMemo(() => {
        const cutoff = new Date(Date.now() - 3600000);
        return callbacks
            .filter(cb => cb.officerId === currentUser.id && new Date(cb.callbackTime) > cutoff)
            .sort((a, b) => new Date(a.callbackTime).getTime() - new Date(b.callbackTime).getTime())
            .slice(0, 3);
    }, [callbacks, currentUser.id]);

    const showEOD = useMemo(() => new Date().getHours() >= 17, []);

    return (
        <div className="p-3 md:p-5 min-h-full space-y-4">
            {/* === HERO — Clean white card with accent stripe === */}
            <div className="panel rounded-xl overflow-hidden">
                <div className="h-1" style={{ background: 'linear-gradient(90deg, #1B2A4A 0%, #F28C28 50%, #1B2A4A 100%)' }} />
                <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))' }}>
                            {currentUser.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        <div>
                            <Greeting name={currentUser.name} />
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {currentUser.agentCode && <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-accent)' }}>{currentUser.agentCode}</span>}
                                <span className="text-[var(--color-text-secondary)] text-xs">{agentStats.activeAgentCases.length} active cases</span>
                                <span className="text-[var(--color-text-tertiary)]">·</span>
                                <span className="text-[var(--color-text-secondary)] text-xs">Target: <strong className="text-[var(--color-text-accent)]">{currentUser.target ? formatCurrency(currentUser.target, 'AED') : 'N/A'}</strong></span>
                            </div>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                        <div className="text-center">
                            <p className="text-xl font-extrabold text-[var(--color-text-accent)]">{agentStats.doeToday}</p>
                            <p className="text-[var(--color-text-tertiary)] text-[10px] uppercase tracking-wider font-medium">Worked</p>
                        </div>
                        <div className="w-px h-10 bg-[var(--color-border)]" />
                        <div className="text-center">
                            <p className="text-xl font-extrabold text-sky-500">{agentStats.totalCallsToday}</p>
                            <p className="text-[var(--color-text-tertiary)] text-[10px] uppercase tracking-wider font-medium">Calls</p>
                        </div>
                        <div className="w-px h-10 bg-[var(--color-border)]" />
                        <div className="text-center">
                            <p className={`text-xl font-extrabold ${agentStats.paidToday > 0 ? 'text-emerald-500' : 'text-[var(--color-text-tertiary)]'}`}>{formatCurrency(agentStats.paidToday, 'AED')}</p>
                            <p className="text-[var(--color-text-tertiary)] text-[10px] uppercase tracking-wider font-medium">Collected</p>
                        </div>
                    </div>
                </div>
                {currentUser.dailyTarget && currentUser.dailyTarget > 0 && (
                    <div className="px-5 pb-3">
                        <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-[var(--color-text-tertiary)] font-medium">Daily Target Progress</span>
                            <span className="font-bold" style={{ color: targetProgress >= 100 ? '#16A34A' : '#F28C28' }}>{targetProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full animate-progress" style={{ width: `${targetProgress}%`, background: targetProgress >= 100 ? '#16A34A' : targetProgress >= 50 ? '#F28C28' : '#1B2A4A' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* === PTP ALERT BANNER === */}
            {(ptpAlerts.dueToday.length > 0 || ptpAlerts.overdue.length > 0) && (
                <div className="panel rounded-xl overflow-hidden border-l-4" style={{ borderLeftColor: ptpAlerts.overdue.length > 0 ? '#DC2626' : '#F28C28' }}>
                    <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                        <svg className={`w-4 h-4 shrink-0 ${ptpAlerts.overdue.length > 0 ? 'text-red-500' : 'text-orange-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                        {ptpAlerts.overdue.length > 0 && (
                            <span className="text-xs font-bold text-red-500">{ptpAlerts.overdue.length} OVERDUE PTP{ptpAlerts.overdue.length > 1 ? 's' : ''}</span>
                        )}
                        {ptpAlerts.dueToday.length > 0 && (
                            <span className="text-xs font-semibold text-orange-500">{ptpAlerts.dueToday.length} PTP{ptpAlerts.dueToday.length > 1 ? 's' : ''} due TODAY</span>
                        )}
                        <div className="flex flex-wrap gap-2 ml-2">
                            {[...ptpAlerts.overdue.slice(0, 2), ...ptpAlerts.dueToday.slice(0, 2)].map(c => (
                                <button key={c.id} onClick={() => onSelectCase(c.id)}
                                    className="text-[11px] px-2 py-0.5 rounded-md font-medium hover:underline transition"
                                    style={{ color: ptpAlerts.overdue.includes(c) ? 'var(--color-danger)' : 'var(--color-accent)', background: ptpAlerts.overdue.includes(c) ? 'rgba(220,38,38,0.08)' : 'rgba(242,140,40,0.08)' }}>
                                    {c.debtor.name} · {formatCurrency(c.loan.currentBalance, c.loan.currency)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* === AI DAILY BRIEF === */}
            <div className="panel rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md" style={{ background: 'rgba(242,140,40,0.1)', color: '#F28C28', border: '1px solid rgba(242,140,40,0.15)' }}>AI Brief</span>
                            <span className="text-[11px] text-[var(--color-text-secondary)] truncate">{dailyBrief.todayFocus}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {dailyBrief.urgentItems.map((item, i) => (
                                <span key={i} className={`text-[11px] px-2.5 py-1 rounded-lg ${i === 0 ? 'font-semibold' : ''}`}
                                    style={{ background: i === 0 ? 'rgba(220,38,38,0.06)' : 'var(--color-bg-tertiary)', color: i === 0 ? '#B91C1C' : 'var(--color-text-secondary)' }}>
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] italic max-w-[180px] text-right hidden lg:block leading-relaxed">{dailyBrief.motivationalNote}</p>
                </div>
            </div>

            {/* === KPI STRIP — 6 cards with colored top accents === */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
                {[
                    { label: 'Cases Worked', value: agentStats.doeToday, trend: agentStats.doeTrend, accent: 'var(--color-text-accent)', bar: 'var(--color-primary)' },
                    { label: 'Calls Made', value: agentStats.totalCallsToday, trend: agentStats.callsTrend, accent: '#38BDF8', bar: '#0284C7' },
                    { label: 'PTPs Created', value: agentStats.ptpsSetToday, trend: agentStats.ptpsTrend, accent: '#FBBF24', bar: '#D97706' },
                    { label: 'Collected', value: formatCurrency(agentStats.paidToday, 'AED'), trend: agentStats.paidTrend, accent: '#34D399', bar: '#16A34A' },
                    { label: 'Active Cases', value: agentStats.activeAgentCases.length, trend: null, accent: '#A78BFA', bar: '#7C3AED' },
                    { label: 'Contact Rate', value: agentStats.contactRate, trend: null, accent: '#2DD4BF', bar: '#0D9488' },
                ].map(kpi => (
                    <div key={kpi.label} className="panel rounded-xl overflow-hidden">
                        <div className="h-0.5" style={{ background: kpi.bar }} />
                        <div className="p-3">
                            <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider font-medium">{kpi.label}</p>
                            <p className="text-lg font-extrabold mt-0.5" style={{ color: kpi.accent }}>{kpi.value}</p>
                            {kpi.trend ? (
                                <p className={`text-[10px] mt-0.5 font-medium ${kpi.trend.direction === 'up' ? 'text-emerald-500' : kpi.trend.direction === 'down' ? 'text-red-400' : 'text-[var(--color-text-tertiary)]'}`}>
                                    {kpi.trend.direction === 'up' ? '↑' : kpi.trend.direction === 'down' ? '↓' : '→'} {kpi.trend.value} vs yesterday
                                </p>
                            ) : (
                                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{kpi.label === 'Active Cases' ? 'Total portfolio' : 'Month to date'}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* === MONTHLY TARGET & DRR TRACKER === */}
            <div className="panel rounded-xl p-4 border-l-4" style={{ borderLeftColor: 'var(--color-primary)' }}>
                <div className="flex items-center gap-2 mb-4">
                    <svg className="w-4 h-4 text-[var(--color-text-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Monthly Target & DRR Tracker</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold ml-auto" style={{ background: 'var(--color-primary-glow)', color: 'var(--color-text-accent)' }}>
                        {monthlyDrrData.workingDaysLeft} working day{monthlyDrrData.workingDaysLeft !== 1 ? 's' : ''} left
                    </span>
                </div>

                {/* Summary Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="text-center p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                        <p className="text-lg font-bold text-[var(--color-text-primary)]">{monthlyDrrData.totalActive}</p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)]">Total Active Cases</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                        <p className="text-lg font-bold text-sky-600">{monthlyDrrData.casesAttempted}</p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)]">Attempted This Month</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                        <p className={`text-lg font-bold ${monthlyDrrData.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{monthlyDrrData.remaining}</p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)]">Remaining to Attempt</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                        <p className="text-lg font-bold text-[var(--color-text-accent)]">{monthlyDrrData.workingDaysLeft}</p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)]">Working Days Left</p>
                    </div>
                </div>

                {/* Daily Run Rate (DRR) */}
                <div className={`rounded-lg p-3 mb-4 border ${monthlyDrrData.requiredDrr > 40 ? 'border-red-400/30 bg-red-500/5' : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <svg className={`w-4 h-4 ${monthlyDrrData.requiredDrr > 40 ? 'text-red-500' : 'text-[#1B2A4A]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4l2.5 2.5" /></svg>
                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">Daily Run Rate (DRR)</span>
                        </div>
                        <span className={`text-xl font-bold ${monthlyDrrData.requiredDrr > 40 ? 'text-red-400' : ''}`} style={monthlyDrrData.requiredDrr <= 40 ? { color: 'var(--color-accent)' } : undefined}>
                            {monthlyDrrData.requiredDrr} cases/day
                        </span>
                    </div>
                    <p className={`text-[11px] mb-2 ${monthlyDrrData.requiredDrr > 40 ? 'text-red-400 font-semibold' : 'text-[var(--color-text-secondary)]'}`}>
                        {monthlyDrrData.remaining === 0
                            ? 'All active cases have been attempted this month!'
                            : monthlyDrrData.requiredDrr > 40
                                ? `Warning: You must attempt ${monthlyDrrData.requiredDrr} cases/day to cover all active cases. Consider prioritizing high-value accounts.`
                                : `You must attempt ${monthlyDrrData.requiredDrr} cases/day to hit your target.`
                        }
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden border border-[var(--color-border)]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${monthlyDrrData.attemptPct}%`, background: monthlyDrrData.attemptPct >= 80 ? 'var(--color-success)' : monthlyDrrData.attemptPct >= 50 ? 'var(--color-accent)' : 'var(--color-primary)' }} />
                        </div>
                        <span className="text-[11px] font-bold text-[var(--color-text-primary)] min-w-[40px] text-right">{monthlyDrrData.attemptPct}%</span>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">Cases Attempted vs Total Active</p>
                </div>

                {/* Monthly Collection Target vs Actual */}
                <div className="rounded-lg p-3 border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" style={{ color: '#16A34A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">Monthly Collection Target</span>
                        </div>
                        <span className="text-[11px] text-[var(--color-text-secondary)]">
                            {formatCurrency(monthlyDrrData.collectedThisMonth, 'AED')} / {formatCurrency(monthlyDrrData.collectionTarget, 'AED')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden border border-[var(--color-border)]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${monthlyDrrData.collectionPct}%`, background: monthlyDrrData.collectionPct >= 100 ? 'var(--color-success)' : monthlyDrrData.collectionPct >= 60 ? 'var(--color-accent)' : 'var(--color-primary)' }} />
                        </div>
                        <span className="text-[11px] font-bold text-[var(--color-text-primary)] min-w-[40px] text-right">{monthlyDrrData.collectionPct}%</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-[var(--color-text-tertiary)]">
                            Remaining: <strong style={{ color: 'var(--color-accent)' }}>{formatCurrency(monthlyDrrData.collectionRemaining, 'AED')}</strong>
                        </p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)]">
                            Daily collection DRR: <strong className="text-[var(--color-text-accent)]">{formatCurrency(monthlyDrrData.dailyCollectionDrr, 'AED')}/day</strong>
                        </p>
                    </div>
                </div>
            </div>

            {/* === COMMISSION TRACKER + CALLBACKS === */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Commission Tracker */}
                <div className="panel rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" style={{ color: '#16A34A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Commission Tracker</h3>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${commissionData.unlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {commissionData.unlocked ? 'UNLOCKED' : 'LOCKED'}
                        </span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <p className={`text-xl font-bold ${commissionData.unlocked ? 'text-emerald-600' : 'text-[var(--color-text-tertiary)]'}`}>
                                {formatCurrency(commissionData.earned, 'AED')}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-tertiary)]">Earned this month</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold">{formatCurrency(agentStats.monthlyCollections, 'AED')}</p>
                            <p className="text-[11px] text-[var(--color-text-tertiary)]">collected of {formatCurrency(commissionData.threshold, 'AED')}</p>
                        </div>
                    </div>
                    <div className="h-2.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${commissionData.unlocked ? 'bg-emerald-500' : 'bg-orange-400'}`}
                            style={{ width: `${commissionData.progress}%` }} />
                    </div>
                    <p className="text-[10px] mt-1.5">
                        {commissionData.unlocked
                            ? <span className="text-emerald-600 font-medium">Target achieved — 0.75% commission on all collections</span>
                            : <span className="text-[var(--color-text-tertiary)]">Collect <strong className="text-orange-500">{formatCurrency(commissionData.remaining, 'AED')}</strong> more to unlock 0.75% commission</span>
                        }
                    </p>
                </div>

                {/* Callbacks + Upcoming */}
                <div className="panel rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Today's Callbacks</h3>
                        {myCallbacks.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">{myCallbacks.length}</span>}
                    </div>
                    {myCallbacks.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-[11px] text-[var(--color-text-tertiary)]">No callbacks scheduled</p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">Set callbacks from case detail view</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {myCallbacks.map(cb => {
                                const cbTime = new Date(cb.callbackTime);
                                const isPast = cbTime < new Date();
                                return (
                                    <div key={cb.id} className={`flex items-center gap-2 p-2 rounded-lg ${isPast ? 'bg-red-50 border border-red-100' : 'bg-[var(--color-bg-tertiary)]'}`}>
                                        <span className={`inline-block w-2 h-2 rounded-full ${isPast ? 'bg-red-500' : 'bg-blue-500'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-semibold text-[var(--color-text-primary)] truncate">{cb.debtorName}</p>
                                            <p className="text-[10px] text-[var(--color-text-tertiary)]">{cb.note || 'Callback'}</p>
                                        </div>
                                        <p className={`text-[10px] font-mono font-bold whitespace-nowrap ${isPast ? 'text-red-600' : 'text-[var(--color-accent)]'}`}>
                                            {cbTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <button onClick={() => onSelectCase(cb.caseId)}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)] text-white font-bold">Open</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* === MAIN CONTENT: Chart + Bank + PTP === */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Collections Trend — 5 cols */}
                <div className="lg:col-span-5 panel p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Monthly Collections</h3>
                    <div style={{ width: '100%', height: 180 }}>
                        <ResponsiveContainer>
                            <AreaChart data={agentStats.monthlyTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="agentCollect" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#16A34A" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--color-text-tertiary)" tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-tertiary)" tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="Collected" stroke="#16A34A" strokeWidth={2} fillOpacity={1} fill="url(#agentCollect)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--color-border)]">
                        <span className="text-[11px] text-[var(--color-text-secondary)]">Monthly Total</span>
                        <span className="text-sm font-bold text-emerald-600">{formatCurrency(agentStats.monthlyCollections, 'AED')}</span>
                    </div>
                </div>

                {/* Portfolio by Bank — 3 cols */}
                <div className="lg:col-span-3 panel p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Portfolio by Bank</h3>
                    <div style={{ width: '100%', height: 180 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={bankBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={55} fill="#8884d8" paddingAngle={3}>
                                    {bankBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % Number(COLORS.length)]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontSize: '12px' }}/>
                                <Legend iconSize={8} wrapperStyle={{fontSize: '10px', color: 'var(--color-text-secondary)'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* PTP Cases — 4 cols */}
                <div className="lg:col-span-4">
                    <PtpCasesList ptpCases={agentStats.ptpCases} onSelectCase={onSelectCase} />
                </div>
            </div>

            {/* === END-OF-DAY SUMMARY (shown after 5pm) === */}
            {showEOD && (
                <div className="panel rounded-lg p-4 border-2 border-dashed border-[var(--color-accent)]/30">
                    <div className="flex items-center gap-2 mb-3">
                        <span>🌙</span>
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">End of Day Summary</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold ml-auto">EOD</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="text-center p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
                            <p className="text-lg font-bold text-[var(--color-text-primary)]">{agentStats.doeToday}</p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)]">Cases Worked</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
                            <p className="text-lg font-bold text-sky-600">{agentStats.totalCallsToday}</p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)]">Calls Made</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
                            <p className="text-lg font-bold text-amber-600">{agentStats.ptpsSetToday}</p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)]">PTPs Set</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(agentStats.paidToday, 'AED')}</p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)]">Collected</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                            📊 Today's commission contribution: <strong className="text-[var(--color-accent)]">{formatCurrency(agentStats.paidToday * COMMISSION_RATE, 'AED')}</strong>
                            {!commissionData.unlocked && <span className="text-[var(--color-text-tertiary)]"> (pending target unlock)</span>}
                        </p>
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">Great work today! 💪</span>
                    </div>
                </div>
            )}
        </div>
    )
}
export default AgentDashboard;