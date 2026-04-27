import { apiClient } from './client';

export interface AccessLogFilters {
  userId?: string;
  type?: 'login' | 'view' | 'export' | 'failed';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const accessLogApi = {
  getLogs(filters?: AccessLogFilters): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    return apiClient.get('/api/access-logs', filters as any);
  },
};
