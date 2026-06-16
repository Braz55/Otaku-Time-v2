import React from 'react';
import { useMedia } from '../context/MediaContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isShowingFavorites, setIsShowingFavorites, isSearchOpen, setIsSearchOpen, triggerHome } = useMedia();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleShowFavorites = () => {
    setIsShowingFavorites(true);
    setIsSearchOpen(false);
    if (location.pathname !== '/') navigate('/');
  };

  const handleShowDashboard = () => {
    triggerHome();
    if (location.pathname !== '/') navigate('/');
  };

  const isHomeActive = location.pathname === '/' && !isShowingFavorites && !isSearchOpen;
  const isCalendarActive = location.pathname === '/calendar';
  const isLibraryActive = location.pathname === '/' && isShowingFavorites && !isSearchOpen;
  const isProfileActive = location.pathname === '/profile';

  return (
    <div className="min-h-screen bg-[#0F1014] text-on-background selection:bg-primary selection:text-on-primary font-body-md flex max-w-full overflow-x-hidden">
      {/* SideNavBar (Desktop Only) */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-dim border-r border-border-glass backdrop-blur-xl z-50 py-8">
        {/* Brand Header */}
        <div className="px-6 mb-8 cursor-pointer" onClick={handleShowDashboard}>
          <h1 className="font-display-md text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-vibrant-purple to-electric-magenta tracking-tighter">
            Otaku-Time
          </h1>
          <p className="font-label-sm text-xs text-on-surface-variant mt-1">
            {user?.tipoConta === 'ADMIN' ? 'Administrator' : 'Premium Member'}
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
            <span>Home</span>
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
            <span>Calendário</span>
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
            <span>Biblioteca</span>
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
            <span>Perfil</span>
          </button>
        </nav>

        {/* Upgrade Pro & User profile at bottom of sidebar */}
        <div className="px-4 mt-auto space-y-4">
          <button 
            onClick={() => navigate('/profile')} 
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-vibrant-purple to-electric-magenta font-label-md text-xs font-bold text-white shadow-lg active:scale-95 transition-transform"
          >
            Upgrade Pro
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
              <p className="text-[10px] text-white/70 truncate">Pro Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 md:ml-64 min-h-screen pb-24 md:pb-8 flex flex-col w-full max-w-full overflow-x-hidden">
        <Header 
          categoria={useMedia().categoria} 
          setCategoria={useMedia().setCategoria} 
          onShowFavorites={handleShowFavorites}
          onShowDashboard={handleShowDashboard}
        />
        <main className="flex-1 relative z-0 w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-[#0d0e12]/90 backdrop-blur-md border-t border-border-glass h-16 flex justify-around items-center px-4 rounded-t-xl shadow-[0_-4px_20px_rgba(139,92,246,0.1)]">
        <button 
          onClick={handleShowDashboard} 
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${
            isHomeActive 
              ? 'bg-secondary-container/20 text-primary font-bold' 
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-lg font-bold" style={{ fontVariationSettings: isHomeActive ? "'FILL' 1" : "'FILL' 0" }}>home</span>
          <span className="font-label-sm text-[10px] mt-0.5">Home</span>
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
          <span className="font-label-sm text-[10px] mt-0.5">Agenda</span>
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
          <span className="font-label-sm text-[10px] mt-0.5">My List</span>
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
          <span className="font-label-sm text-[10px] mt-0.5">Me</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
