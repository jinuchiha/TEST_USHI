/**
 * Smart Allocation Engine
 *
 * Suggests the optimal officer for a case based on:
 * - Officer workload (current case count)
 * - Officer success rate (recovery rate)
 * - Case-officer compatibility (language, expertise)
 * - Target vs actual performance
 */

export interface OfficerProfile {
  id: string;
  name: string;
  agentCode: string | null;
  target: number | null;
  caseCount: number;
  totalCollected: number;
  recoveryRate: number;        // percentage
  avgDaysToResolve: number;
  activePtpCount: number;
}

export interface AllocationSuggestion {
  officerId: string;
  officerName: string;
  score: number;               // 0-100 suitability score
  reasons: string[];
  currentLoad: number;
  capacityPct: number;         // how full their plate is
}

const MAX_CASES_PER_OFFICER = 150;

export function suggestAllocation(
  officers: OfficerProfile[],
  caseBalance: number,
  caseCrmStatus: string,
): AllocationSuggestion[] {
  const suggestions: AllocationSuggestion[] = officers.map(officer => {
    let score = 50;
    const reasons: string[] = [];

    // 1. Workload balance (30 points max)
    const loadPct = officer.caseCount / MAX_CASES_PER_OFFICER;
    const loadScore = Math.max(0, 30 - Math.round(loadPct * 30));
    score += loadScore;
    if (loadPct < 0.5) reasons.push('Light workload — has capacity');
    else if (loadPct < 0.8) reasons.push('Moderate workload');
    else reasons.push('Heavy workload');

    // 2. Recovery rate (25 points max)
    const recoveryScore = Math.round((officer.recoveryRate / 100) * 25);
    score += recoveryScore;
    if (officer.recoveryRate >= 40) reasons.push(`Strong recovery rate: ${officer.recoveryRate.toFixed(0)}%`);
    else if (officer.recoveryRate >= 20) reasons.push(`Average recovery rate: ${officer.recoveryRate.toFixed(0)}%`);

    // 3. Target performance (15 points max)
    if (officer.target && officer.target > 0) {
      const targetPct = officer.totalCollected / officer.target;
      if (targetPct < 0.5) {
        score += 15; // Needs more cases to hit target
        reasons.push('Below target — needs more assignments');
      } else if (targetPct < 0.8) {
        score += 10;
      } else {
        score += 5;
        reasons.push('Near or above target');
      }
    }

    // 4. High-value case handling (10 points max)
    if (caseBalance > 100000) {
      if (officer.recoveryRate >= 35) {
        score += 10;
        reasons.push('Experienced with high-value cases');
      }
    }

    // 5. PTP specialty (if case is in negotiation stage)
    if (['PTP', 'UNDER NEGO', 'FIP'].includes(caseCrmStatus)) {
      if (officer.activePtpCount < 10) {
        score += 5;
        reasons.push('Has bandwidth for negotiation cases');
      }
    }

    const capacityPct = Math.round(loadPct * 100);

    return {
      officerId: officer.id,
      officerName: officer.name,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      currentLoad: officer.caseCount,
      capacityPct,
    };
  });

  return suggestions.sort((a, b) => b.score - a.score);
}
