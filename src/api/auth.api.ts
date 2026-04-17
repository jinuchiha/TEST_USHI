import { apiClient } from './client';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    agentCode?: string;
    target?: number;
    dailyTarget?: number;
  };
}

export const authApi = {
  login(email: string, password: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/api/auth/login', { email, password });
  },

  refresh(refreshToken: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/api/auth/refresh', { refreshToken });
  },

  logout(refreshToken: string): Promise<void> {
    return apiClient.post('/api/auth/logout', { refreshToken });
  },

  getMe(): Promise<{ data: LoginResponse['user'] }> {
    return apiClient.get('/api/auth/me');
  },
};
