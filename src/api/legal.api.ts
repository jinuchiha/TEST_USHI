import { apiClient } from './client';

export const legalApi = {
  // Notices
  createNotice(body: any): Promise<{ data: any }> {
    return apiClient.post('/api/legal/notices', body);
  },
  getNoticesByCase(caseId: string): Promise<{ data: any[] }> {
    return apiClient.get(`/api/legal/notices/case/${caseId}`);
  },
  updateNoticeStatus(id: string, status: string, deliveredDate?: string): Promise<{ data: any }> {
    return apiClient.patch(`/api/legal/notices/${id}/status`, { status, deliveredDate });
  },

  // Court cases
  createCourtCase(body: any): Promise<{ data: any }> {
    return apiClient.post('/api/legal/court-cases', body);
  },
  listCourtCases(caseId?: string): Promise<{ data: any[] }> {
    return apiClient.get('/api/legal/court-cases', { caseId });
  },
  updateCourtCase(id: string, body: any): Promise<{ data: any }> {
    return apiClient.patch(`/api/legal/court-cases/${id}`, body);
  },
  upcomingHearings(days = 30): Promise<{ data: any[] }> {
    return apiClient.get('/api/legal/court-cases/upcoming', { days });
  },

  // Documents
  uploadDocument(formData: FormData): Promise<{ data: any }> {
    return apiClient.post('/api/legal/documents', formData);
  },
  listDocuments(filters?: { debtorId?: string; caseId?: string }): Promise<{ data: any[] }> {
    return apiClient.get('/api/legal/documents', filters);
  },
  deleteDocument(id: string): Promise<{ message: string }> {
    return apiClient.delete(`/api/legal/documents/${id}`);
  },
};
