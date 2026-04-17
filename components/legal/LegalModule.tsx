import React, { useState, useMemo, useCallback } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';

// ── Types ────────────────────────────────────────────────────────────────────
type LegalStatus = 'Draft' | 'Sent' | 'Acknowledged' | 'Escalated' | 'Court Filed' | 'Judgment' | 'Closed';
type NoticeType = 'Demand Letter' | 'Final Warning' | 'Legal Notice' | 'Court Filing' | 'Settlement Offer' | 'NOC';

interface LegalNotice {
  id: string;
  caseId: string;
  type: NoticeType;
  status: LegalStatus;
  createdAt: string;
  sentAt?: string;
  acknowledgedAt?: string;
  dueDate: string;
  content: string;
  createdBy: string;
  notes: string;
}

interface CourtCase {
  id: string;
  caseId: string;
  courtName: string;
  caseNumber: string;
  filingDate: string;
  nextHearingDate?: string;
  status: 'Filed' | 'In Progress' | 'Adjourned' | 'Judgment Passed' | 'Executed' | 'Dismissed';
  judge?: string;
  lawyer: string;
  amount: number;
  currency: string;
  notes: string;
}

interface LegalModuleProps {
  allCases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

// ── Storage ──────────────────────────────────────────────────────────────────
const LEGAL_NOTICES_KEY = 'rv_legal_notices';
const COURT_CASES_KEY = 'rv_court_cases';

const loadData = <T,>(key: string): T[] => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const saveData = <T,>(key: string, data: T[]) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Notice Templates ─────────────────────────────────────────────────────────
const NOTICE_TEMPLATES: Record<NoticeType, (c: EnrichedCase) => string> = {
  'Demand Letter': (c) => `Dear ${c.debtor.name},\n\nThis letter serves as a formal demand for the outstanding amount of ${formatCurrency(c.loan.currentBalance, c.loan.currency)} on your ${c.loan.product} account (A/C: ${c.loan.accountNumber}) with ${c.loan.bank}.\n\nYou are required to settle this amount within 15 days from the date of this notice. Failure to do so may result in legal proceedings being initiated against you.\n\nPlease contact us at your earliest convenience to discuss payment arrangements.\n\nRegards,\nRecovery Department\nRecoVantage`,
  'Final Warning': (c) => `Dear ${c.debtor.name},\n\nDespite our previous communications, the amount of ${formatCurrency(c.loan.currentBalance, c.loan.currency)} remains unpaid on account ${c.loan.accountNumber}.\n\nThis is a FINAL WARNING. If payment is not received within 7 days, we will proceed with legal action without further notice.\n\nRegards,\nLegal Department\nRecoVantage`,
  'Legal Notice': (c) => `LEGAL NOTICE\n\nTo: ${c.debtor.name}\nSubject: Outstanding Liability of ${formatCurrency(c.loan.currentBalance, c.loan.currency)}\nAccount: ${c.loan.accountNumber}\nBank: ${c.loan.bank}\n\nYou are hereby notified that the above amount remains due and unpaid. Legal proceedings will be commenced in the competent court of law if payment is not made within 14 days.\n\nThis notice is issued without prejudice to our client's rights.\n\nAdvocate & Legal Advisors\nRecoVantage Legal Team`,
  'Court Filing': (c) => `COURT FILING MEMO\n\nDefendant: ${c.debtor.name}\nClaim Amount: ${formatCurrency(c.loan.currentBalance, c.loan.currency)}\nProduct: ${c.loan.product}\nAccount: ${c.loan.accountNumber}\n\nBasis of Claim: Default on ${c.loan.product} agreement. Debtor has failed to respond to demand letters and legal notices.`,
  'Settlement Offer': (c) => `Dear ${c.debtor.name},\n\nWe are writing to offer a settlement on your outstanding balance of ${formatCurrency(c.loan.currentBalance, c.loan.currency)}.\n\nWe are prepared to accept a one-time settlement payment of ${formatCurrency(c.loan.currentBalance * 0.7, c.loan.currency)} (30% discount) if paid within 30 days.\n\nThis offer is valid for 30 days from the date of this letter.\n\nRegards,\nSettlement Department\nRecoVantage`,
  'NOC': (c) => `NO OBJECTION CERTIFICATE\n\nThis is to certify that ${c.debtor.name} has fully settled all outstanding dues on account ${c.loan.accountNumber} with ${c.loan.bank}.\n\nThe total settled amount was ${formatCurrency(c.loan.originalAmount, c.loan.currency)}.\n\nWe have no further claims against the above-named individual.\n\nDate: ${new Date().toLocaleDateString()}\n\nAuthorized Signatory\nRecoVantage`,
};

// ── Component ────────────────────────────────────────────────────────────────
const LegalModule: React.FC<LegalModuleProps> = ({ allCases, currentUser, onSelectCase }) => {
  const [activeTab, setActiveTab] = useState<'notices' | 'court' | 'create'>('notices');
  const [notices, setNotices] = useState<LegalNotice[]>(loadData(LEGAL_NOTICES_KEY));
  const [courtCases, setCourtCases] = useState<CourtCase[]>(loadData(COURT_CASES_KEY));

  // Create Notice form state
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('Demand Letter');
  const [noticeDueDate, setNoticeDueDate] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeNotes, setNoticeNotes] = useState('');

  // Create Court Case form state
  const [courtCaseId, setCourtCaseId] = useState('');
  const [courtName, setCourtName] = useState('');
  const [courtCaseNumber, setCourtCaseNumber] = useState('');
  const [courtFilingDate, setCourtFilingDate] = useState('');
  const [courtNextHearing, setCourtNextHearing] = useState('');
  const [courtLawyer, setCourtLawyer] = useState('');
  const [courtNotes, setCourtNotes] = useState('');

  const [filterStatus, setFilterStatus] = useState<string>('all');

  const selectedCase = useMemo(() => allCases.find(c => c.id === selectedCaseId), [allCases, selectedCaseId]);

  // Auto-fill template when case or type changes
  const handleGenerateTemplate = useCallback(() => {
    if (selectedCase) {
      setNoticeContent(NOTICE_TEMPLATES[noticeType](selectedCase));
    }
  }, [selectedCase, noticeType]);

  const handleCreateNotice = () => {
    if (!selectedCaseId || !noticeContent.trim() || !noticeDueDate) return;
    const newNotice: LegalNotice = {
      id: genId(),
      caseId: selectedCaseId,
      type: noticeType,
      status: 'Draft',
      createdAt: new Date().toISOString(),
      dueDate: noticeDueDate,
      content: noticeContent,
      createdBy: currentUser.name,
      notes: noticeNotes,
    };
    const updated = [newNotice, ...notices];
    setNotices(updated);
    saveData(LEGAL_NOTICES_KEY, updated);
    setSelectedCaseId(''); setNoticeContent(''); setNoticeNotes(''); setNoticeDueDate('');
    setActiveTab('notices');
  };

  const handleUpdateNoticeStatus = (id: string, newStatus: LegalStatus) => {
    const updated = notices.map(n => {
      if (n.id === id) {
        const patch: Partial<LegalNotice> = { status: newStatus };
        if (newStatus === 'Sent') patch.sentAt = new Date().toISOString();
        if (newStatus === 'Acknowledged') patch.acknowledgedAt = new Date().toISOString();
        return { ...n, ...patch };
      }
      return n;
    });
    setNotices(updated);
    saveData(LEGAL_NOTICES_KEY, updated);
  };

  const handleCreateCourtCase = () => {
    if (!courtCaseId || !courtName || !courtCaseNumber || !courtFilingDate || !courtLawyer) return;
    const caseData = allCases.find(c => c.id === courtCaseId);
    const newCC: CourtCase = {
      id: genId(),
      caseId: courtCaseId,
      courtName,
      caseNumber: courtCaseNumber,
      filingDate: courtFilingDate,
      nextHearingDate: courtNextHearing || undefined,
      status: 'Filed',
      lawyer: courtLawyer,
      amount: caseData?.loan.currentBalance || 0,
      currency: caseData?.loan.currency || 'AED',
      notes: courtNotes,
    };
    const updated = [newCC, ...courtCases];
    setCourtCases(updated);
    saveData(COURT_CASES_KEY, updated);
    setCourtCaseId(''); setCourtName(''); setCourtCaseNumber(''); setCourtFilingDate(''); setCourtNextHearing(''); setCourtLawyer(''); setCourtNotes('');
    setActiveTab('court');
  };

  const handleUpdateCourtStatus = (id: string, newStatus: CourtCase['status']) => {
    const updated = courtCases.map(c => c.id === id ? { ...c, status: newStatus } : c);
    setCourtCases(updated);
    saveData(COURT_CASES_KEY, updated);
  };

  const filteredNotices = useMemo(() => {
    return filterStatus === 'all' ? notices : notices.filter(n => n.status === filterStatus);
  }, [notices, filterStatus]);

  const getCaseInfo = (caseId: string) => allCases.find(c => c.id === caseId);

  const statusColors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    Sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Acknowledged: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Escalated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Court Filed': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Judgment: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500',
    Filed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'In Progress': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Adjourned: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'Judgment Passed': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Executed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Dismissed: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500',
  };

  // Stats
  const stats = useMemo(() => ({
    totalNotices: notices.length,
    drafts: notices.filter(n => n.status === 'Draft').length,
    sent: notices.filter(n => n.status === 'Sent').length,
    escalated: notices.filter(n => n.status === 'Escalated' || n.status === 'Court Filed').length,
    totalCourt: courtCases.length,
    upcomingHearings: courtCases.filter(c => c.nextHearingDate && new Date(c.nextHearingDate) >= new Date()).length,
  }), [notices, courtCases]);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.documentReport('w-7 h-7')}
            Legal Management
          </h1>
          <p className="text-sm text-text-secondary mt-1">Manage legal notices, court cases, and compliance documents</p>
        </div>
        <button
          onClick={() => setActiveTab('create')}
          className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2"
        >
          {ICONS.plus('w-4 h-4')} New Legal Action
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Notices', value: stats.totalNotices, color: 'text-text-primary' },
          { label: 'Drafts', value: stats.drafts, color: 'text-gray-500' },
          { label: 'Sent', value: stats.sent, color: 'text-blue-600' },
          { label: 'Escalated', value: stats.escalated, color: 'text-red-500' },
          { label: 'Court Cases', value: stats.totalCourt, color: 'text-purple-600' },
          { label: 'Upcoming Hearings', value: stats.upcomingHearings, color: 'text-amber-600' },
        ].map(kpi => (
          <div key={kpi.label} className="panel p-3">
            <p className="text-xs text-text-secondary">{kpi.label}</p>
            <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {(['notices', 'court', 'create'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
          >
            {tab === 'notices' ? 'Legal Notices' : tab === 'court' ? 'Court Cases' : 'Create New'}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Legal Notices ═══ */}
      {activeTab === 'notices' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {['all', 'Draft', 'Sent', 'Acknowledged', 'Escalated', 'Court Filed', 'Closed'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${filterStatus === s ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)] text-text-secondary hover:text-text-primary'}`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          {filteredNotices.length === 0 ? (
            <div className="panel p-12 text-center">
              <p className="text-text-secondary">No legal notices found.</p>
              <button onClick={() => setActiveTab('create')} className="btn-primary px-4 py-2 text-sm mt-3">Create First Notice</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotices.map(notice => {
                const caseInfo = getCaseInfo(notice.caseId);
                return (
                  <div key={notice.id} className="panel p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${statusColors[notice.status] || ''}`}>
                            {notice.status}
                          </span>
                          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-[var(--color-bg-tertiary)] text-text-secondary">
                            {notice.type}
                          </span>
                          <span className="text-xs text-text-tertiary">
                            {formatDate(notice.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2">
                          {caseInfo ? (
                            <button onClick={() => onSelectCase(notice.caseId)} className="text-sm font-semibold text-text-primary hover:text-[var(--color-primary)] transition-colors">
                              {caseInfo.debtor.name} — {caseInfo.loan.accountNumber}
                            </button>
                          ) : (
                            <span className="text-sm text-text-secondary">Case #{notice.caseId}</span>
                          )}
                          {caseInfo && (
                            <span className="text-xs text-text-tertiary ml-2">
                              {formatCurrency(caseInfo.loan.currentBalance, caseInfo.loan.currency)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{notice.content.substring(0, 120)}...</p>
                        <p className="text-[10px] text-text-tertiary mt-1">Due: {notice.dueDate} | By: {notice.createdBy}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {notice.status === 'Draft' && (
                          <button onClick={() => handleUpdateNoticeStatus(notice.id, 'Sent')} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors">
                            Mark Sent
                          </button>
                        )}
                        {notice.status === 'Sent' && (
                          <>
                            <button onClick={() => handleUpdateNoticeStatus(notice.id, 'Acknowledged')} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors">
                              Acknowledged
                            </button>
                            <button onClick={() => handleUpdateNoticeStatus(notice.id, 'Escalated')} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors">
                              Escalate
                            </button>
                          </>
                        )}
                        {(notice.status === 'Escalated') && (
                          <button onClick={() => handleUpdateNoticeStatus(notice.id, 'Court Filed')} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors">
                            File in Court
                          </button>
                        )}
                        {(notice.status !== 'Closed') && (
                          <button onClick={() => handleUpdateNoticeStatus(notice.id, 'Closed')} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 transition-colors">
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Court Cases ═══ */}
      {activeTab === 'court' && (
        <div className="space-y-4">
          {courtCases.length === 0 ? (
            <div className="panel p-12 text-center">
              <p className="text-text-secondary">No court cases filed yet.</p>
              <button onClick={() => setActiveTab('create')} className="btn-primary px-4 py-2 text-sm mt-3">File Court Case</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-bg-tertiary)]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Case #</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Debtor</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Court</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Next Hearing</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Lawyer</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courtCases.map(cc => {
                    const caseInfo = getCaseInfo(cc.caseId);
                    return (
                      <tr key={cc.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]">
                        <td className="py-3 px-4 font-mono text-xs font-semibold">{cc.caseNumber}</td>
                        <td className="py-3 px-4">
                          {caseInfo ? (
                            <button onClick={() => onSelectCase(cc.caseId)} className="text-sm font-medium text-text-primary hover:text-[var(--color-primary)]">
                              {caseInfo.debtor.name}
                            </button>
                          ) : <span className="text-text-tertiary">--</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-text-secondary">{cc.courtName}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${statusColors[cc.status] || ''}`}>{cc.status}</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold">{formatCurrency(cc.amount, cc.currency)}</td>
                        <td className="py-3 px-4 text-xs text-text-secondary">{cc.nextHearingDate || '--'}</td>
                        <td className="py-3 px-4 text-xs text-text-secondary">{cc.lawyer}</td>
                        <td className="py-3 px-4">
                          <select
                            value={cc.status}
                            onChange={(e) => handleUpdateCourtStatus(cc.id, e.target.value as CourtCase['status'])}
                            className="text-[11px] rounded-lg px-2 py-1"
                          >
                            {['Filed', 'In Progress', 'Adjourned', 'Judgment Passed', 'Executed', 'Dismissed'].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Create New ═══ */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Legal Notice */}
          <div className="panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              {ICONS.documentReport('w-5 h-5')} Create Legal Notice
            </h3>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Select Case</label>
              <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg">
                <option value="">-- Select a case --</option>
                {allCases.slice(0, 100).map(c => (
                  <option key={c.id} value={c.id}>{c.debtor.name} — {c.loan.accountNumber} ({formatCurrency(c.loan.currentBalance, c.loan.currency)})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notice Type</label>
                <select value={noticeType} onChange={e => setNoticeType(e.target.value as NoticeType)} className="w-full px-3 py-2.5 text-sm rounded-lg">
                  {(['Demand Letter', 'Final Warning', 'Legal Notice', 'Court Filing', 'Settlement Offer', 'NOC'] as NoticeType[]).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Due Date</label>
                <input type="date" value={noticeDueDate} onChange={e => setNoticeDueDate(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg" />
              </div>
            </div>

            <button onClick={handleGenerateTemplate} disabled={!selectedCaseId} className="text-xs font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-40">
              Auto-generate from template
            </button>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Notice Content</label>
              <textarea value={noticeContent} onChange={e => setNoticeContent(e.target.value)} rows={8} className="w-full px-3 py-2.5 text-sm rounded-lg resize-none font-mono" placeholder="Type or generate from template..." />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Internal Notes</label>
              <input type="text" value={noticeNotes} onChange={e => setNoticeNotes(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg" placeholder="Optional notes..." />
            </div>

            <button onClick={handleCreateNotice} disabled={!selectedCaseId || !noticeContent.trim() || !noticeDueDate} className="btn-primary w-full py-2.5 text-sm disabled:opacity-40">
              Create Legal Notice
            </button>
          </div>

          {/* Create Court Case */}
          <div className="panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>
              File Court Case
            </h3>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Select Case</label>
              <select value={courtCaseId} onChange={e => setCourtCaseId(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg">
                <option value="">-- Select a case --</option>
                {allCases.slice(0, 100).map(c => (
                  <option key={c.id} value={c.id}>{c.debtor.name} — {c.loan.accountNumber}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Court Name</label>
                <input type="text" value={courtName} onChange={e => setCourtName(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg" placeholder="e.g. Dubai Civil Court" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Case Number</label>
                <input type="text" value={courtCaseNumber} onChange={e => setCourtCaseNumber(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg" placeholder="e.g. CC-2026-1234" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Filing Date</label>
                <input type="date" value={courtFilingDate} onChange={e => setCourtFilingDate(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Next Hearing</label>
                <input type="date" value={courtNextHearing} onChange={e => setCourtNextHearing(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Lawyer / Legal Firm</label>
              <input type="text" value={courtLawyer} onChange={e => setCourtLawyer(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg" placeholder="e.g. Al Tamimi & Associates" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
              <textarea value={courtNotes} onChange={e => setCourtNotes(e.target.value)} rows={3} className="w-full px-3 py-2.5 text-sm rounded-lg resize-none" placeholder="Case details..." />
            </div>

            <button onClick={handleCreateCourtCase} disabled={!courtCaseId || !courtName || !courtCaseNumber || !courtFilingDate || !courtLawyer} className="btn-primary w-full py-2.5 text-sm disabled:opacity-40">
              File Court Case
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalModule;
