import { apiClient } from './client';

export const debtorsApi = {
  getAll(params?: { page?: number; limit?: number; search?: string }): Promise<any> {
    return apiClient.get('/api/debtors', params as any);
  },

  getById(id: string): Promise<any> {
    return apiClient.get(`/api/debtors/${id}`);
  },

  create(data: any): Promise<any> {
    return apiClient.post('/api/debtors', data);
  },

  update(id: string, data: any): Promise<any> {
    return apiClient.patch(`/api/debtors/${id}`, data);
  },

  addTracingLog(id: string, note: string): Promise<any> {
    return apiClient.post(`/api/debtors/${id}/tracing-logs`, { note });
  },
};
