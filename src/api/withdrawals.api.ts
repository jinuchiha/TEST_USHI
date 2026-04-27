import { apiClient } from './client';

export type WithdrawalReason =
  | 'paid_full'
  | 'settled'
  | 'bank_recall'
  | 'duplicate'
  | 'expired'
  | 'cyber'
  | 'death'
  | 'other';

export const withdrawalsApi = {
  bulkWithdraw(body: { caseIds: string[]; reason: WithdrawalReason; notes: string }): Promise<{ data: any }> {
    return apiClient.post('/api/withdrawals/bulk', body);
  },
  getHistory(filters?: { reason?: WithdrawalReason; dateFrom?: string; dateTo?: string }): Promise<{ data: any[] }> {
    return apiClient.get('/api/withdrawals/history', filters as any);
  },
  exportCsvUrl(): string {
    const base = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';
    return `${base}/api/withdrawals/export`;
  },
};
