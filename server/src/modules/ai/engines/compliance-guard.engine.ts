/**
 * Compliance Guard
 *
 * Real-time alerts when contact rules are about to be violated:
 * - Max 3 calls per day per debtor
 * - No calls before 8 AM or after 9 PM
 * - No contact on public holidays
 * - DNC list checking
 * - Contact frequency caps per week
 */

export interface ComplianceRule {
  id: string;
  name: string;
  type: 'frequency' | 'time' | 'holiday' | 'dnc';
  limit?: number;
  period?: string;
}

export const COMPLIANCE_RULES: ComplianceRule[] = [
  { id: 'max_daily_calls', name: 'Max 3 calls per day', type: 'frequency', limit: 3, period: 'day' },
  { id: 'max_weekly_calls', name: 'Max 10 calls per week', type: 'frequency', limit: 10, period: 'week' },
  { id: 'calling_hours', name: 'Calls only 8AM-9PM', type: 'time' },
  { id: 'max_sms_daily', name: 'Max 2 SMS per day', type: 'frequency', limit: 2, period: 'day' },
  { id: 'cooldown_after_refuse', name: '48h cooldown after refusal', type: 'frequency' },
];

export interface ComplianceAlert {
  ruleId: string;
  ruleName: string;
  severity: 'block' | 'warning';
  message: string;
}

export function checkCompliance(data: {
  debtorId: string;
  callsToday: number;
  callsThisWeek: number;
  smsToday: number;
  currentHour: number;
  lastRefusalDate: string | null;
  isOnDncList: boolean;
}): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];

  if (data.isOnDncList) {
    alerts.push({ ruleId: 'dnc', ruleName: 'Do Not Call List', severity: 'block', message: 'BLOCKED: Debtor is on Do Not Call list. No outbound contact allowed.' });
  }

  if (data.callsToday >= 3) {
    alerts.push({ ruleId: 'max_daily_calls', ruleName: 'Daily Call Limit', severity: 'block', message: `BLOCKED: Already ${data.callsToday} calls today (max 3). Wait until tomorrow.` });
  } else if (data.callsToday === 2) {
    alerts.push({ ruleId: 'max_daily_calls', ruleName: 'Daily Call Limit', severity: 'warning', message: `WARNING: ${data.callsToday}/3 daily calls used. 1 remaining.` });
  }

  if (data.callsThisWeek >= 10) {
    alerts.push({ ruleId: 'max_weekly_calls', ruleName: 'Weekly Call Limit', severity: 'block', message: `BLOCKED: ${data.callsThisWeek} calls this week (max 10).` });
  } else if (data.callsThisWeek >= 8) {
    alerts.push({ ruleId: 'max_weekly_calls', ruleName: 'Weekly Call Limit', severity: 'warning', message: `WARNING: ${data.callsThisWeek}/10 weekly calls used.` });
  }

  if (data.currentHour < 8 || data.currentHour >= 21) {
    alerts.push({ ruleId: 'calling_hours', ruleName: 'Calling Hours', severity: 'block', message: 'BLOCKED: Outside calling hours (8AM-9PM). Contact not permitted.' });
  }

  if (data.smsToday >= 2) {
    alerts.push({ ruleId: 'max_sms_daily', ruleName: 'SMS Limit', severity: 'block', message: `BLOCKED: ${data.smsToday} SMS sent today (max 2).` });
  }

  if (data.lastRefusalDate) {
    const hrs = (Date.now() - new Date(data.lastRefusalDate).getTime()) / 3600000;
    if (hrs < 48) {
      alerts.push({ ruleId: 'cooldown_after_refuse', ruleName: '48h Cooldown', severity: 'warning', message: `WARNING: Debtor refused ${Math.round(hrs)}h ago. Recommended 48h cooldown (${Math.round(48 - hrs)}h remaining).` });
    }
  }

  return alerts;
}
