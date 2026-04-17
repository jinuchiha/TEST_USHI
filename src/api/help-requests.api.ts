import { apiClient } from './client';

export const helpRequestsApi = {
  getAll(): Promise<any> {
    return apiClient.get('/api/help-requests');
  },

  create(query: string): Promise<any> {
    return apiClient.post('/api/help-requests', { query });
  },

  reply(id: string, message: string): Promise<any> {
    return apiClient.post(`/api/help-requests/${id}/replies`, { message });
  },

  resolve(id: string): Promise<any> {
    return apiClient.patch(`/api/help-requests/${id}/resolve`);
  },
};
