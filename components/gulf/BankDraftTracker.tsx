import React, { useState, useMemo } from 'react';
import { BankDraft, EnrichedCase, User, Role } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';

interface BankDraftTrackerProps {
    cases: EnrichedCase[];
    currentUser: User;
    onSelectCase: (caseId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    presented: 'bg-blue-100 text-blue-700',
    cleared: 'bg-emerald-100 text-emerald-700',
    bounced: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
    replaced: 'bg-purple-100 text-purple-700',
};

const BankDraftTracker: React.FC<BankDraftTrackerProps> = ({ cases, currentUser, onSelectCase }) => {
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('month');

    // Collect all bank drafts from cases assigned to this officer (or all for manager/CEO)
    const allDrafts = useMemo(() => {
        const relevantCases = currentUser.role === Role.OFFICER
            ? cases.filter(c => c.assignedOfficerId === currentUser.id)
            : cases;

        return relevantCases
            .flatMap(c => (c.bankDrafts || []).map(d => ({ ...d, caseData: c })))
            .sort((a, b) => new Date(a.chequeDate).getTime() - new Date(b.chequeDate).getTime());
    }, [cases, currentUser]);

    const filteredDrafts = useMemo(() => {
        let drafts = allDrafts;
        if (statusFilter !== 'all') drafts = drafts.filter(d => d.status === statusFilter);
        if (dateRange !== 'all') {
            const now = new Date();
            const cutoff = dateRange === 'week' ? 7 : 30;
            drafts = drafts.filter(d => {
                const dDate = new Date(d.chequeDate);
                const diff = Math.abs(Math.floor((dDate.getTime() - now.getTime()) / 86400000));
                return diff <= cutoff;
            });
        }
        return drafts;
    }, [allDrafts, statusFilter, dateRange]);

    // Summary stats
    const stats = useMemo(() => {
        const pending = allDrafts.filter(d => d.status === 'pending');
        const dueThisWeek = pending.filter(d => {
            const diff = Math.floor((new Date(d.chequeDate).getTime() - Date.now()) / 86400000);
            return diff >= 0 && diff <= 7;
        });
        const bounced = allDrafts.filter(d => d.status === 'bounced');
        const cleared = allDrafts.filter(d => d.status === 'cleared');
        const totalPending = pending.reduce((s, d) => s + d.amount, 0);
        const totalCleared = cleared.reduce((s, d) => s + d.amount, 0);
        const totalBounced = bounced.reduce((s, d) => s + d.amount, 0);
        return { pending: pending.length, dueThisWeek: dueThisWeek.length, bounced: bounced.length, cleared: cleared.length, totalPending, totalCleared, totalBounced };
    }, [allDrafts]);

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: '#1B2A4A' }}>Bank Drafts & Cheques</h1>
                    <p className="text-xs text-gray-400 mt-0.5">{allDrafts.length} total drafts across your portfolio</p>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="panel p-4 rounded-lg border-l-4 border-amber-400">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pending</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: '#1B2A4A' }}>{stats.pending}</p>
                    <p className="text-xs text-gray-400 mt-0.5">AED {stats.totalPending.toLocaleString()}</p>
                </div>
                <div className="panel p-4 rounded-lg border-l-4 border-blue-400">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Due This Week</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{stats.dueThisWeek}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Needs presentation</p>
                </div>
                <div className="panel p-4 rounded-lg border-l-4 border-emerald-400">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Cleared</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.cleared}</p>
                    <p className="text-xs text-gray-400 mt-0.5">AED {stats.totalCleared.toLocaleString()}</p>
                </div>
                <div className="panel p-4 rounded-lg border-l-4 border-red-400">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Bounced</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{stats.bounced}</p>
                    <p className="text-xs text-gray-400 mt-0.5">AED {stats.totalBounced.toLocaleString()}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {['all', 'pending', 'presented', 'cleared', 'bounced'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${statusFilter === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {(['week', 'month', 'all'] as const).map(r => (
                        <button key={r} onClick={() => setDateRange(r)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${dateRange === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>
                            {r === 'week' ? '7 Days' : r === 'month' ? '30 Days' : 'All Time'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Drafts Table */}
            <div className="panel rounded-lg overflow-hidden">
                <div className="overflow-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-[var(--color-bg-tertiary)]">
                                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Cheque #</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Debtor</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Bank</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Cheque Date</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Days Until</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[var(--color-border)]">
                            {filteredDrafts.length > 0 ? filteredDrafts.map(d => {
                                const daysUntil = Math.floor((new Date(d.chequeDate).getTime() - Date.now()) / 86400000);
                                const isOverdue = daysUntil < 0 && d.status === 'pending';
                                return (
                                    <tr key={d.id} className="hover:bg-gray-50/50 dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition" onClick={() => onSelectCase(d.caseId)}>
                                        <td className="px-4 py-3 text-xs font-mono font-semibold" style={{ color: '#1B2A4A' }}>{d.chequeNumber}</td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-semibold text-gray-800">{d.debtorName}</p>
                                            <p className="text-[10px] text-gray-400">{d.accountNumber}</p>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600">{d.drawerBank}</td>
                                        <td className="px-4 py-3 text-xs font-bold" style={{ color: '#1B2A4A' }}>{d.currency} {d.amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-xs text-gray-600">{formatDate(d.chequeDate)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-bold ${isOverdue ? 'text-red-600' : daysUntil <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                                                {isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'TODAY' : `${daysUntil}d`}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-500'}`}>
                                                {d.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-gray-400 max-w-[200px] truncate">{d.notes || '—'}</td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center">
                                        <p className="text-gray-300 text-sm">No bank drafts found</p>
                                        <p className="text-gray-300 text-xs mt-1">Drafts will appear here when added to cases</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BankDraftTracker;
