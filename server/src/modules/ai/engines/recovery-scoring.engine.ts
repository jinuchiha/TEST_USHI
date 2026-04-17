/**
 * Recovery Probability Scoring Engine
 *
 * A rule-based scoring system that calculates the probability of debt recovery
 * based on weighted factors from debtor history, payment behavior, demographics,
 * and case status. Designed to be replaced with a trained ML model later.
 *
 * Score range: 0-100 (percentage probability)
 *
 * Factor weights (total = 1.0):
 *   - Contact Status (0.20): Whether debtor is reachable
 *   - Payment History (0.25): Past payment behavior
 *   - CRM Status (0.20): Current case progression stage
 *   - Days Since Last Contact (0.10): Recency of engagement
 *   - Outstanding Balance Ratio (0.10): How much has been paid vs owed
 *   - Demographics (0.08): Location, employment signals
 *   - Case Age (0.07): How long the case has been open
 */

export interface ScoringInput {
  crmStatus: string;
  subStatus: string;
  contactStatus: 'Contact' | 'Non Contact';
  workStatus: 'Work' | 'Non Work';
  daysSinceLastContact: number;
  caseAgeDays: number;
  totalPayments: number;
  paymentCount: number;
  originalAmount: number;
  currentBalance: number;
  promiseToPayCount: number;
  brokenPromiseCount: number;
  isInUAE: boolean;
  hasMOLActive: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  currency: string;
  // Enhanced inputs
  daysOverdue: number;              // days since first missed payment
  daysSinceLastPayment: number;     // days since most recent payment
  writeOffDate: string | null;      // loan write-off date (if set)
  daysUntilWriteOff: number | null; // countdown to write-off
  emiAmount: number;                // monthly EMI if known
  partialPaymentCount: number;      // times debtor paid partial amounts
  settlementOffered: boolean;       // was settlement ever offered
}

export interface RecoveryScore {
  score: number;               // 0-100
  confidence: 'High' | 'Medium' | 'Low';
  riskLevel: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
  factors: ScoreFactor[];
  recommendation: string;
  predictedRecoveryDays: number | null;
}

export interface ScoreFactor {
  name: string;
  weight: number;
  rawScore: number;            // 0-100 before weight
  weightedScore: number;       // rawScore * weight
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

export function calculateRecoveryScore(input: ScoringInput): RecoveryScore {
  const factors: ScoreFactor[] = [];

  // Factor 1: Contact Status (weight 0.20)
  const contactScore = scoreContactStatus(input);
  factors.push({
    name: 'Contact Status',
    weight: 0.20,
    rawScore: contactScore.raw,
    weightedScore: contactScore.raw * 0.20,
    impact: contactScore.raw >= 50 ? 'positive' : 'negative',
    detail: contactScore.detail,
  });

  // Factor 2: Payment History (weight 0.25)
  const paymentScore = scorePaymentHistory(input);
  factors.push({
    name: 'Payment History',
    weight: 0.25,
    rawScore: paymentScore.raw,
    weightedScore: paymentScore.raw * 0.25,
    impact: paymentScore.raw >= 50 ? 'positive' : 'negative',
    detail: paymentScore.detail,
  });

  // Factor 3: CRM Status (weight 0.20)
  const statusScore = scoreCRMStatus(input);
  factors.push({
    name: 'Case Status',
    weight: 0.20,
    rawScore: statusScore.raw,
    weightedScore: statusScore.raw * 0.20,
    impact: statusScore.raw >= 50 ? 'positive' : 'negative',
    detail: statusScore.detail,
  });

  // Factor 4: Days Since Last Contact (weight 0.10)
  const recencyScore = scoreRecency(input);
  factors.push({
    name: 'Engagement Recency',
    weight: 0.10,
    rawScore: recencyScore.raw,
    weightedScore: recencyScore.raw * 0.10,
    impact: recencyScore.raw >= 50 ? 'positive' : 'negative',
    detail: recencyScore.detail,
  });

  // Factor 5: Outstanding Balance Ratio (weight 0.10)
  const balanceScore = scoreBalanceRatio(input);
  factors.push({
    name: 'Balance Ratio',
    weight: 0.10,
    rawScore: balanceScore.raw,
    weightedScore: balanceScore.raw * 0.10,
    impact: balanceScore.raw >= 50 ? 'positive' : 'negative',
    detail: balanceScore.detail,
  });

  // Factor 6: Demographics (weight 0.08)
  const demoScore = scoreDemographics(input);
  factors.push({
    name: 'Demographics',
    weight: 0.08,
    rawScore: demoScore.raw,
    weightedScore: demoScore.raw * 0.08,
    impact: demoScore.raw >= 50 ? 'positive' : 'neutral',
    detail: demoScore.detail,
  });

  // Factor 7: Case Age (weight 0.07)
  const ageScore = scoreCaseAge(input);
  factors.push({
    name: 'Case Age',
    weight: 0.07,
    rawScore: ageScore.raw,
    weightedScore: ageScore.raw * 0.07,
    impact: ageScore.raw >= 50 ? 'positive' : 'negative',
    detail: ageScore.detail,
  });

  // Calculate total score
  const totalScore = Math.round(
    factors.reduce((sum, f) => sum + f.weightedScore, 0)
  );
  const score = Math.max(0, Math.min(100, totalScore));

  // Determine confidence
  const confidence = determineConfidence(input);

  // Risk level
  const riskLevel = getRiskLevel(score);

  // Recommendation
  const recommendation = getRecommendation(score, input);

  // Predicted recovery days
  const predictedRecoveryDays = predictRecoveryTimeline(score, input);

  return {
    score,
    confidence,
    riskLevel,
    factors,
    recommendation,
    predictedRecoveryDays,
  };
}

function scoreContactStatus(input: ScoringInput): { raw: number; detail: string } {
  let raw = 0;
  const details: string[] = [];

  if (input.contactStatus === 'Contact') {
    raw += 60;
    details.push('Debtor is contactable');
  } else {
    raw += 15;
    details.push('Debtor not contactable');
  }

  if (input.hasPhone) { raw += 15; details.push('Phone available'); }
  if (input.hasEmail) { raw += 10; details.push('Email available'); }
  if (input.isInUAE) { raw += 15; details.push('Located in UAE'); }
  else { raw -= 10; details.push('Outside UAE'); }

  return { raw: Math.max(0, Math.min(100, raw)), detail: details.join('. ') };
}

function scorePaymentHistory(input: ScoringInput): { raw: number; detail: string } {
  let raw = 30; // base score
  const details: string[] = [];

  if (input.paymentCount > 0) {
    raw += Math.min(40, input.paymentCount * 15);
    details.push(`${input.paymentCount} payment(s) made`);
  } else {
    details.push('No payments recorded');
  }

  if (input.promiseToPayCount > 0) {
    const ptpReliability = input.brokenPromiseCount > 0
      ? (input.promiseToPayCount - input.brokenPromiseCount) / input.promiseToPayCount
      : 1;
    raw += Math.round(ptpReliability * 20);
    if (ptpReliability >= 0.7) {
      details.push('Good PTP track record');
    } else {
      raw -= 15;
      details.push('Unreliable PTP history');
    }
  }

  // Total paid ratio
  if (input.originalAmount > 0) {
    const paidRatio = input.totalPayments / input.originalAmount;
    raw += Math.round(paidRatio * 30);
    if (paidRatio >= 0.5) details.push(`${Math.round(paidRatio * 100)}% of original debt paid`);
  }

  return { raw: Math.max(0, Math.min(100, raw)), detail: details.join('. ') || 'No payment data' };
}

function scoreCRMStatus(input: ScoringInput): { raw: number; detail: string } {
  const statusScores: Record<string, number> = {
    'PTP': 80,
    'UNDER NEGO': 70,
    'FIP': 60,
    'WIP': 55,
    'CB': 45,
    'DXB': 40,
    'UTR': 30,
    'NCC': 20,
    'NITP': 15,
    'Dispute': 25,
    'NIP': 10,
    'Expire': 10,
    'WDS': 5,
    'Withdrawn': 5,
    'Closed': 95,
  };

  const raw = statusScores[input.crmStatus] || 30;
  let detail = `Current status: ${input.crmStatus}`;

  if (input.subStatus) {
    detail += ` / ${input.subStatus}`;
    // Sub-status adjustments
    if (input.subStatus === 'Promise To Pay') detail += ' (Active promise)';
    if (input.subStatus === 'Follow Up') detail += ' (In follow-up)';
    if (input.subStatus === 'Financial Issues') detail += ' (Financial difficulty)';
  }

  return { raw, detail };
}

function scoreRecency(input: ScoringInput): { raw: number; detail: string } {
  const days = input.daysSinceLastContact;

  if (days <= 3) return { raw: 95, detail: 'Contacted within last 3 days' };
  if (days <= 7) return { raw: 85, detail: 'Contacted within last week' };
  if (days <= 14) return { raw: 70, detail: 'Contacted within last 2 weeks' };
  if (days <= 30) return { raw: 50, detail: 'Contacted within last month' };
  if (days <= 60) return { raw: 30, detail: 'Last contact over a month ago' };
  if (days <= 90) return { raw: 15, detail: 'Last contact over 2 months ago' };
  return { raw: 5, detail: `No contact in ${days} days` };
}

function scoreBalanceRatio(input: ScoringInput): { raw: number; detail: string } {
  if (input.originalAmount <= 0) return { raw: 50, detail: 'No balance data' };

  const paidPct = ((input.originalAmount - input.currentBalance) / input.originalAmount) * 100;
  const raw = Math.min(100, Math.round(paidPct * 1.2 + 10));

  return {
    raw,
    detail: `${Math.round(paidPct)}% of original balance recovered`,
  };
}

function scoreDemographics(input: ScoringInput): { raw: number; detail: string } {
  let raw = 50;
  const details: string[] = [];

  if (input.isInUAE) { raw += 20; details.push('In UAE'); }
  if (input.hasMOLActive) { raw += 20; details.push('MOL Active (employed)'); }

  // Currency-based adjustments (higher value currencies = higher debt weight)
  if (input.currency === 'KWD' || input.currency === 'BHD') {
    raw += 10;
    details.push('High-value currency');
  }

  return { raw: Math.max(0, Math.min(100, raw)), detail: details.join('. ') || 'Standard demographics' };
}

function scoreCaseAge(input: ScoringInput): { raw: number; detail: string } {
  const days = input.caseAgeDays;

  if (days <= 30) return { raw: 90, detail: 'Fresh case (< 1 month)' };
  if (days <= 90) return { raw: 75, detail: 'Recent case (1-3 months)' };
  if (days <= 180) return { raw: 55, detail: 'Moderate age (3-6 months)' };
  if (days <= 365) return { raw: 35, detail: 'Aging case (6-12 months)' };
  return { raw: 15, detail: `Old case (${Math.round(days / 30)} months)` };
}

function determineConfidence(input: ScoringInput): 'High' | 'Medium' | 'Low' {
  let dataPoints = 0;
  if (input.paymentCount > 0) dataPoints++;
  if (input.daysSinceLastContact < 60) dataPoints++;
  if (input.contactStatus === 'Contact') dataPoints++;
  if (input.hasPhone || input.hasEmail) dataPoints++;
  if (input.promiseToPayCount > 0) dataPoints++;
  if (input.originalAmount > 0) dataPoints++;

  if (dataPoints >= 5) return 'High';
  if (dataPoints >= 3) return 'Medium';
  return 'Low';
}

function getRiskLevel(score: number): 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low' {
  if (score >= 80) return 'Very Low';
  if (score >= 60) return 'Low';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'High';
  return 'Very High';
}

function getRecommendation(score: number, input: ScoringInput): string {
  if (score >= 80) {
    return 'High recovery likelihood. Prioritize settlement negotiation to close quickly.';
  }
  if (score >= 60) {
    if (input.crmStatus === 'PTP') {
      return 'Active PTP case. Follow up consistently on promised dates to secure payment.';
    }
    return 'Good recovery potential. Maintain regular contact and push for payment plan.';
  }
  if (score >= 40) {
    if (input.contactStatus === 'Non Contact') {
      return 'Medium potential but not contactable. Intensify tracing efforts and try alternative channels.';
    }
    return 'Moderate recovery chance. Consider offering settlement discount to incentivize payment.';
  }
  if (score >= 20) {
    if (!input.isInUAE) {
      return 'Low recovery potential — debtor outside UAE. Consider legal assessment for cross-border recovery.';
    }
    return 'Low recovery likelihood. Escalate to senior officer or consider legal action.';
  }
  return 'Very low recovery probability. Review for potential write-off or withdrawal.';
}

function predictRecoveryTimeline(score: number, input: ScoringInput): number | null {
  if (score < 15) return null; // Too unlikely to predict

  if (input.crmStatus === 'PTP' && input.promiseToPayCount > 0) {
    return 30; // PTP cases typically resolve within a month
  }

  // Higher score = faster recovery
  if (score >= 80) return 30;
  if (score >= 60) return 90;
  if (score >= 40) return 180;
  if (score >= 20) return 365;
  return null;
}
