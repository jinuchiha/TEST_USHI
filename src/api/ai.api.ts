import { apiClient } from './client';

export interface RecoveryScore {
  score: number;
  confidence: 'High' | 'Medium' | 'Low';
  riskLevel: 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
  factors: Array<{
    name: string;
    weight: number;
    rawScore: number;
    weightedScore: number;
    impact: 'positive' | 'negative' | 'neutral';
    detail: string;
  }>;
  recommendation: string;
  predictedRecoveryDays: number | null;
}

export interface AllocationSuggestion {
  officerId: string;
  officerName: string;
  score: number;
  reasons: string[];
  currentLoad: number;
  capacityPct: number;
}

export interface FraudAssessment {
  overallRisk: 'Critical' | 'High' | 'Medium' | 'Low';
  riskScore: number;
  flags: Array<{
    severity: 'Critical' | 'Warning' | 'Info';
    type: string;
    message: string;
    score: number;
  }>;
  requiresManualReview: boolean;
}

export interface PortfolioInsights {
  totalExposure: number;
  predictedRecovery: number;
  highRiskCount: number;
  topOpportunities: Array<{ caseId: string; debtorName: string; score: number; balance: number }>;
  riskDistribution: { veryHigh: number; high: number; medium: number; low: number; veryLow: number };
}

export const aiApi = {
  getRecoveryScore(caseId: string): Promise<{ data: RecoveryScore }> {
    return apiClient.get(`/api/ai/recovery-score/${caseId}`);
  },

  getAllRecoveryScores(officerId?: string): Promise<{ data: any }> {
    return apiClient.get('/api/ai/recovery-scores', officerId ? { officerId } : undefined);
  },

  suggestOfficer(caseId: string): Promise<{ data: AllocationSuggestion[] }> {
    return apiClient.get(`/api/ai/suggest-officer/${caseId}`);
  },

  fraudCheck(debtorId: string): Promise<{ data: FraudAssessment }> {
    return apiClient.get(`/api/ai/fraud-check/${debtorId}`);
  },

  getPortfolioInsights(): Promise<{ data: PortfolioInsights }> {
    return apiClient.get('/api/ai/portfolio-insights');
  },

  getMyInsights(): Promise<{ data: any }> {
    return apiClient.get('/api/ai/my-insights');
  },
};
