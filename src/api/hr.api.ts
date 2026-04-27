import { apiClient } from './client';

export const hrApi = {
  // Attendance — self-service
  checkIn(): Promise<{ data: any }> {
    return apiClient.post('/api/hr/attendance/check-in');
  },
  checkOut(): Promise<{ data: any }> {
    return apiClient.post('/api/hr/attendance/check-out');
  },
  myCheckInStatus(): Promise<{ data: { hasCheckedIn: boolean; record?: any } }> {
    return apiClient.get('/api/hr/attendance/check-in-status');
  },
  myAttendanceLog(page = 1): Promise<{ data: any[] }> {
    return apiClient.get('/api/hr/attendance/my-log', { page });
  },

  // Attendance — manager/CEO
  todaySnapshot(): Promise<{ data: any }> {
    return apiClient.get('/api/hr/attendance/today');
  },
  attendanceTrends(year: number, month: number): Promise<{ data: any }> {
    return apiClient.get('/api/hr/attendance/trends', { year, month });
  },
  attendanceCorrelation(year: number, month: number): Promise<{ data: any }> {
    return apiClient.get('/api/hr/attendance/correlation', { year, month });
  },
  monthlyAttendance(userId: string, year: number, month: number): Promise<{ data: any }> {
    return apiClient.get(`/api/hr/attendance/${userId}`, { year, month });
  },
  markAbsent(): Promise<{ data: any }> {
    return apiClient.post('/api/hr/attendance/mark-absent');
  },

  // Leave
  submitLeave(body: { type: string; startDate: string; endDate: string; reason: string }): Promise<{ data: any }> {
    return apiClient.post('/api/hr/leave', body);
  },
  listLeave(status?: string): Promise<{ data: any[] }> {
    return apiClient.get('/api/hr/leave', { status });
  },
  approveLeave(id: string, approved: boolean, notes?: string): Promise<{ data: any }> {
    return apiClient.patch(`/api/hr/leave/${id}/approve`, { approved, notes });
  },
  myLeaveBalance(year?: number): Promise<{ data: any }> {
    return apiClient.get('/api/hr/leave/my-balance', { year });
  },
  leaveBalance(userId: string, year?: number): Promise<{ data: any }> {
    return apiClient.get(`/api/hr/leave/balance/${userId}`, { year });
  },

  // Sessions
  startSession(body: { ip?: string; userAgent?: string }): Promise<{ data: any }> {
    return apiClient.post('/api/hr/sessions/start', body);
  },
  endSession(reason: 'manual_logout' | 'idle_logout'): Promise<{ message: string }> {
    return apiClient.post('/api/hr/sessions/end', { reason });
  },
  userSessions(userId: string): Promise<{ data: any[] }> {
    return apiClient.get(`/api/hr/sessions/${userId}`);
  },
};
