import { apiClient } from './client';

export const productivityApi = {
  generateTasks(): Promise<{ data: any[] }> {
    return apiClient.post('/api/productivity/tasks/generate');
  },
  getMyTasks(status?: string): Promise<{ data: any[] }> {
    return apiClient.get('/api/productivity/tasks', { status });
  },
  updateTask(id: string, status: 'in_progress' | 'completed' | 'skipped'): Promise<{ data: any }> {
    return apiClient.patch(`/api/productivity/tasks/${id}/${status}`);
  },
  leaderboard(period: 'week' | 'month' | 'all' = 'month'): Promise<{ data: any[] }> {
    return apiClient.get('/api/productivity/leaderboard', { period });
  },
  myBadges(): Promise<{ data: any[] }> {
    return apiClient.get('/api/productivity/badges');
  },
  officerBadges(userId: string): Promise<{ data: any[] }> {
    return apiClient.get(`/api/productivity/badges/${userId}`);
  },
  performanceReview(officerId: string, year?: number, month?: number): Promise<{ data: any }> {
    return apiClient.get(`/api/productivity/review/${officerId}`, { year, month });
  },
};
