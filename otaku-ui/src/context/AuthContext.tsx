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
          // 1. Restaurar sessão localmente primeiro para que a app carregue instantaneamente
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          setLoading(false); // Liberta a UI imediatamente

          // 2. Fazer a validação em segundo plano (background)
          try {
            const res = await customFetch(`${API_BASE_URL}/user/profile/me`);
            if (res.ok) {
              const userProfile = await res.json();
              // O token pode ter sido atualizado (refresh) durante o customFetch
              const currentToken = await getStorageItem('otaku_token') || savedToken;
              setUser(userProfile);
              setToken(currentToken);
              await setStorageItem('otaku_user', JSON.stringify(userProfile));
            } else if (res.status === 401 || res.status === 403) {
              // Apenas limpa a sessão se for um erro explícito de autorização (ex: token/refresh expirado)
              // Erros de rede (como timeouts do Render a acordar ou falta de internet) não devem fazer logout
              await logout();
            }
          } catch (fetchErr) {
            console.error('Erro na validação em background do profile:', fetchErr);
            // Em caso de erro de rede ou timeout (ex. Render a acordar), mantemos a sessão local existente
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao restaurar sessão:', err);
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
