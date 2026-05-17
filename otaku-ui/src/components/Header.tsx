import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      const res = await fetch('http://localhost:3001/sync/status');
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
      await fetch('http://localhost:3001/sync/start', { method: 'POST' });
      checkSyncStatus();
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-surface/60 backdrop-blur-lg border-b border-white/10 shadow-2xl flex justify-between items-center px-margin-mobile md:px-margin-desktop">
      <h1 className="lg:hidden font-display-lg text-display-lg bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent tracking-tight font-black cursor-pointer" onClick={() => navigate('/')}>
        Otaku-Time
      </h1>
      
      <div className="hidden md:flex gap-8">
        <button 
          onClick={() => setCategoria('anime')}
          className={`font-label-md text-label-md px-4 py-1.5 rounded-full transition-all ${categoria === 'anime' ? 'bg-primary/20 text-primary font-bold border border-primary/30' : 'text-on-surface-variant hover:bg-white/5'}`}
        >
          Anime
        </button>
        <button 
          onClick={() => setCategoria('manga')}
          className={`font-label-md text-label-md px-4 py-1.5 rounded-full transition-all ${categoria === 'manga' ? 'bg-secondary/20 text-secondary font-bold border border-secondary/30' : 'text-on-surface-variant hover:bg-white/5'}`}
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
  );
};

export default Header;
