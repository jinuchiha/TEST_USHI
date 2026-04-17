import { apiClient } from './client';
import { User } from '../../types';

export const usersApi = {
  getAll(role?: string): Promise<{ data: User[] }> {
    return apiClient.get('/api/users', role ? { role } : undefined);
  },

  getOfficers(): Promise<{ data: User[] }> {
    return apiClient.get('/api/users/officers');
  },

  getById(id: string): Promise<{ data: User }> {
    return apiClient.get(`/api/users/${id}`);
  },

  create(data: { name: string; email: string; password: string; role: string; agentCode?: string; target?: number; dailyTarget?: number }): Promise<{ data: User }> {
    return apiClient.post('/api/users', data);
  },

  update(id: string, data: Partial<User & { password?: string; isActive?: boolean }>): Promise<{ data: User }> {
    return apiClient.patch(`/api/users/${id}`, data);
  },

  deactivate(id: string): Promise<void> {
    return apiClient.delete(`/api/users/${id}`);
  },
};
