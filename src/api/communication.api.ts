import { apiClient } from './client';

export const communicationApi = {
  getTemplates(): Promise<{ data: any[] }> {
    return apiClient.get('/api/communication/templates');
  },
  renderTemplate(templateId: string, variables: Record<string, string>): Promise<{ data: any }> {
    return apiClient.post('/api/communication/render-template', { templateId, variables });
  },
  sendEmail(body: { to: string; subject: string; body: string; caseId: string }): Promise<{ data: any }> {
    return apiClient.post('/api/communication/send/email', body);
  },
  sendSms(body: { to: string; message: string; caseId: string }): Promise<{ data: any }> {
    return apiClient.post('/api/communication/send/sms', body);
  },
  sendWhatsApp(body: { to: string; message: string; caseId: string }): Promise<{ data: any }> {
    return apiClient.post('/api/communication/send/whatsapp', body);
  },
  logCall(body: { phoneNumber: string; caseId: string; duration?: number; outcome?: string }): Promise<{ message: string }> {
    return apiClient.post('/api/communication/log-call', body);
  },
  generateFormalNote(body: {
    shortNote: string;
    debtorName: string;
    crmStatus: string;
    balance: number;
    currency: string;
  }): Promise<{ data: { formalNote: string } }> {
    return apiClient.post('/api/communication/ai/formal-note', body);
  },
  suggestStrategy(body: any): Promise<{ data: any }> {
    return apiClient.post('/api/communication/ai/contact-strategy', body);
  },
};
