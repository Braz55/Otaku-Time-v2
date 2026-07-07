import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { useToast } from '../context/ToastContext';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTranslation } from '../hooks/useTranslation';

const HomePage = () => {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { 
    categoria, 
    isSearchOpen, 
    setIsSearchOpen,
    searchTerm, 
    homeTrigger,
    animeDashboardData,
    setAnimeDashboardData,
    mangaDashboardData,
    setMangaDashboardData
  } = useMedia();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [resultadosPesquisa, setResultadosPesquisa] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingItems, setSavingItems] = useState<Record<number, boolean>>({});

  const escolherDestaque = (
    profileRecent: any[],
    dashboardItems: any[],
    allLibraryItems: any[],
    type: 'anime' | 'manga'
  ) => {
    const libraryItemsArray = Array.isArray(allLibraryItems) ? allLibraryItems : [];
    if (dashboardItems.length === 0) {
      // User is not actively watching/reading anything.
      // Suggest a random item from their library that is not completed/dropped.
      let candidates = libraryItemsArray.filter(item => 
        item.status === 'PLANNED' || item.status === 'PAUSED'
      );
      if (candidates.length === 0) {
        candidates = libraryItemsArray.filter(item => item.status !== 'COMPLETED' && item.status !== 'DROPPED');
      }
      if (candidates.length === 0) {
        candidates = libraryItemsArray;
      }
      
      if (candidates.length > 0) {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        return { ...candidates[randomIndex], highlightReason: 'random_library' };
      }
      return null;
    }

    // Option C: Check if there are any releasing items that were recently updated or had a new episode/chapter recently (within 7 days)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const nowTime = new Date().getTime();

    const newReleaseCandidates = dashboardItems.filter(item => {
      // Must be releasing
      const isReleasing = item.statusLancamento === 'RELEASING';
      if (!isReleasing) return false;

      // Check if update/sync is recent (within 7 days)
      let isRecentUpdate = false;
      if (item.mediaUpdatedAt) {
        const updateTime = new Date(item.mediaUpdatedAt).getTime();
        if (nowTime - updateTime <= SEVEN_DAYS_MS) {
          isRecentUpdate = true;
        }
      }

      // For anime, also check if the last aired episode date is recent
      if (type === 'anime' && item.ultimoEpisodioEstreadoData) {
        const airedTime = new Date(item.ultimoEpisodioEstreadoData).getTime();
        if (nowTime - airedTime <= SEVEN_DAYS_MS) {
          isRecentUpdate = true;
        }
      }

      return isRecentUpdate;
    });

    if (newReleaseCandidates.length > 0) {
      // Pick the most recently updated one
      const sortedNewReleases = [...newReleaseCandidates].sort((a, b) => {
        const timeA = a.mediaUpdatedAt ? new Date(a.mediaUpdatedAt).getTime() : 0;
        const timeB = b.mediaUpdatedAt ? new Date(b.mediaUpdatedAt).getTime() : 0;
        return timeB - timeA;
      });
      return { ...sortedNewReleases[0], highlightReason: 'new_release' };
    }

    const roll = Math.random();
    const isRecent = roll < 0.5;

    if (isRecent) {
      // Option A: 1 of the 3 most recently updated items that match the current category and are in progress
      const recentCandidates = profileRecent.filter(item => 
        item.mediaType === type && 
        dashboardItems.some(d => d.id === item.id)
      );

      if (recentCandidates.length > 0) {
        const randomIndex = Math.floor(Math.random() * recentCandidates.length);
        const selected = recentCandidates[randomIndex];
        const found = dashboardItems.find(d => d.id === selected.id);
        if (found) {
          return { ...found, highlightReason: 'recent' };
        }
        return { ...selected, highlightReason: 'recent' };
      }

      // Fallback: top 3 recently updated active items of the current category
      const activeRecentCandidates = [...dashboardItems]
        .filter(item => item.lastProgressUpdate)
        .sort((a, b) => new Date(b.lastProgressUpdate).getTime() - new Date(a.lastProgressUpdate).getTime())
        .slice(0, 3);

      if (activeRecentCandidates.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeRecentCandidates.length);
        return { ...activeRecentCandidates[randomIndex], highlightReason: 'recent' };
      }
    }

    // Option B: High priority (prioridade <= 3) but oldest update (gathering dust in Up Next)
    let dustCandidates = dashboardItems.filter(item => item.prioridade && item.prioridade <= 3);

    if (dustCandidates.length === 0) {
      dustCandidates = dashboardItems;
    }

    if (dustCandidates.length > 0) {
      const sortedDust = [...dustCandidates].sort((a, b) => {
        const dateA = new Date(a.lastProgressUpdate || a.updatedAt).getTime();
        const dateB = new Date(b.lastProgressUpdate || b.updatedAt).getTime();
        return dateA - dateB;
      });
      return { ...sortedDust[0], highlightReason: 'dust' };
    }

    return dashboardItems[0] ? { ...dashboardItems[0], highlightReason: 'normal' } : null;
  };

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const carregarDashboard = async () => {
    const hasCache = (categoria === 'anime' ? animeDashboardData.items : mangaDashboardData.items).length > 0;
    if (!hasCache) {
      setLoading(true);
    }
    try {
      const [animeRes, mangaRes] = await Promise.all([
        customFetch(`${API_BASE_URL}/anime?status=WATCHING`, { headers: getHeaders() }),
        customFetch(`${API_BASE_URL}/manga?status=WATCHING`, { headers: getHeaders() })
      ]);
      
      const activeAnimes = await animeRes.json();
      const activeMangas = await mangaRes.json();

      let allAnimes: any[] = [];
      let allMangas: any[] = [];
      let filteredAnimes: any[] = [];
      let filteredMangas: any[] = [];

      // If active lists are empty, fetch fallback candidates for the highlight feature
      if (!Array.isArray(activeAnimes) || activeAnimes.length === 0) {
        try {
          const fallbackRes = await customFetch(`${API_BASE_URL}/anime?status=PLANNED,PAUSED`, { headers: getHeaders() });
          if (fallbackRes.ok) {
            allAnimes = await fallbackRes.json();
          }
        } catch (e) {
          console.error("Erro ao carregar fallback anime:", e);
        }
      } else {
        allAnimes = activeAnimes;
      }

      if (!Array.isArray(activeMangas) || activeMangas.length === 0) {
        try {
          const fallbackRes = await customFetch(`${API_BASE_URL}/manga?status=PLANNED,PAUSED`, { headers: getHeaders() });
          if (fallbackRes.ok) {
            allMangas = await fallbackRes.json();
          }
        } catch (e) {
          console.error("Erro ao carregar fallback manga:", e);
        }
      } else {
        allMangas = activeMangas;
      }

      if (Array.isArray(activeAnimes)) {
        filteredAnimes = activeAnimes
          .filter(a => {
            if (a.status !== 'WATCHING') return false;
            const numTotal = a.anime?.numEpisodiosTotal || a.numEpisodiosTotal;
            let maxDisp = numTotal || 9999;
            if (a.anime?.statusLancamento !== 'FINISHED') {
              const now = new Date();
              if (typeof a.numEpisodiosAired === 'number') {
                maxDisp = a.numEpisodiosAired;
              } else {
                const eps = a.episodes || [];
                if (Array.isArray(eps) && eps.length > 0) {
                  maxDisp = eps.filter((ep: any) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= now).length;
                } else {
                  const proxEp = a.anime?.proximoEpisodio || a.proximoEpisodio;
                  if ((a.anime?.statusLancamento === 'RELEASING' || a.statusLancamento === 'RELEASING') && proxEp) {
                    maxDisp = proxEp - 1;
                  }
                }
              }
            }
            const currentGlobal = a.epAtualGlobal !== undefined ? a.epAtualGlobal : (a.epAtual || 0);
            return currentGlobal < maxDisp;
          })
          .sort((a, b) => (a.prioridade || 999) - (b.prioridade || 999));
      }
      if (Array.isArray(activeMangas)) {
        filteredMangas = activeMangas
          .filter(m => {
            if (m.status !== 'WATCHING') return false;
            const status = m.manga?.statusLancamento || m.statusLancamento;
            const proxCap = m.manga?.proximoCapituloNumero || m.proximoCapituloNumero;
            const numTotal = m.manga?.numCapitulosTotal || m.numCapitulosTotal;
            const maxDisp = (status === 'RELEASING' && proxCap) ? proxCap - 1 : (numTotal || 9999);
            return (m.capAtual || 0) < maxDisp;
          })
          .sort((a, b) => (a.prioridade || 999) - (b.prioridade || 999));
      }

      // Calculate combined recent activities (similar to Profile activity)
      const combinedRecent = [
        ...allAnimes.map(a => ({ ...a, mediaType: 'anime' })),
        ...allMangas.map(m => ({ ...m, mediaType: 'manga' }))
      ]
        .filter(item => item.lastProgressUpdate)
        .sort((a, b) => new Date(b.lastProgressUpdate).getTime() - new Date(a.lastProgressUpdate).getTime())
        .slice(0, 3);

      // Select and set highlights
      const featuredAnime = escolherDestaque(combinedRecent, filteredAnimes, allAnimes, 'anime');
      const featuredManga = escolherDestaque(combinedRecent, filteredMangas, allMangas, 'manga');

      setAnimeDashboardData({ items: filteredAnimes, featured: featuredAnime });
      setMangaDashboardData({ items: filteredMangas, featured: featuredManga });
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoVisto = async (item: any, type: 'anime' | 'manga') => {
    if (savingItems[item.id]) return;

    let payload: Record<string, any> = {};
    if (type === 'anime') {
      const currentGlobal = item.epAtualGlobal !== undefined ? item.epAtualGlobal : (item.epAtual || 0);
      let maxDisp = item.anime?.numEpisodiosTotal || item.numEpisodiosTotal || 9999;
      if (item.anime?.statusLancamento !== 'FINISHED') {
        const now = new Date();
        if (typeof item.numEpisodiosAired === 'number') {
          maxDisp = item.numEpisodiosAired;
        } else {
          const eps = item.episodes || [];
          if (Array.isArray(eps) && eps.length > 0) {
            maxDisp = eps.filter((ep: any) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= now).length;
          } else {
            const proxEp = item.anime?.proximoEpisodio || item.proximoEpisodio;
            if ((item.anime?.statusLancamento === 'RELEASING' || item.statusLancamento === 'RELEASING') && proxEp) {
              maxDisp = proxEp - 1;
            }
          }
        }
      }
      if (currentGlobal >= maxDisp) {
        showToast('Não é possível marcar episódios que ainda não estrearam.', 'error');
        return;
      }
      payload = { epAtual: currentGlobal + 1 };
    } else {
      const currentCap = item.capAtual || 0;
      payload = { capAtual: currentCap + 1 };
    }

    setSavingItems(prev => ({ ...prev, [item.id]: true }));
    const url = `${API_BASE_URL}/${type}/${item.id}`;
    
    try {
      const response = await customFetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        await carregarDashboard();
        showToast('Progresso atualizado.', 'success');
      } else {
        showToast('Não foi possível marcar como visto.', 'error');
      }
    } catch (error) {
      console.error("Erro ao marcar como visto:", error);
      showToast('Erro ao marcar como visto.', 'error');
    } finally {
      setSavingItems(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const pesquisar = async (page = 1) => {
    if (!termoPesquisa) return;
    if (page === 1) {
      setLoading(true);
      setSearchPage(1);
    } else {
      setLoadingMore(true);
    }
    const url = `${API_BASE_URL}/${categoria}/search/${encodeURIComponent(termoPesquisa)}?page=${page}`;
    try {
      const response = await customFetch(url, { headers: getHeaders() });
      const data = await response.json();
      const items = Array.isArray(data) ? data : [];
      setHasMoreResults(items.length === 24);
      if (page === 1) {
        setResultadosPesquisa(items);
      } else {
        setResultadosPesquisa(prev => [...prev, ...items]);
      }
      setSearchPage(page);
    } catch (error) {
      console.error("Erro ao pesquisar:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const pesquisarPorGenero = async (genero: string, page = 1) => {
    if (page === 1) {
      setLoading(true);
      setSearchPage(1);
      setSelectedGenre(genero);
      setTermoPesquisa('');
    } else {
      setLoadingMore(true);
    }
    const url = `${API_BASE_URL}/${categoria}/genre/${encodeURIComponent(genero)}?page=${page}`;
    try {
      const response = await customFetch(url, { headers: getHeaders() });
      const data = await response.json();
      const items = Array.isArray(data) ? data : [];
      setHasMoreResults(items.length === 24);
      if (page === 1) {
        setResultadosPesquisa(items);
      } else {
        setResultadosPesquisa(prev => [...prev, ...items]);
      }
      setSearchPage(page);
    } catch (error) {
      console.error("Erro ao pesquisar por género:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const carregarMais = () => {
    const nextPage = searchPage + 1;
    if (selectedGenre) {
      pesquisarPorGenero(selectedGenre, nextPage);
    } else if (termoPesquisa) {
      pesquisar(nextPage);
    }
  };

  useEffect(() => {
    carregarDashboard();
  }, [categoria, homeTrigger]);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    let previousSyncing = false;

    const checkSync = async () => {
      try {
        const res = await customFetch(`${API_BASE_URL}/sync/status`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (previousSyncing && !data.isSyncing) {
            carregarDashboard();
          }
          previousSyncing = data.isSyncing;
        }
      } catch (err) {
        console.error('Error checking sync status:', err);
      }
    };

    const interval = setInterval(checkSync, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!isSearchOpen) {
      setTermoPesquisa('');
      setSelectedGenre(null);
      setResultadosPesquisa([]);
      setSearchPage(1);
      setHasMoreResults(false);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (searchTerm.trim()) {
      setTermoPesquisa(searchTerm);
      const delayDebounceFn = setTimeout(() => {
        const pesquisarComTermo = async (term: string) => {
          setLoading(true);
          setSearchPage(1);
          const url = `${API_BASE_URL}/${categoria}/search/${encodeURIComponent(term)}?page=1`;
          try {
            const response = await customFetch(url, { headers: getHeaders() });
            const data = await response.json();
            const items = Array.isArray(data) ? data : [];
            setHasMoreResults(items.length === 24);
            setResultadosPesquisa(items);
            setSearchPage(1);
          } catch (error) {
            console.error("Erro ao pesquisar:", error);
          } finally {
            setLoading(false);
          }
        };
        pesquisarComTermo(searchTerm);
      }, 350);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setResultadosPesquisa([]);
      setTermoPesquisa('');
    }
  }, [searchTerm, categoria]);

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-4 md:py-8">
      {/* Search Results Grid */}
      {isSearchOpen ? (
        <section className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary font-black animate-pulse">auto_awesome</span>
              <h3 className="font-headline-lg text-xl md:text-2xl text-white">
                Resultados da Pesquisa {selectedGenre ? `- ${selectedGenre}` : ''}
              </h3>
            </div>
            {loading && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6">
            {resultadosPesquisa.length > 0 ? (
              resultadosPesquisa.map((item) => (
                <div 
                  key={item.id} 
                  className="group cursor-pointer space-y-2" 
                  onClick={() => navigate(`/details/${categoria}/${item.id}?external=true&format=${item.format}`)}
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden glass-panel border border-white/5 hover:border-primary/50 transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1 shadow-lg">
                    <img src={item.coverImage.large} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    
                    <div className="absolute bottom-3 left-3 right-3 z-10">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold mb-1.5 ${
                        categoria === 'anime' 
                          ? (item.tipo === 'ANIME' 
                            ? 'bg-primary text-on-primary shadow-[0_0_10px_rgba(221,184,255,0.25)]' 
                            : item.tipo === 'SERIE'
                              ? 'bg-[#e50914] text-white shadow-[0_0_10px_rgba(229,9,20,0.25)]'
                              : 'bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.25)]')
                          : 'bg-secondary text-on-secondary'
                      }`}>
                        {categoria === 'anime' ? (item.tipo === 'SERIE' ? 'SÉRIE' : (item.tipo || 'ANIME')) : categoria.toUpperCase()}
                      </span>
                      <p className="font-bold text-xs text-white line-clamp-1">{item.title.english || item.title.romaji}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              !loading && (
                <div className="col-span-full py-16 text-center glass-panel rounded-3xl border border-white/5">
                  <p className="text-on-surface-variant text-sm font-medium">Nenhum resultado encontrado.</p>
                </div>
              )
            )}
          </div>

          {hasMoreResults && (
            <div className="flex justify-center pt-6">
              <button 
                onClick={carregarMais} 
                disabled={loadingMore}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-md ${categoria === 'anime' ? 'bg-secondary hover:shadow-[0_0_15px_rgba(194,24,91,0.4)]' : 'bg-primary hover:shadow-[0_0_15px_rgba(106,27,154,0.4)]'}`}
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Carregar mais
              </button>
            </div>
          )}
        </section>
      ) : (
        /* Dashboard Home View */
        <div className="w-full space-y-5 md:space-y-12">
          {(() => {
            const dashboardItems = categoria === 'anime' ? animeDashboardData.items : mangaDashboardData.items;
            const featured = categoria === 'anime' ? animeDashboardData.featured : mangaDashboardData.featured;

            if (loading && dashboardItems.length === 0) {
              return (
                <section className={`relative rounded-3xl overflow-hidden glass-panel rim-light flex flex-col justify-center items-center ${isMobile ? 'h-[280px]' : 'h-[240px] md:h-[280px]'} bg-surface-variant/10 border border-white/5 backdrop-blur-md`}>
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative flex items-center justify-center">
                      <div className={`absolute w-16 h-16 rounded-full blur-xl animate-pulse ${categoria === 'anime' ? 'bg-secondary/20' : 'bg-primary/20'}`}></div>
                      <Loader2 className={`w-10 h-10 animate-spin ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`} />
                    </div>
                    <span className={`text-xs font-semibold tracking-widest uppercase animate-pulse ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`}>{t("A carregar destaque...")}</span>
                  </div>
                </section>
              );
            }
            
            if (!featured) {
              return (
                <section className={`relative rounded-3xl overflow-hidden glass-panel rim-light group ${isMobile ? 'py-5 px-5' : 'py-6 px-8'} flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-surface-variant/15 to-surface-variant/5 border border-white/5`}>
                  {/* Glowing background shapes for premium aesthetic */}
                  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                    <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[80px] opacity-20 ${categoria === 'anime' ? 'bg-secondary' : 'bg-primary'}`}></div>
                    <div className={`absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></div>
                  </div>
                  
                  <div className="relative flex-1 min-w-0 flex flex-col justify-center space-y-2.5 z-10">
                    <span className={`w-fit px-2.5 py-0.5 rounded-full text-white font-label-sm text-[9px] uppercase tracking-wider font-bold bg-gradient-to-r ${categoria === 'anime' ? 'from-secondary to-pink-600' : 'from-primary to-purple-600'} shadow-[0_0_12px_rgba(106,27,154,0.3)]`}>
                      {t('Bem-vindo ao Otaku Time!')}
                    </span>
                    <h2 className="font-display-lg text-lg md:text-2xl text-white leading-tight font-black">
                      {t('Começa a acompanhar os teus títulos!')}
                    </h2>
                    <p className="font-body-lg text-[11px] md:text-xs text-on-surface-variant leading-relaxed max-w-xl">
                      {categoria === 'anime' 
                        ? t('Esta é a tua página inicial. Aqui podes ver os próximos episódios a estrear e gerir o teu progresso. Explora as tendências ou pesquisa pelo teu anime favorito para começar!')
                        : t('Esta é a tua página inicial. Aqui podes ver os próximos capítulos a lançar e gerir o teu progresso. Explora as tendências ou pesquisa pelo teu manga favorito para começar!')
                      }
                    </p>
                    
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      <button 
                        onClick={() => navigate('/explore')}
                        className={`px-4 py-2 rounded-xl text-white font-label-md text-[11px] font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer hover:shadow-lg bg-gradient-to-r ${categoria === 'anime' ? 'from-secondary to-pink-600 hover:shadow-[0_0_20px_rgba(194,24,91,0.4)]' : 'from-primary to-purple-600 hover:shadow-[0_0_20px_rgba(106,27,154,0.4)]'}`}
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>explore</span> 
                        {t("Explorar Tendências")}
                      </button>
                      <button 
                        onClick={() => {
                          setIsSearchOpen(true);
                          setTimeout(() => {
                            const searchInput = document.querySelector('input[type="search"]') || document.querySelector('input[placeholder*="Pesquisar"]');
                            if (searchInput) {
                              (searchInput as HTMLElement).focus();
                            }
                          }, 100);
                        }}
                        className="px-4 py-2 rounded-xl text-white font-label-md text-[11px] font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer hover:shadow-lg bg-white/5 hover:bg-white/10 border border-white/10"
                      >
                        <span className="material-symbols-outlined text-sm">search</span> 
                        {t("Pesquisar Títulos")}
                      </button>
                    </div>
                  </div>
                  
                  {/* Visual card badge */}
                  <div className="relative w-full md:w-40 lg:w-44 aspect-[16/9] md:aspect-[4/3] rounded-2xl overflow-hidden border border-white/5 flex-shrink-0 flex items-center justify-center bg-surface-variant/10 backdrop-blur-md self-center z-10">
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                      <div className={`relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${categoria === 'anime' ? 'from-secondary/20 to-pink-500/10' : 'from-primary/20 to-purple-500/10'} border border-white/5`}>
                        <span className={`material-symbols-outlined text-2xl ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`}>
                          {categoria === 'anime' ? 'live_tv' : 'menu_book'}
                        </span>
                      </div>
                      <span className="text-[10px] text-on-surface-variant font-medium leading-normal max-w-[120px]">
                        {categoria === 'anime' ? t('Adiciona animes para veres o teu progresso aqui') : t('Adiciona mangas para veres o teu progresso aqui')}
                      </span>
                    </div>
                  </div>
                </section>
              );
            }

            const heroCover = featured.anime?.capaUrl || featured.manga?.capaUrl || featured.capaUrl;
            const heroTitle = featured.anime?.titulo || featured.manga?.titulo || featured.titulo;
            const heroDesc = featured.anime?.sinopse || featured.manga?.sinopse || featured.anime?.descricao || featured.manga?.descricao || featured.descricao || "Continua a acompanhar o teu anime favorito na lista.";
            
            return (
              <section className={`relative rounded-3xl overflow-hidden glass-panel rim-light group ${isMobile ? 'h-[190px]' : 'h-[240px] md:h-[280px]'} flex items-center`}>
                <div className="absolute inset-0 pointer-events-none z-0">
                  <img 
                     src={heroCover} 
                     className="w-full h-full object-cover scale-125 blur-3xl opacity-20 transition-transform duration-700 group-hover:scale-130" 
                     alt="" 
                     loading="lazy"
                  />
                  <div className="absolute inset-0 bg-[#0F1014]/40"></div>
                  <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-background via-background/40 to-transparent"></div>
                </div>
                
                <div className="relative w-full h-full flex items-center justify-between gap-6 p-5 md:p-8 z-10">
                  <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
                    <span className={`w-fit px-2.5 py-0.5 rounded-full text-white font-label-sm text-[9px] uppercase tracking-wider font-bold ${
                      featured.highlightReason === 'new_release'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse'
                        : categoria === 'anime' ? 'bg-primary' : 'bg-secondary'
                    }`}>
                      {featured.highlightReason === 'new_release'
                        ? (categoria === 'anime' ? t('Novo Episódio') : t('Novo Capítulo'))
                        : featured.highlightReason === 'recent'
                          ? (categoria === 'anime' ? t('A ver mais no momento') : t('A ler mais no momento'))
                          : featured.highlightReason === 'dust'
                            ? t('A apanhar pó na lista')
                            : featured.highlightReason === 'random_library'
                              ? t('Sugestão da tua lista')
                              : t('EM DESTAQUE NA TUA LISTA')}
                    </span>
                    <h2 className="font-display-lg text-lg md:text-2xl text-white leading-tight font-black truncate">{heroTitle}</h2>
                    <p className="font-body-lg text-[11px] md:text-xs text-on-surface-variant line-clamp-2 md:line-clamp-3 leading-relaxed max-w-xl">
                      {heroDesc}
                    </p>
                    <div className="flex gap-2.5 pt-1">
                      <button 
                        onClick={() => navigate(`/details/${categoria}/${featured.id}`)}
                        className={`px-4 py-2 rounded-xl text-white font-label-md text-[11px] font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer hover:shadow-lg ${categoria === 'anime' ? 'bg-secondary hover:shadow-[0_0_20px_rgba(194,24,91,0.4)]' : 'bg-primary hover:shadow-[0_0_20px_rgba(106,27,154,0.4)]'}`}
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>info</span> 
                        {t("Ver Detalhes")}
                      </button>
                    </div>
                  </div>
                  
                  <div className="w-20 xs:w-24 sm:w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/15 flex-shrink-0 relative transition-transform duration-500 group-hover:scale-[1.03] group-hover:rotate-1">
                    <img 
                      src={heroCover} 
                      className="w-full h-full object-cover" 
                      alt="Hero cover" 
                      loading="lazy"
                    />
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Up Next Section */}
          {(() => {
            const dashboardItems = categoria === 'anime' ? animeDashboardData.items : mangaDashboardData.items;
            
            if (dashboardItems.length === 0) {
              return (
                <div className="py-12 text-center glass-panel rounded-3xl border border-white/5 space-y-4">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant">live_tv</span>
                  <p className="text-on-surface font-bold text-base">Nenhum título em progresso.</p>
                  <p className="text-on-surface-variant text-xs">Visita a tua Biblioteca ou pesquisa para começar a ver / ler!</p>
                </div>
              );
            }
            
            return (
              <section className="space-y-4 md:space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <span className={`font-label-md text-[10px] uppercase tracking-widest block mb-1 ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`}>{t("Continuar")}</span>
                    <h3 className="font-headline-lg text-lg md:text-xl text-white font-black">{t(categoria === 'anime' ? 'Próximo Episódio' : 'Próximo Capítulo')}</h3>
                  </div>
                </div>

                {isMobile ? (
                  /* Mobile Scroll Horizontal */
                  <div className="flex overflow-x-auto gap-3 pb-3 scrollbar-hide">
                    {dashboardItems.map((item) => {
                      const coverUrl = item.anime?.capaUrl || item.manga?.capaUrl || item.capaUrl;
                      const title = item.anime?.titulo || item.manga?.titulo || item.titulo;
                      
                      const currentLocal = categoria === 'anime' ? (item.epAtual || 0) : (item.capAtual || 0);
                      const currentGlobal = categoria === 'anime' ? (item.epAtualGlobal !== undefined ? item.epAtualGlobal : (item.epAtual || 0)) : (item.capAtual || 0);
                      const epQueVouVer = currentLocal + 1;
                      
                      const status = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
                      const proxNum = categoria === 'anime' ? (item.anime?.proximoEpisodio || item.proximoEpisodio) : (item.manga?.proximoCapituloNumero || item.proximoCapituloNumero);
                      const numTotal = categoria === 'anime' ? (item.anime?.numEpisodiosTotal || item.numEpisodiosTotal) : (item.manga?.numCapitulosTotal || item.numCapitulosTotal);
                      const total = categoria === 'anime'
                        ? (numTotal || 12)
                        : ((status === 'RELEASING' && proxNum) ? proxNum - 1 : (numTotal || 12));
                      const percent = typeof total === 'number' && total > 0 ? (currentGlobal / total) * 100 : 0;
                      
                      return (
                        <div 
                          key={item.id} 
                          className="glass-panel rim-light p-3 rounded-2xl flex flex-col justify-between hover:border-primary/50 transition-all active:scale-[0.99] duration-300 min-w-[145px] max-w-[145px] flex-shrink-0 cursor-pointer"
                          onClick={() => navigate(`/details/${categoria}/${item.id}`)}
                        >
                          <div className="space-y-1.5">
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/5">
                              <img src={coverUrl} className="w-full h-full object-cover" alt="" loading="lazy" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-60"></div>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-[11px] text-white truncate mb-0.5">{title}</h4>
                              <p className="text-[10px] text-on-surface-variant font-medium">
                                {categoria === 'anime'
                                  ? (item.seasonAtual && item.seasonAtual > 1
                                      ? `T${item.seasonAtual} Ep. ${epQueVouVer}`
                                      : `Episódio ${epQueVouVer}`)
                                  : `Capítulo ${epQueVouVer}`}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 space-y-1.5">
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden border border-white/5">
                              <div 
                                className={`h-full rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="text-[8px] text-on-surface-variant flex items-center gap-0.5 font-bold">
                                <span className={`material-symbols-outlined text-[10px] ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`}>hourglass_empty</span>
                                <span>{(() => {
                                  const left = total > currentGlobal ? total - currentGlobal : 0;
                                  return left === 1 
                                    ? (categoria === 'anime' ? '1 ep' : '1 cap')
                                    : (categoria === 'anime' ? `${left} eps` : `${left} caps`);
                                })()}</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); marcarComoVisto(item, categoria); }}
                                disabled={savingItems[item.id]}
                                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 cursor-pointer border border-white/5"
                                title="Marcar mais um visto"
                              >
                                {savingItems[item.id] ? (
                                  <Loader2 className={`w-3 h-3 animate-spin ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`} />
                                ) : (
                                  <span className="material-symbols-outlined text-xs">play_arrow</span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Desktop Grid Layout */
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {dashboardItems.map((item) => {
                      const coverUrl = item.anime?.capaUrl || item.manga?.capaUrl || item.capaUrl;
                      const title = item.anime?.titulo || item.manga?.titulo || item.titulo;
                      
                      const currentLocal = categoria === 'anime' ? (item.epAtual || 0) : (item.capAtual || 0);
                      const currentGlobal = categoria === 'anime' ? (item.epAtualGlobal !== undefined ? item.epAtualGlobal : (item.epAtual || 0)) : (item.capAtual || 0);
                      const epQueVouVer = currentLocal + 1;
                      
                      const status = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
                      const proxNum = categoria === 'anime' ? (item.anime?.proximoEpisodio || item.proximoEpisodio) : (item.manga?.proximoCapituloNumero || item.proximoCapituloNumero);
                      const numTotal = categoria === 'anime' ? (item.anime?.numEpisodiosTotal || item.numEpisodiosTotal) : (item.manga?.numCapitulosTotal || item.numCapitulosTotal);
                      const total = categoria === 'anime'
                        ? (numTotal || 12)
                        : ((status === 'RELEASING' && proxNum) ? proxNum - 1 : (numTotal || 12));
                      const percent = typeof total === 'number' && total > 0 ? (currentGlobal / total) * 100 : 0;
                      
                      return (
                        <div 
                          key={item.id} 
                          className="glass-panel rim-light p-3.5 rounded-2xl flex gap-4 hover:border-primary/50 transition-all duration-300 cursor-pointer group min-w-0"
                          onClick={() => navigate(`/details/${categoria}/${item.id}`)}
                        >
                          <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 relative">
                            <img src={coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" loading="lazy" />
                          </div>
                          <div className="flex flex-col justify-between py-1 min-w-0 flex-1">
                            <div className="min-w-0 space-y-1">
                              <h4 className="font-label-md text-sm text-white mb-0.5 group-hover:text-primary transition-colors truncate">{title}</h4>
                              <p className="text-xs text-on-surface-variant font-medium">
                                {categoria === 'anime'
                                  ? (item.seasonAtual && item.seasonAtual > 1
                                      ? `T${item.seasonAtual} Ep. ${epQueVouVer}`
                                      : `Episódio ${epQueVouVer}`)
                                  : `Capítulo ${epQueVouVer}`}
                              </p>
                              <div className="w-full pt-1">
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
                                  <div 
                                    className={`h-full rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] text-on-surface-variant flex items-center gap-1 font-bold">
                                <span className={`material-symbols-outlined text-[12px] ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`}>hourglass_empty</span>
                                <span>{(() => {
                                  const left = total > currentGlobal ? total - currentGlobal : 0;
                                  return left === 1 
                                    ? (categoria === 'anime' ? 'Falta 1 ep' : 'Falta 1 cap')
                                    : (categoria === 'anime' ? `Faltam ${left} eps` : `Faltam ${left} caps`);
                                })()}</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); marcarComoVisto(item, categoria); }}
                                disabled={savingItems[item.id]}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 cursor-pointer border border-white/5"
                                title="Marcar mais um visto"
                              >
                                {savingItems[item.id] ? (
                                  <Loader2 className={`w-3.5 h-3.5 animate-spin ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`} />
                                ) : (
                                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default HomePage;
