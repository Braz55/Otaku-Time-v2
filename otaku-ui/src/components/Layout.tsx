import React from 'react';
import { useMedia } from '../context/MediaContext';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { categoria, setCategoria, isShowingFavorites, setIsShowingFavorites, isSearchOpen, setIsSearchOpen, triggerHome } = useMedia();
  const navigate = useNavigate();
  const location = useLocation();

  const handleShowFavorites = () => {
    setIsShowingFavorites(true);
    setIsSearchOpen(false);
    if (location.pathname !== '/') navigate('/');
  };

  const handleOpenSearch = () => {
    setIsSearchOpen(true);
    setIsShowingFavorites(false);
    if (location.pathname !== '/') navigate('/');
  };

  const handleShowDashboard = () => {
    triggerHome();
    if (location.pathname !== '/') navigate('/');
  };

  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-primary selection:text-on-primary font-body-md flex">
      {/* SideNavBar Anchor */}
      <aside className="hidden lg:flex flex-col h-screen fixed left-0 top-0 p-6 space-y-8 w-64 bg-surface-container-low border-r border-white/5 shadow-xl z-50">
        <div className="flex items-center gap-3 px-2 cursor-pointer" onClick={handleShowDashboard}>
          <img src="/logo.png" className="w-9 h-9 rounded-xl shadow-lg border border-white/10 object-cover" alt="Logo" />
          <span className="text-headline-lg font-display-lg text-primary-light font-black tracking-tight">Otaku-Time</span>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={handleShowDashboard} className={`flex items-center gap-4 px-4 py-3 w-full rounded-2xl font-bold transition-all duration-300 ease-in-out ${location.pathname === '/' && !isShowingFavorites && !isSearchOpen ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            <span className="font-label-md text-label-md">Home</span>
          </button>
          <button onClick={handleOpenSearch} className={`flex items-center gap-4 px-4 py-3 w-full rounded-2xl font-bold transition-all duration-300 ease-in-out ${isSearchOpen ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}>
            <span className="material-symbols-outlined">search</span>
            <span className="font-label-md text-label-md">Search</span>
          </button>
          <button onClick={handleShowFavorites} className={`flex items-center gap-4 px-4 py-3 w-full rounded-2xl font-bold transition-all duration-300 ease-in-out ${location.pathname === '/' && isShowingFavorites && !isSearchOpen ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}>
            <span className="material-symbols-outlined">video_library</span>
            <span className="font-label-md text-label-md">Library</span>
          </button>
          <button onClick={() => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/calendar'); }} className={`flex items-center gap-4 px-4 py-3 w-full rounded-2xl font-bold transition-all duration-300 ease-in-out ${location.pathname === '/calendar' ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}>
            <span className="material-symbols-outlined">calendar_today</span>
            <span className="font-label-md text-label-md">Calendar</span>
          </button>
        </nav>
        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 cursor-pointer group" onClick={() => navigate('/profile')}>
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container overflow-hidden group-hover:scale-105 transition-transform shadow-md">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <p className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors">Enthusiast</p>
              <p className="text-xs text-on-surface-variant">Pro Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 lg:ml-64 min-h-screen pb-24 lg:pb-12 flex flex-col">
        <Header 
          categoria={categoria} 
          setCategoria={setCategoria} 
          onShowFavorites={handleShowFavorites}
          onShowDashboard={handleShowDashboard}
        />
        <main className="flex-1 relative z-0">
          {children}
        </main>
      </div>

      {/* BottomNavBar Anchor (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center pt-3 pb-8 sm:pb-6 px-margin-mobile bg-surface-container/90 backdrop-blur-2xl border-t border-white/10 lg:hidden rounded-t-xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        <button onClick={handleShowDashboard} className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${location.pathname === '/' && !isShowingFavorites && !isSearchOpen ? 'bg-primary text-on-primary shadow-lg shadow-primary/30' : 'text-on-surface-variant hover:text-white transition-all'}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          <span className="font-label-sm text-label-sm">Home</span>
        </button>
        <button onClick={handleOpenSearch} className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${isSearchOpen ? 'bg-primary text-on-primary shadow-lg shadow-primary/30' : 'text-on-surface-variant hover:text-white transition-all'}`}>
          <span className="material-symbols-outlined">search</span>
          <span className="font-label-sm text-label-sm">Search</span>
        </button>
        <button onClick={handleShowFavorites} className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${location.pathname === '/' && isShowingFavorites && !isSearchOpen ? 'bg-primary text-on-primary shadow-lg shadow-primary/30' : 'text-on-surface-variant hover:text-white transition-all'}`}>
          <span className="material-symbols-outlined">video_library</span>
          <span className="font-label-sm text-label-sm">Library</span>
        </button>
        <button onClick={() => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/calendar'); }} className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 active:scale-90 duration-150 ${location.pathname === '/calendar' ? 'bg-primary text-on-primary shadow-lg shadow-primary/30' : 'text-on-surface-variant hover:text-white transition-all'}`}>
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="font-label-sm text-label-sm">Calendar</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;
