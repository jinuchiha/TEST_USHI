import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, ActionType } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';

// ── Types ────────────────────────────────────────────────────────────────────
type Disposition = 'Answered' | 'Busy' | 'No Answer' | 'Voicemail' | 'Wrong Number' | 'Disconnected' | 'Call Back' | 'Refused' | 'Promise to Pay';
type CallOutcome = 'Positive' | 'Neutral' | 'Negative';

interface CallLog {
  id: string;
  caseId: string;
  officerId: string;
  officerName: string;
  disposition: Disposition;
  outcome: CallOutcome;
  duration: number; // seconds
  phoneUsed: string;
  notes: string;
  timestamp: string;
  followUpDate?: string;
  promisedAmount?: number;
}

interface CallDispositionLoggerProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

// ── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'rv_call_logs';
const load = (): CallLog[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const save = (d: CallLog[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };

const DISPOSITIONS: { value: Disposition; icon: string; outcome: CallOutcome; color: string }[] = [
  { value: 'Answered', icon: '✓', outcome: 'Positive', color: 'bg-emerald-500' },
  { value: 'Promise to Pay', icon: '$', outcome: 'Positive', color: 'bg-blue-500' },
  { value: 'Call Back', icon: '↩', outcome: 'Neutral', color: 'bg-amber-500' },
  { value: 'Busy', icon: '⏳', outcome: 'Neutral', color: 'bg-orange-500' },
  { value: 'No Answer', icon: '✕', outcome: 'Negative', color: 'bg-gray-500' },
  { value: 'Voicemail', icon: '✉', outcome: 'Neutral', color: 'bg-purple-500' },
  { value: 'Wrong Number', icon: '?', outcome: 'Negative', color: 'bg-red-400' },
  { value: 'Disconnected', icon: '⊘', outcome: 'Negative', color: 'bg-red-600' },
  { value: 'Refused', icon: '✋', outcome: 'Negative', color: 'bg-red-500' },
];

// ── Component ────────────────────────────────────────────────────────────────
const CallDispositionLogger: React.FC<CallDispositionLoggerProps> = ({ cases, currentUser, onSelectCase }) => {
  const [callLogs, setCallLogs] = useState<CallLog[]>(load);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedDisposition, setSelectedDisposition] = useState<Disposition | null>(null);
  const [callDuration, setCallDuration] = useState('');
  const [phoneUsed, setPhoneUsed] = useState('Primary');
  const [callNotes, setCallNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [promisedAmount, setPromisedAmount] = useState('');

  // Filter
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const myCases = useMemo(() => cases.filter(c => c.assignedOfficerId === currentUser.id), [cases, currentUser.id]);
  const selectedCase = useMemo(() => cases.find(c => c.id === selectedCaseId), [cases, selectedCaseId]);

  const todayLogs = useMemo(() => {
    return callLogs.filter(l => l.officerId === currentUser.id && l.timestamp.startsWith(filterDate)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [callLogs, currentUser.id, filterDate]);

  const stats = useMemo(() => {
    const today = callLogs.filter(l => l.officerId === currentUser.id && l.timestamp.startsWith(filterDate));
    return {
      totalCalls: today.length,
      answered: today.filter(l => l.disposition === 'Answered').length,
      ptp: today.filter(l => l.disposition === 'Promise to Pay').length,
      noAnswer: today.filter(l => l.disposition === 'No Answer').length,
      refused: today.filter(l => l.disposition === 'Refused').length,
      avgDuration: today.length > 0 ? Math.round(today.reduce((s, l) => s + l.duration, 0) / today.length) : 0,
      contactRate: today.length > 0 ? Math.round((today.filter(l => ['Answered', 'Promise to Pay', 'Call Back', 'Refused'].includes(l.disposition)).length / today.length) * 100) : 0,
    };
  }, [callLogs, currentUser.id, filterDate]);

  const handleLog = () => {
    if (!selectedCaseId || !selectedDisposition || !callDuration) return;
    const disp = DISPOSITIONS.find(d => d.value === selectedDisposition)!;
    const newLog: CallLog = {
      id: `call-${Date.now()}`,
      caseId: selectedCaseId,
      officerId: currentUser.id,
      officerName: currentUser.name,
      disposition: selectedDisposition,
      outcome: disp.outcome,
      duration: parseInt(callDuration) || 0,
      phoneUsed,
      notes: callNotes,
      timestamp: new Date().toISOString(),
      followUpDate: followUpDate || undefined,
      promisedAmount: promisedAmount ? parseFloat(promisedAmount) : undefined,
    };
    const updated = [newLog, ...callLogs];
    setCallLogs(updated);
    save(updated);
    // Reset
    setSelectedCaseId(''); setSelectedDisposition(null); setCallDuration(''); setCallNotes(''); setFollowUpDate(''); setPromisedAmount('');
  };

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
            Call Disposition Logger
          </h1>
          <p className="text-sm text-text-secondary mt-1">Log call outcomes quickly after each debtor call</p>
        </div>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Calls', value: stats.totalCalls, color: '' },
          { label: 'Answered', value: stats.answered, color: 'text-emerald-600' },
          { label: 'PTP', value: stats.ptp, color: 'text-blue-600' },
          { label: 'No Answer', value: stats.noAnswer, color: 'text-gray-500' },
          { label: 'Refused', value: stats.refused, color: 'text-red-600' },
          { label: 'Avg Duration', value: `${stats.avgDuration}s`, color: 'text-text-primary' },
          { label: 'Contact Rate', value: `${stats.contactRate}%`, color: stats.contactRate >= 40 ? 'text-emerald-600' : 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Log Form */}
        <div className="panel p-5 space-y-4">
          <h3 className="text-sm font-bold text-text-primary">Quick Call Log</h3>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Case</label>
            <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg">
              <option value="">Select case</option>
              {myCases.slice(0, 50).map(c => <option key={c.id} value={c.id}>{c.debtor.name} — {c.loan.accountNumber}</option>)}
            </select>
          </div>

          {selectedCase && (
            <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] text-xs">
              <p className="font-semibold">{selectedCase.debtor.name}</p>
              <p className="text-text-secondary">{selectedCase.loan.bank} | {formatCurrency(selectedCase.loan.currentBalance, selectedCase.loan.currency)}</p>
              <p className="text-text-tertiary">{selectedCase.debtor.phones?.[0] || 'No phone'}</p>
            </div>
          )}

          {/* Disposition Grid */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2">Disposition</label>
            <div className="grid grid-cols-3 gap-2">
              {DISPOSITIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setSelectedDisposition(d.value)}
                  className={`p-2.5 rounded-lg text-center transition-all text-xs font-semibold border ${selectedDisposition === d.value ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)] scale-105' : 'border-[var(--color-border)] text-text-secondary hover:border-[var(--color-primary)]'}`}
                >
                  <span className={`inline-flex w-6 h-6 rounded-full text-white items-center justify-center text-[10px] mb-1 ${d.color}`}>{d.icon}</span>
                  <p className="text-[10px] leading-tight">{d.value}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Duration (sec)</label>
              <input type="number" value={callDuration} onChange={e => setCallDuration(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="120" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Phone Used</label>
              <select value={phoneUsed} onChange={e => setPhoneUsed(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg">
                {['Primary', 'Secondary', 'Work', 'Employer', 'Reference'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {selectedDisposition === 'Promise to Pay' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Promised Amount</label>
                <input type="number" value={promisedAmount} onChange={e => setPromisedAmount(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Follow-up Date</label>
                <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" />
              </div>
            </div>
          )}

          {(selectedDisposition === 'Call Back' || selectedDisposition === 'Busy') && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Follow-up Date</label>
              <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
            <textarea value={callNotes} onChange={e => setCallNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-lg resize-none" placeholder="Brief call summary..." />
          </div>

          <button onClick={handleLog} disabled={!selectedCaseId || !selectedDisposition || !callDuration} className="btn-primary w-full py-2.5 text-sm disabled:opacity-40">
            Log Call
          </button>
        </div>

        {/* Today's Call History */}
        <div className="lg:col-span-2 panel overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold text-text-primary">Call History — {new Date(filterDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          </div>
          <div className="overflow-y-auto max-h-[65vh]">
            {todayLogs.length === 0 ? (
              <p className="p-8 text-center text-sm text-text-secondary">No calls logged for this day.</p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {todayLogs.map(log => {
                  const caseInfo = cases.find(c => c.id === log.caseId);
                  const disp = DISPOSITIONS.find(d => d.value === log.disposition);
                  return (
                    <div key={log.id} className="p-4 hover:bg-[var(--color-bg-muted)] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex w-8 h-8 rounded-full text-white items-center justify-center text-xs font-bold flex-shrink-0 ${disp?.color || 'bg-gray-500'}`}>{disp?.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              {caseInfo ? (
                                <button onClick={() => onSelectCase(log.caseId)} className="text-sm font-semibold text-text-primary hover:text-[var(--color-primary)]">{caseInfo.debtor.name}</button>
                              ) : <span className="text-sm text-text-secondary">Unknown</span>}
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${log.outcome === 'Positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : log.outcome === 'Neutral' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {log.disposition}
                              </span>
                            </div>
                            <p className="text-xs text-text-tertiary mt-0.5">{log.duration}s | {log.phoneUsed} | {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                            {log.notes && <p className="text-xs text-text-secondary mt-1">{log.notes}</p>}
                            {log.promisedAmount && <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">PTP: {formatCurrency(log.promisedAmount, caseInfo?.loan.currency || 'AED')} by {log.followUpDate}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallDispositionLogger;
