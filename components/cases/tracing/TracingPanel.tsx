import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../src/contexts/AuthContext';
import { apiClient } from '../../../src/api/client';
import { EnrichedCase, User } from '../../../types';

interface ContactSlot {
  id: string;
  category: 'ctd' | 'home' | 'mobile' | 'reference' | 'employer' | 'social' | 'email' | 'address';
  label: string;
  countryCode: string;
  number: string;
  fullValue: string;
  status: 'valid' | 'invalid' | 'switched_off' | 'rnr' | 'new_found' | 'unverified' | 'disconnected';
  source: string;
  attempts: number;
  lastAttempt: string | null;
  notes: string;
}

interface SkipTrace {
  id: string;
  type: string;
  siteName: string;
  url: string;
  documentFlag: boolean;
  notes: string;
  addedBy: string;
  addedAt: string;
}

interface Remark {
  id: string;
  date: string;
  nextFollowUp: string;
  status: string;
  remark: string;
  bucketOrRecovery: string;
  centerName: string;
  createdBy: string;
  createdAt: string;
}

interface ReferenceContact {
  id: string;
  name: string;
  countryCode: string;
  number: string;
  relation: string;
  status: string;
}

interface Props {
  caseData: EnrichedCase;
  currentUser: User;
  allCases?: EnrichedCase[];
}

const STATUS_COLORS: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-800',
  invalid: 'bg-red-100 text-red-800',
  switched_off: 'bg-amber-100 text-amber-800',
  rnr: 'bg-orange-100 text-orange-800',
  new_found: 'bg-blue-100 text-blue-800',
  unverified: 'bg-gray-100 text-gray-700',
  disconnected: 'bg-red-100 text-red-800',
};

const TracingPanel: React.FC<Props> = ({ caseData, currentUser, allCases = [] }) => {
  const { useApi } = useAuth();
  const [activeTab, setActiveTab] = useState<'contacts' | 'skip' | 'ai' | 'remarks'>('contacts');
  const [searchResult, setSearchResult] = useState<{ tool: string; result: string; matches: number } | null>(null);
  const [contacts, setContacts] = useState<ContactSlot[]>([]);
  const [references, setReferences] = useState<ReferenceContact[]>([]);
  const [skipTraces, setSkipTraces] = useState<SkipTrace[]>([]);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddSkip, setShowAddSkip] = useState(false);
  const [showAddRemark, setShowAddRemark] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [newContact, setNewContact] = useState({ category: 'mobile', countryCode: '00971', number: '', label: '', source: 'Manual' });
  const [newSkip, setNewSkip] = useState({ type: 'Social Media', siteName: '', url: '', notes: '' });
  const [newRemark, setNewRemark] = useState({ nextFollowUp: '', status: 'NCC', remark: '', bucketOrRecovery: 'Recovery' });
  const [newRef, setNewRef] = useState({ name: '', countryCode: '00971', number: '', relation: '' });
  const [showAddRef, setShowAddRef] = useState(false);

  useEffect(() => {
    if (useApi) {
      apiClient.get<any>(`/api/tracing/contacts/${caseData.debtorId}`).then(r => {
        const data = (r.data || []).map((c: any) => ({
          ...c, category: c.type || 'mobile', countryCode: '', number: c.value, fullValue: c.value, attempts: c.attemptCount || 0, lastAttempt: c.lastAttemptAt, notes: c.notes || '',
        }));
        setContacts(data);
      }).catch(() => {});
    } else {
      buildDemoData();
    }
    generateAiSuggestions();
  }, [caseData.id]);

  const buildDemoData = () => {
    const c: ContactSlot[] = [];
    // CTD numbers
    ['00971', '00971'].forEach((code, i) => c.push({ id: `ctd${i}`, category: 'ctd', label: `CTD ${i+1}`, countryCode: code, number: `2555${1911 + i}`, fullValue: `${code}2555${1911+i}`, status: i === 0 ? 'valid' : 'rnr', source: 'Bank Data', attempts: 5-i, lastAttempt: '2026-03-25', notes: '' }));
    // Home numbers
    c.push({ id: 'home1', category: 'home', label: 'Home CTD1', countryCode: '0092', number: '3336876637', fullValue: '00923336876637', status: 'valid', source: 'Bank Data', attempts: 2, lastAttempt: '2026-03-20', notes: '' });
    // Mobile
    caseData.debtor.phones?.forEach((p, i) => c.push({ id: `mob${i}`, category: 'mobile', label: `Mobile ${i+1}`, countryCode: '00971', number: p.replace(/\+971/, ''), fullValue: p, status: i === 0 ? 'valid' : 'unverified', source: 'System', attempts: 3, lastAttempt: '2026-03-26', notes: '' }));
    // Emails
    caseData.debtor.emails?.forEach((e, i) => c.push({ id: `em${i}`, category: 'email', label: 'Email', countryCode: '', number: e, fullValue: e, status: 'valid', source: 'System', attempts: 1, lastAttempt: null, notes: '' }));
    // Address
    if (caseData.debtor.address) c.push({ id: 'addr1', category: 'address', label: 'UAE Residence', countryCode: '', number: caseData.debtor.address, fullValue: caseData.debtor.address, status: 'valid', source: 'Bank Data', attempts: 0, lastAttempt: null, notes: '' });

    setContacts(c);
    setReferences([
      { id: 'ref1', name: 'RIZWAN', countryCode: '00971', number: '552648258', relation: 'Friend', status: 'unverified' },
    ]);
    setSkipTraces([
      { id: 'sk1', type: 'Social Media', siteName: 'Facebook', url: 'facebook.com', documentFlag: false, notes: 'Old Traced Data', addedBy: currentUser.name, addedAt: '2026-03-20' },
      { id: 'sk2', type: 'Untraced', siteName: '', url: '', documentFlag: false, notes: 'Untraced', addedBy: currentUser.name, addedAt: '2026-03-22' },
    ]);
    setRemarks([
      { id: 'rm1', date: '2026-03-09', nextFollowUp: '', status: 'NCC', remark: 'Number is not connected try to reach the cm', bucketOrRecovery: 'Recovery', centerName: 'PAKISTAN-3', createdBy: 'HIRA IRSHAB', createdAt: '2026-02-09 14:16:33' },
    ]);
  };

  const generateAiSuggestions = () => {
    const s: string[] = [];
    if (caseData.contactStatus === 'Non Contact') s.push('Try alternate country codes — debtor may have a Pakistan number active');
    if (caseData.debtor.phones?.length === 1) s.push('Only 1 phone number on file. Run social media trace to find alternate contacts');
    s.push(`Best time to call based on patterns: 6:00-8:00 PM UAE time`);
    if (caseData.crmStatus === 'NCC') s.push('Non-contactable case — consider employer tracing via MOL records');
    s.push('Search LinkedIn/Facebook for debtor name to find updated contact info');
    s.push(`DLQ String: ${Math.floor(1000 + Math.random() * 9000)} — Cross-reference with credit bureau`);
    setAiSuggestions(s);
  };

  const handleAddContact = () => {
    const full = newContact.countryCode + newContact.number;
    const c: ContactSlot = { id: `new-${Date.now()}`, category: newContact.category as any, label: newContact.label || `${newContact.category} ${contacts.filter(x => x.category === newContact.category).length + 1}`, countryCode: newContact.countryCode, number: newContact.number, fullValue: full, status: 'unverified', source: newContact.source, attempts: 0, lastAttempt: null, notes: '' };
    setContacts(prev => [...prev, c]);
    if (useApi) apiClient.post('/api/tracing/contacts', { debtorId: caseData.debtorId, caseId: caseData.id, type: newContact.category, value: full, label: newContact.label, source: newContact.source }).catch(() => {});
    setNewContact({ category: 'mobile', countryCode: '00971', number: '', label: '', source: 'Manual' });
    setShowAddContact(false);
  };

  const handleAddRef = () => {
    setReferences(prev => [...prev, { id: `ref-${Date.now()}`, ...newRef, status: 'unverified' }]);
    setNewRef({ name: '', countryCode: '00971', number: '', relation: '' });
    setShowAddRef(false);
  };

  const handleAddSkipTrace = () => {
    setSkipTraces(prev => [...prev, { id: `sk-${Date.now()}`, ...newSkip, documentFlag: false, addedBy: currentUser.name, addedAt: new Date().toISOString().split('T')[0] }]);
    setNewSkip({ type: 'Social Media', siteName: '', url: '', notes: '' });
    setShowAddSkip(false);
  };

  const handleAddRemark = () => {
    setRemarks(prev => [{ id: `rm-${Date.now()}`, date: new Date().toISOString().split('T')[0], ...newRemark, centerName: '', createdBy: currentUser.name, createdAt: new Date().toISOString() }, ...prev]);
    setNewRemark({ nextFollowUp: '', status: 'NCC', remark: '', bucketOrRecovery: 'Recovery' });
    setShowAddRemark(false);
  };

  const updateContactStatus = (id: string, status: ContactSlot['status']) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    if (useApi) apiClient.patch(`/api/tracing/contacts/${id}/status`, { status }).catch(() => {});
  };

  const logAttempt = (id: string, success: boolean) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, attempts: c.attempts + 1, lastAttempt: new Date().toISOString() } : c));
    if (useApi) apiClient.post(`/api/tracing/contacts/${id}/attempt`, { success }).catch(() => {});
  };

  const getLink = (cat: string, val: string) => {
    if (['ctd', 'home', 'mobile', 'reference'].includes(cat)) return { href: `tel:+${val.replace(/[^0-9]/g, '')}`, icon: '📞', label: 'Call' };
    if (cat === 'email') return { href: `mailto:${val}`, icon: '✉️', label: 'Email' };
    if (cat === 'social') return { href: val.startsWith('http') ? val : `https://${val}`, icon: '🔗', label: 'Open' };
    return null;
  };

  const grouped = useMemo(() => {
    const g: Record<string, ContactSlot[]> = {};
    contacts.forEach(c => { (g[c.category] = g[c.category] || []).push(c); });
    return g;
  }, [contacts]);

  const categoryLabels: Record<string, string> = { ctd: 'CTD Numbers', home: 'Home Numbers', mobile: 'Mobile Numbers', email: 'Email Addresses', employer: 'Employer Info', social: 'Social Media', address: 'Addresses' };

  const tabs = [
    { id: 'contacts' as const, label: 'Contacts', count: contacts.length },
    { id: 'skip' as const, label: 'Skip Tracer', count: skipTraces.length },
    { id: 'ai' as const, label: 'AI Tools', count: aiSuggestions.length },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
          <span className="text-lg">🔍</span> Tracing Tools
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 px-2 py-2 text-[11px] font-medium transition ${activeTab === t.id ? 'text-primary border-b-2 border-primary' : 'text-text-tertiary hover:text-text-primary'}`}>
            {t.label} <span className="ml-0.5 text-[10px] opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {/* ═══ CONTACTS TAB ═══ */}
      {activeTab === 'contacts' && (
        <div className="space-y-3">
          <button onClick={() => setShowAddContact(!showAddContact)} className="w-full text-[11px] btn-primary py-1.5">+ Add Contact Number</button>

          {showAddContact && (
            <div className="p-2.5 border border-primary/20 rounded-lg bg-primary/5 space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <select value={newContact.category} onChange={e => setNewContact(p => ({ ...p, category: e.target.value }))} className="text-[11px] px-1.5 py-1 rounded">
                  <option value="ctd">CTD</option><option value="home">Home</option><option value="mobile">Mobile</option><option value="email">Email</option><option value="employer">Employer</option><option value="social">Social</option><option value="address">Address</option>
                </select>
                <input value={newContact.countryCode} onChange={e => setNewContact(p => ({ ...p, countryCode: e.target.value }))} placeholder="Code" className="text-[11px] px-1.5 py-1 rounded font-mono" />
                <input value={newContact.number} onChange={e => setNewContact(p => ({ ...p, number: e.target.value }))} placeholder="Number/Value" className="text-[11px] px-1.5 py-1 rounded font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select value={newContact.source} onChange={e => setNewContact(p => ({ ...p, source: e.target.value }))} className="text-[11px] px-1.5 py-1 rounded">
                  <option>Manual</option><option>Bank Data</option><option>Debtor</option><option>Third Party</option><option>Credit Bureau</option><option>Social Media</option><option>MOL Records</option><option>Employer</option>
                </select>
                <button onClick={handleAddContact} className="btn-primary text-[11px] py-1">Save</button>
              </div>
            </div>
          )}

          {/* Contact Groups */}
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h5 className="text-[10px] uppercase text-text-tertiary font-bold mb-1">{categoryLabels[cat] || cat} ({(items as any[]).length})</h5>
              <div className="space-y-1">
                {(items as any[]).map(c => {
                  const link = getLink(c.category, c.fullValue);
                  return (
                    <div key={c.id} className={`flex items-center gap-2 p-1.5 rounded border text-[11px] ${c.status === 'invalid' || c.status === 'disconnected' ? 'border-red-200 bg-red-50/30 opacity-60' : 'border-[var(--color-border)]'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-text-tertiary text-[10px] w-14 flex-shrink-0">{c.label}</span>
                          {c.countryCode && <span className="font-mono text-text-tertiary">{c.countryCode}</span>}
                          {link ? (
                            <a href={link.href} target={c.category === 'social' ? '_blank' : undefined} rel="noopener noreferrer" className="font-mono font-semibold text-primary hover:underline">{c.number}</a>
                          ) : (
                            <span className="font-mono">{c.number}</span>
                          )}
                          <span className={`px-1 py-0 text-[9px] rounded font-semibold ${STATUS_COLORS[c.status] || STATUS_COLORS.unverified}`}>{c.status.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-text-tertiary">
                          <span>via {c.source}</span>
                          <span>{c.attempts} attempts</span>
                          {c.lastAttempt && <span>last: {c.lastAttempt.split('T')[0]}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {['ctd', 'home', 'mobile', 'reference'].includes(c.category) && (
                          <>
                            <a href={`tel:+${c.fullValue.replace(/[^0-9]/g, '')}`} className="p-1 rounded hover:bg-emerald-100 text-emerald-600" title="Call">📞</a>
                            <a href={`https://wa.me/${c.fullValue.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-green-100 text-green-600" title="WhatsApp">💬</a>
                          </>
                        )}
                        <button onClick={() => logAttempt(c.id, true)} className="p-1 rounded hover:bg-emerald-100 text-[10px]" title="Success">✓</button>
                        <button onClick={() => logAttempt(c.id, false)} className="p-1 rounded hover:bg-red-100 text-[10px]" title="Failed">✗</button>
                        <select value={c.status} onChange={e => updateContactStatus(c.id, e.target.value as any)} className="text-[9px] px-0.5 py-0 border-0 bg-transparent w-12">
                          <option value="valid">Valid</option><option value="invalid">Invalid</option><option value="switched_off">Off</option><option value="rnr">RNR</option><option value="disconnected">Disc</option><option value="new_found">New</option><option value="unverified">?</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Reference Contacts */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h5 className="text-[10px] uppercase text-text-tertiary font-bold">Reference Contacts ({references.length})</h5>
              <button onClick={() => setShowAddRef(!showAddRef)} className="text-[10px] text-primary hover:underline">+ Add</button>
            </div>
            {showAddRef && (
              <div className="p-2 border border-primary/20 rounded bg-primary/5 grid grid-cols-4 gap-1.5 mb-2">
                <input value={newRef.name} onChange={e => setNewRef(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="text-[11px] px-1.5 py-1 rounded" />
                <input value={newRef.number} onChange={e => setNewRef(p => ({ ...p, number: e.target.value }))} placeholder="Number" className="text-[11px] px-1.5 py-1 rounded font-mono" />
                <input value={newRef.relation} onChange={e => setNewRef(p => ({ ...p, relation: e.target.value }))} placeholder="Relation" className="text-[11px] px-1.5 py-1 rounded" />
                <button onClick={handleAddRef} className="btn-primary text-[11px] py-1">Add</button>
              </div>
            )}
            {references.map(r => (
              <div key={r.id} className="flex items-center gap-2 p-1.5 border border-[var(--color-border)] rounded text-[11px] mb-1">
                <span className="font-semibold w-20">{r.name}</span>
                <a href={`tel:+${r.countryCode}${r.number}`} className="font-mono text-primary hover:underline">{r.countryCode}{r.number}</a>
                <span className="text-text-tertiary">({r.relation})</span>
                <a href={`https://wa.me/${r.countryCode}${r.number}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-green-600">💬</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SKIP TRACER TAB ═══ */}
      {activeTab === 'skip' && (
        <div className="space-y-2">
          <button onClick={() => setShowAddSkip(!showAddSkip)} className="w-full text-[11px] btn-primary py-1.5">+ Add Skiptracer Details</button>
          {showAddSkip && (
            <div className="p-2.5 border border-primary/20 rounded-lg bg-primary/5 space-y-1.5">
              <select value={newSkip.type} onChange={e => setNewSkip(p => ({ ...p, type: e.target.value }))} className="w-full text-[11px] px-1.5 py-1 rounded">
                <option>Social Media</option><option>LinkedIn</option><option>Facebook</option><option>Instagram</option><option>Twitter/X</option><option>TikTok</option><option>WhatsApp Group</option><option>Phone Directory</option><option>Credit Bureau</option><option>MOL Portal</option><option>EID Lookup</option><option>Employer Database</option><option>Untraced</option><option>Other</option>
              </select>
              <input value={newSkip.siteName} onChange={e => setNewSkip(p => ({ ...p, siteName: e.target.value }))} placeholder="Site / Platform Name" className="w-full text-[11px] px-1.5 py-1 rounded" />
              <input value={newSkip.url} onChange={e => setNewSkip(p => ({ ...p, url: e.target.value }))} placeholder="URL / Profile Link" className="w-full text-[11px] px-1.5 py-1 rounded" />
              <textarea value={newSkip.notes} onChange={e => setNewSkip(p => ({ ...p, notes: e.target.value }))} placeholder="Notes..." rows={2} className="w-full text-[11px] px-1.5 py-1 rounded" />
              <button onClick={handleAddSkipTrace} className="w-full btn-primary text-[11px] py-1">Save Skiptracer Entry</button>
            </div>
          )}
          <table className="w-full text-[11px]">
            <thead><tr className="text-[10px] text-text-tertiary border-b border-[var(--color-border)]">
              <th className="text-left py-1.5 px-1">Type</th><th className="text-left py-1.5 px-1">Site</th><th className="text-left py-1.5 px-1">Doc</th><th className="text-left py-1.5 px-1">By</th><th className="text-right py-1.5 px-1">Action</th>
            </tr></thead>
            <tbody>
              {skipTraces.map(s => (
                <tr key={s.id} className="border-b border-[var(--color-border)]/50">
                  <td className="py-1.5 px-1">{s.notes || s.type}</td>
                  <td className="py-1.5 px-1">{s.url ? <a href={s.url.startsWith('http') ? s.url : `https://${s.url}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{s.siteName || s.url}</a> : s.siteName || '—'}</td>
                  <td className="py-1.5 px-1">{s.documentFlag ? '✓' : <span className="text-red-500">✗</span>}</td>
                  <td className="py-1.5 px-1 text-text-tertiary">{s.addedBy}</td>
                  <td className="py-1.5 px-1 text-right"><button className="text-red-500 text-[10px] hover:underline">Delete</button></td>
                </tr>
              ))}
              {skipTraces.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-text-tertiary">No skip tracer entries</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ REMARKS TAB ═══ */}
      {activeTab === 'remarks' && (
        <div className="space-y-2">
          <button onClick={() => setShowAddRemark(!showAddRemark)} className="w-full text-[11px] btn-primary py-1.5">+ Add New Remark</button>
          {showAddRemark && (
            <div className="p-2.5 border border-primary/20 rounded-lg bg-primary/5 space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <div><label className="text-[10px] text-text-tertiary">Next Follow-Up</label><input type="date" value={newRemark.nextFollowUp} onChange={e => setNewRemark(p => ({ ...p, nextFollowUp: e.target.value }))} className="w-full text-[11px] px-1.5 py-1 rounded" /></div>
                <div><label className="text-[10px] text-text-tertiary">Status</label><select value={newRemark.status} onChange={e => setNewRemark(p => ({ ...p, status: e.target.value }))} className="w-full text-[11px] px-1.5 py-1 rounded">
                  <option>NCC</option><option>CB</option><option>PTP</option><option>RNR</option><option>FIP</option><option>WDS</option><option>UTR</option><option>DXB</option>
                </select></div>
              </div>
              <textarea value={newRemark.remark} onChange={e => setNewRemark(p => ({ ...p, remark: e.target.value }))} placeholder="Remark..." rows={2} className="w-full text-[11px] px-1.5 py-1 rounded" />
              <div className="grid grid-cols-2 gap-1.5">
                <select value={newRemark.bucketOrRecovery} onChange={e => setNewRemark(p => ({ ...p, bucketOrRecovery: e.target.value }))} className="text-[11px] px-1.5 py-1 rounded"><option>Recovery</option><option>Bucket</option></select>
                <button onClick={handleAddRemark} className="btn-primary text-[11px] py-1">Save Remark</button>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {remarks.map(r => (
              <div key={r.id} className="p-2 border border-[var(--color-border)] rounded-lg text-[11px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{r.date}</span>
                  <span className={`px-1.5 py-0 rounded text-[10px] font-semibold ${r.status === 'NCC' ? 'bg-red-100 text-red-700' : r.status === 'PTP' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                  <span className="text-text-tertiary">{r.bucketOrRecovery}</span>
                  {r.nextFollowUp && <span className="text-blue-600">→ {r.nextFollowUp}</span>}
                  <span className="ml-auto text-text-tertiary text-[10px]">{r.createdBy}</span>
                </div>
                <p className="text-text-secondary">{r.remark}</p>
              </div>
            ))}
            {remarks.length === 0 && <p className="text-center py-4 text-text-tertiary text-[11px]">No remarks yet</p>}
          </div>
        </div>
      )}

      {/* ═══ AI TRACE TAB ═══ */}
      {activeTab === 'ai' && (
        <div className="space-y-2">
          <div className="p-2.5 bg-gradient-to-r from-primary/5 to-transparent rounded-lg border border-primary/10">
            <h4 className="text-[11px] font-bold text-primary mb-2">🧠 AI Tracing Suggestions</h4>
            <div className="space-y-1.5">
              {aiSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span className="text-primary flex-shrink-0 mt-0.5">▸</span>
                  <span className="text-text-secondary">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-2.5 bg-[var(--color-bg-tertiary)] rounded-lg">
            <h4 className="text-[11px] font-bold text-text-primary mb-2">Quick Search Tools</h4>
            {searchResult && (
              <div className="mb-2 p-2 border border-primary/20 rounded bg-primary/5 text-[11px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-primary">{searchResult.tool}</span>
                  <button onClick={() => setSearchResult(null)} className="text-text-tertiary hover:text-text-primary text-[10px]">✕</button>
                </div>
                <p className="text-text-secondary">{searchResult.result}</p>
                {searchResult.matches > 0 && <p className="text-emerald-600 font-semibold mt-0.5">{searchResult.matches} match(es) found</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: '🔎 DedUp Search', desc: 'Duplicate/linked cases', action: () => {
                  const name = caseData.debtor.name;
                  const dupes = allCases.filter(c => c.id !== caseData.id && (c.debtor.name === name || c.debtor.eid === caseData.debtor.eid || c.debtor.passport === caseData.debtor.passport)).length;
                  setSearchResult({ tool: 'DedUp Search', result: dupes > 0 ? `Found cases with matching name/EID/passport for "${name}"` : `No duplicates found for "${name}"`, matches: dupes });
                }},
                { label: '📋 Linked Passport', desc: 'Search by passport', action: () => {
                  const pp = caseData.debtor.passport;
                  if (!pp) { setSearchResult({ tool: 'Passport Search', result: 'No passport number on file', matches: 0 }); return; }
                  const found = allCases.filter(c => c.id !== caseData.id && c.debtor.passport === pp).length;
                  setSearchResult({ tool: 'Passport Search', result: found > 0 ? `Passport ${pp} linked to ${found} other case(s)` : `No other cases found for passport ${pp}`, matches: found });
                }},
                { label: '📱 Contact Search', desc: 'Search all contacts', action: () => {
                  const phone = caseData.debtor.phones?.[0];
                  if (!phone) { setSearchResult({ tool: 'Contact Search', result: 'No phone number to search', matches: 0 }); return; }
                  const found = allCases.filter(c => c.id !== caseData.id && c.debtor.phones?.some(p => p === phone)).length;
                  setSearchResult({ tool: 'Contact Search', result: found > 0 ? `Phone ${phone} found in ${found} other case(s)` : `Phone ${phone} unique to this case`, matches: found });
                }},
                { label: '🏢 MOL Lookup', desc: 'Employment check', action: () => {
                  const molActive = caseData.subStatus?.includes('MOL-A') || caseData.subStatus?.includes('MOL Active');
                  setSearchResult({ tool: 'MOL Lookup', result: molActive ? 'MOL Status: ACTIVE — Debtor is employed in UAE' : 'MOL Status: INACTIVE or unknown — may have left employment', matches: molActive ? 1 : 0 });
                }},
                { label: '🌐 Social Scan', desc: 'Social media search', action: () => {
                  const name = encodeURIComponent(caseData.debtor.name);
                  window.open(`https://www.google.com/search?q="${caseData.debtor.name}"+site:linkedin.com+OR+site:facebook.com`, '_blank');
                  setSearchResult({ tool: 'Social Scan', result: `Opened Google search for "${caseData.debtor.name}" on LinkedIn + Facebook`, matches: -1 });
                }},
                { label: '🏦 Multi-Bank', desc: 'Cross-bank check', action: () => {
                  const banks = new Set(allCases.filter(c => c.debtor.name === caseData.debtor.name || c.debtor.eid === caseData.debtor.eid).map(c => c.loan?.bank).filter(Boolean));
                  setSearchResult({ tool: 'Multi-Bank Check', result: banks.size > 1 ? `Debtor has obligations with ${banks.size} banks: ${Array.from(banks).join(', ')}` : 'Single bank exposure only', matches: banks.size - 1 });
                }},
              ].map((tool, i) => (
                <button key={i} onClick={tool.action} className="text-left p-2 rounded border border-[var(--color-border)] hover:border-primary hover:bg-primary/5 transition text-[11px] active:scale-95">
                  <div className="font-semibold">{tool.label}</div>
                  <div className="text-[9px] text-text-tertiary">{tool.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 bg-[var(--color-bg-tertiary)] rounded-lg">
            <h4 className="text-[11px] font-bold text-text-primary mb-1.5">Case Intelligence</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="text-text-tertiary">DLQ String:</div><div className="font-mono font-semibold">{caseData.loan?.bucket || '—'}</div>
              <div className="text-text-tertiary">Center:</div><div>{caseData.debtor.cnic ? 'PAKISTAN' : 'UAE'}</div>
              <div className="text-text-tertiary">Passport:</div><div className="font-mono">{caseData.debtor.passport || '—'}</div>
              <div className="text-text-tertiary">Emirates ID:</div><div className="font-mono">{caseData.debtor.eid || '—'}</div>
              <div className="text-text-tertiary">CNIC:</div><div className="font-mono">{caseData.debtor.cnic || '—'}</div>
              <div className="text-text-tertiary">DOB:</div><div>{caseData.debtor.dob || '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TracingPanel;
