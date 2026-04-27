import React, { useState, useMemo } from 'react';
import { EnrichedCase, User } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';

// ── Types ────────────────────────────────────────────────────────────────────
type BankAction =
  | 'Demand Notice'
  | 'Final Notice'
  | 'Civil Suit Filed'
  | 'Criminal Complaint'
  | 'Hearing Scheduled'
  | 'Judgment Passed'
  | 'Execution Filed'
  | 'Settlement Issued'
  | 'Bank Closed Case'
  | 'Other';

type EntryStatus = 'Active' | 'Closed';

interface BankLegalEntry {
  id: string;
  caseId: string;
  action: BankAction;
  bankReference: string;
  actionDate: string;
  nextHearingDate?: string;
  status: EntryStatus;
  notes: string;
  document?: { name: string; dataUrl: string };
  createdBy: string;
  createdAt: string;
}

interface LegalModuleProps {
  allCases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

// ── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'rv_bank_legal';
const load = (): BankLegalEntry[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const save = (d: BankLegalEntry[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const ACTION_OPTIONS: BankAction[] = [
  'Demand Notice',
  'Final Notice',
  'Civil Suit Filed',
  'Criminal Complaint',
  'Hearing Scheduled',
  'Judgment Passed',
  'Execution Filed',
  'Settlement Issued',
  'Bank Closed Case',
  'Other',
];

const ACTION_COLORS: Record<BankAction, string> = {
  'Demand Notice': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Final Notice': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Civil Suit Filed': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Criminal Complaint': 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'Hearing Scheduled': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Judgment Passed': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Execution Filed': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'Settlement Issued': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Bank Closed Case': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'Other': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const LegalModule: React.FC<LegalModuleProps> = ({ allCases, currentUser, onSelectCase }) => {
  const [entries, setEntries] = useState<BankLegalEntry[]>(load);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | EntryStatus>('all');
  const [search, setSearch] = useState('');

  // Form state
  const [formCaseId, setFormCaseId] = useState('');
  const [formAction, setFormAction] = useState<BankAction>('Demand Notice');
  const [formRef, setFormRef] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formNextHearing, setFormNextHearing] = useState('');
  const [formStatus, setFormStatus] = useState<EntryStatus>('Active');
  const [formNotes, setFormNotes] = useState('');
  const [formDoc, setFormDoc] = useState<{ name: string; dataUrl: string } | null>(null);

  const resetForm = () => {
    setFormCaseId(''); setFormAction('Demand Notice'); setFormRef(''); setFormDate('');
    setFormNextHearing(''); setFormStatus('Active'); setFormNotes(''); setFormDoc(null);
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (e: BankLegalEntry) => {
    setEditingId(e.id);
    setFormCaseId(e.caseId);
    setFormAction(e.action);
    setFormRef(e.bankReference);
    setFormDate(e.actionDate);
    setFormNextHearing(e.nextHearingDate || '');
    setFormStatus(e.status);
    setFormNotes(e.notes);
    setFormDoc(e.document || null);
    setShowForm(true);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFormDoc({ name: f.name, dataUrl: reader.result as string });
    reader.readAsDataURL(f);
  };

  const handleSave = () => {
    if (!formCaseId || !formRef || !formDate) return;
    if (editingId) {
      const updated = entries.map(e => e.id === editingId ? {
        ...e,
        caseId: formCaseId,
        action: formAction,
        bankReference: formRef,
        actionDate: formDate,
        nextHearingDate: formNextHearing || undefined,
        status: formStatus,
        notes: formNotes,
        document: formDoc || undefined,
      } : e);
      setEntries(updated);
      save(updated);
    } else {
      const newEntry: BankLegalEntry = {
        id: genId(),
        caseId: formCaseId,
        action: formAction,
        bankReference: formRef,
        actionDate: formDate,
        nextHearingDate: formNextHearing || undefined,
        status: formStatus,
        notes: formNotes,
        document: formDoc || undefined,
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
      };
      const updated = [newEntry, ...entries];
      setEntries(updated);
      save(updated);
    }
    setShowForm(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this bank legal entry?')) return;
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    save(updated);
  };

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterAction !== 'all' && e.action !== filterAction) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (search) {
        const c = allCases.find(x => x.id === e.caseId);
        const q = search.toLowerCase();
        if (!e.bankReference.toLowerCase().includes(q) &&
            !c?.debtor.name.toLowerCase().includes(q) &&
            !c?.loan.accountNumber.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [entries, filterAction, filterStatus, search, allCases]);

  const stats = useMemo(() => ({
    total: entries.length,
    active: entries.filter(e => e.status === 'Active').length,
    courtCases: entries.filter(e => e.action === 'Civil Suit Filed' || e.action === 'Criminal Complaint').length,
    upcomingHearings: entries.filter(e => e.nextHearingDate && new Date(e.nextHearingDate) >= new Date() && e.status === 'Active').length,
    closed: entries.filter(e => e.status === 'Closed').length,
  }), [entries]);

  const upcomingHearings = useMemo(() => {
    return entries
      .filter(e => e.nextHearingDate && new Date(e.nextHearingDate) >= new Date() && e.status === 'Active')
      .sort((a, b) => new Date(a.nextHearingDate!).getTime() - new Date(b.nextHearingDate!).getTime())
      .slice(0, 5);
  }, [entries]);

  const getCase = (id: string) => allCases.find(c => c.id === id);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.documentReport('w-7 h-7')}
            Bank Legal Tracker
          </h1>
          <p className="text-sm text-text-secondary mt-1">Track legal actions taken by the bank on each case</p>
        </div>
        <button onClick={openAdd} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2">
          {ICONS.plus('w-4 h-4')} Log Bank Action
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Entries', value: stats.total, color: 'text-text-primary' },
          { label: 'Active', value: stats.active, color: 'text-blue-600' },
          { label: 'Court Cases', value: stats.courtCases, color: 'text-red-600' },
          { label: 'Upcoming Hearings', value: stats.upcomingHearings, color: 'text-orange-600' },
          { label: 'Closed', value: stats.closed, color: 'text-gray-500' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming hearings banner */}
      {upcomingHearings.length > 0 && (
        <div className="panel p-4 border-l-4 border-orange-400">
          <h3 className="text-sm font-bold text-text-primary mb-2">Upcoming Hearings</h3>
          <div className="space-y-1.5">
            {upcomingHearings.map(e => {
              const c = getCase(e.caseId);
              return (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <button onClick={() => onSelectCase(e.caseId)} className="font-semibold hover:text-[var(--color-primary)]">
                    {c?.debtor.name || 'Unknown'} — {c?.loan.accountNumber}
                  </button>
                  <span className="text-text-secondary">{e.action} • {formatDate(e.nextHearingDate!)} • Ref: {e.bankReference}</span>
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
            <h3 className="text-sm font-bold text-text-primary">{editingId ? 'Edit' : 'Log'} Bank Legal Action</h3>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-text-secondary hover:text-text-primary">{ICONS.close('w-5 h-5')}</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Case *</label>
              <select value={formCaseId} onChange={e => setFormCaseId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg">
                <option value="">Select case</option>
                {allCases.slice(0, 200).map(c => (
                  <option key={c.id} value={c.id}>{c.debtor.name} — {c.loan.accountNumber} — {c.loan.bank}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Bank Action *</label>
              <select value={formAction} onChange={e => setFormAction(e.target.value as BankAction)} className="w-full px-3 py-2 text-sm rounded-lg">
                {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Bank Reference # *</label>
              <input value={formRef} onChange={e => setFormRef(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="e.g. ENBD-LEG-2024-0042" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Action Date *</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Next Hearing (if any)</label>
              <input type="date" value={formNextHearing} onChange={e => setFormNextHearing(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Status</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value as EntryStatus)} className="w-full px-3 py-2 text-sm rounded-lg">
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-lg resize-none" placeholder="Anything bank told you about this action..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Attach Document (optional)</label>
            <input type="file" onChange={handleFile} className="text-xs" />
            {formDoc && <p className="text-[11px] text-emerald-600 mt-1">✓ {formDoc.name}</p>}
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!formCaseId || !formRef || !formDate} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
              {editingId ? 'Update' : 'Save'} Entry
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search debtor / account / reference..." className="px-3 py-2 text-sm rounded-lg flex-1 min-w-[200px]" />
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Actions</option>
          {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-text-secondary text-sm">No bank legal entries found.</p>
          <p className="text-text-tertiary text-xs mt-1">Click "Log Bank Action" to add the first entry.</p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-tertiary)]">
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Debtor / Account</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Bank</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Bank Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Reference #</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Action Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Next Hearing</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Outstanding</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Doc</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const c = getCase(e.caseId);
                return (
                  <tr key={e.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]">
                    <td className="py-3 px-4">
                      {c ? (
                        <button onClick={() => onSelectCase(e.caseId)} className="text-left">
                          <p className="text-sm font-semibold hover:text-[var(--color-primary)]">{c.debtor.name}</p>
                          <p className="text-[11px] text-text-tertiary">{c.loan.accountNumber}</p>
                        </button>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-text-secondary">{c?.loan.bank || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${ACTION_COLORS[e.action]}`}>{e.action}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{e.bankReference}</td>
                    <td className="py-3 px-4 text-xs text-text-secondary">{formatDate(e.actionDate)}</td>
                    <td className="py-3 px-4 text-xs">
                      {e.nextHearingDate ? (
                        <span className={new Date(e.nextHearingDate) >= new Date() ? 'text-orange-600 font-semibold' : 'text-text-tertiary'}>
                          {formatDate(e.nextHearingDate)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">{c ? formatCurrency(c.loan.currentBalance, c.loan.currency) : '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${e.status === 'Active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {e.document ? (
                        <a href={e.document.dataUrl} download={e.document.name} className="text-xs text-[var(--color-primary)] hover:underline">View</a>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(e)} className="px-2 py-1 text-[10px] font-semibold rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400">Edit</button>
                        <button onClick={() => handleDelete(e.id)} className="px-2 py-1 text-[10px] font-semibold rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">Delete</button>
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

export default LegalModule;
