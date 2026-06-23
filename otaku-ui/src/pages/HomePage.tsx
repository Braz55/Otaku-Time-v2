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
  const { categoria, isSearchOpen, searchTerm, homeTrigger } = useMedia();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [resultadosPesquisa, setResultadosPesquisa] = useState<any[]>([]);
  const [animesDashboard, setAnimesDashboard] = useState<any[]>([]);
  const [mangasDashboard, setMangasDashboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingItems, setSavingItems] = useState<Record<number, boolean>>({});

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const carregarDashboard = async () => {
    setLoading(true);
    try {
      const [animeRes, mangaRes] = await Promise.all([
        customFetch(`${API_BASE_URL}/anime`, { headers: getHeaders() }),
        customFetch(`${API_BASE_URL}/manga`, { headers: getHeaders() })
      ]);
      
      const animes = await animeRes.json();
      const mangas = await mangaRes.json();

      if (Array.isArray(animes)) {
        setAnimesDashboard(
          animes
            .filter(a => {
              if (a.status !== 'WATCHING') return false;
              const status = a.anime?.statusLancamento || a.statusLancamento;
              const proxEp = a.anime?.proximoEpisodio || a.proximoEpisodio;
              const numTotal = a.anime?.numEpisodiosTotal || a.numEpisodiosTotal;
              const maxDisp = (status === 'RELEASING' && proxEp) ? proxEp - 1 : (numTotal || 9999);
              return (a.epAtual || 0) < maxDisp;
            })
            .sort((a, b) => (a.prioridade || 999) - (b.prioridade || 999))
        );
      }
      if (Array.isArray(mangas)) {
        setMangasDashboard(
          mangas
            .filter(m => {
              if (m.status !== 'WATCHING') return false;
              const status = m.manga?.statusLancamento || m.statusLancamento;
              const proxCap = m.manga?.proximoCapituloNumero || m.proximoCapituloNumero;
              const numTotal = m.manga?.numCapitulosTotal || m.numCapitulosTotal;
              const maxDisp = (status === 'RELEASING' && proxCap) ? proxCap - 1 : (numTotal || 9999);
              return (m.capAtual || 0) < maxDisp;
            })
            .sort((a, b) => (a.prioridade || 999) - (b.prioridade || 999))
        );
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoVisto = async (item: any, type: 'anime' | 'manga') => {
    if (savingItems[item.id]) return;
    setSavingItems(prev => ({ ...prev, [item.id]: true }));

    const campo = type === 'anime' ? 'epAtual' : 'capAtual';
    const novoValor = (item[campo] || 0) + 1;
    const url = `${API_BASE_URL}/${type}/${item.id}`;
    
    try {
      const response = await customFetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ [campo]: novoValor })
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
                  onClick={() => navigate(`/details/${categoria}/${item.id}?external=true`)}
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden glass-panel border border-white/5 hover:border-primary/50 transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1 shadow-lg">
                    <img src={item.coverImage.large} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    
                    <div className="absolute bottom-3 left-3 right-3 z-10">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold mb-1.5 ${categoria === 'anime' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>
                        {categoria.toUpperCase()}
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
            const dashboardItems = categoria === 'anime' ? animesDashboard : mangasDashboard;
            const featured = dashboardItems[0];

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
            
            const heroCover = featured 
              ? (featured.anime?.capaUrl || featured.manga?.capaUrl || featured.capaUrl) 
              : "https://lh3.googleusercontent.com/aida-public/AB6AXuAdtT1AIxrRwBQnzU-fRoU_CPtKD9Xg1BvY8Y0s8RmV9b72bUNwYypAj6y1bSs3zGLoHsC42HBjrc-vfOd-GCn8zJ7t7_bAD64gVr-zkqRjmztIwOu65eWLmgtjLa7JAfnvqQfYW8zyifOI02asFkKaoqhR5efMIXzhP1VCrztKNkT-VnbHIY6U8jNEjGTUgZ2KmPbTyk_yFAVbf66hQw16YdK6fz4WhziI1BJhuQPEW8mcUT8GLAug_FE1_g-JhwikhX1qCIAflXZZ";
            
            const heroTitle = featured ? (featured.anime?.titulo || featured.manga?.titulo || featured.titulo) : "Cyberpunk: Edgerunners";
            const heroDesc = featured ? (featured.anime?.sinopse || featured.manga?.sinopse || featured.descricao || "Continua a acompanhar o teu anime favorito na lista.") : "Numa distopia mergulhada em corrupção e implantes cibernéticos, um talentoso miúdo de rua decide tornar-se um fora da lei.";
            
            return (
              <section className={`relative rounded-3xl overflow-hidden glass-panel rim-light group ${isMobile ? 'h-[190px]' : 'h-[240px] md:h-[280px]'} flex items-center`}>
                <div className="absolute inset-0 pointer-events-none z-0">
                  <img 
                    src={heroCover} 
                    className="w-full h-full object-cover scale-125 blur-3xl opacity-20 transition-transform duration-700 group-hover:scale-130" 
                    alt="" 
                  />
                  <div className="absolute inset-0 bg-[#0F1014]/40"></div>
                  <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-background via-background/40 to-transparent"></div>
                </div>
                
                <div className="relative w-full h-full flex items-center justify-between gap-6 p-5 md:p-8 z-10">
                  <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
                    <span className={`w-fit px-2.5 py-0.5 rounded-full text-white font-label-sm text-[9px] uppercase tracking-wider font-bold ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}>
                      {featured ? t('EM DESTAQUE NA TUA LISTA') : t('DESTAQUE DA SEMANA')}
                    </span>
                    <h2 className="font-display-lg text-lg md:text-2xl text-white leading-tight font-black truncate">{heroTitle}</h2>
                    <p className="font-body-lg text-[11px] md:text-xs text-on-surface-variant line-clamp-2 md:line-clamp-3 leading-relaxed max-w-xl">
                      {heroDesc}
                    </p>
                    <div className="flex gap-2.5 pt-1">
                      <button 
                        onClick={() => featured ? navigate(`/details/${categoria}/${featured.id}`) : showToast(t("Procura por Cyberpunk na barra superior!"), "info")}
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
                    />
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Up Next Section */}
          {(() => {
            const dashboardItems = categoria === 'anime' ? animesDashboard : mangasDashboard;
            
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
                      const current = categoria === 'anime' ? (item.epAtual || 0) : (item.capAtual || 0);
                      const epQueVouVer = current + 1;
                      
                      const status = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
                      const proxNum = categoria === 'anime' ? (item.anime?.proximoEpisodio || item.proximoEpisodio) : (item.manga?.proximoCapituloNumero || item.proximoCapituloNumero);
                      const numTotal = categoria === 'anime' ? (item.anime?.numEpisodiosTotal || item.numEpisodiosTotal) : (item.manga?.numCapitulosTotal || item.numCapitulosTotal);
                      const total = (status === 'RELEASING' && proxNum) ? proxNum - 1 : (numTotal || 12);
                      const percent = typeof total === 'number' && total > 0 ? (current / total) * 100 : 0;
                      
                      return (
                        <div 
                          key={item.id} 
                          className="glass-panel rim-light p-3 rounded-2xl flex flex-col justify-between hover:border-primary/50 transition-all active:scale-[0.99] duration-300 min-w-[145px] max-w-[145px] flex-shrink-0 cursor-pointer"
                          onClick={() => navigate(`/details/${categoria}/${item.id}`)}
                        >
                          <div className="space-y-1.5">
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/5">
                              <img src={coverUrl} className="w-full h-full object-cover" alt="" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-60"></div>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-[11px] text-white truncate mb-0.5">{title}</h4>
                              <p className="text-[10px] text-on-surface-variant font-medium">
                                {categoria === 'anime' ? `Episódio ${epQueVouVer}` : `Capítulo ${epQueVouVer}`}
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
                                  const left = total > current ? total - current : 0;
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
                      const current = categoria === 'anime' ? (item.epAtual || 0) : (item.capAtual || 0);
                      const epQueVouVer = current + 1;
                      
                      const status = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
                      const proxNum = categoria === 'anime' ? (item.anime?.proximoEpisodio || item.proximoEpisodio) : (item.manga?.proximoCapituloNumero || item.proximoCapituloNumero);
                      const numTotal = categoria === 'anime' ? (item.anime?.numEpisodiosTotal || item.numEpisodiosTotal) : (item.manga?.numCapitulosTotal || item.numCapitulosTotal);
                      const total = (status === 'RELEASING' && proxNum) ? proxNum - 1 : (numTotal || 12);
                      const percent = typeof total === 'number' && total > 0 ? (current / total) * 100 : 0;
                      
                      return (
                        <div 
                          key={item.id} 
                          className="glass-panel rim-light p-3.5 rounded-2xl flex gap-4 hover:border-primary/50 transition-all duration-300 cursor-pointer group min-w-0"
                          onClick={() => navigate(`/details/${categoria}/${item.id}`)}
                        >
                          <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 relative">
                            <img src={coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                          </div>
                          <div className="flex flex-col justify-between py-1 min-w-0 flex-1">
                            <div className="min-w-0 space-y-1">
                              <h4 className="font-label-md text-sm text-white mb-0.5 group-hover:text-primary transition-colors truncate">{title}</h4>
                              <p className="text-xs text-on-surface-variant font-medium">
                                {categoria === 'anime' ? `Episódio ${epQueVouVer}` : `Capítulo ${epQueVouVer}`}
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
                                  const left = total > current ? total - current : 0;
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
