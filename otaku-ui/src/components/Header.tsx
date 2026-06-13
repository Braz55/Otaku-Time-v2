import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useMedia } from '../context/MediaContext';
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
      <svg className="animate-spin w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.8 16.3C19.57 15.05 20 13.58 20 12C20 7.58 16.42 4 12 4Z" className="text-primary" fill="currentColor" />
        <path d="M12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.2 7.7C4.43 8.95 4 10.42 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" className="text-secondary" fill="currentColor" />
      </svg>
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ categoria, setCategoria }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isViewingDetails } = useMedia();
  const [isSyncing, setIsSyncing] = useState(false);

  const isProfilePage = location.pathname === '/profile';

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

  return (
    <>
      {isMobile ? (
        <header className="sticky top-0 z-50 w-full flex flex-col shadow-2xl border-b border-white/10 bg-background">
          {/* Barra de Cima com pt-10 para evitar colisão com a barra de notificações do Android */}
          <div className="w-full hero-gradient px-4 pt-10 pb-3 flex justify-between items-center border-b border-white/5 bg-surface/40 backdrop-blur-xl">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
              <img src="/logo.png" className="w-8 h-8 rounded-xl shadow-lg border border-white/10 object-cover" alt="Logo" />
              <h1 className="font-display-lg text-2xl text-primary-light tracking-tight font-black">
                Otaku-Time
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isSyncing && <SyncIndicator />}
              <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary overflow-hidden cursor-pointer shadow-md shadow-primary/10 hover:scale-105 transition-transform" title="Perfil & Definições" onClick={() => navigate('/profile')}>
                <span className="material-symbols-outlined text-lg">person</span>
              </div>
            </div>
          </div>
          
          {/* Barra de Baixo - Segmented Control Centrado e Estendido */}
          {!isProfilePage && (
            <div className="w-full bg-surface/80 backdrop-blur-lg px-4 py-2.5 flex justify-center items-center">
              <div className={`w-full max-w-sm flex gap-1 bg-surface-variant/60 p-1.5 rounded-full border border-white/10 shadow-inner transition-opacity duration-300 ${isViewingDetails ? 'opacity-80' : ''}`}>
                <button 
                  onClick={() => !isViewingDetails && setCategoria('anime')}
                  disabled={isViewingDetails}
                  className={`flex-1 py-2 rounded-full font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                    categoria === 'anime' 
                      ? 'bg-primary text-on-primary shadow-lg shadow-primary/30' 
                      : 'text-on-surface-variant/40'
                  } ${isViewingDetails ? 'cursor-not-allowed' : 'hover:text-white active:scale-95 scale-[1.02]'}`}
                  title={isViewingDetails ? 'Cannot change category while viewing details' : ''}
                >
                  <span className="material-symbols-outlined text-base">live_tv</span>
                  <span>Anime</span>
                </button>
                <button 
                  onClick={() => !isViewingDetails && setCategoria('manga')}
                  disabled={isViewingDetails}
                  className={`flex-1 py-2 rounded-full font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                    categoria === 'manga' 
                      ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/30' 
                      : 'text-on-surface-variant/40'
                  } ${isViewingDetails ? 'cursor-not-allowed' : 'hover:text-white active:scale-95 scale-[1.02]'}`}
                  title={isViewingDetails ? 'Cannot change category while viewing details' : ''}
                >
                  <span className="material-symbols-outlined text-base">menu_book</span>
                  <span>Manga</span>
                </button>
              </div>
            </div>
          )}
        </header>
      ) : (
        <header className="sticky top-0 z-50 w-full h-16 bg-surface/60 backdrop-blur-lg border-b border-white/10 shadow-2xl flex justify-between items-center px-4 md:px-margin-desktop gap-2">
          <div className="hidden sm:flex lg:hidden items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/logo.png" className="w-8 h-8 rounded-xl shadow-lg border border-white/10 object-cover" alt="Logo" />
            <h1 className="font-display-md text-display-md text-primary-light tracking-tight font-black">
              Otaku-Time
            </h1>
          </div>
          
          {!isProfilePage ? (
            <div className={`flex gap-1 md:gap-8 bg-surface-variant/40 md:bg-transparent p-1 md:p-0 rounded-full border border-white/5 md:border-none transition-opacity duration-300 ${isViewingDetails ? 'opacity-80' : ''}`}>
              <button 
                onClick={() => !isViewingDetails && setCategoria('anime')}
                disabled={isViewingDetails}
                className={`font-label-sm md:font-label-md text-label-sm md:text-label-md px-3 md:px-4 py-1 sm:py-1.5 rounded-full transition-all ${
                  categoria === 'anime' 
                    ? 'bg-primary/20 text-primary font-bold border border-primary/30 shadow-md shadow-primary/10' 
                    : 'text-on-surface-variant/40'
                } ${isViewingDetails ? 'cursor-not-allowed' : 'hover:bg-white/5'}`}
                title={isViewingDetails ? 'Cannot change category while viewing details' : ''}
              >
                Anime
              </button>
              <button 
                onClick={() => !isViewingDetails && setCategoria('manga')}
                disabled={isViewingDetails}
                className={`font-label-sm md:font-label-md text-label-sm md:text-label-md px-3 md:px-4 py-1 sm:py-1.5 rounded-full transition-all ${
                  categoria === 'manga' 
                    ? 'bg-secondary/20 text-secondary font-bold border border-secondary/30 shadow-md shadow-secondary/10' 
                    : 'text-on-surface-variant/40'
                } ${isViewingDetails ? 'cursor-not-allowed' : 'hover:bg-white/5'}`}
                title={isViewingDetails ? 'Cannot change category while viewing details' : ''}
              >
                Manga
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-4">
            {isSyncing && <SyncIndicator />}
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

