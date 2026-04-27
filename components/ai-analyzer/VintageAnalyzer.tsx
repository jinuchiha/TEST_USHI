import React, { useState, useMemo } from 'react';
import { EnrichedCase, User, CRMStatus, SubStatus, ActionType } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ICONS } from '../../constants';

// ── Vintage scoring ──────────────────────────────────────────────────────────
// Strict, conservative recovery probability — based ONLY on case data.
// Score 0-100. Lower = harder to recover. We bias toward pessimism.

interface ScoreBreakdown {
  factor: string;
  weight: number;       // points subtracted (0-100)
  detail: string;
}

interface VintageScore {
  case: EnrichedCase;
  score: number;
  band: 'high' | 'medium' | 'low' | 'kill';
  recommendation: string;
  reasoning: ScoreBreakdown[];
  flags: string[];
}

const daysSince = (iso?: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
};

const scoreCase = (c: EnrichedCase): VintageScore => {
  let score = 100;
  const reasoning: ScoreBreakdown[] = [];
  const flags: string[] = [];

  // ── HARD KILLS ─────────────────────────────────────────────────────────
  if (c.cyber === 'Yes') {
    flags.push('Cyber/fraud flag');
    return {
      case: c,
      score: 0,
      band: 'kill',
      recommendation: 'WRITE-OFF — Cyber/fraud flag present',
      reasoning: [{ factor: 'Cyber/Fraud', weight: 100, detail: 'Case marked as cyber/fraud — recovery near zero' }],
      flags,
    };
  }
  if (c.subStatus === SubStatus.DC_DEATH_CERTIFICATE) {
    flags.push('Death certificate');
    return {
      case: c,
      score: 0,
      band: 'kill',
      recommendation: 'WRITE-OFF — Death certificate on file',
      reasoning: [{ factor: 'Death', weight: 100, detail: 'Debtor deceased — pursue estate or write off' }],
      flags,
    };
  }
  if (c.crmStatus === CRMStatus.WITHDRAWN || c.crmStatus === CRMStatus.WDS) {
    flags.push('Already withdrawn');
    return {
      case: c,
      score: 0,
      band: 'kill',
      recommendation: 'Already closed — no action',
      reasoning: [{ factor: 'Status', weight: 100, detail: `Status is ${c.crmStatus} — case closed` }],
      flags,
    };
  }
  if (c.subStatus === SubStatus.NOT_IN_PORTAL) {
    flags.push('Not in portal');
  }

  // ── DPD / age penalty (strict) ─────────────────────────────────────────
  // Use creationDate as proxy for case age (DPD-equivalent in this CRM)
  const caseAgeDays = daysSince(c.creationDate) ?? 0;
  if (caseAgeDays > 730) {
    score -= 35;
    reasoning.push({ factor: 'Case age', weight: 35, detail: `${caseAgeDays} days old (>2yr) — historically <10% recovery` });
  } else if (caseAgeDays > 365) {
    score -= 22;
    reasoning.push({ factor: 'Case age', weight: 22, detail: `${caseAgeDays} days old (>1yr) — recovery momentum lost` });
  } else if (caseAgeDays > 180) {
    score -= 12;
    reasoning.push({ factor: 'Case age', weight: 12, detail: `${caseAgeDays} days old (>6mo) — bucket aged` });
  } else if (caseAgeDays > 90) {
    score -= 5;
    reasoning.push({ factor: 'Case age', weight: 5, detail: `${caseAgeDays} days old — past prime collection window` });
  }

  // ── Last contact silence ───────────────────────────────────────────────
  const sinceContact = daysSince(c.lastContactDate);
  if (sinceContact === null || sinceContact > 60) {
    score -= 18;
    reasoning.push({ factor: 'Contact silence', weight: 18, detail: sinceContact === null ? 'No recorded contact' : `${sinceContact} days since last contact` });
    flags.push(sinceContact === null ? 'Never contacted' : `${sinceContact}d silence`);
  } else if (sinceContact > 30) {
    score -= 10;
    reasoning.push({ factor: 'Contact silence', weight: 10, detail: `${sinceContact} days since last contact` });
  } else if (sinceContact > 14) {
    score -= 4;
    reasoning.push({ factor: 'Contact silence', weight: 4, detail: `${sinceContact} days since last contact` });
  }

  // ── Contact / work status ──────────────────────────────────────────────
  if (c.contactStatus === 'Non Contact') {
    score -= 12;
    reasoning.push({ factor: 'Non Contact', weight: 12, detail: 'Tagged as Non Contact' });
    flags.push('Non Contact');
  }
  if (c.workStatus === 'Non Work') {
    score -= 10;
    reasoning.push({ factor: 'Non Work', weight: 10, detail: 'Tagged as Non Work' });
    flags.push('Non Work');
  }

  // ── PTP track record ───────────────────────────────────────────────────
  const allActions = c.history || [];
  const ptpActions = allActions.filter(a => a.type === ActionType.PAYMENT_PLAN_AGREED || a.promisedAmount);
  const paymentActions = allActions.filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid && a.amountPaid > 0);

  if (ptpActions.length > 0 && paymentActions.length === 0) {
    score -= 15;
    reasoning.push({ factor: 'Broken PTPs', weight: 15, detail: `${ptpActions.length} PTPs given, 0 paid — pattern of broken promises` });
    flags.push(`${ptpActions.length} broken PTPs`);
  } else if (ptpActions.length >= 3 && paymentActions.length < ptpActions.length / 2) {
    score -= 8;
    reasoning.push({ factor: 'PTP fulfillment', weight: 8, detail: `${paymentActions.length}/${ptpActions.length} PTPs paid — low fulfillment` });
  } else if (paymentActions.length > 0) {
    score += 5;
    reasoning.push({ factor: 'Payment history', weight: -5, detail: `${paymentActions.length} successful payment(s) — engaged debtor` });
  }

  // ── Effort exhaustion ──────────────────────────────────────────────────
  const totalActions = allActions.length;
  if (totalActions > 30 && paymentActions.length === 0) {
    score -= 20;
    reasoning.push({ factor: 'Effort exhausted', weight: 20, detail: `${totalActions} actions logged, zero payment — diminishing returns` });
    flags.push('Effort exhausted');
  } else if (totalActions > 15 && paymentActions.length === 0) {
    score -= 10;
    reasoning.push({ factor: 'High effort, no result', weight: 10, detail: `${totalActions} actions, no payment` });
  }

  // ── Tracing status (high signal) ───────────────────────────────────────
  if (c.tracingStatus === 'Tracing Not Avail' || c.subStatus === SubStatus.NOT_CONTACTABLE) {
    score -= 18;
    reasoning.push({ factor: 'Untraceable', weight: 18, detail: 'No valid contact info — cannot reach debtor' });
    flags.push('Untraceable');
  }

  // ── Active dispute / refusal ───────────────────────────────────────────
  if (c.crmStatus === CRMStatus.DISPUTE) {
    score -= 12;
    reasoning.push({ factor: 'Dispute', weight: 12, detail: 'Open dispute — typically 6-12mo delay' });
    flags.push('Dispute');
  }
  if (c.subStatus === SubStatus.REFUSE_TO_PAY || c.subStatus === SubStatus.NOT_INTERESTED_TO_PAY) {
    score -= 15;
    reasoning.push({ factor: 'Refusal', weight: 15, detail: 'Debtor explicitly refused to pay' });
    flags.push('Refusal');
  }

  // ── Out of country (bigger problem in Gulf) ────────────────────────────
  if (c.subStatus === SubStatus.OUT_UAE || c.subStatus === SubStatus.OUT_UAE_PAKISTAN) {
    score -= 20;
    reasoning.push({ factor: 'Out of country', weight: 20, detail: 'Debtor left jurisdiction — recovery extremely difficult' });
    flags.push('Out of country');
  }

  // ── Balance size (bigger = harder lump-sum) ────────────────────────────
  const balance = c.loan.currentBalance;
  if (balance > 100000) {
    score -= 8;
    reasoning.push({ factor: 'Large balance', weight: 8, detail: `${formatCurrency(balance, c.loan.currency)} — large lump-sum unlikely` });
  } else if (balance < 5000) {
    score += 3;
    reasoning.push({ factor: 'Small balance', weight: -3, detail: `${formatCurrency(balance, c.loan.currency)} — small enough for one-time settlement` });
  }

  // ── Bucket / write-off proximity ───────────────────────────────────────
  if (c.loan.wod) {
    score -= 10;
    reasoning.push({ factor: 'Write-off date set', weight: 10, detail: `Already written off on ${c.loan.wod}` });
    flags.push('Write-off');
  }

  // ── Hard floor / ceiling ───────────────────────────────────────────────
  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Band & recommendation ──────────────────────────────────────────────
  let band: VintageScore['band'];
  let recommendation: string;
  if (score >= 65) {
    band = 'high';
    recommendation = 'PURSUE — full balance with payment plan';
  } else if (score >= 40) {
    band = 'medium';
    recommendation = 'SETTLE 30-50% — offer time-bound discount';
  } else if (score >= 20) {
    band = 'low';
    recommendation = 'SETTLE 50-70% or final letter before write-off';
  } else {
    band = 'kill';
    recommendation = 'WRITE-OFF candidate — no further effort';
  }

  return { case: c, score, band, recommendation, reasoning, flags };
};

// ── Component ────────────────────────────────────────────────────────────────
interface VintageAnalyzerProps {
  cases: EnrichedCase[];
  currentUser: User;
  onSelectCase: (caseId: string) => void;
}

const VintageAnalyzer: React.FC<VintageAnalyzerProps> = ({ cases, onSelectCase }) => {
  const [vintageDays, setVintageDays] = useState(180);
  const [bandFilter, setBandFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'kill'>('all');
  const [bankFilter, setBankFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const banks = useMemo(() => Array.from(new Set(cases.map(c => c.loan.bank))).sort(), [cases]);

  const scored = useMemo(() => {
    return cases
      .filter(c => {
        const age = daysSince(c.creationDate) ?? 0;
        return age >= vintageDays;
      })
      .map(scoreCase)
      .sort((a, b) => b.score - a.score);
  }, [cases, vintageDays]);

  const filtered = useMemo(() => {
    return scored.filter(s => {
      if (bandFilter !== 'all' && s.band !== bandFilter) return false;
      if (bankFilter !== 'all' && s.case.loan.bank !== bankFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.case.debtor.name.toLowerCase().includes(q) &&
            !s.case.loan.accountNumber.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [scored, bandFilter, bankFilter, search]);

  const stats = useMemo(() => {
    const high = scored.filter(s => s.band === 'high');
    const medium = scored.filter(s => s.band === 'medium');
    const low = scored.filter(s => s.band === 'low');
    const kill = scored.filter(s => s.band === 'kill');
    const totalBalance = scored.reduce((s, x) => s + x.case.loan.currentBalance, 0);
    const recoverableProjection = scored.reduce((sum, x) => sum + x.case.loan.currentBalance * (x.score / 100), 0);
    return {
      total: scored.length,
      high: high.length,
      medium: medium.length,
      low: low.length,
      kill: kill.length,
      totalBalance,
      recoverableProjection,
    };
  }, [scored]);

  const bandColor: Record<VintageScore['band'], string> = {
    high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    kill: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const bandLabel: Record<VintageScore['band'], string> = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    kill: 'KILL',
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            {ICONS.lightbulb('w-7 h-7')}
            Vintage Account Analyzer
          </h1>
          <p className="text-sm text-text-secondary mt-1">Strict AI scoring of aged accounts — recovery probability based on real case data</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">Vintage threshold</label>
          <select value={vintageDays} onChange={e => setVintageDays(Number(e.target.value))} className="px-3 py-2 text-xs rounded-lg">
            <option value={90}>90+ days</option>
            <option value={180}>180+ days</option>
            <option value={365}>1+ year</option>
            <option value={730}>2+ years</option>
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Vintage Cases', value: stats.total, color: 'text-text-primary' },
          { label: 'High (65+)', value: stats.high, color: 'text-emerald-600' },
          { label: 'Medium (40-64)', value: stats.medium, color: 'text-amber-600' },
          { label: 'Low (20-39)', value: stats.low, color: 'text-orange-600' },
          { label: 'Kill (<20)', value: stats.kill, color: 'text-red-600' },
          { label: 'Total Balance', value: formatCurrency(stats.totalBalance, 'AED'), color: 'text-text-primary' },
          { label: 'AI Projection', value: formatCurrency(Math.round(stats.recoverableProjection), 'AED'), color: 'text-blue-600' },
        ].map(k => (
          <div key={k.label} className="panel p-3">
            <p className="text-[10px] text-text-secondary">{k.label}</p>
            <p className={`text-base font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="panel p-4 border-l-4 border-blue-400">
        <h3 className="text-xs font-bold text-text-primary mb-1">How the score works (strict scoring)</h3>
        <p className="text-[11px] text-text-secondary leading-relaxed">
          Starts at 100. Hard kills (Cyber, Death, Withdrawn) → 0. Penalties: case age (-5 to -35), contact silence (-4 to -18), Non Contact (-12), Non Work (-10),
          broken PTPs (-15), effort exhausted (-20), untraceable (-18), dispute (-12), refusal (-15), out of country (-20), large balance (-8). Bonus: payment history (+5), small balance (+3).
          Bands: <span className="font-bold text-emerald-600">HIGH 65+</span> = pursue, <span className="font-bold text-amber-600">MEDIUM 40-64</span> = settle 30-50%, <span className="font-bold text-orange-600">LOW 20-39</span> = settle 50-70%, <span className="font-bold text-red-600">KILL &lt;20</span> = write-off.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search debtor / account..." className="px-3 py-2 text-sm rounded-lg flex-1 min-w-[200px]" />
        <select value={bandFilter} onChange={e => setBandFilter(e.target.value as any)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Bands</option>
          <option value="high">HIGH (65+)</option>
          <option value="medium">MEDIUM (40-64)</option>
          <option value="low">LOW (20-39)</option>
          <option value="kill">KILL (&lt;20)</option>
        </select>
        <select value={bankFilter} onChange={e => setBankFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg">
          <option value="all">All Banks</option>
          {banks.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-text-secondary text-sm">No vintage cases match the filters.</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-bg-tertiary)]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Score</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Band</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Debtor / Account</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Bank</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Balance</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Age (days)</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Last Contact</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Flags</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-text-secondary">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map(s => {
                  const isExpanded = expandedId === s.case.id;
                  const age = daysSince(s.case.creationDate) ?? 0;
                  const sinceContact = daysSince(s.case.lastContactDate);
                  return (
                    <React.Fragment key={s.case.id}>
                      <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-muted)] cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : s.case.id)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${s.score >= 65 ? 'bg-emerald-500' : s.score >= 40 ? 'bg-amber-500' : s.score >= 20 ? 'bg-orange-500' : 'bg-red-500'}`}>
                              {s.score}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${bandColor[s.band]}`}>{bandLabel[s.band]}</span>
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={(e) => { e.stopPropagation(); onSelectCase(s.case.id); }} className="text-left">
                            <p className="text-sm font-semibold hover:text-[var(--color-primary)]">{s.case.debtor.name}</p>
                            <p className="text-[11px] text-text-tertiary">{s.case.loan.accountNumber}</p>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs text-text-secondary">{s.case.loan.bank}</td>
                        <td className="py-3 px-4 text-xs font-semibold">{formatCurrency(s.case.loan.currentBalance, s.case.loan.currency)}</td>
                        <td className="py-3 px-4 text-xs text-text-secondary">{age}</td>
                        <td className="py-3 px-4 text-xs text-text-secondary">{sinceContact !== null ? `${sinceContact}d ago` : 'never'}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {s.flags.slice(0, 3).map(f => (
                              <span key={f} className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded font-semibold">{f}</span>
                            ))}
                            {s.flags.length > 3 && <span className="text-[9px] text-text-tertiary">+{s.flags.length - 3}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-text-secondary max-w-[260px]">{s.recommendation}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[var(--color-bg-muted)]">
                          <td colSpan={9} className="py-4 px-6">
                            <p className="text-xs font-bold text-text-primary mb-2">Score breakdown for {s.case.debtor.name}</p>
                            <div className="space-y-1">
                              {s.reasoning.map((r, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                  <span className="text-text-secondary">{r.detail}</span>
                                  <span className={`font-mono font-bold ${r.weight > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {r.weight > 0 ? '-' : '+'}{Math.abs(r.weight)}
                                  </span>
                                </div>
                              ))}
                              {s.reasoning.length === 0 && <p className="text-xs text-text-tertiary">No penalties — clean case</p>}
                            </div>
                            <div className="mt-3 p-3 bg-[var(--color-bg-primary)] rounded-lg">
                              <p className="text-[11px] font-bold text-text-primary mb-1">AI Recommendation</p>
                              <p className="text-xs text-text-secondary">{s.recommendation}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 200 && (
            <div className="p-3 text-center text-xs text-text-tertiary border-t border-[var(--color-border)]">
              Showing top 200 of {filtered.length} — refine filters to narrow down
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VintageAnalyzer;
