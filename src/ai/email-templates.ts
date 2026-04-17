/**
 * RecoVantage — Professional Email Templates for Liability & Recovery
 * Standardized across all banks. No bank draft/cheque references.
 * Focus: outstanding liabilities, payment commitments, resolution.
 */

import { EnrichedCase } from '../../types';
import { formatCurrency } from '../../utils';

export interface EmailTemplate {
    id: string;
    name: string;
    stage: 'initial' | 'reminder' | 'escalation' | 'settlement' | 'final' | 'acknowledgment' | 'noc';
    subject: string;
    body: string;
    tone: 'professional' | 'firm' | 'urgent' | 'empathetic' | 'legal';
    sendAfterDays: number;  // Days after allocation to auto-suggest
    description: string;
}

function getDate(): string {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function generateEmail(templateId: string, c: EnrichedCase, agentName: string, agentPhone: string, companyName: string = 'RecoVantage Private Limited'): { subject: string; body: string } {
    const name = c.debtor.name;
    const balance = formatCurrency(c.loan.currentBalance, c.loan.currency);
    const currency = c.loan.currency;
    const bank = c.loan.bank;
    const product = c.loan.product;
    const accountNo = c.loan.accountNumber;
    const date = getDate();
    const dpd = c.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;
    const refNo = `RV/${bank.replace(/\s/g, '')}/${accountNo.slice(-6)}/${new Date().getFullYear()}`;

    const templates: Record<string, { subject: string; body: string }> = {

        // ═══════════════════════════════════════
        // STAGE 1: INITIAL CONTACT (Day 1-7)
        // ═══════════════════════════════════════
        'initial-contact': {
            subject: `Important: Outstanding Liability on Your ${product} Account — Ref: ${refNo}`,
            body: `Date: ${date}
Reference: ${refNo}

Dear ${name},

RE: OUTSTANDING LIABILITY — ACCOUNT NO. ${accountNo}

We are writing to you on behalf of ${bank} regarding an outstanding liability on your ${product} account.

As per our records, the following amount remains unpaid:

    Account Number  : ${accountNo}
    Product         : ${product}
    Outstanding     : ${balance}
    Days Overdue    : ${dpd} days

We understand that circumstances may vary, and we are committed to working with you to find a suitable resolution. We kindly request you to contact us at your earliest convenience to discuss available payment options.

Payment can be made directly to ${bank} using your account reference number quoted above. Upon receipt of payment, your account will be updated accordingly.

Should you have already made a payment, please disregard this notice and share the payment confirmation with us for our records.

For any queries or to discuss payment arrangements, please contact:

    ${agentName}
    ${companyName}
    Phone: ${agentPhone}
    Reference: ${refNo}

We appreciate your prompt attention to this matter.

Yours sincerely,
${agentName}
Recovery Department
${companyName}
Authorized Representative of ${bank}`
        },

        // ═══════════════════════════════════════
        // STAGE 2: FIRST REMINDER (Day 15-21)
        // ═══════════════════════════════════════
        'first-reminder': {
            subject: `Reminder: Overdue Payment Required — Account ${accountNo} — Ref: ${refNo}`,
            body: `Date: ${date}
Reference: ${refNo}

Dear ${name},

RE: FIRST REMINDER — OVERDUE LIABILITY

Further to our previous communication, we note that the outstanding amount on your ${product} account with ${bank} remains unpaid.

    Account Number  : ${accountNo}
    Outstanding     : ${balance}
    Days Overdue    : ${dpd} days
    Status          : OVERDUE — Immediate Attention Required

We strongly recommend that you contact us within the next 7 business days to arrange payment or discuss a feasible repayment plan. Continued non-payment may result in:

    • Adverse reporting to the Credit Bureau (Al Etihad Credit Bureau / SIMAH)
    • Additional collection charges being applied to your account
    • Escalation of recovery proceedings

We remain open to discussing flexible payment solutions tailored to your financial circumstances. Your cooperation in resolving this matter amicably is highly encouraged.

To arrange payment or discuss your options:

    Contact : ${agentName}
    Phone   : ${agentPhone}
    Ref     : ${refNo}

Please treat this matter as urgent.

Yours sincerely,
${agentName}
Recovery Department
${companyName}`
        },

        // ═══════════════════════════════════════
        // STAGE 3: SECOND REMINDER (Day 30-45)
        // ═══════════════════════════════════════
        'second-reminder': {
            subject: `URGENT: Unresolved Liability — Immediate Action Required — ${refNo}`,
            body: `Date: ${date}
Reference: ${refNo}

Dear ${name},

RE: SECOND REMINDER — UNRESOLVED LIABILITY ON ACCOUNT ${accountNo}

Despite our previous communications dated [First Contact Date] and [First Reminder Date], we regret to note that no payment or response has been received regarding your outstanding liability with ${bank}.

    Account Number      : ${accountNo}
    Product             : ${product}
    Total Outstanding   : ${balance}
    Days Overdue        : ${dpd} days
    Current Status      : DELINQUENT

Please be advised that continued non-engagement may lead to the following actions:

    1. Formal report to Al Etihad Credit Bureau (AECB) / SIMAH, which will adversely impact your credit rating across all financial institutions
    2. Initiation of legal recovery proceedings as per applicable UAE / GCC regulations
    3. Additional legal and administrative costs being added to your outstanding balance

We urge you to treat this communication with the highest priority. Our team is authorized to discuss settlement options, installment plans, and other resolution mechanisms that may be available to you.

This is your opportunity to resolve this matter before formal proceedings commence.

    Contact : ${agentName}
    Phone   : ${agentPhone}
    Email   : recovery@recovantage.com
    Ref     : ${refNo}

We await your response within 5 business days of the date of this communication.

Yours sincerely,
${agentName}
Senior Recovery Officer
${companyName}
On behalf of ${bank}`
        },

        // ═══════════════════════════════════════
        // STAGE 4: SETTLEMENT OFFER
        // ═══════════════════════════════════════
        'settlement-offer': {
            subject: `Confidential: Settlement Opportunity for Account ${accountNo} — Ref: ${refNo}`,
            body: `Date: ${date}
Reference: ${refNo}

PRIVATE & CONFIDENTIAL

Dear ${name},

RE: ONE-TIME SETTLEMENT OPPORTUNITY — ACCOUNT ${accountNo}

We are writing to present a limited-time settlement opportunity to resolve the outstanding liability on your ${product} account with ${bank}.

Current Position:
    Account Number      : ${accountNo}
    Total Outstanding   : ${balance}
    Days Overdue        : ${dpd} days

Settlement Offer:
    Settlement Amount   : [SETTLEMENT AMOUNT]
    Discount Offered    : [DISCOUNT %]
    Validity            : This offer is valid for 15 calendar days from the date of this letter
    Payment Deadline    : [DEADLINE DATE]

Terms and Conditions:
    1. Payment must be made in full as a single transaction
    2. Payment to be made directly to ${bank} quoting reference ${refNo}
    3. Upon receipt and clearance of the settlement amount, the account will be marked as "Settled" and a No Objection Certificate (NOC) will be issued within 14 business days
    4. This offer is made without prejudice to the rights of ${bank}
    5. This settlement does not constitute an admission of any reduced liability

This offer represents a significant opportunity to resolve your outstanding obligation at a reduced amount. We strongly encourage you to take advantage of this within the validity period.

To accept this offer or discuss payment arrangements:

    Contact : ${agentName}
    Phone   : ${agentPhone}
    Ref     : ${refNo}

Please note that this offer will automatically expire if no response is received within the stated timeframe.

Yours sincerely,
${agentName}
Recovery Department
${companyName}
Authorized Settlement Representative`
        },

        // ═══════════════════════════════════════
        // STAGE 5: FINAL NOTICE / PRE-LEGAL
        // ═══════════════════════════════════════
        'final-notice': {
            subject: `FINAL NOTICE: Legal Proceedings May Commence — Account ${accountNo} — ${refNo}`,
            body: `Date: ${date}
Reference: ${refNo}

SENT VIA EMAIL AND REGISTERED POST

Dear ${name},

RE: FINAL NOTICE BEFORE LEGAL ACTION — ACCOUNT ${accountNo}

PLEASE READ THIS NOTICE CAREFULLY

We refer to our previous communications regarding the outstanding liability on your ${product} account with ${bank}, none of which have resulted in a satisfactory resolution.

    Account Number      : ${accountNo}
    Total Outstanding   : ${balance}
    Days Overdue        : ${dpd} days
    Previous Notices    : Initial Contact, First Reminder, Second Reminder

NOTICE IS HEREBY GIVEN that unless the full outstanding amount of ${balance}, or an agreed settlement sum, is received within 7 (seven) calendar days from the date of this notice, we shall have no alternative but to recommend that ${bank} proceed with the following:

    1. Filing of a civil claim for recovery of the outstanding amount plus legal costs, court fees, and accrued charges
    2. Reporting the default to all relevant credit bureaus
    3. Such other legal remedies as may be available under applicable law

The consequences of legal proceedings may include:
    • Court judgment and enforcement proceedings
    • Travel restrictions (where applicable under local jurisdiction)
    • Garnishment of wages or bank accounts as permitted by law
    • Additional legal costs being added to the outstanding amount

THIS IS YOUR FINAL OPPORTUNITY to resolve this matter without legal intervention. We remain willing to discuss reasonable payment arrangements.

    Contact : ${agentName}
    Phone   : ${agentPhone}
    Ref     : ${refNo}

This notice is issued without prejudice to any rights or remedies of ${bank}, all of which are expressly reserved.

Yours sincerely,
${agentName}
Head of Recovery Operations
${companyName}
Legal Recovery Division`
        },

        // ═══════════════════════════════════════
        // STAGE 6: PAYMENT ACKNOWLEDGMENT
        // ═══════════════════════════════════════
        'payment-acknowledgment': {
            subject: `Payment Received — Thank You — Account ${accountNo} — Ref: ${refNo}`,
            body: `Date: ${date}
Reference: ${refNo}

Dear ${name},

RE: ACKNOWLEDGMENT OF PAYMENT — ACCOUNT ${accountNo}

We are pleased to confirm receipt of your payment against the above-referenced account with ${bank}.

    Account Number      : ${accountNo}
    Payment Amount      : [PAYMENT AMOUNT]
    Payment Date        : [PAYMENT DATE]
    Remaining Balance   : [REMAINING BALANCE]

${c.loan.currentBalance <= 0 ? 'Your account has been fully settled. A No Objection Certificate (NOC) will be issued within 14 business days and sent to your registered address/email.' : 'Please note that a balance remains on your account. We kindly request you to continue making payments as agreed to clear the remaining liability.'}

Should you require a payment confirmation letter or have any queries regarding your account, please do not hesitate to contact us.

We thank you for your cooperation and commitment to resolving this matter.

Best regards,
${agentName}
Recovery Department
${companyName}`
        },

        // ═══════════════════════════════════════
        // STAGE 7: NOC (No Objection Certificate)
        // ═══════════════════════════════════════
        'noc': {
            subject: `No Objection Certificate Issued — Account ${accountNo} — Ref: ${refNo}`,
            body: `Date: ${date}
Reference: ${refNo}

NO OBJECTION CERTIFICATE

This is to certify that:

    Customer Name       : ${name}
    Account Number      : ${accountNo}
    Bank                : ${bank}
    Product             : ${product}

The above-named individual has fully satisfied all outstanding obligations on the referenced account. ${bank}, through its authorized representative ${companyName}, hereby confirms that:

    1. All dues pertaining to the above account have been cleared in full
    2. ${bank} has no further claims against the above-named individual in relation to this account
    3. Any adverse credit bureau reporting related to this account will be updated to reflect the settled status within 30 business days

This certificate is issued upon the specific request of the account holder for their records and any lawful purpose it may serve.

Issued by:
${companyName}
On behalf of ${bank}

Authorized Signatory: ____________________
Name: ${agentName}
Designation: Recovery Operations
Date: ${date}

Note: This certificate is valid only for the account referenced above and does not pertain to any other accounts or obligations the individual may have with ${bank} or any other financial institution.`
        },

        // ═══════════════════════════════════════
        // EMPATHETIC: For genuine hardship cases
        // ═══════════════════════════════════════
        'hardship-outreach': {
            subject: `We're Here to Help — Payment Assistance for Account ${accountNo}`,
            body: `Date: ${date}
Reference: ${refNo}

Dear ${name},

RE: PAYMENT ASSISTANCE OPTIONS — ACCOUNT ${accountNo}

We understand that managing financial obligations can sometimes be challenging, and we want you to know that we are here to help find a workable solution.

You have an outstanding balance of ${balance} on your ${product} account with ${bank}. We recognize that every individual's financial situation is unique, and we are committed to working with you to find an arrangement that is manageable.

Available options may include:

    • Extended installment plans with reduced monthly amounts
    • Temporary payment holidays or moratorium periods
    • Settlement arrangements at a reduced amount
    • Restructuring of the outstanding balance

Our priority is to help you resolve this matter in a way that works for your current situation. There is no obligation, and the conversation is completely confidential.

Please feel free to reach out to us:

    Contact : ${agentName}
    Phone   : ${agentPhone}
    Ref     : ${refNo}

We look forward to hearing from you and finding a path forward together.

Warm regards,
${agentName}
Customer Resolution Team
${companyName}`
        },
    };

    return templates[templateId] || templates['initial-contact'];
}

// All available templates metadata
export const EMAIL_TEMPLATES: EmailTemplate[] = [
    { id: 'initial-contact', name: 'Initial Contact', stage: 'initial', subject: '', body: '', tone: 'professional', sendAfterDays: 1, description: 'First outreach to debtor — professional, informative, non-threatening' },
    { id: 'first-reminder', name: 'First Reminder', stage: 'reminder', subject: '', body: '', tone: 'firm', sendAfterDays: 15, description: 'Second communication — mentions credit bureau and escalation' },
    { id: 'second-reminder', name: 'Second Reminder (Urgent)', stage: 'escalation', subject: '', body: '', tone: 'urgent', sendAfterDays: 30, description: 'Third communication — strong language, deadline, legal warning' },
    { id: 'settlement-offer', name: 'Settlement Offer', stage: 'settlement', subject: '', body: '', tone: 'professional', sendAfterDays: 45, description: 'Confidential settlement opportunity with time-limited discount' },
    { id: 'final-notice', name: 'Final Notice (Pre-Legal)', stage: 'final', subject: '', body: '', tone: 'legal', sendAfterDays: 60, description: 'Last chance before legal proceedings — formal legal language' },
    { id: 'payment-acknowledgment', name: 'Payment Acknowledgment', stage: 'acknowledgment', subject: '', body: '', tone: 'professional', sendAfterDays: 0, description: 'Confirms receipt of payment — positive, thankful tone' },
    { id: 'noc', name: 'No Objection Certificate', stage: 'noc', subject: '', body: '', tone: 'professional', sendAfterDays: 0, description: 'Official clearance certificate after full settlement' },
    { id: 'hardship-outreach', name: 'Hardship Assistance', stage: 'initial', subject: '', body: '', tone: 'empathetic', sendAfterDays: 0, description: 'Empathetic outreach for genuine financial hardship cases' },
];


// ═══════════════════════════════════════════════════════
// AI EMAIL ADVISOR — Suggests which template + timing
// ═══════════════════════════════════════════════════════

export interface EmailAdvice {
    recommendedTemplate: string;
    reasoning: string;
    timing: string;
    personalizationTips: string[];
    effectivenessScore: number; // 0-100 predicted open/response rate
}

export function suggestEmailStrategy(c: EnrichedCase): EmailAdvice {
    const dpd = c.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;
    const hasPayments = c.history.some(h => h.amountPaid);
    const isContactable = c.contactStatus === 'Contact';
    const attempts = c.history.length;

    let templateId = 'initial-contact';
    let reasoning = '';
    let timing = 'Send within 24 hours';
    let effectiveness = 40;
    const tips: string[] = [];

    if (attempts === 0) {
        templateId = 'initial-contact';
        reasoning = 'No previous communication — start with professional initial contact';
        effectiveness = 45;
        tips.push('Personalize the greeting with time of day');
        tips.push('Mention specific account details to show legitimacy');
    } else if (dpd < 30 && !hasPayments) {
        templateId = 'first-reminder';
        reasoning = `${dpd} DPD with no payment — escalate to first reminder`;
        timing = 'Send Monday-Wednesday morning for best response';
        effectiveness = 35;
        tips.push('Reference the initial contact date');
        tips.push('Emphasize credit bureau impact');
    } else if (dpd >= 30 && dpd < 60 && !hasPayments) {
        templateId = 'second-reminder';
        reasoning = `${dpd} DPD, no payment, multiple contacts — urgent escalation needed`;
        timing = 'Send immediately with read receipt';
        effectiveness = 25;
        tips.push('Use subject line with "URGENT" to increase open rate');
    } else if (dpd >= 60 && dpd < 120 && !hasPayments) {
        templateId = 'settlement-offer';
        reasoning = `${dpd} DPD — settlement offer has highest recovery probability at this stage`;
        timing = 'Send mid-week. Follow up 3 days later by phone.';
        effectiveness = 55;
        tips.push('Time-limit the offer (15 days) to create urgency');
        tips.push('Settlement offers at 60-90 DPD have highest acceptance rates');
    } else if (dpd >= 120 && !hasPayments) {
        templateId = 'final-notice';
        reasoning = `${dpd} DPD — final notice before legal. Last chance for voluntary resolution.`;
        timing = 'Send with registered post for legal validity';
        effectiveness = 20;
        tips.push('Ensure email is also sent to any secondary email addresses');
    } else if (hasPayments && c.loan.currentBalance > 0) {
        templateId = 'first-reminder';
        reasoning = 'Has payment history but balance remains — gentle reminder for remaining amount';
        effectiveness = 50;
        tips.push('Acknowledge previous payment positively');
        tips.push('Frame remaining balance as "almost there"');
    } else if (c.loan.currentBalance <= 0) {
        templateId = 'payment-acknowledgment';
        reasoning = 'Account fully paid — send acknowledgment and NOC';
        effectiveness = 95;
    }

    // Hardship override
    if (isContactable && c.crmStatus === 'RTP' && attempts > 5) {
        templateId = 'hardship-outreach';
        reasoning = 'Debtor is contactable but refusing — try empathetic approach as alternative strategy';
        effectiveness = 30;
        tips.push('Empathy-based communication can break through refusal barriers');
    }

    // General tips
    tips.push('Send between 9-11 AM or 5-7 PM for highest open rates');
    tips.push('Include specific account number in subject line for credibility');
    tips.push('Keep paragraphs short — mobile reading is common in GCC');

    return { recommendedTemplate: templateId, reasoning, timing, personalizationTips: tips, effectivenessScore: effectiveness };
}


// ═══════════════════════════════════════════════════════
// BEST PRACTICES — Recovery Email Effectiveness
// ═══════════════════════════════════════════════════════

export const EMAIL_BEST_PRACTICES = [
    { category: 'Subject Line', practices: [
        'Include account number or reference for immediate recognition',
        'Use action-oriented language: "Action Required", "Important Update"',
        'Avoid spam triggers: no ALL CAPS, no excessive punctuation',
        'Keep under 60 characters for mobile preview',
    ]},
    { category: 'Timing', practices: [
        'Send Sunday-Thursday (GCC work week)',
        'Best hours: 9-11 AM (office check) or 5-7 PM (post-work)',
        'Avoid sending during Ramadan evenings and Eid holidays',
        'Send settlement offers mid-week for highest acceptance',
        'Follow up by phone 48 hours after email',
    ]},
    { category: 'Tone & Language', practices: [
        'Match tone to debtor profile (cooperative → friendly, avoider → firm)',
        'Never use threatening or abusive language — CBUAE compliance requirement',
        'Use "we" language — "We can help resolve" not "You must pay"',
        'Acknowledge partial payments positively before asking for remainder',
        'For Arabic-speaking debtors, consider bilingual communication',
    ]},
    { category: 'Structure', practices: [
        'Lead with the key information (amount, account number)',
        'Keep emails under 300 words for standard notices',
        'Use clear formatting: bullet points, whitespace, bold key figures',
        'Always include: reference number, contact person, phone number',
        'End with a clear call-to-action and deadline',
    ]},
    { category: 'Follow-Up Strategy', practices: [
        'Email → 48hr → Phone call → 7 days → Second email → 3 days → SMS',
        'Track open rates — if 3 emails unopened, switch to SMS/WhatsApp',
        'Personalize each follow-up — reference previous communication',
        'Escalate tone gradually: Professional → Firm → Urgent → Legal',
        'Always offer a solution alongside the demand',
    ]},
    { category: 'Compliance', practices: [
        'Include company identification and authorization reference',
        'Respect debtor communication preferences (opt-out)',
        'Maintain records of all communications for audit trail',
        'Never disclose debtor information to third parties via email',
        'Follow CBUAE Consumer Protection Circular requirements',
    ]},
];
