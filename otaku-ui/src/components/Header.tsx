import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useMedia } from '../context/MediaContext';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';

interface HeaderProps {
  categoria: 'anime' | 'manga';
  setCategoria: (cat: 'anime' | 'manga') => void;
  onShowFavorites: () => void;
  onShowDashboard: () => void;
}

const SyncIndicator: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-1.5" title="Sincronização em curso...">
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.8 16.3C19.57 15.05 20 13.58 20 12C20 7.58 16.42 4 12 4Z" className="text-primary" fill="currentColor" />
        <path d="M12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.2 7.7C4.43 8.95 4 10.42 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" className="text-secondary" fill="currentColor" />
      </svg>
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ categoria, setCategoria, onShowDashboard }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { searchTerm, setSearchTerm, isSearchOpen, setIsSearchOpen, setIsShowingFavorites, isViewingDetails } = useMedia();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkSyncStatus = async () => {
      try {
        const res = await customFetch(`${API_BASE_URL}/sync/status`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setIsSyncing(data.isSyncing);
        }
      } catch {
        // ignore errors
      }
    };

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (val.trim()) {
      setIsSearchOpen(true);
      setIsShowingFavorites(false);
      if (location.pathname !== '/') navigate('/');
    }
  };

  const handleClearMobileSearch = () => {
    setSearchTerm('');
    setIsSearchOpen(false);
    setMobileSearchActive(false);
  };

  return (
    <>
      {isMobile ? (
        /* Top App Bar Mobile */
        <header className="fixed top-0 left-0 w-full z-50 bg-[#121317]/85 backdrop-blur-xl border-b border-white/10 flex flex-col justify-end px-margin-mobile safe-h-nav-top">
          <div className="flex justify-between items-center h-16 w-full gap-2">
            {mobileSearchActive ? (
              /* Active mobile search layout */
              <div className="flex items-center w-full gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <button onClick={handleClearMobileSearch} className="text-primary active:scale-95 transition-transform">
                  <span className="material-symbols-outlined text-xl">arrow_back</span>
                </button>
                <input 
                  autoFocus
                  className="w-full bg-deep-gray border-none rounded-full py-1.5 px-4 text-sm text-on-surface focus:ring-1 focus:ring-primary/50 outline-none" 
                  placeholder="Pesquisar anime ou manga..." 
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            ) : (
              /* Normal mobile header layout */
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => navigate('/profile')} className="active:scale-95 duration-200 text-primary flex-shrink-0 p-1 flex items-center justify-center">
                    <span className="material-symbols-outlined !text-[22px]">menu</span>
                  </button>
                  <h1 
                    onClick={onShowDashboard}
                    className="font-display-md text-base sm:text-lg font-extrabold text-primary tracking-tight cursor-pointer truncate flex-shrink-0"
                  >
                    Otaku-Time
                  </h1>
                  
                  {/* Category Switcher Mobile */}
                  <div className={`flex p-0.5 bg-black/40 border border-white/10 rounded-lg shrink-0 ml-1 sm:ml-2 ${isViewingDetails ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                    <button 
                      type="button"
                      onClick={() => setCategoria('anime')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${categoria === 'anime' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'}`}
                    >
                      Anime
                    </button>
                    <button 
                      type="button"
                      onClick={() => setCategoria('manga')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${categoria === 'manga' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'}`}
                    >
                      Mangá
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {isSyncing && <SyncIndicator />}
                  <button 
                    onClick={() => { setMobileSearchActive(true); }}
                    className="active:scale-95 duration-200 text-primary flex-shrink-0 p-1 flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined !text-[22px]">search</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

      ) : (
        /* TopAppBar Desktop */
        <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] z-40 bg-[#121317]/80 backdrop-blur-2xl border-b border-border-glass h-20 flex justify-between items-center px-6 md:px-margin-desktop">
          {/* Search Bar & Switcher */}
          <div className="flex items-center flex-1 max-w-2xl gap-4">
            <div className="relative w-full focus-within:ring-2 focus-within:ring-primary/50 rounded-full transition-all">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input 
                className="w-full bg-deep-gray border-none rounded-full py-2.5 pl-12 pr-4 text-sm text-on-surface focus:ring-0 placeholder:text-outline-variant outline-none" 
                placeholder="Pesquisar anime ou manga..." 
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              {searchTerm && (
                <button 
                  onClick={() => { setSearchTerm(''); if (isSearchOpen) setIsSearchOpen(false); }} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
            
            {/* Categoria Switcher */}
            <div className={`flex p-0.5 bg-black/40 border border-white/10 rounded-xl shrink-0 ${isViewingDetails ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
              <button 
                type="button"
                onClick={() => setCategoria('anime')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${categoria === 'anime' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-white'}`}
              >
                Anime
              </button>
              <button 
                type="button"
                onClick={() => setCategoria('manga')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${categoria === 'manga' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-white'}`}
              >
                Mangá
              </button>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="flex items-center gap-6 ml-6">
            {isSyncing && <SyncIndicator />}
            
            <button 
              onClick={() => showToast("Não tens notificações pendentes.", "info")}
              className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              notifications
            </button>
            
            <button 
              onClick={() => navigate('/profile', { state: { activeTab: 'account' } })}
              className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              settings
            </button>
            
            <div 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 cursor-pointer hover:border-primary transition-colors shadow-md flex-shrink-0"
            >
              {user?.iconUrl ? (
                <img alt="User Profile" className="w-full h-full object-cover" src={user.iconUrl} />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-lg">person</span>
                </div>
              )}
            </div>
          </div>
        </header>
      )}
    </>
  );
};

export default Header;

