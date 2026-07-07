import React, { createContext, useContext, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { customFetch } from '../services/apiBridge';
import { API_BASE_URL } from '../config';

interface User {
  id: number;
  email: string;
  nome: string;
  preferredLanguage: string;
  theme: string;
  showAdultContent: boolean;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  preferences?: any;
  tipoConta?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = (newToken: string, newUser: User, refreshToken?: string) => {
    if (Capacitor.isNativePlatform()) {
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('otaku_token', newToken);
      if (refreshToken) {
        localStorage.setItem('otaku_refresh_token', refreshToken);
      }
    } else {
      setToken('session-cookie');
      setUser(newUser);
      localStorage.setItem('otaku_token', 'session-cookie');
    }
    localStorage.setItem('otaku_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('otaku_token');
    localStorage.removeItem('otaku_refresh_token');
    localStorage.removeItem('otaku_user');

    if (!Capacitor.isNativePlatform()) {
      customFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' })
        .catch(err => console.error('Erro ao terminar sessão no backend:', err));
    }
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('otaku_user', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('otaku_token');
    const savedUser = localStorage.getItem('otaku_user');

    if (savedToken && savedUser) {
      if (savedToken === 'session-cookie') {
        customFetch(`${API_BASE_URL}/user/profile/me`)
          .then(async (res) => {
            if (res.ok) {
              const userProfile = await res.json();
              setUser(userProfile);
              setToken('session-cookie');
              localStorage.setItem('otaku_user', JSON.stringify(userProfile));
            } else if (res.status === 401) {
              const refreshRes = await customFetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
              });
              if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                setUser(refreshData.user);
                setToken('session-cookie');
                localStorage.setItem('otaku_user', JSON.stringify(refreshData.user));
              } else {
                logout();
              }
            } else {
              logout();
            }
          })
          .catch(() => {
            setToken('session-cookie');
            setUser(JSON.parse(savedUser));
          });
      } else {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, updateUser }}>
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
