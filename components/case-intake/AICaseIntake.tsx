import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { ICONS } from '../../constants';
import { calculateProbability, emptyIntake, IntakeData, ProbabilityResult } from './probabilityModel';
import { PAKISTAN_PROVINCES } from '../pakistan-tracing/pakistanHelpers';

interface AICaseIntakeProps {
  currentUser: User;
}

const STEPS = ['Loan', 'Demographics', 'Contactability', 'Risk Flags', 'Result'] as const;
type Step = typeof STEPS[number];

const fmtCurrency = (n: number, c: string) => `${c} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const AICaseIntake: React.FC<AICaseIntakeProps> = ({ currentUser }) => {
  const [data, setData] = useState<IntakeData>(emptyIntake);
  const [step, setStep] = useState<Step>('Loan');

  const update = <K extends keyof IntakeData>(key: K, value: IntakeData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  // Live probability — recalculates on every change
  const result: ProbabilityResult = useMemo(() => calculateProbability(data), [data]);

  const stepIndex = STEPS.indexOf(step);

  const next = () => { if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]); };
  const prev = () => { if (stepIndex > 0) setStep(STEPS[stepIndex - 1]); };

  const reset = () => { setData(emptyIntake()); setStep('Loan'); };

  // Color scale for probability gauge
  const gaugeColor = result.probability >= 65 ? 'bg-emerald-500' : result.probability >= 40 ? 'bg-amber-500' : result.probability >= 20 ? 'bg-orange-500' : 'bg-red-500';
  const bandLabel: Record<ProbabilityResult['band'], string> = { high: 'HIGH PROBABILITY', medium: 'MEDIUM', low: 'LOW', kill: 'WRITE-OFF' };
  const bandColor: Record<ProbabilityResult['band'], string> = {
    high: 'text-emerald-600',
    medium: 'text-amber-600',
    low: 'text-orange-600',
    kill: 'text-red-600',
  };
  const confColor: Record<ProbabilityResult['confidence'], string> = {
    high: 'text-emerald-600',
    medium: 'text-amber-600',
    low: 'text-red-600',
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <span className="text-3xl">🧠</span>
            AI Case Intake & Probability
          </h1>
          <p className="text-sm text-text-secondary mt-1">Bank case fill karein — AI 30+ factors par recovery probability calculate karega</p>
        </div>
        <button onClick={reset} className="btn-secondary px-3 py-2 text-xs">Reset</button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => setStep(s)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full ${step === s ? 'bg-[var(--color-primary)] text-white' : i < stepIndex ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)]' : 'bg-[var(--color-bg-tertiary)] text-text-secondary'}`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{i + 1}</span>
              {s}
            </button>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < stepIndex ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Form ────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 panel p-5 space-y-4">
          {step === 'Loan' && (
            <>
              <h3 className="text-sm font-bold">Loan & Account</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Bank">
                  <input value={data.bank} onChange={e => update('bank', e.target.value)} className="input" placeholder="e.g. Emirates NBD, NCB, FAB..." />
                </Field>
                <Field label="Product">
                  <select value={data.product} onChange={e => update('product', e.target.value)} className="input">
                    <option>Personal Loan</option>
                    <option>Credit Card</option>
                    <option>Auto Loan</option>
                    <option>Mortgage</option>
                    <option>Business Loan</option>
                    <option>Salary Loan</option>
                  </select>
                </Field>
                <Field label="Original Amount">
                  <input type="number" value={data.originalAmount || ''} onChange={e => update('originalAmount', Number(e.target.value))} className="input" />
                </Field>
                <Field label="Current Balance">
                  <input type="number" value={data.currentBalance || ''} onChange={e => update('currentBalance', Number(e.target.value))} className="input" />
                </Field>
                <Field label="Currency">
                  <select value={data.currency} onChange={e => update('currency', e.target.value)} className="input">
                    {['AED', 'SAR', 'KWD', 'BHD', 'QAR', 'OMR'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="DPD (Days Past Due)">
                  <input type="number" value={data.dpd || ''} onChange={e => update('dpd', Number(e.target.value))} className="input" placeholder="0-3000+" />
                </Field>
                <Field label="In recovery (years)">
                  <input type="number" step="0.5" value={data.caseAgeYears || ''} onChange={e => update('caseAgeYears', Number(e.target.value))} className="input" placeholder="0 = newly received" />
                </Field>
                <Field label="Already recovered (before us)">
                  <input type="number" value={data.priorRecovered || ''} onChange={e => update('priorRecovered', Number(e.target.value))} className="input" placeholder="If any prior payments" />
                </Field>
              </div>
            </>
          )}

          {step === 'Demographics' && (
            <>
              <h3 className="text-sm font-bold">Debtor Demographics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Age Group">
                  <select value={data.ageGroup} onChange={e => update('ageGroup', e.target.value as any)} className="input">
                    <option value="unknown">Unknown</option>
                    <option value="under_30">Under 30</option>
                    <option value="30_45">30-45 (prime)</option>
                    <option value="45_60">45-60</option>
                    <option value="over_60">Over 60</option>
                  </select>
                </Field>
                <Field label="Employment Type">
                  <select value={data.employmentType} onChange={e => update('employmentType', e.target.value as any)} className="input">
                    <option value="unknown">Unknown</option>
                    <option value="salaried">Salaried (best)</option>
                    <option value="business">Business owner</option>
                    <option value="unemployed">Unemployed</option>
                    <option value="retired">Retired</option>
                    <option value="student">Student</option>
                  </select>
                </Field>
                <Field label="Monthly Income (PKR)">
                  <select value={data.monthlyIncome} onChange={e => update('monthlyIncome', e.target.value as any)} className="input">
                    <option value="unknown">Unknown</option>
                    <option value="under_50k">Under 50k</option>
                    <option value="50_100k">50k - 100k</option>
                    <option value="100_200k">100k - 200k</option>
                    <option value="200_500k">200k - 500k</option>
                    <option value="over_500k">Over 500k</option>
                  </select>
                </Field>
                <Field label="City">
                  <input value={data.city} onChange={e => update('city', e.target.value)} className="input" placeholder="Karachi / Lahore / etc" />
                </Field>
                <Field label="Province">
                  <select value={data.province} onChange={e => update('province', e.target.value)} className="input">
                    <option value="">Select</option>
                    {PAKISTAN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2 grid grid-cols-2 gap-2 mt-2">
                  <Toggle label="Has property in name" value={data.hasProperty} onChange={v => update('hasProperty', v)} />
                  <Toggle label="Active loans elsewhere" value={data.hasOtherActiveLoans} onChange={v => update('hasOtherActiveLoans', v)} />
                  <Toggle label="Family contact known" value={data.hasFamilyContact} onChange={v => update('hasFamilyContact', v)} />
                  <Toggle label="Employer info known" value={data.hasEmployerInfo} onChange={v => update('hasEmployerInfo', v)} />
                </div>
              </div>
            </>
          )}

          {step === 'Contactability' && (
            <>
              <h3 className="text-sm font-bold">Contactability</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Toggle label="Valid Pakistani mobile" value={data.hasValidPkPhone} onChange={v => update('hasValidPkPhone', v)} />
                <Toggle label="WhatsApp active" value={data.whatsappActive} onChange={v => update('whatsappActive', v)} />
                <Toggle label="CNIC valid" value={data.cnicValid} onChange={v => update('cnicValid', v)} />
                <Toggle label="Address verified" value={data.addressVerified} onChange={v => update('addressVerified', v)} />
                <Toggle label="Reached before (anyone)" value={data.reachedBefore} onChange={v => update('reachedBefore', v)} />
                <Field label="Last call disposition">
                  <select value={data.dispositionLast} onChange={e => update('dispositionLast', e.target.value as any)} className="input">
                    <option value="never">Never contacted</option>
                    <option value="answered">Answered (neutral)</option>
                    <option value="ptp">Promise to pay</option>
                    <option value="no_answer">No answer</option>
                    <option value="busy">Busy</option>
                    <option value="switched_off">Switched off / unreachable</option>
                    <option value="refused">Refused to pay</option>
                  </select>
                </Field>
              </div>
            </>
          )}

          {step === 'Risk Flags' && (
            <>
              <h3 className="text-sm font-bold">Risk Flags (red flags = score drops)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Toggle label="🚨 Cyber/Fraud flag" value={data.cyberFlag} onChange={v => update('cyberFlag', v)} danger />
                <Toggle label="⚰️ Deceased" value={data.deceasedFlag} onChange={v => update('deceasedFlag', v)} danger />
                <Toggle label="✈️ Out of Pakistan" value={data.outOfCountry} onChange={v => update('outOfCountry', v)} danger />
                <Toggle label="⚖️ Active dispute" value={data.disputeFiled} onChange={v => update('disputeFiled', v)} danger />
                <Toggle label="💼 Bankruptcy filed" value={data.bankruptcyFiled} onChange={v => update('bankruptcyFiled', v)} danger />
                <Toggle label="🚓 Criminal case open" value={data.criminalCase} onChange={v => update('criminalCase', v)} danger />
              </div>
              <p className="text-[11px] text-text-tertiary mt-2">⚠️ Cyber, Deceased, Bankruptcy = automatic write-off recommendation regardless of other factors.</p>
            </>
          )}

          {step === 'Result' && (
            <ResultPanel data={data} result={result} />
          )}

          {/* Nav */}
          <div className="flex justify-between pt-4 border-t border-[var(--color-border)]">
            <button onClick={prev} disabled={stepIndex === 0} className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">← Back</button>
            {step !== 'Result' ? (
              <button onClick={next} className="btn-primary px-4 py-2 text-sm">Next →</button>
            ) : (
              <button onClick={reset} className="btn-secondary px-4 py-2 text-sm">New Case</button>
            )}
          </div>
        </div>

        {/* ── Live probability gauge (sticky) ─────────────────────────── */}
        <div className="space-y-4">
          <div className="panel p-5 space-y-3 sticky top-4">
            <div className="text-center">
              <p className="text-xs text-text-tertiary uppercase tracking-wide">Recovery Probability (Live)</p>
              <div className="relative w-32 h-32 mx-auto mt-3">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-bg-tertiary)" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={result.band === 'high' ? '#10b981' : result.band === 'medium' ? '#f59e0b' : result.band === 'low' ? '#f97316' : '#ef4444'}
                    strokeWidth="10"
                    strokeDasharray={`${result.probability * 2.51} 251`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold">{result.probability}</p>
                  <p className="text-[9px] text-text-tertiary">/ 100</p>
                </div>
              </div>
              <p className={`text-sm font-bold mt-2 ${bandColor[result.band]}`}>{bandLabel[result.band]}</p>
              <p className={`text-[10px] ${confColor[result.confidence]}`}>Confidence: {result.confidence}</p>
            </div>

            <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Expected recovery</span>
                <span className="font-bold">{fmtCurrency(result.expectedRecoveryAmount, data.currency)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Settlement floor</span>
                <span className="font-bold">{result.recommendedSettlementPercent}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Effort timeframe</span>
                <span className="font-bold">{result.recommendedTimeframeDays}d</span>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="border-t border-[var(--color-border)] pt-3">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-[10px] text-red-600 dark:text-red-400">⚠️ {w}</p>
                ))}
              </div>
            )}
          </div>

          {/* Top factors (live) */}
          <div className="panel p-3">
            <p className="text-[10px] font-bold text-text-tertiary uppercase mb-2">Top factors</p>
            <div className="space-y-1.5">
              {result.factors.slice(0, 6).map((f, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary truncate">{f.label}</span>
                  <span className={`font-mono font-bold ${f.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {f.positive ? '+' : ''}{f.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Result panel (final step) ────────────────────────────────────────────────
const ResultPanel: React.FC<{ data: IntakeData; result: ProbabilityResult }> = ({ data, result }) => (
  <div className="space-y-4">
    <div className="text-center py-4">
      <p className="text-xs text-text-tertiary uppercase">Final Assessment</p>
      <p className={`text-5xl font-bold mt-2 ${result.band === 'high' ? 'text-emerald-600' : result.band === 'medium' ? 'text-amber-600' : result.band === 'low' ? 'text-orange-600' : 'text-red-600'}`}>
        {result.probability}%
      </p>
      <p className="text-sm font-bold mt-1">{result.band === 'high' ? 'HIGH PROBABILITY' : result.band === 'medium' ? 'MEDIUM PROBABILITY' : result.band === 'low' ? 'LOW PROBABILITY' : 'WRITE-OFF CANDIDATE'}</p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="panel p-3 bg-[var(--color-bg-tertiary)]">
        <p className="text-[10px] text-text-tertiary uppercase">Strategy</p>
        <p className="text-xs mt-1 leading-relaxed">{result.recommendedStrategy}</p>
      </div>
      <div className="panel p-3 bg-[var(--color-bg-tertiary)]">
        <p className="text-[10px] text-text-tertiary uppercase">Officer Profile</p>
        <p className="text-xs mt-1">{result.officerProfileMatch}</p>
      </div>
    </div>

    <div className="panel p-3 bg-[var(--color-bg-tertiary)]">
      <p className="text-[10px] text-text-tertiary uppercase mb-2">First 3 actions</p>
      <ol className="space-y-1.5">
        {result.topActions.map((a, i) => (
          <li key={i} className="text-xs flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
            <span>{a}</span>
          </li>
        ))}
      </ol>
    </div>

    <div className="panel p-3 bg-[var(--color-bg-tertiary)]">
      <p className="text-[10px] text-text-tertiary uppercase mb-2">All factors ({result.factors.length})</p>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {result.factors.map((f, i) => (
          <div key={i} className="text-[11px] flex items-start justify-between gap-3 py-1 border-b border-[var(--color-border)]/30">
            <div className="flex-1">
              <p className="font-semibold">{f.label}</p>
              <p className="text-text-tertiary">{f.reason}</p>
            </div>
            <span className={`font-mono font-bold flex-shrink-0 ${f.positive ? 'text-emerald-600' : 'text-red-600'}`}>
              {f.positive ? '+' : ''}{f.impact}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Form helpers ─────────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wide mb-1">{label}</label>
    {children}
  </div>
);

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; danger?: boolean }> = ({ label, value, onChange, danger }) => (
  <button
    onClick={() => onChange(!value)}
    className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
      value
        ? danger
          ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          : 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)]'
        : 'border-[var(--color-border)] hover:bg-[var(--color-bg-muted)]'
    }`}
  >
    <span className="font-semibold">{label}</span>
    <span className="font-bold">{value ? '✓' : '○'}</span>
  </button>
);

// Inline style for inputs (use existing CSS class if present, else fallback)
declare global {
  interface CSSStyleDeclaration { input?: string; }
}
const styleTag = `<style>.input{display:block;width:100%;padding:0.5rem 0.75rem;font-size:0.875rem;border:1px solid var(--color-border);border-radius:0.5rem;background:var(--color-bg-secondary);}</style>`;
if (typeof document !== 'undefined' && !document.getElementById('intake-input-style')) {
  const s = document.createElement('div');
  s.id = 'intake-input-style';
  s.innerHTML = styleTag;
  document.head.appendChild(s.firstChild as Node);
}

export default AICaseIntake;
