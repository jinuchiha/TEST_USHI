import React, { useState, useEffect } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiClient } from '../../src/api/client';
import { User, Role } from '../../types';

interface Props { users: User[]; currentUser: User; }

const HRDashboard: React.FC<Props> = ({ users, currentUser }) => {
  const { useApi } = useAuth();
  const [snapshot, setSnapshot] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave' | 'trends'>('attendance');

  useEffect(() => {
    if (useApi) {
      apiClient.get<any>('/api/hr/attendance/today').then(r => setSnapshot(r.data)).catch(() => {});
      apiClient.get<any>('/api/hr/attendance/trends').then(r => setTrends(r.data)).catch(() => {});
      apiClient.get<any>('/api/hr/leave').then(r => setLeaveRequests(r.data || [])).catch(() => {});
    } else {
      const demoEmps = users.map(u => ({
        id: u.id, name: u.name, role: u.role,
        status: Math.random() > 0.15 ? (Math.random() > 0.85 ? 'late' : 'present') : (Math.random() > 0.5 ? 'leave' : 'absent'),
      }));
      setSnapshot({
        totalEmployees: users.length,
        present: demoEmps.filter(e => ['present','late'].includes(e.status)).length,
        absent: demoEmps.filter(e => e.status === 'absent').length,
        onLeave: demoEmps.filter(e => e.status === 'leave').length,
        late: demoEmps.filter(e => e.status === 'late').length,
        employees: demoEmps,
      });
      setTrends({
        employees: users.map(u => ({ id: u.id, name: u.name, role: u.role, attendancePct: 75+Math.floor(Math.random()*25), lateDays: Math.floor(Math.random()*6), absentDays: Math.floor(Math.random()*4), leaveDays: Math.floor(Math.random()*3), totalHours: 150+Math.floor(Math.random()*30), overtime: Math.floor(Math.random()*10), flags: Math.random() > 0.7 ? ['Frequent late'] : [] })),
        exceptions: [{ name: 'Officer Ali', issue: '5 late entries this month', severity: 'warning' }],
        weeklyTrend: [{ week: 'W1', presentPct: 92, latePct: 5 },{ week: 'W2', presentPct: 88, latePct: 8 },{ week: 'W3', presentPct: 90, latePct: 6 },{ week: 'W4', presentPct: 91, latePct: 4 }],
      });
    }
  }, [useApi, users.length]);

  const handleApprove = async (id: string, approved: boolean) => {
    if (useApi) await apiClient.patch(`/api/hr/leave/${id}/approve`, { approved }).catch(() => {});
    setLeaveRequests(p => p.map(l => l.id === id ? { ...l, status: approved ? 'approved' : 'rejected' } : l));
  };

  const sc = (s: string) => s === 'present' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : s === 'late' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : s === 'leave' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">HR & Workforce Management</h2>
        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold">Manager & CEO Only</span>
      </div>

      {snapshot && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
          {[{ l:'Total Staff', v:snapshot.totalEmployees, c:'text-text-primary' },{ l:'Present', v:snapshot.present, c:'text-emerald-600' },{ l:'Absent', v:snapshot.absent, c:'text-red-600' },{ l:'On Leave', v:snapshot.onLeave, c:'text-blue-600' },{ l:'Late', v:snapshot.late, c:'text-amber-600' }].map(k => (
            <div key={k.l} className="panel p-4 text-center"><p className={`text-2xl font-bold ${k.c} animate-count`}>{k.v}</p><p className="text-xs text-text-tertiary mt-1">{k.l}</p></div>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {[{id:'attendance' as const,l:"Today's Attendance"},{id:'trends' as const,l:'Trends & Analytics'},{id:'leave' as const,l:'Leave Management'}].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2.5 text-sm font-medium transition-all ${activeTab === t.id ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'}`}>{t.l}</button>
        ))}
      </div>

      {activeTab === 'attendance' && snapshot && (
        <div className="panel p-5 animate-fade-in">
          <table className="w-full text-sm">
            <thead><tr className="text-text-tertiary text-xs border-b border-[var(--color-border)]">
              <th className="text-left py-3 px-3">Employee</th><th className="text-left py-3 px-3">Role</th><th className="text-left py-3 px-3">Status</th>
            </tr></thead>
            <tbody>{snapshot.employees?.map((e: any) => (
              <tr key={e.id} className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-bg-tertiary)] transition">
                <td className="py-3 px-3 font-medium text-text-primary">{e.name}</td>
                <td className="py-3 px-3 text-text-secondary text-xs">{e.role}</td>
                <td className="py-3 px-3"><span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc(e.status)}`}>{e.status.charAt(0).toUpperCase()+e.status.slice(1)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {activeTab === 'trends' && trends && (
        <div className="space-y-4 animate-fade-in">
          {trends.exceptions?.length > 0 && (
            <div className="panel p-4 border-l-4 border-amber-500">
              <h3 className="text-sm font-bold text-text-primary mb-2">Exception Alerts</h3>
              {trends.exceptions.map((ex: any, i: number) => (
                <div key={i} className={`text-xs p-2 rounded mt-1 ${ex.severity === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400'}`}>
                  <span className="font-semibold">{ex.name}:</span> {ex.issue}
                </div>
              ))}
            </div>
          )}
          <div className="panel p-5">
            <h3 className="text-sm font-bold text-text-primary mb-3">Weekly Trend</h3>
            <div className="flex items-end gap-4 h-24">
              {trends.weeklyTrend?.map((w: any) => (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-emerald-600">{w.presentPct}%</span>
                  <div className="w-full bg-emerald-500 rounded-t transition-all" style={{ height: `${w.presentPct}%` }} />
                  <span className="text-[10px] text-text-tertiary">{w.week}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-5">
            <h3 className="text-sm font-bold text-text-primary mb-3">Employee Summary</h3>
            <table className="w-full text-xs">
              <thead><tr className="text-text-tertiary border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-2">Name</th><th className="text-right py-2 px-2">Attendance</th><th className="text-right py-2 px-2">Late</th><th className="text-right py-2 px-2">Absent</th><th className="text-right py-2 px-2">Hours</th><th className="text-left py-2 px-2">Flags</th>
              </tr></thead>
              <tbody>{trends.employees?.map((e: any) => (
                <tr key={e.id} className="border-b border-[var(--color-border)]/30">
                  <td className="py-2 px-2 font-medium text-text-primary">{e.name}</td>
                  <td className="py-2 px-2 text-right"><span className={`font-semibold ${e.attendancePct >= 90 ? 'text-emerald-600' : e.attendancePct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{e.attendancePct}%</span></td>
                  <td className="py-2 px-2 text-right text-text-secondary">{e.lateDays}</td>
                  <td className="py-2 px-2 text-right text-text-secondary">{e.absentDays}</td>
                  <td className="py-2 px-2 text-right text-text-secondary">{e.totalHours}h</td>
                  <td className="py-2 px-2">{e.flags?.map((f: string, i: number) => <span key={i} className="inline-block mr-1 px-1.5 py-0.5 rounded text-[9px] bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400">{f}</span>)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="animate-fade-in">
          {leaveRequests.length > 0 ? (
            <div className="panel p-5 space-y-2">
              {leaveRequests.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-sm">
                  <div>
                    <span className="font-medium text-text-primary">{l.user?.name || 'Employee'}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.type === 'sick' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{l.type}</span>
                    <p className="text-xs text-text-tertiary mt-0.5">{l.startDate} → {l.endDate} ({l.days}d) — {l.reason}</p>
                  </div>
                  {l.status === 'pending' && currentUser.role === Role.MANAGER ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(l.id, true)} className="px-3 py-1.5 text-xs btn-primary">Approve</button>
                      <button onClick={() => handleApprove(l.id, false)} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg">Reject</button>
                    </div>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{l.status}</span>
                  )}
                </div>
              ))}
            </div>
          ) : <div className="panel p-8 text-center text-text-tertiary">No leave requests</div>}
        </div>
      )}
    </div>
  );
};

export default HRDashboard;
