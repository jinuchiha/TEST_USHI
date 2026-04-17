import { apiClient } from './client';

export const auditLogsApi = {
  getAll(params?: { page?: number; limit?: number }): Promise<any> {
    return apiClient.get('/api/audit-logs', params as any);
  },

  getByCaseId(caseId: string): Promise<any> {
    return apiClient.get(`/api/audit-logs/case/${caseId}`);
  },
};
