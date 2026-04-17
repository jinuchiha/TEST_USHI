import { apiClient } from './client';

export interface CaseFilters {
  page?: number;
  limit?: number;
  crmStatus?: string;
  assignedOfficerId?: string;
  contactStatus?: string;
  workStatus?: string;
  search?: string;
  bank?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const casesApi = {
  getAll(filters?: CaseFilters): Promise<any> {
    return apiClient.get('/api/cases', filters as any);
  },

  getById(id: string): Promise<any> {
    return apiClient.get(`/api/cases/${id}`);
  },

  create(data: any): Promise<any> {
    return apiClient.post('/api/cases', data);
  },

  updateStatus(id: string, data: {
    crmStatus: string;
    subStatus: string;
    contactStatus: string;
    workStatus: string;
    notes: string;
    expectedVersion?: number;
    promisedAmount?: number;
    promisedDate?: string;
  }): Promise<any> {
    return apiClient.patch(`/api/cases/${id}/status`, data);
  },

  reassign(id: string, newOfficerId: string): Promise<any> {
    return apiClient.patch(`/api/cases/${id}/reassign`, { newOfficerId });
  },

  bulkReassign(caseIds: string[], newOfficerId: string): Promise<any> {
    return apiClient.post('/api/cases/bulk-reassign', { caseIds, newOfficerId });
  },

  getWithdrawn(): Promise<any> {
    return apiClient.get('/api/cases/withdrawn');
  },

  getPendingWithdrawals(): Promise<any> {
    return apiClient.get('/api/cases/pending-withdrawals');
  },

  search(filters: CaseFilters): Promise<any> {
    return apiClient.get('/api/cases/search', filters as any);
  },
};
