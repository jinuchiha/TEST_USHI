/**
 * Smart Case Queue Engine
 *
 * AI auto-prioritizes an officer's case list based on:
 * - Recovery probability (high score = high priority)
 * - PTP due dates (urgent follow-ups first)
 * - Case value (high balance = more important)
 * - Stale cases (need attention before going cold)
 * - Recent activity (momentum cases)
 */

export interface QueuedCase {
  caseId: string;
  debtorName: string;
  balance: number;
  crmStatus: string;
  recoveryScore: number;
  queuePriority: number;      // 0-100 composite priority
  reason: string;
  suggestedAction: string;
  urgency: 'now' | 'today' | 'this_week' | 'when_possible';
}

export function buildSmartQueue(
  cases: Array<{
    id: string;
    debtorName: string;
    balance: number;
    crmStatus: string;
    daysSinceLastContact: number;
    hasPtpDueToday: boolean;
    ptpAmount: number;
    recoveryScore: number;
    paymentCount: number;
    caseAgeDays: number;
  }>
): QueuedCase[] {
  const queue: QueuedCase[] = cases.map(c => {
    let priority = 0;
    let reason = '';
    let suggestedAction = '';
    let urgency: QueuedCase['urgency'] = 'when_possible';

    // PTP due today → highest priority
    if (c.hasPtpDueToday) {
      priority += 40;
      reason = `PTP due today (${c.ptpAmount.toLocaleString()} AED)`;
      suggestedAction = 'Call to confirm payment';
      urgency = 'now';
    }

    // Recovery score contribution (max 25 points)
    priority += Math.round(c.recoveryScore * 0.25);
    if (c.recoveryScore >= 70 && !reason) {
      reason = `High recovery probability (${c.recoveryScore}%)`;
      suggestedAction = 'Push for payment/settlement';
      urgency = 'today';
    }

    // Balance contribution (max 15 points — scaled logarithmically)
    const balanceScore = Math.min(15, Math.round(Math.log10(Math.max(c.balance, 1)) * 3));
    priority += balanceScore;
    if (c.balance > 100000 && !reason) {
      reason = `High-value case (${c.balance.toLocaleString()} AED)`;
      suggestedAction = 'Priority outreach';
      urgency = 'today';
    }

    // Stale case bonus (3-7 days = attention needed, 7+ = urgent)
    if (c.daysSinceLastContact >= 7) {
      priority += 15;
      if (!reason) {
        reason = `No contact in ${c.daysSinceLastContact} days`;
        suggestedAction = 'Re-establish contact immediately';
        urgency = c.daysSinceLastContact > 14 ? 'now' : 'today';
      }
    } else if (c.daysSinceLastContact >= 3) {
      priority += 8;
    }

    // Active negotiation bonus
    if (['UNDER NEGO', 'FIP'].includes(c.crmStatus)) {
      priority += 10;
      if (!reason) {
        reason = 'Active negotiation — maintain momentum';
        suggestedAction = 'Follow up on negotiation';
        urgency = 'today';
      }
    }

    // Previous payment bonus (debtor has paid before = more likely again)
    if (c.paymentCount > 0) {
      priority += 8;
    }

    // Default reason
    if (!reason) {
      reason = `Standard case — score ${c.recoveryScore}%`;
      suggestedAction = 'Regular follow-up';
      urgency = 'this_week';
    }

    return {
      caseId: c.id,
      debtorName: c.debtorName,
      balance: c.balance,
      crmStatus: c.crmStatus,
      recoveryScore: c.recoveryScore,
      queuePriority: Math.min(100, priority),
      reason,
      suggestedAction,
      urgency,
    };
  });

  return queue.sort((a, b) => b.queuePriority - a.queuePriority);
}
