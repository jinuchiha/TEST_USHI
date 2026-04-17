import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────
interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
}

interface Session {
  checkIn: string;
  checkOut?: string;
  ipAddress: string;
  networkName: string;
  location?: GeoLocation;
}

interface AttendanceRecord {
  id: string;
  officerId: string;
  officerName: string;
  date: string; // YYYY-MM-DD
  sessions: Session[];
  status: 'present' | 'late' | 'half-day' | 'absent' | 'leave';
  leaveType?: 'Sick' | 'Annual' | 'Casual' | 'Emergency' | 'Unpaid';
  totalHours: number;
  remarks: string;
  tracingNotes: any[];
  attachments: any[];
}

interface LeaveRequest {
  id: string;
  officerId: string;
  officerName: string;
  leaveType: 'Sick' | 'Casual' | 'Annual';
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

interface AttendancePopupProps {
  currentUser: User;
  onCheckIn: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'rv_attendance_v2';
const LEAVE_REQUESTS_KEY = 'rv_leave_requests';
const LATE_THRESHOLD_HOUR = 9;
const NAVY = 'var(--color-primary)';
const NAVY_DARK = 'var(--gradient-start)';
const ORANGE = 'var(--color-accent)';
const ORANGE_LIGHT = 'var(--color-primary-glow)';

// Leave policy
const POLICY = {
  sickPerYear: 8,
  casualPerYear: 8,
  annualPerYear: 16,
  latesPerLeaveDeduction: 4,
  maxLeavesPerMonth: 2,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const loadRecords = (): AttendanceRecord[] => {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
};

const saveRecords = (records: AttendanceRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
};

const loadLeaveRequests = (): LeaveRequest[] => {
  try {
    const s = localStorage.getItem(LEAVE_REQUESTS_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
};

const saveLeaveRequests = (requests: LeaveRequest[]) => {
  try {
    localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));
  } catch {}
};

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

const getGreeting = (hour: number): string => {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

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

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ── Geolocation ─────────────────────────────────────────────────────────────
const getLocation = (): Promise<GeoLocation | null> =>
  new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

// ── Component ────────────────────────────────────────────────────────────────
const AttendancePopup: React.FC<AttendancePopupProps> = ({ currentUser, onCheckIn }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>(loadRecords);
  const [networkInfo, setNetworkInfo] = useState({ ip: 'Detecting...', network: 'Detecting...' });
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [isLate, setIsLate] = useState(false);
  const [locationInfo, setLocationInfo] = useState<{ status: 'detecting' | 'granted' | 'denied' | 'unavailable'; data: GeoLocation | null }>({ status: 'detecting', data: null });
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<'Sick' | 'Casual' | 'Annual'>('Casual');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitted, setLeaveSubmitted] = useState(false);

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Detect network
  useEffect(() => {
    getNetworkInfo().then(setNetworkInfo);
  }, []);

  // Detect location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationInfo({ status: 'unavailable', data: null });
      return;
    }
    getLocation().then(loc => {
      if (loc) {
        setLocationInfo({ status: 'granted', data: loc });
      } else {
        setLocationInfo({ status: 'denied', data: null });
      }
    });
  }, []);

  // ── Computed data ──────────────────────────────────────────────────────────
  const today = toDateStr(currentTime);
  const currentYear = currentTime.getFullYear();
  const currentMonth = currentTime.getMonth();

  const myRecords = useMemo(
    () => records.filter(r => r.officerId === currentUser.id),
    [records, currentUser.id]
  );

  const myYearRecords = useMemo(
    () => myRecords.filter(r => r.date.startsWith(String(currentYear))),
    [myRecords, currentYear]
  );

  const myMonthRecords = useMemo(
    () => myYearRecords.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth;
    }),
    [myYearRecords, currentMonth]
  );

  // Leave balance calculations
  const leaveBalance = useMemo(() => {
    const sickUsed = myYearRecords.filter(r => r.status === 'leave' && r.leaveType === 'Sick').length;
    const casualUsed = myYearRecords.filter(r => r.status === 'leave' && r.leaveType === 'Casual').length;
    const annualUsed = myYearRecords.filter(r => r.status === 'leave' && r.leaveType === 'Annual').length;
    const lateThisMonth = myMonthRecords.filter(r => r.status === 'late').length;
    const leavesThisMonth = myMonthRecords.filter(r => r.status === 'leave').length;
    const totalLateYear = myYearRecords.filter(r => r.status === 'late').length;
    const lateDeductions = Math.floor(totalLateYear / POLICY.latesPerLeaveDeduction);

    return {
      sickUsed,
      sickRemaining: Math.max(0, POLICY.sickPerYear - sickUsed),
      casualUsed,
      casualRemaining: Math.max(0, POLICY.casualPerYear - casualUsed),
      annualUsed,
      annualRemaining: Math.max(0, POLICY.annualPerYear - annualUsed),
      lateThisMonth,
      leavesThisMonth,
      totalLateYear,
      lateDeductions,
    };
  }, [myYearRecords, myMonthRecords]);

  // Last 7 days attendance history
  const recentHistory = useMemo(() => {
    const days: { date: string; dayLabel: string; record?: AttendanceRecord }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentTime);
      d.setDate(d.getDate() - i);
      const dateStr = toDateStr(d);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const record = myRecords.find(r => r.date === dateStr);
      days.push({ date: dateStr, dayLabel, record });
    }
    return days;
  }, [myRecords, currentTime]);

  // ── Check-in handler ───────────────────────────────────────────────────────
  const handleCheckIn = useCallback(async () => {
    setCheckingIn(true);

    const now = new Date();
    const isLateCheckIn = now.getHours() >= LATE_THRESHOLD_HOUR;
    setIsLate(isLateCheckIn);

    const [net, loc] = await Promise.all([getNetworkInfo(), getLocation()]);
    if (loc) setLocationInfo({ status: 'granted', data: loc });
    const todayStr = toDateStr(now);

    const existingIdx = records.findIndex(
      r => r.officerId === currentUser.id && r.date === todayStr
    );

    const session: Session = {
      checkIn: now.toISOString(),
      ipAddress: net.ip,
      networkName: net.network,
      location: loc || undefined,
    };

    let updated: AttendanceRecord[];

    if (existingIdx >= 0) {
      updated = [...records];
      updated[existingIdx] = {
        ...updated[existingIdx],
        sessions: [...updated[existingIdx].sessions, session],
        status: isLateCheckIn ? 'late' : updated[existingIdx].status,
      };
    } else {
      const newRecord: AttendanceRecord = {
        id: generateId(),
        officerId: currentUser.id,
        officerName: currentUser.name,
        date: todayStr,
        sessions: [session],
        status: isLateCheckIn ? 'late' : 'present',
        totalHours: 0,
        remarks: isLateCheckIn ? 'Late check-in' : '',
        tracingNotes: [],
        attachments: [],
      };
      updated = [...records, newRecord];
    }

    saveRecords(updated);
    setRecords(updated);
    setCheckedIn(true);

    // Short delay to show success state, then dismiss
    setTimeout(() => {
      onCheckIn();
    }, isLateCheckIn ? 2200 : 1500);
  }, [records, currentUser, onCheckIn]);

  // ── Leave request handler ──────────────────────────────────────────────────
  const handleLeaveSubmit = useCallback(() => {
    if (!leaveDate || !leaveReason.trim()) return;

    // Save leave request
    const requests = loadLeaveRequests();
    const newReq: LeaveRequest = {
      id: generateId(),
      officerId: currentUser.id,
      officerName: currentUser.name,
      leaveType,
      date: leaveDate,
      reason: leaveReason.trim(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };
    saveLeaveRequests([...requests, newReq]);

    // Also create an attendance record for the leave date
    const existingIdx = records.findIndex(
      r => r.officerId === currentUser.id && r.date === leaveDate
    );
    let updated: AttendanceRecord[];
    if (existingIdx >= 0) {
      updated = [...records];
      updated[existingIdx] = {
        ...updated[existingIdx],
        status: 'leave',
        leaveType,
        remarks: `Leave: ${leaveReason.trim()}`,
      };
    } else {
      updated = [...records, {
        id: generateId(),
        officerId: currentUser.id,
        officerName: currentUser.name,
        date: leaveDate,
        sessions: [],
        status: 'leave' as const,
        leaveType,
        totalHours: 0,
        remarks: `Leave: ${leaveReason.trim()}`,
        tracingNotes: [],
        attachments: [],
      }];
    }
    saveRecords(updated);
    setRecords(updated);
    setLeaveSubmitted(true);
    setTimeout(() => {
      setShowLeaveModal(false);
      setLeaveSubmitted(false);
      setLeaveDate('');
      setLeaveReason('');
    }, 1800);
  }, [leaveDate, leaveReason, leaveType, currentUser, records]);

  // ── Status badge helper ────────────────────────────────────────────────────
  const statusBadge = (status?: string) => {
    switch (status) {
      case 'present':
        return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Present' };
      case 'late':
        return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Late' };
      case 'leave':
        return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Leave' };
      case 'half-day':
        return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Half Day' };
      case 'absent':
        return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Absent' };
      default:
        return { bg: 'bg-gray-100 dark:bg-gray-800/30', text: 'text-gray-500 dark:text-gray-400', label: '--' };
    }
  };

  // ── Leave Balance Bar ──────────────────────────────────────────────────────
  const LeaveBar: React.FC<{ label: string; used: number; total: number; color: string }> = ({ label, used, total, color }) => {
    const pct = Math.min(100, (used / total) * 100);
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-text-primary">{label}</span>
          <span className="text-[11px] font-mono text-text-secondary">{used}/{total} used</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--color-danger)' : pct >= 70 ? ORANGE : color }}
          />
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const greeting = getGreeting(currentTime.getHours());
  const timeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(11,15,26,0.85) 0%, rgba(27,42,74,0.92) 50%, rgba(11,15,26,0.85) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl animate-fade-in-up"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35), 0 0 40px rgba(27,42,74,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Navy Gradient Header ── */}
        <div
          className="relative px-8 pt-8 pb-6 rounded-t-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 60%, var(--gradient-start) 100%)' }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10" style={{ background: ORANGE }} />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-5" style={{ background: ORANGE }} />

          <div className="relative z-10 text-center">
            {/* Logo / Title */}
            <div className="inline-flex items-center gap-2 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-lg"
                style={{ background: ORANGE }}
              >
                R
              </div>
              <span className="text-white/80 text-sm font-semibold tracking-wide">RecoVantage HR</span>
            </div>

            {/* Clock */}
            <div className="text-white text-4xl font-bold font-mono tracking-wider mb-1">
              {timeStr}
            </div>
            <p className="text-white/60 text-sm">{dateStr}</p>

            {/* Greeting */}
            <h2 className="text-white text-xl font-bold mt-4">
              {greeting}, <span style={{ color: ORANGE }}>{currentUser.name}</span>
            </h2>
            <p className="text-white/50 text-xs mt-1">Please check in to start your work day</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-5">

          {/* ═══ Location Status ═══ */}
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>
            {locationInfo.status === 'detecting' ? (
              <>
                <svg className="animate-spin w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                <span className="text-xs text-text-tertiary">Detecting your location...</span>
              </>
            ) : locationInfo.status === 'granted' && locationInfo.data ? (
              <>
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Location captured</span>
                <span className="text-[10px] text-text-tertiary font-mono">({locationInfo.data.latitude.toFixed(4)}, {locationInfo.data.longitude.toFixed(4)})</span>
                <span className="text-[10px] text-text-tertiary">&middot; {locationInfo.data.accuracy}m accuracy</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Location access denied</span>
                <span className="text-[10px] text-text-tertiary">— Allow location in browser settings</span>
              </>
            )}
          </div>

          {/* ═══ Check-in Button ═══ */}
          {!checkedIn ? (
            <div className="text-center">
              <button
                onClick={handleCheckIn}
                disabled={checkingIn || locationInfo.status === 'detecting'}
                className="relative inline-flex items-center justify-center gap-3 px-10 py-4 text-white font-bold text-sm rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark, #E07B1F) 100%)',
                  boxShadow: '0 4px 20px rgba(242,140,40,0.4)',
                }}
              >
                {checkingIn ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Recording Check-in...
                  </>
                ) : locationInfo.status === 'detecting' ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Waiting for Location...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Check In Now
                  </>
                )}
              </button>
              <p className="text-[11px] text-text-tertiary mt-2">
                {currentTime.getHours() >= LATE_THRESHOLD_HOUR
                  ? 'Note: Check-in after 9:00 AM will be marked as late'
                  : 'Office hours start at 9:00 AM'}
              </p>
            </div>
          ) : (
            <div
              className="text-center py-4 px-6 rounded-xl animate-fade-in-up"
              style={{
                background: isLate
                  ? 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)'
                  : 'linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 100%)',
                border: `1px solid ${isLate ? '#F59E0B' : '#10B981'}`,
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                {isLate ? (
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className={`font-bold text-sm ${isLate ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {isLate ? 'Late Check-in Recorded' : 'Checked In Successfully'}
                </span>
              </div>
              <p className={`text-xs ${isLate ? 'text-amber-700' : 'text-emerald-700'}`}>
                {isLate
                  ? 'Your late arrival has been noted. Please ensure punctuality.'
                  : 'Welcome! Have a productive day.'}
              </p>
              {locationInfo.data && (
                <p className="text-[10px] text-text-tertiary mt-2 font-mono">
                  Location recorded: {locationInfo.data.latitude.toFixed(4)}, {locationInfo.data.longitude.toFixed(4)}
                </p>
              )}
            </div>
          )}

          {/* ═══ Leave Balance Dashboard ═══ */}
          <div className="panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <svg className="w-4 h-4" style={{ color: NAVY }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18" />
                </svg>
                Leave Balance — {currentYear}
              </h3>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: ORANGE_LIGHT, color: ORANGE }}
              >
                {leaveBalance.sickRemaining + leaveBalance.casualRemaining + leaveBalance.annualRemaining} days remaining
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <LeaveBar label="Sick Leave" used={leaveBalance.sickUsed} total={POLICY.sickPerYear} color="#3B82F6" />
              <LeaveBar label="Casual Leave" used={leaveBalance.casualUsed} total={POLICY.casualPerYear} color="#8B5CF6" />
              <LeaveBar label="Annual Leave" used={leaveBalance.annualUsed} total={POLICY.annualPerYear} color="#0EA5E9" />
            </div>

            {/* Late count warning */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-bg-tertiary)' }}>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: leaveBalance.lateThisMonth >= 3 ? 'var(--color-danger)' : leaveBalance.lateThisMonth >= 2 ? ORANGE : '#6B7280' }}
                >
                  {leaveBalance.lateThisMonth}
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary">Lates This Month</p>
                  {leaveBalance.lateThisMonth >= 3 ? (
                    <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                      {leaveBalance.lateThisMonth} lates this month — 1 more and a leave will be deducted
                    </p>
                  ) : leaveBalance.lateThisMonth >= 2 ? (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      {4 - leaveBalance.lateThisMonth} more lates until leave deduction
                    </p>
                  ) : (
                    <p className="text-[10px] text-text-tertiary">4 lates = 1 leave deducted</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-bg-tertiary)' }}>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: leaveBalance.leavesThisMonth >= POLICY.maxLeavesPerMonth ? 'var(--color-danger)' : leaveBalance.leavesThisMonth >= 1 ? ORANGE : '#6B7280' }}
                >
                  {leaveBalance.leavesThisMonth}
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary">Leaves This Month</p>
                  {leaveBalance.leavesThisMonth >= POLICY.maxLeavesPerMonth ? (
                    <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                      Limit reached — further leaves will cause salary deduction
                    </p>
                  ) : (
                    <p className="text-[10px] text-text-tertiary">
                      {leaveBalance.leavesThisMonth}/{POLICY.maxLeavesPerMonth} used (max {POLICY.maxLeavesPerMonth}/month)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Policy note */}
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-[10px]"
              style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
            >
              <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span>
                Policy: 4 late arrivals = 1 leave deducted | 8 Sick + 8 Casual + 16 Annual leaves per year | Max 2 leaves per month before salary deduction
              </span>
            </div>
          </div>

          {/* ═══ Recent Attendance History — Last 7 Days ═══ */}
          <div className="panel p-5 space-y-3">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <svg className="w-4 h-4" style={{ color: NAVY }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recent Attendance — Last 7 Days
            </h3>

            <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--color-bg-tertiary)' }}>
                    <th className="text-left py-2.5 px-3 text-text-tertiary font-semibold">Date</th>
                    <th className="text-left py-2.5 px-3 text-text-tertiary font-semibold">Check-in</th>
                    <th className="text-left py-2.5 px-3 text-text-tertiary font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentHistory.map((day, idx) => {
                    const badge = statusBadge(day.record?.status);
                    const checkInTime = day.record?.sessions?.[0]?.checkIn;
                    const isToday = day.date === today;
                    return (
                      <tr
                        key={day.date}
                        className="transition-colors"
                        style={{
                          borderTop: idx > 0 ? '1px solid var(--color-border)' : undefined,
                          background: isToday ? 'var(--color-bg-muted)' : undefined,
                        }}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {isToday && (
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: ORANGE }}
                              />
                            )}
                            <span className={`font-medium ${isToday ? 'text-text-primary' : 'text-text-secondary'}`}>
                              {day.dayLabel}
                            </span>
                            {isToday && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: ORANGE_LIGHT, color: ORANGE }}>
                                TODAY
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-text-secondary">
                          {checkInTime ? fmtTime(checkInTime) : '--'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Leave Request Button ═══ */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowLeaveModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Apply for Leave
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="px-6 py-3 text-center rounded-b-2xl"
          style={{ background: 'var(--color-bg-tertiary)', borderTop: '1px solid var(--color-border)' }}
        >
          <p className="text-[10px] text-text-tertiary">
            RecoVantage Attendance System v2 &middot; IP: {networkInfo.ip} &middot; {networkInfo.network}
            {locationInfo.data && (<> &middot; GPS: {locationInfo.data.latitude.toFixed(4)}, {locationInfo.data.longitude.toFixed(4)}</>)}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         Leave Request Modal
      ═══════════════════════════════════════════════════════════════════════ */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => !leaveSubmitted && setShowLeaveModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl overflow-hidden animate-fade-in-up"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ background: 'linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%)' }}
            >
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18" />
                </svg>
                Apply for Leave
              </h3>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {leaveSubmitted ? (
              <div className="p-8 text-center animate-fade-in-up">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-3">
                  <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-text-primary">Leave Request Submitted</h4>
                <p className="text-xs text-text-tertiary mt-1">Your manager will review the request</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Leave Type */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">Leave Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Sick', 'Casual', 'Annual'] as const).map(type => {
                      const active = leaveType === type;
                      const remaining = type === 'Sick' ? leaveBalance.sickRemaining
                        : type === 'Casual' ? leaveBalance.casualRemaining
                        : leaveBalance.annualRemaining;
                      return (
                        <button
                          key={type}
                          onClick={() => setLeaveType(type)}
                          className="relative p-3 rounded-lg text-center transition-all duration-200 text-xs font-semibold"
                          style={{
                            background: active
                              ? 'linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%)'
                              : 'var(--color-bg-tertiary)',
                            color: active ? 'white' : 'var(--color-text-primary)',
                            border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          }}
                        >
                          {type}
                          <span
                            className="block text-[10px] mt-0.5 font-normal"
                            style={{ color: active ? 'rgba(255,255,255,0.7)' : 'var(--color-text-tertiary)' }}
                          >
                            {remaining} left
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">Date</label>
                  <input
                    type="date"
                    value={leaveDate}
                    onChange={e => setLeaveDate(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg"
                    min={toDateStr(new Date())}
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1.5">Reason</label>
                  <textarea
                    value={leaveReason}
                    onChange={e => setLeaveReason(e.target.value)}
                    placeholder="Brief reason for leave..."
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm rounded-lg resize-none"
                  />
                </div>

                {/* Monthly warning */}
                {leaveBalance.leavesThisMonth >= POLICY.maxLeavesPerMonth && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-400">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <span>You have already used {leaveBalance.leavesThisMonth} leaves this month. Additional leaves may result in salary deduction.</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowLeaveModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors"
                    style={{
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLeaveSubmit}
                    disabled={!leaveDate || !leaveReason.trim()}
                    className="px-5 py-2 text-xs font-bold text-white rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark, #E07B1F) 100%)',
                      boxShadow: '0 2px 10px rgba(242,140,40,0.3)',
                    }}
                  >
                    Submit Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePopup;
