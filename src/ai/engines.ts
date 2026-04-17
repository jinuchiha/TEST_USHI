/**
 * RecoVantage Built-In AI Engines
 * Pure algorithmic intelligence — ZERO external API calls
 * All computations run instantly in the browser
 */

import { EnrichedCase, CRMStatus, SubStatus, User, Role, ActionType } from '../../types';

// ═══════════════════════════════════════════════════════
// ENGINE 1: Auto Case Prioritization v2
// 15-factor weighted scoring — ranks every case by urgency
// ═══════════════════════════════════════════════════════

interface PriorityScore {
    caseId: string;
    score: number;        // 0-1000
    urgency: 'critical' | 'high' | 'medium' | 'low';
    reasons: string[];    // Top 3 reasons for this score
    suggestedAction: string;
}

export function calculateCasePriority(c: EnrichedCase, allCases: EnrichedCase[]): PriorityScore {
    let score = 0;
    const reasons: string[] = [];
    const now = new Date();

    // Factor 1: PTP due today or overdue (+200 max)
    const ptpAction = c.history.find(h => h.promisedDate);
    if (ptpAction?.promisedDate) {
        const ptpDate = new Date(ptpAction.promisedDate);
        const daysDiff = Math.floor((now.getTime() - ptpDate.getTime()) / 86400000);
        if (daysDiff === 0) { score += 200; reasons.push('PTP due TODAY'); }
        else if (daysDiff > 0 && daysDiff <= 3) { score += 180; reasons.push(`PTP overdue by ${daysDiff}d`); }
        else if (daysDiff < 0 && daysDiff >= -1) { score += 150; reasons.push('PTP due tomorrow'); }
    }

    // Factor 2: Balance size (+150 max) — high value = high priority
    const balanceAED = c.loan.currentBalance; // Assume AED for simplicity
    if (balanceAED > 100000) { score += 150; reasons.push('High value: >100K'); }
    else if (balanceAED > 50000) { score += 100; }
    else if (balanceAED > 20000) { score += 60; }
    else { score += 20; }

    // Factor 3: Days since last contact (+120 max) — stale = urgent
    const lastContactDate = c.lastContactDate ? new Date(c.lastContactDate) : null;
    const daysSinceContact = lastContactDate ? Math.floor((now.getTime() - lastContactDate.getTime()) / 86400000) : 999;
    if (daysSinceContact > 14) { score += 120; reasons.push(`No contact for ${daysSinceContact}d`); }
    else if (daysSinceContact > 7) { score += 80; reasons.push(`Stale: ${daysSinceContact}d since contact`); }
    else if (daysSinceContact > 3) { score += 40; }

    // Factor 4: DPD (Days Past Due) (+100 max) — approaching write-off
    const lpd = c.loan.lpd ? new Date(c.loan.lpd) : null;
    const dpd = lpd ? Math.max(0, Math.floor((now.getTime() - lpd.getTime()) / 86400000)) : 0;
    if (dpd > 150) { score += 100; reasons.push(`Critical DPD: ${dpd}`); }
    else if (dpd > 90) { score += 70; }
    else if (dpd > 30) { score += 40; }

    // Factor 5: Write-off proximity (+100 max)
    if (c.loan.wod) {
        const wod = new Date(c.loan.wod);
        const daysToWriteOff = Math.floor((wod.getTime() - now.getTime()) / 86400000);
        if (daysToWriteOff <= 30 && daysToWriteOff > 0) { score += 100; reasons.push(`Write-off in ${daysToWriteOff}d!`); }
        else if (daysToWriteOff <= 60) { score += 60; }
    }

    // Factor 6: Contact status (+80 max) — contactable cases first
    if (c.contactStatus === 'Contact') { score += 80; }

    // Factor 7: Previous payment history (+70 max)
    const payments = c.history.filter(h => h.type === ActionType.PAYMENT_RECEIVED);
    if (payments.length > 0) { score += 70; reasons.push('Has payment history — likely to pay again'); }

    // Factor 8: Number of contact attempts penalty (-30 max)
    const attempts = c.history.filter(h => h.type === ActionType.SOFT_CALL).length;
    if (attempts > 20) { score -= 30; } // Diminishing returns

    // Factor 9: Status-based boost
    if (c.crmStatus === CRMStatus.PTP) { score += 60; }
    else if (c.crmStatus === CRMStatus.CB) { score += 50; }
    else if (c.crmStatus === CRMStatus.NEW) { score += 40; reasons.push('New case — needs first contact'); }
    else if (c.crmStatus === CRMStatus.RTP) { score -= 20; }

    // Factor 10: Broken PTP count (+50 max)
    const brokenPtps = c.auditLog.filter(l => l.details.includes('broken') || l.details.includes('Broken')).length;
    if (brokenPtps >= 3) { score += 50; reasons.push(`${brokenPtps} broken PTPs — escalation needed`); }
    else if (brokenPtps >= 1) { score += 25; }

    // Factor 11: Follow-up due (+40)
    const nextFollowUp = c.history.find(h => h.nextFollowUp)?.nextFollowUp;
    if (nextFollowUp) {
        const fuDate = new Date(nextFollowUp);
        const fuDiff = Math.floor((fuDate.getTime() - now.getTime()) / 86400000);
        if (fuDiff === 0) { score += 40; reasons.push('Follow-up due today'); }
        else if (fuDiff === -1) { score += 30; reasons.push('Follow-up overdue'); }
    }

    // Factor 12: Multiple accounts (+30)
    const sameDebtor = allCases.filter(ac => ac.debtor.id === c.debtor.id);
    if (sameDebtor.length > 1) { score += 30; reasons.push(`${sameDebtor.length} accounts for this debtor`); }

    // Clamp score
    score = Math.max(0, Math.min(1000, score));

    // Determine urgency
    const urgency: PriorityScore['urgency'] = score >= 500 ? 'critical' : score >= 300 ? 'high' : score >= 150 ? 'medium' : 'low';

    // Suggest action
    let suggestedAction = 'Review case';
    if (ptpAction?.promisedDate && new Date(ptpAction.promisedDate) <= now) suggestedAction = 'Follow up on broken PTP';
    else if (daysSinceContact > 7) suggestedAction = 'Re-establish contact';
    else if (c.crmStatus === CRMStatus.NEW) suggestedAction = 'Make first contact';
    else if (c.crmStatus === CRMStatus.CB) suggestedAction = 'Call back as requested';
    else if (c.crmStatus === CRMStatus.PTP) suggestedAction = 'Confirm payment received';
    else if (dpd > 150) suggestedAction = 'Consider legal escalation';

    return { caseId: c.id, score, urgency, reasons: reasons.slice(0, 3), suggestedAction };
}

export function rankCasesByPriority(cases: EnrichedCase[], allCases: EnrichedCase[]): (EnrichedCase & { priority: PriorityScore })[] {
    return cases
        .map(c => ({ ...c, priority: calculateCasePriority(c, allCases) }))
        .sort((a, b) => b.priority.score - a.priority.score);
}


// ═══════════════════════════════════════════════════════
// ENGINE 2: Auto-Remark Generator
// Context-aware remark templates — zero typing needed
// ═══════════════════════════════════════════════════════

interface GeneratedRemark {
    text: string;
    category: 'contact' | 'payment' | 'escalation' | 'trace' | 'general';
}

export function generateAutoRemark(c: EnrichedCase, status: CRMStatus, subStatus: SubStatus, contactStatus: string): GeneratedRemark {
    const name = c.debtor.name.split(' ')[0];
    const attempts = c.history.filter(h => h.type === ActionType.SOFT_CALL).length;
    const balance = c.loan.currentBalance;
    const currency = c.loan.currency;
    const dpd = c.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;
    const phone = c.debtor.phones?.[0] || 'N/A';

    // Non-contact scenarios
    if (contactStatus === 'Non Contact') {
        if (subStatus === SubStatus.RNR) {
            return { text: `Attempted contact on ${phone}. Ring no response. Attempt #${attempts + 1}. ${attempts >= 5 ? 'Multiple failed attempts — recommend tracing.' : 'Will retry next business day.'}`, category: 'contact' };
        }
        if (subStatus === SubStatus.SWITCHED_OFF) {
            return { text: `Called ${phone} — phone switched off. Attempt #${attempts + 1}. ${attempts >= 3 ? 'Number may be inactive. Tracing required for alternate contact.' : 'Will retry later today.'}`, category: 'contact' };
        }
        if (subStatus === SubStatus.NOT_CONNECTED) {
            return { text: `Number ${phone} not connected / out of service. Attempt #${attempts + 1}. Recommend skip tracing for new number.`, category: 'trace' };
        }
        if (subStatus === SubStatus.LEFT_MESSAGE) {
            return { text: `Left voicemail on ${phone} requesting call back. Reference: ${c.loan.accountNumber}. Attempt #${attempts + 1}.`, category: 'contact' };
        }
        return { text: `Unable to reach debtor ${name}. ${phone}. Attempt #${attempts + 1}. Will retry.`, category: 'contact' };
    }

    // Contact scenarios
    if (status === CRMStatus.CB) {
        return { text: `Spoke with ${name}. Debtor requested call back. Aware of outstanding ${currency} ${balance.toLocaleString()}. Will follow up as scheduled.`, category: 'contact' };
    }
    if (status === CRMStatus.PTP) {
        return { text: `Spoke with ${name}. Debtor agreed to make payment. Promise to pay recorded. DPD: ${dpd}. Outstanding: ${currency} ${balance.toLocaleString()}.`, category: 'payment' };
    }
    if (status === CRMStatus.RTP) {
        if (subStatus === SubStatus.REFUSE_TO_PAY) {
            return { text: `Spoke with ${name}. Debtor refused to pay. Claims inability/unwillingness. DPD: ${dpd}. Balance: ${currency} ${balance.toLocaleString()}. ${dpd > 90 ? 'Recommend escalation to legal.' : 'Will attempt negotiation on next contact.'}`, category: 'escalation' };
        }
        return { text: `Spoke with ${name}. Debtor not willing to cooperate. Outstanding: ${currency} ${balance.toLocaleString()}.`, category: 'escalation' };
    }
    if (status === CRMStatus.DISPUTE) {
        return { text: `Spoke with ${name}. Debtor disputes the outstanding amount of ${currency} ${balance.toLocaleString()}. Dispute logged. Investigation required per CBUAE guidelines.`, category: 'general' };
    }
    if (status === CRMStatus.UTR) {
        return { text: `Case under tracing. Previous contact attempts: ${attempts}. All known numbers non-responsive. Skip tracing initiated for alternate contact details.`, category: 'trace' };
    }
    if (status === CRMStatus.NIP) {
        return { text: `No intention/interest to pay. Debtor ${name} has been unresponsive after ${attempts} attempts. DPD: ${dpd}. ${dpd > 120 ? 'Recommend legal proceedings.' : 'Continue periodic contact attempts.'}`, category: 'escalation' };
    }

    return { text: `Status updated to ${status}/${subStatus}. Debtor: ${name}. Account: ${c.loan.accountNumber}. Balance: ${currency} ${balance.toLocaleString()}.`, category: 'general' };
}


// ═══════════════════════════════════════════════════════
// ENGINE 3: Duplicate Debtor Detection
// Fuzzy matching using Levenshtein distance + field comparison
// ═══════════════════════════════════════════════════════

interface DuplicateMatch {
    caseId: string;
    debtorName: string;
    accountNumber: string;
    matchScore: number;     // 0-100
    matchedFields: string[];
}

function levenshteinDistance(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function nameSimilarity(a: string, b: string): number {
    const al = a.toLowerCase().trim();
    const bl = b.toLowerCase().trim();
    if (al === bl) return 100;
    const maxLen = Math.max(al.length, bl.length);
    if (maxLen === 0) return 0;
    const dist = levenshteinDistance(al, bl);
    return Math.max(0, Math.round((1 - dist / maxLen) * 100));
}

function phonesOverlap(phones1: string[], phones2: string[]): boolean {
    const clean = (p: string) => p.replace(/\D/g, '').slice(-9); // Last 9 digits
    const set1 = new Set(phones1.filter(Boolean).map(clean));
    return phones2.filter(Boolean).some(p => set1.has(clean(p)));
}

export function findDuplicates(targetCase: EnrichedCase, allCases: EnrichedCase[]): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (const c of allCases) {
        if (c.id === targetCase.id) continue;
        let score = 0;
        const matchedFields: string[] = [];

        // Exact field matches (high confidence)
        if (targetCase.debtor.eid && c.debtor.eid && targetCase.debtor.eid === c.debtor.eid) {
            score += 40; matchedFields.push('Emirates ID');
        }
        if (targetCase.debtor.cnic && c.debtor.cnic && targetCase.debtor.cnic === c.debtor.cnic) {
            score += 40; matchedFields.push('CNIC');
        }
        if (targetCase.debtor.passport && c.debtor.passport && targetCase.debtor.passport.toLowerCase() === c.debtor.passport.toLowerCase()) {
            score += 35; matchedFields.push('Passport');
        }

        // Phone overlap
        if (phonesOverlap(targetCase.debtor.phones || [], c.debtor.phones || [])) {
            score += 25; matchedFields.push('Phone number');
        }

        // Name similarity
        const nameScore = nameSimilarity(targetCase.debtor.name, c.debtor.name);
        if (nameScore >= 85) { score += 20; matchedFields.push(`Name (${nameScore}% match)`); }
        else if (nameScore >= 70) { score += 10; matchedFields.push(`Name (${nameScore}% similar)`); }

        // Email overlap
        const emails1 = new Set((targetCase.debtor.emails || []).map(e => e.toLowerCase()));
        const emailMatch = (c.debtor.emails || []).some(e => emails1.has(e.toLowerCase()));
        if (emailMatch) { score += 15; matchedFields.push('Email'); }

        if (score >= 30) {
            matches.push({
                caseId: c.id,
                debtorName: c.debtor.name,
                accountNumber: c.loan.accountNumber,
                matchScore: Math.min(100, score),
                matchedFields,
            });
        }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
}


// ═══════════════════════════════════════════════════════
// ENGINE 4: Portfolio Health Score
// Single 0-100 index for the entire portfolio
// ═══════════════════════════════════════════════════════

export interface PortfolioHealth {
    score: number;              // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    trend: 'improving' | 'stable' | 'declining';
    components: {
        collectionRate: { value: number; score: number; weight: number };
        contactRate: { value: number; score: number; weight: number };
        ptpFulfillment: { value: number; score: number; weight: number };
        agingHealth: { value: number; score: number; weight: number };
        officerProductivity: { value: number; score: number; weight: number };
        caseVelocity: { value: number; score: number; weight: number };
    };
    insights: string[];
}

export function calculatePortfolioHealth(cases: EnrichedCase[], users: User[]): PortfolioHealth {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12`
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const activeCases = cases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
    const allHistory = cases.flatMap(c => c.history);
    const thisMonthHistory = allHistory.filter(h => (h.attributionDate || h.timestamp).startsWith(thisMonth));
    const lastMonthHistory = allHistory.filter(h => (h.attributionDate || h.timestamp).startsWith(lastMonth));

    // 1. Collection Rate (weight: 30%) — % of total outstanding collected this month
    const totalOutstanding = activeCases.reduce((s, c) => s + c.loan.currentBalance, 0);
    const monthlyCollected = thisMonthHistory.filter(h => h.amountPaid).reduce((s, h) => s + (h.amountPaid || 0), 0);
    const collectionRateValue = totalOutstanding > 0 ? (monthlyCollected / totalOutstanding) * 100 : 0;
    const collectionRateScore = Math.min(100, collectionRateValue * 10); // 10% collection = 100 score

    // 2. Contact Rate (weight: 20%) — % of cases contacted this month
    const casesContactedThisMonth = new Set(thisMonthHistory.map(h => h.caseId)).size;
    const contactRateValue = activeCases.length > 0 ? (casesContactedThisMonth / activeCases.length) * 100 : 0;
    const contactRateScore = Math.min(100, contactRateValue);

    // 3. PTP Fulfillment (weight: 20%) — % of PTPs that resulted in payment
    const ptpCases = cases.filter(c => c.history.some(h => h.promisedDate));
    const ptpPaidCases = ptpCases.filter(c => c.history.some(h => h.type === ActionType.PAYMENT_RECEIVED));
    const ptpFulfillmentValue = ptpCases.length > 0 ? (ptpPaidCases.length / ptpCases.length) * 100 : 50;
    const ptpFulfillmentScore = Math.min(100, ptpFulfillmentValue);

    // 4. Aging Health (weight: 15%) — lower avg DPD = better
    const avgDPD = activeCases.reduce((s, c) => {
        const lpd = c.loan.lpd ? new Date(c.loan.lpd) : null;
        return s + (lpd ? Math.max(0, Math.floor((now.getTime() - lpd.getTime()) / 86400000)) : 0);
    }, 0) / Math.max(1, activeCases.length);
    const agingHealthValue = Math.max(0, 100 - avgDPD / 2); // 200 DPD avg = 0 score
    const agingHealthScore = Math.min(100, agingHealthValue);

    // 5. Officer Productivity (weight: 10%) — avg actions per officer per day
    const officers = users.filter(u => u.role === Role.OFFICER);
    const daysInMonth = now.getDate();
    const actionsPerOfficerPerDay = officers.length > 0 && daysInMonth > 0
        ? thisMonthHistory.length / officers.length / daysInMonth : 0;
    const productivityValue = Math.min(100, actionsPerOfficerPerDay * 5); // 20 actions/day = 100
    const productivityScore = productivityValue;

    // 6. Case Velocity (weight: 5%) — cases closed this month / total cases
    const closedThisMonth = cases.filter(c => c.crmStatus === CRMStatus.CLOSED && c.history.some(h => h.timestamp.startsWith(thisMonth))).length;
    const velocityValue = activeCases.length > 0 ? (closedThisMonth / activeCases.length) * 100 : 0;
    const velocityScore = Math.min(100, velocityValue * 10);

    // Weighted composite
    const score = Math.round(
        collectionRateScore * 0.30 +
        contactRateScore * 0.20 +
        ptpFulfillmentScore * 0.20 +
        agingHealthScore * 0.15 +
        productivityScore * 0.10 +
        velocityScore * 0.05
    );

    // Grade
    const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';

    // Trend (compare with last month)
    const lastMonthCollected = lastMonthHistory.filter(h => h.amountPaid).reduce((s, h) => s + (h.amountPaid || 0), 0);
    const trend = monthlyCollected > lastMonthCollected * 1.05 ? 'improving' : monthlyCollected < lastMonthCollected * 0.95 ? 'declining' : 'stable';

    // Insights
    const insights: string[] = [];
    if (collectionRateScore < 50) insights.push('Collection rate is below target — focus on PTP conversions');
    if (contactRateScore < 60) insights.push(`Only ${contactRateValue.toFixed(0)}% of cases contacted this month — increase outreach`);
    if (ptpFulfillmentScore < 40) insights.push('PTP fulfillment is low — consider stricter follow-up on promises');
    if (avgDPD > 120) insights.push(`Average DPD is ${avgDPD.toFixed(0)} — aging portfolio needs aggressive action`);
    if (actionsPerOfficerPerDay < 10) insights.push('Officer productivity below benchmark — consider workload review');
    if (insights.length === 0) insights.push('Portfolio performing within healthy parameters');

    return {
        score,
        grade,
        trend,
        components: {
            collectionRate: { value: collectionRateValue, score: collectionRateScore, weight: 30 },
            contactRate: { value: contactRateValue, score: contactRateScore, weight: 20 },
            ptpFulfillment: { value: ptpFulfillmentValue, score: ptpFulfillmentScore, weight: 20 },
            agingHealth: { value: agingHealthValue, score: agingHealthScore, weight: 15 },
            officerProductivity: { value: actionsPerOfficerPerDay, score: productivityScore, weight: 10 },
            caseVelocity: { value: velocityValue, score: velocityScore, weight: 5 },
        },
        insights,
    };
}


// ═══════════════════════════════════════════════════════
// ENGINE 5: Settlement Amount Predictor
// Statistical model based on similar case outcomes
// ═══════════════════════════════════════════════════════

export interface SettlementPrediction {
    suggestedOpeningOffer: number;   // % of balance
    suggestedFloor: number;          // % — don't go below this
    expectedAcceptance: number;      // % — probability debtor accepts
    similarCasesCount: number;
    avgSettlementPercent: number;     // What similar cases settled at
    reasoning: string;
    negotiationTips: string[];
}

export function predictSettlement(targetCase: EnrichedCase, allCases: EnrichedCase[]): SettlementPrediction {
    const balance = targetCase.loan.currentBalance;
    const product = targetCase.loan.product;
    const bank = targetCase.loan.bank;
    const dpd = targetCase.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(targetCase.loan.lpd).getTime()) / 86400000)) : 0;

    // Find similar cases (same product type, similar balance range, closed/settled)
    const closedCases = allCases.filter(c =>
        c.id !== targetCase.id &&
        (c.crmStatus === CRMStatus.CLOSED) &&
        c.history.some(h => h.type === ActionType.PAYMENT_RECEIVED)
    );

    // Score similarity
    const similarCases = closedCases.map(c => {
        let similarity = 0;
        if (c.loan.product === product) similarity += 30;
        if (c.loan.bank === bank) similarity += 20;
        const balanceRatio = Math.min(c.loan.currentBalance, balance) / Math.max(c.loan.currentBalance, balance);
        similarity += balanceRatio * 30;
        const cDpd = c.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;
        const dpdDiff = Math.abs(dpd - cDpd);
        similarity += Math.max(0, 20 - dpdDiff / 5);
        return { case: c, similarity };
    }).filter(s => s.similarity >= 40).sort((a, b) => b.similarity - a.similarity).slice(0, 20);

    // Calculate avg settlement %
    let avgSettlement = 70; // Default if no data
    if (similarCases.length > 0) {
        const settlements = similarCases.map(s => {
            const totalPaid = s.case.history
                .filter(h => h.type === ActionType.PAYMENT_RECEIVED && h.amountPaid)
                .reduce((sum, h) => sum + (h.amountPaid || 0), 0);
            return (totalPaid / s.case.loan.originalAmount) * 100;
        });
        avgSettlement = settlements.reduce((a, b) => a + b, 0) / settlements.length;
    }

    // Adjust based on DPD
    let dpdAdjustment = 0;
    if (dpd > 180) dpdAdjustment = -15; // Very old debt — debtor has more leverage
    else if (dpd > 90) dpdAdjustment = -8;
    else if (dpd < 30) dpdAdjustment = 5; // Fresh debt — less discount needed

    // Adjust based on contact history
    const contactSuccess = targetCase.history.filter(h => h.type === ActionType.SOFT_CALL).length;
    const contactAdjust = contactSuccess > 10 ? -5 : contactSuccess < 3 ? 3 : 0;

    const adjustedSettlement = Math.max(30, Math.min(95, avgSettlement + dpdAdjustment + contactAdjust));

    // Opening offer should be higher than floor
    const suggestedFloor = Math.max(25, adjustedSettlement - 10);
    const suggestedOpening = Math.min(95, adjustedSettlement + 10);

    // Expected acceptance probability
    const expectedAcceptance = adjustedSettlement <= 50 ? 75 : adjustedSettlement <= 70 ? 60 : 40;

    // Reasoning
    let reasoning = '';
    if (similarCases.length >= 5) {
        reasoning = `Based on ${similarCases.length} similar ${product} cases at ${bank}, average settlement was ${avgSettlement.toFixed(0)}% of balance.`;
    } else if (similarCases.length > 0) {
        reasoning = `Limited data (${similarCases.length} similar cases). Estimate based on available patterns.`;
    } else {
        reasoning = 'No similar historical cases found. Using default recovery model.';
    }

    if (dpd > 180) reasoning += ` High DPD (${dpd}) suggests debtor has leverage — be flexible.`;
    if (dpd < 60) reasoning += ` Fresh debt (${dpd} DPD) — push for higher recovery.`;

    // Tips
    const tips: string[] = [];
    if (dpd > 120) tips.push('Offer a time-limited settlement to create urgency');
    if (balance > 50000) tips.push('Consider installment plan if lump sum is rejected');
    if (contactSuccess > 5 && targetCase.crmStatus === CRMStatus.RTP) tips.push('Debtor is engaged but refusing — try different negotiator');
    tips.push(`Open at ${suggestedOpening.toFixed(0)}%, concede gradually to ${suggestedFloor.toFixed(0)}%`);
    if (targetCase.debtor.phones?.length > 1) tips.push('Try alternate phone number for fresh approach');

    return {
        suggestedOpeningOffer: suggestedOpening,
        suggestedFloor,
        expectedAcceptance,
        similarCasesCount: similarCases.length,
        avgSettlementPercent: avgSettlement,
        reasoning,
        negotiationTips: tips,
    };
}


// ═══════════════════════════════════════════════════════
// ENGINE 6: Smart Call Scheduler
// Determines best time to call each debtor
// ═══════════════════════════════════════════════════════

export interface CallSchedule {
    bestTimeSlot: string;     // e.g., "6:00 PM - 8:00 PM"
    bestDay: string;          // e.g., "Sunday-Thursday"
    confidence: number;       // 0-100
    reasoning: string;
    avoidTimes: string[];
}

export function suggestBestCallTime(c: EnrichedCase): CallSchedule {
    const successfulContacts = c.history.filter(h =>
        h.type === ActionType.SOFT_CALL && c.contactStatus === 'Contact'
    );
    const failedContacts = c.history.filter(h =>
        h.type === ActionType.SOFT_CALL && c.contactStatus === 'Non Contact'
    );

    // Analyze successful contact hours
    const hourBuckets: Record<string, number> = {};
    successfulContacts.forEach(h => {
        const hour = new Date(h.timestamp).getHours();
        const slot = hour < 12 ? 'Morning (9-12)' : hour < 15 ? 'Afternoon (12-3)' : hour < 18 ? 'Late Afternoon (3-6)' : 'Evening (6-9)';
        hourBuckets[slot] = (hourBuckets[slot] || 0) + 1;
    });

    // Find best slot
    const sortedSlots = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1]);
    const bestSlot = sortedSlots[0]?.[0] || 'Evening (6-9)';
    const confidence = successfulContacts.length >= 3 ? 80 : successfulContacts.length >= 1 ? 50 : 20;

    // Avoid times from failed attempts
    const failedHours: Record<string, number> = {};
    failedContacts.forEach(h => {
        const hour = new Date(h.timestamp).getHours();
        const slot = hour < 12 ? 'Morning' : hour < 15 ? 'Afternoon' : hour < 18 ? 'Late Afternoon' : 'Evening';
        failedHours[slot] = (failedHours[slot] || 0) + 1;
    });
    const avoidTimes = Object.entries(failedHours).filter(([_, count]) => count >= 3).map(([slot]) => slot);

    const reasoning = successfulContacts.length > 0
        ? `Based on ${successfulContacts.length} successful contacts. Best response during ${bestSlot}.`
        : 'No contact history — using Gulf market defaults (evenings work best for employed debtors).';

    return { bestTimeSlot: bestSlot, bestDay: 'Sunday-Thursday', confidence, reasoning, avoidTimes };
}


// ═══════════════════════════════════════════════════════
// ENGINE 7: Payment Likelihood Scorer
// Predicts if a PTP will actually result in payment
// ═══════════════════════════════════════════════════════

export interface PaymentLikelihood {
    probability: number;      // 0-100%
    risk: 'high' | 'medium' | 'low';
    factors: { name: string; impact: 'positive' | 'negative'; detail: string }[];
    recommendation: string;
}

export function predictPaymentLikelihood(c: EnrichedCase): PaymentLikelihood {
    let score = 50; // Start neutral
    const factors: PaymentLikelihood['factors'] = [];

    // Factor 1: History of honoring PTPs
    const ptpEvents = c.auditLog.filter(l => l.details.includes('PTP'));
    const payments = c.history.filter(h => h.type === ActionType.PAYMENT_RECEIVED);
    if (ptpEvents.length > 0 && payments.length > 0) {
        const fulfillRate = (payments.length / ptpEvents.length) * 100;
        if (fulfillRate >= 50) { score += 25; factors.push({ name: 'PTP History', impact: 'positive', detail: `${fulfillRate.toFixed(0)}% of past PTPs honored` }); }
        else { score -= 20; factors.push({ name: 'PTP History', impact: 'negative', detail: `Only ${fulfillRate.toFixed(0)}% of PTPs honored` }); }
    }

    // Factor 2: Previous payments exist
    if (payments.length > 0) {
        score += 20;
        factors.push({ name: 'Payment History', impact: 'positive', detail: `${payments.length} previous payment(s) made` });
    } else {
        score -= 10;
        factors.push({ name: 'No Payments', impact: 'negative', detail: 'No payment history on record' });
    }

    // Factor 3: Contact quality
    if (c.contactStatus === 'Contact') {
        score += 15;
        factors.push({ name: 'Contactable', impact: 'positive', detail: 'Debtor is responsive to calls' });
    } else {
        score -= 15;
        factors.push({ name: 'Non-Contact', impact: 'negative', detail: 'Debtor not currently contactable' });
    }

    // Factor 4: DPD — fresh debts pay more often
    const dpd = c.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;
    if (dpd < 60) { score += 10; factors.push({ name: 'Fresh Debt', impact: 'positive', detail: `DPD: ${dpd} — early stage` }); }
    else if (dpd > 180) { score -= 15; factors.push({ name: 'Aged Debt', impact: 'negative', detail: `DPD: ${dpd} — significantly overdue` }); }

    // Factor 5: Balance size — smaller balances more likely to be paid
    if (c.loan.currentBalance < 10000) { score += 10; factors.push({ name: 'Small Balance', impact: 'positive', detail: 'Low amount — affordable' }); }
    else if (c.loan.currentBalance > 100000) { score -= 10; factors.push({ name: 'Large Balance', impact: 'negative', detail: 'High amount — may need installments' }); }

    score = Math.max(5, Math.min(95, score));
    const risk: PaymentLikelihood['risk'] = score >= 65 ? 'low' : score >= 40 ? 'medium' : 'high';
    const recommendation = score >= 65 ? 'High likelihood — monitor and confirm receipt'
        : score >= 40 ? 'Moderate — follow up day before PTP date'
        : 'Low likelihood — prepare escalation plan and alternate contact';

    return { probability: score, risk, factors, recommendation };
}


// ═══════════════════════════════════════════════════════
// ENGINE 8: Debtor Behavior Profiler
// Classifies debtors into 5 behavioral types
// ═══════════════════════════════════════════════════════

export type DebtorProfile = 'Cooperator' | 'Avoider' | 'Negotiator' | 'Promiser' | 'Genuine Hardship';

export interface BehaviorProfile {
    type: DebtorProfile;
    confidence: number;
    description: string;
    suggestedStrategy: string;
    traits: string[];
}

export function profileDebtor(c: EnrichedCase): BehaviorProfile {
    const payments = c.history.filter(h => h.type === ActionType.PAYMENT_RECEIVED);
    const calls = c.history.filter(h => h.type === ActionType.SOFT_CALL);
    const ptpEvents = c.auditLog.filter(l => l.details.includes('PTP'));
    const brokenPtps = c.auditLog.filter(l => l.details.toLowerCase().includes('broken'));
    const isContactable = c.contactStatus === 'Contact';
    const hasDisputed = c.crmStatus === CRMStatus.DISPUTE;

    // Scoring for each profile
    let cooperator = 0, avoider = 0, negotiator = 0, promiser = 0, hardship = 0;

    // Cooperator: responds, makes payments
    if (isContactable) cooperator += 30;
    if (payments.length > 0) cooperator += 40;
    if (brokenPtps.length === 0 && ptpEvents.length > 0) cooperator += 30;

    // Avoider: doesn't answer, switches off
    if (!isContactable) avoider += 40;
    if (calls.length > 5 && payments.length === 0) avoider += 30;
    if (c.crmStatus === CRMStatus.NCC || c.crmStatus === CRMStatus.UTR) avoider += 30;

    // Negotiator: contacts but always wants discount
    if (isContactable && hasDisputed) negotiator += 40;
    if (isContactable && payments.length === 0 && calls.length > 3) negotiator += 30;
    if (c.crmStatus === CRMStatus.UNDER_NEGO) negotiator += 30;

    // Promiser: makes PTPs but doesn't pay
    if (ptpEvents.length >= 2 && brokenPtps.length >= 2) promiser += 50;
    if (ptpEvents.length > 0 && payments.length === 0) promiser += 30;
    if (c.crmStatus === CRMStatus.PTP && brokenPtps.length > 0) promiser += 20;

    // Genuine Hardship: contactable, willing, but unable
    if (isContactable && payments.length > 0 && c.loan.currentBalance > 50000) hardship += 30;
    if (isContactable && c.crmStatus === CRMStatus.RTP) hardship += 25;
    const hasSmallPayments = payments.some(p => p.amountPaid && p.amountPaid < c.loan.currentBalance * 0.05);
    if (hasSmallPayments) hardship += 25;

    const profiles: { type: DebtorProfile; score: number }[] = [
        { type: 'Cooperator', score: cooperator },
        { type: 'Avoider', score: avoider },
        { type: 'Negotiator', score: negotiator },
        { type: 'Promiser', score: promiser },
        { type: 'Genuine Hardship', score: hardship },
    ];
    const best = profiles.sort((a, b) => b.score - a.score)[0];

    const descriptions: Record<DebtorProfile, { desc: string; strategy: string; traits: string[] }> = {
        'Cooperator': { desc: 'Responds to calls and makes payments when able', strategy: 'Maintain relationship. Offer flexible payment plans. Positive reinforcement.', traits: ['Responsive', 'Has payment history', 'Honors commitments'] },
        'Avoider': { desc: 'Avoids all contact — phones off, doesn\'t respond', strategy: 'Intensify tracing. Try alternate channels (SMS/WhatsApp/employer). Consider field visit.', traits: ['Non-contactable', 'Ignores calls', 'May have absconded'] },
        'Negotiator': { desc: 'Always engages but pushes for maximum discounts', strategy: 'Set firm boundaries. Start high. Make small concessions. Time-limited offers.', traits: ['Contactable', 'Disputes amounts', 'Stalls for better terms'] },
        'Promiser': { desc: 'Makes promises but rarely follows through', strategy: 'Short PTP windows (3-5 days max). Require partial upfront. Escalate after 2nd broken PTP.', traits: ['Makes PTPs', 'Breaks promises', 'Unreliable'] },
        'Genuine Hardship': { desc: 'Willing to pay but facing real financial difficulty', strategy: 'Offer affordable installments. Consider settlement at reduced amount. Show empathy.', traits: ['Cooperative', 'Small/partial payments', 'Financial stress signals'] },
    };

    const info = descriptions[best.type];
    return {
        type: best.type,
        confidence: Math.min(95, best.score),
        description: info.desc,
        suggestedStrategy: info.strategy,
        traits: info.traits,
    };
}


// ═══════════════════════════════════════════════════════
// ENGINE 9: Write-Off Risk Predictor
// Predicts probability of case reaching write-off
// ═══════════════════════════════════════════════════════

export interface WriteOffRisk {
    probability: number;       // 0-100%
    daysToWriteOff: number | null;
    riskLevel: 'critical' | 'high' | 'moderate' | 'low';
    recommendation: string;
}

export function predictWriteOffRisk(c: EnrichedCase): WriteOffRisk {
    let risk = 30; // Base risk
    const now = Date.now();
    const dpd = c.loan.lpd ? Math.max(0, Math.floor((now - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;
    const daysToWO = c.loan.wod ? Math.floor((new Date(c.loan.wod).getTime() - now) / 86400000) : null;

    // DPD factor
    if (dpd > 180) risk += 30;
    else if (dpd > 120) risk += 20;
    else if (dpd > 60) risk += 10;

    // No payment = higher risk
    const hasPayment = c.history.some(h => h.type === ActionType.PAYMENT_RECEIVED);
    if (!hasPayment) risk += 20;
    else risk -= 15;

    // Non-contactable = higher risk
    if (c.contactStatus === 'Non Contact') risk += 15;

    // Write-off proximity
    if (daysToWO !== null && daysToWO <= 30) risk += 20;
    else if (daysToWO !== null && daysToWO <= 60) risk += 10;

    risk = Math.max(5, Math.min(95, risk));
    const riskLevel = risk >= 75 ? 'critical' : risk >= 55 ? 'high' : risk >= 35 ? 'moderate' : 'low';

    let recommendation = 'Monitor standard recovery process';
    if (riskLevel === 'critical') recommendation = 'URGENT: Escalate to legal. Consider field visit. Last chance before write-off.';
    else if (riskLevel === 'high') recommendation = 'Prioritize this case. Intensify contact. Offer settlement.';
    else if (riskLevel === 'moderate') recommendation = 'Continue regular follow-up. Consider settlement offer.';

    return { probability: risk, daysToWriteOff: daysToWO, riskLevel, recommendation };
}


// ═══════════════════════════════════════════════════════
// ENGINE 10: Officer Performance AI
// Analyzes strengths and weaknesses per officer
// ═══════════════════════════════════════════════════════

export interface OfficerPerformanceAI {
    officerId: string;
    officerName: string;
    overallScore: number;       // 0-100
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
    metrics: {
        contactRate: number;
        ptpConversion: number;
        collectionPerCase: number;
        avgActionsPerDay: number;
        caseClosureRate: number;
    };
}

export function analyzeOfficerPerformance(officer: User, cases: EnrichedCase[]): OfficerPerformanceAI {
    const officerCases = cases.filter(c => c.assignedOfficerId === officer.id);
    const activeCases = officerCases.filter(c => c.crmStatus !== CRMStatus.CLOSED && c.crmStatus !== CRMStatus.WITHDRAWN);
    const closedCases = officerCases.filter(c => c.crmStatus === CRMStatus.CLOSED);
    const allHistory = officerCases.flatMap(c => c.history);
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthHistory = allHistory.filter(h => h.timestamp.startsWith(thisMonth));

    // Contact rate
    const contacted = officerCases.filter(c => c.contactStatus === 'Contact').length;
    const contactRate = officerCases.length > 0 ? (contacted / officerCases.length) * 100 : 0;

    // PTP conversion
    const ptpCases = officerCases.filter(c => c.auditLog.some(l => l.details.includes('PTP')));
    const ptpPaid = ptpCases.filter(c => c.history.some(h => h.type === ActionType.PAYMENT_RECEIVED));
    const ptpConversion = ptpCases.length > 0 ? (ptpPaid.length / ptpCases.length) * 100 : 0;

    // Collection per case
    const totalCollected = allHistory.filter(h => h.amountPaid).reduce((s, h) => s + (h.amountPaid || 0), 0);
    const collectionPerCase = officerCases.length > 0 ? totalCollected / officerCases.length : 0;

    // Actions per day
    const daysInMonth = now.getDate();
    const avgActionsPerDay = daysInMonth > 0 ? monthHistory.length / daysInMonth : 0;

    // Closure rate
    const caseClosureRate = officerCases.length > 0 ? (closedCases.length / officerCases.length) * 100 : 0;

    // Score
    const score = Math.min(100, Math.round(
        contactRate * 0.25 + ptpConversion * 0.25 + Math.min(100, collectionPerCase / 100) * 0.25 + Math.min(100, avgActionsPerDay * 5) * 0.15 + caseClosureRate * 0.10
    ));

    // Strengths & weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (contactRate >= 60) strengths.push(`Strong contact rate: ${contactRate.toFixed(0)}%`);
    else weaknesses.push(`Low contact rate: ${contactRate.toFixed(0)}% — needs more outreach`);

    if (ptpConversion >= 50) strengths.push(`Good PTP conversion: ${ptpConversion.toFixed(0)}%`);
    else if (ptpCases.length > 0) weaknesses.push(`Low PTP fulfillment: ${ptpConversion.toFixed(0)}% — follow up more aggressively`);

    if (avgActionsPerDay >= 15) strengths.push(`High activity: ${avgActionsPerDay.toFixed(0)} actions/day`);
    else weaknesses.push(`Low activity: ${avgActionsPerDay.toFixed(0)} actions/day — below 15/day target`);

    if (caseClosureRate >= 10) strengths.push(`Good closure rate: ${caseClosureRate.toFixed(0)}%`);

    let recommendation = 'Performing within expectations';
    if (score < 40) recommendation = 'Needs immediate coaching. Focus on contact rate and daily activity volume.';
    else if (score < 60) recommendation = 'Average performance. Suggest negotiation training to improve PTP conversion.';
    else if (score >= 80) recommendation = 'Top performer. Consider for mentoring role or high-value cases.';

    return {
        officerId: officer.id,
        officerName: officer.name,
        overallScore: score,
        strengths,
        weaknesses,
        recommendation,
        metrics: { contactRate, ptpConversion, collectionPerCase, avgActionsPerDay, caseClosureRate },
    };
}


// ═══════════════════════════════════════════════════════
// ENGINE 11: Contact Channel Optimizer
// Suggests best communication channel per debtor
// ═══════════════════════════════════════════════════════

export interface ChannelRecommendation {
    primaryChannel: 'call' | 'sms' | 'whatsapp' | 'email' | 'field_visit';
    confidence: number;
    reasoning: string;
    channelScores: { channel: string; score: number; reason: string }[];
}

export function suggestBestChannel(c: EnrichedCase): ChannelRecommendation {
    const calls = c.history.filter(h => h.type === ActionType.SOFT_CALL);
    const emails = c.history.filter(h => h.type === ActionType.EMAIL_NOTICE);
    const isContactable = c.contactStatus === 'Contact';
    const attempts = calls.length;
    const dpd = c.loan.lpd ? Math.max(0, Math.floor((Date.now() - new Date(c.loan.lpd).getTime()) / 86400000)) : 0;

    const scores: { channel: 'call' | 'sms' | 'whatsapp' | 'email' | 'field_visit'; score: number; reason: string }[] = [];

    // Call score
    let callScore = 50;
    if (isContactable) callScore += 30;
    if (attempts < 3) callScore += 10;
    if (attempts > 10 && !isContactable) callScore -= 30;
    scores.push({ channel: 'call', score: callScore, reason: isContactable ? 'Debtor answers calls' : 'Primary contact method' });

    // SMS score
    let smsScore = 40;
    if (!isContactable && attempts > 5) smsScore += 25;
    if (c.debtor.phones?.length > 0) smsScore += 10;
    scores.push({ channel: 'sms', score: smsScore, reason: !isContactable ? 'Debtor not answering — try SMS' : 'Good for reminders' });

    // WhatsApp score
    let waScore = 35;
    if (!isContactable && attempts > 3) waScore += 20;
    const age = c.debtor.dob ? Math.floor((Date.now() - new Date(c.debtor.dob).getTime()) / 31557600000) : 0;
    if (age > 0 && age < 40) waScore += 15;
    scores.push({ channel: 'whatsapp', score: waScore, reason: age < 40 ? 'Younger debtor — likely WhatsApp user' : 'Alternative digital channel' });

    // Email score
    let emailScore = 25;
    if (c.debtor.emails?.length > 0) emailScore += 15;
    if (dpd > 90) emailScore += 10;
    scores.push({ channel: 'email', score: emailScore, reason: 'Formal communication trail' });

    // Field visit score
    let fieldScore = 10;
    if (!isContactable && attempts > 10) fieldScore += 40;
    if (c.loan.currentBalance > 50000) fieldScore += 15;
    if (dpd > 120) fieldScore += 15;
    scores.push({ channel: 'field_visit', score: fieldScore, reason: attempts > 10 ? 'All remote channels exhausted' : 'For high-value cases' });

    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    return {
        primaryChannel: best.channel,
        confidence: Math.min(90, best.score),
        reasoning: best.reason,
        channelScores: scores.map(s => ({ channel: s.channel, score: s.score, reason: s.reason })),
    };
}
