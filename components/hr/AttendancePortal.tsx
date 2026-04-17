import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiClient } from '../../src/api/client';
import { User, Role } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Session {
    checkIn: string;
    checkOut?: string;
    ipAddress: string;
    networkName: string;
}

interface TracingNote {
    id: string;
    note: string;
    addedAt: string;
    addedBy: string;
}

interface AttachmentItem {
    id: string;
    name: string;
    dataUrl: string;
    uploadedAt: string;
}

export interface AttendanceRecord {
    id: string;
    officerId: string;
    officerName: string;
    date: string; // YYYY-MM-DD
    sessions: Session[];
    status: 'present' | 'late' | 'half-day' | 'absent' | 'leave';
    leaveType?: 'Sick' | 'Annual' | 'Emergency' | 'Unpaid';
    totalHours: number;
    remarks: string;
    tracingNotes: TracingNote[];
    attachments: AttachmentItem[];
}

interface Props {
    currentUser: User;
    allUsers?: User[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'rv_attendance_v2';
const LATE_THRESHOLD_HOUR = 9; // 9:00 AM is late

// ── Helpers ───────────────────────────────────────────────────────────────────
const loadRecords = (): AttendanceRecord[] => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
};
const saveRecords = (records: AttendanceRecord[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch {}
};

const calcTotalHours = (sessions: Session[], now = new Date()) =>
    sessions.reduce((total, s) => {
        const out = s.checkOut ? new Date(s.checkOut) : now;
        return total + (out.getTime() - new Date(s.checkIn).getTime()) / 3600000;
    }, 0);

// Detect local IP via WebRTC
const getNetworkInfo = (): Promise<{ ip: string; network: string }> =>
    new Promise(resolve => {
        const fallback = () => resolve({ ip: '192.168.1.100', network: 'Office WiFi' });
        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            pc.createOffer().then(o => pc.setLocalDescription(o)).catch(fallback);
            const seen = new Set<string>();
            pc.onicecandidate = e => {
                if (!e.candidate) return;
                const m = e.candidate.candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
                if (m && !seen.has(m[1]) && !m[1].startsWith('0.')) {
                    seen.add(m[1]);
                    pc.close();
                    const ip = m[1];
                    const network = ip.startsWith('192.168') ? 'Office WiFi' :
                        ip.startsWith('10.') ? 'Corporate LAN' :
                        ip.startsWith('172.') ? 'VPN Network' : 'External';
                    resolve({ ip, network });
                }
            };
            setTimeout(() => { pc.close(); fallback(); }, 2000);
        } catch { fallback(); }
    });

const statusColor = (s: string) =>
    s === 'present' ? 'bg-emerald-100 text-emerald-700' :
    s === 'late'    ? 'bg-amber-100 text-amber-700' :
    s === 'leave'   ? 'bg-blue-100 text-blue-700' :
    s === 'half-day'? 'bg-purple-100 text-purple-700' :
                      'bg-red-100 text-red-700';

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

// ── Component ─────────────────────────────────────────────────────────────────
const AttendancePortal: React.FC<Props> = ({ currentUser, allUsers = [] }) => {
    const { useApi } = useAuth();
    const [records, setRecords] = useState<AttendanceRecord[]>(loadRecords);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [networkInfo, setNetworkInfo] = useState({ ip: 'Detecting...', network: 'Detecting...' });
    const [autoMsg, setAutoMsg] = useState('');

    // Filters
    const [fDateFrom, setFDateFrom] = useState('');
    const [fDateTo,   setFDateTo]   = useState('');
    const [fStatus,   setFStatus]   = useState('all');
    const [fOfficer,  setFOfficer]  = useState('all');
    const [fSearch,   setFSearch]   = useState('');

    // Modals
    const [tracingModal, setTracingModal] = useState<{ open: boolean; recordId: string | null }>({ open: false, recordId: null });
    const [tracingInput, setTracingInput] = useState('');
    const [leaveModal,   setLeaveModal]   = useState<{ open: boolean; recordId?: string }>({ open: false });
    const [leaveType,    setLeaveType]    = useState<AttendanceRecord['leaveType']>('Annual');
    const [leaveNote,    setLeaveNote]    = useState('');
    const [attachModal,  setAttachModal]  = useState<{ open: boolean; recordId: string | null }>({ open: false, recordId: null });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const isManager = [Role.MANAGER, Role.ADMIN, Role.CEO].includes(currentUser.role as Role);
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Persist
    useEffect(() => { if (!useApi) saveRecords(records); }, [records, useApi]);

    // Auto check-in on first open
    useEffect(() => {
        if (useApi) return;
        const existing = loadRecords().find(r => r.officerId === currentUser.id && r.date === todayStr);
        if (!existing) {
            getNetworkInfo().then(info => {
                setNetworkInfo(info);
                const hour = new Date().getHours();
                const newRec: AttendanceRecord = {
                    id: `att-${Date.now()}`,
                    officerId: currentUser.id,
                    officerName: currentUser.name,
                    date: todayStr,
                    sessions: [{ checkIn: new Date().toISOString(), ipAddress: info.ip, networkName: info.network }],
                    status: hour >= LATE_THRESHOLD_HOUR ? 'late' : 'present',
                    totalHours: 0,
                    remarks: '',
                    tracingNotes: [],
                    attachments: [],
                };
                setRecords(prev => {
                    const updated = [...prev, newRec];
                    saveRecords(updated);
                    return updated;
                });
                setAutoMsg(`✅ Auto checked in · ${info.network} · ${info.ip}`);
                setTimeout(() => setAutoMsg(''), 5000);
            });
        } else {
            getNetworkInfo().then(info => setNetworkInfo(info));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateRecord = useCallback((id: string, updater: (r: AttendanceRecord) => AttendanceRecord) => {
        setRecords(prev => prev.map(r => r.id === id ? updater(r) : r));
    }, []);

    const todayRecord = useMemo(() =>
        records.find(r => r.officerId === currentUser.id && r.date === todayStr),
        [records, currentUser.id, todayStr]
    );

    const activeSession = todayRecord?.sessions.find(s => !s.checkOut);
    const isCheckedIn  = !!activeSession;
    const hasCheckedOut = !!(todayRecord && !activeSession && todayRecord.sessions.length > 0);

    const handleCheckIn = async () => {
        const info = networkInfo.ip === 'Detecting...' ? await getNetworkInfo() : networkInfo;
        setNetworkInfo(info);
        const now = new Date().toISOString();
        if (todayRecord) {
            updateRecord(todayRecord.id, r => ({
                ...r,
                sessions: [...r.sessions, { checkIn: now, ipAddress: info.ip, networkName: info.network }],
            }));
        } else {
            const newRec: AttendanceRecord = {
                id: `att-${Date.now()}`,
                officerId: currentUser.id,
                officerName: currentUser.name,
                date: todayStr,
                sessions: [{ checkIn: now, ipAddress: info.ip, networkName: info.network }],
                status: new Date().getHours() >= LATE_THRESHOLD_HOUR ? 'late' : 'present',
                totalHours: 0,
                remarks: '',
                tracingNotes: [],
                attachments: [],
            };
            setRecords(prev => [...prev, newRec]);
        }
    };

    const handleCheckOut = () => {
        if (!todayRecord || !activeSession) return;
        const now = new Date().toISOString();
        updateRecord(todayRecord.id, r => {
            const sessions = r.sessions.map(s => !s.checkOut ? { ...s, checkOut: now } : s);
            return { ...r, sessions, totalHours: parseFloat(calcTotalHours(sessions).toFixed(2)) };
        });
    };

    const handleMarkLeave = (recordId?: string) => {
        const id = recordId || todayRecord?.id;
        if (!id) {
            const newRec: AttendanceRecord = {
                id: `att-${Date.now()}`,
                officerId: currentUser.id,
                officerName: currentUser.name,
                date: todayStr,
                sessions: [],
                status: 'leave',
                leaveType,
                totalHours: 0,
                remarks: leaveNote,
                tracingNotes: [],
                attachments: [],
            };
            setRecords(prev => [...prev, newRec]);
        } else {
            updateRecord(id, r => ({ ...r, status: 'leave', leaveType, remarks: leaveNote || r.remarks }));
        }
        setLeaveModal({ open: false });
        setLeaveNote('');
    };

    const addTracingNote = (recordId: string) => {
        if (!tracingInput.trim()) return;
        updateRecord(recordId, r => ({
            ...r,
            tracingNotes: [...r.tracingNotes, {
                id: `tr-${Date.now()}`,
                note: tracingInput.trim(),
                addedAt: new Date().toISOString(),
                addedBy: currentUser.name,
            }],
        }));
        setTracingInput('');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !uploadingId) return;
        Array.from(e.target.files as FileList).forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = ev => {
                updateRecord(uploadingId, r => ({
                    ...r,
                    attachments: [...r.attachments, {
                        id: `file-${Date.now()}`,
                        name: file.name,
                        dataUrl: ev.target?.result as string,
                        uploadedAt: new Date().toISOString(),
                    }],
                }));
            };
            reader.readAsDataURL(file);
        });
        setUploadingId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Today's elapsed
    const elapsedMins = activeSession
        ? Math.round((currentTime.getTime() - new Date(activeSession.checkIn).getTime()) / 60000)
        : 0;
    const todayTotalMins = todayRecord
        ? Math.round(calcTotalHours(todayRecord.sessions, currentTime) * 60)
        : 0;

    // Filtered table
    const filteredRecords = useMemo(() => {
        let data = isManager ? records : records.filter(r => r.officerId === currentUser.id);
        if (fOfficer !== 'all') data = data.filter(r => r.officerId === fOfficer);
        if (fStatus  !== 'all') data = data.filter(r => r.status === fStatus);
        if (fDateFrom) data = data.filter(r => r.date >= fDateFrom);
        if (fDateTo)   data = data.filter(r => r.date <= fDateTo);
        if (fSearch) {
            const q = fSearch.toLowerCase();
            data = data.filter(r =>
                r.officerName.toLowerCase().includes(q) ||
                r.date.includes(q) ||
                r.remarks.toLowerCase().includes(q) ||
                r.sessions.some(s => s.ipAddress.includes(q))
            );
        }
        return [...data].sort((a, b) => b.date.localeCompare(a.date));
    }, [records, isManager, currentUser.id, fOfficer, fStatus, fDateFrom, fDateTo, fSearch]);

    const summaryStats = useMemo(() => ({
        present: filteredRecords.filter(r => r.status === 'present').length,
        late:    filteredRecords.filter(r => r.status === 'late').length,
        leave:   filteredRecords.filter(r => r.status === 'leave').length,
        absent:  filteredRecords.filter(r => r.status === 'absent').length,
        totalHrs: filteredRecords.reduce((s, r) => s + r.totalHours, 0),
    }), [filteredRecords]);

    const tracingRecord = records.find(r => r.id === tracingModal.recordId);
    const attachRecord  = records.find(r => r.id === attachModal.recordId);

    return (
        <div className="p-4 sm:p-6 space-y-5 animate-fade-in-up">

            {/* Auto check-in toast */}
            {autoMsg && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                    {autoMsg}
                    <button onClick={() => setAutoMsg('')} className="ml-auto text-emerald-500 hover:text-emerald-700 text-base leading-none">✕</button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Attendance Portal</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-mono border border-[var(--color-border)]">
                        🌐 {networkInfo.ip} · {networkInfo.network}
                    </span>
                    <button onClick={() => setLeaveModal({ open: true })}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-200 transition">
                        ✈️ Mark Leave
                    </button>
                </div>
            </div>

            {/* Clock + Sessions row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Left — Clock & Check-in */}
                <div className="panel rounded-xl p-6 text-center relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg,rgba(27,42,74,.04),rgba(242,140,40,.04))' }} />
                    <div className="relative">
                        <p className="text-5xl font-extrabold tracking-tight font-mono text-[var(--color-text-primary)]">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </p>
                        <p className="text-[var(--color-text-secondary)] mt-1 text-sm">
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>

                        {/* Name badge */}
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: '#1B2A4A' }}>
                                {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">{currentUser.name}</span>
                            {currentUser.agentCode && <span className="text-[10px] text-orange-500 font-mono">{currentUser.agentCode}</span>}
                        </div>

                        {/* Action buttons */}
                        <div className="mt-5">
                            {!todayRecord && (
                                <button onClick={handleCheckIn}
                                    className="px-8 py-3 text-base font-bold text-white rounded-xl shadow-lg transition hover:scale-105 active:scale-95"
                                    style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
                                    Check In
                                </button>
                            )}
                            {isCheckedIn && (
                                <div className="space-y-3">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        On Duty · {Math.floor(elapsedMins / 60)}h {elapsedMins % 60}m
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-[var(--color-text-primary)]">
                                            {Math.floor(todayTotalMins / 60)}h {todayTotalMins % 60}m
                                        </p>
                                        <p className="text-[10px] text-[var(--color-text-tertiary)]">Total today</p>
                                    </div>
                                    <button onClick={handleCheckOut}
                                        className="px-6 py-2.5 text-sm font-bold text-white rounded-xl transition hover:scale-105"
                                        style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)' }}>
                                        Check Out
                                    </button>
                                </div>
                            )}
                            {hasCheckedOut && !isCheckedIn && (
                                <div className="space-y-3">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                                        Day total: {Math.floor(todayTotalMins / 60)}h {todayTotalMins % 60}m
                                    </div>
                                    <div>
                                        <button onClick={handleCheckIn}
                                            className="px-6 py-2.5 text-sm font-bold text-white rounded-xl transition hover:scale-105"
                                            style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)' }}>
                                            Check In Again
                                        </button>
                                        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">Multiple sessions supported</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right — Today's Sessions */}
                <div className="panel rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Today's Sessions</h3>
                        {todayRecord && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor(todayRecord.status)}`}>
                                {todayRecord.status.charAt(0).toUpperCase() + todayRecord.status.slice(1)}
                            </span>
                        )}
                    </div>

                    {!todayRecord || todayRecord.sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-[var(--color-text-tertiary)]">
                            <p className="text-2xl mb-1">⏰</p>
                            <p className="text-sm">No sessions today</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {todayRecord.sessions.map((s, i) => {
                                const mins = s.checkOut
                                    ? Math.round((new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime()) / 60000)
                                    : Math.round((currentTime.getTime() - new Date(s.checkIn).getTime()) / 60000);
                                return (
                                    <div key={i} className={`p-3 rounded-xl border ${!s.checkOut ? 'border-emerald-200 bg-emerald-50/60' : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]'}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full ${!s.checkOut ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                                                <span className="text-xs font-bold text-[var(--color-text-primary)]">Session {i + 1}</span>
                                            </div>
                                            <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                                {!s.checkOut ? '🟢 Active' : `${Math.floor(mins / 60)}h ${mins % 60}m`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px]">
                                            <span className="text-emerald-700 font-mono font-semibold">IN {fmtTime(s.checkIn)}</span>
                                            {s.checkOut && (
                                                <><span className="text-[var(--color-text-tertiary)]">→</span>
                                                <span className="text-red-600 font-mono font-semibold">OUT {fmtTime(s.checkOut)}</span></>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--color-text-tertiary)]">
                                            <span>🌐</span>
                                            <span className="font-mono">{s.ipAddress}</span>
                                            <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">{s.networkName}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="panel rounded-xl p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">From</label>
                        <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)}
                            className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-secondary)] outline-none focus:border-[var(--color-accent)]" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">To</label>
                        <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)}
                            className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-secondary)] outline-none focus:border-[var(--color-accent)]" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">Status</label>
                        <select value={fStatus} onChange={e => setFStatus(e.target.value)}
                            className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-secondary)]">
                            <option value="all">All Status</option>
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="leave">Leave</option>
                            <option value="half-day">Half Day</option>
                            <option value="absent">Absent</option>
                        </select>
                    </div>
                    {isManager && (
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">Officer</label>
                            <select value={fOfficer} onChange={e => setFOfficer(e.target.value)}
                                className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-secondary)]">
                                <option value="all">All Officers</option>
                                {allUsers.filter(u => u.role === Role.OFFICER).map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className={isManager ? '' : 'col-span-2'}>
                        <label className="block text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">Search</label>
                        <input type="text" value={fSearch} onChange={e => setFSearch(e.target.value)}
                            placeholder="Name, date, IP, remarks..."
                            className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-bg-secondary)] outline-none focus:border-[var(--color-accent)]" />
                    </div>
                    <div className="flex gap-2 items-end">
                        <button onClick={() => { setFDateFrom(''); setFDateTo(''); setFStatus('all'); setFOfficer('all'); setFSearch(''); }}
                            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition">
                            Clear
                        </button>
                    </div>
                </div>

                {/* Summary bar */}
                <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
                    <p className="text-[11px] text-[var(--color-text-tertiary)]">{filteredRecords.length} records</p>
                    <span className="text-[11px] font-semibold text-emerald-600">✅ {summaryStats.present} Present</span>
                    <span className="text-[11px] font-semibold text-amber-600">⏰ {summaryStats.late} Late</span>
                    <span className="text-[11px] font-semibold text-blue-600">✈️ {summaryStats.leave} Leave</span>
                    <span className="text-[11px] font-semibold text-red-600">❌ {summaryStats.absent} Absent</span>
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] ml-auto">Total: {summaryStats.totalHrs.toFixed(1)}h</span>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="panel rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-[var(--color-text-tertiary)] text-[10px] uppercase tracking-wider border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                                <th className="text-left py-2.5 px-3 whitespace-nowrap">Date</th>
                                {isManager && <th className="text-left py-2.5 px-3">Officer</th>}
                                <th className="text-left py-2.5 px-3">Status</th>
                                <th className="text-left py-2.5 px-3 min-w-[160px]">Sessions · IP</th>
                                <th className="text-center py-2.5 px-3">Hrs</th>
                                <th className="text-left py-2.5 px-3">Leave</th>
                                <th className="text-left py-2.5 px-3 min-w-[180px]">Remarks</th>
                                <th className="text-center py-2.5 px-3 whitespace-nowrap">Tracing</th>
                                <th className="text-center py-2.5 px-3 whitespace-nowrap">Files</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]/30">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={isManager ? 9 : 8} className="py-12 text-center text-[var(--color-text-tertiary)]">
                                        <p className="text-2xl mb-2">📋</p>
                                        <p>No attendance records found</p>
                                    </td>
                                </tr>
                            ) : filteredRecords.map(r => (
                                <tr key={r.id} className="hover:bg-[var(--color-bg-tertiary)] transition">

                                    {/* Date */}
                                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[var(--color-text-primary)]">
                                        {new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        <div className="text-[9px] text-[var(--color-text-tertiary)]">{r.date}</div>
                                    </td>

                                    {/* Officer (manager only) */}
                                    {isManager && (
                                        <td className="py-2.5 px-3">
                                            <div className="font-semibold text-[var(--color-text-primary)]">{r.officerName}</div>
                                        </td>
                                    )}

                                    {/* Status */}
                                    <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(r.status)}`}>
                                            {r.status.charAt(0).toUpperCase() + r.status.slice(1).replace('-', ' ')}
                                        </span>
                                    </td>

                                    {/* Sessions + IP */}
                                    <td className="py-2.5 px-3">
                                        {r.sessions.length === 0
                                            ? <span className="text-[var(--color-text-tertiary)]">—</span>
                                            : <div className="space-y-0.5">
                                                {r.sessions.map((s, i) => (
                                                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${!s.checkOut ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                                                        <span className="text-emerald-700 font-mono">{fmtTime(s.checkIn)}</span>
                                                        {s.checkOut
                                                            ? <><span className="text-[var(--color-text-tertiary)]">→</span><span className="text-red-500 font-mono">{fmtTime(s.checkOut)}</span></>
                                                            : <span className="text-emerald-600 font-bold">LIVE</span>
                                                        }
                                                        <span title={`${s.networkName}: ${s.ipAddress}`} className="text-[9px] text-[var(--color-text-tertiary)] cursor-help truncate max-w-[80px]">· {s.ipAddress}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                    </td>

                                    {/* Hours */}
                                    <td className="py-2.5 px-3 text-center font-semibold text-[var(--color-text-primary)]">
                                        {r.totalHours > 0 ? `${r.totalHours}h` : '—'}
                                    </td>

                                    {/* Leave type */}
                                    <td className="py-2.5 px-3">
                                        {r.leaveType
                                            ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">{r.leaveType}</span>
                                            : <button onClick={() => setLeaveModal({ open: true, recordId: r.id })}
                                                className="text-[9px] px-1.5 py-0.5 rounded border border-dashed border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-blue-400 hover:text-blue-600 transition whitespace-nowrap">
                                                + Leave
                                              </button>
                                        }
                                    </td>

                                    {/* Remarks — inline editable */}
                                    <td className="py-2.5 px-3">
                                        <input
                                            type="text"
                                            value={r.remarks}
                                            onChange={e => updateRecord(r.id, rec => ({ ...rec, remarks: e.target.value }))}
                                            placeholder="Add remark..."
                                            className="w-full text-[11px] bg-transparent border-b border-dashed border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none py-0.5 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                                        />
                                    </td>

                                    {/* Tracing button */}
                                    <td className="py-2.5 px-3 text-center">
                                        <button
                                            onClick={() => { setTracingModal({ open: true, recordId: r.id }); setTracingInput(''); }}
                                            className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 transition whitespace-nowrap"
                                        >
                                            🔍 {r.tracingNotes.length > 0 ? r.tracingNotes.length : '+'}
                                        </button>
                                    </td>

                                    {/* Files button */}
                                    <td className="py-2.5 px-3 text-center">
                                        <button
                                            onClick={() => setAttachModal({ open: true, recordId: r.id })}
                                            className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition whitespace-nowrap"
                                        >
                                            📎 {r.attachments.length > 0 ? r.attachments.length : '+'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx" className="hidden" onChange={handleFileUpload} />

            {/* ── Tracing Modal ───────────────────────────────────────────── */}
            {tracingModal.open && tracingRecord && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setTracingModal({ open: false, recordId: null })}>
                    <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--color-border)]" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between rounded-t-2xl" style={{ background: '#1B2A4A' }}>
                            <div>
                                <p className="text-sm font-bold text-white">Tracing Notes</p>
                                <p className="text-[10px] text-blue-200/60">
                                    {tracingRecord.officerName} · {new Date(tracingRecord.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                            <button onClick={() => setTracingModal({ open: false, recordId: null })} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
                        </div>
                        <div className="p-4 space-y-2.5 max-h-64 overflow-y-auto">
                            {tracingRecord.tracingNotes.length === 0
                                ? <p className="text-center text-[var(--color-text-tertiary)] text-sm py-6">No tracing notes yet</p>
                                : tracingRecord.tracingNotes.map(n => (
                                    <div key={n.id} className="p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                                        <p className="text-xs text-[var(--color-text-primary)]">{n.note}</p>
                                        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">{n.addedBy} · {new Date(n.addedAt).toLocaleString()}</p>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="px-4 pb-4 flex gap-2">
                            <input
                                type="text"
                                value={tracingInput}
                                onChange={e => setTracingInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addTracingNote(tracingModal.recordId!)}
                                placeholder="Add tracing note and press Enter..."
                                className="flex-1 text-sm border border-[var(--color-border)] rounded-xl px-3 py-2 bg-[var(--color-bg-secondary)] outline-none focus:border-[var(--color-accent)]"
                                autoFocus
                            />
                            <button onClick={() => addTracingNote(tracingModal.recordId!)} disabled={!tracingInput.trim()}
                                className="px-3 py-2 text-xs font-bold text-white rounded-xl disabled:opacity-40 transition"
                                style={{ background: '#F28C28' }}>
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Attachments Modal ──────────────────────────────────────── */}
            {attachModal.open && attachRecord && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setAttachModal({ open: false, recordId: null })}>
                    <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--color-border)]" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between rounded-t-2xl" style={{ background: '#1B2A4A' }}>
                            <div>
                                <p className="text-sm font-bold text-white">Attachments</p>
                                <p className="text-[10px] text-blue-200/60">{attachRecord.officerName} · {attachRecord.date}</p>
                            </div>
                            <button onClick={() => setAttachModal({ open: false, recordId: null })} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
                        </div>
                        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                            {attachRecord.attachments.length === 0
                                ? <p className="text-center text-[var(--color-text-tertiary)] text-sm py-4">No files uploaded</p>
                                : attachRecord.attachments.map(f => (
                                    <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
                                        <span className="text-lg">{f.name.endsWith('.pdf') ? '📄' : f.name.match(/\.(jpg|jpeg|png)$/i) ? '🖼️' : '📎'}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{f.name}</p>
                                            <p className="text-[10px] text-[var(--color-text-tertiary)]">{new Date(f.uploadedAt).toLocaleString()}</p>
                                        </div>
                                        <a href={f.dataUrl} download={f.name}
                                            className="text-[10px] px-2 py-1 rounded bg-[var(--color-accent)] text-white font-bold">↓</a>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="px-4 pb-4">
                            <button onClick={() => { setUploadingId(attachRecord.id); setTimeout(() => fileInputRef.current?.click(), 50); }}
                                className="w-full py-2.5 text-sm font-bold rounded-xl border-2 border-dashed border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-orange-50 transition">
                                + Upload Files (PDF, Image, Doc)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Leave Modal ────────────────────────────────────────────── */}
            {leaveModal.open && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setLeaveModal({ open: false })}>
                    <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl w-full max-w-sm border border-[var(--color-border)]" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-[var(--color-border)] rounded-t-2xl flex items-center justify-between" style={{ background: '#1B2A4A' }}>
                            <p className="text-sm font-bold text-white">Mark Leave</p>
                            <button onClick={() => setLeaveModal({ open: false })} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Leave Type</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['Sick', 'Annual', 'Emergency', 'Unpaid'] as const).map(t => (
                                        <button key={t} onClick={() => setLeaveType(t)}
                                            className={`py-2.5 text-xs font-semibold rounded-xl border-2 transition ${leaveType === t ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-orange-50' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]'}`}>
                                            {t === 'Sick' ? '🤒' : t === 'Annual' ? '🌴' : t === 'Emergency' ? '🚨' : '💰'} {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Reason (optional)</p>
                                <input type="text" value={leaveNote} onChange={e => setLeaveNote(e.target.value)}
                                    placeholder="Brief reason..."
                                    className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2 bg-[var(--color-bg-secondary)] outline-none focus:border-[var(--color-accent)]" />
                            </div>
                            <button onClick={() => handleMarkLeave(leaveModal.recordId)}
                                className="w-full py-3 text-sm font-bold text-white rounded-xl transition hover:scale-105"
                                style={{ background: 'linear-gradient(135deg,#1B2A4A,#2D4470)' }}>
                                Confirm Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendancePortal;
