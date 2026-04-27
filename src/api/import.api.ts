import { apiClient } from './client';

export interface ImportPreview {
  headers: string[];
  rowCount: number;
  mapping: Record<string, string>;
  sampleRows: any[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  mapping: Record<string, string>;
  byOfficer?: { officerId: string; officerName: string; count: number }[];
}

export const importApi = {
  preview(file: File): Promise<{ data: ImportPreview }> {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post('/api/cases/import/preview', fd);
  },
  importCases(file: File, assignedOfficerId?: string): Promise<{ data: ImportResult }> {
    const fd = new FormData();
    fd.append('file', file);
    if (assignedOfficerId) fd.append('assignedOfficerId', assignedOfficerId);
    return apiClient.post('/api/cases/import', fd);
  },
};
