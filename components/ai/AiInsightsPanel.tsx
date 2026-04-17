import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';
import { aiApi, RecoveryScore, FraudAssessment, AllocationSuggestion } from '../../src/api';
import RecoveryScoreBadge from './RecoveryScoreBadge';
import { EnrichedCase, Role, ActionType } from '../../types';
import { ICONS } from '../../constants';
import { generateCaseBriefing, getNegotiationCoach } from '../../src/ai/brain';
import { profileDebtor, predictWriteOffRisk, suggestBestCallTime, suggestBestChannel } from '../../src/ai/engines';
import { runAllMLModels } from '../../src/ai/ml-models';

interface AiInsightsPanelProps {
  caseData: EnrichedCase;
  currentUser: { id: string; role: Role };
}

const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({ caseData, currentUser }) => {
  const { useApi } = useAuth();
  const [recoveryScore, setRecoveryScore] = useState<RecoveryScore | null>(null);
  const [fraudAssessment, setFraudAssessment] = useState<FraudAssessment | null>(null);
  const [allocationSuggestions, setAllocationSuggestions] = useState<AllocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'briefing' | 'recovery' | 'coach' | 'fraud' | 'allocation'>('briefing');

  // Client-side scoring fallback for demo mode
  useEffect(() => {
    if (useApi) {
      setLoading(true);
      Promise.all([
        aiApi.getRecoveryScore(caseData.id).then(r => setRecoveryScore(r.data)).catch(() => {}),
        (currentUser.role === Role.MANAGER || currentUser.role === Role.ADMIN || currentUser.role === Role.CEO)
          ? aiApi.fraudCheck(caseData.debtorId).then(r => setFraudAssessment(r.data)).catch(() => {})
          : Promise.resolve(),
        (currentUser.role === Role.MANAGER || currentUser.role === Role.ADMIN)
          ? aiApi.suggestOfficer(caseData.id).then(r => setAllocationSuggestions(r.data)).catch(() => {})
          : Promise.resolve(),
      ]).finally(() => setLoading(false));
    } else {
      // Demo mode: generate a mock score based on case data
      const mockScore = generateDemoScore(caseData);
      setRecoveryScore(mockScore);
    }
  }, [caseData.id, useApi]);

  if (loading) {
    return (
      <div className="p-4 text-center text-text-secondary text-sm">
        Analyzing case data...
      </div>
    );
  }

  // Compute AI intelligence from brain.ts
  const briefing = useMemo(() => generateCaseBriefing(caseData, [caseData]), [caseData]);
  const coach = useMemo(() => getNegotiationCoach(caseData, [caseData]), [caseData]);
  const profile = useMemo(() => profileDebtor(caseData), [caseData]);
  const writeOffRisk = useMemo(() => predictWriteOffRisk(caseData), [caseData]);
  const callTime = useMemo(() => suggestBestCallTime(caseData), [caseData]);
  const channel = useMemo(() => suggestBestChannel(caseData), [caseData]);

  const tabs = [
    { id: 'briefing' as const, label: 'AI Brief' },
    { id: 'coach' as const, label: 'Coach' },
    { id: 'recovery' as const, label: 'Score' },
    ...(currentUser.role !== Role.OFFICER && currentUser.role !== Role.FINANCE
      ? [
          { id: 'fraud' as const, label: 'Risk' },
          { id: 'allocation' as const, label: 'Assign' },
        ]
      : []),
  ];

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <span className="text-indigo-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-text-primary">AI Insights</h3>
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex border-b border-[var(--color-border)]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* AI BRIEFING TAB */}
        {activeTab === 'briefing' && (
          <div className="space-y-3 text-xs">
            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-2">
              {briefing.keyMetrics.map(m => (
                <div key={m.label} className="text-center p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">{m.label}</p>
                  <p className="font-bold mt-0.5" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
            {/* Summary */}
            <div className="p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
              <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">Summary</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">{briefing.summary}</p>
            </div>
            {/* Debtor Profile */}
            <div className="p-2.5 rounded-lg" style={{ background: 'rgba(242,140,40,0.05)', border: '1px solid rgba(242,140,40,0.15)' }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: '#F28C28' }}>Debtor Type: {profile.type}</p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">{profile.suggestedStrategy}</p>
              <div className="flex gap-1 mt-1.5">{profile.traits.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/50 text-[var(--color-text-tertiary)]">{t}</span>)}</div>
            </div>
            {/* Recommended Actions */}
            <div>
              <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">Recommended Actions</p>
              {briefing.recommendedActions.map((a, i) => (
                <p key={i} className="text-[11px] text-[var(--color-text-secondary)] py-0.5">→ {a}</p>
              ))}
            </div>
            {/* Quick Intel */}
            <div className="flex gap-2">
              <span className="text-[10px] px-2 py-1 rounded-md bg-blue-50 text-blue-700">📞 {channel.primaryChannel}</span>
              <span className="text-[10px] px-2 py-1 rounded-md bg-purple-50 text-purple-700">🕐 {callTime.bestTimeSlot}</span>
              <span className="text-[10px] px-2 py-1 rounded-md bg-red-50 text-red-700">⚠ WO Risk: {writeOffRisk.probability}%</span>
            </div>
          </div>
        )}

        {/* NEGOTIATION COACH TAB */}
        {activeTab === 'coach' && (
          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded-lg" style={{ background: '#1B2A4A' }}>
              <p className="text-[10px] font-bold text-orange-300 uppercase mb-1">Opening Script ({coach.debtorType})</p>
              <p className="text-[11px] text-blue-100/80 leading-relaxed italic">{coach.openingScript}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-emerald-50">
                <p className="text-[10px] font-bold text-emerald-700 mb-1">✓ DO</p>
                {coach.doList.map((d, i) => <p key={i} className="text-[10px] text-emerald-600">• {d}</p>)}
              </div>
              <div className="p-2 rounded-lg bg-red-50">
                <p className="text-[10px] font-bold text-red-700 mb-1">✗ DON'T</p>
                {coach.dontList.map((d, i) => <p key={i} className="text-[10px] text-red-600">• {d}</p>)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--color-bg-tertiary)]">
              <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">Settlement Guide</p>
              <div className="space-y-1">
                <p className="text-[11px]"><span className="text-emerald-600 font-bold">Open:</span> {coach.settlementGuide.opening}</p>
                <p className="text-[11px]"><span className="text-amber-600 font-bold">Mid:</span> {coach.settlementGuide.midpoint}</p>
                <p className="text-[11px]"><span className="text-red-600 font-bold">Floor:</span> {coach.settlementGuide.floor}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase mb-1">Closing Techniques</p>
              {coach.closingTechniques.map((t, i) => <p key={i} className="text-[10px] text-[var(--color-text-secondary)] py-0.5 italic">{t}</p>)}
            </div>
          </div>
        )}

        {activeTab === 'recovery' && recoveryScore && (
          <RecoveryTab score={recoveryScore} />
        )}
        {activeTab === 'fraud' && fraudAssessment && (
          <FraudTab assessment={fraudAssessment} />
        )}
        {activeTab === 'allocation' && allocationSuggestions.length > 0 && (
          <AllocationTab suggestions={allocationSuggestions} />
        )}
        {activeTab === 'fraud' && !fraudAssessment && (
          <p className="text-xs text-text-tertiary text-center py-4">
            {useApi ? 'Unable to load fraud analysis' : 'Fraud detection requires API mode'}
          </p>
        )}
        {activeTab === 'allocation' && allocationSuggestions.length === 0 && (
          <p className="text-xs text-text-tertiary text-center py-4">
            {useApi ? 'Unable to load suggestions' : 'Smart allocation requires API mode'}
          </p>
        )}
      </div>
    </div>
  );
};

const RecoveryTab: React.FC<{ score: RecoveryScore }> = ({ score }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <RecoveryScoreBadge score={score.score} size="lg" />
      <div className="text-right">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          score.confidence === 'High' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
          score.confidence === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {score.confidence} confidence
        </span>
        {score.predictedRecoveryDays && (
          <p className="text-xs text-text-tertiary mt-1">
            Est. {score.predictedRecoveryDays < 60 ? `${score.predictedRecoveryDays} days` : `${Math.round(score.predictedRecoveryDays / 30)} months`}
          </p>
        )}
      </div>
    </div>

    <p className="text-xs text-text-secondary bg-[var(--color-bg-tertiary)] p-2.5 rounded-md">
      {score.recommendation}
    </p>

    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-text-secondary uppercase">Score Breakdown</h4>
      {score.factors.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            f.impact === 'positive' ? 'bg-emerald-500' :
            f.impact === 'negative' ? 'bg-red-500' : 'bg-gray-400'
          }`} />
          <span className="text-text-secondary flex-1">{f.name}</span>
          <div className="w-20 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div
              className={`h-full rounded-full ${
                f.rawScore >= 60 ? 'bg-emerald-500' :
                f.rawScore >= 30 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${f.rawScore}%` }}
            />
          </div>
          <span className="text-text-tertiary w-6 text-right">{f.rawScore}</span>
        </div>
      ))}
    </div>
  </div>
);

const FraudTab: React.FC<{ assessment: FraudAssessment }> = ({ assessment }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <span className={`text-sm font-bold ${
        assessment.overallRisk === 'Critical' ? 'text-red-600' :
        assessment.overallRisk === 'High' ? 'text-orange-600' :
        assessment.overallRisk === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
      }`}>
        {assessment.overallRisk} Risk
      </span>
      {assessment.requiresManualReview && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
          Manual Review Required
        </span>
      )}
    </div>

    {assessment.flags.length === 0 ? (
      <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-md">
        No fraud indicators detected
      </p>
    ) : (
      <div className="space-y-2">
        {assessment.flags.map((flag, i) => (
          <div key={i} className={`text-xs p-2.5 rounded-md border-l-3 ${
            flag.severity === 'Critical' ? 'bg-red-50 dark:bg-red-900/10 border-red-500 text-red-700 dark:text-red-400' :
            flag.severity === 'Warning' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500 text-amber-700 dark:text-amber-400' :
            'bg-blue-50 dark:bg-blue-900/10 border-blue-500 text-blue-700 dark:text-blue-400'
          }`}>
            <span className="font-semibold">{flag.severity}:</span> {flag.message}
          </div>
        ))}
      </div>
    )}
  </div>
);

const AllocationTab: React.FC<{ suggestions: AllocationSuggestion[] }> = ({ suggestions }) => (
  <div className="space-y-2">
    <p className="text-xs text-text-tertiary mb-2">AI-recommended officers for this case:</p>
    {suggestions.slice(0, 5).map((s, i) => (
      <div key={s.officerId} className={`flex items-center justify-between text-xs p-2 rounded-md ${
        i === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-[var(--color-bg-tertiary)]'
      }`}>
        <div className="flex items-center gap-2">
          {i === 0 && <span className="text-primary font-bold text-[10px]">BEST</span>}
          <span className="font-medium text-text-primary">{s.officerName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-text-tertiary">{s.currentLoad} cases</span>
          <span className={`font-semibold ${s.score >= 70 ? 'text-emerald-600' : s.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {s.score}%
          </span>
        </div>
      </div>
    ))}
    {suggestions.length > 0 && suggestions[0].reasons.length > 0 && (
      <div className="mt-2 text-[10px] text-text-tertiary">
        {suggestions[0].reasons.map((r, i) => (
          <span key={i} className="inline-block mr-2">- {r}</span>
        ))}
      </div>
    )}
  </div>
);

// Demo mode: generate a deterministic score from ACTUAL case data — no randomness
function generateDemoScore(caseData: EnrichedCase): RecoveryScore {
  const now = new Date();

  // ── Derive real metrics from caseData ──
  const payments = caseData.history.filter(h => h.type === ActionType.PAYMENT_RECEIVED);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const contactActions = caseData.history.filter(h =>
    h.type === ActionType.SOFT_CALL || h.type === ActionType.STATUS_UPDATE
  );
  const successfulContacts = caseData.history.filter(h =>
    h.type === ActionType.SOFT_CALL && caseData.contactStatus === 'Contact'
  );

  // DPD from loan last payment date
  const lpd = caseData.loan?.lpd ? new Date(caseData.loan.lpd) : null;
  const dpd = lpd ? Math.max(0, Math.floor((now.getTime() - lpd.getTime()) / 86400000)) : 0;

  const balance = caseData.loan?.currentBalance || 0;
  const originalAmount = caseData.loan?.originalAmount || balance || 1;
  const paidRatio = originalAmount > 0 ? (originalAmount - balance) / originalAmount : 0;

  // ── Priority score based on actual DPD, balance, contact, payment history ──
  let score = 50; // baseline

  // DPD impact: lower DPD = higher recovery chance
  if (dpd <= 30) score += 20;
  else if (dpd <= 60) score += 10;
  else if (dpd <= 90) score += 0;
  else if (dpd <= 120) score -= 10;
  else if (dpd <= 180) score -= 20;
  else score -= 30; // >180 DPD severe penalty

  // Payment history: has payments = higher recovery
  if (payments.length >= 3) score += 20;
  else if (payments.length >= 1) score += 12;
  else score -= 10; // no payments at all

  // Contact history: contacted = higher recovery
  if (caseData.contactStatus === 'Contact') score += 12;
  else if (successfulContacts.length > 0) score += 6;
  else score -= 12;

  // Balance ratio: more paid off = higher score
  score += Math.round(paidRatio * 15);

  // Status-based adjustments using actual CRM status
  const statusScores: Record<string, number> = {
    'PTP': 15, 'UNDER NEGO': 10, 'FIP': 5, 'WIP': 3, 'CB': 0,
    'DXB': -5, 'UTR': -15, 'NCC': -18, 'NITP': -22, 'Dispute': -8,
    'NIP': -25, 'Expire': -25, 'Closed': 30, 'NEW': 2,
  };
  score += statusScores[caseData.crmStatus] || 0;

  // Work status
  if (caseData.workStatus === 'Work') score += 3;

  score = Math.max(5, Math.min(95, score));

  // ── Recovery chance % — derived from real signals ──
  // has payments → higher, high DPD → lower, contacted → higher
  let recoveryChance = 40;
  if (payments.length > 0) recoveryChance += Math.min(25, payments.length * 10);
  if (dpd > 180) recoveryChance -= 25;
  else if (dpd > 90) recoveryChance -= 15;
  else if (dpd <= 30) recoveryChance += 10;
  if (caseData.contactStatus === 'Contact') recoveryChance += 15;
  else if (contactActions.length > 0) recoveryChance += 5;
  recoveryChance = Math.max(5, Math.min(95, recoveryChance));

  // ── Write-off risk from actual DPD thresholds ──
  // DPD > 180 = high risk, no payments + no contact = critical
  let writeOffRiskLabel: string;
  if (dpd > 180 && payments.length === 0 && successfulContacts.length === 0) {
    writeOffRiskLabel = 'Critical';
  } else if (dpd > 180) {
    writeOffRiskLabel = 'High';
  } else if (dpd > 120 && payments.length === 0) {
    writeOffRiskLabel = 'High';
  } else if (dpd > 90) {
    writeOffRiskLabel = 'Medium';
  } else {
    writeOffRiskLabel = 'Low';
  }

  // ── DPD raw score for factor display ──
  const dpdRawScore = dpd <= 30 ? 80 : dpd <= 60 ? 65 : dpd <= 90 ? 50 : dpd <= 120 ? 35 : dpd <= 180 ? 20 : 10;

  // ── Engagement recency from actual last contact date ──
  const lastContactDate = caseData.lastContactDate ? new Date(caseData.lastContactDate) : null;
  const daysSinceContact = lastContactDate ? Math.floor((now.getTime() - lastContactDate.getTime()) / 86400000) : 999;
  const engagementRawScore = daysSinceContact <= 3 ? 85 : daysSinceContact <= 7 ? 70 : daysSinceContact <= 14 ? 50 : daysSinceContact <= 30 ? 30 : 15;

  // ── Case age from assignment or creation date ──
  const caseStartDate = caseData.creationDate ? new Date(caseData.creationDate) : (caseData.history.length > 0 ? new Date(caseData.history[caseData.history.length - 1].timestamp) : now);
  const caseAgeDays = Math.max(0, Math.floor((now.getTime() - caseStartDate.getTime()) / 86400000));
  const caseAgeRawScore = caseAgeDays <= 30 ? 75 : caseAgeDays <= 60 ? 60 : caseAgeDays <= 90 ? 45 : caseAgeDays <= 180 ? 30 : 15;

  const factors = [
    { name: 'Contact Status', weight: 0.20, rawScore: caseData.contactStatus === 'Contact' ? 80 : (successfulContacts.length > 0 ? 45 : 15), weightedScore: 0, impact: caseData.contactStatus === 'Contact' ? 'positive' as const : 'negative' as const, detail: caseData.contactStatus === 'Contact' ? `Debtor reachable (${contactActions.length} attempts)` : `Not contactable (${contactActions.length} attempts, ${daysSinceContact < 999 ? daysSinceContact + 'd ago' : 'never'})` },
    { name: 'Payment History', weight: 0.25, rawScore: Math.min(95, payments.length > 0 ? 30 + payments.length * 18 : 10), weightedScore: 0, impact: payments.length > 0 ? 'positive' as const : 'negative' as const, detail: payments.length > 0 ? `${payments.length} payment(s), total ${caseData.loan?.currency || 'AED'} ${totalPaid.toLocaleString()}` : 'No payments recorded' },
    { name: 'Days Past Due', weight: 0.20, rawScore: dpdRawScore, weightedScore: 0, impact: dpd <= 60 ? 'positive' as const : dpd <= 120 ? 'neutral' as const : 'negative' as const, detail: `${dpd} DPD — ${writeOffRiskLabel} write-off risk` },
    { name: 'Engagement Recency', weight: 0.12, rawScore: engagementRawScore, weightedScore: 0, impact: daysSinceContact <= 7 ? 'positive' as const : daysSinceContact <= 30 ? 'neutral' as const : 'negative' as const, detail: daysSinceContact < 999 ? `Last contact ${daysSinceContact}d ago` : 'No contact on record' },
    { name: 'Balance Ratio', weight: 0.10, rawScore: Math.min(90, Math.round(paidRatio * 100) + 10), weightedScore: 0, impact: paidRatio > 0.3 ? 'positive' as const : paidRatio > 0 ? 'neutral' as const : 'negative' as const, detail: `${Math.round(paidRatio * 100)}% of original amount recovered` },
    { name: 'Case Status', weight: 0.08, rawScore: (statusScores[caseData.crmStatus] || 0) + 50, weightedScore: 0, impact: (statusScores[caseData.crmStatus] || 0) >= 5 ? 'positive' as const : (statusScores[caseData.crmStatus] || 0) <= -10 ? 'negative' as const : 'neutral' as const, detail: `Status: ${caseData.crmStatus}${caseData.subStatus ? ' / ' + caseData.subStatus : ''}` },
    { name: 'Case Age', weight: 0.05, rawScore: caseAgeRawScore, weightedScore: 0, impact: caseAgeDays <= 60 ? 'positive' as const : caseAgeDays <= 120 ? 'neutral' as const : 'negative' as const, detail: `${caseAgeDays} days since assignment` },
  ];

  factors.forEach(f => { f.rawScore = Math.max(0, Math.min(100, f.rawScore)); f.weightedScore = Math.round(f.rawScore * f.weight); });

  // Predicted recovery days based on actual signals
  const predictedDays = score >= 70 ? Math.round(30 + (100 - score) * 1.5)
    : score >= 50 ? Math.round(60 + (70 - score) * 4)
    : score >= 30 ? Math.round(150 + (50 - score) * 5)
    : null;

  // Build contextual recommendation from actual data
  let recommendation: string;
  if (score >= 70) {
    recommendation = `Strong recovery potential (${recoveryChance}% chance). ${payments.length > 0 ? `${payments.length} prior payment(s) indicate willingness.` : ''} Maintain regular contact and push for payment plan.`;
  } else if (score >= 50) {
    recommendation = `Moderate recovery chance (${recoveryChance}%). ${dpd > 90 ? `DPD at ${dpd} — urgency increasing.` : ''} ${payments.length === 0 ? 'No payment history yet — consider settlement offer.' : 'Prior payments exist — follow up on payment plan.'}`;
  } else if (score >= 30) {
    recommendation = `Low recovery likelihood (${recoveryChance}%). ${dpd > 120 ? `DPD ${dpd} approaching write-off threshold.` : ''} ${caseData.contactStatus !== 'Contact' ? 'Debtor not contactable — escalate tracing.' : 'Consider legal escalation or settlement discount.'}`;
  } else {
    recommendation = `Very low recovery (${recoveryChance}%). DPD: ${dpd}. ${writeOffRiskLabel === 'Critical' ? 'Critical write-off risk — no payments and no contact.' : 'Recommend legal action or write-off assessment.'}`;
  }

  return {
    score,
    confidence: score > 65 ? 'High' : score > 35 ? 'Medium' : 'Low',
    riskLevel: writeOffRiskLabel === 'Critical' ? 'Very High' : writeOffRiskLabel === 'High' ? 'High' : writeOffRiskLabel === 'Medium' ? 'Medium' : score >= 60 ? 'Low' : 'Very Low',
    factors,
    recommendation,
    predictedRecoveryDays: predictedDays,
  };
}

export default AiInsightsPanel;
