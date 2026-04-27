import { apiClient } from './client';

export const tracingApi = {
  addContact(body: {
    debtorId: string;
    caseId?: string;
    type: string;
    value: string;
    label?: string;
    source?: string;
    notes?: string;
  }): Promise<{ data: any }> {
    return apiClient.post('/api/tracing/contacts', body);
  },
  getContacts(debtorId: string): Promise<{ data: any[] }> {
    return apiClient.get(`/api/tracing/contacts/${debtorId}`);
  },
  updateStatus(id: string, status: string, notes?: string): Promise<{ data: any }> {
    return apiClient.patch(`/api/tracing/contacts/${id}/status`, { status, notes });
  },
  logAttempt(id: string, success: boolean): Promise<{ data: any }> {
    return apiClient.post(`/api/tracing/contacts/${id}/attempt`, { success });
  },
  successRate(debtorId: string): Promise<{ data: { successRate: number; total: number; success: number } }> {
    return apiClient.get(`/api/tracing/success-rate/${debtorId}`);
  },
  timeline(debtorId: string): Promise<{ data: any[] }> {
    return apiClient.get(`/api/tracing/timeline/${debtorId}`);
  },
};
