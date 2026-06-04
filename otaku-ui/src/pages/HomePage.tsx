import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { useToast } from '../context/ToastContext';
import { Loader2 } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';

const MangaWebView = registerPlugin<any>('MangaWebView');

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
  "Horror", "Mecha", "Mystery", "Psychological", "Romance", 
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
];

const TRACKING_STATUS_OPTIONS = [
  { value: 'WATCHING', animeLabel: 'Watching', mangaLabel: 'Reading' },
  { value: 'PLANNED', animeLabel: 'Plan to Watch', mangaLabel: 'Plan to Read' },
  { value: 'COMPLETED', animeLabel: 'Completed', mangaLabel: 'Completed' },
  { value: 'PAUSED', animeLabel: 'Paused', mangaLabel: 'Paused' },
  { value: 'DROPPED', animeLabel: 'Dropped', mangaLabel: 'Dropped' },
];

const PRIORITY_OPTIONS = [
  { num: 1, label: 'P1', desc: 'Highest', colorClass: 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]', starColor: 'text-amber-500', badgeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-400' },
  { num: 2, label: 'P2', desc: 'High', colorClass: 'bg-amber-400/20 border-amber-400 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]', starColor: 'text-amber-400', badgeClass: 'bg-amber-400/20 border-amber-400/50 text-amber-300' },
  { num: 3, label: 'P3', desc: 'Medium-High', colorClass: 'bg-yellow-400/20 border-yellow-400 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]', starColor: 'text-yellow-400', badgeClass: 'bg-yellow-400/20 border-yellow-400/50 text-yellow-200' },
  { num: 4, label: 'P4', desc: 'Medium', colorClass: 'bg-yellow-200/20 border-yellow-200 text-yellow-200 shadow-[0_0_15px_rgba(254,240,138,0.2)]', starColor: 'text-yellow-200', badgeClass: 'bg-yellow-200/20 border-yellow-200/50 text-yellow-100' },
  { num: 5, label: 'P5', desc: 'Medium-Low', colorClass: 'bg-yellow-100/10 border-yellow-100/50 text-yellow-100', starColor: 'text-yellow-100', badgeClass: 'bg-yellow-100/10 border-yellow-100/30 text-yellow-50' },
  { num: 6, label: 'P6', desc: 'Low', colorClass: 'bg-blue-500/10 border-blue-500/50 text-blue-300', starColor: 'text-blue-400', badgeClass: 'bg-blue-500/10 border-blue-500/30 text-blue-300' },
  { num: 7, label: 'P7', desc: 'Very Low', colorClass: 'bg-blue-400/10 border-blue-400/50 text-blue-200', starColor: 'text-blue-300', badgeClass: 'bg-blue-400/10 border-blue-400/30 text-blue-200' },
  { num: 8, label: 'P8', desc: 'Lower', colorClass: 'bg-slate-400/10 border-slate-400/50 text-slate-300', starColor: 'text-slate-300', badgeClass: 'bg-slate-400/10 border-slate-400/30 text-slate-300' },
  { num: 9, label: 'P9', desc: 'Lowest', colorClass: 'bg-slate-500/10 border-slate-500/50 text-slate-400', starColor: 'text-slate-400', badgeClass: 'bg-slate-500/10 border-slate-500/30 text-slate-400' },
  { num: 10, label: 'P10', desc: 'Backlog', colorClass: 'bg-slate-600/10 border-slate-600/50 text-slate-500', starColor: 'text-slate-500', badgeClass: 'bg-slate-600/10 border-slate-600/30 text-slate-500' },
];

const getPriorityBadgeClass = (priority?: number | null) => {
  const opt = PRIORITY_OPTIONS.find(o => o.num === priority);
  return opt ? opt.badgeClass : 'bg-yellow-100/10 border-yellow-100/30 text-yellow-50';
};

const getPriorityStarColor = (priority?: number | null) => {
  const opt = PRIORITY_OPTIONS.find(o => o.num === priority);
  return opt ? opt.starColor : 'text-yellow-100';
};

const formatLastModified = (item: any) => {
  const dateStr = item?.updatedAt || item?.anime?.updatedAt || item?.manga?.updatedAt;
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return 'N/A';
  }
};

const HomePage = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const { categoria, setCategoria, isShowingFavorites, setIsShowingFavorites, isSearchOpen, homeTrigger } = useMedia();
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [resultadosPesquisa, setResultadosPesquisa] = useState<any[]>([]);
  const [resultadosDB, setResultadosDB] = useState<any[]>([]);
  const [animesDashboard, setAnimesDashboard] = useState<any[]>([]);
  const [mangasDashboard, setMangasDashboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'home' | 'details'>('home');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showEpList, setShowEpList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [latestChapter, setLatestChapter] = useState<number | null>(null);
  const [latestChapterSource, setLatestChapterSource] = useState<string>('MangaDex');
  const [latestChapterError, setLatestChapterError] = useState<string | null>(null);
  const [latestBreakdown, setLatestBreakdown] = useState<any[]>([]);
  const [loadingLatest, setLoadingLatest] = useState(false);
  
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkSite, setNewLinkSite] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const [savingItems, setSavingItems] = useState<Record<number, boolean>>({});
  const [isSavingDetailsProgress, setIsSavingDetailsProgress] = useState(false);

  const [filtroStatus, setFiltroStatus] = useState<string>('ALL');
  const [filtroLancamento, setFiltroLancamento] = useState<string>('ALL');
  const [ordenacao, setOrdenacao] = useState<string>('PRIORITY');
  const [showLancamentoMenu, setShowLancamentoMenu] = useState(false);
  const [showOrdemMenu, setShowOrdemMenu] = useState(false);
  const [showGenres, setShowGenres] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const carregarCapituloMaisRecente = async (anilistId: number, keepState = false) => {
    if (categoria !== 'manga') return;
    setLoadingLatest(true);
    if (!keepState) {
      setLatestChapter(null);
      setLatestChapterSource('MangaDex');
      setLatestChapterError(null);
      setLatestBreakdown([]);
    }
    try {
      const res = await customFetch(`${API_BASE_URL}/manga/latest-chapter/${anilistId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data) {
        if (data.latest) setLatestChapter(data.latest);
        if (data.source) setLatestChapterSource(data.source);
        if (data.error) setLatestChapterError(data.error);
        if (data.breakdown) setLatestBreakdown(data.breakdown);
      }
    } catch (err) {
      console.error('Erro ao carregar cap mais recente:', err);
    } finally {
      setLoadingLatest(false);
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
    setIsShowingFavorites(false);
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

  const adicionarAoBanco = async (titulo: string, anilistId?: number) => {
    const url = `${API_BASE_URL}/${categoria}/import`;
    try {
      const response = await customFetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nome: titulo, userId: user?.id, anilistId })
      });
      
      if (response.ok) {
        const novoItem = await response.json();
        consultarMinhaLista();
        carregarDashboard();
        
        const itemData = novoItem.manga || novoItem.anime || novoItem;
        setSelectedItem({ ...itemData, ...novoItem, dbId: novoItem.id, isExternal: false });
        if (categoria === 'manga' && anilistId) {
          carregarCapituloMaisRecente(anilistId, true);
        }
      }
    } catch (error) {
      console.error("Erro no POST:", error);
    }
  };

  const consultarMinhaLista = async () => {
    setLoading(true);
    const url = `${API_BASE_URL}/${categoria}`;
    try {
      const response = await customFetch(url, { headers: getHeaders() });
      const data = await response.json();
      if (Array.isArray(data)) {
        const sorted = data.sort((a, b) => {
          const posA = a.prioridade || 999;
          const posB = b.prioridade || 999;
          return posA - posB;
        });
        setResultadosDB(sorted);
      }
    } catch (error) {
      console.error("Erro ao consultar DB:", error);
    } finally {
      setLoading(false);
    }
  };

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
        setAnimesDashboard(animes.filter(a => {
          if (a.status !== 'WATCHING') return false;
          const status = a.anime?.statusLancamento || a.statusLancamento;
          const proxEp = a.anime?.proximoEpisodio || a.proximoEpisodio;
          const numTotal = a.anime?.numEpisodiosTotal || a.numEpisodiosTotal;
          const maxDisp = (status === 'RELEASING' && proxEp) ? proxEp - 1 : (numTotal || 9999);
          return (a.epAtual || 0) < maxDisp;
        }));
      }
      if (Array.isArray(mangas)) {
        setMangasDashboard(mangas.filter(m => {
          if (m.status !== 'WATCHING') return false;
          const status = m.manga?.statusLancamento || m.statusLancamento;
          const proxCap = m.manga?.proximoCapituloNumero || m.proximoCapituloNumero;
          const numTotal = m.manga?.numCapitulosTotal || m.numCapitulosTotal;
          const maxDisp = (status === 'RELEASING' && proxCap) ? proxCap - 1 : (numTotal || 9999);
          return (m.capAtual || 0) < maxDisp;
        }));
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
        if (selectedItem && selectedItem.id === item.id) {
          const updated = await response.json();
          setSelectedItem(updated);
        }
      }
    } catch (error) {
      console.error("Erro ao marcar como visto:", error);
    } finally {
      setSavingItems(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const abrirDetalhes = async (id: number, isExternal = false, forcedType?: 'anime' | 'manga') => {
    setLoading(true);
    const targetType = forcedType || categoria;
    if (forcedType && forcedType !== categoria) {
      setCategoria(forcedType);
    }

    if (isExternal) {
      const existente = resultadosDB.find(item => (targetType === 'manga' ? item.mangaId : item.animeId) === id);
      if (existente) {
        return abrirDetalhes(existente.id, false, targetType);
      }
    }

    const url = isExternal 
      ? `${API_BASE_URL}/${targetType}/anilist/${id}`
      : `${API_BASE_URL}/${targetType}/${id}`;
    
    try {
      const response = await customFetch(url, { headers: getHeaders() });
      const data = await response.json();
      
      if (!data) {
        showToast('Could not load details. Please try again later.', 'error');
        return;
      }
      
      if (isExternal && data) {
        const normalized = {
          id: data.id,
          titulo: data.title?.english || data.title?.romaji || 'Unknown Title',
          capaUrl: data.coverImage?.large,
          descricao: data.description ? data.description.replace(/<[^>]*>?/gm, '') : "No description available.",
          generos: data.genres ? data.genres.join(', ') : (data.tags ? data.tags.map((t: any) => t.name).join(', ') : ''),
          statusLancamento: data.status,
          numEpisodiosTotal: data.episodes,
          numCapitulosTotal: data.chapters,
          temporada: data.season,
          ano: data.seasonYear,
          linksExternos: data.externalLinks ? JSON.stringify(data.externalLinks) : null,
          isExternal: true
        };
        setSelectedItem(normalized);
      } else if (data) {
        const itemData = data.manga || data.anime || data;
        // Preservamos o ID da base de dados original para as operações de PATCH/DELETE
        setSelectedItem({ ...itemData, ...data, dbId: data.id, isExternal: false });
      }

      if (targetType === 'manga') {
        carregarCapituloMaisRecente(data.mangaId || data.id);
      }

      setView('details');
      setShowEpList(false);
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirLink = async (url: string, title: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await MangaWebView.open({ url, title });
      } catch (e) {
        console.error("Failed to open MangaWebView", e);
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const removerDaLista = async (id: number) => {
    const targetId = selectedItem?.dbId || id;
    const url = `${API_BASE_URL}/${categoria}/${targetId}`;
    try {
      const response = await customFetch(url, { method: 'DELETE', headers: getHeaders() });
      if (response.ok) {
        consultarMinhaLista();
        carregarDashboard();
        setShowDeleteConfirm(false);
        setSelectedItem((prev: any) => ({
          ...prev,
          id: prev.mangaId || prev.animeId || prev.id,
          isExternal: true
        }));
      }
    } catch (error) {
      console.error("Erro ao remover:", error);
    }
  };

  const atualizarCampo = async (campo: string, valor: any) => {
    if (!selectedItem || selectedItem.isExternal) return;
    const targetId = selectedItem.dbId || selectedItem.id;
    
    const isProgressUpdate = campo === 'epAtual' || campo === 'capAtual';
    if (isProgressUpdate) {
      if (isSavingDetailsProgress) return;
      setIsSavingDetailsProgress(true);
    }

    let optimisticUpdates: any = { [campo]: valor };
    if (campo === 'status' && valor === 'COMPLETED') {
      const prop = categoria === 'anime' ? 'epAtual' : 'capAtual';
      const statusLanc = selectedItem.statusLancamento;
      const prox = categoria === 'anime' ? selectedItem.proximoEpisodio : selectedItem.proximoCapituloNumero;
      const total = categoria === 'anime' ? selectedItem.numEpisodiosTotal : selectedItem.numCapitulosTotal;
      const maxDisponivel = (statusLanc === 'RELEASING' && prox) ? prox - 1 : (total || selectedItem[prop]);
      optimisticUpdates[prop] = maxDisponivel;
    }
    if (campo === 'epAtual' || campo === 'capAtual') {
      const statusLanc = selectedItem.statusLancamento;
      const prox = categoria === 'anime' ? selectedItem.proximoEpisodio : selectedItem.proximoCapituloNumero;
      const total = categoria === 'anime' ? selectedItem.numEpisodiosTotal : selectedItem.numCapitulosTotal;
      const maxDisponivel = (statusLanc === 'RELEASING' && prox) ? prox - 1 : total;

      if (selectedItem.status === 'PLANNED' && valor > 0) {
        optimisticUpdates.status = 'WATCHING';
      }
      if (selectedItem.status === 'COMPLETED' && maxDisponivel && valor < maxDisponivel) {
        optimisticUpdates.status = 'WATCHING';
      }
      if (statusLanc !== 'RELEASING' && total && valor >= total) {
        optimisticUpdates.status = 'COMPLETED';
      }
    }
    setSelectedItem((prev: any) => ({ ...prev, ...optimisticUpdates }));
    const url = `${API_BASE_URL}/${categoria}/${targetId}`;
    try {
      const response = await customFetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(optimisticUpdates)
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedItem((prev: any) => ({ ...prev, ...data, dbId: data.id }));
        setResultadosDB(prev => prev.map(item => item.id === targetId ? { ...item, ...data } : item));
        carregarDashboard();
      }
    } catch (error) {
      console.error(`Erro ao atualizar ${campo}:`, error);
    } finally {
      if (isProgressUpdate) {
        setIsSavingDetailsProgress(false);
      }
    }
  };

  const atualizarProgresso = async (delta: number) => {
    if (!selectedItem || selectedItem.isExternal) return;
    const campo = categoria === 'anime' ? 'epAtual' : 'capAtual';
    const novoValor = (selectedItem[campo] || 0) + delta;
    if (novoValor < 0) return;
    atualizarCampo(campo, novoValor);
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
    setIsShowingFavorites(false);
    
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

  const adicionarLinkPessoal = async () => {
    if (!newLinkSite || !newLinkUrl || selectedItem.isExternal) return;
    const novosLinks = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados) : [];
    novosLinks.push({ site: newLinkSite, url: newLinkUrl, language: 'EN', type: 'Custom' });
    const jsonStr = JSON.stringify(novosLinks);
    await atualizarCampo('linksPersonalizados', jsonStr);
    setNewLinkSite('');
    setNewLinkUrl('');
    setShowAddLink(false);
  };

  useEffect(() => {
    consultarMinhaLista();
    carregarDashboard();
  }, [categoria, homeTrigger]);

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
    setView('home');
    setSelectedItem(null);
  }, [isShowingFavorites, isSearchOpen]);

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-4 py-2 sm:py-10">
      {view === 'home' ? (
        <div className="w-full">
          {/* Search Section */}
          {isSearchOpen && (
            <section className="animate-in slide-in-from-top-4 duration-500 mb-8 sm:mb-10 space-y-4 sm:space-y-6">
              {/* Título fora da caixa em linha única */}
              <div className="text-center px-1 sm:px-0 mt-2 sm:mt-0">
                <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-primary-light tracking-tight truncate">
                  Search your favorite <span className={categoria === 'anime' ? 'text-primary' : 'text-secondary'}>{categoria === 'anime' ? 'Animes' : 'Mangas'}</span>
                </h2>
              </div>

              {/* Caixa com a barra de pesquisa e os filtros */}
              <div className="py-4 sm:py-6 px-2 sm:px-6 md:px-12 hero-gradient rounded-2xl sm:rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden w-full">
                <div className="absolute inset-0 bg-gradient-to-r from-secondary/15 via-secondary-light/5 to-transparent blur-3xl"></div>
                <div className="max-w-5xl mx-auto space-y-3 sm:space-y-5 relative z-10">
                  <div className={`glass-panel p-1 sm:p-1.5 rounded-xl sm:rounded-2xl flex items-center shadow-lg group focus-within:ring-2 ${categoria === 'anime' ? 'ring-primary/50' : 'ring-secondary/50'} transition-all bg-surface/80 backdrop-blur-xl border border-white/10 max-w-4xl mx-auto`}>
                    <span className="material-symbols-outlined px-2 sm:px-4 text-on-surface-variant group-focus-within:text-white text-base sm:text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
                    <input 
                      className="bg-transparent border-none focus:ring-0 w-full py-2 sm:py-3 text-on-surface font-body-sm sm:font-body-md text-body-sm sm:text-body-md placeholder:text-outline-variant outline-none" 
                      placeholder={`Search for ${categoria} titles...`} 
                      type="text"
                      value={termoPesquisa}
                      onChange={(e) => setTermoPesquisa(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedGenre(null); pesquisar(); } }}
                    />
                    <button 
                      onClick={() => { setSelectedGenre(null); pesquisar(); }} 
                      className={`${categoria === 'anime' ? 'bg-primary hover:bg-primary/80 text-on-primary' : 'bg-secondary hover:bg-secondary/80 text-on-secondary'} px-4 sm:px-8 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-md text-xs sm:text-sm`}
                    >
                      Search
                    </button>
                  </div>

                  {/* Genre Accordion for Mobile / Cloud for Desktop */}
                  <div className="pt-1 sm:pt-2 max-w-4.5xl mx-auto px-1">
                    {Capacitor.isNativePlatform() ? null : (
                      /* VERSÃO WEB PC: Layout original com botão de expandir no mobile e lista completa no desktop */
                      <>
                        <div className="md:hidden flex justify-center mb-2.5">
                          <button 
                            onClick={() => setShowGenres(!showGenres)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full glass-panel border ${showGenres ? (categoria === 'anime' ? 'border-purple-500/50 bg-purple-500/10 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-pink-500/50 bg-pink-500/10 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.2)]') : 'border-white/10 bg-surface-variant/40 hover:bg-surface-variant text-on-surface-variant hover:text-white'} text-[11px] font-bold shadow-md backdrop-blur-md transition-all active:scale-95`}
                          >
                            <span className="material-symbols-outlined text-xs text-primary">sell</span>
                            <span>{showGenres ? 'Hide Genres' : `🏷️ Filter by Genre (${GENRES.length})`}</span>
                            <span className={`material-symbols-outlined text-xs transition-transform duration-300 ${showGenres ? 'rotate-180' : ''}`}>expand_more</span>
                          </button>
                        </div>

                        <div className={`flex flex-wrap justify-center gap-1 sm:gap-2 transition-all duration-300 ${showGenres ? 'max-h-[500px] opacity-100 py-1.5' : 'max-h-0 opacity-0 overflow-hidden md:max-h-[500px] md:opacity-100 md:overflow-visible md:py-1'}`}>
                          {GENRES.map((g) => (
                            <span 
                              key={g} 
                              onClick={() => { pesquisarPorGenero(g); setShowGenres(false); }} 
                              className={`px-3 py-1 rounded-lg border text-[10px] sm:text-xs font-bold transition-all cursor-pointer shadow-sm whitespace-nowrap ${selectedGenre === g ? (categoria === 'anime' ? 'bg-primary border-primary text-on-primary shadow-[0_0_12px_rgba(168,85,247,0.4)]' : 'bg-secondary border-secondary text-on-secondary shadow-[0_0_12px_rgba(236,72,153,0.4)]') : 'bg-surface-variant/30 border-white/5 hover:bg-white/10 hover:border-white/20 text-on-surface-variant hover:text-white'}`}
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Content Sections */}
          <div className="px-2 sm:px-4 md:px-10 space-y-8 sm:space-y-16 mt-2 sm:mt-8 pb-10">
            {/* Dashboard Queue */}
            {(!isShowingFavorites && !isSearchOpen) && (
              <section className="space-y-8 sm:space-y-12">
                {Capacitor.isNativePlatform() ? null : (
                  <div className="text-center py-12 hero-gradient rounded-[40px] border border-white/10 shadow-2xl p-8 mb-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-secondary/15 via-secondary-light/5 to-transparent blur-3xl"></div>
                    <h2 className="text-5xl md:text-7xl font-black text-secondary-light tracking-tight mb-4 relative z-10">
                      Otaku-Time
                    </h2>
                    <p className="text-on-surface-variant text-lg max-w-xl mx-auto relative z-10 font-medium">
                      Your premium portal for tracking Anime and Manga.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between px-1 sm:px-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl animate-pulse drop-shadow-[0_0_12px_rgba(147,51,234,0.6)]" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                    <h3 className="font-display-lg text-2xl sm:text-3xl font-black text-primary-light tracking-tight">Up Next</h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Anime Column */}
                  <div className={`space-y-3 sm:space-y-4 ${categoria === 'anime' ? 'block' : 'hidden'} md:block`}>
                    <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 px-1 sm:px-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> Continue Watching
                    </h4>
                    {animesDashboard.length > 0 ? animesDashboard.map(item => {
                      const status = item.anime?.statusLancamento || item.statusLancamento;
                      const proxEp = item.anime?.proximoEpisodio || item.proximoEpisodio;
                      const numTotal = item.anime?.numEpisodiosTotal || item.numEpisodiosTotal;
                      const totalEp = (status === 'RELEASING' && proxEp) ? proxEp - 1 : (numTotal || '?');
                      const epQueVouVer = (item.epAtual || 0) + 1;
                      const numDisponiveis = typeof totalEp === 'number' ? totalEp - epQueVouVer : 0;
                      const progressoPercentual = typeof totalEp === 'number' && totalEp > 0 ? ((item.epAtual || 0) / totalEp) * 100 : (((item.epAtual || 0) / ((item.epAtual || 0) + 1)) * 100);
                      return (
                        <div key={item.id} className="glass-panel p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl flex gap-2.5 sm:gap-4 hover:bg-white/5 transition-all group relative overflow-hidden border border-white/5 hover:border-purple-500/30">
                          <div className="w-18 sm:w-24 h-26 sm:h-32 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => abrirDetalhes(item.id, false, 'anime')}>
                            <img src={item.anime?.capaUrl || item.capaUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-0.5 sm:py-1 min-w-0">
                            <div className="cursor-pointer min-w-0" onClick={() => abrirDetalhes(item.id, false, 'anime')}>
                              <h5 className="font-bold text-base sm:text-lg line-clamp-1 group-hover:text-primary-light transition-colors truncate">{item.anime?.titulo || item.titulo}</h5>
                              <p className="text-xs sm:text-sm text-on-surface-variant font-medium flex items-center gap-1.5 mt-0.5">
                                <span>Ep {epQueVouVer}</span>
                                {numDisponiveis > 0 ? <span className="text-[10px] sm:text-xs text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded-full font-bold whitespace-nowrap">+{numDisponiveis} avail</span> : ''}
                              </p>
                            </div>
                            <div className="space-y-2.5 sm:space-y-3 mt-2">
                              <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full bg-primary shadow-md transition-all duration-500" style={{ width: `${item.epAtual > 0 ? Math.max(5, Math.min(progressoPercentual, 100)) : 0}%` }}></div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => marcarComoVisto(item, 'anime')} 
                                  disabled={savingItems[item.id]}
                                  className="w-full py-1.5 sm:py-2 bg-primary/10 border border-primary/20 text-primary text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl hover:bg-primary hover:text-on-primary transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingItems[item.id] ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  ) : (
                                    <span>Mark as Watched</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }) : <p className="text-on-surface-variant text-xs sm:text-sm italic px-1 sm:px-0">No anime in progress...</p>}
                  </div>

                  {/* Manga Column */}
                  <div className={`space-y-3 sm:space-y-4 ${categoria === 'manga' ? 'block' : 'hidden'} md:block`}>
                    <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5 px-1 sm:px-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span> Continue Reading
                    </h4>
                    {mangasDashboard.length > 0 ? mangasDashboard.map(item => {
                      const status = item.manga?.statusLancamento || item.statusLancamento;
                      const proxCap = item.manga?.proximoCapituloNumero || item.proximoCapituloNumero;
                      const numTotal = item.manga?.numCapitulosTotal || item.numCapitulosTotal;
                      const totalCap = (status === 'RELEASING' && proxCap) ? proxCap - 1 : (numTotal || '?');
                      const capQueVouLer = (item.capAtual || 0) + 1;
                      const numDisponiveis = typeof totalCap === 'number' ? totalCap - capQueVouLer : 0;
                      const progressoPercentual = typeof totalCap === 'number' && totalCap > 0 ? ((item.capAtual || 0) / totalCap) * 100 : (((item.capAtual || 0) / ((item.capAtual || 0) + 1)) * 100);
                      return (
                        <div key={item.id} className="glass-panel p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl flex gap-2.5 sm:gap-4 hover:bg-white/5 transition-all group relative overflow-hidden border border-white/5 hover:border-pink-500/30">
                          <div className="w-18 sm:w-24 h-26 sm:h-32 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => abrirDetalhes(item.id, false, 'manga')}>
                            <img src={item.manga?.capaUrl || item.capaUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-0.5 sm:py-1 min-w-0">
                            <div className="cursor-pointer min-w-0" onClick={() => abrirDetalhes(item.id, false, 'manga')}>
                              <h5 className="font-bold text-base sm:text-lg line-clamp-1 group-hover:text-secondary-light transition-colors truncate">{item.manga?.titulo || item.titulo}</h5>
                              <p className="text-xs sm:text-sm text-on-surface-variant font-medium flex items-center gap-1.5 mt-0.5">
                                <span>Ch {capQueVouLer}</span>
                                {numDisponiveis > 0 ? <span className="text-[10px] sm:text-xs text-secondary bg-secondary/10 border border-secondary/20 px-1.5 py-0.2 rounded-full font-bold whitespace-nowrap">+{numDisponiveis} avail</span> : ''}
                              </p>
                            </div>
                            <div className="space-y-2.5 sm:space-y-3 mt-2">
                              <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div className="h-full bg-secondary shadow-md transition-all duration-500" style={{ width: `${item.capAtual > 0 ? Math.max(5, Math.min(progressoPercentual, 100)) : 0}%` }}></div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => marcarComoVisto(item, 'manga')} 
                                  disabled={savingItems[item.id]}
                                  className="w-full py-1.5 sm:py-2 bg-secondary/10 border border-secondary/20 text-secondary text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl hover:bg-secondary hover:text-on-secondary transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingItems[item.id] ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                                  ) : (
                                    <span>Mark as Read</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }) : <p className="text-on-surface-variant text-xs sm:text-sm italic px-1 sm:px-0">No manga in progress...</p>}
                  </div>
                </div>
              </section>
            )}

            {/* Library Grid */}
            {(isShowingFavorites && !isSearchOpen) && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-50">
                <div className="flex flex-col space-y-6 border-b border-white/10 pb-6 relative z-50">
                  <div className="flex items-center gap-3 sm:gap-4 px-1 sm:px-0">
                    <span className="material-symbols-outlined text-primary text-3xl sm:text-4xl md:text-5xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>video_library</span>
                    <div className="min-w-0">
                      <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-primary-light tracking-tight capitalize mb-0.5 sm:mb-1 truncate">
                        Library ({categoria})
                      </h2>
                      <p className="text-xs sm:text-base text-on-surface-variant font-medium">
                        {(() => {
                          const filtrados = resultadosDB.filter(item => {
                            if (filtroStatus !== 'ALL' && item.status !== filtroStatus) return false;
                            const statusLancamento = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
                            if (filtroLancamento !== 'ALL' && statusLancamento !== filtroLancamento) return false;
                            return true;
                          });
                          return `Showing ${filtrados.length} of ${resultadosDB.length} saved titles`;
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Filters & Sorting Controls */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-surface-variant/20 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-white/5 backdrop-blur-md w-full sm:w-fit relative z-50">
                    {/* Status Filter */}
                    <div className="flex flex-wrap items-center gap-1 bg-background/50 p-1 rounded-lg sm:rounded-xl border border-white/5 w-full sm:w-auto justify-center">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: 'WATCHING', label: categoria === 'anime' ? 'Watching' : 'Reading' },
                        { id: 'COMPLETED', label: 'Completed' },
                        { id: 'PLANNED', label: 'Planned' },
                        { id: 'PAUSED', label: 'Paused' },
                        { id: 'DROPPED', label: 'Dropped' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setFiltroStatus(tab.id)}
                          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold transition-all flex-1 sm:flex-initial text-center ${filtroStatus === tab.id ? (categoria === 'anime' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.2)]') : 'text-on-surface-variant hover:text-white hover:bg-white/5'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Release Status Custom Dropdown */}
                    <div className="relative z-50 flex-1 sm:flex-initial min-w-[140px]">
                      <button
                        onClick={() => { setShowLancamentoMenu(!showLancamentoMenu); setShowOrdemMenu(false); }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-background/50 hover:bg-white/5 border border-white/5 text-[11px] sm:text-xs font-bold text-white transition-all shadow-sm w-full"
                      >
                        <span className="material-symbols-outlined text-xs sm:text-sm text-on-surface-variant flex-shrink-0">sensors</span>
                        <span className="truncate">
                          {filtroLancamento === 'ALL' ? 'Release: All' :
                           filtroLancamento === 'RELEASING' ? 'Release: Releasing' :
                           filtroLancamento === 'FINISHED' ? 'Release: Finished' :
                           filtroLancamento === 'HIATUS' ? 'Release: Hiatus' : 'Release: Cancelled'}
                        </span>
                        <span className="material-symbols-outlined text-xs sm:text-sm text-on-surface-variant ml-auto">expand_more</span>
                      </button>

                      {showLancamentoMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowLancamentoMenu(false)}></div>
                          <div className="absolute top-full mt-2 left-0 w-48 bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-200">
                            {[
                              { id: 'ALL', label: 'All' },
                              { id: 'RELEASING', label: 'Releasing' },
                              { id: 'FINISHED', label: 'Finished' },
                              { id: 'HIATUS', label: 'Hiatus' },
                              { id: 'CANCELLED', label: 'Cancelled' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => { setFiltroLancamento(opt.id); setShowLancamentoMenu(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${filtroLancamento === opt.id ? (categoria === 'anime' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm' : 'bg-pink-500/20 text-pink-300 border border-pink-500/30 shadow-sm') : 'text-on-surface-variant hover:text-white hover:bg-slate-900/50'}`}
                              >
                                <span>{opt.label}</span>
                                {filtroLancamento === opt.id && (
                                  <span className="material-symbols-outlined text-sm">check</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Sorting Custom Dropdown */}
                    <div className="relative z-50 flex-1 sm:flex-initial min-w-[140px]">
                      <button
                        onClick={() => { setShowOrdemMenu(!showOrdemMenu); setShowLancamentoMenu(false); }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-background/50 hover:bg-white/5 border border-white/5 text-[11px] sm:text-xs font-bold text-white transition-all shadow-sm w-full"
                      >
                        <span className="material-symbols-outlined text-xs sm:text-sm text-on-surface-variant flex-shrink-0">sort</span>
                        <span className="truncate">
                          {ordenacao === 'PRIORITY' ? 'Sort: Priority' :
                           ordenacao === 'TITLE' ? 'Sort: Title (A-Z)' :
                           ordenacao === 'PROGRESS_DESC' ? 'Sort: Progress (Most Behind)' : 'Sort: Progress (Closest to Caught Up)'}
                        </span>
                        <span className="material-symbols-outlined text-xs sm:text-sm text-on-surface-variant ml-auto">expand_more</span>
                      </button>

                      {showOrdemMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowOrdemMenu(false)}></div>
                          <div className="absolute top-full mt-2 left-0 w-48 bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-200">
                            {[
                              { id: 'PRIORITY', label: 'Priority' },
                              { id: 'TITLE', label: 'Title (A-Z)' },
                              { id: 'PROGRESS_DESC', label: 'Progress (Most Behind)' },
                              { id: 'PROGRESS_ASC', label: 'Progress (Closest)' },
                            ].map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => { setOrdenacao(opt.id); setShowOrdemMenu(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${ordenacao === opt.id ? (categoria === 'anime' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm' : 'bg-pink-500/20 text-pink-300 border border-pink-500/30 shadow-sm') : 'text-on-surface-variant hover:text-white hover:bg-slate-900/50'}`}
                              >
                                <span>{opt.label}</span>
                                {ordenacao === opt.id && (
                                  <span className="material-symbols-outlined text-sm">check</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {loading && <Loader2 className="w-5 h-5 text-primary animate-spin ml-2" />}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 pt-4 relative z-10">
                  {(() => {
                    const filtrados = resultadosDB.filter(item => {
                      if (filtroStatus !== 'ALL' && item.status !== filtroStatus) return false;
                      const statusLancamento = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
                      if (filtroLancamento !== 'ALL' && statusLancamento !== filtroLancamento) return false;
                      return true;
                    }).sort((a, b) => {
                      if (ordenacao === 'PRIORITY') {
                        return (a.prioridade || 999) - (b.prioridade || 999);
                      }
                      if (ordenacao === 'TITLE') {
                        const tA = (a.anime?.titulo || a.manga?.titulo || a.titulo || '').toLowerCase();
                        const tB = (b.anime?.titulo || b.manga?.titulo || b.titulo || '').toLowerCase();
                        return tA.localeCompare(tB);
                      }
                      if (ordenacao === 'PROGRESS_DESC' || ordenacao === 'PROGRESS_ASC') {
                        const atualA = a.epAtual || a.capAtual || 0;
                        const statusLancA = a.anime?.statusLancamento || a.manga?.statusLancamento || a.statusLancamento;
                        const proxA = a.anime?.proximoEpisodio || a.manga?.proximoCapituloNumero;
                        const totalA = a.anime?.numEpisodiosTotal || a.manga?.numCapitulosTotal || a.numEpisodiosTotal || a.numCapitulosTotal || atualA;
                        const dispA = (statusLancA === 'RELEASING' && proxA) ? proxA - 1 : Math.max(atualA, totalA);
                        const faltamA = Math.max(0, dispA - atualA);

                        const atualB = b.epAtual || b.capAtual || 0;
                        const statusLancB = b.anime?.statusLancamento || b.manga?.statusLancamento || b.statusLancamento;
                        const proxB = b.anime?.proximoEpisodio || b.manga?.proximoCapituloNumero;
                        const totalB = b.anime?.numEpisodiosTotal || b.manga?.numCapitulosTotal || b.numEpisodiosTotal || b.numCapitulosTotal || atualB;
                        const dispB = (statusLancB === 'RELEASING' && proxB) ? proxB - 1 : Math.max(atualB, totalB);
                        const faltamB = Math.max(0, dispB - atualB);

                        return ordenacao === 'PROGRESS_DESC' ? faltamB - faltamA : faltamA - faltamB;
                      }
                      return 0;
                    });

                    return filtrados.length > 0 ? (
                      filtrados.map((item) => (
                        <div key={item.id} className="group cursor-pointer" onClick={() => abrirDetalhes(item.id, false, categoria)}>
                          <div className={`relative aspect-[2/3] rounded-3xl overflow-hidden shadow-xl transform transition-all duration-500 group-hover:scale-[1.03] group-hover:-translate-y-2 border border-white/10 ${categoria === 'anime' ? 'group-hover:border-purple-500/60 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.25)]' : 'group-hover:border-pink-500/60 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.25)]'}`}>
                            <img src={item.anime?.capaUrl || item.manga?.capaUrl || item.capaUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                            
                            {/* Top Badges: Status & Priority */}
                            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 flex items-center justify-between z-10 pointer-events-none gap-1 sm:gap-2">
                              {/* Tracking Status Badge */}
                              {item.status && (
                                <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold flex items-center gap-1 sm:gap-1.5 backdrop-blur-md border shadow-lg ${
                                  item.status === 'WATCHING' ? (categoria === 'anime' ? 'bg-purple-500/30 border-purple-500/50 text-purple-200' : 'bg-pink-500/30 border-pink-500/50 text-pink-200') :
                                  item.status === 'COMPLETED' ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-200' :
                                  item.status === 'PAUSED' ? 'bg-amber-500/30 border-amber-500/50 text-amber-200' :
                                  item.status === 'PLANNED' ? 'bg-blue-500/30 border-blue-500/50 text-blue-200' :
                                  'bg-surface-variant/50 border-white/10 text-on-surface-variant'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    item.status === 'WATCHING' ? (categoria === 'anime' ? 'bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'bg-pink-400 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.8)]') :
                                    item.status === 'COMPLETED' ? 'bg-emerald-400' :
                                    item.status === 'PAUSED' ? 'bg-amber-400' :
                                    item.status === 'PLANNED' ? 'bg-blue-400' :
                                    'bg-on-surface-variant'
                                  }`}></span>
                                  <span className="truncate">
                                    {item.status === 'WATCHING' ? (categoria === 'anime' ? 'Watching' : 'Reading') :
                                     item.status === 'COMPLETED' ? 'Completed' :
                                     item.status === 'PAUSED' ? 'Paused' :
                                     item.status === 'PLANNED' ? 'Planned' : 'In Library'}
                                  </span>
                                </span>
                              )}

                              {/* Priority / Score Badge */}
                              {item.prioridade && (
                                <span className={`backdrop-blur-md px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 sm:gap-1 border shadow-lg flex-shrink-0 ${
                                  getPriorityBadgeClass(item.prioridade)
                                }`}>
                                  <span className={`material-symbols-outlined text-[10px] sm:text-[12px] ${
                                    getPriorityStarColor(item.prioridade)
                                  }`} style={{ fontVariationSettings: "'FILL' 1" }}>star</span> #{item.prioridade}
                                </span>
                              )}
                            </div>

                            {/* Bottom Content: Title & Progress Bar */}
                            <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col justify-end pointer-events-none">
                              <span className={`w-fit px-2 py-0.5 rounded-lg text-[9px] font-extrabold tracking-wider mb-1.5 border ${categoria === 'anime' ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-secondary/20 border-secondary/30 text-secondary'}`}>
                                {categoria.toUpperCase()}
                              </span>
                              <p className={`font-bold text-sm text-white line-clamp-2 mb-2 ${categoria === 'anime' ? 'group-hover:text-primary-light' : 'group-hover:text-secondary-light'} transition-colors`}>
                                {item.anime?.titulo || item.manga?.titulo || item.titulo}
                              </p>

                              {/* Progress Info & Bar */}
                              {(() => {
                                const atual = categoria === 'anime' ? (item.epAtual || 0) : (item.capAtual || 0);
                                const status = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
                                const proxEp = categoria === 'anime' ? (item.anime?.proximoEpisodio || item.proximoEpisodio) : (item.manga?.proximoCapituloNumero || item.proximoCapituloNumero);
                                const numTotal = categoria === 'anime' ? (item.anime?.numEpisodiosTotal || item.numEpisodiosTotal) : (item.manga?.numCapitulosTotal || item.numCapitulosTotal);
                                const total = (status === 'RELEASING' && proxEp) ? proxEp - 1 : (numTotal || '?');
                                const percent = typeof total === 'number' && total > 0 ? (atual / total) * 100 : (atual > 0 ? ((atual / (atual + 1)) * 100) : 0);
                                return (
                                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                                    <div className="flex justify-between items-center text-[11px] font-medium">
                                      <span className="text-on-surface-variant flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">timelapse</span>
                                        Progress
                                      </span>
                                      <span className="text-white font-bold">
                                        {atual} / {total}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
                                      <div 
                                        className={`h-full transition-all duration-500 rounded-full ${categoria === 'anime' ? 'bg-primary shadow-md' : 'bg-secondary shadow-md'}`}
                                        style={{ width: `${Math.max(atual > 0 ? 3 : 0, Math.min(percent, 100))}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-16 text-center glass-panel rounded-3xl border border-white/5 space-y-4">
                        <span className="material-symbols-outlined text-5xl text-on-surface-variant">search_off</span>
                        <p className="text-on-surface font-bold text-lg">No titles found with active filters.</p>
                        <p className="text-on-surface-variant text-sm">Try changing or clearing the filters at the top of the page.</p>
                      </div>
                    );
                  })()}
                </div>
              </section>
            )}

            {/* Search Results Grid */}
            {isSearchOpen && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    <h3 className="font-headline-lg text-headline-lg text-2xl font-bold">
                      Search Results {selectedGenre ? `- ${selectedGenre}` : ''}
                    </h3>
                  </div>
                  {loading && <Loader2 className="w-6 h-6 text-primary animate-spin" />}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                  {resultadosPesquisa.length > 0 ? (
                    resultadosPesquisa.map((item) => (
                      <div key={item.id} className="group cursor-pointer space-y-3" onClick={() => abrirDetalhes(item.id, true)}>
                        <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-lg transform transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1 border border-white/5 group-hover:border-pink-500/50">
                          <img src={item.coverImage.large} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                          <div className="absolute bottom-4 left-4 right-4 z-10">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-2 ${categoria === 'anime' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>
                              {categoria.toUpperCase()}
                            </span>
                            <p className="font-bold text-sm text-white line-clamp-1">{item.title.english || item.title.romaji}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : !loading && (
                    <p className="col-span-full text-center text-on-surface-variant py-10 italic">No results found.</p>
                  )}
                </div>
                {hasMoreResults && (
                  <div className="flex justify-center pt-8 pb-4 animate-in fade-in duration-300">
                    <button 
                      onClick={carregarMais} 
                      disabled={loadingMore} 
                      className={`px-8 py-3 rounded-2xl font-bold flex items-center gap-3 border transition-all shadow-lg ${categoria === 'anime' ? 'bg-primary/20 hover:bg-primary border-primary/30 text-primary hover:text-on-primary shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'bg-secondary/20 hover:bg-secondary border-secondary/30 text-secondary hover:text-on-secondary shadow-[0_0_20px_rgba(236,72,153,0.2)]'}`}
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">expand_more</span>
                          Load More
                        </>
                      )}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            <button onClick={() => setView('home')} className={`mb-10 flex items-center gap-2 px-5 py-2.5 rounded-full glass-panel border border-white/10 text-on-surface-variant hover:text-white transition-all group font-bold shadow-lg ${categoria === 'anime' ? 'hover:border-purple-500/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'hover:border-pink-500/50 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)]'}`}>
              <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
              Back to Home
            </button>
            {selectedItem && (
              Capacitor.isNativePlatform() ? (
                /* VERSÃO ANDROID NATIVA: Ordem Exata Solicitada pelo Utilizador + Margens Otimizadas */
                <div className={`glass-panel rounded-2xl sm:rounded-3xl overflow-hidden border p-4 sm:p-6 space-y-6 ${categoria === 'anime' ? 'border-purple-500/20 shadow-lg' : 'border-pink-500/20 shadow-lg'}`}>
                  {/* 1. Capa & Título */}
                  <div className="flex gap-4 items-start">
                    <div className={`w-28 sm:w-36 aspect-[2/3] rounded-xl overflow-hidden shadow-lg border-2 border-background ring-1 ${categoria === 'anime' ? 'ring-purple-500/50' : 'ring-pink-500/50'} flex-shrink-0`}>
                      <img src={selectedItem.capaUrl} className="w-full h-full object-cover" alt={selectedItem.titulo} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${categoria === 'anime' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-secondary/20 text-secondary border-secondary/30'}`}>
                          {categoria}
                        </span>
                        <span className={`text-xs flex items-center gap-0.5 font-bold ${
                          getPriorityStarColor(selectedItem.prioridade)
                        }`}>
                          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> {selectedItem.isExternal ? 'New' : `#${selectedItem.prioridade}`}
                        </span>
                      </div>
                      <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${categoria === 'anime' ? 'text-primary-light' : 'text-secondary-light'} line-clamp-3`}>{selectedItem.titulo}</h2>
                      
                      {categoria === 'manga' && (
                        <div className="pt-1">
                          {loadingLatest ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-variant/50 rounded-full border border-white/10 animate-pulse w-fit">
                              <Loader2 className="w-3.5 h-3.5 text-secondary animate-spin" />
                              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Checking...</span>
                            </div>
                          ) : latestChapter ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary/20 rounded-full border border-secondary/30 w-fit">
                              <span className="material-symbols-outlined text-[14px] text-secondary">auto_awesome</span>
                              <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">Latest: {latestChapter}</span>
                            </div>
                          ) : latestChapterError ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/30 flex-wrap">
                              <span className="material-symbols-outlined text-[14px] text-red-500">info</span>
                              <span className="text-[9px] font-bold text-red-50: uppercase tracking-widest">{latestChapterError}</span>
                              {!selectedItem.isExternal && (
                                <button onClick={() => { const val = prompt("Enter total number of chapters manually:", selectedItem.numCapitulosTotal || ''); if (val !== null) { const num = parseInt(val) || 0; atualizarCampo('numCapitulosTotal', num); } }} className="ml-1 px-2 py-0.5 bg-secondary/20 hover:bg-secondary text-secondary hover:text-on-secondary rounded-full text-[9px] font-bold transition-all border border-secondary/30 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[9px]">edit</span> MANUAL
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-variant/50 rounded-full border border-white/10 flex-wrap">
                              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">info</span>
                              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">No external info</span>
                              {!selectedItem.isExternal && (
                                <button onClick={() => { const val = prompt("Enter total number of chapters manually:", selectedItem.numCapitulosTotal || ''); if (val !== null) { const num = parseInt(val) || 0; atualizarCampo('numCapitulosTotal', num); } }} className="ml-1 px-2 py-0.5 bg-secondary/20 hover:bg-secondary text-secondary hover:text-on-secondary rounded-full text-[9px] font-bold transition-all border border-secondary/30 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[9px]">edit</span> MANUAL
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Géneros */}
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
                    {selectedItem.generos?.split(',').map((g: string) => (
                      <span key={g} className={`px-3 py-1 bg-white/5 rounded-lg text-[11px] font-bold text-on-surface border tracking-wider ${categoria === 'anime' ? 'border-purple-500/30' : 'border-pink-500/30'}`}>
                        {g.trim()}
                      </span>
                    ))}
                  </div>

                  {/* 3. Ações (Quick Actions & My Progress) */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h3 className="text-base font-bold flex items-center gap-2 text-white">
                      <span className={`w-1 h-4 rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                      Actions & Progress
                    </h3>

                    {selectedItem.isExternal ? (
                      <button onClick={() => { adicionarAoBanco(selectedItem.titulo, selectedItem.id); }} className="w-full bg-primary hover:bg-primary/80 text-on-primary py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md">
                        <span className="material-symbols-outlined text-base">add</span> ADD TO LIBRARY
                      </button>
                    ) : (
                      <div className="space-y-4">
                        {/* Tracking Status */}
                        <div className="space-y-2">
                          <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Tracking Status</label>
                          <div className="grid grid-cols-2 gap-2">
                            {TRACKING_STATUS_OPTIONS.map((opt) => {
                              const isSelected = selectedItem.status === opt.value;
                              return (
                                <button key={opt.value} onClick={() => atualizarCampo('status', opt.value)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-bold relative overflow-hidden group active:scale-95 ${isSelected ? (categoria === 'anime' ? 'bg-purple-500/20 border-purple-500 text-purple-200 shadow-sm' : 'bg-pink-500/20 border-pink-500 text-pink-200 shadow-sm') : 'bg-surface-variant/30 border-white/5 text-on-surface-variant'}`}>
                                  {isSelected && (
                                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${categoria === 'anime' ? 'bg-purple-500' : 'bg-pink-500'}`}></span>
                                  )}
                                  <span className={`material-symbols-outlined text-base ${isSelected ? (categoria === 'anime' ? 'text-purple-400' : 'text-pink-400') : 'text-on-surface-variant'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {opt.value === 'WATCHING' ? 'play_circle' : 
                                     opt.value === 'PLANNED' ? 'schedule' : 
                                     opt.value === 'COMPLETED' ? 'check_circle' : 
                                     opt.value === 'PAUSED' ? 'pause_circle' : 'cancel'}
                                  </span>
                                  <span className="truncate">{categoria === 'anime' ? opt.animeLabel : opt.mangaLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Priority Selector */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            Priority Level (1 = Highest)
                          </label>
                          <div className="grid grid-cols-5 gap-1.5">
                            {PRIORITY_OPTIONS.map(p => {
                              const isSel = selectedItem.prioridade === p.num;
                              return (
                                <button
                                  key={p.num}
                                  onClick={() => atualizarCampo('prioridade', p.num)}
                                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 ${
                                    isSel 
                                      ? `${p.colorClass} scale-105 font-black shadow-sm`
                                      : 'bg-surface-variant/30 border-white/5 text-on-surface-variant'
                                  }`}
                                >
                                  <span className="text-xs font-bold">#{p.num}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* My Progress */}
                        <div className={`p-4 rounded-2xl border ${showEpList ? (categoria === 'anime' ? 'bg-purple-500/10 border-purple-500/40' : 'bg-pink-500/10 border-pink-500/40') : 'glass-panel border-white/5'}`}>
                          <div className="flex items-center gap-1.5 mb-1 justify-center">
                            <span className="material-symbols-outlined text-on-surface-variant text-xs">timelapse</span>
                            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">My Progress</p>
                          </div>
                          
                          <div className="flex items-baseline gap-2 mb-4 mt-2 justify-center">
                            {isSavingDetailsProgress ? (
                              <div className="h-10 flex items-center justify-center">
                                <Loader2 className={`w-6 h-6 animate-spin ${categoria === 'anime' ? 'text-primary' : 'text-secondary'}`} />
                              </div>
                            ) : (
                              <>
                                <input type="number" min="0" max={categoria === 'anime' ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || 9999)) : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 9999))} value={categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual} onChange={(e) => { const val = parseInt(e.target.value) || 0; atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', val); }} className={`bg-transparent ${categoria === 'anime' ? 'text-primary focus:bg-purple-500/10' : 'text-secondary focus:bg-pink-500/10'} font-black text-3xl w-16 text-center outline-none border-b border-white/10 focus:border-white/40 rounded transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-0.5`} />
                                <span className="text-on-surface-variant font-light text-2xl">/</span> 
                                <span className="text-on-surface-variant font-bold text-2xl">
                                  {categoria === 'anime' 
                                    ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || '?'))
                                    : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || '?'))
                                  }
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-center gap-2 w-full flex-wrap mb-1">
                            <button onClick={() => atualizarProgresso(-1)} disabled={isSavingDetailsProgress} title="Subtract 1" className={`w-9 h-9 rounded-xl bg-surface-variant/40 hover:bg-surface-variant border border-white/5 text-on-surface-variant hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}>
                              <span className="material-symbols-outlined text-base">remove</span>
                            </button>
                            <button onClick={() => atualizarProgresso(1)} disabled={isSavingDetailsProgress} title="Add 1" className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center shadow-md active:scale-95 font-bold ${categoria === 'anime' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                              <span className="material-symbols-outlined text-base">add</span>
                            </button>
                            <button onClick={() => setShowEpList(!showEpList)} className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border active:scale-95 ${showEpList ? (categoria === 'anime' ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/20 border-secondary text-secondary') : 'bg-surface-variant/30 border-white/5 text-on-surface-variant'}`}>
                              <span className="material-symbols-outlined text-sm">grid_view</span>
                              {showEpList ? 'Close Grid' : 'Open Grid'}
                            </button>
                          </div>

                          {showEpList && (
                            <div className="w-full mt-4 border-t border-white/10 pt-4 animate-in slide-in-from-top-4 duration-300">
                              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                                {[...Array(categoria === 'anime' 
                                  ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || 0)) 
                                  : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 0))
                                )].map((_, i) => {
                                  const num = i + 1;
                                  const isWatched = num <= (categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual);
                                  return (
                                    <button key={num} onClick={() => atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', num)} disabled={isSavingDetailsProgress} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isWatched ? (categoria === 'anime' ? 'bg-primary text-on-primary scale-105' : 'bg-secondary text-on-secondary scale-105') : 'bg-surface-variant/30 text-on-surface-variant border border-white/5'}`}>
                                      {num}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Season Breakdown (Baka-Updates / MangaDex) */}
                        {categoria === 'manga' && latestBreakdown && latestBreakdown.length > 0 && (
                          <div className="p-4 rounded-2xl glass-panel border border-white/5 space-y-2.5 my-3 animate-in fade-in">
                            <div className="flex items-center gap-1.5 mb-1 justify-center">
                              <span className="material-symbols-outlined text-secondary text-sm">format_list_bulleted</span>
                              <p className="text-secondary text-[10px] uppercase font-bold tracking-widest">Season Breakdown</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {latestBreakdown.map((b: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 bg-surface-variant/30 rounded-xl border border-white/5 shadow-sm">
                                  <span className="text-xs font-bold text-white truncate pr-2">{b.label}</span>
                                  <span className="px-2.5 py-1 bg-secondary/20 text-secondary text-xs font-black rounded-lg border border-secondary/30 flex-shrink-0 shadow-[0_0_10px_rgba(255,176,203,0.2)]">
                                    {b.chapters} Chs
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Release Status & Season */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                          <div className="glass-panel p-3.5 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
                            <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">Release Status</p>
                            <p className={`font-bold text-sm ${selectedItem.statusLancamento === 'RELEASING' ? (categoria === 'anime' ? 'text-primary' : 'text-secondary') : 'text-white'}`}>
                              {selectedItem.statusLancamento === 'RELEASING' ? 'Releasing' : 
                               selectedItem.statusLancamento === 'FINISHED' ? 'Finished' : 
                               selectedItem.statusLancamento === 'HIATUS' ? 'Hiatus' : 
                               selectedItem.statusLancamento === 'CANCELLED' ? 'Cancelled' : 
                               selectedItem.statusLancamento || 'Unknown'}
                            </p>
                          </div>
                          <div className="glass-panel p-3.5 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
                            <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">Season / Year</p>
                            <p className="font-bold text-sm text-white capitalize truncate max-w-full">
                              {selectedItem.temporada ? `${selectedItem.temporada.toLowerCase()} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Last Modified Card */}
                        <div className="glass-panel p-3.5 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
                          <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">Last Content Update</p>
                          <p className="font-bold text-sm text-white font-mono">
                            {formatLastModified(selectedItem)}
                          </p>
                        </div>

                        {/* Remove Button */}
                        {showDeleteConfirm ? (
                          <div className="p-4 rounded-2xl bg-error/10 border border-error/30 animate-in fade-in zoom-in-95 duration-300 space-y-3 shadow-md">
                            <div className="flex items-center gap-2 text-error">
                              <span className="material-symbols-outlined text-xl">warning</span>
                              <h5 className="font-bold text-sm">Confirm Removal</h5>
                            </div>
                            <p className="text-xs text-on-surface-variant font-medium">
                              Remove <span className="text-white font-bold">{selectedItem.titulo}</span> from library?
                            </p>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 bg-surface-variant text-on-surface-variant rounded-xl font-bold text-xs border border-white/10">
                                Cancel
                              </button>
                              <button onClick={() => removerDaLista(selectedItem.id)} className="flex-1 py-2 bg-error text-on-error rounded-xl font-bold text-xs shadow-md">
                                Yes, Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setShowDeleteConfirm(true)} className="w-full bg-error/10 hover:bg-error text-error hover:text-on-error py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs mt-2 border border-error/20">
                            <span className="material-symbols-outlined text-base">delete</span>
                            REMOVE FROM LIBRARY
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. Links (Pessoais primeiro, depois Oficiais) */}
                  {(() => {
                    const linksOficiais = selectedItem.linksExternos ? JSON.parse(selectedItem.linksExternos).map((l: any) => ({ ...l, tipo: 'Official' })) : [];
                    const linksPessoais = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados).map((l: any) => ({ ...l, tipo: 'Custom' })) : [];
                    const todosLinksAndroid = [...linksPessoais, ...linksOficiais];
                    
                    return (todosLinksAndroid.length > 0 || (!selectedItem.isExternal)) && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-bold flex items-center gap-2 text-white">
                            <span className={`w-1 h-4 rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                            Where to {categoria === 'anime' ? 'Watch' : 'Read'}
                          </h3>
                          {!selectedItem.isExternal && (
                            <button onClick={() => setShowAddLink(!showAddLink)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all text-xs border ${categoria === 'anime' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                              <span className="material-symbols-outlined text-sm">add</span> ADD LINK
                            </button>
                          )}
                        </div>
                        
                        {showAddLink && !selectedItem.isExternal && (
                          <div className="flex flex-col gap-2.5 p-3 bg-surface-variant/30 border border-white/10 rounded-xl animate-in slide-in-from-top-4">
                            <input type="text" placeholder="Name (Ex: Crunchyroll)" value={newLinkSite} onChange={e => setNewLinkSite(e.target.value)} className="bg-black/30 px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-primary transition-all text-xs text-white" />
                            <input type="url" placeholder="URL (https://...)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="bg-black/30 px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-primary transition-all text-xs text-white" />
                            <button onClick={adicionarLinkPessoal} disabled={!newLinkSite || !newLinkUrl} className="py-2 bg-primary disabled:bg-surface-variant disabled:text-on-surface-variant text-on-primary rounded-lg font-bold transition-all text-xs">SAVE</button>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 gap-2.5">
                          {todosLinksAndroid.map((link: any, index: number) => (
                            <button key={index} onClick={() => abrirLink(link.url, selectedItem.titulo)} className={`w-full text-left flex items-center justify-between p-3.5 glass-panel rounded-xl transition-all group shadow-sm border border-white/5`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${link.tipo === 'Custom' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5 truncate">
                                    {link.site}
                                    {link.tipo === 'Custom' && <span className="px-1.5 py-0.5 bg-secondary/20 text-secondary text-[9px] rounded-md border border-secondary/30 flex-shrink-0">CUSTOM</span>}
                                  </p>
                                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">{link.language || 'Global'}</p>
                                </div>
                              </div>
                              <span className={`material-symbols-outlined text-sm flex-shrink-0 ${link.tipo === 'Custom' ? 'text-on-surface-variant' : 'text-on-surface-variant'}`}>chevron_right</span>
                            </button>
                          ))}
                          {todosLinksAndroid.length === 0 && (
                            <p className="text-on-surface-variant italic text-xs">No links available. Add one above!</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 5. Descrição (Sinopse) */}
                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <h3 className="text-base font-bold flex items-center gap-2 text-white">
                      <span className={`w-1 h-4 rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                      Synopsis
                    </h3>
                    <p className="text-on-surface-variant leading-relaxed text-xs sm:text-sm">
                      {selectedItem.descricao || "No description available."}
                    </p>
                  </div>
                </div>
              ) : (
                /* VERSÃO WEB INTOCADA (Exatamente o código original) */
                <div className={`glass-panel rounded-3xl overflow-hidden border ${categoria === 'anime' ? 'border-purple-500/20 shadow-[0_0_100px_rgba(168,85,247,0.15)]' : 'border-pink-500/20 shadow-[0_0_100px_rgba(236,72,153,0.15)]'}`}>
                  <div className="relative h-[400px] md:h-[500px]">
                    <img src={selectedItem.capaUrl} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30" alt="" />
                    <div className={`absolute inset-0 bg-gradient-to-t from-background via-background/80 to-${categoria === 'anime' ? 'purple' : 'pink'}-900/20`}></div>
                    <div className="relative h-full flex flex-col md:flex-row items-end p-8 md:p-12 gap-8">
                      <div className={`w-48 md:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border-4 border-background ring-2 ${categoria === 'anime' ? 'ring-purple-500/50' : 'ring-pink-500/50'} flex-shrink-0 group`}>
                        <img src={selectedItem.capaUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={selectedItem.titulo} />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-3 mb-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${categoria === 'anime' ? 'bg-primary/20 text-primary border-primary/30 shadow-[0_0_10px_rgba(221,184,255,0.2)]' : 'bg-secondary/20 text-secondary border-secondary/30 shadow-[0_0_10px_rgba(255,176,203,0.2)]'}`}>
                            {categoria}
                          </span>
                          <span className={`text-sm flex items-center gap-1 font-bold ${
                            getPriorityStarColor(selectedItem.prioridade)
                          }`}>
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> {selectedItem.isExternal ? 'New' : `#${selectedItem.prioridade}`}
                          </span>
                        </div>
                        <h2 className={`font-display-lg text-4xl md:text-5xl font-bold mb-6 tracking-tight ${categoria === 'anime' ? 'text-primary-light' : 'text-secondary-light'}`}>{selectedItem.titulo}</h2>
                        {categoria === 'manga' && (
                          <div className="flex items-center gap-3 mb-6">
                            {loadingLatest ? (
                              <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-variant/50 rounded-full border border-white/10 animate-pulse">
                                <Loader2 className="w-4 h-4 text-secondary animate-spin" />
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Checking Sources...</span>
                              </div>
                            ) : latestChapter ? (
                              <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary/20 rounded-full border border-secondary/30 shadow-[0_0_15px_rgba(255,176,203,0.2)] animate-in zoom-in">
                                <span className="material-symbols-outlined text-[16px] text-secondary">auto_awesome</span>
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Latest on {latestChapterSource}: {latestChapter}</span>
                              </div>
                            ) : latestChapterError ? (
                              <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 rounded-full border border-red-500/30">
                                <span className="material-symbols-outlined text-[16px] text-red-500">info</span>
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{latestChapterError}</span>
                                {!selectedItem.isExternal && (
                                  <button onClick={() => { const val = prompt("Enter total number of chapters manually:", selectedItem.numCapitulosTotal || ''); if (val !== null) { const num = parseInt(val) || 0; atualizarCampo('numCapitulosTotal', num); } }} className="ml-2 px-2 py-0.5 bg-secondary/20 hover:bg-secondary text-secondary hover:text-on-secondary rounded-full text-[9px] font-bold transition-all border border-secondary/30 flex items-center gap-1" title="Set total manually">
                                    <span className="material-symbols-outlined text-[10px]">edit</span> ADD MANUAL
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-variant/50 rounded-full border border-white/10">
                                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">info</span>
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">No external info</span>
                                {!selectedItem.isExternal && (
                                  <button onClick={() => { const val = prompt("Enter total number of chapters manually:", selectedItem.numCapitulosTotal || ''); if (val !== null) { const num = parseInt(val) || 0; atualizarCampo('numCapitulosTotal', num); } }} className="ml-2 px-2 py-0.5 bg-secondary/20 hover:bg-secondary text-secondary hover:text-on-secondary rounded-full text-[9px] font-bold transition-all border border-secondary/30 flex items-center gap-1" title="Set total manually">
                                    <span className="material-symbols-outlined text-[10px]">edit</span> ADD MANUAL
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {selectedItem.generos?.split(',').map((g: string) => (
                            <span key={g} className={`px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full text-xs font-bold text-on-surface border tracking-wider transition-all hover:scale-105 ${categoria === 'anime' ? 'border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500/60 hover:text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.1)]' : 'border-pink-500/30 hover:bg-pink-500/20 hover:border-pink-500/60 hover:text-pink-300 shadow-[0_0_10px_rgba(236,72,153,0.1)]'}`}>
                              {g.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-8 md:p-12 grid md:grid-cols-3 gap-12">
                    <div className="md:col-span-2 space-y-12">
                      <div>
                        <h3 className="font-headline-lg text-2xl font-bold mb-6 flex items-center gap-3">
                          <span className={`w-1.5 h-6 rounded-full ${categoria === 'anime' ? 'bg-primary shadow-[0_0_10px_rgba(221,184,255,0.5)]' : 'bg-secondary shadow-[0_0_10px_rgba(255,176,203,0.5)]'}`}></span>
                          Synopsis
                        </h3>
                        <p className="text-on-surface-variant leading-relaxed text-lg font-body-lg">
                          {selectedItem.descricao || "No description available."}
                        </p>
                      </div>

                      {/* Season Breakdown Web */}
                      {categoria === 'manga' && latestBreakdown && latestBreakdown.length > 0 && (
                        <div className="space-y-6 pt-8 border-t border-white/5 animate-in fade-in">
                          <h3 className="font-headline-lg text-2xl font-bold flex items-center gap-3">
                            <span className="w-1.5 h-6 rounded-full bg-secondary shadow-[0_0_10px_rgba(255,176,203,0.5)]"></span>
                            Season Breakdown
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {latestBreakdown.map((b: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-5 glass-panel hover:bg-white/5 rounded-2xl transition-all border border-pink-500/30 hover:border-pink-500/50 shadow-lg group">
                                <span className="text-sm font-bold text-white truncate pr-2 group-hover:text-secondary-light transition-colors">{b.label}</span>
                                <span className="px-3 py-1.5 bg-secondary/20 text-secondary text-sm font-black rounded-xl border border-secondary/30 flex-shrink-0 shadow-[0_0_15px_rgba(255,176,203,0.2)]">
                                  {b.chapters} Chs
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(() => {
                        const linksOficiais = selectedItem.linksExternos ? JSON.parse(selectedItem.linksExternos).map((l: any) => ({ ...l, tipo: 'Official' })) : [];
                        const linksPessoais = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados).map((l: any) => ({ ...l, tipo: 'Custom' })) : [];
                        const todosLinks = [...linksOficiais, ...linksPessoais];
                        
                        return (todosLinks.length > 0 || (!selectedItem.isExternal)) && (
                          <div className="space-y-6 pt-10 border-t border-white/5">
                            <div className="flex items-center justify-between mb-6">
                              <h3 className="font-headline-lg text-2xl font-bold flex items-center gap-3">
                                <span className={`w-1.5 h-6 rounded-full ${categoria === 'anime' ? 'bg-primary shadow-[0_0_10px_rgba(221,184,255,0.5)]' : 'bg-secondary shadow-[0_0_10px_rgba(255,176,203,0.5)]'}`}></span>
                                Where to {categoria === 'anime' ? 'Watch' : 'Read'}
                              </h3>
                              {!selectedItem.isExternal && (
                                <button onClick={() => setShowAddLink(!showAddLink)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-xs border ${categoria === 'anime' ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-on-primary shadow-[0_0_15px_rgba(221,184,255,0.2)]' : 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary hover:text-on-secondary shadow-[0_0_15px_rgba(255,176,203,0.2)]'}`}>
                                  <span className="material-symbols-outlined text-[16px]">add</span> ADD LINK
                                </button>
                              )}
                            </div>
                            
                            {showAddLink && !selectedItem.isExternal && (
                              <div className="flex flex-col sm:flex-row gap-3 p-4 bg-surface-variant/30 border border-white/10 rounded-2xl mb-4 animate-in slide-in-from-top-4">
                                <input type="text" placeholder="Name (Ex: Crunchyroll)" value={newLinkSite} onChange={e => setNewLinkSite(e.target.value)} className="flex-1 bg-black/30 px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-primary transition-all text-sm text-white" />
                                <input type="url" placeholder="URL (https://...)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="flex-[2] bg-black/30 px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-primary transition-all text-sm text-white" />
                                <button onClick={adicionarLinkPessoal} disabled={!newLinkSite || !newLinkUrl} className="px-6 py-2.5 bg-primary hover:bg-primary/80 disabled:bg-surface-variant disabled:text-on-surface-variant text-on-primary rounded-xl font-bold transition-all text-sm">SAVE</button>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {todosLinks.map((link: any, index: number) => (
                                <button key={index} onClick={() => abrirLink(link.url, selectedItem.titulo)} className={`w-full text-left flex items-center justify-between p-5 glass-panel hover:bg-white/5 rounded-2xl transition-all group shadow-lg border ${categoria === 'anime' ? 'border-white/5 hover:border-purple-500/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'border-pink-500/50 hover:border-pink-500/40 hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]'}`}>
                                  <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${link.tipo === 'Custom' ? 'bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary shadow-[0_0_10px_rgba(255,176,203,0.2)]' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary shadow-[0_0_10px_rgba(221,184,255,0.2)]'}`}>
                                      <span className="material-symbols-outlined">open_in_new</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                                        {link.site}
                                        {link.tipo === 'Custom' && <span className="px-2 py-0.5 bg-secondary/20 text-secondary text-[10px] rounded-full border border-secondary/30">CUSTOM</span>}
                                      </p>
                                      <p className="text-xs text-on-surface-variant font-bold uppercase">{link.language || 'Global'}</p>
                                    </div>
                                  </div>
                                  <span className={`material-symbols-outlined transition-all group-hover:translate-x-1 ${link.tipo === 'Custom' ? 'text-on-surface-variant group-hover:text-secondary' : 'text-on-surface-variant group-hover:text-primary'}`}>chevron_right</span>
                                </button>
                              ))}
                              {todosLinks.length === 0 && (
                                <p className="text-on-surface-variant italic text-sm col-span-2">No links available. Add one above!</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div className={`grid grid-cols-1 ${selectedItem.statusLancamento === 'RELEASING' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-6 py-8 border-t border-white/5`}>
                        {/* Status Card */}
                        <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all ${categoria === 'anime' ? 'hover:border-purple-500/30 hover:bg-purple-500/5 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'hover:border-pink-500/30 hover:bg-pink-500/5 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)]'}`}>
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${selectedItem.statusLancamento === 'RELEASING' ? (categoria === 'anime' ? 'bg-primary/10 text-primary shadow-[0_0_15px_rgba(221,184,255,0.2)]' : 'bg-secondary/10 text-secondary shadow-[0_0_15px_rgba(255,176,203,0.2)]') : 'bg-surface-variant/30 text-on-surface-variant'}`}>
                            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {selectedItem.statusLancamento === 'RELEASING' ? 'sensors' : selectedItem.statusLancamento === 'FINISHED' ? 'done_all' : 'info'}
                            </span>
                          </div>
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Release Status</p>
                          <p className={`font-bold text-lg ${selectedItem.statusLancamento === 'RELEASING' ? (categoria === 'anime' ? 'text-primary drop-shadow-[0_0_10px_rgba(221,184,255,0.3)]' : 'text-secondary drop-shadow-[0_0_10px_rgba(255,176,203,0.3)]') : 'text-white'}`}>
                            {selectedItem.statusLancamento === 'RELEASING' ? 'Releasing' : 
                             selectedItem.statusLancamento === 'FINISHED' ? 'Finished' : 
                             selectedItem.statusLancamento === 'HIATUS' ? 'Hiatus' : 
                             selectedItem.statusLancamento === 'CANCELLED' ? 'Cancelled' : 
                             selectedItem.statusLancamento || 'Unknown'}
                          </p>
                        </div>

                        {/* Season Card */}
                        <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all ${categoria === 'anime' ? 'hover:border-purple-500/30 hover:bg-purple-500/5 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'hover:border-pink-500/30 hover:bg-pink-500/5 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)]'}`}>
                          <div className="w-10 h-10 rounded-2xl bg-surface-variant/30 text-on-surface-variant flex items-center justify-center mb-3">
                            <span className="material-symbols-outlined text-xl">calendar_month</span>
                          </div>
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Season / Year</p>
                          <p className="font-bold text-lg text-white capitalize">
                            {selectedItem.temporada ? `${selectedItem.temporada.toLowerCase()} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A'}
                          </p>
                        </div>

                        {/* Planned Episodes/Chapters Card (Only when Releasing) */}
                        {selectedItem.statusLancamento === 'RELEASING' && (
                          <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all animate-in zoom-in-95 duration-300 ${categoria === 'anime' ? 'hover:border-purple-500/30 hover:bg-purple-500/5 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'hover:border-pink-500/30 hover:bg-pink-500/5 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)]'}`}>
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${categoria === 'anime' ? 'bg-primary/10 text-primary shadow-[0_0_15px_rgba(221,184,255,0.2)]' : 'bg-secondary/10 text-secondary shadow-[0_0_15px_rgba(255,176,203,0.2)]'}`}>
                              <span className="material-symbols-outlined text-xl">update</span>
                            </div>
                            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">{categoria === 'anime' ? 'Planned Episodes' : 'Planned Chapters'}</p>
                            <p className="font-bold text-lg text-white">
                              {categoria === 'anime' ? (selectedItem.numEpisodiosTotal || 'No official info') : (selectedItem.numCapitulosTotal || 'No official info')}
                            </p>
                          </div>
                        )}

                        {/* Last Modified Card */}
                        <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all ${categoria === 'anime' ? 'hover:border-purple-500/30 hover:bg-purple-500/5 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'hover:border-pink-500/30 hover:bg-pink-500/5 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)]'}`}>
                          <div className="w-10 h-10 rounded-2xl bg-surface-variant/30 text-on-surface-variant flex items-center justify-center mb-3">
                            <span className="material-symbols-outlined text-xl">history</span>
                          </div>
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Last Content Update</p>
                          <p className="font-bold text-lg text-white font-mono">
                            {formatLastModified(selectedItem)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className={`glass-panel p-8 rounded-[32px] border ${categoria === 'anime' ? 'border-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.08)]' : 'border-pink-500/20 shadow-[0_0_50px_rgba(236,72,153,0.08)]'}`}>
                        <h4 className="text-lg font-bold mb-6 flex items-center gap-2">Quick Actions</h4>
                        {selectedItem.isExternal ? (
                          <button onClick={() => { adicionarAoBanco(selectedItem.titulo, selectedItem.id); }} className="w-full bg-primary hover:bg-primary/80 text-on-primary py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg"><span className="material-symbols-outlined">add</span> ADD TO LIBRARY</button>
                        ) : (
                          <div className="space-y-6">
                            <div className="space-y-3">
                              <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Tracking Status</label>
                              <div className="grid grid-cols-1 gap-2.5">
                                {TRACKING_STATUS_OPTIONS.map((opt) => {
                                  const isSelected = selectedItem.status === opt.value;
                                  return (
                                    <button key={opt.value} onClick={() => atualizarCampo('status', opt.value)} className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all text-sm font-bold backdrop-blur-md relative overflow-hidden group active:scale-95 ${isSelected ? (categoria === 'anime' ? 'bg-purple-500/20 border-purple-500 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.35)] scale-[1.02]' : 'bg-pink-500/20 border-pink-500 text-pink-200 shadow-[0_0_20px_rgba(236,72,153,0.35)] scale-[1.02]') : `bg-surface-variant/30 border-white/5 text-on-surface-variant ${categoria === 'anime' ? 'hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'hover:border-pink-500/30 hover:bg-pink-500/10 hover:text-white hover:shadow-[0_0_15px_rgba(236,72,153,0.15)]'}`}`}>
                                      {isSelected && (
                                        <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${categoria === 'anime' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]' : 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]'}`}></span>
                                      )}
                                      <span className={`material-symbols-outlined text-[22px] transition-transform group-hover:scale-110 ${isSelected ? (categoria === 'anime' ? 'text-purple-400' : 'text-pink-400') : 'text-on-surface-variant group-hover:text-white'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {opt.value === 'WATCHING' ? 'play_circle' : 
                                         opt.value === 'PLANNED' ? 'schedule' : 
                                         opt.value === 'COMPLETED' ? 'check_circle' : 
                                         opt.value === 'PAUSED' ? 'pause_circle' : 'cancel'}
                                      </span>
                                      {categoria === 'anime' ? opt.animeLabel : opt.mangaLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Priority Selector */}
                            <div className="space-y-3 pt-2 border-t border-white/5">
                              <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-xs text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                Priority Level (1 = Highest)
                              </label>
                              <div className="grid grid-cols-5 gap-2">
                                {PRIORITY_OPTIONS.map(p => {
                                  const isSel = selectedItem.prioridade === p.num;
                                  return (
                                    <button
                                      key={p.num}
                                      onClick={() => atualizarCampo('prioridade', p.num)}
                                      className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all group active:scale-95 ${
                                        isSel 
                                          ? `${p.colorClass} scale-105 font-black`
                                          : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:bg-white/5 hover:border-white/20 hover:text-white'
                                      }`}
                                      title={`Priority #${p.num} (${p.desc})`}
                                    >
                                      <span className="text-sm font-bold">#{p.num}</span>
                                      <span className="text-[9px] opacity-80 font-semibold mt-0.5 tracking-tighter">{p.desc}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {showDeleteConfirm ? (
                              <div className="p-6 rounded-2xl bg-error/10 border border-error/30 animate-in fade-in zoom-in-95 duration-300 space-y-4 shadow-xl">
                                <div className="flex items-center gap-3 text-error">
                                  <span className="material-symbols-outlined text-3xl">warning</span>
                                  <h5 className="font-bold text-base">Confirm Removal</h5>
                                </div>
                                <p className="text-sm text-on-surface-variant font-medium">
                                  Are you sure you want to remove <span className="text-white font-bold">{selectedItem.titulo}</span> from your library?
                                </p>
                                <div className="flex gap-3 pt-2">
                                  <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-surface-variant hover:bg-surface-variant/80 text-on-surface-variant hover:text-white rounded-xl font-bold text-xs transition-all border border-white/10">
                                    Cancel
                                  </button>
                                  <button onClick={() => removerDaLista(selectedItem.id)} className="flex-1 py-3 bg-error hover:bg-error/80 text-on-error rounded-xl font-bold text-xs transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                                    Yes, Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setShowDeleteConfirm(true)} className="w-full bg-error/10 hover:bg-error text-error hover:text-on-error py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 text-sm mt-4 shadow-sm border border-error/20">
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                REMOVE FROM LIBRARY
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {!selectedItem.isExternal && (
                        <div className={`p-8 rounded-[32px] transition-all flex flex-col items-center justify-center text-center border ${showEpList ? (categoria === 'anime' ? 'bg-purple-500/10 border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.15)] backdrop-blur-xl' : 'bg-pink-500/10 border-pink-500/40 shadow-[0_0_40px_rgba(236,72,153,0.15)] backdrop-blur-xl') : `glass-panel ${categoria === 'anime' ? 'hover:border-purple-500/30 hover:bg-purple-500/5 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'hover:border-pink-500/30 hover:bg-pink-500/5 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)]'}`}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-on-surface-variant text-sm">timelapse</span>
                            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">My Progress</p>
                          </div>
                          
                          <div className="flex items-baseline gap-2 mb-6 mt-3 justify-center">
                            {isSavingDetailsProgress ? (
                              <div className="h-10 flex items-center justify-center">
                                <Loader2 className={`w-6 h-6 animate-spin ${categoria === 'anime' ? 'text-primary' : 'text-secondary'}`} />
                              </div>
                            ) : (
                              <>
                                <input type="number" min="0" max={categoria === 'anime' ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || 9999)) : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 9999))} value={categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual} onChange={(e) => { const val = parseInt(e.target.value) || 0; atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', val); }} className={`bg-transparent ${categoria === 'anime' ? 'text-primary focus:bg-purple-500/10' : 'text-secondary focus:bg-pink-500/10'} font-black text-4xl w-20 text-center outline-none border-b-2 border-white/10 focus:border-white/40 rounded transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-0.5`} />
                                <span className="text-on-surface-variant font-light text-3xl">/</span> 
                                <span className="text-on-surface-variant font-bold text-3xl">
                                  {categoria === 'anime' 
                                    ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || '?'))
                                    : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || '?'))
                                  }
                                </span>
                              </>
                            )}
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center justify-center gap-3 w-full flex-wrap mb-2">
                            <button onClick={() => atualizarProgresso(-1)} disabled={isSavingDetailsProgress} title="Subtract 1" className={`w-10 h-10 rounded-xl bg-surface-variant/40 hover:bg-surface-variant border border-white/5 hover:border-white/20 text-on-surface-variant hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}>
                              <span className="material-symbols-outlined text-lg">remove</span>
                            </button>
                            <button onClick={() => atualizarProgresso(1)} disabled={isSavingDetailsProgress} title="Add 1" className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center shadow-md active:scale-95 font-bold ${categoria === 'anime' ? 'bg-primary hover:bg-primary/80 text-on-primary shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-secondary hover:bg-secondary/80 text-on-secondary shadow-[0_0_15px_rgba(236,72,153,0.3)]'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                              <span className="material-symbols-outlined text-lg">add</span>
                            </button>
                            <button onClick={() => setShowEpList(!showEpList)} className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border active:scale-95 ${showEpList ? (categoria === 'anime' ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_15px_rgba(236,72,153,0.2)]') : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:border-white/20 hover:text-white'}`}>
                              <span className="material-symbols-outlined text-base">grid_view</span>
                              {showEpList ? 'Close Grid' : 'Open Grid'}
                            </button>
                          </div>

                          {showEpList && (
                            <div className="w-full mt-6 border-t border-white/10 pt-6 animate-in slide-in-from-top-4 duration-300">
                              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                                {[...Array(categoria === 'anime' 
                                  ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || 0)) 
                                  : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 0))
                                )].map((_, i) => {
                                  const num = i + 1;
                                  const isWatched = num <= (categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual);
                                  return (
                                    <button key={num} onClick={() => atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', num)} disabled={isSavingDetailsProgress} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isWatched ? (categoria === 'anime' ? 'bg-primary text-on-primary shadow-[0_0_10px_rgba(221,184,255,0.3)] scale-105' : 'bg-secondary text-on-secondary shadow-[0_0_10px_rgba(255,176,203,0.3)] scale-105') : 'bg-surface-variant/30 text-on-surface-variant hover:bg-surface-variant hover:text-white border border-white/5'}`}>
                                      {num}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
    </div>
  );
};

export default HomePage;
