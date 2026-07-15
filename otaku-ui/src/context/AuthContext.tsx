import React, { createContext, useContext, useState, useEffect } from 'react';
import { customFetch } from '../services/apiBridge';
import { API_BASE_URL } from '../config';
import { getStorageItem, setStorageItem, removeStorageItem } from '../services/storage';

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
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const login = (newToken: string, newUser: User, refreshToken?: string) => {
    setToken(newToken);
    setUser(newUser);
    setStorageItem('otaku_token', newToken);
    if (refreshToken) {
      setStorageItem('otaku_refresh_token', refreshToken);
    }
    setStorageItem('otaku_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await removeStorageItem('otaku_token');
    await removeStorageItem('otaku_refresh_token');
    await removeStorageItem('otaku_user');

    customFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' })
      .catch(err => console.error('Erro ao terminar sessão no backend:', err));
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      setStorageItem('otaku_user', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedToken = await getStorageItem('otaku_token');
        const savedUser = await getStorageItem('otaku_user');

        if (savedToken && savedUser) {
          // Sempre faz a validação com o profile/me para garantir que a sessão é válida/atualizada
          const res = await customFetch(`${API_BASE_URL}/user/profile/me`);
          if (res.ok) {
            const userProfile = await res.json();
            const currentToken = await getStorageItem('otaku_token') || savedToken;
            setUser(userProfile);
            setToken(currentToken);
            await setStorageItem('otaku_user', JSON.stringify(userProfile));
          } else {
            // Nota: Se falhar (mesmo com as tentativas de refresh integradas no customFetch), limpa a sessão
            await logout();
          }
        }
      } catch (err) {
        console.error('Erro ao restaurar sessão:', err);
        // Em caso de erro de rede, mantemos a sessão offline temporária se existirem dados locais
        try {
          const savedToken = await getStorageItem('otaku_token');
          const savedUser = await getStorageItem('otaku_user');
          if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
          }
        } catch (_) {}
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, updateUser, loading }}>
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
