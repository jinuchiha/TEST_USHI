/**
 * RecoVantage AI Brain
 * Built-in intelligence — feels like ChatGPT but runs on YOUR data
 * Zero external API calls. Pure pattern matching + data analysis + template generation.
 */

import { EnrichedCase, User, Role, CRMStatus, SubStatus, ActionType, BankDraft } from '../../types';
import { formatCurrency } from '../../utils';
import {
    rankCasesByPriority, calculateCasePriority, generateAutoRemark,
    findDuplicates, calculatePortfolioHealth, predictSettlement,
    suggestBestCallTime, predictPaymentLikelihood, profileDebtor,
    predictWriteOffRisk, analyzeOfficerPerformance, suggestBestChannel,
} from './engines';


// ═══════════════════════════════════════════════════════
// 1. AI CHAT ASSISTANT — Natural Language Query Engine
// ═══════════════════════════════════════════════════════

export interface AIChatResponse {
    text: string;
    type: 'answer' | 'list' | 'insight' | 'error' | 'action';
    data?: EnrichedCase[];
    stats?: Record<string, string | number>;
}

interface ParsedIntent {
    intent: 'filter_cases' | 'count_cases' | 'top_cases' | 'officer_info' | 'portfolio_info' | 'case_info' | 'greeting' | 'help' | 'unknown';
    filters: {
        bank?: string;
        status?: string;
        minBalance?: number;
        maxBalance?: number;
        staleDays?: number;
        officer?: string;
        product?: string;
        currency?: string;
        ptpDue?: boolean;
        overdue?: boolean;
        name?: string;
    };
    limit?: number;
}

function parseQuery(query: string, cases: EnrichedCase[], users: User[]): ParsedIntent {
    const q = query.toLowerCase().trim();
    const result: ParsedIntent = { intent: 'unknown', filters: {} };

    // Greetings
    if (/^(hi|hello|hey|good morning|good evening|salam|assalam)/i.test(q)) {
        return { intent: 'greeting', filters: {} };
    }
    if (/^(help|what can you do|commands)/i.test(q)) {
        return { intent: 'help', filters: {} };
    }

    // Portfolio info
    if (/portfolio|health|overall|total recovery|how are we doing/i.test(q)) {
        return { intent: 'portfolio_info', filters: {} };
    }

    // Officer info
    const officerMatch = q.match(/(?:officer|agent|performance of|how is)\s+(\w+)/i);
    if (officerMatch) {
        return { intent: 'officer_info', filters: { officer: officerMatch[1] } };
    }

    // Case by name or account
    const nameMatch = q.match(/(?:case|debtor|account|find|search|show me)\s+(?:for\s+)?([a-z\s]+?)(?:\s+case|\s*$)/i);
    if (nameMatch && nameMatch[1].trim().length > 2) {
        result.filters.name = nameMatch[1].trim();
    }

    // It's a case filter query
    result.intent = 'filter_cases';

    // Bank extraction
    const banks = [...new Set(cases.map(c => c.loan.bank))];
    for (const bank of banks) {
        if (q.includes(bank.toLowerCase())) {
            result.filters.bank = bank;
            break;
        }
    }

    // Status extraction
    const statusMap: Record<string, string> = {
        'ptp': 'PTP', 'promise': 'PTP', 'callback': 'CB', 'call back': 'CB', 'cb': 'CB',
        'new': 'NEW', 'ncc': 'NCC', 'rtp': 'RTP', 'refused': 'RTP', 'dispute': 'DISPUTE',
        'closed': 'Closed', 'paid': 'Closed', 'nip': 'NIP', 'utr': 'UTR', 'tracing': 'UTR',
        'withdrawn': 'WITHDRAWN', 'hold': 'HOLD',
    };
    for (const [keyword, status] of Object.entries(statusMap)) {
        if (q.includes(keyword)) {
            result.filters.status = status;
            break;
        }
    }

    // Balance extraction
    const balanceAbove = q.match(/(?:above|over|more than|greater than|>\s*)\s*(\d+)\s*k?/i);
    if (balanceAbove) {
        let val = parseInt(balanceAbove[1]);
        if (q.includes('k') || val < 1000) val *= 1000;
        result.filters.minBalance = val;
    }
    const balanceBelow = q.match(/(?:below|under|less than|<\s*)\s*(\d+)\s*k?/i);
    if (balanceBelow) {
        let val = parseInt(balanceBelow[1]);
        if (q.includes('k') || val < 1000) val *= 1000;
        result.filters.maxBalance = val;
    }

    // Stale/no contact
    const staleMatch = q.match(/(?:stale|no contact|haven't contacted|not contacted|idle)\s*(?:in|for)?\s*(\d+)\s*(?:days?|d)/i);
    if (staleMatch) {
        result.filters.staleDays = parseInt(staleMatch[1]);
    }
    if (/stale|no contact|haven't contacted/i.test(q) && !staleMatch) {
        result.filters.staleDays = 7; // Default 7 days
    }

    // PTP due
    if (/ptp.*(?:due|today|this week|overdue)/i.test(q) || /(?:due|overdue).*ptp/i.test(q)) {
        result.filters.ptpDue = true;
    }

    // Overdue
    if (/overdue|past due|expired/i.test(q)) {
        result.filters.overdue = true;
    }

    // Top/highest
    const topMatch = q.match(/(?:top|highest|biggest|largest)\s*(\d+)?/i);
    if (topMatch) {
        result.intent = 'top_cases';
        result.limit = parseInt(topMatch[1] || '5');
    }

    // Count
    if (/how many|count|total number/i.test(q)) {
        result.intent = 'count_cases';
    }

    // Product
    const products = [...new Set(cases.map(c => c.loan.product))];
    for (const prod of products) {
        if (q.includes(prod.toLowerCase())) {
            result.filters.product = prod;
            break;
        }
    }

    return result;
}

function filterCases(cases: EnrichedCase[], filters: ParsedIntent['filters']): EnrichedCase[] {
    let result = [...cases];
    const now = Date.now();

    if (filters.bank) result = result.filter(c => c.loan.bank === filters.bank);
    if (filters.status) result = result.filter(c => c.crmStatus === filters.status);
    if (filters.minBalance) result = result.filter(c => c.loan.currentBalance >= filters.minBalance!);
    if (filters.maxBalance) result = result.filter(c => c.loan.currentBalance <= filters.maxBalance!);
    if (filters.product) result = result.filter(c => c.loan.product === filters.product);
    if (filters.name) {
        const search = filters.name.toLowerCase();
        result = result.filter(c => c.debtor.name.toLowerCase().includes(search) || c.loan.accountNumber.toLowerCase().includes(search));
    }
    if (filters.staleDays) {
        const cutoff = now - filters.staleDays * 86400000;
        result = result.filter(c => {
            const lastContact = c.lastContactDate ? new Date(c.lastContactDate).getTime() : 0;
            return lastContact < cutoff;
        });
    }
    if (filters.ptpDue) {
        result = result.filter(c => {
            const ptp = c.history.find(h => h.promisedDate);
            if (!ptp?.promisedDate) return false;
            const ptpDate = new Date(ptp.promisedDate).getTime();
            return ptpDate <= now + 7 * 86400000; // Due within 7 days
        });
    }

    return result;
}

export function processAIChat(query: string, cases: EnrichedCase[], users: User[], currentUser: User): AIChatResponse {
    const parsed = parseQuery(query, cases, users);

    // Greeting
    if (parsed.intent === 'greeting') {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        const activeCases = cases.filter(c => c.assignedOfficerId === currentUser.id && c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
        return {
            type: 'answer',
            text: `${greeting}, ${currentUser.name.split(' ')[0]}! You have ${activeCases.length} active cases. ${activeCases.filter(c => c.crmStatus === CRMStatus.PTP).length} PTPs pending. How can I help you today?`
        };
    }

    // Help
    if (parsed.intent === 'help') {
        return {
            type: 'answer',
            text: `I can help you with:\n\n• **Find cases**: "Show ADIB cases above 100K"\n• **PTP tracking**: "PTP due today" or "Overdue promises"\n• **Stale cases**: "Cases not contacted in 7 days"\n• **Top cases**: "Top 5 highest balance cases"\n• **Portfolio health**: "How is our portfolio doing?"\n• **Officer performance**: "How is Ahmed performing?"\n• **Search**: "Find Mohammed" or "Account MA123"\n• **Counts**: "How many PTP cases?"\n\nJust type naturally — I understand context!`
        };
    }

    // Portfolio info
    if (parsed.intent === 'portfolio_info') {
        const health = calculatePortfolioHealth(cases, users);
        const activeCases = cases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
        const totalOS = activeCases.reduce((s, c) => s + c.loan.currentBalance, 0);
        return {
            type: 'insight',
            text: `**Portfolio Health: ${health.score}/100 (Grade ${health.grade})** — ${health.trend === 'improving' ? '↑ Improving' : health.trend === 'declining' ? '↓ Declining' : '→ Stable'}\n\n` +
                `• **Active Cases**: ${activeCases.length}\n` +
                `• **Total Outstanding**: AED ${totalOS.toLocaleString()}\n` +
                `• **Collection Rate**: ${health.components.collectionRate.value.toFixed(1)}%\n` +
                `• **Contact Rate**: ${health.components.contactRate.value.toFixed(1)}%\n` +
                `• **PTP Fulfillment**: ${health.components.ptpFulfillment.value.toFixed(1)}%\n\n` +
                `**Insights:**\n${health.insights.map(i => `• ${i}`).join('\n')}`,
            stats: { score: health.score, grade: health.grade, cases: activeCases.length, outstanding: totalOS }
        };
    }

    // Officer info
    if (parsed.intent === 'officer_info' && parsed.filters.officer) {
        const officer = users.find(u => u.name.toLowerCase().includes(parsed.filters.officer!.toLowerCase()));
        if (!officer) return { type: 'error', text: `I couldn't find an officer named "${parsed.filters.officer}". Try the full name.` };
        const perf = analyzeOfficerPerformance(officer, cases);
        return {
            type: 'insight',
            text: `**${officer.name}** — Performance Score: **${perf.overallScore}/100**\n\n` +
                `**Strengths:**\n${perf.strengths.map(s => `✓ ${s}`).join('\n') || '• None identified'}\n\n` +
                `**Weaknesses:**\n${perf.weaknesses.map(w => `✗ ${w}`).join('\n') || '• None identified'}\n\n` +
                `**Recommendation:** ${perf.recommendation}\n\n` +
                `**Metrics:** Contact: ${perf.metrics.contactRate.toFixed(0)}% | PTP Conv: ${perf.metrics.ptpConversion.toFixed(0)}% | Actions/Day: ${perf.metrics.avgActionsPerDay.toFixed(1)}`
        };
    }

    // Filter/count/top cases
    const filtered = filterCases(cases, parsed.filters);

    if (parsed.intent === 'count_cases') {
        const totalOS = filtered.reduce((s, c) => s + c.loan.currentBalance, 0);
        const filterDesc = Object.entries(parsed.filters).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || 'all cases';
        return {
            type: 'answer',
            text: `**${filtered.length} cases** found matching: ${filterDesc}\n\nTotal outstanding: **AED ${totalOS.toLocaleString()}**`,
            stats: { count: filtered.length, outstanding: totalOS }
        };
    }

    if (parsed.intent === 'top_cases') {
        const top = filtered.sort((a, b) => b.loan.currentBalance - a.loan.currentBalance).slice(0, parsed.limit || 5);
        const lines = top.map((c, i) => `${i + 1}. **${c.debtor.name}** — ${formatCurrency(c.loan.currentBalance, c.loan.currency)} | ${c.loan.bank} | ${c.crmStatus} | Officer: ${c.officer.name}`);
        return {
            type: 'list',
            text: `**Top ${top.length} cases by balance:**\n\n${lines.join('\n')}`,
            data: top,
        };
    }

    // Default: filter_cases
    if (filtered.length === 0) {
        return { type: 'answer', text: `No cases found matching your criteria. Try broadening your search.` };
    }

    const totalOS = filtered.reduce((s, c) => s + c.loan.currentBalance, 0);
    const topCases = filtered.sort((a, b) => b.loan.currentBalance - a.loan.currentBalance).slice(0, 8);
    const lines = topCases.map(c => `• **${c.debtor.name}** (${c.loan.accountNumber}) — ${formatCurrency(c.loan.currentBalance, c.loan.currency)} | ${c.loan.bank} | ${c.crmStatus}`);

    return {
        type: 'list',
        text: `**Found ${filtered.length} cases** — Total: AED ${totalOS.toLocaleString()}\n\n${lines.join('\n')}${filtered.length > 8 ? `\n\n_...and ${filtered.length - 8} more_` : ''}`,
        data: topCases,
        stats: { count: filtered.length, outstanding: totalOS }
    };
}


// ═══════════════════════════════════════════════════════
// 2. AI CASE BRIEFING — One-click analysis
// ═══════════════════════════════════════════════════════

export interface CaseBriefing {
    summary: string;
    riskAssessment: string;
    debtorProfile: string;
    recommendedActions: string[];
    keyMetrics: { label: string; value: string; color: string }[];
    negotiationAdvice: string;
}

export function generateCaseBriefing(c: EnrichedCase, allCases: EnrichedCase[]): CaseBriefing {
    const priority = calculateCasePriority(c, allCases);
    const profile = profileDebtor(c);
    const settlement = predictSettlement(c, allCases);
    const writeOff = predictWriteOffRisk(c);
    const likelihood = predictPaymentLikelihood(c);
    const callTime = suggestBestCallTime(c);
    const channel = suggestBestChannel(c);
    const dpd = c.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;
    const payments = c.history.filter(h => h.type === ActionType.PAYMENT_RECEIVED);
    const totalPaid = payments.reduce((s, h) => s + (h.amountPaid || 0), 0);
    const attempts = c.history.filter(h => h.type === ActionType.SOFT_CALL).length;
    const relatedCases = allCases.filter(ac => ac.debtor.id === c.debtor.id && ac.id !== c.id);

    // Summary paragraph
    const summary = `${c.debtor.name} has an outstanding balance of ${formatCurrency(c.loan.currentBalance, c.loan.currency)} on a ${c.loan.product} with ${c.loan.bank}. ` +
        `The case is ${dpd} days past due with ${attempts} contact attempts made. ` +
        (totalPaid > 0 ? `${formatCurrency(totalPaid, c.loan.currency)} has been collected so far. ` : 'No payments have been received yet. ') +
        (relatedCases.length > 0 ? `The debtor has ${relatedCases.length} other account(s) in the system. ` : '') +
        `Current status: ${c.crmStatus}/${c.subStatus}. Priority score: ${priority.score}/1000 (${priority.urgency}).`;

    // Risk assessment
    const riskAssessment = `Write-off risk: ${writeOff.probability}% (${writeOff.riskLevel}). ` +
        (writeOff.daysToWriteOff !== null ? `${writeOff.daysToWriteOff} days until write-off date. ` : '') +
        `Payment likelihood if PTP set: ${likelihood.probability}% (${likelihood.risk} risk). ` +
        writeOff.recommendation;

    // Debtor profile
    const debtorProfile = `Behavioral type: **${profile.type}** (${profile.confidence}% confidence). ` +
        `${profile.description} ` +
        `Strategy: ${profile.suggestedStrategy}`;

    // Recommended actions
    const actions: string[] = [];
    actions.push(priority.suggestedAction);
    actions.push(`Best channel: ${channel.primaryChannel} (${channel.confidence}% confidence)`);
    actions.push(`Best time: ${callTime.bestTimeSlot}`);
    if (settlement.suggestedOpeningOffer < 90) {
        actions.push(`Settlement: Open at ${settlement.suggestedOpeningOffer.toFixed(0)}%, floor ${settlement.suggestedFloor.toFixed(0)}%`);
    }
    if (writeOff.riskLevel === 'critical' || writeOff.riskLevel === 'high') {
        actions.push('URGENT: High write-off risk — prioritize this case');
    }
    if (relatedCases.length > 0) {
        actions.push(`Review ${relatedCases.length} related case(s) for consolidated approach`);
    }

    // Key metrics
    const metrics = [
        { label: 'Priority', value: `${priority.score}`, color: priority.urgency === 'critical' ? '#DC2626' : priority.urgency === 'high' ? '#F28C28' : '#16A34A' },
        { label: 'DPD', value: `${dpd}`, color: dpd > 120 ? '#DC2626' : dpd > 60 ? '#F28C28' : '#16A34A' },
        { label: 'Recovery Chance', value: `${likelihood.probability}%`, color: likelihood.probability > 60 ? '#16A34A' : likelihood.probability > 35 ? '#F28C28' : '#DC2626' },
        { label: 'Write-Off Risk', value: `${writeOff.probability}%`, color: writeOff.probability > 60 ? '#DC2626' : writeOff.probability > 35 ? '#F28C28' : '#16A34A' },
        { label: 'Attempts', value: `${attempts}`, color: '#475569' },
        { label: 'Collected', value: formatCurrency(totalPaid, c.loan.currency), color: '#16A34A' },
    ];

    // Negotiation advice
    const negotiationAdvice = `${settlement.reasoning} ${settlement.negotiationTips.join('. ')}.`;

    return { summary, riskAssessment, debtorProfile, recommendedActions: actions, keyMetrics: metrics, negotiationAdvice };
}


// ═══════════════════════════════════════════════════════
// 3. AI DAILY BRIEF — Morning summary
// ═══════════════════════════════════════════════════════

export interface DailyBrief {
    greeting: string;
    urgentItems: string[];
    todayFocus: string;
    quickStats: { label: string; value: string }[];
    motivationalNote: string;
}

export function generateDailyBrief(currentUser: User, cases: EnrichedCase[], users: User[]): DailyBrief {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = currentUser.name.split(' ')[0];

    const myCases = currentUser.role === Role.OFFICER
        ? cases.filter(c => c.assignedOfficerId === currentUser.id)
        : cases;
    const activeCases = myCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);

    // Urgent items
    const urgentItems: string[] = [];
    const todayStr = now.toISOString().split('T')[0];

    // PTPs due today
    const ptpsDueToday = activeCases.filter(c => {
        const ptp = c.history.find(h => h.promisedDate);
        return ptp?.promisedDate?.startsWith(todayStr);
    });
    if (ptpsDueToday.length > 0) {
        const total = ptpsDueToday.reduce((s, c) => s + (c.history.find(h => h.promisedDate)?.promisedAmount || 0), 0);
        urgentItems.push(`${ptpsDueToday.length} PTP(s) due today — AED ${total.toLocaleString()} expected`);
    }

    // Overdue PTPs
    const overduePtps = activeCases.filter(c => {
        const ptp = c.history.find(h => h.promisedDate);
        return ptp?.promisedDate && new Date(ptp.promisedDate) < now && c.crmStatus === CRMStatus.PTP;
    });
    if (overduePtps.length > 0) urgentItems.push(`${overduePtps.length} overdue PTP(s) need follow-up`);

    // Stale cases
    const staleCases = activeCases.filter(c => {
        const lastContact = c.lastContactDate ? new Date(c.lastContactDate) : null;
        return !lastContact || (now.getTime() - lastContact.getTime()) > 7 * 86400000;
    });
    if (staleCases.length > 5) urgentItems.push(`${staleCases.length} cases with no contact in 7+ days`);

    // Write-off urgent
    const writeOffUrgent = activeCases.filter(c => {
        if (!c.loan.wod) return false;
        const daysToWO = Math.floor((new Date(c.loan.wod).getTime() - now.getTime()) / 86400000);
        return daysToWO > 0 && daysToWO <= 30;
    });
    if (writeOffUrgent.length > 0) urgentItems.push(`${writeOffUrgent.length} case(s) approaching write-off within 30 days`);

    if (urgentItems.length === 0) urgentItems.push('No urgent items — keep up the great work!');

    // Today's focus
    const ranked = rankCasesByPriority(activeCases.slice(0, 50), cases);
    const topCase = ranked[0];
    const todayFocus = topCase
        ? `Focus on ${topCase.debtor.name} (${formatCurrency(topCase.loan.currentBalance, topCase.loan.currency)}) — ${topCase.priority.suggestedAction}`
        : 'Review your case queue for opportunities';

    // Quick stats
    const totalOS = activeCases.reduce((s, c) => s + c.loan.currentBalance, 0);
    const quickStats = [
        { label: 'Active Cases', value: `${activeCases.length}` },
        { label: 'Total Outstanding', value: `AED ${totalOS.toLocaleString()}` },
        { label: 'PTP Pipeline', value: `${activeCases.filter(c => c.crmStatus === CRMStatus.PTP).length}` },
        { label: 'New/Unworked', value: `${activeCases.filter(c => c.crmStatus === CRMStatus.NEW).length}` },
    ];

    // Motivation
    const motivations = [
        'Every call brings you closer to target. Let\'s make today count!',
        'Top collectors start with the hardest cases first. You\'ve got this!',
        'Consistency beats intensity. Keep the momentum going!',
        'Your next big recovery could be one call away.',
        'Focus on quality conversations, not just quantity.',
    ];
    const motivationalNote = motivations[now.getDate() % motivations.length];

    return { greeting: `${greeting}, ${firstName}!`, urgentItems, todayFocus, quickStats, motivationalNote };
}


// ═══════════════════════════════════════════════════════
// 4. AI NEGOTIATION COACH — Live advisor during call
// ═══════════════════════════════════════════════════════

export interface NegotiationAdvice {
    openingScript: string;
    debtorType: string;
    talkingPoints: string[];
    doList: string[];
    dontList: string[];
    settlementGuide: { opening: string; midpoint: string; floor: string };
    closingTechniques: string[];
}

export function getNegotiationCoach(c: EnrichedCase, allCases: EnrichedCase[]): NegotiationAdvice {
    const profile = profileDebtor(c);
    const settlement = predictSettlement(c, allCases);
    const dpd = c.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;
    const balance = c.loan.currentBalance;
    const currency = c.loan.currency;
    const name = c.debtor.name.split(' ')[0];
    const payments = c.history.filter(h => h.type === ActionType.PAYMENT_RECEIVED);

    // Opening script based on debtor type
    const scripts: Record<string, string> = {
        'Cooperator': `"Good day ${name}, this is [Your Name] from RecoVantage. I'm calling regarding your ${c.loan.product} account with ${c.loan.bank}. I see you've been cooperative in the past and I'd like to help you resolve the remaining ${formatCurrency(balance, currency)}. What payment arrangement works best for you?"`,
        'Avoider': `"${name}, this is [Your Name] calling about your overdue ${c.loan.product} with ${c.loan.bank}. The outstanding amount is ${formatCurrency(balance, currency)}. I want to help you before this escalates further. Can we discuss a resolution today?"`,
        'Negotiator': `"${name}, I'm calling about your ${c.loan.bank} account. The balance is ${formatCurrency(balance, currency)}. I have some options that could work for both of us, but they are time-limited. Shall I go through them?"`,
        'Promiser': `"${name}, I'm following up on your account. I notice previous commitments were not fulfilled. I need to understand your current situation before we can proceed. What has changed since our last discussion?"`,
        'Genuine Hardship': `"${name}, I understand you may be going through a difficult time. I'm calling about your ${c.loan.bank} account of ${formatCurrency(balance, currency)}. Let's explore affordable options that can help you start resolving this."`,
    };

    // Talking points
    const talkingPoints: string[] = [
        `Outstanding: ${formatCurrency(balance, currency)} (${c.loan.product}, ${c.loan.bank})`,
        `Days overdue: ${dpd}`,
        payments.length > 0 ? `Previous payments: ${payments.length} (shows willingness)` : 'No previous payments on record',
    ];
    if (dpd > 120) talkingPoints.push('Mention: legal escalation is being considered');
    if (c.loan.wod) talkingPoints.push(`Write-off date approaching — creates urgency`);

    // Do's and Don'ts
    const doList = ['Stay calm and professional', 'Listen actively before proposing solutions', 'Document everything discussed'];
    const dontList = ['Never threaten or use abusive language', 'Don\'t make promises you can\'t keep'];

    if (profile.type === 'Negotiator') {
        doList.push('Set firm boundaries from the start', 'Use "This is the best I can offer" technique');
        dontList.push('Don\'t concede too quickly — they will push further');
    } else if (profile.type === 'Promiser') {
        doList.push('Ask for partial payment TODAY as good faith', 'Set very short PTP windows (3 days max)');
        dontList.push('Don\'t accept long-term promises without upfront payment');
    } else if (profile.type === 'Genuine Hardship') {
        doList.push('Show empathy — acknowledge their situation', 'Offer smallest possible installment to start');
        dontList.push('Don\'t pressure for full payment if they clearly can\'t afford it');
    }

    const opening = settlement.suggestedOpeningOffer;
    const floor = settlement.suggestedFloor;
    const mid = (opening + floor) / 2;

    const closingTechniques = [
        `"If you can settle at ${formatCurrency(balance * opening / 100, currency)} today, I can close this case for you."`,
        `"I have authorization for a limited-time offer. This won't be available next week."`,
        `"Would you prefer a lump sum settlement or an installment plan?"`,
    ];
    if (dpd > 90) closingTechniques.push('"The next step would be legal proceedings, which would add costs. Let\'s resolve this now."');

    return {
        openingScript: scripts[profile.type] || scripts['Cooperator'],
        debtorType: `${profile.type} (${profile.confidence}% confidence)`,
        talkingPoints,
        doList,
        dontList,
        settlementGuide: {
            opening: `${opening.toFixed(0)}% (${formatCurrency(balance * opening / 100, currency)})`,
            midpoint: `${mid.toFixed(0)}% (${formatCurrency(balance * mid / 100, currency)})`,
            floor: `${floor.toFixed(0)}% (${formatCurrency(balance * floor / 100, currency)})`,
        },
        closingTechniques,
    };
}


// ═══════════════════════════════════════════════════════
// 5. AI ANOMALY ALERTS — Real-time monitoring
// ═══════════════════════════════════════════════════════

export interface AnomalyAlert {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    category: 'officer' | 'case' | 'portfolio' | 'compliance';
    title: string;
    detail: string;
    timestamp: string;
    actionRequired: string;
}

export function detectAnomalies(cases: EnrichedCase[], users: User[]): AnomalyAlert[] {
    const alerts: AnomalyAlert[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    let alertId = 1;

    const officers = users.filter(u => u.role === Role.OFFICER);

    // 1. Officers with zero activity today (after 11 AM)
    if (now.getHours() >= 11) {
        for (const officer of officers) {
            const officerCases = cases.filter(c => c.assignedOfficerId === officer.id);
            const todayActions = officerCases.flatMap(c => c.history).filter(h => h.timestamp.startsWith(todayStr));
            if (todayActions.length === 0 && officerCases.length > 0) {
                alerts.push({
                    id: `anomaly-${alertId++}`,
                    severity: 'warning',
                    category: 'officer',
                    title: `${officer.name} has zero activity today`,
                    detail: `No actions logged since morning. ${officerCases.length} active cases assigned.`,
                    timestamp: now.toISOString(),
                    actionRequired: 'Check if officer is present and working',
                });
            }
        }
    }

    // 2. Cases with rapid status changes (gaming the system)
    for (const c of cases) {
        const todayLogs = c.auditLog.filter(l => l.timestamp.startsWith(todayStr));
        if (todayLogs.length >= 5) {
            alerts.push({
                id: `anomaly-${alertId++}`,
                severity: 'warning',
                category: 'case',
                title: `Case ${c.loan.accountNumber} changed status ${todayLogs.length} times today`,
                detail: `Debtor: ${c.debtor.name}. Excessive status changes may indicate data manipulation.`,
                timestamp: now.toISOString(),
                actionRequired: 'Review case audit log for suspicious activity',
            });
        }
    }

    // 3. High-value cases stuck in same status for 30+ days
    const stuckCases = cases.filter(c => {
        if (c.crmStatus === CRMStatus.CLOSED || c.crmStatus === CRMStatus.WITHDRAWN) return false;
        if (c.loan.currentBalance < 50000) return false;
        const lastActivity = c.history[0]?.timestamp;
        if (!lastActivity) return true;
        return (now.getTime() - new Date(lastActivity).getTime()) > 30 * 86400000;
    });
    if (stuckCases.length > 0) {
        alerts.push({
            id: `anomaly-${alertId++}`,
            severity: 'critical',
            category: 'portfolio',
            title: `${stuckCases.length} high-value case(s) inactive for 30+ days`,
            detail: `Total exposure: AED ${stuckCases.reduce((s, c) => s + c.loan.currentBalance, 0).toLocaleString()}. These cases need immediate attention.`,
            timestamp: now.toISOString(),
            actionRequired: 'Reassign or escalate these cases immediately',
        });
    }

    // 4. Broken PTP pattern
    const serialDefaulters = cases.filter(c => {
        const brokenPtps = c.auditLog.filter(l => l.details.toLowerCase().includes('broken') || l.details.toLowerCase().includes('status changed to ptp'));
        return brokenPtps.length >= 3 && c.crmStatus !== CRMStatus.CLOSED;
    });
    if (serialDefaulters.length > 0) {
        alerts.push({
            id: `anomaly-${alertId++}`,
            severity: 'warning',
            category: 'case',
            title: `${serialDefaulters.length} case(s) with 3+ broken PTPs`,
            detail: 'Serial promise-breakers detected. These debtors are unlikely to pay voluntarily.',
            timestamp: now.toISOString(),
            actionRequired: 'Consider legal escalation or settlement offers',
        });
    }

    // 5. Portfolio concentration risk
    const bankCounts: Record<string, number> = {};
    const activeCases = cases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
    activeCases.forEach(c => { bankCounts[c.loan.bank] = (bankCounts[c.loan.bank] || 0) + 1; });
    const totalActive = activeCases.length;
    for (const [bank, count] of Object.entries(bankCounts)) {
        if (totalActive > 0 && (count / totalActive) > 0.5) {
            alerts.push({
                id: `anomaly-${alertId++}`,
                severity: 'info',
                category: 'portfolio',
                title: `${bank} represents ${Math.round(count / totalActive * 100)}% of portfolio`,
                detail: `High concentration risk. ${count} of ${totalActive} active cases from single bank.`,
                timestamp: now.toISOString(),
                actionRequired: 'Consider diversifying portfolio allocations',
            });
        }
    }

    return alerts.sort((a, b) => {
        const sev = { critical: 0, warning: 1, info: 2 };
        return sev[a.severity] - sev[b.severity];
    });
}
