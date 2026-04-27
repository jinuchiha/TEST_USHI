import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';
import {
  validateCNIC, cnicProvince, validatePakistanPhone, parseAddress,
  scoreContactability, PAKISTAN_PROVINCES, PK_DATA_SOURCES,
} from './pakistanHelpers';
import { findMerger } from './bankMergers';

// ── Types ────────────────────────────────────────────────────────────────────
interface TraceAttempt {
  id: string;
  caseId: string;
  source: string;            // NADRA / PTA / Truecaller / WhatsApp / etc
  query: string;             // CNIC / phone / name / address
  result: 'found' | 'partial' | 'not_found' | 'restricted';
  data: string;              // what was found
  timestamp: string;
  officerId: string;
  officerName: string;
  cost?: number;
}

interface FoundContact {
  id: string;
  caseId: string;
  type: 'phone' | 'whatsapp' | 'email' | 'address' | 'employer' | 'family' | 'social' | 'vehicle' | 'property';
  value: string;
  label?: string;            // father/brother/spouse, current job, etc
  source: string;
  confidence: 'High' | 'Medium' | 'Low';
  verified: boolean;
  attemptedAt?: string;      // last call/contact attempt
  attemptResult?: 'answered' | 'busy' | 'no_answer' | 'switched_off' | 'invalid';
  notes?: string;
  addedAt: string;
  addedBy: string;
}

// ── Storage ──────────────────────────────────────────────────────────────────
const ATTEMPTS_KEY = 'rv_pk_trace_attempts';
const CONTACTS_KEY = 'rv_pk_found_contacts';

const loadAttempts = (): TraceAttempt[] => { try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]'); } catch { return []; } };
const saveAttempts = (d: TraceAttempt[]) => { try { localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(d)); } catch {} };
const loadContacts = (): FoundContact[] => { try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); } catch { return []; } };
const saveContacts = (d: FoundContact[]) => { try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(d)); } catch {} };

const genId = () => `pk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

interface PakistanSkipTracingProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const PakistanSkipTracing: React.FC<PakistanSkipTracingProps> = ({ cases, currentUser, onSelectCase }) => {
  const [attempts, setAttempts] = useState<TraceAttempt[]>(loadAttempts);
  const [contacts, setContacts] = useState<FoundContact[]>(loadContacts);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [filterBand, setFilterBand] = useState<'all' | 'reachable' | 'partial' | 'difficult' | 'untraceable'>('all');
  const [search, setSearch] = useState('');

  // New contact form
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactType, setContactType] = useState<FoundContact['type']>('phone');
  const [contactValue, setContactValue] = useState('');
  const [contactLabel, setContactLabel] = useState('');
  const [contactSource, setContactSource] = useState('');
  const [contactConfidence, setContactConfidence] = useState<FoundContact['confidence']>('Medium');
  const [contactNotes, setContactNotes] = useState('');

  // Trace attempt form
  const [showAddAttempt, setShowAddAttempt] = useState(false);
  const [attemptSource, setAttemptSource] = useState('NADRA');
  const [attemptQuery, setAttemptQuery] = useState('');
  const [attemptResult, setAttemptResult] = useState<TraceAttempt['result']>('found');
  const [attemptData, setAttemptData] = useState('');
  const [attemptCost, setAttemptCost] = useState('');

  // ── Pre-filter to "tracing-needed" cases (Pakistanis defaulted from Gulf) ─
  const traceableCases = useMemo(() => {
    const myScope = currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
    return myScope.filter(c => {
      // Cases that need tracing: non-contactable OR no Pakistani phone yet OR untraced status
      const hasPkPhone = (c.debtor.phones || []).some(p => validatePakistanPhone(p).valid);
      return c.contactStatus === 'Non Contact' || !hasPkPhone || c.tracingStatus === 'Tracing Not Avail' || c.tracingStatus === 'Under Tracing';
    });
  }, [cases, currentUser]);

  // ── Per-case scoring ────────────────────────────────────────────────────
  const scoreFor = (c: EnrichedCase) => {
    const cnicCheck = validateCNIC(c.debtor.cnic);
    const pkPhones = (c.debtor.phones || []).filter(p => validatePakistanPhone(p).valid);
    const caseContacts = contacts.filter(x => x.caseId === c.id);
    const caseAttempts = attempts.filter(x => x.caseId === c.id);
    const failedAttempts = caseAttempts.filter(a => a.result === 'not_found' || a.result === 'restricted').length;
    const lastSuccess = caseContacts.find(c => c.attemptResult === 'answered');
    const daysSince = lastSuccess?.attemptedAt
      ? Math.floor((Date.now() - new Date(lastSuccess.attemptedAt).getTime()) / 86400000)
      : null;

    return scoreContactability({
      hasCnic: !!c.debtor.cnic,
      cnicValid: cnicCheck.valid,
      pkPhonesCount: pkPhones.length + caseContacts.filter(x => x.type === 'phone' && x.verified).length,
      hasAddress: !!c.debtor.address,
      addressVerified: caseContacts.some(x => x.type === 'address' && x.verified),
      hasFamilyContact: caseContacts.some(x => x.type === 'family'),
      hasEmployer: caseContacts.some(x => x.type === 'employer'),
      hasSocialProfile: caseContacts.some(x => x.type === 'social'),
      hasWhatsapp: caseContacts.some(x => x.type === 'whatsapp'),
      daysSinceLastSuccessfulContact: daysSince,
      failedAttempts,
    });
  };

  // ── Filtered + scored list ──────────────────────────────────────────────
  const scoredList = useMemo(() => {
    return traceableCases
      .map(c => ({ case: c, scored: scoreFor(c) }))
      .filter(x => {
        if (filterBand !== 'all' && x.scored.band !== filterBand) return false;
        if (search) {
          const q = search.toLowerCase();
          const c = x.case;
          if (!c.debtor.name.toLowerCase().includes(q) &&
              !c.loan.accountNumber.toLowerCase().includes(q) &&
              !(c.debtor.cnic || '').toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.scored.score - a.scored.score);
  }, [traceableCases, contacts, attempts, filterBand, search]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = traceableCases.map(c => scoreFor(c));
    return {
      total: traceableCases.length,
      reachable: all.filter(s => s.band === 'reachable').length,
      partial: all.filter(s => s.band === 'partial').length,
      difficult: all.filter(s => s.band === 'difficult').length,
      untraceable: all.filter(s => s.band === 'untraceable').length,
    };
  }, [traceableCases, contacts, attempts]);

  // ── Selected case detail ────────────────────────────────────────────────
  const selectedCase = cases.find(c => c.id === selectedCaseId);
  const selectedScore = selectedCase ? scoreFor(selectedCase) : null;
  const selectedContacts = contacts.filter(c => c.caseId === selectedCaseId);
  const selectedAttempts = attempts.filter(a => a.caseId === selectedCaseId).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const cnicCheck = selectedCase ? validateCNIC(selectedCase.debtor.cnic) : null;
  const merger = selectedCase ? findMerger(selectedCase.loan.bank) : null;
  const parsedAddr = selectedCase ? parseAddress(selectedCase.debtor.address) : null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddContact = () => {
    if (!selectedCaseId || !contactValue || !contactSource) return;
    const newContact: FoundContact = {
      id: genId(),
      caseId: selectedCaseId,
      type: contactType,
      value: contactValue,
      label: contactLabel || undefined,
      source: contactSource,
      confidence: contactConfidence,
      verified: false,
      notes: contactNotes || undefined,
      addedAt: new Date().toISOString(),
      addedBy: currentUser.name,
    };
    const updated = [newContact, ...contacts];
    setContacts(updated);
    saveContacts(updated);
    setShowAddContact(false);
    setContactValue(''); setContactLabel(''); setContactSource(''); setContactNotes('');
  };

  const verifyContact = (id: string) => {
    const updated = contacts.map(c => c.id === id ? { ...c, verified: !c.verified } : c);
    setContacts(updated);
    saveContacts(updated);
  };

  const logAttemptOnContact = (id: string, result: NonNullable<FoundContact['attemptResult']>) => {
    const updated = contacts.map(c => c.id === id ? {
      ...c,
      attemptedAt: new Date().toISOString(),
      attemptResult: result,
      verified: c.verified || result === 'answered',
    } : c);
    setContacts(updated);
    saveContacts(updated);
  };

  const deleteContact = (id: string) => {
    if (!confirm('Remove this contact?')) return;
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    saveContacts(updated);
  };

  const handleAddAttempt = () => {
    if (!selectedCaseId || !attemptQuery) return;
    const newAttempt: TraceAttempt = {
      id: genId(),
      caseId: selectedCaseId,
      source: attemptSource,
      query: attemptQuery,
      result: attemptResult,
      data: attemptData,
      timestamp: new Date().toISOString(),
      officerId: currentUser.id,
      officerName: currentUser.name,
      cost: attemptCost ? parseFloat(attemptCost) : undefined,
    };
    const updated = [newAttempt, ...attempts];
    setAttempts(updated);
    saveAttempts(updated);
    setShowAddAttempt(false);
    setAttemptQuery(''); setAttemptData(''); setAttemptCost('');
  };

  const bandColor: Record<string, string> = {
    reachable: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    difficult: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    untraceable: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const typeIcon: Record<FoundContact['type'], string> = {
    phone: '📞', whatsapp: '💬', email: '✉️', address: '🏠', employer: '💼',
    family: '👪', social: '🌐', vehicle: '🚗', property: '🏘️',
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.search('w-7 h-7')}
            Pakistan Skip Tracing
          </h1>
          <p className="text-sm text-text-secondary mt-1">Trace Pakistani debtors who defaulted on Gulf bank loans</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Need Tracing', value: stats.total, color: 'text-text-primary' },
          { label: 'Reachable (70+)', value: stats.reachable, color: 'text-emerald-600' },
          { label: 'Partial (45-69)', value: stats.partial, color: 'text-amber-600' },
          { label: 'Difficult (20-44)', value: stats.difficult, color: 'text-orange-600' },
          { label: 'Untraceable (<20)', value: stats.untraceable, color: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── Case list ────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 panel overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
          <div className="p-3 border-b border-[var(--color-border)] space-y-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / CNIC / account..." className="w-full px-3 py-2 text-xs rounded-lg" />
            <div className="flex flex-wrap gap-1">
              {(['all', 'reachable', 'partial', 'difficult', 'untraceable'] as const).map(b => (
                <button key={b} onClick={() => setFilterBand(b)} className={`px-2.5 py-1 text-[10px] font-semibold rounded-full ${filterBand === b ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)] text-text-secondary'}`}>
                  {b === 'all' ? `All (${stats.total})` : b}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {scoredList.length === 0 ? (
              <p className="p-8 text-center text-xs text-text-secondary">No cases need tracing.</p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {scoredList.slice(0, 100).map(({ case: c, scored }) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full text-left p-3 hover:bg-[var(--color-bg-muted)] ${selectedCaseId === c.id ? 'bg-[var(--color-primary-glow)]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{c.debtor.name}</p>
                        <p className="text-[11px] text-text-tertiary">{c.loan.bank} • {c.loan.accountNumber}</p>
                        <p className="text-[10px] text-text-tertiary mt-0.5">{formatCurrency(c.loan.currentBalance, c.loan.currency)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${bandColor[scored.band]}`}>{scored.score}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {scoredList.length > 100 && (
                  <p className="p-3 text-center text-[10px] text-text-tertiary">Showing top 100 of {scoredList.length}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Detail panel ────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedCase ? (
            <div className="panel p-12 text-center">
              <p className="text-sm text-text-secondary">Select a case from left to start tracing.</p>
              <p className="text-xs text-text-tertiary mt-2">PK skip-tracing tools, sources, and contactability score will appear here.</p>
            </div>
          ) : (
            <>
              {/* Header card */}
              <div className="panel p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{selectedCase.debtor.name}</h2>
                    <button onClick={() => onSelectCase(selectedCase.id)} className="text-xs text-[var(--color-primary)] hover:underline">Open full case →</button>
                  </div>
                  {selectedScore && (
                    <div className="text-right">
                      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-white text-lg font-bold ${selectedScore.score >= 70 ? 'bg-emerald-500' : selectedScore.score >= 45 ? 'bg-amber-500' : selectedScore.score >= 20 ? 'bg-orange-500' : 'bg-red-500'}`}>
                        {selectedScore.score}
                      </div>
                      <p className={`text-[10px] font-bold uppercase mt-1 ${selectedScore.band === 'reachable' ? 'text-emerald-600' : selectedScore.band === 'partial' ? 'text-amber-600' : selectedScore.band === 'difficult' ? 'text-orange-600' : 'text-red-600'}`}>
                        {selectedScore.band}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bank merger banner */}
                {merger && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">⚠️ Bank merger note</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      <strong>{merger.original}</strong> merged into <strong>{merger.successor}</strong> on {merger.mergerDate}.
                      {merger.notes && <span className="block mt-0.5 italic">{merger.notes}</span>}
                    </p>
                  </div>
                )}

                {/* CNIC + address quick check */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-text-tertiary uppercase">CNIC</p>
                    {cnicCheck?.valid ? (
                      <div>
                        <p className="font-mono font-semibold">{cnicCheck.formatted}</p>
                        <p className="text-[10px] text-emerald-600">✓ Valid • Province: {cnicProvince(selectedCase.debtor.cnic)}</p>
                      </div>
                    ) : (
                      <p className="text-red-600 text-xs">{cnicCheck?.reason || 'No CNIC'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-text-tertiary uppercase">Pakistani Phone(s)</p>
                    {(selectedCase.debtor.phones || []).map((p, i) => {
                      const v = validatePakistanPhone(p);
                      return (
                        <p key={i} className="font-mono text-xs">
                          {v.valid ? <span className="text-emerald-600">✓ {v.formatted} ({v.operator})</span> : <span className="text-red-600">✗ {p} — {v.reason}</span>}
                        </p>
                      );
                    })}
                    {(selectedCase.debtor.phones || []).length === 0 && <p className="text-text-tertiary">None on file</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-text-tertiary uppercase">Address</p>
                    <p className="text-xs">{selectedCase.debtor.address || <span className="text-red-600">No address</span>}</p>
                    {parsedAddr && (parsedAddr.city || parsedAddr.province) && (
                      <p className="text-[10px] text-text-tertiary">Detected: {parsedAddr.city || '?'}, {parsedAddr.province || '?'}</p>
                    )}
                  </div>
                </div>

                {/* Score factors */}
                {selectedScore && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold text-text-secondary">Why this score?</summary>
                    <div className="mt-2 space-y-1">
                      {selectedScore.factors.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className={f.ok ? 'text-emerald-600' : 'text-text-tertiary'}>{f.ok ? '✓' : '○'} {f.label}</span>
                          <span className="font-mono">{f.ok ? '+' : ''}{f.weight}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* Found contacts */}
              <div className="panel">
                <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
                  <h3 className="text-sm font-bold">Found Contacts ({selectedContacts.length})</h3>
                  <button onClick={() => setShowAddContact(!showAddContact)} className="btn-primary px-3 py-1.5 text-xs">+ Add</button>
                </div>
                {showAddContact && (
                  <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={contactType} onChange={e => setContactType(e.target.value as FoundContact['type'])} className="px-2 py-1.5 text-xs rounded">
                        <option value="phone">📞 Phone</option>
                        <option value="whatsapp">💬 WhatsApp</option>
                        <option value="email">✉️ Email</option>
                        <option value="address">🏠 Address</option>
                        <option value="employer">💼 Employer</option>
                        <option value="family">👪 Family/Reference</option>
                        <option value="social">🌐 Social profile</option>
                        <option value="vehicle">🚗 Vehicle</option>
                        <option value="property">🏘️ Property</option>
                      </select>
                      <input value={contactValue} onChange={e => setContactValue(e.target.value)} placeholder="Number / address / name..." className="px-2 py-1.5 text-xs rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={contactLabel} onChange={e => setContactLabel(e.target.value)} placeholder="Label (father, brother, current job...)" className="px-2 py-1.5 text-xs rounded" />
                      <input value={contactSource} onChange={e => setContactSource(e.target.value)} placeholder="Source (NADRA / Truecaller / FB...)" className="px-2 py-1.5 text-xs rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={contactConfidence} onChange={e => setContactConfidence(e.target.value as FoundContact['confidence'])} className="px-2 py-1.5 text-xs rounded">
                        <option value="High">High confidence</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                      <input value={contactNotes} onChange={e => setContactNotes(e.target.value)} placeholder="Notes" className="flex-1 px-2 py-1.5 text-xs rounded" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddContact} disabled={!contactValue || !contactSource} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40">Save</button>
                      <button onClick={() => setShowAddContact(false)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                    </div>
                  </div>
                )}
                {selectedContacts.length === 0 ? (
                  <p className="p-6 text-center text-xs text-text-tertiary">No contacts found yet. Click + Add to log discovered info.</p>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {selectedContacts.map(c => (
                      <div key={c.id} className="p-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">
                            <span className="mr-1">{typeIcon[c.type]}</span>
                            {c.value}
                            {c.label && <span className="text-text-tertiary text-xs ml-2">({c.label})</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-tertiary">
                            <span>Source: {c.source}</span>
                            <span>•</span>
                            <span className={c.confidence === 'High' ? 'text-emerald-600 font-semibold' : c.confidence === 'Medium' ? 'text-amber-600' : 'text-red-600'}>{c.confidence}</span>
                            {c.attemptedAt && (
                              <>
                                <span>•</span>
                                <span>Last try: {c.attemptResult}</span>
                              </>
                            )}
                          </div>
                          {c.notes && <p className="text-[11px] text-text-secondary mt-1">{c.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {c.type === 'phone' && (
                            <>
                              <button onClick={() => logAttemptOnContact(c.id, 'answered')} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" title="Answered">✓</button>
                              <button onClick={() => logAttemptOnContact(c.id, 'no_answer')} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-50 text-gray-600 dark:bg-gray-800" title="No answer">⊘</button>
                              <button onClick={() => logAttemptOnContact(c.id, 'switched_off')} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-50 text-red-600 dark:bg-red-900/20" title="Off">✕</button>
                            </>
                          )}
                          <button onClick={() => verifyContact(c.id)} className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${c.verified ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'}`}>
                            {c.verified ? '✓ Verified' : 'Verify'}
                          </button>
                          <button onClick={() => deleteContact(c.id)} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-50 text-red-600 dark:bg-red-900/20">Del</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PK data sources reference */}
              <div className="panel p-4">
                <h3 className="text-sm font-bold mb-2">Pakistani Data Sources</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PK_DATA_SOURCES.map(s => (
                    <div key={s.code} className="text-xs p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
                      <p className="font-bold">{s.label}</p>
                      <p className="text-text-tertiary text-[10px] mt-0.5">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trace attempts log */}
              <div className="panel">
                <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
                  <h3 className="text-sm font-bold">Trace Attempts ({selectedAttempts.length})</h3>
                  <button onClick={() => setShowAddAttempt(!showAddAttempt)} className="btn-secondary px-3 py-1.5 text-xs">+ Log Attempt</button>
                </div>
                {showAddAttempt && (
                  <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={attemptSource} onChange={e => setAttemptSource(e.target.value)} className="px-2 py-1.5 text-xs rounded">
                        {PK_DATA_SOURCES.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                      </select>
                      <select value={attemptResult} onChange={e => setAttemptResult(e.target.value as TraceAttempt['result'])} className="px-2 py-1.5 text-xs rounded">
                        <option value="found">Found</option>
                        <option value="partial">Partial</option>
                        <option value="not_found">Not found</option>
                        <option value="restricted">Restricted access</option>
                      </select>
                    </div>
                    <input value={attemptQuery} onChange={e => setAttemptQuery(e.target.value)} placeholder="What did you query? (CNIC / phone / name)" className="w-full px-2 py-1.5 text-xs rounded" />
                    <textarea value={attemptData} onChange={e => setAttemptData(e.target.value)} rows={2} placeholder="What did you find?" className="w-full px-2 py-1.5 text-xs rounded resize-none" />
                    <div className="flex items-center gap-2">
                      <input type="number" value={attemptCost} onChange={e => setAttemptCost(e.target.value)} placeholder="Cost (PKR, optional)" className="w-32 px-2 py-1.5 text-xs rounded" />
                      <button onClick={handleAddAttempt} disabled={!attemptQuery} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40">Save Attempt</button>
                      <button onClick={() => setShowAddAttempt(false)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                    </div>
                  </div>
                )}
                {selectedAttempts.length === 0 ? (
                  <p className="p-6 text-center text-xs text-text-tertiary">No trace attempts logged.</p>
                ) : (
                  <div className="divide-y divide-[var(--color-border)] max-h-[300px] overflow-y-auto">
                    {selectedAttempts.map(a => (
                      <div key={a.id} className="p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{a.source} — <span className={a.result === 'found' ? 'text-emerald-600' : a.result === 'partial' ? 'text-amber-600' : 'text-red-600'}>{a.result}</span></p>
                          <span className="text-[10px] text-text-tertiary">{formatDate(a.timestamp)}</span>
                        </div>
                        <p className="text-[11px] text-text-tertiary">Query: {a.query}</p>
                        {a.data && <p className="text-[11px] mt-0.5">{a.data}</p>}
                        <p className="text-[10px] text-text-tertiary mt-0.5">By {a.officerName}{a.cost ? ` • Cost: PKR ${a.cost}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PakistanSkipTracing;
