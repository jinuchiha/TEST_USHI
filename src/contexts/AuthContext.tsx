import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Role } from '../../types';
import { apiClient, authApi } from '../api';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  /** Fallback for offline/demo mode using local constants */
  loginLocal: (userName: string, password: string, users: User[]) => boolean;
  useApi: boolean;
  setUseApi: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useApi, setUseApi] = useState(() => {
    return localStorage.getItem('crm_useApi') === 'true';
  });

  // Try to restore session on mount
  useEffect(() => {
    if (useApi) {
      apiClient.loadTokens();
      if (apiClient.getAccessToken()) {
        authApi.getMe()
          .then(res => {
            setCurrentUser({
              id: res.data.id,
              name: res.data.name,
              role: res.data.role as Role,
              agentCode: res.data.agentCode,
              target: res.data.target,
              dailyTarget: res.data.dailyTarget,
            });
          })
          .catch(() => {
            apiClient.clearTokens();
          })
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [useApi]);

  // Set up auth error handler
  useEffect(() => {
    apiClient.setOnAuthError(() => {
      setCurrentUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await authApi.login(email, password);
      apiClient.setTokens(res.accessToken, res.refreshToken);
      setCurrentUser({
        id: res.user.id,
        name: res.user.name,
        role: res.user.role as Role,
        agentCode: res.user.agentCode,
        target: res.user.target,
        dailyTarget: res.user.dailyTarget,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const loginLocal = useCallback((userName: string, password: string, users: User[]): boolean => {
    const user = users.find(
      u => u.name.toLowerCase() === userName.toLowerCase() && u.password === password
    );
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    if (useApi) {
      const rt = localStorage.getItem('refreshToken');
      if (rt) authApi.logout(rt).catch(() => {});
      apiClient.clearTokens();
    }
    setCurrentUser(null);
  }, [useApi]);

  const handleSetUseApi = useCallback((val: boolean) => {
    localStorage.setItem('crm_useApi', String(val));
    setUseApi(val);
    if (!val) {
      apiClient.clearTokens();
      setCurrentUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser,
      isLoading,
      isAuthenticated: !!currentUser,
      login,
      logout,
      loginLocal,
      useApi,
      setUseApi: handleSetUseApi,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
