/**
 * Behavioral AI Engine
 *
 * Detects debtor response patterns and officer performance patterns.
 */

export interface DebtorBehavior {
  patterns: Array<{ type: string; confidence: number; detail: string }>;
  preferredChannel: 'phone' | 'email' | 'sms' | 'visit' | 'unknown';
  responseRate: number;
  bestContactTime: string | null;
  riskCluster: 'serial_defaulter' | 'temporary_hardship' | 'intentional_avoidance' | 'cooperative' | 'unknown';
}

export function analyzeDebtorBehavior(actions: Array<{
  type: string;
  notes: string | null;
  createdAt: string;
  promisedAmount?: number | null;
  amountPaid?: number | null;
}>): DebtorBehavior {
  const patterns: DebtorBehavior['patterns'] = [];

  const calls = actions.filter(a => a.type === 'Soft Call');
  const emails = actions.filter(a => a.type === 'Email Notice');
  const payments = actions.filter(a => a.type === 'Payment Received');
  const ptps = actions.filter(a => a.promisedAmount != null && a.promisedAmount > 0);

  // Pattern: Responds to calls but ignores emails
  if (calls.length > 2 && emails.length > 2) {
    const callResponses = calls.filter(c => c.notes && !c.notes.toLowerCase().includes('no answer')).length;
    const emailResponses = emails.filter(e => e.notes && e.notes.toLowerCase().includes('reply')).length;
    if (callResponses > emailResponses * 2) {
      patterns.push({ type: 'phone_responsive', confidence: 80, detail: 'Responds to calls but rarely to emails' });
    } else if (emailResponses > callResponses * 2) {
      patterns.push({ type: 'email_responsive', confidence: 80, detail: 'Prefers email communication over calls' });
    }
  }

  // Pattern: Broken promises
  if (ptps.length >= 2 && payments.length === 0) {
    patterns.push({ type: 'broken_promises', confidence: 90, detail: `${ptps.length} PTPs made but no payments received` });
  }

  // Pattern: Partial payer
  if (payments.length > 0 && payments.some(p => Number(p.amountPaid || 0) < Number(p.promisedAmount || 999999))) {
    patterns.push({ type: 'partial_payer', confidence: 70, detail: 'Tends to pay less than promised amounts' });
  }

  // Pattern: Weekend/evening responder
  const responseTimes = actions.filter(a => a.notes && !a.notes.includes('no answer')).map(a => new Date(a.createdAt).getHours());
  const eveningResponses = responseTimes.filter(h => h >= 17).length;
  if (eveningResponses > responseTimes.length * 0.5 && responseTimes.length > 3) {
    patterns.push({ type: 'evening_responder', confidence: 65, detail: 'Most responsive in evening hours (after 5 PM)' });
  }

  // Determine preferred channel
  let preferredChannel: DebtorBehavior['preferredChannel'] = 'unknown';
  if (calls.length > emails.length * 2) preferredChannel = 'phone';
  else if (emails.length > calls.length * 2) preferredChannel = 'email';

  // Response rate
  const totalAttempts = calls.length + emails.length;
  const responses = actions.filter(a => a.notes && !a.notes.toLowerCase().includes('no answer') && !a.notes.toLowerCase().includes('rnr')).length;
  const responseRate = totalAttempts > 0 ? Math.round((responses / totalAttempts) * 100) : 0;

  // Best contact time
  const bestContactTime = responseTimes.length > 0
    ? `${Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)}:00`
    : null;

  // Risk cluster
  let riskCluster: DebtorBehavior['riskCluster'] = 'unknown';
  if (payments.length > 0 && ptps.length > 0) riskCluster = 'cooperative';
  else if (ptps.length > 2 && payments.length === 0) riskCluster = 'intentional_avoidance';
  else if (totalAttempts > 5 && responses === 0) riskCluster = 'intentional_avoidance';
  else if (actions.some(a => a.notes?.toLowerCase().includes('financial'))) riskCluster = 'temporary_hardship';

  return { patterns, preferredChannel, responseRate, bestContactTime, riskCluster };
}

export interface OfficerPerformanceInsight {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  workloadScore: number;       // 0-100
  efficiencyScore: number;     // 0-100
  collectionScore: number;     // 0-100
}

export function analyzeOfficerPerformance(data: {
  caseCount: number;
  totalCollected: number;
  target: number;
  ptpConversionRate: number;
  avgResponseTime: number;     // hours
  tasksCompletionRate: number;
}): OfficerPerformanceInsight {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  const targetPct = data.target > 0 ? (data.totalCollected / data.target) * 100 : 0;

  if (targetPct >= 80) strengths.push('On track to meet monthly target');
  else if (targetPct < 40) {
    weaknesses.push('Significantly below collection target');
    suggestions.push('Focus on high-scoring PTP cases for quick wins');
  }

  if (data.ptpConversionRate >= 50) strengths.push('Strong PTP-to-payment conversion');
  else if (data.ptpConversionRate < 20) {
    weaknesses.push('Low PTP conversion rate');
    suggestions.push('Training recommended on negotiation techniques');
  }

  if (data.avgResponseTime <= 4) strengths.push('Fast response time to debtor contacts');
  else if (data.avgResponseTime > 24) {
    weaknesses.push('Slow response to debtor inquiries');
    suggestions.push('Prioritize responding to debtors within same day');
  }

  if (data.tasksCompletionRate >= 80) strengths.push('Excellent task discipline');
  else if (data.tasksCompletionRate < 50) {
    weaknesses.push('Many assigned tasks left incomplete');
    suggestions.push('Review daily task list each morning');
  }

  if (data.caseCount > 120) {
    suggestions.push('Workload is heavy — consider redistributing cases');
  }

  const workloadScore = Math.max(0, Math.min(100, 100 - (data.caseCount / 1.5)));
  const efficiencyScore = Math.round((data.tasksCompletionRate + data.ptpConversionRate) / 2);
  const collectionScore = Math.min(100, Math.round(targetPct));

  return { strengths, weaknesses, suggestions, workloadScore, efficiencyScore, collectionScore };
}
