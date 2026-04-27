import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, Role } from '../../types';
import { ICONS } from '../../constants';
import { formatCurrency } from '../../utils';
import { validatePakistanPhone } from '../pakistan-tracing/pakistanHelpers';

// ── Types ────────────────────────────────────────────────────────────────────
type Channel = 'sms' | 'whatsapp' | 'email';
type Tone = 'reminder' | 'firm' | 'final' | 'settlement';

interface CampaignRun {
  id: string;
  date: string;
  channel: Channel;
  tone: Tone;
  templateName: string;
  recipientCount: number;
  caseIds: string[];
  sentBy: string;
  status: 'draft' | 'sent' | 'partial';
}

const STORAGE_KEY = 'rv_bulk_campaigns';
const load = (): CampaignRun[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const save = (d: CampaignRun[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };

// ── Templates ────────────────────────────────────────────────────────────────
interface Template {
  name: string;
  channel: Channel;
  tone: Tone;
  body: string;
  vars: string[];
  language: 'English' | 'Urdu' | 'Mixed';
}

const TEMPLATES: Template[] = [
  {
    name: 'Soft Reminder (English)',
    channel: 'sms', tone: 'reminder', language: 'English',
    body: 'Dear {{name}}, your {{bank}} A/C {{accNo}} has outstanding {{amount}}. Please contact us at {{phone}} to discuss. - RecoVantage',
    vars: ['name', 'bank', 'accNo', 'amount', 'phone'],
  },
  {
    name: 'Soft Reminder (Urdu/English mix)',
    channel: 'sms', tone: 'reminder', language: 'Mixed',
    body: 'Mohtaram {{name}} sahab, aap ka {{bank}} A/C par {{amount}} due hai. Please contact karein {{phone}} par. Shukria.',
    vars: ['name', 'bank', 'amount', 'phone'],
  },
  {
    name: 'Firm Reminder',
    channel: 'sms', tone: 'firm', language: 'English',
    body: '{{name}}: A/C {{accNo}} ({{bank}}) — {{amount}} pending. Failure to respond within 3 days will result in escalation. Call {{phone}}.',
    vars: ['name', 'accNo', 'bank', 'amount', 'phone'],
  },
  {
    name: 'Final Demand',
    channel: 'sms', tone: 'final', language: 'English',
    body: 'FINAL NOTICE: {{name}} - {{bank}} A/C {{accNo}} - {{amount}} outstanding. Legal action will be initiated if not settled in 7 days. Call {{phone}} immediately.',
    vars: ['name', 'bank', 'accNo', 'amount', 'phone'],
  },
  {
    name: 'Settlement Offer',
    channel: 'sms', tone: 'settlement', language: 'English',
    body: '{{name}}: One-time settlement available for {{bank}} A/C {{accNo}}. Pay {{settlementAmount}} to close (saves you {{savings}}). Valid 7 days. Call {{phone}}.',
    vars: ['name', 'bank', 'accNo', 'settlementAmount', 'savings', 'phone'],
  },
  {
    name: 'WhatsApp - Friendly',
    channel: 'whatsapp', tone: 'reminder', language: 'Mixed',
    body: 'Assalam-u-alaikum {{name}} 👋\n\nAap ke {{bank}} account ke baare mein baat karni thi.\nOutstanding: *{{amount}}*\n\nKya aap aaj 5-10 minute baat kar sakte hain? Reply karein ya call karein {{phone}} par.\n\nShukria 🙏',
    vars: ['name', 'bank', 'amount', 'phone'],
  },
  {
    name: 'WhatsApp - Settlement',
    channel: 'whatsapp', tone: 'settlement', language: 'Mixed',
    body: '🎯 *Settlement Opportunity*\n\nHello {{name}},\n{{bank}} ne aap ko ek special offer di hai:\n\n• Original: ~{{amount}}~\n• Settle for: *{{settlementAmount}}*\n• Saving: {{savings}}\n• Valid till: {{deadline}}\n\nCall hum se aaj: {{phone}}\n\n_RecoVantage Recovery Team_',
    vars: ['name', 'bank', 'amount', 'settlementAmount', 'savings', 'deadline', 'phone'],
  },
  {
    name: 'Email - Formal Reminder',
    channel: 'email', tone: 'firm', language: 'English',
    body: 'Subject: Outstanding Liability — {{bank}} Account {{accNo}}\n\nDear {{name}},\n\nThis is to remind you that your {{bank}} account {{accNo}} has an outstanding balance of {{amount}}.\n\nPlease contact our recovery department at {{phone}} or reply to this email within 5 business days to arrange settlement.\n\nFailure to respond may result in:\n- Legal escalation\n- Bureau reporting\n- Travel ban (for Gulf-issued accounts)\n\nRegards,\nRecoVantage Recovery Department',
    vars: ['name', 'bank', 'accNo', 'amount', 'phone'],
  },
];

// ── Render helper ────────────────────────────────────────────────────────────
function renderTemplate(t: Template, c: EnrichedCase, extraVars: Record<string, string> = {}): string {
  const vars: Record<string, string> = {
    name: c.debtor.name,
    bank: c.loan.bank,
    accNo: c.loan.accountNumber,
    amount: formatCurrency(c.loan.currentBalance, c.loan.currency),
    phone: '+92-XXX-XXXXXXX', // recovery agency phone
    settlementAmount: formatCurrency(Math.round(c.loan.currentBalance * 0.6), c.loan.currency),
    savings: formatCurrency(Math.round(c.loan.currentBalance * 0.4), c.loan.currency),
    deadline: new Date(Date.now() + 7 * 86400000).toLocaleDateString(),
    ...extraVars,
  };
  let out = t.body;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), v);
  }
  return out;
}

// ── Component ────────────────────────────────────────────────────────────────
interface BulkCommsProps {
  cases: EnrichedCase[];
  currentUser: User;
}

const BulkComms: React.FC<BulkCommsProps> = ({ cases, currentUser }) => {
  const [campaigns, setCampaigns] = useState<CampaignRun[]>(load);
  const [channel, setChannel] = useState<Channel>('sms');
  const [selectedTemplateName, setSelectedTemplateName] = useState(TEMPLATES[0].name);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBank, setFilterBank] = useState<string>('all');
  const [filterDpdMin, setFilterDpdMin] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewCaseId, setPreviewCaseId] = useState<string>('');

  const myCases = useMemo(() => {
    return currentUser.role === Role.OFFICER
      ? cases.filter(c => c.assignedOfficerId === currentUser.id)
      : cases;
  }, [cases, currentUser]);

  const banks = useMemo(() => Array.from(new Set(myCases.map(c => c.loan.bank))).sort(), [myCases]);

  const channelTemplates = TEMPLATES.filter(t => t.channel === channel);
  const selectedTemplate = TEMPLATES.find(t => t.name === selectedTemplateName) || channelTemplates[0];

  const filtered = useMemo(() => {
    return myCases.filter(c => {
      if (filterStatus !== 'all' && c.crmStatus !== filterStatus) return false;
      if (filterBank !== 'all' && c.loan.bank !== filterBank) return false;
      const dpd = Math.floor((Date.now() - new Date(c.creationDate).getTime()) / 86400000);
      if (dpd < filterDpdMin) return false;
      return true;
    });
  }, [myCases, filterStatus, filterBank, filterDpdMin]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map(c => c.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const previewCase = cases.find(c => c.id === previewCaseId) || filtered[0];

  const handleSend = () => {
    if (selectedIds.size === 0 || !selectedTemplate) return;
    if (!confirm(`Send "${selectedTemplate.name}" via ${channel.toUpperCase()} to ${selectedIds.size} recipients?`)) return;

    const newRun: CampaignRun = {
      id: `camp-${Date.now()}`,
      date: new Date().toISOString(),
      channel,
      tone: selectedTemplate.tone,
      templateName: selectedTemplate.name,
      recipientCount: selectedIds.size,
      caseIds: Array.from(selectedIds),
      sentBy: currentUser.name,
      status: 'sent', // backend wala actual send karega; local mein bas log
    };
    const updated = [newRun, ...campaigns];
    setCampaigns(updated);
    save(updated);
    setSelectedIds(new Set());
    alert(`Campaign queued. ${selectedIds.size} messages will be dispatched via backend.\n\nNote: Connect backend communication module to actually send. Currently logged locally.`);
  };

  const stats = useMemo(() => {
    const validPhones = filtered.filter(c => (c.debtor.phones || []).some(p => validatePakistanPhone(p).valid)).length;
    const validEmails = filtered.filter(c => (c.debtor.emails || []).length > 0).length;
    const totalSent = campaigns.reduce((s, c) => s + c.recipientCount, 0);
    return {
      filtered: filtered.length,
      selected: selectedIds.size,
      validPhones,
      validEmails,
      totalCampaigns: campaigns.length,
      totalSent,
    };
  }, [filtered, selectedIds, campaigns]);

  const eligibleSelected = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const c = cases.find(x => x.id === id);
      if (!c) return false;
      if (channel === 'email') return (c.debtor.emails || []).length > 0;
      return (c.debtor.phones || []).some(p => validatePakistanPhone(p).valid);
    }).length;
  }, [selectedIds, cases, channel]);

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.email('w-7 h-7')}
            Bulk Communication Center
          </h1>
          <p className="text-sm text-text-secondary mt-1">Mass send SMS / WhatsApp / Email with templates</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Filtered', value: stats.filtered, color: 'text-text-primary' },
          { label: 'Selected', value: stats.selected, color: 'text-blue-600' },
          { label: 'Eligible (this channel)', value: eligibleSelected, color: 'text-emerald-600' },
          { label: 'Valid PK Phones', value: stats.validPhones, color: 'text-emerald-600' },
          { label: 'Valid Emails', value: stats.validEmails, color: 'text-emerald-600' },
          { label: 'Past Campaigns', value: stats.totalCampaigns, color: 'text-text-primary' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Channel selector */}
      <div className="flex items-center gap-2">
        {(['sms', 'whatsapp', 'email'] as Channel[]).map(ch => (
          <button
            key={ch}
            onClick={() => { setChannel(ch); setSelectedTemplateName(TEMPLATES.find(t => t.channel === ch)?.name || ''); }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 ${channel === ch ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)] text-text-secondary'}`}
          >
            {ch === 'sms' ? '📱' : ch === 'whatsapp' ? '💬' : '✉️'} {ch.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Template selector + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-4 space-y-3">
          <h3 className="text-sm font-bold">Pick Template</h3>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {channelTemplates.map(t => (
              <button
                key={t.name}
                onClick={() => setSelectedTemplateName(t.name)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs ${selectedTemplateName === t.name ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)]' : 'border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]'}`}
              >
                <p className="font-semibold">{t.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${t.tone === 'reminder' ? 'bg-blue-100 text-blue-700' : t.tone === 'firm' ? 'bg-amber-100 text-amber-700' : t.tone === 'final' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {t.tone}
                  </span>
                  <span className="text-[9px] text-text-tertiary">{t.language}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Preview</h3>
            <select value={previewCaseId || filtered[0]?.id || ''} onChange={e => setPreviewCaseId(e.target.value)} className="px-2 py-1 text-xs rounded-lg max-w-[180px]">
              {filtered.slice(0, 30).map(c => <option key={c.id} value={c.id}>{c.debtor.name}</option>)}
            </select>
          </div>
          {selectedTemplate && previewCase ? (
            <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] text-xs whitespace-pre-line max-h-[200px] overflow-y-auto">
              {renderTemplate(selectedTemplate, previewCase)}
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">No preview available.</p>
          )}
        </div>
      </div>

      {/* Filters + recipients */}
      <div className="panel p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold">Recipients ({filtered.length} match filters, {stats.selected} selected)</h3>
          <div className="flex gap-2">
            <button onClick={selectAll} className="btn-secondary px-3 py-1.5 text-xs">Select All</button>
            <button onClick={clearSelection} className="btn-secondary px-3 py-1.5 text-xs">Clear</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={filterBank} onChange={e => setFilterBank(e.target.value)} className="px-3 py-2 text-xs rounded-lg">
            <option value="all">All banks</option>
            {banks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 text-xs rounded-lg">
            <option value="all">All statuses</option>
            <option value="CB">CB</option>
            <option value="UNDER NEGO">UNDER NEGO</option>
            <option value="PTP">PTP</option>
            <option value="Dispute">Dispute</option>
            <option value="WIP">WIP</option>
          </select>
          <select value={filterDpdMin} onChange={e => setFilterDpdMin(Number(e.target.value))} className="px-3 py-2 text-xs rounded-lg">
            <option value={0}>All DPD</option>
            <option value={30}>DPD 30+</option>
            <option value={60}>DPD 60+</option>
            <option value={90}>DPD 90+</option>
            <option value={180}>DPD 180+</option>
            <option value={365}>1+ year</option>
          </select>
        </div>

        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--color-bg-tertiary)] z-10">
              <tr>
                <th className="text-left py-2 px-3 w-8">
                  <input type="checkbox"
                    checked={filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))}
                    onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  />
                </th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Debtor</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Bank</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Status</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Balance</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Channel</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(c => {
                const phoneOk = (c.debtor.phones || []).some(p => validatePakistanPhone(p).valid);
                const emailOk = (c.debtor.emails || []).length > 0;
                const reachable = channel === 'email' ? emailOk : phoneOk;
                return (
                  <tr key={c.id} className={`border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)] ${!reachable ? 'opacity-50' : ''}`}>
                    <td className="py-2 px-3">
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} disabled={!reachable} />
                    </td>
                    <td className="py-2 px-3">
                      <p className="font-semibold">{c.debtor.name}</p>
                      <p className="text-[10px] text-text-tertiary">{c.loan.accountNumber}</p>
                    </td>
                    <td className="py-2 px-3 text-text-secondary">{c.loan.bank}</td>
                    <td className="py-2 px-3 text-text-secondary">{c.crmStatus}</td>
                    <td className="py-2 px-3 font-semibold">{formatCurrency(c.loan.currentBalance, c.loan.currency)}</td>
                    <td className="py-2 px-3">
                      {reachable ? <span className="text-emerald-600">✓ {channel}</span> : <span className="text-red-600">✗ no {channel}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 200 && <p className="text-center text-[10px] text-text-tertiary py-2">Showing 200 of {filtered.length}</p>}
        </div>

        <button
          onClick={handleSend}
          disabled={selectedIds.size === 0 || eligibleSelected === 0}
          className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-40"
        >
          Send via {channel.toUpperCase()} to {eligibleSelected} eligible recipient{eligibleSelected !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Past campaigns log */}
      {campaigns.length > 0 && (
        <div className="panel">
          <div className="p-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold">Past Campaigns ({campaigns.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-bg-tertiary)]">
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Date</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Channel</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Template</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">Recipients</th>
                  <th className="text-left py-2 px-3 text-[10px] font-semibold text-text-secondary">By</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 50).map(c => (
                  <tr key={c.id} className="border-t border-[var(--color-border)]">
                    <td className="py-2 px-3 text-text-secondary">{new Date(c.date).toLocaleString()}</td>
                    <td className="py-2 px-3">{c.channel === 'sms' ? '📱' : c.channel === 'whatsapp' ? '💬' : '✉️'} {c.channel.toUpperCase()}</td>
                    <td className="py-2 px-3 text-text-secondary">{c.templateName}</td>
                    <td className="py-2 px-3 font-semibold">{c.recipientCount}</td>
                    <td className="py-2 px-3 text-text-secondary">{c.sentBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkComms;
