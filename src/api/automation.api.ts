import { apiClient } from './client';

export const automationApi = {
  runAll(): Promise<{ data: any }> {
    return apiClient.post('/api/automation/run');
  },
  predictWithdrawals(): Promise<{ data: any[] }> {
    return apiClient.get('/api/automation/predict-withdrawals');
  },
  getRules(): Promise<{ data: any[] }> {
    return apiClient.get('/api/automation/rules');
  },
  createRule(dto: any): Promise<{ data: any }> {
    return apiClient.post('/api/automation/rules', dto);
  },
  updateRule(id: string, dto: any): Promise<{ data: any }> {
    return apiClient.put(`/api/automation/rules/${id}`, dto);
  },
  toggleRule(id: string): Promise<{ data: any }> {
    return apiClient.patch(`/api/automation/rules/${id}/toggle`);
  },
  runRule(id: string): Promise<{ data: any }> {
    return apiClient.post(`/api/automation/rules/${id}/run`);
  },
  deleteRule(id: string): Promise<{ message: string }> {
    return apiClient.delete(`/api/automation/rules/${id}`);
  },
};
