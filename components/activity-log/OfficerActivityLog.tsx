import React, { useState, useMemo, useEffect } from 'react';
import { EnrichedCase, User, Role, LoginRecord } from '../../types';
import { ICONS } from '../../constants';

// ── Types ────────────────────────────────────────────────────────────────────
interface DailySummary {
  userId: string;
  userName: string;
  date: string;
  firstSeen?: string;
  lastSeen?: string;
  actions: number;
  cases: number;
  isWfh: boolean;
  status: 'active' | 'offline' | 'idle';
  hoursActive: number;
}

interface OfficerActivityLogProps {
  users: User[];
  cases: EnrichedCase[];
  loginHistory: LoginRecord[];
  currentUser: User;
}

const PRESENCE_KEY = 'rv_presence';
const ONLINE_THRESHOLD_MS = 60_000;

const loadPresence = (): Record<string, any> => {
  try { return JSON.parse(localStorage.getItem(PRESENCE_KEY) || '{}'); } catch { return {}; }
};

const OfficerActivityLog: React.FC<OfficerActivityLogProps> = ({ users, cases, loginHistory, currentUser }) => {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [presence, setPresence] = useState(loadPresence);

  // Refresh live presence
  useEffect(() => {
    const refresh = () => setPresence(loadPresence());
    const h = setInterval(refresh, 15000);
    return () => clearInterval(h);
  }, []);

  // Permission check — Manager + Admin + CEO only
  if (currentUser.role === Role.OFFICER || currentUser.role === Role.FINANCE) {
    return (
      <div className="panel p-12 text-center">
        <p className="text-text-secondary">Access denied. Manager / Admin / CEO only.</p>
      </div>
    );
  }

  // ── Daily summaries: combine login history + presence + actions ──────────
  const summaries = useMemo<DailySummary[]>(() => {
    const targetDate = filterDate;

    return users
      .filter(u => u.role !== Role.ADMIN || currentUser.role === Role.ADMIN || currentUser.role === Role.CEO)
      .map(u => {
        const userLogins = loginHistory
          .filter(l => l.userId === u.id && l.timestamp.startsWith(targetDate))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        const userActions = cases.flatMap(c =>
          (c.history || []).filter(h => h.officerId === u.id && h.timestamp.startsWith(targetDate))
        );

        const userCaseIds = new Set(userActions.map(a => a.caseId));

        const firstSeen = userLogins[0]?.timestamp;
        const lastAction = userActions.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
        const lastSeen = lastAction?.timestamp || userLogins[userLogins.length - 1]?.timestamp;

        const p = presence[u.id];
        const liveAge = p?.lastActivity ? Date.now() - new Date(p.lastActivity).getTime() : Infinity;
        const isLiveToday = filterDate === new Date().toISOString().split('T')[0];
        let status: DailySummary['status'] = 'offline';
        if (isLiveToday && liveAge < ONLINE_THRESHOLD_MS) {
          status = p?.status === 'away' ? 'idle' : 'active';
        }

        let hoursActive = 0;
        if (firstSeen && lastSeen) {
          hoursActive = (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / 3600000;
        }

        return {
          userId: u.id,
          userName: u.name,
          date: targetDate,
          firstSeen,
          lastSeen,
          actions: userActions.length,
          cases: userCaseIds.size,
          isWfh: !!p?.isWfh,
          status,
          hoursActive: Math.max(0, Math.round(hoursActive * 10) / 10),
        };
      });
  }, [users, cases, loginHistory, presence, filterDate, currentUser.role]);

  const filtered = useMemo(() => {
    return summaries.filter(s => {
      if (filterUserId !== 'all' && s.userId !== filterUserId) return false;
      if (filterRole !== 'all') {
        const u = users.find(x => x.id === s.userId);
        if (u?.role !== filterRole) return false;
      }
      if (search && !s.userName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [summaries, filterUserId, filterRole, search, users]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const isToday = filterDate === today;
    return {
      totalUsers: summaries.length,
      activeNow: isToday ? summaries.filter(s => s.status === 'active').length : 0,
      idleNow: isToday ? summaries.filter(s => s.status === 'idle').length : 0,
      wfhCount: isToday ? summaries.filter(s => s.isWfh).length : 0,
      totalActions: summaries.reduce((s, x) => s + x.actions, 0),
      totalCases: summaries.reduce((s, x) => s + x.cases, 0),
      avgHours: summaries.length > 0 ? Math.round(summaries.reduce((s, x) => s + x.hoursActive, 0) / summaries.length * 10) / 10 : 0,
    };
  }, [summaries, filterDate]);

  const fmtTime = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const statusBadge = (s: DailySummary['status']) => {
    if (s === 'active') return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">● ACTIVE</span>;
    if (s === 'idle') return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">● IDLE</span>;
    return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">○ OFFLINE</span>;
  };

  // ── Per-officer activity timeline (when selected) ────────────────────────
  const [drilldownUserId, setDrilldownUserId] = useState<string | null>(null);
  const drilldownActions = useMemo(() => {
    if (!drilldownUserId) return [];
    return cases.flatMap(c => (c.history || [])
      .filter(h => h.officerId === drilldownUserId && h.timestamp.startsWith(filterDate))
      .map(h => ({ ...h, caseInfo: c })))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [drilldownUserId, cases, filterDate]);

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.team('w-7 h-7')}
            Officer Activity Log
          </h1>
          <p className="text-sm text-text-secondary mt-1">WFH tracking — kab online aaye, kya kaam kiya</p>
        </div>
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg"
        />
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Team', value: stats.totalUsers, color: 'text-text-primary' },
          { label: 'Active Now', value: stats.activeNow, color: 'text-emerald-600' },
          { label: 'Idle Now', value: stats.idleNow, color: 'text-amber-600' },
          { label: 'WFH Today', value: stats.wfhCount, color: 'text-blue-600' },
          { label: 'Total Actions', value: stats.totalActions, color: 'text-text-primary' },
          { label: 'Cases Touched', value: stats.totalCases, color: 'text-text-primary' },
          { label: 'Avg Hours', value: `${stats.avgHours}h`, color: 'text-text-primary' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search officer..." className="px-3 py-2 text-sm rounded-lg flex-1 min-w-[200px]" />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Roles</option>
          {Object.values(Role).filter(r => r !== Role.ADMIN || currentUser.role === Role.ADMIN || currentUser.role === Role.CEO).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Officer table */}
        <div className={`panel overflow-hidden ${drilldownUserId ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg-tertiary)]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Officer</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">WFH</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">First Seen</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Last Seen</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Hours</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Actions</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Cases</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 px-4 text-center text-sm text-text-secondary">No officers match filters.</td></tr>
                ) : filtered.map(s => {
                  const u = users.find(x => x.id === s.userId);
                  return (
                    <tr key={s.userId} className={`border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)] ${drilldownUserId === s.userId ? 'bg-[var(--color-primary-glow)]' : ''}`}>
                      <td className="py-3 px-4">
                        <p className="text-sm font-semibold">{s.userName}</p>
                        <p className="text-[10px] text-text-tertiary">{u?.role || ''}</p>
                      </td>
                      <td className="py-3 px-4">{statusBadge(s.status)}</td>
                      <td className="py-3 px-4">
                        {s.isWfh && s.status !== 'offline'
                          ? <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">🏠 WFH</span>
                          : <span className="text-xs text-text-tertiary">—</span>}
                      </td>
                      <td className="py-3 px-4 text-xs text-text-secondary">{fmtTime(s.firstSeen)}</td>
                      <td className="py-3 px-4 text-xs text-text-secondary">{fmtTime(s.lastSeen)}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{s.hoursActive}h</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-bold ${s.actions === 0 ? 'text-red-600' : s.actions < 5 ? 'text-amber-600' : 'text-emerald-600'}`}>{s.actions}</span>
                      </td>
                      <td className="py-3 px-4 text-xs">{s.cases}</td>
                      <td className="py-3 px-4">
                        <button onClick={() => setDrilldownUserId(drilldownUserId === s.userId ? null : s.userId)} className="px-2 py-1 text-[10px] font-semibold rounded bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                          {drilldownUserId === s.userId ? 'Close' : 'Timeline'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Drilldown timeline */}
        {drilldownUserId && (
          <div className="panel overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="p-3 border-b border-[var(--color-border)]">
              <p className="text-sm font-bold">Timeline</p>
              <p className="text-[10px] text-text-tertiary">{users.find(u => u.id === drilldownUserId)?.name} • {filterDate}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {drilldownActions.length === 0 ? (
                <p className="text-center text-xs text-text-tertiary py-8">No actions logged.</p>
              ) : drilldownActions.map(a => (
                <div key={a.id} className="text-xs border-l-2 border-[var(--color-primary)] pl-3 py-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{a.type}</span>
                    <span className="text-[10px] text-text-tertiary">{fmtTime(a.timestamp)}</span>
                  </div>
                  <p className="text-text-secondary">{a.caseInfo.debtor.name} • {a.caseInfo.loan.accountNumber}</p>
                  {a.notes && <p className="text-text-tertiary text-[11px] mt-0.5">{a.notes.slice(0, 100)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficerActivityLog;
