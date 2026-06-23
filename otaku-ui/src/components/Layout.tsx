import React from 'react';
import { useMedia } from '../context/MediaContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from './Header';
import { useTranslation } from '../hooks/useTranslation';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { setIsShowingFavorites, isSearchOpen, setIsSearchOpen, triggerHome } = useMedia();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const handleShowFavorites = () => {
    setIsShowingFavorites(true);
    setIsSearchOpen(false);
    navigate('/library');
  };

  const handleShowDashboard = () => {
    triggerHome();
    navigate('/');
  };

  const isHomeActive = location.pathname === '/' && !isSearchOpen;
  const isCalendarActive = location.pathname === '/calendar';
  const isLibraryActive = location.pathname === '/library';
  const isProfileActive = location.pathname === '/profile';
  const isExploreActive = location.pathname === '/explore';


  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-primary selection:text-on-primary font-body-md flex max-w-full overflow-x-hidden">
      {/* SideNavBar (Desktop Only) */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-dim border-r border-border-glass backdrop-blur-xl z-50 py-8">
        {/* Brand Header */}
        <div className="px-6 mb-8 cursor-pointer" onClick={handleShowDashboard}>
          <h1 className="font-display-md text-3xl font-extrabold text-primary tracking-tighter">
            Otaku-Time
          </h1>
          <p className="font-label-sm text-xs text-on-surface-variant mt-1">
            {t(user?.tipoConta === 'ADMIN' ? 'Administrator' : 
              user?.tipoConta === 'pro' ? 'Pro Member' : 'Standard Member')}
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1">
          <button 
            onClick={handleShowDashboard} 
            className={`flex items-center gap-3 px-6 py-3.5 w-full text-left font-label-md text-sm transition-all duration-300 ${
              isHomeActive 
                ? 'text-primary bg-primary-container/10 border-r-4 border-primary' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isHomeActive ? "'FILL' 1" : "'FILL' 0" }}>home</span>
             <span>{t("Home")}</span>
          </button>

          <button 
            onClick={() => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/explore'); }}
            className={`flex items-center gap-3 px-6 py-3.5 w-full text-left font-label-md text-sm transition-all duration-300 ${
              isExploreActive 
                ? 'text-primary bg-primary-container/10 border-r-4 border-primary' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isExploreActive ? "'FILL' 1" : "'FILL' 0" }}>explore</span>
             <span>{t("Explorar")}</span>
          </button>
          
          <button 
            onClick={handleShowFavorites}
            className={`flex items-center gap-3 px-6 py-3.5 w-full text-left font-label-md text-sm transition-all duration-300 ${
              isLibraryActive 
                ? 'text-primary bg-primary-container/10 border-r-4 border-primary' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isLibraryActive ? "'FILL' 1" : "'FILL' 0" }}>library_books</span>
             <span>{t("Biblioteca")}</span>
          </button>

          <button 
            onClick={() => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/calendar'); }}
            className={`flex items-center gap-3 px-6 py-3.5 w-full text-left font-label-md text-sm transition-all duration-300 ${
              isCalendarActive 
                ? 'text-primary bg-primary-container/10 border-r-4 border-primary' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isCalendarActive ? "'FILL' 1" : "'FILL' 0" }}>calendar_month</span>
             <span>{t("Calendário")}</span>
          </button>


          <button 
            onClick={() => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/profile'); }}
            className={`flex items-center gap-3 px-6 py-3.5 w-full text-left font-label-md text-sm transition-all duration-300 ${
              isProfileActive 
                ? 'text-primary bg-primary-container/10 border-r-4 border-primary' 
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: isProfileActive ? "'FILL' 1" : "'FILL' 0" }}>person</span>
             <span>{t("Perfil")}</span>
          </button>
        </nav>

        {/* Upgrade Pro & User profile at bottom of sidebar */}
        <div className="px-4 mt-auto space-y-4">
          <button 
            onClick={() => navigate('/profile')} 
            className="w-full py-3.5 rounded-xl bg-secondary font-label-md text-xs font-bold text-white shadow-lg active:scale-95 transition-transform"
          >
             {t("Upgrade Pro")}
          </button>

          {/* User Profile Card */}
          <div 
            onClick={() => navigate('/profile')}
            className="relative overflow-hidden rounded-xl p-3.5 flex items-center gap-3 cursor-pointer group border border-white/5 shadow-lg min-h-[64px]"
          >
            {user?.bannerUrl ? (
              <img 
                src={user.bannerUrl} 
                alt="Banner" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                style={{ objectPosition: `center ${user.preferences?.bannerPosition ?? 50}%` }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-secondary/30 transition-transform duration-500 group-hover:scale-105" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/35 group-hover:from-black/90 transition-all duration-300" />
            
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary overflow-hidden relative z-10 flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform shadow-md">
              {user?.iconUrl ? (
                <img src={user.iconUrl} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                <span className="material-symbols-outlined text-sm">person</span>
              )}
            </div>

            <div className="relative z-10 flex-1 min-w-0">
              <p className="font-bold text-xs text-white truncate group-hover:text-primary-light transition-colors">
                {user?.nome || 'Otaku'}
              </p>
              <p className="text-[10px] text-white/70 truncate">
                {t(user?.tipoConta === 'ADMIN' ? 'Administrator' : 
                  user?.tipoConta === 'pro' ? 'Pro Member' : 'Standard Member')}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 md:ml-64 min-h-screen main-container-pb flex flex-col w-full max-w-full overflow-x-hidden">
        <Header 
          categoria={useMedia().categoria} 
          setCategoria={useMedia().setCategoria} 
          onShowFavorites={handleShowFavorites}
          onShowDashboard={handleShowDashboard}
        />
        <main className="flex-1 relative w-full max-w-full overflow-x-hidden main-content-padding">
          {children}
        </main>
      </div>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface-container/90 backdrop-blur-md border-t border-border-glass safe-h-nav-bottom flex flex-col justify-start px-4 rounded-t-xl shadow-[0_-4px_20px_rgba(139,92,246,0.1)]">
        <div className="flex justify-around items-center h-16 w-full">
          <button 
            onClick={handleShowDashboard} 
            className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${
              isHomeActive 
                ? 'bg-secondary-container/20 text-primary font-bold' 
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-lg font-bold" style={{ fontVariationSettings: isHomeActive ? "'FILL' 1" : "'FILL' 0" }}>home</span>
             <span className="font-label-sm text-[10px] mt-0.5">{t("Home")}</span>
          </button>

          <button 
            onClick={() => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/explore'); }} 
            className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${
              isExploreActive 
                ? 'bg-secondary-container/20 text-primary font-bold' 
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-lg font-bold" style={{ fontVariationSettings: isExploreActive ? "'FILL' 1" : "'FILL' 0" }}>explore</span>
             <span className="font-label-sm text-[10px] mt-0.5">{t("Explorar")}</span>
          </button>

          <button 
            onClick={handleShowFavorites} 
            className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${
              isLibraryActive 
                ? 'bg-secondary-container/20 text-primary font-bold' 
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-lg font-bold" style={{ fontVariationSettings: isLibraryActive ? "'FILL' 1" : "'FILL' 0" }}>video_library</span>
             <span className="font-label-sm text-[10px] mt-0.5">{t("My List")}</span>
          </button>
          
          <button 
            onClick={() => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/calendar'); }} 
            className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${
              isCalendarActive 
                ? 'bg-secondary-container/20 text-primary font-bold' 
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-lg font-bold" style={{ fontVariationSettings: isCalendarActive ? "'FILL' 1" : "'FILL' 0" }}>event_note</span>
             <span className="font-label-sm text-[10px] mt-0.5">{t("Agenda")}</span>
          </button>


          <button 
            onClick={() => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/profile'); }} 
            className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${
              isProfileActive 
                ? 'bg-secondary-container/20 text-primary font-bold' 
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-lg font-bold" style={{ fontVariationSettings: isProfileActive ? "'FILL' 1" : "'FILL' 0" }}>account_circle</span>
             <span className="font-label-sm text-[10px] mt-0.5">{t("Me")}</span>
          </button>
        </div>
      </nav>

    </div>
  );
};

export default Layout;
