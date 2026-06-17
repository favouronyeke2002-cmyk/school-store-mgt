import React, { createContext, useContext, useState, useCallback } from 'react';
import { authAPI } from '../lib/api';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('pos_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading] = useState(false);

  const loginWithPin = useCallback(async (pin: string) => {
    try {
      const result = await authAPI.loginPin(pin);
      if (result.success && result.user) {
        setUser(result.user);
        localStorage.setItem('pos_user', JSON.stringify(result.user));
        return { success: true };
      }
      return { success: false, error: result.error || 'Invalid PIN' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  const loginWithPassword = useCallback(async (password: string) => {
    try {
      const result = await authAPI.loginPassword(password);
      if (result.success && result.user) {
        setUser(result.user);
        localStorage.setItem('pos_user', JSON.stringify(result.user));
        return { success: true };
      }
      return { success: false, error: result.error || 'Invalid password' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pos_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, loginWithPin, loginWithPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
