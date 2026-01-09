import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, setToken } from '@/lib/api';
import { db } from '@/lib/db';
import { trackUserAction } from '@/lib/analytics';

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  avatar?: string;
  stats?: {
    territories_owned?: number;
    total_distance_km?: number | string;
    area_km2?: number;
    currentStreak?: number;
    rank?: number;
  };
  created_at?: string;
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
    setToken(token); // Set token for API calls

    // Try to load cached user profile first
    try {
      const cachedProfile = await db.userProfile.get(Number(token)); // Use userId if token stringifies id
      // Actually, since userId is in token, but to simplify, store with userId.
      // For now, assume we store with a fixed key, but better to use userId.
      // Since we don't have userId yet, load all and take first.
      const cachedProfiles = await db.userProfile.toArray();
      if (cachedProfiles.length > 0) {
        setUser(cachedProfiles[0]); // Assume single user
      }
    } catch (err) {
      console.log('Error loading cached profile:', err);
    }

    // Try to fetch fresh data
    try {
      const me = await fetchMe();
      setUser(me);
      // Cache the profile
      await db.userProfile.put({
        id: me.id,
        username: me.username,
        email: me.email,
        stats: me.stats,
        lastSynced: Date.now()
      });
    } catch (err: any) {
      // If network error and no cached data, keep cached or set to null
      if (err.message?.includes('401') || err.message?.includes('Unauthorized') || err.message?.includes('invalid token')) {
        console.log('Token expired or invalid, clearing session');
        setToken(null);
        localStorage.removeItem(SESSION_TOKEN);
        setUser(null);
        await db.userProfile.clear(); // Clear cached profile
      } else {
        console.log('Network error, using cached profile:', err.message);
        // Keep cached user if available
      }
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
      // Cache profile
      await db.userProfile.put({
        id: me.id,
        username: me.username,
        email: me.email,
        stats: me.stats,
        lastSynced: Date.now()
      });

      // Track successful login
      trackUserAction('login_success', { userId: me.id, username: me.username });

      return { success: true };
    } catch (err: any) {
      // Track failed login
      trackUserAction('login_failed', { error: err.message });
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
      // Cache profile
      await db.userProfile.put({
        id: me.id,
        username: me.username,
        email: me.email,
        stats: me.stats,
        lastSynced: Date.now()
      });

      // Track successful signup
      trackUserAction('signup_success', { userId: me.id, username: me.username });

      return { success: true };
    } catch (err: any) {
      // Track failed signup
      trackUserAction('signup_failed', { error: err.message });
      return { success: false, error: err.message || 'Signup failed' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(SESSION_TOKEN);
    db.userProfile.clear(); // Clear cached profile
  };

  const refresh = async () => {
    const me = await fetchMe();
    setUser(me);
    // Update cache
    await db.userProfile.put({
      id: me.id.toString(),
      username: me.username,
      email: me.email,
      stats: me.stats,
      lastSynced: Date.now()
    });
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
