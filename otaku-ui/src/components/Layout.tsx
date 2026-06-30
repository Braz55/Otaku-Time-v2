import React from 'react';
import { useMedia } from '../context/MediaContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from './Header';
import { useTranslation } from '../hooks/useTranslation';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { PALETTES, getCurrentPalette } from '../services/paletteService';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';

const MangaWebView = registerPlugin<any>('MangaWebView');

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { setIsShowingFavorites, isSearchOpen, setIsSearchOpen, triggerHome } = useMedia();
  const { user, token } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [pendingNavigation, setPendingNavigation] = React.useState<{ path: string; action?: () => void } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  const isAndroid = Capacitor.getPlatform() === 'android';

  React.useEffect(() => {
    if (!isAndroid) return;
    
    // Escutar evento de associação em segundo plano
    const associationListener = MangaWebView.addListener('onAssociateBookmark', async (data: {
      url: string;
      title: string;
      itemId: number;
      itemType: string;
      itemTitle: string;
    }) => {
      try {
        const getUrl = `${API_BASE_URL}/${data.itemType}/${data.itemId}`;
        const getRes = await customFetch(getUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!getRes.ok) return;
        const item = await getRes.json();
        
        const currentLinks = item.linksPersonalizados ? JSON.parse(item.linksPersonalizados) : [];
        let domainName = data.title || 'Favorito';
        try {
          const urlObj = new URL(data.url);
          domainName = urlObj.hostname;
          if (domainName.startsWith('www.')) {
            domainName = domainName.substring(4);
          }
        } catch (e) {}

        if (!currentLinks.some((l: any) => l.url === data.url)) {
          currentLinks.push({
            site: domainName,
            url: data.url,
            language: 'PT',
            type: 'Custom'
          });
        }

        const jsonStr = JSON.stringify(currentLinks);
        
        await customFetch(getUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ linksPersonalizados: jsonStr })
        });
        
        window.dispatchEvent(new CustomEvent('reload-details-links'));
      } catch (e) {
        console.error("Error in background bookmark association:", e);
      }
    });

    return () => {
      associationListener.then((l: any) => l.remove());
    };
  }, [isAndroid, token]);

  const openBrowser = async () => {
    try {
      const paletteName = getCurrentPalette();
      const colors = PALETTES[paletteName] || PALETTES.default;
      
      // Carregar itens da biblioteca para passar ao Android nativo
      let itemsListJson = "[]";
      try {
        const [animesRes, mangasRes] = await Promise.all([
          customFetch(`${API_BASE_URL}/anime`, { headers: { 'Authorization': `Bearer ${token}` } }),
          customFetch(`${API_BASE_URL}/manga`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const animes = animesRes.ok ? await animesRes.json() : [];
        const mangas = mangasRes.ok ? await mangasRes.json() : [];
        
        const items = [
          ...animes.map((a: any) => ({ id: a.id, titulo: a.anime?.titulo || a.titulo || '', tipo: 'anime' })),
          ...mangas.map((m: any) => ({ id: m.id, titulo: m.manga?.titulo || m.titulo || '', tipo: 'manga' }))
        ];
        itemsListJson = JSON.stringify(items);
      } catch (e) {
        console.error("Error loading library items:", e);
      }

      await MangaWebView.open({
        url: '',
        primaryColor: colors.primary,
        secondaryColor: colors.secondary,
        userId: user?.id || 'guest',
        libraryItems: itemsListJson
      });
    } catch (e) {
      console.error('Error opening browser:', e);
    }
  };

  React.useEffect(() => {
    const handleShowModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      setPendingNavigation({
        path: '',
        action: customEvent.detail?.action
      });
    };
    window.addEventListener('show-unsaved-changes-modal', handleShowModal);
    return () => {
      window.removeEventListener('show-unsaved-changes-modal', handleShowModal);
    };
  }, []);

  const safeNavigate = (path: string, action?: () => void) => {
    if ((window as any).hasUnsavedChanges) {
      setPendingNavigation({ path, action });
      return;
    }
    if (action) {
      action();
    } else {
      navigate(path);
    }
  };

  const handleShowFavorites = () => {
    safeNavigate('/library', () => {
      setIsShowingFavorites(true);
      setIsSearchOpen(false);
      navigate('/library');
    });
  };

  const handleShowDashboard = () => {
    safeNavigate('/', () => {
      triggerHome();
      navigate('/');
    });
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
            onClick={() => safeNavigate('/explore', () => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/explore'); })}
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
            onClick={() => safeNavigate('/calendar', () => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/calendar'); })}
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
            onClick={() => safeNavigate('/profile', () => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/profile'); })}
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
            onClick={() => setShowUpgradeModal(true)} 
            className="w-full py-3.5 rounded-xl bg-secondary font-label-md text-xs font-bold text-white shadow-lg active:scale-95 transition-transform"
          >
             {t("Upgrade Pro")}
          </button>

          {/* User Profile Card */}
          <div 
            onClick={() => safeNavigate('/profile')}
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
            onClick={() => safeNavigate('/explore', () => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/explore'); })} 
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
            onClick={() => safeNavigate('/calendar', () => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/calendar'); })} 
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
            onClick={() => safeNavigate('/profile', () => { setIsSearchOpen(false); setIsShowingFavorites(false); navigate('/profile'); })} 
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

      {pendingNavigation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-surface-container rounded-[24px] border border-white/10 shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-error text-2xl">warning</span>
              <h3 className="font-display-md text-lg font-extrabold text-white">Alterações não guardadas</h3>
            </div>
            
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tens alterações não guardadas nesta lista. Tens a certeza que queres sair sem guardar? As tuas alterações serão perdidas.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setPendingNavigation(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-95 text-center cursor-pointer font-black"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const { path, action } = pendingNavigation;
                  (window as any).hasUnsavedChanges = false;
                  setPendingNavigation(null);
                  if (action) {
                    action();
                  } else {
                    navigate(path);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-error text-white font-black text-xs transition-all active:scale-95 text-center cursor-pointer shadow-lg"
              >
                Sair sem guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-surface-container rounded-[24px] border border-white/10 shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            
            {/* Background glowing effects to make it feel premium */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-secondary/20 rounded-full blur-2xl pointer-events-none" />

            <div className="w-12 h-12 rounded-full bg-secondary/15 flex items-center justify-center text-secondary mb-4 relative z-10 border border-secondary/20">
              <span className="material-symbols-outlined text-2xl font-bold">workspace_premium</span>
            </div>
            
            <h3 className="font-display-md text-lg font-extrabold text-white mb-2 relative z-10">
              {t("Upgrade Pro")}
            </h3>
            
            <p className="text-xs text-on-surface-variant leading-relaxed mb-6 relative z-10">
              {t("Esta funcionalidade estará disponível em breve! Fica atento às próximas novidades do Otaku Time.")}
            </p>

            <button
              onClick={() => setShowUpgradeModal(false)}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-light text-on-primary font-black text-xs transition-all active:scale-95 text-center cursor-pointer shadow-lg relative z-10"
            >
              {t("Fechar")}
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button for Browser (Android Only) */}
      {isAndroid && (
        <button
          onClick={openBrowser}
          className="fixed bottom-20 right-4 z-[99] w-10 h-10 rounded-full bg-primary hover:bg-primary-light text-on-primary shadow-2xl flex items-center justify-center active:scale-95 transition-transform border border-white/10"
          aria-label="Navegador Web"
        >
          <span className="material-symbols-outlined text-lg font-bold">travel_explore</span>
        </button>
      )}

    </div>
  );
};

export default Layout;
