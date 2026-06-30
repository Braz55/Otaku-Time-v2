import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useMedia } from '../context/MediaContext';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useTranslation } from '../hooks/useTranslation';

interface HeaderProps {
  categoria: 'anime' | 'manga';
  setCategoria: (cat: 'anime' | 'manga') => void;
  onShowFavorites: () => void;
  onShowDashboard: () => void;
}

const SyncIndicator: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="group relative flex items-center justify-center p-1.5 cursor-pointer outline-none" tabIndex={0}>
      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.8 16.3C19.57 15.05 20 13.58 20 12C20 7.58 16.42 4 12 4Z" className="text-primary" fill="currentColor" />
        <path d="M12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.2 7.7C4.43 8.95 4 10.42 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" className="text-secondary" fill="currentColor" />
      </svg>

      {/* Premium Tooltip */}
      <div className="absolute right-0 top-full mt-2 w-48 p-2.5 rounded-xl bg-surface-container border border-white/10 shadow-2xl text-[10px] font-bold text-white leading-normal text-center pointer-events-none opacity-0 scale-95 origin-top-right group-hover:opacity-100 group-hover:scale-100 group-focus:opacity-100 group-focus:scale-100 group-active:opacity-100 group-active:scale-100 transition-all duration-200 z-50">
        <div className="absolute -top-1 right-3.5 w-2.5 h-2.5 bg-surface-container border-t border-l border-white/10 rotate-45" />
        {t("A carregar os conteúdos mais recentes...")}
      </div>
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ categoria, setCategoria, onShowDashboard }) => {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { searchTerm, setSearchTerm, isSearchOpen, setIsSearchOpen, setIsShowingFavorites, isViewingDetails } = useMedia();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await customFetch(`${API_BASE_URL}/notification`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [token]);

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

  const handleMarkRead = async (id: number) => {
    if (!token) return;
    try {
      const res = await customFetch(`${API_BASE_URL}/notification/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      const res = await customFetch(`${API_BASE_URL}/notification/read-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        showToast(t("Todas as notificações marcadas como lidas."), "success");
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDeleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const res = await customFetch(`${API_BASE_URL}/notification/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleClearAll = async () => {
    if (!token) return;
    try {
      const res = await customFetch(`${API_BASE_URL}/notification`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications([]);
        showToast(t("Todas as notificações apagadas."), "success");
      }
    } catch (err) {
      console.error('Error deleting all notifications:', err);
    }
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.read) {
      await handleMarkRead(n.id);
    }
    setIsDropdownOpen(false);
    if (n.mediaId && n.type) {
      navigate(`/details/${n.type.toLowerCase()}/${n.mediaId}`);
    }
  };

  const formatNotificationTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) {
        return diffMins <= 1 ? t("Agora mesmo") : `${diffMins}m`;
      }
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return `${diffHours}h`;
      }
      return date.toLocaleDateString(lang === 'PT' ? 'pt-PT' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-30 bg-transparent" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
      {isMobile ? (
        /* Top App Bar Mobile */
        <header className="fixed top-0 left-0 w-full z-40 bg-background/85 backdrop-blur-xl border-b border-border-glass flex flex-col justify-end px-margin-mobile safe-h-nav-top">
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
                  placeholder={t("Pesquisar anime ou manga...")} 
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
                    className="hidden sm:block font-display-md text-base sm:text-lg font-extrabold text-primary tracking-tight cursor-pointer truncate flex-shrink-0"
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
                      {t("Anime")}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setCategoria('manga')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${categoria === 'manga' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'}`}
                    >
                      {t("Mangá")}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isSyncing && <SyncIndicator />}
                  
                  {/* Notifications Mobile */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="active:scale-95 duration-200 text-primary flex-shrink-0 p-1.5 flex items-center justify-center relative cursor-pointer"
                    >
                      <span className="material-symbols-outlined !text-[22px]">notifications</span>
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 bg-primary text-on-primary text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-lg border border-background">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute right-[-40px] mt-2 w-72 xs:w-80 rounded-2xl bg-surface-container/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 max-h-[380px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/20">
                          <span className="font-bold text-xs text-white">{t("Notificações")}</span>
                          {unreadCount > 0 && (
                            <button 
                              onClick={handleMarkAllRead}
                              className="text-[10px] text-primary hover:underline font-semibold"
                            >
                              {t("Marcar todas como lidas")}
                            </button>
                          )}
                        </div>
                        
                        <div className="overflow-y-auto max-h-[260px] divide-y divide-white/5 scrollbar-thin">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-on-surface-variant text-xs flex flex-col items-center gap-1.5">
                              <span className="material-symbols-outlined text-2xl opacity-30">notifications_off</span>
                              <span>{t("Sem notificações")}</span>
                            </div>
                          ) : (
                            notifications.map((n) => (
                              <div 
                                key={n.id}
                                onClick={() => handleNotificationClick(n)}
                                className={`p-3 flex items-start gap-2.5 cursor-pointer hover:bg-white/5 transition-colors relative group ${!n.read ? 'bg-primary/5' : ''}`}
                              >
                                {!n.read && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{n.title}</p>
                                  <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">{n.message}</p>
                                  <span className="text-[9px] text-on-surface-variant/60 mt-1 block">
                                    {formatNotificationTime(n.createdAt)}
                                  </span>
                                </div>
                                <button 
                                  onClick={(e) => handleDeleteNotification(n.id, e)}
                                  className="text-on-surface-variant hover:text-red-400 opacity-60 hover:opacity-100 p-1 rounded transition-all material-symbols-outlined !text-base ml-1"
                                >
                                  delete
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                        
                        {notifications.length > 0 && (
                          <div className="p-2 border-t border-white/10 bg-black/10 text-center">
                            <button 
                              onClick={handleClearAll}
                              className="text-[11px] text-red-400 hover:text-red-300 font-semibold transition-colors"
                            >
                              {t("Limpar tudo")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

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
        <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] z-30 bg-background/80 backdrop-blur-2xl border-b border-border-glass h-20 flex justify-between items-center px-6 md:px-margin-desktop">
          {/* Search Bar & Switcher */}
          <div className="flex items-center flex-1 max-w-2xl gap-4">
            <div className="relative w-full focus-within:ring-2 focus-within:ring-primary/50 rounded-full transition-all">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input 
                className="w-full bg-deep-gray border-none rounded-full py-2.5 pl-12 pr-4 text-sm text-on-surface focus:ring-0 placeholder:text-outline-variant outline-none" 
                placeholder={t("Pesquisar anime ou manga...")} 
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
                {t("Anime")}
              </button>
              <button 
                type="button"
                onClick={() => setCategoria('manga')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${categoria === 'manga' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-white'}`}
              >
                {t("Mangá")}
              </button>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="flex items-center gap-6 ml-6">
            {isSyncing && <SyncIndicator />}
            
            {/* Notifications Desktop */}
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors cursor-pointer relative flex items-center justify-center p-1.5"
              >
                notifications
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-primary text-on-primary text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-lg border border-background">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-surface-container/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 max-h-[420px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
                    <span className="font-bold text-sm text-white">{t("Notificações")}</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllRead}
                        className="text-xs text-primary hover:underline font-semibold"
                      >
                        {t("Marcar todas como lidas")}
                      </button>
                    )}
                  </div>
                  
                  <div className="overflow-y-auto max-h-[300px] divide-y divide-white/5 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-on-surface-variant text-xs flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-3xl opacity-30">notifications_off</span>
                        <span>{t("Sem notificações")}</span>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 flex items-start gap-3 cursor-pointer hover:bg-white/5 transition-colors relative group ${!n.read ? 'bg-primary/5' : ''}`}
                        >
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{n.title}</p>
                            <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">{n.message}</p>
                            <span className="text-[10px] text-on-surface-variant/60 mt-1 block">
                              {formatNotificationTime(n.createdAt)}
                            </span>
                          </div>
                          <button 
                            onClick={(e) => handleDeleteNotification(n.id, e)}
                            className="text-on-surface-variant hover:text-red-400 opacity-0 group-hover:opacity-100 p-1 rounded transition-all material-symbols-outlined !text-base ml-1"
                          >
                            delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="p-2.5 border-t border-white/10 bg-black/10 text-center">
                      <button 
                        onClick={handleClearAll}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors"
                      >
                        {t("Limpar tudo")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

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
