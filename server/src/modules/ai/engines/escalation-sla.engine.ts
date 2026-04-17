/**
 * Escalation Engine with SLA Timers
 *
 * Configurable multi-tier escalation:
 * Officer → Team Lead → Manager → Legal
 * With automatic triggers and SLA countdown timers.
 */

export interface SlaRule {
  name: string;
  condition: string;
  daysLimit: number;
  escalateTo: 'team_lead' | 'manager' | 'legal';
  priority: 'critical' | 'high' | 'medium';
}

export const DEFAULT_SLA_RULES: SlaRule[] = [
  { name: 'No Contact 7 Days', condition: 'no_contact_7d', daysLimit: 7, escalateTo: 'team_lead', priority: 'medium' },
  { name: 'No Contact 14 Days', condition: 'no_contact_14d', daysLimit: 14, escalateTo: 'manager', priority: 'high' },
  { name: 'Broken PTP', condition: 'broken_ptp', daysLimit: 3, escalateTo: 'manager', priority: 'high' },
  { name: 'High Value No Progress', condition: 'high_value_stale', daysLimit: 7, escalateTo: 'manager', priority: 'critical' },
  { name: '90+ Days Overdue', condition: 'overdue_90', daysLimit: 0, escalateTo: 'legal', priority: 'critical' },
];

export interface EscalationAlert {
  caseId: string;
  debtorName: string;
  rule: string;
  priority: 'critical' | 'high' | 'medium';
  daysRemaining: number;
  escalateTo: string;
  currentOfficer: string;
  balance: number;
}

export function checkEscalations(cases: Array<{
  id: string;
  debtorName: string;
  daysSinceLastContact: number;
  crmStatus: string;
  balance: number;
  brokenPtpCount: number;
  daysOverdue: number;
  officerName: string;
}>): EscalationAlert[] {
  const alerts: EscalationAlert[] = [];

  for (const c of cases) {
    for (const rule of DEFAULT_SLA_RULES) {
      let triggered = false;
      let daysRemaining = 0;

      switch (rule.condition) {
        case 'no_contact_7d':
          triggered = c.daysSinceLastContact >= 5 && c.daysSinceLastContact < 14;
          daysRemaining = Math.max(0, 7 - c.daysSinceLastContact);
          break;
        case 'no_contact_14d':
          triggered = c.daysSinceLastContact >= 14;
          daysRemaining = 0;
          break;
        case 'broken_ptp':
          triggered = c.brokenPtpCount >= 2;
          daysRemaining = 0;
          break;
        case 'high_value_stale':
          triggered = c.balance > 100000 && c.daysSinceLastContact > 5;
          daysRemaining = Math.max(0, 7 - c.daysSinceLastContact);
          break;
        case 'overdue_90':
          triggered = c.daysOverdue >= 90;
          daysRemaining = 0;
          break;
      }

      if (triggered) {
        alerts.push({
          caseId: c.id,
          debtorName: c.debtorName,
          rule: rule.name,
          priority: rule.priority,
          daysRemaining,
          escalateTo: rule.escalateTo,
          currentOfficer: c.officerName,
          balance: c.balance,
        });
      }
    }
  }

  return alerts.sort((a, b) => {
    const pri = { critical: 0, high: 1, medium: 2 };
    return pri[a.priority] - pri[b.priority] || a.daysRemaining - b.daysRemaining;
  });
}
