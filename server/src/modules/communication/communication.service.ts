import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';

/**
 * Communication Integration Service
 *
 * Handles outbound communications to debtors:
 * - Email (with templates)
 * - SMS (via API stub — connect to Twilio/MessageBird)
 * - WhatsApp (via API stub — connect to WhatsApp Business API)
 * - Click-to-call logging
 *
 * In production, replace stubs with actual API integrations.
 */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'demand' | 'reminder' | 'settlement_offer' | 'payment_confirmation' | 'follow_up' | 'legal_warning';
}

export interface CommunicationLog {
  caseId: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'call';
  recipient: string;
  content: string;
  status: 'sent' | 'delivered' | 'failed' | 'read';
  sentAt: string;
  sentBy: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'demand-1',
    name: 'Initial Demand Letter',
    subject: 'Important: Outstanding Payment - Account {{accountNumber}}',
    body: `Dear {{debtorName}},

This letter serves as a formal reminder regarding your outstanding balance of {{currency}} {{balance}} on account {{accountNumber}} with {{bank}}.

We kindly request you to settle this amount at your earliest convenience. Please contact us at your earliest convenience to discuss payment options.

If payment has already been made, please disregard this notice.

Regards,
{{officerName}}
APFD Collections`,
    type: 'demand',
  },
  {
    id: 'reminder-1',
    name: 'Payment Reminder',
    subject: 'Reminder: Payment Due - {{accountNumber}}',
    body: `Dear {{debtorName}},

This is a friendly reminder that your payment of {{currency}} {{balance}} is overdue. Please make arrangements to settle this amount promptly.

Contact us: {{officerPhone}}

Regards,
{{officerName}}`,
    type: 'reminder',
  },
  {
    id: 'settlement-1',
    name: 'Settlement Offer',
    subject: 'Special Settlement Offer - Account {{accountNumber}}',
    body: `Dear {{debtorName}},

We are pleased to offer you a settlement opportunity for your outstanding balance on account {{accountNumber}}.

Original Balance: {{currency}} {{originalAmount}}
Settlement Offer: {{currency}} {{settlementAmount}}
Discount: {{discountPct}}%

This offer is valid until {{expiryDate}}.

Please contact {{officerName}} at {{officerPhone}} to proceed.

Regards,
APFD Collections`,
    type: 'settlement_offer',
  },
  {
    id: 'ptp-reminder-1',
    name: 'PTP Reminder',
    subject: 'Payment Promise Reminder - {{accountNumber}}',
    body: `Dear {{debtorName}},

This is a reminder that you committed to making a payment of {{currency}} {{promisedAmount}} on {{promisedDate}} for account {{accountNumber}}.

Please ensure the payment is processed on the agreed date.

Regards,
{{officerName}}`,
    type: 'follow_up',
  },
  {
    id: 'legal-warning-1',
    name: 'Legal Warning',
    subject: 'URGENT: Legal Action Notice - {{accountNumber}}',
    body: `Dear {{debtorName}},

Despite multiple attempts to contact you regarding your outstanding balance of {{currency}} {{balance}} on account {{accountNumber}}, we have not received a response.

Please be advised that if no payment or arrangement is made within 7 days, we will be compelled to initiate legal proceedings.

Contact {{officerName}} immediately at {{officerPhone}}.

Regards,
APFD Legal Department`,
    type: 'legal_warning',
  },
];

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  getTemplates(): EmailTemplate[] {
    return EMAIL_TEMPLATES;
  }

  getTemplateById(id: string): EmailTemplate | undefined {
    return EMAIL_TEMPLATES.find(t => t.id === id);
  }

  renderTemplate(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string } {
    let subject = template.subject;
    let body = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(pattern, value);
      body = body.replace(pattern, value);
    }

    return { subject, body };
  }

  /**
   * Send email (stub — connect to SendGrid/SES in production)
   */
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    caseId: string,
    userId: string,
  ): Promise<{ success: boolean; messageId: string }> {
    // STUB: In production, integrate with SendGrid, AWS SES, etc.
    this.logger.log(`EMAIL → ${to} | Subject: ${subject}`);

    await this.auditRepo.save(this.auditRepo.create({
      userId,
      caseId,
      details: `Email sent to ${to}: "${subject}"`,
    }));

    return { success: true, messageId: `email-${Date.now()}` };
  }

  /**
   * Send SMS (stub — connect to Twilio/MessageBird)
   */
  async sendSms(
    to: string,
    message: string,
    caseId: string,
    userId: string,
  ): Promise<{ success: boolean; messageId: string }> {
    this.logger.log(`SMS → ${to} | Message: ${message.slice(0, 50)}...`);

    await this.auditRepo.save(this.auditRepo.create({
      userId,
      caseId,
      details: `SMS sent to ${to}: "${message.slice(0, 80)}..."`,
    }));

    return { success: true, messageId: `sms-${Date.now()}` };
  }

  /**
   * Send WhatsApp message (stub — connect to WhatsApp Business API)
   */
  async sendWhatsApp(
    to: string,
    message: string,
    caseId: string,
    userId: string,
  ): Promise<{ success: boolean; messageId: string }> {
    this.logger.log(`WHATSAPP → ${to} | Message: ${message.slice(0, 50)}...`);

    await this.auditRepo.save(this.auditRepo.create({
      userId,
      caseId,
      details: `WhatsApp sent to ${to}: "${message.slice(0, 80)}..."`,
    }));

    return { success: true, messageId: `wa-${Date.now()}` };
  }

  /**
   * Generate payment link for quick settlements
   * In production, integrate with Stripe/PayPal/local payment gateway
   */
  generatePaymentLink(data: {
    caseId: string;
    debtorName: string;
    accountNumber: string;
    amount: number;
    currency: string;
    expiryDays?: number;
  }): {
    paymentUrl: string;
    expiresAt: string;
    reference: string;
    qrData: string;
  } {
    const reference = `PAY-${data.caseId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expiryDays || 7));

    // STUB: In production, this creates a real payment gateway link
    const paymentUrl = `https://pay.apfd-collections.com/settle/${reference}?amount=${data.amount}&currency=${data.currency}`;

    return {
      paymentUrl,
      expiresAt: expiresAt.toISOString(),
      reference,
      qrData: JSON.stringify({ ref: reference, amount: data.amount, currency: data.currency, to: 'APFD Collections' }),
    };
  }

  /**
   * Log a click-to-call event
   */
  async logCall(
    phoneNumber: string,
    caseId: string,
    userId: string,
    duration?: number,
    outcome?: string,
  ): Promise<void> {
    await this.auditRepo.save(this.auditRepo.create({
      userId,
      caseId,
      details: `Call to ${phoneNumber}${duration ? ` (${duration}s)` : ''}${outcome ? ` — ${outcome}` : ''}`,
    }));
  }

  /**
   * AI: Generate formal note from officer's short input
   */
  generateFormalNote(shortNote: string, context: {
    debtorName: string;
    crmStatus: string;
    balance: number;
    currency: string;
  }): string {
    const note = shortNote.toLowerCase().trim();

    if (note.includes('no answer') || note.includes('rnr')) {
      return `Attempted to reach ${context.debtorName} via phone. Call was not answered (RNR). Current outstanding: ${context.currency} ${context.balance.toLocaleString()}. Case status: ${context.crmStatus}. Will attempt follow-up within 24 hours.`;
    }

    if (note.includes('promise') || note.includes('ptp')) {
      return `Spoke with ${context.debtorName}. Debtor has committed to making a payment. Promise to pay recorded. Outstanding balance: ${context.currency} ${context.balance.toLocaleString()}.`;
    }

    if (note.includes('settlement') || note.includes('negotiate')) {
      return `Engaged in settlement discussion with ${context.debtorName}. Debtor expressed interest in resolving the outstanding amount of ${context.currency} ${context.balance.toLocaleString()}. Negotiation is ongoing.`;
    }

    if (note.includes('refuse') || note.includes('not interested')) {
      return `Contacted ${context.debtorName}. Debtor has refused to engage in payment discussions. Outstanding: ${context.currency} ${context.balance.toLocaleString()}. Case may require escalation.`;
    }

    if (note.includes('paid') || note.includes('payment')) {
      return `Payment confirmation received from ${context.debtorName}. Transaction details to be verified. Previous outstanding: ${context.currency} ${context.balance.toLocaleString()}.`;
    }

    // Default: wrap the short note in formal context
    return `Communication with ${context.debtorName} regarding account (${context.crmStatus}). Outstanding: ${context.currency} ${context.balance.toLocaleString()}. Notes: ${shortNote}`;
  }

  /**
   * AI: Suggest best contact strategy
   */
  suggestContactStrategy(data: {
    hasPhone: boolean;
    hasEmail: boolean;
    lastCallOutcome: string | null;
    contactHistory: Array<{ type: string; successful: boolean }>;
    crmStatus: string;
    timeOfDay: number;
  }): {
    channel: string;
    reason: string;
    bestTime: string;
    template?: string;
  } {
    const { hasPhone, hasEmail, lastCallOutcome, contactHistory, crmStatus, timeOfDay } = data;

    const callSuccess = contactHistory.filter(c => c.type === 'call' && c.successful).length;
    const emailSuccess = contactHistory.filter(c => c.type === 'email' && c.successful).length;
    const totalCalls = contactHistory.filter(c => c.type === 'call').length;

    // If calls fail repeatedly, switch to SMS/Email
    if (totalCalls >= 3 && callSuccess === 0) {
      if (hasEmail) return { channel: 'email', reason: 'Multiple failed call attempts', bestTime: '9:00-11:00 AM', template: 'reminder-1' };
      return { channel: 'sms', reason: 'No answer on calls, no email', bestTime: 'Any time', template: undefined };
    }

    // PTP cases: call reminder is best
    if (crmStatus === 'PTP' && hasPhone) {
      return { channel: 'call', reason: 'PTP case — personal follow-up most effective', bestTime: '6:00-8:00 PM', template: undefined };
    }

    // High urgency: WhatsApp for quick response
    if (['NITP', 'NCC'].includes(crmStatus)) {
      return { channel: 'whatsapp', reason: 'Low engagement status — try instant messaging', bestTime: '10:00 AM-12:00 PM', template: undefined };
    }

    // Default: call during evening hours
    if (hasPhone) {
      return { channel: 'call', reason: 'Standard contact attempt', bestTime: timeOfDay < 12 ? '6:00-8:00 PM today' : '10:00-12:00 AM tomorrow', template: undefined };
    }

    if (hasEmail) {
      return { channel: 'email', reason: 'Phone not available', bestTime: '9:00 AM', template: 'demand-1' };
    }

    return { channel: 'sms', reason: 'Limited contact info', bestTime: 'Any time', template: undefined };
  }
}
