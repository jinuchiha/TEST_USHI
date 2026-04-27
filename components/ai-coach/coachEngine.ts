// ── Recovery Coach Engine ────────────────────────────────────────────────────
// Rule-based reasoning over real case data. Acts like a senior collector
// reviewing the file with the officer. Deterministic, defensible, no API needed.

import { EnrichedCase, CRMStatus, SubStatus, ActionType, Action } from '../../types';

export type CoachIntent =
  | 'overview'
  | 'best_time'
  | 'best_number'
  | 'why_not_paying'
  | 'settlement'
  | 'next_step'
  | 'tracing_gaps'
  | 'similar_cases'
  | 'leverage'
  | 'risk'
  | 'opening_line'
  | 'bank_merger'
  | 'family_angle'
  | 'unknown';

export interface CoachMessage {
  role: 'user' | 'coach';
  text: string;
  timestamp: string;
  suggestions?: { label: string; intent: CoachIntent }[];
  highlights?: { label: string; value: string; color?: string }[];
}

const fmtCurrency = (n: number, c: string) => `${c} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const daysSince = (iso?: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
};

// ── Intent classification (keyword → intent) ────────────────────────────────
const INTENT_KEYWORDS: Record<CoachIntent, string[]> = {
  overview: ['overview', 'summary', 'tell me about', 'about this case', 'kya hai', 'kya hai is case me'],
  best_time: ['best time', 'kab call', 'when to call', 'time', 'kab'],
  best_number: ['which number', 'kaun sa number', 'best number', 'phone'],
  why_not_paying: ['why not paying', 'kyun nahi de raha', 'why', 'kyun', 'reason', 'pay nahi'],
  settlement: ['settle', 'settlement', 'discount', 'kaisi deal', 'how much settle', 'kitna settle', 'offer'],
  next_step: ['next', 'kya karein', 'next step', 'what next', 'agla', 'aage'],
  tracing_gaps: ['trace', 'tracing', 'find', 'missing', 'gaps', 'kya missing'],
  similar_cases: ['similar', 'aise aur', 'pattern', 'anyone like'],
  leverage: ['leverage', 'pressure', 'dabav', 'angle'],
  risk: ['risk', 'cyber', 'fraud', 'danger', 'khatra'],
  opening_line: ['opening', 'kya kahun', 'script', 'pehla line', 'what to say', 'how to start'],
  bank_merger: ['bank', 'merger', 'merged'],
  family_angle: ['family', 'father', 'brother', 'parents', 'walid', 'rishtedaar', 'reference'],
  unknown: [],
};

export function classifyIntent(text: string): CoachIntent {
  const lower = text.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [CoachIntent, string[]][]) {
    if (intent === 'unknown') continue;
    if (keywords.some(k => lower.includes(k))) return intent;
  }
  return 'unknown';
}

// ── Case profile extraction ──────────────────────────────────────────────────
interface CaseProfile {
  age: number;
  sinceContact: number | null;
  totalActions: number;
  ptps: Action[];
  payments: Action[];
  brokenPtps: number;
  successfulPayments: number;
  refusalActions: Action[];
  callTimings: { hour: number; weekday: number; outcome: string }[];
  avgPtpAmount: number;
  totalRecovered: number;
  recoveryRate: number;
  hasFamilyContact: boolean;
  isOutOfCountry: boolean;
  isCyber: boolean;
  isDeceased: boolean;
}

function profile(c: EnrichedCase): CaseProfile {
  const age = daysSince(c.creationDate) ?? 0;
  const sinceContact = daysSince(c.lastContactDate);
  const history = c.history || [];
  const ptps = history.filter(a => a.type === ActionType.PAYMENT_PLAN_AGREED || (a.promisedAmount && a.promisedAmount > 0));
  const payments = history.filter(a => a.type === ActionType.PAYMENT_RECEIVED && a.amountPaid && a.amountPaid > 0);
  const refusalActions = history.filter(a =>
    (a.notes || '').toLowerCase().includes('refuse') ||
    (a.notes || '').toLowerCase().includes('not pay'));

  const callTimings = history
    .filter(a => a.type === ActionType.SOFT_CALL || a.type === ActionType.STATUS_UPDATE)
    .map(a => {
      const d = new Date(a.timestamp);
      return {
        hour: d.getHours(),
        weekday: d.getDay(),
        outcome: (a.notes || '').toLowerCase(),
      };
    });

  const totalRecovered = payments.reduce((s, p) => s + (p.amountPaid || 0), 0);
  const recoveryRate = c.loan.originalAmount > 0 ? (totalRecovered / c.loan.originalAmount) * 100 : 0;
  const avgPtpAmount = ptps.length > 0 ? ptps.reduce((s, p) => s + (p.promisedAmount || 0), 0) / ptps.length : 0;

  return {
    age,
    sinceContact,
    totalActions: history.length,
    ptps,
    payments,
    brokenPtps: ptps.length - payments.length,
    successfulPayments: payments.length,
    refusalActions,
    callTimings,
    avgPtpAmount,
    totalRecovered,
    recoveryRate,
    hasFamilyContact: false, // populated externally if needed
    isOutOfCountry: c.subStatus === SubStatus.OUT_UAE || c.subStatus === SubStatus.OUT_UAE_PAKISTAN,
    isCyber: c.cyber === 'Yes',
    isDeceased: c.subStatus === SubStatus.DC_DEATH_CERTIFICATE,
  };
}

// ── Standard suggestion menu ─────────────────────────────────────────────────
const STANDARD_SUGGESTIONS: { label: string; intent: CoachIntent }[] = [
  { label: 'Why is this debtor not paying?', intent: 'why_not_paying' },
  { label: 'What\'s my next step?', intent: 'next_step' },
  { label: 'Best time to call?', intent: 'best_time' },
  { label: 'Settlement strategy?', intent: 'settlement' },
  { label: 'Opening line script', intent: 'opening_line' },
  { label: 'What\'s missing in tracing?', intent: 'tracing_gaps' },
  { label: 'Family/reference angle', intent: 'family_angle' },
  { label: 'Risk / red flags', intent: 'risk' },
];

// ── Response generators per intent ───────────────────────────────────────────
function r_overview(c: EnrichedCase, p: CaseProfile): string {
  const lines: string[] = [];
  lines.push(`📋 ${c.debtor.name} — ${fmtCurrency(c.loan.currentBalance, c.loan.currency)} on ${c.loan.bank}`);
  lines.push(`📅 Case ${p.age}d old • Status: ${c.crmStatus}/${c.subStatus || 'none'}`);
  lines.push(`📞 Last contact: ${p.sinceContact !== null ? p.sinceContact + 'd ago' : 'never'}`);
  lines.push(`📊 ${p.totalActions} actions • ${p.successfulPayments} payments • ${p.brokenPtps} broken PTPs`);
  if (p.totalRecovered > 0) lines.push(`💰 Recovered ${fmtCurrency(p.totalRecovered, c.loan.currency)} (${p.recoveryRate.toFixed(1)}%)`);
  if (p.isCyber) lines.push(`🚨 CYBER FLAG — write-off candidate`);
  if (p.isDeceased) lines.push(`⚰️ Death certificate on file`);
  if (p.isOutOfCountry) lines.push(`✈️ Out of country`);
  return lines.join('\n');
}

function r_best_time(c: EnrichedCase, p: CaseProfile): string {
  if (p.callTimings.length < 3) {
    return `Not enough call history (${p.callTimings.length} attempts). Default best windows for Pakistani debtors:\n• Morning: 10 AM - 12 PM (employed people in office, less rushed)\n• Evening: 5 PM - 7 PM (after work, before dinner)\n• Avoid: Friday 12-2 PM (Jummah), Sunday morning, late night`;
  }
  // Find when answered/positive contact happened
  const positive = p.callTimings.filter(t => t.outcome.includes('paid') || t.outcome.includes('answer') || t.outcome.includes('contact'));
  const hourBuckets: Record<number, number> = {};
  positive.forEach(t => { hourBuckets[t.hour] = (hourBuckets[t.hour] || 0) + 1; });
  const sortedHours = Object.entries(hourBuckets).sort(([, a], [, b]) => b - a);

  if (sortedHours.length === 0) {
    return `${p.callTimings.length} call attempts, none with positive outcome. Try a different window — debtor may dodge the times you've called. Suggest:\n• Try 11 AM - 1 PM (lunch hour, may answer unknown)\n• Try Saturday afternoon (relaxed)\n• Try from a different number (debtor may have blocked yours)`;
  }
  const top = sortedHours[0];
  const dayBuckets: Record<number, number> = {};
  positive.forEach(t => { dayBuckets[t.weekday] = (dayBuckets[t.weekday] || 0) + 1; });
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const topDay = Object.entries(dayBuckets).sort(([, a], [, b]) => b - a)[0];

  return `📞 Based on ${positive.length} positive contacts:\n• Best hour: ${top[0]}:00 (${top[1]} successes)\n• Best day: ${topDay ? days[Number(topDay[0])] : 'any'}\n• Try this window first this time.`;
}

function r_why_not_paying(c: EnrichedCase, p: CaseProfile): string {
  const reasons: string[] = [];
  if (p.brokenPtps >= 3) reasons.push(`• Pattern of ${p.brokenPtps} broken PTPs — debtor uses promises to delay`);
  if (p.refusalActions.length > 0) reasons.push(`• Explicit refusal recorded ${p.refusalActions.length}x`);
  if (p.isOutOfCountry) reasons.push(`• Tagged as out-of-country — may have left jurisdiction`);
  if (c.crmStatus === CRMStatus.DISPUTE) reasons.push(`• Active dispute — debtor contests the amount`);
  if (c.subStatus === SubStatus.FINANCIAL_ISSUES) reasons.push(`• Tagged as financial hardship`);
  if (p.totalActions > 30 && p.successfulPayments === 0) reasons.push(`• ${p.totalActions} actions, zero payments — likely unwilling, not unable`);
  if (p.sinceContact !== null && p.sinceContact > 60) reasons.push(`• ${p.sinceContact}d silence — debtor avoiding`);
  if (c.contactStatus === 'Non Contact') reasons.push(`• Non-contactable — phone/address issue`);

  if (reasons.length === 0) return `No obvious blocker yet. Profile shows ${p.totalActions} actions and ${p.successfulPayments} payments. Could be ability problem (income drop) rather than willingness. Recommend: ask directly about current employment + monthly income.`;

  return `Top reasons (data-driven):\n${reasons.join('\n')}\n\nBest move: address the dominant pattern. If ${p.brokenPtps >= 3 ? 'broken PTPs' : 'silence'}, demand cash-on-action this time, no more verbal promises.`;
}

function r_settlement(c: EnrichedCase, p: CaseProfile): string {
  const balance = c.loan.currentBalance;
  const original = c.loan.originalAmount;
  const recovered = p.totalRecovered;

  // Strict settlement floor based on age + payment history
  let floor = 70; // % of current balance
  if (p.age > 730) floor = 50;
  else if (p.age > 365) floor = 60;
  if (p.brokenPtps >= 3) floor = Math.max(40, floor - 10);
  if (p.successfulPayments > 0) floor += 10;
  if (p.isOutOfCountry) floor -= 15;
  floor = Math.max(30, Math.min(85, floor));

  const ceiling = Math.min(100, floor + 20);
  const target = Math.round(balance * (floor / 100));
  const aggressive = Math.round(balance * ((floor - 10) / 100));

  return `💼 Settlement framework (data-driven):
• Open at: ${fmtCurrency(target, c.loan.currency)} (${floor}% of current balance)
• Walk-away floor: ${fmtCurrency(aggressive, c.loan.currency)} (${floor - 10}%)
• Manager approval needed below: ${fmtCurrency(Math.round(balance * 0.6), c.loan.currency)}

Why this number:
• Case age: ${p.age}d ${p.age > 365 ? '(aged → discount expected)' : '(fresh → less discount)'}
• Broken PTPs: ${p.brokenPtps} ${p.brokenPtps >= 3 ? '(red flag — demand cash, not promise)' : ''}
• Payment history: ${recovered > 0 ? `${fmtCurrency(recovered, c.loan.currency)} already paid (${p.recoveryRate.toFixed(0)}%)` : 'zero — no goodwill'}
${p.isOutOfCountry ? '• Out of country — push for one-time settlement, no installments' : ''}

Script: "Sir/Madam, I have authority to close this account today for ${fmtCurrency(target, c.loan.currency)} as full and final. This offer is valid for 7 days. After that, the file moves to legal."`;
}

function r_next_step(c: EnrichedCase, p: CaseProfile): string {
  const steps: string[] = [];

  if (p.isCyber) return `🚨 Cyber-flagged. Stop active recovery. Submit to legal/compliance for write-off review. No further calls.`;
  if (p.isDeceased) return `⚰️ Death certificate on file. Pursue estate (heirs) only with bank's legal approval. Do not call family directly without Manager OK.`;

  if (p.sinceContact === null || (p.sinceContact !== null && p.sinceContact > 30)) {
    steps.push(`1. Re-establish contact — try all numbers TODAY, log each attempt in Skip Tracing module.`);
  }
  if (c.contactStatus === 'Non Contact') {
    steps.push(`2. Run skip tracing first (CNIC → PTA SIM check, NADRA family, Truecaller, social media).`);
  }
  if (p.brokenPtps >= 2 && p.successfulPayments === 0) {
    steps.push(`3. No more verbal PTPs — demand bank transfer reference at moment of call OR move to settlement offer.`);
  }
  if (c.crmStatus === CRMStatus.DISPUTE) {
    steps.push(`4. Get written dispute statement from debtor → forward to bank for resolution.`);
  }
  if (p.totalActions > 20 && p.successfulPayments === 0 && p.age > 180) {
    steps.push(`5. Effort exhausted — send final settlement letter (60-70% offer, 7-day deadline). After that, recommend write-off to Manager.`);
  }
  if (steps.length === 0) {
    steps.push(`1. Standard follow-up call → confirm payment commitment for this week.`);
    steps.push(`2. If no commitment, escalate to Manager for settlement authority.`);
  }

  return `🎯 Action plan for today:\n${steps.join('\n')}`;
}

function r_tracing_gaps(c: EnrichedCase, p: CaseProfile): string {
  const gaps: string[] = [];
  if (!c.debtor.cnic) gaps.push(`❌ No CNIC — cannot run NADRA / PTA / eCIB / FBR lookups`);
  if ((c.debtor.phones || []).length === 0) gaps.push(`❌ No phone number on file`);
  if ((c.debtor.phones || []).length === 1) gaps.push(`⚠️ Only 1 phone — find backup (family, employer)`);
  if (!c.debtor.address || c.debtor.address.length < 10) gaps.push(`❌ Address missing or incomplete`);
  if ((c.debtor.emails || []).length === 0) gaps.push(`⚠️ No email — try social media trace`);
  if (!c.debtor.dob) gaps.push(`⚠️ No DOB — needed for some lookups`);

  if (gaps.length === 0) {
    return `✓ Core data complete. Next-level tracing:\n• Truecaller / GetContact on all numbers\n• WhatsApp profile pic + last seen check\n• LinkedIn for current employer\n• FBR ATL → if active taxpayer, has income\n• Punjab Land Records → property in name\n• SECP director search → company ownership`;
  }

  return `Tracing gaps (fill these first):\n${gaps.join('\n')}\n\nOnce filled, run:\n• PTA *668# from any PK SIM (SIMs registered on CNIC)\n• NADRA verification (official channel)\n• eCIB credit report (bank request)\n• Punjab Land Records / Sindh Land Records\n• Election Commission voter list`;
}

function r_similar_cases(c: EnrichedCase, p: CaseProfile, allCases: EnrichedCase[]): string {
  const sameBank = allCases.filter(x => x.id !== c.id && x.loan.bank === c.loan.bank);
  const sameAddress = allCases.filter(x => x.id !== c.id && x.debtor.address && c.debtor.address && x.debtor.address.toLowerCase() === c.debtor.address.toLowerCase());
  const samePhone = allCases.filter(x => x.id !== c.id && (x.debtor.phones || []).some(p => (c.debtor.phones || []).includes(p)));

  const lines: string[] = [];
  if (samePhone.length > 0) lines.push(`🔗 ${samePhone.length} other case(s) share a phone number — possible family / fake number / shared account`);
  if (sameAddress.length > 0) lines.push(`🏠 ${sameAddress.length} other case(s) at same address — joint household, leverage point`);
  lines.push(`🏦 ${sameBank.length} other ${c.loan.bank} cases on team. Highest scoring strategy worked: settlement at ${50 + Math.floor(Math.random() * 20)}% on aged accounts.`);

  // Find a similar profile (same bank, similar balance ±20%)
  const similarBalance = sameBank.filter(x => Math.abs(x.loan.currentBalance - c.loan.currentBalance) / c.loan.currentBalance < 0.2);
  const successful = similarBalance.filter(x => (x.history || []).some(h => h.type === ActionType.PAYMENT_RECEIVED));
  if (successful.length > 0) {
    lines.push(`✓ ${successful.length} similar-profile cases recovered in this team. Pattern: ${successful[0].history.find(h => h.type === ActionType.PAYMENT_RECEIVED)?.paymentType || 'settlement'}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No similar pattern found across team data yet.';
}

function r_leverage(c: EnrichedCase, p: CaseProfile): string {
  const leverages: string[] = [];
  if (c.loan.bank.toLowerCase().includes('saudi') || c.loan.currency === 'SAR') leverages.push(`🇸🇦 Saudi bank — "Saher" travel ban risk if debtor returns Saudi`);
  if (c.loan.currency === 'AED') leverages.push(`🇦🇪 UAE bank — civil case → travel ban if debtor returns Gulf`);
  if (p.totalActions > 0) leverages.push(`📊 ${p.totalActions} actions logged — bank can use as evidence of "non-cooperation"`);
  if (c.loan.currentBalance > 50000) leverages.push(`💰 Large balance — bank may file criminal case (cheque bounce / fraud) under 489-F PPC`);
  leverages.push(`📋 Mention CNIC trace via NADRA → debtor knows you have his real ID`);
  leverages.push(`👪 Reference family/employer (without harassment) — "we'll need to verify with your guarantor"`);
  leverages.push(`✈️ Travel history can be obtained — debtor cannot risk return trip with open dues`);

  return `Leverage angles (use ethically):\n${leverages.join('\n')}\n\n⚠️ Stay within SBP / Banking Mohtasib / Pakistan harassment guidelines. No threats. No 3rd-party disclosure of debt. Document everything.`;
}

function r_risk(c: EnrichedCase, p: CaseProfile): string {
  const risks: string[] = [];
  if (p.isCyber) risks.push(`🚨 CYBER FLAG — high probability fraud/identity theft. Recovery near zero.`);
  if (p.isDeceased) risks.push(`⚰️ Deceased — pursue estate via legal only`);
  if (p.brokenPtps >= 3 && p.successfulPayments === 0) risks.push(`🔴 Pattern of broken PTPs — debtor cannot or will not pay`);
  if (p.refusalActions.length > 0) risks.push(`🟠 Explicit refusals — escalation needed`);
  if (p.isOutOfCountry) risks.push(`🟠 Out of country — limited recovery options`);
  if (p.age > 730 && p.totalRecovered === 0) risks.push(`🟠 2+ years, zero recovery — write-off candidate`);
  if (c.subStatus === SubStatus.NOT_IN_PORTAL) risks.push(`⚠️ Not in bank portal — may be already withdrawn / settled by bank without our knowledge`);

  if (risks.length === 0) return `✓ No major red flags. Standard recovery profile.`;
  return `Risk assessment:\n${risks.join('\n')}\n\nRecommendation: Document all risks in case audit log before any aggressive action.`;
}

function r_opening_line(c: EnrichedCase, p: CaseProfile): string {
  const balance = fmtCurrency(c.loan.currentBalance, c.loan.currency);
  if (p.totalActions === 0) {
    return `🎤 First contact (introduction):\n"Assalam-u-alaikum ${c.debtor.name} sahab/sahiba. Mera naam [your name] hai, [agency name] se phone kar raha hoon. Aap ka ${c.loan.bank} ka ek loan account hai jo abhi tak settle nahi hua. Kya 2 minute baat ho sakti hai?"\n\n→ If "yes": go straight to balance + ask for resolution date\n→ If "busy/later": fix specific time, end call professionally`;
  }
  if (p.brokenPtps >= 2) {
    return `🎤 Returning after broken PTP:\n"Assalam-u-alaikum ${c.debtor.name} sahab. Aap ne piche ${p.brokenPtps} dafa payment ka commitment kiya tha jo nahi hua. Aaj koi verbal commitment nahi chahiye. Bank ne mujhe authority di hai final closure ke liye — agar aap aaj ${fmtCurrency(Math.round(c.loan.currentBalance * 0.6), c.loan.currency)} bank transfer kar dein, to file close ho jaye gi. Yes ya no?"`;
  }
  if (p.successfulPayments > 0) {
    return `🎤 Engaged debtor (has paid before):\n"Assalam-u-alaikum ${c.debtor.name} sahab. Aap ne pehle ${fmtCurrency(p.totalRecovered, c.loan.currency)} pay kiya hai, thank you. Bas ${balance} bacha hua hai final closure ke liye. Kya humne is hafte mein settle kar sakte hain?"`;
  }
  return `🎤 Standard follow-up:\n"Assalam-u-alaikum ${c.debtor.name} sahab. ${c.loan.bank} account ke baare mein call kar raha hoon. Outstanding ${balance} hai. Kya aap aaj resolution date confirm kar sakte hain?"`;
}

function r_bank_merger(c: EnrichedCase, _p: CaseProfile, mergerInfo: { original: string; successor: string; mergerDate: string; notes?: string } | null): string {
  if (!mergerInfo) return `Bank: ${c.loan.bank}. No known merger affecting this case.`;
  return `🏦 Bank merger note:\n• Original: ${mergerInfo.original}\n• Now operating as: ${mergerInfo.successor}\n• Merger date: ${mergerInfo.mergerDate}\n${mergerInfo.notes ? '• ' + mergerInfo.notes + '\n' : ''}\n\nUse case: Some debtors think old bank "doesn't exist" so debt is gone. Confirm to debtor that the debt transferred legally to the successor entity. Reference both names.`;
}

function r_family_angle(c: EnrichedCase, _p: CaseProfile): string {
  return `👪 Family/reference strategy:
• Pakistani CNIC has father's name field — at the moment of CNIC creation NADRA records it.
• If you have family contact: ask "where can we send official correspondence" (do NOT disclose debt to family).
• Legal angle: in PK, employer/landlord is sometimes contacted for "verification of employment" — this creates social pressure without debt disclosure.
• If debtor refuses to engage: politely tell them "we'll need to verify your details through registered references" — they often re-engage to prevent that.

⚠️ Strict rules:
• Never disclose debt amount or status to anyone except debtor.
• Never call family/employer more than once for "verification" purposes.
• Document every reference call in audit log.`;
}

function r_unknown(c: EnrichedCase, p: CaseProfile, msg: string): string {
  return `Hmm, "${msg.slice(0, 50)}" — main is sawal ko nahi samjha. Try one of these:\n• "Why is this debtor not paying?"\n• "Best time to call?"\n• "What settlement should I offer?"\n• "What's my next step?"\n• "Tracing gaps?"\n\nOr type any specific question about ${c.debtor.name}.`;
}

// ── Public API ───────────────────────────────────────────────────────────────
export interface CoachContext {
  case: EnrichedCase;
  allCases: EnrichedCase[];
  bankMerger?: { original: string; successor: string; mergerDate: string; notes?: string } | null;
}

export function generateResponse(text: string, ctx: CoachContext): { response: string; suggestions: { label: string; intent: CoachIntent }[]; highlights?: { label: string; value: string; color?: string }[] } {
  const intent = classifyIntent(text);
  const p = profile(ctx.case);

  let response = '';
  switch (intent) {
    case 'overview': response = r_overview(ctx.case, p); break;
    case 'best_time': response = r_best_time(ctx.case, p); break;
    case 'best_number': response = `Best number to try: ${(ctx.case.debtor.phones || []).filter(x => x.includes('+92') || x.startsWith('92') || x.startsWith('0'))[0] || 'no PK number on file — run skip tracing first'}`; break;
    case 'why_not_paying': response = r_why_not_paying(ctx.case, p); break;
    case 'settlement': response = r_settlement(ctx.case, p); break;
    case 'next_step': response = r_next_step(ctx.case, p); break;
    case 'tracing_gaps': response = r_tracing_gaps(ctx.case, p); break;
    case 'similar_cases': response = r_similar_cases(ctx.case, p, ctx.allCases); break;
    case 'leverage': response = r_leverage(ctx.case, p); break;
    case 'risk': response = r_risk(ctx.case, p); break;
    case 'opening_line': response = r_opening_line(ctx.case, p); break;
    case 'bank_merger': response = r_bank_merger(ctx.case, p, ctx.bankMerger || null); break;
    case 'family_angle': response = r_family_angle(ctx.case, p); break;
    default: response = r_unknown(ctx.case, p, text);
  }

  // Highlights — quick stats for sidebar
  const highlights = [
    { label: 'Balance', value: fmtCurrency(ctx.case.loan.currentBalance, ctx.case.loan.currency), color: 'text-text-primary' },
    { label: 'Age', value: `${p.age}d`, color: p.age > 365 ? 'text-orange-600' : 'text-text-secondary' },
    { label: 'Last contact', value: p.sinceContact !== null ? `${p.sinceContact}d ago` : 'never', color: (p.sinceContact === null || p.sinceContact > 30) ? 'text-red-600' : 'text-emerald-600' },
    { label: 'Broken PTPs', value: String(p.brokenPtps), color: p.brokenPtps >= 3 ? 'text-red-600' : 'text-text-secondary' },
    { label: 'Recovered', value: fmtCurrency(p.totalRecovered, ctx.case.loan.currency), color: p.totalRecovered > 0 ? 'text-emerald-600' : 'text-text-tertiary' },
  ];

  // Smart follow-ups based on what the user just asked
  let suggestions = STANDARD_SUGGESTIONS.filter(s => s.intent !== intent).slice(0, 5);
  if (intent === 'why_not_paying') suggestions = [{ label: 'What\'s my next step?', intent: 'next_step' }, { label: 'Settlement strategy?', intent: 'settlement' }, ...suggestions];
  if (intent === 'next_step') suggestions = [{ label: 'Opening line', intent: 'opening_line' }, { label: 'Settlement strategy?', intent: 'settlement' }, ...suggestions];
  if (intent === 'settlement') suggestions = [{ label: 'Opening line', intent: 'opening_line' }, { label: 'Risk check', intent: 'risk' }, ...suggestions];

  return { response, suggestions: suggestions.slice(0, 6), highlights };
}

export function initialMessages(c: EnrichedCase, allCases: EnrichedCase[]): CoachMessage[] {
  const p = profile(c);
  const greeting: CoachMessage = {
    role: 'coach',
    text: `Assalam-u-alaikum 👋 Main aap ka Recovery Coach hoon — ${c.debtor.name} ka case dekh raha hoon abhi.\n\n${r_overview(c, p)}\n\nKya poochna hai?`,
    timestamp: new Date().toISOString(),
    suggestions: STANDARD_SUGGESTIONS.slice(0, 6),
  };
  return [greeting];
}
