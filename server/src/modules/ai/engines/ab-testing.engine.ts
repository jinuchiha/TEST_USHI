/**
 * A/B Testing Engine (Champion/Challenger)
 *
 * Split similar cases into groups, apply different strategies,
 * measure which yields higher recovery.
 */

export interface AbTest {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'draft';
  startDate: string;
  endDate: string | null;
  segmentCriteria: string;
  championStrategy: string;
  challengerStrategy: string;
  championCases: number;
  challengerCases: number;
  championRecovery: number;
  challengerRecovery: number;
  championRate: number;
  challengerRate: number;
  winner: 'champion' | 'challenger' | 'inconclusive' | null;
  confidence: number;
}

export function evaluateAbTest(test: {
  championCases: number;
  challengerCases: number;
  championRecovery: number;
  challengerRecovery: number;
  championBalance: number;
  challengerBalance: number;
}): { winner: 'champion' | 'challenger' | 'inconclusive'; confidence: number; lift: number } {
  const champRate = test.championBalance > 0 ? test.championRecovery / test.championBalance : 0;
  const challRate = test.challengerBalance > 0 ? test.challengerRecovery / test.challengerBalance : 0;
  const lift = champRate > 0 ? ((challRate - champRate) / champRate) * 100 : 0;

  // Simple statistical significance (would use proper chi-square in production)
  const totalCases = test.championCases + test.challengerCases;
  const minSample = 30;
  const diff = Math.abs(champRate - challRate);

  if (totalCases < minSample * 2) return { winner: 'inconclusive', confidence: 0, lift };
  if (diff < 0.02) return { winner: 'inconclusive', confidence: Math.round(diff * 1000), lift };

  const confidence = Math.min(99, Math.round(50 + diff * 500 + totalCases * 0.1));
  const winner = challRate > champRate ? 'challenger' : 'champion';

  return { winner, confidence, lift: Math.round(lift) };
}

export const SAMPLE_TESTS: AbTest[] = [
  {
    id: 'test-1', name: 'SMS vs Call for NCC Cases', status: 'active',
    startDate: '2026-03-01', endDate: null,
    segmentCriteria: 'CRM Status = NCC, Balance > 10,000 AED',
    championStrategy: 'Standard call sequence (3 calls/week)',
    challengerStrategy: 'SMS-first approach (2 SMS + 1 call/week)',
    championCases: 45, challengerCases: 42,
    championRecovery: 12500, challengerRecovery: 18200,
    championRate: 8, challengerRate: 12,
    winner: 'challenger', confidence: 78,
  },
  {
    id: 'test-2', name: 'Settlement Offer Timing', status: 'active',
    startDate: '2026-02-15', endDate: null,
    segmentCriteria: 'Balance 50K-200K, DPD > 180',
    championStrategy: 'Settlement offer after 3 contact attempts',
    challengerStrategy: 'Immediate settlement offer on first contact',
    championCases: 30, challengerCases: 28,
    championRecovery: 45000, challengerRecovery: 52000,
    championRate: 15, challengerRate: 19,
    winner: 'challenger', confidence: 65,
  },
];
