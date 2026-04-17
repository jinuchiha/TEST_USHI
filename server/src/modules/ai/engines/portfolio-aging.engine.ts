/**
 * Portfolio Aging Analysis Engine
 *
 * Buckets cases by overdue days and calculates recovery probability per bucket.
 * Also provides DOB-based behavioral insights and write-off urgency scoring.
 */

export interface AgingBucket {
  label: string;
  range: string;
  caseCount: number;
  totalBalance: number;
  avgRecoveryScore: number;
  recoveryProbability: number;
  recommendation: string;
}

export interface DobInsight {
  ageGroup: string;
  range: string;
  caseCount: number;
  avgRecoveryScore: number;
  preferredChannel: string;
  paymentBehavior: string;
  recommendation: string;
}

export interface WriteOffAlert {
  caseId: string;
  debtorName: string;
  daysUntilWriteOff: number;
  balance: number;
  urgency: 'critical' | 'high' | 'medium';
  recommendation: string;
}

export function buildAgingBuckets(cases: Array<{
  id: string;
  daysOverdue: number;
  balance: number;
  recoveryScore: number;
}>): AgingBucket[] {
  const buckets = [
    { label: '0-30 Days', min: 0, max: 30 },
    { label: '31-60 Days', min: 31, max: 60 },
    { label: '61-90 Days', min: 61, max: 90 },
    { label: '91-180 Days', min: 91, max: 180 },
    { label: '180+ Days', min: 181, max: 99999 },
  ];

  return buckets.map(b => {
    const bucketCases = cases.filter(c => c.daysOverdue >= b.min && c.daysOverdue <= b.max);
    const totalBalance = bucketCases.reduce((s, c) => s + c.balance, 0);
    const avgScore = bucketCases.length > 0
      ? Math.round(bucketCases.reduce((s, c) => s + c.recoveryScore, 0) / bucketCases.length)
      : 0;

    // Recovery probability decays with aging
    const recoveryProbability = b.min === 0 ? 65 : b.min <= 60 ? 45 : b.min <= 90 ? 30 : b.min <= 180 ? 18 : 8;

    let recommendation = '';
    if (b.min === 0) recommendation = 'Focus: Quick resolution through active negotiation';
    else if (b.min <= 60) recommendation = 'Priority: Settlement offers and payment plans';
    else if (b.min <= 90) recommendation = 'Escalate: Consider legal notices';
    else if (b.min <= 180) recommendation = 'Legal: Initiate formal proceedings';
    else recommendation = 'Review: Assess for write-off or final legal push';

    return {
      label: b.label,
      range: `${b.min}-${b.max === 99999 ? '∞' : b.max}`,
      caseCount: bucketCases.length,
      totalBalance: Math.round(totalBalance),
      avgRecoveryScore: avgScore,
      recoveryProbability,
      recommendation,
    };
  });
}

export function analyzeDobInsights(cases: Array<{
  dob: string | null;
  recoveryScore: number;
  contactChannel: string;
  paymentCount: number;
}>): DobInsight[] {
  const groups = [
    { label: '18-25', min: 18, max: 25 },
    { label: '26-35', min: 26, max: 35 },
    { label: '36-45', min: 36, max: 45 },
    { label: '46-55', min: 46, max: 55 },
    { label: '56+', min: 56, max: 120 },
  ];

  const now = new Date();

  return groups.map(g => {
    const groupCases = cases.filter(c => {
      if (!c.dob) return false;
      const age = Math.floor((now.getTime() - new Date(c.dob).getTime()) / (365.25 * 86400000));
      return age >= g.min && age <= g.max;
    });

    const avgScore = groupCases.length > 0
      ? Math.round(groupCases.reduce((s, c) => s + c.recoveryScore, 0) / groupCases.length)
      : 0;

    const hasPaid = groupCases.filter(c => c.paymentCount > 0).length;

    const channelPrefs: Record<string, { channel: string; behavior: string; reco: string }> = {
      '18-25': { channel: 'WhatsApp / SMS', behavior: 'Higher digital payment response, impulsive decisions', reco: 'Use WhatsApp with payment links for quick settlement' },
      '26-35': { channel: 'Phone + WhatsApp', behavior: 'Negotiation-oriented, prefers flexible payment plans', reco: 'Offer installment plans via phone, follow up on WhatsApp' },
      '36-45': { channel: 'Phone call', behavior: 'Responds to formal communication, values privacy', reco: 'Professional phone calls during business hours' },
      '46-55': { channel: 'Phone + Email', behavior: 'Prefers call-based negotiation, slower decision making', reco: 'Patient approach with formal email follow-ups' },
      '56+': { channel: 'Phone call', behavior: 'Traditional communication preference, values relationships', reco: 'Respectful phone approach, consider family involvement' },
    };

    const pref = channelPrefs[g.label] || channelPrefs['36-45'];

    return {
      ageGroup: g.label,
      range: `${g.min}-${g.max === 120 ? '+' : g.max}`,
      caseCount: groupCases.length,
      avgRecoveryScore: avgScore,
      preferredChannel: pref.channel,
      paymentBehavior: pref.behavior,
      recommendation: pref.reco,
    };
  }).filter(g => g.caseCount > 0);
}

export function getWriteOffAlerts(cases: Array<{
  caseId: string;
  debtorName: string;
  daysUntilWriteOff: number | null;
  balance: number;
  recoveryScore: number;
}>): WriteOffAlert[] {
  return cases
    .filter(c => c.daysUntilWriteOff !== null && c.daysUntilWriteOff <= 90)
    .map(c => {
      const days = c.daysUntilWriteOff!;
      const urgency: WriteOffAlert['urgency'] = days <= 14 ? 'critical' : days <= 30 ? 'high' : 'medium';

      let recommendation = '';
      if (days <= 7) recommendation = 'URGENT: Final settlement attempt or immediate legal escalation required';
      else if (days <= 14) recommendation = 'Send final legal notice and attempt settlement at reduced rate';
      else if (days <= 30) recommendation = 'Escalate to legal team, prepare documentation for court filing';
      else recommendation = 'Increase contact frequency and offer settlement options';

      return { caseId: c.caseId, debtorName: c.debtorName, daysUntilWriteOff: days, balance: c.balance, urgency, recommendation };
    })
    .sort((a, b) => a.daysUntilWriteOff - b.daysUntilWriteOff);
}
