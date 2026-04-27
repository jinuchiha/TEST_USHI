import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';

// ── Types ────────────────────────────────────────────────────────────────────
type VisitOutcome =
  | 'Met Debtor'
  | 'Family Member Met'
  | 'Not Available'
  | 'Refused to Pay'
  | 'PTP Given'
  | 'Locked Premises'
  | 'Wrong Address'
  | 'Premises Vacant'
  | 'Other';

type NextAction = 'Revisit' | 'Escalate' | 'Mark Untraceable' | 'Resolved' | 'None';

interface FieldVisit {
  id: string;
  caseId: string;
  officerId: string;
  officerName: string;
  visitDate: string;        // ISO datetime
  outcome: VisitOutcome;
  addressVisited: string;
  city: string;
  gpsLat?: number;
  gpsLng?: number;
  photo?: { name: string; dataUrl: string };
  notes: string;
  nextAction: NextAction;
  nextVisitDate?: string;
  ptpAmount?: number;
  createdAt: string;
}

interface FieldVisitModuleProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

// ── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'rv_field_visits';
const load = (): FieldVisit[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const save = (d: FieldVisit[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const genId = () => `fv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const OUTCOMES: VisitOutcome[] = [
  'Met Debtor', 'Family Member Met', 'PTP Given', 'Refused to Pay',
  'Not Available', 'Locked Premises', 'Wrong Address', 'Premises Vacant', 'Other',
];

const OUTCOME_COLORS: Record<VisitOutcome, string> = {
  'Met Debtor': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Family Member Met': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'PTP Given': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Refused to Pay': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Not Available': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Locked Premises': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Wrong Address': 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'Premises Vacant': 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  'Other': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const FieldVisitModule: React.FC<FieldVisitModuleProps> = ({ cases, currentUser, onSelectCase }) => {
  const [visits, setVisits] = useState<FieldVisit[]>(load);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [search, setSearch] = useState('');

  // Form
  const [formCaseId, setFormCaseId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [formOutcome, setFormOutcome] = useState<VisitOutcome>('Met Debtor');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formGpsLat, setFormGpsLat] = useState<number | null>(null);
  const [formGpsLng, setFormGpsLng] = useState<number | null>(null);
  const [formPhoto, setFormPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [formNotes, setFormNotes] = useState('');
  const [formNextAction, setFormNextAction] = useState<NextAction>('None');
  const [formNextDate, setFormNextDate] = useState('');
  const [formPtpAmount, setFormPtpAmount] = useState('');
  const [gpsCapturing, setGpsCapturing] = useState(false);

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const myVisits = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? visits.filter(v => v.officerId === currentUser.id)
      : visits;
  }, [visits, currentUser]);

  const selectedCase = useMemo(() => cases.find(c => c.id === formCaseId), [cases, formCaseId]);

  // Auto-fill address from debtor when case selected
  React.useEffect(() => {
    if (selectedCase && !formAddress) setFormAddress(selectedCase.debtor.address || '');
  }, [selectedCase]);

  const resetForm = () => {
    setFormCaseId(''); setFormDate(new Date().toISOString().slice(0, 16));
    setFormOutcome('Met Debtor'); setFormAddress(''); setFormCity('');
    setFormGpsLat(null); setFormGpsLng(null); setFormPhoto(null); setFormNotes('');
    setFormNextAction('None'); setFormNextDate(''); setFormPtpAmount('');
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (v: FieldVisit) => {
    setEditingId(v.id);
    setFormCaseId(v.caseId);
    setFormDate(v.visitDate.slice(0, 16));
    setFormOutcome(v.outcome);
    setFormAddress(v.addressVisited);
    setFormCity(v.city);
    setFormGpsLat(v.gpsLat ?? null);
    setFormGpsLng(v.gpsLng ?? null);
    setFormPhoto(v.photo || null);
    setFormNotes(v.notes);
    setFormNextAction(v.nextAction);
    setFormNextDate(v.nextVisitDate || '');
    setFormPtpAmount(v.ptpAmount ? String(v.ptpAmount) : '');
    setShowForm(true);
  };

  const captureGps = () => {
    if (!navigator.geolocation) { alert('GPS not supported on this device'); return; }
    setGpsCapturing(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormGpsLat(parseFloat(pos.coords.latitude.toFixed(6)));
        setFormGpsLng(parseFloat(pos.coords.longitude.toFixed(6)));
        setGpsCapturing(false);
      },
      err => { alert(`GPS error: ${err.message}`); setGpsCapturing(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFormPhoto({ name: f.name, dataUrl: reader.result as string });
    reader.readAsDataURL(f);
  };

  const handleSave = () => {
    if (!formCaseId || !formAddress || !formDate) return;
    const base = {
      caseId: formCaseId,
      visitDate: new Date(formDate).toISOString(),
      outcome: formOutcome,
      addressVisited: formAddress,
      city: formCity,
      gpsLat: formGpsLat ?? undefined,
      gpsLng: formGpsLng ?? undefined,
      photo: formPhoto || undefined,
      notes: formNotes,
      nextAction: formNextAction,
      nextVisitDate: formNextDate || undefined,
      ptpAmount: formPtpAmount ? parseFloat(formPtpAmount) : undefined,
    };

    if (editingId) {
      const updated = visits.map(v => v.id === editingId ? { ...v, ...base } : v);
      setVisits(updated); save(updated);
    } else {
      const newVisit: FieldVisit = {
        id: genId(),
        officerId: currentUser.id,
        officerName: currentUser.name,
        createdAt: new Date().toISOString(),
        ...base,
      };
      const updated = [newVisit, ...visits];
      setVisits(updated); save(updated);
    }
    setShowForm(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this visit log?')) return;
    const updated = visits.filter(v => v.id !== id);
    setVisits(updated); save(updated);
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return myVisits.filter(v => {
      if (filterOutcome !== 'all' && v.outcome !== filterOutcome) return false;
      if (filterDate !== 'all') {
        const vd = new Date(v.visitDate);
        const days = (now.getTime() - vd.getTime()) / 86400000;
        if (filterDate === 'today' && days > 1) return false;
        if (filterDate === 'week' && days > 7) return false;
        if (filterDate === 'month' && days > 30) return false;
      }
      if (search) {
        const c = cases.find(x => x.id === v.caseId);
        const q = search.toLowerCase();
        if (!c?.debtor.name.toLowerCase().includes(q) &&
            !c?.loan.accountNumber.toLowerCase().includes(q) &&
            !v.addressVisited.toLowerCase().includes(q) &&
            !v.city.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [myVisits, filterOutcome, filterDate, search, cases]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todays = myVisits.filter(v => v.visitDate.startsWith(today));
    const successful = myVisits.filter(v => ['Met Debtor', 'Family Member Met', 'PTP Given'].includes(v.outcome));
    const ptpVisits = myVisits.filter(v => v.outcome === 'PTP Given');
    const totalPtp = ptpVisits.reduce((s, v) => s + (v.ptpAmount || 0), 0);
    const upcomingRevisits = myVisits.filter(v => v.nextVisitDate && new Date(v.nextVisitDate) >= new Date()).length;
    return {
      total: myVisits.length,
      today: todays.length,
      successful: successful.length,
      successRate: myVisits.length > 0 ? Math.round((successful.length / myVisits.length) * 100) : 0,
      ptpCount: ptpVisits.length,
      ptpAmount: totalPtp,
      revisitsScheduled: upcomingRevisits,
    };
  }, [myVisits]);

  const upcomingVisits = useMemo(() => {
    return myVisits
      .filter(v => v.nextVisitDate && new Date(v.nextVisitDate) >= new Date())
      .sort((a, b) => new Date(a.nextVisitDate!).getTime() - new Date(b.nextVisitDate!).getTime())
      .slice(0, 5);
  }, [myVisits]);

  const getCase = (id: string) => cases.find(c => c.id === id);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.mapPin('w-7 h-7')}
            Field Visits
          </h1>
          <p className="text-sm text-text-secondary mt-1">Log debtor field visits with GPS, photo, and outcome</p>
        </div>
        <button onClick={openAdd} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2">
          {ICONS.plus('w-4 h-4')} Log Visit
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Visits', value: stats.total, color: 'text-text-primary' },
          { label: 'Today', value: stats.today, color: 'text-blue-600' },
          { label: 'Successful', value: stats.successful, color: 'text-emerald-600' },
          { label: 'Success Rate', value: `${stats.successRate}%`, color: stats.successRate >= 50 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'PTPs', value: stats.ptpCount, color: 'text-cyan-600' },
          { label: 'PTP Amount', value: formatCurrency(stats.ptpAmount, 'AED'), color: 'text-cyan-600' },
          { label: 'Revisits Due', value: stats.revisitsScheduled, color: 'text-orange-600' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-base font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Revisits */}
      {upcomingVisits.length > 0 && (
        <div className="panel p-4 border-l-4 border-orange-400">
          <h3 className="text-sm font-bold text-text-primary mb-2">Scheduled Revisits</h3>
          <div className="space-y-1.5">
            {upcomingVisits.map(v => {
              const c = getCase(v.caseId);
              return (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <button onClick={() => onSelectCase(v.caseId)} className="font-semibold hover:text-[var(--color-primary)]">
                    {c?.debtor.name || 'Unknown'} — {c?.loan.accountNumber}
                  </button>
                  <span className="text-text-secondary">{formatDate(v.nextVisitDate!)} • {v.city || v.addressVisited.slice(0, 30)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="panel p-5 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">{editingId ? 'Edit' : 'Log'} Field Visit</h3>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-text-secondary hover:text-text-primary">{ICONS.close('w-5 h-5')}</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Case *</label>
              <select value={formCaseId} onChange={e => setFormCaseId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg">
                <option value="">Select case</option>
                {myCases.slice(0, 200).map(c => (
                  <option key={c.id} value={c.id}>{c.debtor.name} — {c.loan.accountNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Visit Date/Time *</label>
              <input type="datetime-local" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Outcome *</label>
              <select value={formOutcome} onChange={e => setFormOutcome(e.target.value as VisitOutcome)} className="w-full px-3 py-2 text-sm rounded-lg">
                {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-text-secondary mb-1">Address Visited *</label>
              <input value={formAddress} onChange={e => setFormAddress(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="Building, street, area..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">City / Emirate</label>
              <input value={formCity} onChange={e => setFormCity(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="Dubai / Sharjah / Karachi" />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={captureGps} disabled={gpsCapturing} className="btn-secondary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-40">
              {ICONS.mapPin('w-4 h-4')} {gpsCapturing ? 'Getting GPS...' : (formGpsLat ? 'Re-capture GPS' : 'Capture GPS')}
            </button>
            {formGpsLat !== null && formGpsLng !== null && (
              <a href={`https://maps.google.com/?q=${formGpsLat},${formGpsLng}`} target="_blank" rel="noopener" className="text-xs text-[var(--color-primary)] hover:underline">
                {formGpsLat.toFixed(5)}, {formGpsLng.toFixed(5)} (open in maps)
              </a>
            )}
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*" onChange={handlePhoto} className="text-xs" />
              {formPhoto && <span className="text-[11px] text-emerald-600">✓ {formPhoto.name}</span>}
            </div>
          </div>

          {formOutcome === 'PTP Given' && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">PTP Amount</label>
              <input type="number" value={formPtpAmount} onChange={e => setFormPtpAmount(e.target.value)} className="w-full sm:w-1/3 px-3 py-2 text-sm rounded-lg" placeholder="0.00" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-lg resize-none" placeholder="What happened on the visit..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Next Action</label>
              <select value={formNextAction} onChange={e => setFormNextAction(e.target.value as NextAction)} className="w-full px-3 py-2 text-sm rounded-lg">
                {(['None', 'Revisit', 'Escalate', 'Mark Untraceable', 'Resolved'] as NextAction[]).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {formNextAction === 'Revisit' && (
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Next Visit Date</label>
                <input type="date" value={formNextDate} onChange={e => setFormNextDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!formCaseId || !formAddress || !formDate} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
              {editingId ? 'Update' : 'Save'} Visit
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search debtor / account / address / city..." className="px-3 py-2 text-sm rounded-lg flex-1 min-w-[200px]" />
        <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Outcomes</option>
          {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <div className="flex bg-[var(--color-bg-tertiary)] rounded-lg p-0.5">
          {(['today', 'week', 'month', 'all'] as const).map(d => (
            <button key={d} onClick={() => setFilterDate(d)} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${filterDate === d ? 'bg-[var(--color-primary)] text-white' : 'text-text-secondary'}`}>
              {d === 'today' ? 'Today' : d === 'week' ? '7 Days' : d === 'month' ? '30 Days' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-text-secondary text-sm">No field visits in this range.</p>
          <p className="text-text-tertiary text-xs mt-1">Click "Log Visit" to record one.</p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-tertiary)]">
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Debtor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Outcome</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Address</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">City</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">GPS</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Officer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Next</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Photo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const c = getCase(v.caseId);
                return (
                  <tr key={v.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]">
                    <td className="py-3 px-4">
                      {c ? (
                        <button onClick={() => onSelectCase(v.caseId)} className="text-left">
                          <p className="text-sm font-semibold hover:text-[var(--color-primary)]">{c.debtor.name}</p>
                          <p className="text-[11px] text-text-tertiary">{c.loan.accountNumber}</p>
                        </button>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-text-secondary">
                      <p>{new Date(v.visitDate).toLocaleDateString()}</p>
                      <p className="text-[10px] text-text-tertiary">{new Date(v.visitDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${OUTCOME_COLORS[v.outcome]}`}>{v.outcome}</span>
                      {v.ptpAmount && <p className="text-[10px] text-cyan-600 font-semibold mt-1">PTP: {formatCurrency(v.ptpAmount, c?.loan.currency || 'AED')}</p>}
                    </td>
                    <td className="py-3 px-4 text-xs text-text-secondary max-w-[180px] truncate" title={v.addressVisited}>{v.addressVisited}</td>
                    <td className="py-3 px-4 text-xs">{v.city || '—'}</td>
                    <td className="py-3 px-4 text-xs">
                      {v.gpsLat && v.gpsLng ? (
                        <a href={`https://maps.google.com/?q=${v.gpsLat},${v.gpsLng}`} target="_blank" rel="noopener" className="text-[var(--color-primary)] hover:underline">Open</a>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-text-secondary">{v.officerName}</td>
                    <td className="py-3 px-4 text-xs">
                      {v.nextAction === 'None' ? '—' : (
                        <span className={`text-[11px] font-semibold ${v.nextAction === 'Escalate' ? 'text-red-600' : v.nextAction === 'Revisit' ? 'text-orange-600' : 'text-text-secondary'}`}>
                          {v.nextAction}
                          {v.nextVisitDate && <span className="text-text-tertiary block text-[10px]">{formatDate(v.nextVisitDate)}</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {v.photo ? (
                        <a href={v.photo.dataUrl} target="_blank" rel="noopener" className="text-xs text-[var(--color-primary)] hover:underline">View</a>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(v)} className="px-2 py-1 text-[10px] font-semibold rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400">Edit</button>
                        <button onClick={() => handleDelete(v.id)} className="px-2 py-1 text-[10px] font-semibold rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FieldVisitModule;
