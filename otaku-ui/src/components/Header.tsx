import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { Capacitor } from '@capacitor/core';
import { customFetch } from '../services/apiBridge';

interface HeaderProps {
  categoria: 'anime' | 'manga';
  setCategoria: (cat: 'anime' | 'manga') => void;
  onShowFavorites: () => void;
  onShowDashboard: () => void;
}

const Header: React.FC<HeaderProps> = ({ categoria, setCategoria }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [syncStatus, setSyncStatus] = useState<{ isSyncing: boolean; total: number; current: number; currentItemTitle: string }>({
    isSyncing: false,
    total: 0,
    current: 0,
    currentItemTitle: ''
  });

  const checkSyncStatus = async () => {
    try {
      const res = await customFetch(`${API_BASE_URL}/sync/status`);
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerManualSync = async () => {
    try {
      await customFetch(`${API_BASE_URL}/sync/start`, { method: 'POST' });
      checkSyncStatus();
    } catch {
      // ignore
    }
  };

  return (
    <>
      {Capacitor.isNativePlatform() ? (
        <header className="sticky top-0 z-40 w-full flex flex-col shadow-2xl border-b border-white/10 bg-background">
          {/* Barra de Cima */}
          <div className="w-full hero-gradient px-4 py-3 flex justify-between items-center border-b border-white/5 bg-surface/40 backdrop-blur-xl">
            <h1 className="font-display-lg text-2xl bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent tracking-tight font-black cursor-pointer" onClick={() => navigate('/')}>
              Otaku-Time
            </h1>
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary overflow-hidden cursor-pointer shadow-md shadow-primary/10 hover:scale-105 transition-transform" title="Perfil & Definições" onClick={() => navigate('/profile')}>
              <span className="material-symbols-outlined text-lg">person</span>
            </div>
          </div>
          
          {/* Barra de Baixo */}
          <div className="w-full bg-surface/80 backdrop-blur-lg px-4 py-2.5 flex justify-between items-center">
            <div className="flex gap-2 bg-surface-variant/50 p-1 rounded-full border border-white/5 shadow-inner">
              <button 
                onClick={() => setCategoria('anime')}
                className={`font-label-sm text-label-sm px-4 py-1.5 rounded-full transition-all duration-300 ${categoria === 'anime' ? 'bg-primary text-on-primary font-bold shadow-lg shadow-primary/40 border border-primary/50 scale-105' : 'text-on-surface-variant hover:bg-white/5'}`}
              >
                Anime
              </button>
              <button 
                onClick={() => setCategoria('manga')}
                className={`font-label-sm text-label-sm px-4 py-1.5 rounded-full transition-all duration-300 ${categoria === 'manga' ? 'bg-secondary text-on-secondary font-bold shadow-lg shadow-secondary/40 border border-secondary/50 scale-105' : 'text-on-surface-variant hover:bg-white/5'}`}
              >
                Manga
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {syncStatus.isSyncing ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/30 rounded-full animate-pulse shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-primary animate-spin text-sm">sync</span>
                    <span className="text-[10px] font-bold text-primary">
                      {syncStatus.current}/{syncStatus.total}
                    </span>
                  </div>
                ) : (
                  <button 
                    onClick={triggerManualSync}
                    className="flex items-center gap-1 px-3 py-1 bg-surface-variant hover:bg-white/10 text-on-surface-variant hover:text-white rounded-full transition-all border border-white/5 text-xs font-bold shadow-sm"
                    title="Force Background Sync Now"
                  >
                    <span className="material-symbols-outlined text-sm">sync</span>
                    <span>Sync</span>
                  </button>
                )}
              </div>
              <button className="p-2 text-on-surface-variant hover:bg-white/5 rounded-full transition-colors relative bg-surface-variant/30 border border-white/5">
                <span className="material-symbols-outlined text-lg">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              </button>
            </div>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-40 w-full h-16 bg-surface/60 backdrop-blur-lg border-b border-white/10 shadow-2xl flex justify-between items-center px-4 md:px-margin-desktop gap-2">
          <h1 className="hidden sm:block lg:hidden font-display-md text-display-md bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent tracking-tight font-black cursor-pointer" onClick={() => navigate('/')}>
            Otaku-Time
          </h1>
          
          <div className="flex gap-1 md:gap-8 bg-surface-variant/40 md:bg-transparent p-1 md:p-0 rounded-full border border-white/5 md:border-none">
            <button 
              onClick={() => setCategoria('anime')}
              className={`font-label-sm md:font-label-md text-label-sm md:text-label-md px-3 md:px-4 py-1 sm:py-1.5 rounded-full transition-all ${categoria === 'anime' ? 'bg-primary/20 text-primary font-bold border border-primary/30 shadow-md shadow-primary/10' : 'text-on-surface-variant hover:bg-white/5'}`}
            >
              Anime
            </button>
            <button 
              onClick={() => setCategoria('manga')}
              className={`font-label-sm md:font-label-md text-label-sm md:text-label-md px-3 md:px-4 py-1 sm:py-1.5 rounded-full transition-all ${categoria === 'manga' ? 'bg-secondary/20 text-secondary font-bold border border-secondary/30 shadow-md shadow-secondary/10' : 'text-on-surface-variant hover:bg-white/5'}`}
            >
              Manga
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* AutoSync Indicator & Trigger */}
            <div className="flex items-center gap-2">
              {syncStatus.isSyncing ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/20 border border-primary/30 rounded-full animate-pulse shadow-lg shadow-primary/20">
                  <span className="material-symbols-outlined text-primary animate-spin text-sm">sync</span>
                  <span className="text-xs font-bold text-primary">
                    Updating Releases ({syncStatus.current}/{syncStatus.total})
                  </span>
                  {syncStatus.currentItemTitle && (
                    <span className="hidden lg:inline text-[10px] text-on-surface-variant max-w-[120px] truncate">
                      {syncStatus.currentItemTitle}
                    </span>
                  )}
                </div>
              ) : (
                <button 
                  onClick={triggerManualSync}
                  className="flex items-center gap-1.5 px-3 py-1 bg-surface-variant hover:bg-white/10 text-on-surface-variant hover:text-white rounded-full transition-all border border-white/5 text-xs font-bold"
                  title="Force Background Sync Now"
                >
                  <span className="material-symbols-outlined text-sm">sync</span>
                  <span className="hidden sm:inline">AutoSync</span>
                </button>
              )}
            </div>

            <button className="p-2 text-on-surface-variant hover:bg-white/5 rounded-full transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full"></span>
            </button>
            <button onClick={logout} className="p-2 text-on-surface-variant hover:text-red-400 hover:bg-white/5 rounded-full transition-colors" title="Logout">
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </header>
      )}
    </>
  );
};

export default Header;
