import { apiClient } from './client';

export const allocationsApi = {
  allocate(data: { recipientId: string; caseIds: string[]; type: string }): Promise<any> {
    return apiClient.post('/api/allocations', data);
  },

  getLog(params?: { page?: number; limit?: number }): Promise<any> {
    return apiClient.get('/api/allocations/log', params as any);
  },
};
