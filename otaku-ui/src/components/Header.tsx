import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useMedia } from '../context/MediaContext';

interface HeaderProps {
  categoria: 'anime' | 'manga';
  setCategoria: (cat: 'anime' | 'manga') => void;
  onShowFavorites: () => void;
  onShowDashboard: () => void;
}

const Header: React.FC<HeaderProps> = ({ categoria, setCategoria }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isViewingDetails } = useMedia();

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
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary overflow-hidden cursor-pointer shadow-md shadow-primary/10 hover:scale-105 transition-transform" title="Perfil & Definições" onClick={() => navigate('/profile')}>
              <span className="material-symbols-outlined text-lg">person</span>
            </div>
          </div>
          
          {/* Barra de Baixo - Segmented Control Centrado e Estendido */}
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
        </header>
      ) : (
        <header className="sticky top-0 z-50 w-full h-16 bg-surface/60 backdrop-blur-lg border-b border-white/10 shadow-2xl flex justify-between items-center px-4 md:px-margin-desktop gap-2">
          <div className="hidden sm:flex lg:hidden items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/logo.png" className="w-8 h-8 rounded-xl shadow-lg border border-white/10 object-cover" alt="Logo" />
            <h1 className="font-display-md text-display-md text-primary-light tracking-tight font-black">
              Otaku-Time
            </h1>
          </div>
          
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

          <div className="flex items-center gap-4">
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

