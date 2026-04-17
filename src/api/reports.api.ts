import { apiClient } from './client';

export const reportsApi = {
  getDailySummary(date?: string): Promise<any> {
    return apiClient.get('/api/reports/daily-summary', date ? { date } : undefined);
  },

  getOfficerPerformance(): Promise<any> {
    return apiClient.get('/api/reports/officer-performance');
  },

  getRecoveryFunnel(): Promise<any> {
    return apiClient.get('/api/reports/recovery-funnel');
  },

  getStatusMatrix(): Promise<any> {
    return apiClient.get('/api/reports/status-matrix');
  },

  getAnnualForecast(): Promise<any> {
    return apiClient.get('/api/reports/annual-forecast');
  },

  getBankBreakdown(): Promise<any> {
    return apiClient.get('/api/reports/bank-breakdown');
  },
};
