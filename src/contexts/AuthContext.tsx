import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, setToken } from '@/lib/api';

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  stats: {
    territories_owned: number;
    total_distance_km: number;
    area_km2: number;
  };
  created_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_TOKEN = 'auth_token';

async function fetchMe() {
  const res = await apiFetch('/me');
  return res.user as UserProfile;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = async () => {
    const token = localStorage.getItem(SESSION_TOKEN);
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
    } catch (err) {
      setToken(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      const me = await fetchMe();
      setUser(me);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const signup = async (email: string, password: string, username: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, username }),
      });
      setToken(res.token);
      const me = await fetchMe();
      setUser(me);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const refresh = async () => {
    const me = await fetchMe();
    setUser(me);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
