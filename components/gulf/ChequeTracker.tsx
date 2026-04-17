import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';

// ── Types ────────────────────────────────────────────────────────────────────
type ChequeStatus = 'Received' | 'Deposited' | 'Cleared' | 'Bounced' | 'Replaced' | 'Cancelled' | 'Post-Dated';
type ChequeType = 'Personal Cheque' | 'Manager Cheque' | 'Cashier Cheque' | 'Post-Dated Cheque' | 'Bank Draft';

interface Cheque {
  id: string;
  caseId: string;
  chequeNumber: string;
  type: ChequeType;
  bank: string;
  amount: number;
  currency: string;
  issueDate: string;
  depositDate?: string;
  clearanceDate?: string;
  bounceDate?: string;
  status: ChequeStatus;
  postDatedDate?: string;
  bounceReason?: string;
  replacedById?: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

interface ChequeTrackerProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

// ── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'rv_cheques';
const load = (): Cheque[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const save = (d: Cheque[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const genId = () => `chq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Component ────────────────────────────────────────────────────────────────
const ChequeTracker: React.FC<ChequeTrackerProps> = ({ cases, currentUser, onSelectCase }) => {
  const [cheques, setCheques] = useState<Cheque[]>(load);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state
  const [formCaseId, setFormCaseId] = useState('');
  const [formChequeNo, setFormChequeNo] = useState('');
  const [formType, setFormType] = useState<ChequeType>('Personal Cheque');
  const [formBank, setFormBank] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('AED');
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formPostDated, setFormPostDated] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const handleAdd = () => {
    if (!formCaseId || !formChequeNo || !formBank || !formAmount || !formIssueDate) return;
    const isPostDated = formType === 'Post-Dated Cheque' && formPostDated;
    const newCheque: Cheque = {
      id: genId(),
      caseId: formCaseId,
      chequeNumber: formChequeNo,
      type: formType,
      bank: formBank,
      amount: parseFloat(formAmount),
      currency: formCurrency,
      issueDate: formIssueDate,
      status: isPostDated ? 'Post-Dated' : 'Received',
      postDatedDate: isPostDated ? formPostDated : undefined,
      notes: formNotes,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };
    const updated = [newCheque, ...cheques];
    setCheques(updated);
    save(updated);
    setShowForm(false);
    setFormCaseId(''); setFormChequeNo(''); setFormBank(''); setFormAmount(''); setFormIssueDate(''); setFormPostDated(''); setFormNotes('');
  };

  const updateStatus = (id: string, newStatus: ChequeStatus, extra?: Partial<Cheque>) => {
    const updated = cheques.map(c => {
      if (c.id !== id) return c;
      const patch: Partial<Cheque> = { status: newStatus, ...extra };
      if (newStatus === 'Deposited') patch.depositDate = new Date().toISOString().split('T')[0];
      if (newStatus === 'Cleared') patch.clearanceDate = new Date().toISOString().split('T')[0];
      if (newStatus === 'Bounced') patch.bounceDate = new Date().toISOString().split('T')[0];
      return { ...c, ...patch };
    });
    setCheques(updated);
    save(updated);
  };

  const filtered = useMemo(() => filterStatus === 'all' ? cheques : cheques.filter(c => c.status === filterStatus), [cheques, filterStatus]);

  const stats = useMemo(() => ({
    total: cheques.length,
    received: cheques.filter(c => c.status === 'Received').length,
    deposited: cheques.filter(c => c.status === 'Deposited').length,
    cleared: cheques.filter(c => c.status === 'Cleared').length,
    bounced: cheques.filter(c => c.status === 'Bounced').length,
    postDated: cheques.filter(c => c.status === 'Post-Dated').length,
    totalAmount: cheques.filter(c => c.status !== 'Cancelled' && c.status !== 'Bounced').reduce((s, c) => s + c.amount, 0),
    clearedAmount: cheques.filter(c => c.status === 'Cleared').reduce((s, c) => s + c.amount, 0),
  }), [cheques]);

  const statusColors: Record<string, string> = {
    'Received': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Deposited': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Cleared': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Bounced': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Replaced': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Cancelled': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    'Post-Dated': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };

  const getCaseInfo = (caseId: string) => cases.find(c => c.id === caseId);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.payment('w-7 h-7')}
            Cheque / PDC Tracker
          </h1>
          <p className="text-sm text-text-secondary mt-1">Track cheques from receipt to clearance or bounce</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2">
          {ICONS.plus('w-4 h-4')} Log Cheque
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '' },
          { label: 'Received', value: stats.received, color: 'text-blue-600' },
          { label: 'Deposited', value: stats.deposited, color: 'text-amber-600' },
          { label: 'Cleared', value: stats.cleared, color: 'text-emerald-600' },
          { label: 'Bounced', value: stats.bounced, color: 'text-red-600' },
          { label: 'Post-Dated', value: stats.postDated, color: 'text-orange-600' },
          { label: 'Pipeline', value: formatCurrency(stats.totalAmount, 'AED'), color: 'text-text-primary' },
          { label: 'Cleared Amt', value: formatCurrency(stats.clearedAmount, 'AED'), color: 'text-emerald-600' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-base font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Add Cheque Form */}
      {showForm && (
        <div className="panel p-5 space-y-4 animate-fade-in-up">
          <h3 className="text-sm font-bold text-text-primary">Log New Cheque</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Case</label>
              <select value={formCaseId} onChange={e => setFormCaseId(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg">
                <option value="">Select case</option>
                {cases.slice(0, 100).map(c => <option key={c.id} value={c.id}>{c.debtor.name} — {c.loan.accountNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Cheque #</label>
              <input value={formChequeNo} onChange={e => setFormChequeNo(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="CHQ-00123" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value as ChequeType)} className="w-full px-3 py-2 text-sm rounded-lg">
                {['Personal Cheque', 'Manager Cheque', 'Cashier Cheque', 'Post-Dated Cheque', 'Bank Draft'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Bank</label>
              <input value={formBank} onChange={e => setFormBank(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="e.g. Emirates NBD" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Amount</label>
              <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Currency</label>
              <select value={formCurrency} onChange={e => setFormCurrency(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg">
                {['AED', 'SAR', 'BHD', 'KWD', 'QAR', 'OMR'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Issue Date</label>
              <input type="date" value={formIssueDate} onChange={e => setFormIssueDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" />
            </div>
            {formType === 'Post-Dated Cheque' && (
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Post-Dated To</label>
                <input type="date" value={formPostDated} onChange={e => setFormPostDated(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
            <input value={formNotes} onChange={e => setFormNotes(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg" placeholder="Optional notes..." />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!formCaseId || !formChequeNo || !formAmount || !formIssueDate || !formBank} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">Save Cheque</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'Received', 'Deposited', 'Cleared', 'Bounced', 'Post-Dated', 'Replaced', 'Cancelled'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${filterStatus === s ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)] text-text-secondary'}`}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-text-secondary">No cheques found.</p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-tertiary)]">
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Cheque #</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Debtor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Bank</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Issue Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(chq => {
                const caseInfo = getCaseInfo(chq.caseId);
                return (
                  <tr key={chq.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]">
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{chq.chequeNumber}</td>
                    <td className="py-3 px-4">
                      {caseInfo ? <button onClick={() => onSelectCase(chq.caseId)} className="text-sm font-medium hover:text-[var(--color-primary)]">{caseInfo.debtor.name}</button> : '--'}
                    </td>
                    <td className="py-3 px-4 text-xs text-text-secondary">{chq.type}</td>
                    <td className="py-3 px-4 text-xs text-text-secondary">{chq.bank}</td>
                    <td className="py-3 px-4 text-xs font-semibold">{formatCurrency(chq.amount, chq.currency)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${statusColors[chq.status] || ''}`}>{chq.status}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-text-secondary">{chq.issueDate}{chq.postDatedDate && <span className="text-orange-500 ml-1">(PDC: {chq.postDatedDate})</span>}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {chq.status === 'Received' && <button onClick={() => updateStatus(chq.id, 'Deposited')} className="px-2 py-1 text-[10px] font-semibold rounded bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400">Deposit</button>}
                        {chq.status === 'Post-Dated' && <button onClick={() => updateStatus(chq.id, 'Deposited')} className="px-2 py-1 text-[10px] font-semibold rounded bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400">Deposit</button>}
                        {chq.status === 'Deposited' && (
                          <>
                            <button onClick={() => updateStatus(chq.id, 'Cleared')} className="px-2 py-1 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400">Cleared</button>
                            <button onClick={() => updateStatus(chq.id, 'Bounced', { bounceReason: 'Insufficient funds' })} className="px-2 py-1 text-[10px] font-semibold rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400">Bounced</button>
                          </>
                        )}
                        {chq.status === 'Bounced' && <button onClick={() => updateStatus(chq.id, 'Replaced')} className="px-2 py-1 text-[10px] font-semibold rounded bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400">Replaced</button>}
                        {!['Cleared', 'Cancelled'].includes(chq.status) && <button onClick={() => updateStatus(chq.id, 'Cancelled')} className="px-2 py-1 text-[10px] font-semibold rounded bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400">Cancel</button>}
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

export default ChequeTracker;
