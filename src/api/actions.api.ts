import { apiClient } from './client';

export const actionsApi = {
  getByCaseId(caseId: string): Promise<any> {
    return apiClient.get(`/api/cases/${caseId}/actions`);
  },

  create(caseId: string, data: {
    type: string;
    notes?: string;
    nextFollowUp?: string;
    promisedAmount?: number;
    promisedDate?: string;
  }): Promise<any> {
    return apiClient.post(`/api/cases/${caseId}/actions`, data);
  },

  logPayment(caseId: string, data: FormData): Promise<any> {
    return apiClient.post(`/api/cases/${caseId}/actions/payment`, data);
  },

  verifyPayment(actionId: string): Promise<any> {
    return apiClient.patch(`/api/actions/${actionId}/verify-payment`);
  },
};
