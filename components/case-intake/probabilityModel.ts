// ── Recovery Probability Model ─────────────────────────────────────────────
// Multi-factor weighted scoring. Calibrated against Pakistani recovery patterns
// for Gulf-bank defaulters. Returns 0-100 probability + breakdown + actions.

export interface IntakeData {
  // Loan
  bank: string;
  product: string;          // Personal Loan / Credit Card / Auto / Mortgage / Business
  originalAmount: number;
  currentBalance: number;
  currency: string;
  dpd: number;              // Days past due
  caseAgeYears: number;     // 0 if just received from bank
  bucket: string;           // 0-30 / 31-60 / 61-90 / 91-180 / 181-365 / 365+
  priorRecovered: number;   // Amount already paid (if any) before handover

  // Debtor demographics
  ageGroup: 'under_30' | '30_45' | '45_60' | 'over_60' | 'unknown';
  employmentType: 'salaried' | 'business' | 'unemployed' | 'retired' | 'student' | 'unknown';
  monthlyIncome: 'under_50k' | '50_100k' | '100_200k' | '200_500k' | 'over_500k' | 'unknown';
  city: string;
  province: string;
  hasFamilyContact: boolean;
  hasEmployerInfo: boolean;
  hasProperty: boolean;
  hasOtherActiveLoans: boolean;

  // Contactability
  hasValidPkPhone: boolean;
  whatsappActive: boolean;
  cnicValid: boolean;
  addressVerified: boolean;
  reachedBefore: boolean;     // Has anyone (bank or us) contacted them?
  dispositionLast: 'answered' | 'no_answer' | 'busy' | 'switched_off' | 'refused' | 'ptp' | 'never';

  // Risk flags
  cyberFlag: boolean;
  deceasedFlag: boolean;
  outOfCountry: boolean;
  disputeFiled: boolean;
  bankruptcyFiled: boolean;
  criminalCase: boolean;
}

export interface ProbabilityResult {
  probability: number;            // 0-100
  band: 'high' | 'medium' | 'low' | 'kill';
  confidence: 'high' | 'medium' | 'low';   // confidence in our estimate
  expectedRecoveryAmount: number;
  factors: { label: string; impact: number; positive: boolean; reason: string }[];
  recommendedStrategy: string;
  recommendedSettlementPercent: number;    // % of current balance to offer
  recommendedTimeframeDays: number;        // how long to spend on this case
  officerProfileMatch: string;             // what kind of officer best fits
  topActions: string[];                    // first 3 things to do
  warnings: string[];
}

const round = (n: number) => Math.round(n);

// ── Bank-specific base recovery rates (industry benchmarks, conservative) ──
const BANK_BASE: Record<string, number> = {
  // Saudi
  'Saudi National Bank (SNB)': 35,
  'NCB': 32,
  'Samba': 32,
  'Al Rajhi Bank': 38,
  'Riyad Bank': 36,
  'Banque Saudi Fransi': 35,
  'SABB': 36,
  'Saudi British Bank': 36,
  'Alawwal Bank': 30,

  // UAE
  'Emirates NBD': 40,
  'ENBD': 40,
  'NBD': 38,
  'First Abu Dhabi Bank (FAB)': 42,
  'FAB': 42,
  'Abu Dhabi Commercial Bank (ADCB)': 38,
  'ADCB': 38,
  'Mashreq Bank': 35,
  'Commercial Bank of Dubai': 36,
  'CBD': 36,
  'Dubai Islamic Bank (DIB)': 38,
  'DIB': 38,
  'Abu Dhabi Islamic Bank (ADIB)': 38,
  'ADIB': 38,
  'HSBC UAE': 34,
  'Citibank UAE': 33,
  'Standard Chartered': 33,

  // Kuwait, Bahrain, Qatar, Oman
  'NBK': 36,
  'Kuwait Finance House': 35,
  'KFH': 35,
  'Ahli United Bank': 34,
  'AUB': 34,
  'Bank of Bahrain and Kuwait': 33,
  'Qatar National Bank': 38,
  'QNB': 38,
  'Bank Muscat': 35,
};

const productMultiplier = (p: string): number => {
  const lower = (p || '').toLowerCase();
  if (lower.includes('credit card')) return 0.85;     // hardest
  if (lower.includes('personal')) return 1.0;
  if (lower.includes('auto')) return 1.10;            // collateral helps
  if (lower.includes('mortgage')) return 1.20;
  if (lower.includes('business')) return 0.90;
  return 1.0;
};

// ── Main scoring ─────────────────────────────────────────────────────────────
export function calculateProbability(d: IntakeData): ProbabilityResult {
  const factors: ProbabilityResult['factors'] = [];
  const warnings: string[] = [];

  // ── Hard kills ─────────────────────────────────────────────────────────
  if (d.cyberFlag) {
    return {
      probability: 0, band: 'kill', confidence: 'high', expectedRecoveryAmount: 0,
      factors: [{ label: 'Cyber/Fraud Flag', impact: -100, positive: false, reason: 'Identity fraud — recovery near zero' }],
      recommendedStrategy: 'Submit to bank for write-off. No recovery effort.',
      recommendedSettlementPercent: 0, recommendedTimeframeDays: 0,
      officerProfileMatch: 'Compliance review only',
      topActions: ['Document fraud evidence', 'Submit to bank', 'Close case'],
      warnings: ['Cyber flag — no further work permitted'],
    };
  }
  if (d.deceasedFlag) {
    return {
      probability: 5, band: 'kill', confidence: 'high', expectedRecoveryAmount: d.currentBalance * 0.05,
      factors: [{ label: 'Deceased', impact: -95, positive: false, reason: 'Pursue estate/heirs only via legal' }],
      recommendedStrategy: 'Coordinate with bank legal — contact heirs only with bank approval.',
      recommendedSettlementPercent: 30, recommendedTimeframeDays: 60,
      officerProfileMatch: 'Senior officer + legal liaison',
      topActions: ['Verify death certificate', 'Get bank legal approval', 'Identify heirs (NADRA family tree)'],
      warnings: ['Death case — strict legal protocol'],
    };
  }
  if (d.bankruptcyFiled) {
    return {
      probability: 3, band: 'kill', confidence: 'high', expectedRecoveryAmount: d.currentBalance * 0.03,
      factors: [{ label: 'Bankruptcy', impact: -90, positive: false, reason: 'Court process controls recovery' }],
      recommendedStrategy: 'Wait for court — register as creditor.',
      recommendedSettlementPercent: 0, recommendedTimeframeDays: 0,
      officerProfileMatch: 'Legal team',
      topActions: ['Register claim with court', 'Hold active recovery'],
      warnings: ['Bankruptcy — recovery limited to court distribution'],
    };
  }

  // ── Base rate (bank-specific) ──────────────────────────────────────────
  let score = BANK_BASE[d.bank] ?? 35;
  factors.push({ label: 'Bank base rate', impact: score, positive: true, reason: `${d.bank}: industry recovery ${score}%` });

  // ── Product type multiplier ────────────────────────────────────────────
  const pm = productMultiplier(d.product);
  const productBoost = (pm - 1) * 100 * 0.3;  // softer effect
  if (productBoost !== 0) {
    factors.push({
      label: `Product: ${d.product}`,
      impact: round(productBoost),
      positive: productBoost > 0,
      reason: pm > 1 ? 'Secured product — higher recovery' : 'Unsecured/credit card — harder',
    });
    score *= pm;
  }

  // ── DPD / age (steep decay) ────────────────────────────────────────────
  const dpd = d.dpd;
  let dpdPenalty = 0;
  if (dpd > 1095) dpdPenalty = -28;
  else if (dpd > 730) dpdPenalty = -22;
  else if (dpd > 365) dpdPenalty = -15;
  else if (dpd > 180) dpdPenalty = -8;
  else if (dpd > 90) dpdPenalty = -4;
  if (dpdPenalty < 0) {
    score += dpdPenalty;
    factors.push({ label: 'DPD age', impact: dpdPenalty, positive: false, reason: `${dpd}d past due — recovery curve drops sharply after 1yr` });
  }

  // ── Case age in our hands (effort decay) ───────────────────────────────
  if (d.caseAgeYears >= 2) {
    score -= 10;
    factors.push({ label: 'In recovery 2yr+', impact: -10, positive: false, reason: 'Effort exhausted — diminishing returns' });
  } else if (d.caseAgeYears >= 1) {
    score -= 5;
    factors.push({ label: 'In recovery 1yr+', impact: -5, positive: false, reason: 'Past prime collection window' });
  }

  // ── Prior payments (engaged debtor signal) ─────────────────────────────
  if (d.priorRecovered > 0) {
    const recoveryRatio = d.priorRecovered / d.originalAmount;
    if (recoveryRatio > 0.3) {
      score += 12;
      factors.push({ label: 'Significant prior payments', impact: 12, positive: true, reason: `Already paid ${round(recoveryRatio * 100)}% — engaged debtor` });
    } else if (recoveryRatio > 0.05) {
      score += 6;
      factors.push({ label: 'Some prior payments', impact: 6, positive: true, reason: `${round(recoveryRatio * 100)}% paid — has shown willingness` });
    }
  }

  // ── Demographics ────────────────────────────────────────────────────────
  if (d.employmentType === 'salaried') {
    score += 8;
    factors.push({ label: 'Salaried', impact: 8, positive: true, reason: 'Predictable monthly income — installments feasible' });
  } else if (d.employmentType === 'business') {
    score += 4;
    factors.push({ label: 'Business owner', impact: 4, positive: true, reason: 'Income variable but typically liquid' });
  } else if (d.employmentType === 'unemployed') {
    score -= 12;
    factors.push({ label: 'Unemployed', impact: -12, positive: false, reason: 'No regular income — settlement only' });
    warnings.push('Unemployed — push for one-time settlement');
  } else if (d.employmentType === 'retired') {
    score -= 5;
    factors.push({ label: 'Retired', impact: -5, positive: false, reason: 'Fixed income — small installments possible' });
  } else if (d.employmentType === 'student') {
    score -= 8;
    factors.push({ label: 'Student', impact: -8, positive: false, reason: 'No own income — pursue parent/guarantor' });
  }

  if (d.monthlyIncome === 'over_500k' || d.monthlyIncome === '200_500k') {
    score += 8;
    factors.push({ label: 'High income', impact: 8, positive: true, reason: 'Capacity to pay confirmed' });
  } else if (d.monthlyIncome === 'under_50k') {
    score -= 6;
    factors.push({ label: 'Low income', impact: -6, positive: false, reason: 'Limited capacity — long installment or settlement' });
  }

  if (d.ageGroup === '30_45') {
    score += 4;
    factors.push({ label: 'Prime working age', impact: 4, positive: true, reason: 'Career peak — most recovery happens here' });
  } else if (d.ageGroup === 'over_60') {
    score -= 6;
    factors.push({ label: 'Senior', impact: -6, positive: false, reason: 'Income may have dropped post-retirement' });
  } else if (d.ageGroup === 'under_30') {
    score -= 3;
    factors.push({ label: 'Young', impact: -3, positive: false, reason: 'Lower asset base typically' });
  }

  // ── Asset / leverage signals ───────────────────────────────────────────
  if (d.hasProperty) {
    score += 8;
    factors.push({ label: 'Has property', impact: 8, positive: true, reason: 'Hard asset — leverage point' });
  }
  if (d.hasOtherActiveLoans) {
    score += 4;
    factors.push({ label: 'Active in credit system', impact: 4, positive: true, reason: 'Wants clean credit — motivation to settle' });
  }

  // ── Contactability ──────────────────────────────────────────────────────
  if (!d.hasValidPkPhone) {
    score -= 18;
    factors.push({ label: 'No valid PK phone', impact: -18, positive: false, reason: 'Cannot reach — tracing first' });
    warnings.push('No valid Pakistani number — skip-trace required');
  }
  if (d.cnicValid) {
    score += 3;
    factors.push({ label: 'Valid CNIC', impact: 3, positive: true, reason: 'NADRA / PTA / eCIB lookups possible' });
  } else {
    score -= 8;
    factors.push({ label: 'CNIC missing/invalid', impact: -8, positive: false, reason: 'Limits all PK data sources' });
  }
  if (d.addressVerified) {
    score += 4;
    factors.push({ label: 'Address verified', impact: 4, positive: true, reason: 'Field visit option open' });
  }
  if (d.whatsappActive) {
    score += 3;
    factors.push({ label: 'WhatsApp active', impact: 3, positive: true, reason: 'Modern channel works' });
  }
  if (d.hasFamilyContact) {
    score += 5;
    factors.push({ label: 'Family contact known', impact: 5, positive: true, reason: 'Reference angle available' });
  }
  if (d.hasEmployerInfo) {
    score += 4;
    factors.push({ label: 'Employer known', impact: 4, positive: true, reason: 'Verification leverage' });
  }

  // ── Disposition signal ──────────────────────────────────────────────────
  if (d.dispositionLast === 'ptp') {
    score += 6;
    factors.push({ label: 'Last contact: PTP', impact: 6, positive: true, reason: 'Engagement signal — but verify intent' });
  } else if (d.dispositionLast === 'answered') {
    score += 4;
    factors.push({ label: 'Last contact: Answered', impact: 4, positive: true, reason: 'Reachable — keep calling' });
  } else if (d.dispositionLast === 'refused') {
    score -= 12;
    factors.push({ label: 'Last contact: Refused', impact: -12, positive: false, reason: 'Explicit refusal — leverage or settle' });
  } else if (d.dispositionLast === 'switched_off') {
    score -= 8;
    factors.push({ label: 'Phone switched off', impact: -8, positive: false, reason: 'Avoiding — needs alt channel' });
  } else if (d.dispositionLast === 'never') {
    score -= 5;
    factors.push({ label: 'Never contacted', impact: -5, positive: false, reason: 'Unknown engagement — high uncertainty' });
  }

  // ── Other risks ─────────────────────────────────────────────────────────
  if (d.outOfCountry) {
    score -= 18;
    factors.push({ label: 'Out of Pakistan', impact: -18, positive: false, reason: 'Limited recovery options' });
    warnings.push('Out of country — cross-border recovery is hard');
  }
  if (d.disputeFiled) {
    score -= 10;
    factors.push({ label: 'Active dispute', impact: -10, positive: false, reason: 'Legal pause until resolved' });
  }
  if (d.criminalCase) {
    score -= 15;
    factors.push({ label: 'Criminal case open', impact: -15, positive: false, reason: 'Diverts debtor focus + legal complexity' });
  }

  // ── Clamp ──────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, round(score)));

  // ── Confidence (data completeness) ─────────────────────────────────────
  const dataPoints = [
    d.cnicValid, d.hasValidPkPhone, d.addressVerified, d.dispositionLast !== 'never',
    d.employmentType !== 'unknown', d.monthlyIncome !== 'unknown', d.ageGroup !== 'unknown',
  ];
  const completeness = dataPoints.filter(Boolean).length / dataPoints.length;
  let confidence: ProbabilityResult['confidence'];
  if (completeness >= 0.85) confidence = 'high';
  else if (completeness >= 0.55) confidence = 'medium';
  else confidence = 'low';

  // ── Band, strategy, settlement ─────────────────────────────────────────
  let band: ProbabilityResult['band'];
  let recommendedStrategy: string;
  let recommendedSettlementPercent: number;
  let recommendedTimeframeDays: number;
  let officerProfileMatch: string;
  let topActions: string[];

  if (score >= 65) {
    band = 'high';
    recommendedStrategy = 'PURSUE FULL — payment plan or one-time. Engaged profile, push for full balance.';
    recommendedSettlementPercent = 90;
    recommendedTimeframeDays = 45;
    officerProfileMatch = 'Negotiation-strong officer, fluent Urdu/English';
    topActions = ['Call within 24h', 'Confirm employment & income', 'Propose 3-installment plan'];
  } else if (score >= 40) {
    band = 'medium';
    recommendedStrategy = 'SETTLE 30-50% — open at full, walk to 60% if needed. Time-bound discount.';
    recommendedSettlementPercent = 60;
    recommendedTimeframeDays = 30;
    officerProfileMatch = 'Experienced negotiator';
    topActions = ['Verify all phones first', 'Open with full balance', 'Soft-pivot to settlement on 2nd call'];
  } else if (score >= 20) {
    band = 'low';
    recommendedStrategy = 'SETTLE 50-70% or final letter route. Don\'t over-invest effort.';
    recommendedSettlementPercent = 45;
    recommendedTimeframeDays = 20;
    officerProfileMatch = 'Closing-focused officer';
    topActions = ['One verification call', 'One settlement offer', 'Escalate to manager if no response in 7d'];
  } else {
    band = 'kill';
    recommendedStrategy = 'WRITE-OFF candidate. Minimal effort: 1-2 contact attempts, then return to bank.';
    recommendedSettlementPercent = 25;
    recommendedTimeframeDays = 10;
    officerProfileMatch = 'Junior officer (low effort acceptable)';
    topActions = ['One contact attempt', 'Document attempt', 'Mark for write-off review'];
  }

  const expectedRecoveryAmount = round(d.currentBalance * (score / 100) * (recommendedSettlementPercent / 100));

  return {
    probability: score,
    band,
    confidence,
    expectedRecoveryAmount,
    factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    recommendedStrategy,
    recommendedSettlementPercent,
    recommendedTimeframeDays,
    officerProfileMatch,
    topActions,
    warnings,
  };
}

// ── Default empty intake ─────────────────────────────────────────────────────
export const emptyIntake = (): IntakeData => ({
  bank: '', product: 'Personal Loan', originalAmount: 0, currentBalance: 0, currency: 'AED',
  dpd: 0, caseAgeYears: 0, bucket: '', priorRecovered: 0,
  ageGroup: 'unknown', employmentType: 'unknown', monthlyIncome: 'unknown',
  city: '', province: '', hasFamilyContact: false, hasEmployerInfo: false,
  hasProperty: false, hasOtherActiveLoans: false,
  hasValidPkPhone: false, whatsappActive: false, cnicValid: false, addressVerified: false,
  reachedBefore: false, dispositionLast: 'never',
  cyberFlag: false, deceasedFlag: false, outOfCountry: false,
  disputeFiled: false, bankruptcyFiled: false, criminalCase: false,
});
