import { apiClient } from './client';

export const loansApi = {
  getAll(params?: { page?: number; limit?: number }): Promise<any> {
    return apiClient.get('/api/loans', params as any);
  },

  getById(id: string): Promise<any> {
    return apiClient.get(`/api/loans/${id}`);
  },

  create(data: any): Promise<any> {
    return apiClient.post('/api/loans', data);
  },

  update(id: string, data: any): Promise<any> {
    return apiClient.patch(`/api/loans/${id}`, data);
  },
};
