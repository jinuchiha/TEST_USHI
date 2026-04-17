/**
 * Next-Best-Action Engine
 *
 * Given a case's current state, recommends the optimal next action:
 * - What to do (call, email, legal, settlement offer)
 * - When to do it (optimal time)
 * - What channel to use
 * - What to say (script/template)
 */

export interface NextBestAction {
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  channel: 'phone' | 'email' | 'sms' | 'whatsapp' | 'visit' | 'legal';
  timing: string;
  script: string;
  reasoning: string;
  expectedImpact: number; // 0-100, how likely this action improves recovery
}

export interface CaseContext {
  crmStatus: string;
  subStatus: string;
  contactStatus: string;
  daysSinceLastContact: number;
  paymentCount: number;
  ptpCount: number;
  brokenPtpCount: number;
  balance: number;
  hasPhone: boolean;
  hasEmail: boolean;
  isInUAE: boolean;
  caseAgeDays: number;
  lastActionType: string | null;
  recoveryScore: number;
}

export function getNextBestAction(ctx: CaseContext): NextBestAction {
  // Critical: PTP broken multiple times → escalate
  if (ctx.brokenPtpCount >= 2 && ctx.balance > 50000) {
    return {
      action: 'Escalate to Legal Assessment',
      priority: 'critical',
      channel: 'legal',
      timing: 'Immediately',
      script: 'This case has multiple broken payment promises. Recommend initiating legal proceedings or sending a formal legal warning.',
      reasoning: `${ctx.brokenPtpCount} broken PTPs with ${ctx.balance.toLocaleString()} AED outstanding — debtor appears uncooperative.`,
      expectedImpact: 65,
    };
  }

  // High: PTP case with upcoming promise date
  if (ctx.crmStatus === 'PTP') {
    return {
      action: 'Follow Up on Payment Promise',
      priority: 'high',
      channel: 'phone',
      timing: '6:00-8:00 PM today',
      script: `"Good evening [Name], I am calling regarding your account [Number]. You mentioned you would be making a payment. Could you confirm the payment has been processed?"`,
      reasoning: 'Active PTP — personal call follow-up has highest conversion rate for promised payments.',
      expectedImpact: 78,
    };
  }

  // High: No contact in 7+ days on active case
  if (ctx.daysSinceLastContact > 7 && ['CB', 'FIP', 'UNDER NEGO', 'WIP'].includes(ctx.crmStatus)) {
    const channel = ctx.hasPhone ? 'phone' : ctx.hasEmail ? 'email' : 'sms';
    return {
      action: 'Re-establish Contact',
      priority: 'high',
      channel,
      timing: ctx.hasPhone ? '10:00 AM or 6:00 PM' : '9:00 AM',
      script: ctx.hasPhone
        ? `"Hello [Name], this is [Officer] from APFD. I am calling regarding your account. We would like to discuss a payment arrangement that works for you."`
        : `Send reminder email using 'Payment Reminder' template with settlement option highlighted.`,
      reasoning: `${ctx.daysSinceLastContact} days without contact — case going stale. Immediate outreach needed.`,
      expectedImpact: 55,
    };
  }

  // Medium: Under negotiation — push for settlement
  if (ctx.crmStatus === 'UNDER NEGO') {
    return {
      action: 'Present Settlement Offer',
      priority: 'medium',
      channel: 'phone',
      timing: '2:00-4:00 PM',
      script: `"[Name], based on our discussion, we can offer a settlement of [X]% of the outstanding amount if paid within 30 days. This is a one-time opportunity to resolve this matter."`,
      reasoning: 'Case in negotiation phase — settlement offer can accelerate resolution.',
      expectedImpact: 62,
    };
  }

  // Medium: High value case with low contact
  if (ctx.balance > 100000 && ctx.contactStatus === 'Non Contact') {
    return {
      action: 'Intensive Tracing + Multi-channel Outreach',
      priority: 'medium',
      channel: 'whatsapp',
      timing: 'Any time',
      script: `Send WhatsApp: "Dear [Name], this is an urgent notice regarding your outstanding account. Please contact us at your earliest convenience to discuss resolution options."`,
      reasoning: `High-value case (${ctx.balance.toLocaleString()} AED) with no contact. WhatsApp has higher read rate than email.`,
      expectedImpact: 40,
    };
  }

  // Low: Dispute case → gather documentation
  if (ctx.crmStatus === 'Dispute') {
    return {
      action: 'Request Documentation from Bank',
      priority: 'low',
      channel: 'email',
      timing: '9:00 AM',
      script: 'Request original loan agreement and statement of account from the bank to address debtor\'s dispute points.',
      reasoning: 'Disputed cases need documentation before further collection attempts.',
      expectedImpact: 30,
    };
  }

  // Default: Standard follow-up
  return {
    action: 'Standard Follow-up Call',
    priority: 'medium',
    channel: ctx.hasPhone ? 'phone' : 'email',
    timing: '10:00 AM - 12:00 PM',
    script: `"Hello [Name], I am following up on your account [Number]. We have flexible payment options available. Would you like to discuss?"`,
    reasoning: 'Routine follow-up to maintain engagement.',
    expectedImpact: 35,
  };
}
