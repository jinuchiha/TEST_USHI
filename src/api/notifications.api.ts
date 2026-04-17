import { apiClient } from './client';

export const notificationsApi = {
  getAll(): Promise<any> {
    return apiClient.get('/api/notifications');
  },

  getUnreadCount(): Promise<{ data: { count: number } }> {
    return apiClient.get('/api/notifications/unread-count');
  },

  create(data: { recipientId: string; message: string; priority?: string; isTask?: boolean }): Promise<any> {
    return apiClient.post('/api/notifications', data);
  },

  markRead(id: string): Promise<any> {
    return apiClient.patch(`/api/notifications/${id}/read`);
  },

  markTaskDone(id: string): Promise<any> {
    return apiClient.patch(`/api/notifications/${id}/task-done`);
  },

  reply(id: string, message: string): Promise<any> {
    return apiClient.post(`/api/notifications/${id}/replies`, { message });
  },
};
