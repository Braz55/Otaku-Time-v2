import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { useToast } from '../context/ToastContext';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useTranslation } from '../hooks/useTranslation';
import GenreTagPicker from '../components/GenreTagPicker';

const getGenresList = (generos: any): { name: string; weight: number }[] => {
  if (!generos) return [];
  if (typeof generos === 'string') {
    return generos.split(',').map((g: string) => g.trim()).filter(Boolean).map((name: string) => ({ name, weight: 100 }));
  }
  if (typeof generos === 'object') {
    return Object.entries(generos).map(([name, weight]) => ({
      name,
      weight: typeof weight === 'number' ? weight : 100
    })).sort((a, b) => b.weight - a.weight);
  }
  return [];
};

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


const LibraryPage = () => {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { 
    categoria,
    animeLibraryData,
    setAnimeLibraryData,
    mangaLibraryData,
    setMangaLibraryData
  } = useMedia();
  const navigate = useNavigate();

  const resultadosDB = categoria === 'anime' ? animeLibraryData : mangaLibraryData;
  const [loading, setLoading] = useState(false);

  const navigatingToDetailsRef = useRef(false);

  // Helper to load initial state synchronously from sessionStorage (only if coming from details)
  const getInitialState = <T,>(key: string, defaultValue: T): T => {
    const prevPath = sessionStorage.getItem('otaku_prev_path') || '';
    const cameFromDetails = prevPath.startsWith('/details/');
    if (!cameFromDetails) return defaultValue;

    const saved = sessionStorage.getItem(`otaku_library_state_${categoria}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state[key] !== undefined) {
          return state[key] as T;
        }
      } catch (e) {
        console.error(`Error restoring state for ${key}:`, e);
      }
    }
    return defaultValue;
  };

  const [filtroStatus, setFiltroStatus] = useState<string>(() => getInitialState('filtroStatus', 'WATCHING'));
  const [filtroLancamento, setFiltroLancamento] = useState<string>(() => getInitialState('filtroLancamento', 'ALL'));
  const [filtroFormato, setFiltroFormato] = useState<string>(() => getInitialState('filtroFormato', 'ALL'));
  const [ordenacao, setOrdenacao] = useState<string>(() => {
    const defaultOrder = categoria === 'anime' ? 'LATEST_EPISODE' : 'PRIORITY';
    const initial = getInitialState<string>('ordenacao', defaultOrder);
    return initial === 'LAST_UPDATED' ? defaultOrder : initial;
  });
  const [showLancamentoMenu, setShowLancamentoMenu] = useState(false);
  const [showFormatoMenu, setShowFormatoMenu] = useState(false);
  const [showOrdemMenu, setShowOrdemMenu] = useState(false);

  // Genre/Tag selector states
  const [metadata, setMetadata] = useState<any[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => getInitialState('selectedGenres', []));
  const [selectedTags, setSelectedTags] = useState<string[]>(() => getInitialState('selectedTags', []));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(() => getInitialState('visibleCount', 24));
  const [visibleCountPending, setVisibleCountPending] = useState(() => getInitialState('visibleCountPending', 24));
  const [visibleCountEmDia, setVisibleCountEmDia] = useState(() => getInitialState('visibleCountEmDia', 24));
  const [visibleCountPorEstrear, setVisibleCountPorEstrear] = useState(() => getInitialState('visibleCountPorEstrear', 24));

  const resetVisibleCounts = () => {
    setVisibleCount(24);
    setVisibleCountPending(24);
    setVisibleCountEmDia(24);
    setVisibleCountPorEstrear(24);
  };

  const stateRef = useRef({
    filtroStatus,
    filtroLancamento,
    filtroFormato,
    ordenacao,
    selectedGenres,
    selectedTags,
    scrollPosition: 0,
    visibleCount,
    visibleCountPending,
    visibleCountEmDia,
    visibleCountPorEstrear
  });

  const prevCategoryRef = useRef<string | null>(null);

  // Keep stateRef updated
  useEffect(() => {
    stateRef.current = {
      filtroStatus,
      filtroLancamento,
      filtroFormato,
      ordenacao,
      selectedGenres,
      selectedTags,
      scrollPosition: window.scrollY,
      visibleCount,
      visibleCountPending,
      visibleCountEmDia,
      visibleCountPorEstrear
    };
  }, [filtroStatus, filtroLancamento, filtroFormato, ordenacao, selectedGenres, selectedTags, visibleCount, visibleCountPending, visibleCountEmDia, visibleCountPorEstrear]);

  // Clear saved library state if not returning from details page
  useEffect(() => {
    const prevPath = sessionStorage.getItem('otaku_prev_path') || '';
    const cameFromDetails = prevPath.startsWith('/details/');
    if (!cameFromDetails) {
      sessionStorage.removeItem('otaku_library_state_anime');
      sessionStorage.removeItem('otaku_library_state_manga');
    }
  }, []);

  // Save state on unmount
  useEffect(() => {
    return () => {
      if (stateRef.current && !navigatingToDetailsRef.current) {
        stateRef.current.scrollPosition = window.scrollY;
        const activeCat = prevCategoryRef.current || categoria;
        sessionStorage.setItem(`otaku_library_state_${activeCat}`, JSON.stringify(stateRef.current));
      }
    };
  }, [categoria]);

  // Handle category switch and state restoration
  useEffect(() => {
    // 1. Save previous category state if it's changing
    if (prevCategoryRef.current && prevCategoryRef.current !== categoria) {
      if (stateRef.current) {
        stateRef.current.scrollPosition = window.scrollY;
        sessionStorage.setItem(`otaku_library_state_${prevCategoryRef.current}`, JSON.stringify(stateRef.current));
      }
    }
    prevCategoryRef.current = categoria;

    const defaultOrder = categoria === 'anime' ? 'LATEST_EPISODE' : 'PRIORITY';

    // 2. Try to load the state for the new category
    const saved = sessionStorage.getItem(`otaku_library_state_${categoria}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setFiltroStatus(state.filtroStatus || 'WATCHING');
        setFiltroLancamento(state.filtroLancamento || 'ALL');
        setFiltroFormato(state.filtroFormato || 'ALL');
        const restoredOrder = state.ordenacao === 'LAST_UPDATED' ? null : state.ordenacao;
        setOrdenacao(restoredOrder || defaultOrder);
        setSelectedGenres(state.selectedGenres || []);
        setSelectedTags(state.selectedTags || []);
        setVisibleCount(state.visibleCount || 24);
        setVisibleCountPending(state.visibleCountPending || 24);
        setVisibleCountEmDia(state.visibleCountEmDia || 24);
        setVisibleCountPorEstrear(state.visibleCountPorEstrear || 24);
        (window as any)._pendingLibraryScroll = state.scrollPosition || 0;
      } catch (e) {
        console.error("Error restoring library state:", e);
      }
    } else {
      setFiltroStatus('WATCHING');
      setFiltroLancamento('ALL');
      setFiltroFormato('ALL');
      setOrdenacao(defaultOrder);
      setSelectedGenres([]);
      setSelectedTags([]);
      setVisibleCount(24);
      setVisibleCountPending(24);
      setVisibleCountEmDia(24);
      setVisibleCountPorEstrear(24);
      (window as any)._pendingLibraryScroll = 0;
    }
  }, [categoria]);

  // Restore scroll position after results are loaded
  useEffect(() => {
    if (resultadosDB.length > 0 && (window as any)._pendingLibraryScroll) {
      const scrollY = (window as any)._pendingLibraryScroll;
      (window as any)._pendingLibraryScroll = 0;
      setTimeout(() => {
        window.scrollTo(0, scrollY);
      }, 100);
    }
  }, [resultadosDB]);

  const handleNavigateToDetails = (itemId: number) => {
    navigatingToDetailsRef.current = true;
    const currentState = {
      filtroStatus,
      filtroLancamento,
      filtroFormato,
      ordenacao,
      selectedGenres,
      selectedTags,
      scrollPosition: window.scrollY,
      visibleCount,
      visibleCountPending,
      visibleCountEmDia,
      visibleCountPorEstrear
    };
    sessionStorage.setItem(`otaku_library_state_${categoria}`, JSON.stringify(currentState));
    navigate(`/details/${categoria}/${itemId}`);
  };

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const consultarMinhaLista = async () => {
    const hasCache = resultadosDB.length > 0;
    if (!hasCache) {
      setLoading(true);
    }
    const url = `${API_BASE_URL}/${categoria}`;
    try {
      const response = await customFetch(url, { headers: getHeaders() });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const sorted = data.sort((a, b) => {
            const posA = a.prioridade || 999;
            const posB = b.prioridade || 999;
            return posA - posB;
          });
          if (categoria === 'anime') {
            setAnimeLibraryData(sorted);
          } else {
            setMangaLibraryData(sorted);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao consultar DB:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await customFetch(`${API_BASE_URL}/anime/genres-and-tags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMetadata(await res.json());
      }
    } catch (error) {
      console.error("Error loading metadata:", error);
    }
  };

  useEffect(() => {
    consultarMinhaLista();
    fetchMetadata();
  }, [categoria]);

  const sorteioAleatorioBiblioteca = async () => {
    const candidates = resultadosDB.filter(item => item.status === 'PLANNED');
    if (candidates.length === 0) {
      showToast('Não tens nenhum conteúdo com o estado "Planeado" para sortear nesta biblioteca.', 'warning');
      return;
    }

    let selected = null;
    let attempts = 0;

    while (!selected && attempts < 100) {
      attempts++;

      const pRand = Math.random() * 100;
      let chosenPriority = 10;
      if (pRand < 35) chosenPriority = 1;
      else if (pRand < 55) chosenPriority = 2;
      else if (pRand < 70) chosenPriority = 3;
      else if (pRand < 80) chosenPriority = 4;
      else if (pRand < 88) chosenPriority = 5;
      else if (pRand < 92) chosenPriority = 6;
      else if (pRand < 95) chosenPriority = 7;
      else if (pRand < 97.5) chosenPriority = 8;
      else if (pRand < 99) chosenPriority = 9;

      const finishedRand = Math.random() < 0.75;

      const matches = candidates.filter(item => {
        const priority = item.prioridade || 5;
        if (priority !== chosenPriority) return false;

        const statusLancamento = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
        const isItemFinished = statusLancamento === 'FINISHED';
        return isItemFinished === finishedRand;
      });

      if (matches.length > 0) {
        const idx = Math.floor(Math.random() * matches.length);
        selected = matches[idx];
      }
    }

    if (!selected) {
      const idx = Math.floor(Math.random() * candidates.length);
      selected = candidates[idx];
    }

    if (selected) {
      handleNavigateToDetails(selected.id);
    }
  };

  // Filter and sort the library items
  const filtrados = resultadosDB.filter(item => {
    if (filtroStatus !== 'ALL' && item.status !== filtroStatus) return false;
    const statusLancamento = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
    if (filtroLancamento !== 'ALL' && statusLancamento !== filtroLancamento) return false;
    
    // Type Filter (Série / Filme)
    if (categoria === 'anime' && filtroFormato !== 'ALL') {
      const isMovieItem = item.formato === 'MOVIE' || item.tipo === 'FILME' || item.anime?.formato === 'MOVIE';
      if (filtroFormato === 'MOVIE' && !isMovieItem) return false;
      if (filtroFormato === 'SERIE' && isMovieItem) return false;
    }

    if (selectedGenres.length > 0 || selectedTags.length > 0) {
      const generos = item.generos || item.anime?.generos || item.manga?.generos;
      if (!generos) return false;
      const itemGenres = getGenresList(generos).map(g => g.name.toLowerCase());
      const wanted = [...selectedGenres, ...selectedTags].map(w => w.toLowerCase());
      if (!wanted.every(w => itemGenres.includes(w))) return false;
    }
    
    return true;
  });

  const ordenados = [...filtrados].sort((a, b) => {
    if (ordenacao === 'PRIORITY') {
      return (a.prioridade || 999) - (b.prioridade || 999);
    } else if (ordenacao === 'TITLE') {
      const titleA = (a.anime?.titulo || a.manga?.titulo || a.titulo || '').toLowerCase();
      const titleB = (b.anime?.titulo || b.manga?.titulo || b.titulo || '').toLowerCase();
      return titleA.localeCompare(titleB);
    } else if (ordenacao === 'LAST_UPDATED') {
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();
      return dateB - dateA;
    } else if (ordenacao === 'LATEST_EPISODE') {
      const dateA = new Date(a.ultimoEpisodioEstreadoData || a.updatedAt || 0).getTime();
      const dateB = new Date(b.ultimoEpisodioEstreadoData || b.updatedAt || 0).getTime();
      return dateB - dateA;
    } else if (ordenacao === 'PROGRESS') {
      const currentA = categoria === 'anime' ? (a.epAtual || 0) : (a.capAtual || 0);
      const currentB = categoria === 'anime' ? (b.epAtual || 0) : (b.capAtual || 0);
      return currentB - currentA;
    }
    return 0;
  });

  const hasPendingEpisodes = (item: any) => {
    if (categoria === 'anime') {
      const currentGlobal = item.epAtualGlobal !== undefined ? item.epAtualGlobal : (item.epAtual || 0);
      let totalAired = 0;
      if (typeof item.numEpisodiosAired === 'number') {
        totalAired = item.numEpisodiosAired;
      } else if (item.episodes && Array.isArray(item.episodes) && item.episodes.length > 0) {
        const now = new Date();
        totalAired = item.episodes.filter((ep: any) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= now).length;
      } else {
        totalAired = item.numEpisodiosTotal || 0;
      }
      return currentGlobal < totalAired;
    } else {
      const currentGlobal = item.capAtual || 0;
      const statusLancamento = item.manga?.statusLancamento || item.statusLancamento;
      const proxNum = item.manga?.proximoCapituloNumero || item.proximoCapituloNumero;
      const numTotal = item.manga?.numCapitulosTotal || item.numCapitulosTotal;
      let totalReleased = 0;
      if (statusLancamento === 'RELEASING' && typeof proxNum === 'number') {
        totalReleased = proxNum - 1;
      } else {
        totalReleased = typeof numTotal === 'number' ? numTotal : 0;
      }
      return currentGlobal < totalReleased;
    }
  };

  const isPorEstrear = (item: any) => {
    if (categoria !== 'anime') return false;
    const statusLancamento = item.anime?.statusLancamento || item.statusLancamento;
    if (statusLancamento === 'NOT_YET_RELEASED') return true;
    
    const dataLanc = item.anime?.dataLancamento || item.dataLancamento;
    if (dataLanc && new Date(dataLanc) > new Date()) return true;

    let totalAired = 0;
    if (typeof item.numEpisodiosAired === 'number') {
      totalAired = item.numEpisodiosAired;
    } else if (item.episodes && Array.isArray(item.episodes) && item.episodes.length > 0) {
      const now = new Date();
      totalAired = item.episodes.filter((ep: any) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= now).length;
    }
    
    if (statusLancamento !== 'FINISHED' && totalAired === 0) {
      return true;
    }
    
    return false;
  };

  // Split items when in WATCHING status
  const porEstrear = filtroStatus === 'WATCHING' ? ordenados.filter(isPorEstrear) : [];
  const restOfWatching = filtroStatus === 'WATCHING' ? ordenados.filter(item => !isPorEstrear(item)) : [];
  const comPendentes = filtroStatus === 'WATCHING' ? restOfWatching.filter(hasPendingEpisodes) : [];
  const emDia = filtroStatus === 'WATCHING' ? restOfWatching.filter(item => !hasPendingEpisodes(item)) : [];

  const paginatedItems = ordenados.slice(0, visibleCount);
  const paginatedPorEstrear = porEstrear.slice(0, visibleCountPorEstrear);
  const paginatedComPendentes = comPendentes.slice(0, visibleCountPending);
  const paginatedEmDia = emDia.slice(0, visibleCountEmDia);

  const hasMore = filtrados.length > visibleCount;

  const renderLibraryItem = (item: any) => {
    const coverUrl = item.anime?.capaUrl || item.manga?.capaUrl || item.capaUrl;
    const title = item.anime?.titulo || item.manga?.titulo || item.titulo;
    const currentGlobal = categoria === 'anime' ? (item.epAtualGlobal !== undefined ? item.epAtualGlobal : (item.epAtual || 0)) : (item.capAtual || 0);
    
    const statusLancamento = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
    const proxNum = categoria === 'anime' ? (item.anime?.proximoEpisodio || item.proximoEpisodio) : (item.manga?.proximoCapituloNumero || item.proximoCapituloNumero);
    const numTotal = categoria === 'anime' ? (item.anime?.numEpisodiosTotal || item.numEpisodiosTotal) : (item.manga?.numCapitulosTotal || item.numCapitulosTotal);
    const isMovie = item.formato === 'MOVIE' || item.tipo === 'FILME' || item.anime?.formato === 'MOVIE';
    
    return (
      <div 
        key={item.id} 
        className="group cursor-pointer" 
        onClick={() => handleNavigateToDetails(item.id)}
      >
        <div className={`relative aspect-[2/3] rounded-3xl overflow-hidden shadow-xl transform transition-all duration-500 group-hover:scale-[1.03] group-hover:-translate-y-2 border border-white/10 ${categoria === 'anime' ? 'group-hover:border-secondary/60 group-hover:shadow-[0_0_30px_rgba(194,24,91,0.25)]' : 'group-hover:border-primary/60 group-hover:shadow-[0_0_30px_rgba(106,27,154,0.25)]'}`}>
          <img src={coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={title} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
          
          {/* Top Badges: Status & Priority */}
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 flex items-center justify-between z-10 pointer-events-none gap-1 sm:gap-2">
            {/* Tracking Status Badge */}
            {item.status && (
              <span className={`px-2 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold flex items-center gap-1 backdrop-blur-md border shadow-lg ${
                item.status === 'WATCHING' ? (categoria === 'anime' ? 'bg-secondary/30 border-secondary/50 text-secondary' : 'bg-primary/30 border-primary/50 text-primary') :
                item.status === 'COMPLETED' ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-200' :
                item.status === 'PAUSED' ? 'bg-amber-500/30 border-amber-500/50 text-amber-200' :
                item.status === 'PLANNED' ? 'bg-blue-500/30 border-blue-500/50 text-blue-200' :
                item.status === 'DROPPED' ? 'bg-red-500/30 border-red-500/50 text-red-200' :
                'bg-surface-variant/50 border-white/10 text-on-surface-variant'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  item.status === 'WATCHING' ? (categoria === 'anime' ? 'bg-secondary animate-pulse shadow-[0_0_8px_rgba(194,24,91,0.8)]' : 'bg-primary animate-pulse shadow-[0_0_8px_rgba(106,27,154,0.8)]') :
                  item.status === 'COMPLETED' ? 'bg-emerald-400' :
                  item.status === 'PAUSED' ? 'bg-amber-400' :
                  item.status === 'PLANNED' ? 'bg-blue-400' :
                  item.status === 'DROPPED' ? 'bg-red-400' :
                  'bg-on-surface-variant'
                }`}></span>
                <span className="truncate">
                  {item.status === 'WATCHING' ? (categoria === 'anime' ? 'A Ver' : 'A Ler') :
                   item.status === 'COMPLETED' ? 'Completo' :
                   item.status === 'PAUSED' ? 'Pausado' :
                   item.status === 'PLANNED' ? 'Planeado' :
                   item.status === 'DROPPED' ? 'Desistido' : 'Salvo'}
                </span>
              </span>
            )}

            {/* Priority Badge */}
            {item.prioridade && (
              <span className={`backdrop-blur-md px-2 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 border shadow-lg flex-shrink-0 ${
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
            <span className={`w-fit px-2 py-0.5 rounded-lg text-[9px] font-extrabold tracking-wider mb-1.5 border ${
              categoria === 'anime' 
                ? (item.tipo === 'ANIME' 
                  ? 'bg-primary/20 border-primary/30 text-primary shadow-[0_0_10px_rgba(221,184,255,0.1)]' 
                  : item.tipo === 'SERIE'
                    ? 'bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                    : 'bg-amber-500/20 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]')
                : 'bg-secondary/20 border-secondary/30 text-secondary'
            }`}>
              {categoria === 'anime' ? (item.tipo === 'SERIE' ? 'SÉRIE' : (item.tipo || 'ANIME')) : 'MANGÁ'}
            </span>
            <p className={`font-bold text-sm text-white line-clamp-2 mb-2 ${categoria === 'anime' ? 'group-hover:text-primary-light' : 'group-hover:text-secondary-light'} transition-colors`}>
              {title}
            </p>

            {/* Progress Info & Bar */}
            {(() => {
              const totalVal = isMovie
                ? 1
                : (categoria === 'anime'
                  ? (numTotal || '?')
                  : ((statusLancamento === 'RELEASING' && proxNum) ? proxNum - 1 : (numTotal || '?')));
              const percentVal = typeof totalVal === 'number' && totalVal > 0 ? (currentGlobal / totalVal) * 100 : (currentGlobal > 0 ? ((currentGlobal / (currentGlobal + 1)) * 100) : 0);
              return (
                <div className="space-y-1.5 pt-1 border-t border-white/10">
                  <div className="flex justify-between items-center text-[11px] font-medium">
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">timelapse</span>
                      Progresso
                    </span>
                    <span className="text-white font-bold">
                      {categoria === 'anime' && !isMovie && item.seasonAtual !== undefined && `T${item.seasonAtual} `}
                      {currentGlobal} / {totalVal}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${categoria === 'anime' ? 'bg-primary shadow-md' : 'bg-secondary shadow-md'}`}
                      style={{ width: `${Math.max(currentGlobal > 0 ? 3 : 0, Math.min(percentVal, 100))}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-4 md:py-8">
      <section id="biblioteca-section" className={`space-y-6 md:space-y-8 relative ${pickerOpen ? 'z-[130]' : 'z-30'}`}>
        <div className="flex flex-col space-y-6 border-b border-white/10 pb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <span className="material-symbols-outlined text-primary text-3xl sm:text-4xl md:text-5xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>video_library</span>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-4xl md:text-5xl font-black text-white tracking-tight capitalize mb-0.5 sm:mb-1 truncate">
                  Biblioteca ({categoria === 'anime' ? 'Anime' : 'Mangá'})
                </h2>
                <p className="text-xs sm:text-base text-on-surface-variant font-medium">
                  {t("A mostrar")} {filtrados.length} {t("de")} {resultadosDB.length} {t("títulos guardados")}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <button 
                onClick={() => navigate('/lists')}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                title="Gerir Listas Personalizadas"
              >
                <span className="material-symbols-outlined text-sm">format_list_bulleted</span> 
                <span>{t("Listas")}</span>
              </button>
              <button 
                onClick={sorteioAleatorioBiblioteca}
                className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap ${
                  categoria === 'anime' 
                    ? 'bg-secondary hover:bg-secondary/90 hover:shadow-[0_0_15px_rgba(194,24,91,0.4)]' 
                    : 'bg-primary hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(106,27,154,0.4)]'
                }`}
                title="Sorteio Planeado (Itens Planeados da tua Biblioteca)"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>casino</span> 
                <span className="hidden sm:inline">Sorteio Planeado</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-surface-variant/10 p-2 rounded-2xl border border-white/5 backdrop-blur-md w-full sm:w-fit relative z-30">
          <div className="flex flex-wrap items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 w-full sm:w-auto justify-center">
            {[
              { id: 'WATCHING', label: categoria === 'anime' ? 'A Ver' : 'A Ler' },
              { id: 'COMPLETED', label: 'Completo' },
              { id: 'PLANNED', label: 'Planeado' },
              { id: 'PAUSED', label: 'Pausado' },
              { id: 'DROPPED', label: 'Desistido' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setFiltroStatus(tab.id); resetVisibleCounts(); }}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex-1 sm:flex-initial text-center cursor-pointer ${
                  filtroStatus === tab.id 
                    ? (categoria === 'anime' 
                        ? 'bg-secondary/20 text-secondary border border-secondary/40 shadow-sm' 
                        : 'bg-primary/20 text-primary border border-primary/40 shadow-sm') 
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <div className="relative flex-1 sm:flex-initial">
              <button
                onClick={() => { setShowLancamentoMenu(!showLancamentoMenu); setShowOrdemMenu(false); setShowFormatoMenu(false); }}
                className="flex items-center justify-between gap-1.5 px-3 py-2 bg-black/40 border border-white/5 rounded-xl text-on-surface-variant hover:text-white transition-all text-xs font-bold w-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">filter_list</span>
                <span className="truncate">
                  {filtroLancamento === 'ALL' ? 'Lançamento: Todos' : 
                   filtroLancamento === 'RELEASING' ? 'Em Lançamento' : 
                   filtroLancamento === 'FINISHED' ? 'Finalizado' : filtroLancamento}
                </span>
                <span className="material-symbols-outlined text-xs">keyboard_arrow_down</span>
              </button>

              {showLancamentoMenu && (
                <div className="absolute left-0 right-0 sm:right-auto sm:w-48 mt-1.5 bg-surface-container border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {[
                    { id: 'ALL', label: 'Todos' },
                    { id: 'RELEASING', label: 'Em Lançamento' },
                    { id: 'FINISHED', label: 'Finalizado' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setFiltroLancamento(opt.id); setShowLancamentoMenu(false); resetVisibleCounts(); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors hover:bg-white/5 ${filtroLancamento === opt.id ? (categoria === 'anime' ? 'text-secondary' : 'text-primary') : 'text-on-surface-variant'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {categoria === 'anime' && (
              <div className="relative flex-1 sm:flex-initial">
                <button
                  onClick={() => { setShowFormatoMenu(!showFormatoMenu); setShowLancamentoMenu(false); setShowOrdemMenu(false); }}
                  className="flex items-center justify-between gap-1.5 px-3 py-2 bg-black/40 border border-white/5 rounded-xl text-on-surface-variant hover:text-white transition-all text-xs font-bold w-full cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">movie</span>
                  <span className="truncate">
                    {filtroFormato === 'ALL' ? 'Tipo: Todos' : 
                     filtroFormato === 'SERIE' ? 'Séries / Outros' : 
                     filtroFormato === 'MOVIE' ? 'Filmes' : filtroFormato}
                  </span>
                  <span className="material-symbols-outlined text-xs">keyboard_arrow_down</span>
                </button>

                {showFormatoMenu && (
                  <div className="absolute left-0 right-0 sm:right-auto sm:w-48 mt-1.5 bg-surface-container border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {[
                      { id: 'ALL', label: 'Todos' },
                      { id: 'SERIE', label: 'Séries / Outros' },
                      { id: 'MOVIE', label: 'Filmes' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setFiltroFormato(opt.id); setShowFormatoMenu(false); resetVisibleCounts(); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors hover:bg-white/5 ${filtroFormato === opt.id ? 'text-secondary' : 'text-on-surface-variant'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative flex-1 sm:flex-initial">
              <button
                onClick={() => { setShowOrdemMenu(!showOrdemMenu); setShowLancamentoMenu(false); setShowFormatoMenu(false); }}
                className="flex items-center justify-between gap-1.5 px-3 py-2 bg-black/40 border border-white/5 rounded-xl text-on-surface-variant hover:text-white transition-all text-xs font-bold w-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">sort</span>
                <span className="truncate">
                  {ordenacao === 'PRIORITY' ? 'Ordem: Prioridade' : 
                   ordenacao === 'TITLE' ? 'Ordem: Nome' : 
                   ordenacao === 'LATEST_EPISODE' ? 'Ordem: Ep. Mais Recente' :
                   'Ordem: Progresso'}
                </span>
                <span className="material-symbols-outlined text-xs">keyboard_arrow_down</span>
              </button>

              {showOrdemMenu && (
                <div className="absolute right-0 sm:left-0 sm:right-auto sm:w-48 mt-1.5 bg-surface-container border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {[
                    { id: 'PRIORITY', label: 'Prioridade' },
                    { id: 'TITLE', label: 'Nome' },
                    ...(categoria === 'anime' ? [{ id: 'LATEST_EPISODE', label: 'Episódio Mais Recente Estreado' }] : []),
                    { id: 'PROGRESS', label: 'Progresso' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setOrdenacao(opt.id); setShowOrdemMenu(false); resetVisibleCounts(); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors hover:bg-white/5 ${ordenacao === opt.id ? (categoria === 'anime' ? 'text-secondary' : 'text-primary') : 'text-on-surface-variant'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative flex-1 sm:flex-initial">
              <button
                onClick={() => { setPickerOpen(true); setShowLancamentoMenu(false); setShowOrdemMenu(false); setShowFormatoMenu(false); }}
                className="flex items-center justify-between gap-1.5 px-3 py-2 bg-black/40 border border-white/5 rounded-xl text-on-surface-variant hover:text-white transition-all text-xs font-bold w-full cursor-pointer min-h-[38px] active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">style</span>
                <span className="truncate">
                  {(selectedGenres.length === 0 && selectedTags.length === 0) 
                    ? 'Géneros & Tags' 
                    : `Filtros (${selectedGenres.length + selectedTags.length})`}
                </span>
                <span className="material-symbols-outlined text-xs">keyboard_arrow_down</span>
              </button>
            </div>

          </div>
        </div>

        {(selectedGenres.length > 0 || selectedTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 py-1 z-20 relative">
            {selectedGenres.map(genre => (
              <span key={genre} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 border border-primary/30 text-primary-light text-[11px] font-bold">
                {genre}
                <button onClick={() => { setSelectedGenres(prev => prev.filter(g => g !== genre)); resetVisibleCounts(); }} className="p-0.5 rounded-full hover:bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] block leading-none">close</span>
                </button>
              </span>
            ))}
            {selectedTags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00b0ff]/20 border border-[#00b0ff]/30 text-sky-300 text-[11px] font-bold">
                {tag}
                <button onClick={() => { setSelectedTags(prev => prev.filter(t => t !== tag)); resetVisibleCounts(); }} className="p-0.5 rounded-full hover:bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] block leading-none">close</span>
                </button>
              </span>
            ))}
            <button onClick={() => { setSelectedGenres([]); setSelectedTags([]); resetVisibleCounts(); }} className="text-xs text-on-surface-variant hover:text-white font-bold px-2 py-1 transition-colors">
              Limpar Todos
            </button>
          </div>
        )}

        <div>
          <GenreTagPicker
            metadata={metadata}
            selectedGenres={selectedGenres}
            selectedTags={selectedTags}
            isOpen={pickerOpen}
            onOpen={() => setPickerOpen(true)}
            onClose={() => setPickerOpen(false)}
            onToggleGenre={(name) => {
              setSelectedGenres(prev => 
                prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
              );
              resetVisibleCounts();
            }}
            onToggleTag={(name) => {
              setSelectedTags(prev => 
                prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
              );
              resetVisibleCounts();
            }}
            onClear={() => {
              setSelectedGenres([]);
              setSelectedTags([]);
              resetVisibleCounts();
            }}
            hideInlineTrigger={true}
            categoria={categoria}
          />
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-4 w-full">
            <Loader2 className={`w-8 h-8 animate-spin ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`} />
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t("A carregar biblioteca...")}</span>
          </div>
        ) : filtroStatus === 'WATCHING' ? (
          <div className="space-y-10 w-full relative z-10 animate-in fade-in duration-300">
            {/* Section 1: Pending */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="material-symbols-outlined text-secondary text-xl">play_circle</span>
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {categoria === 'anime' ? 'Episódios por Ver' : 'Capítulos por Ler'} ({comPendentes.length})
                </h3>
              </div>
              {paginatedComPendentes.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6">
                    {paginatedComPendentes.map(item => renderLibraryItem(item))}
                  </div>
                  {comPendentes.length > visibleCountPending && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setVisibleCountPending(prev => prev + 24)}
                        className={`px-8 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-lg active:scale-95 cursor-pointer ${
                          categoria === 'anime' 
                            ? 'bg-secondary hover:bg-secondary/90 hover:shadow-[0_0_20px_rgba(194,24,91,0.4)]' 
                            : 'bg-primary hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(106,27,154,0.4)]'
                        }`}
                      >
                        {t("Ver Mais")}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center glass-panel rounded-3xl border border-white/5">
                  <p className="text-on-surface-variant text-xs sm:text-sm font-medium italic">Nenhum título com novos episódios/capítulos por ver/ler.</p>
                </div>
              )}
            </div>

            {/* Section 2: Up to Date */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="material-symbols-outlined text-emerald-400 text-xl flex-shrink-0">check_circle</span>
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Em Dia ({emDia.length})
                </h3>
              </div>
              {paginatedEmDia.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6">
                    {paginatedEmDia.map(item => renderLibraryItem(item))}
                  </div>
                  {emDia.length > visibleCountEmDia && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => setVisibleCountEmDia(prev => prev + 24)}
                        className={`px-8 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-lg active:scale-95 cursor-pointer ${
                          categoria === 'anime' 
                            ? 'bg-secondary hover:bg-secondary/90 hover:shadow-[0_0_20px_rgba(194,24,91,0.4)]' 
                            : 'bg-primary hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(106,27,154,0.4)]'
                        }`}
                      >
                        {t("Ver Mais")}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center glass-panel rounded-3xl border border-white/5">
                  <p className="text-on-surface-variant text-xs sm:text-sm font-medium italic">Nenhum título em dia.</p>
                </div>
              )}
            </div>

            {/* Section 3: Por Estrear */}
            {categoria === 'anime' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <span className="material-symbols-outlined text-amber-500 text-xl flex-shrink-0">schedule</span>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                    Por Estrear ({porEstrear.length})
                  </h3>
                </div>
                {paginatedPorEstrear.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6">
                      {paginatedPorEstrear.map(item => renderLibraryItem(item))}
                    </div>
                    {porEstrear.length > visibleCountPorEstrear && (
                      <div className="flex justify-center pt-4">
                        <button
                          onClick={() => setVisibleCountPorEstrear(prev => prev + 24)}
                          className={`px-8 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-lg active:scale-95 cursor-pointer ${
                            categoria === 'anime' 
                              ? 'bg-secondary hover:bg-secondary/90 hover:shadow-[0_0_20px_rgba(194,24,91,0.4)]' 
                              : 'bg-primary hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(106,27,154,0.4)]'
                          }`}
                        >
                          {t("Ver Mais")}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center glass-panel rounded-3xl border border-white/5">
                    <p className="text-on-surface-variant text-xs sm:text-sm font-medium italic">Nenhum título por estrear.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Normal grid for other statuses */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6 relative z-10">
            {paginatedItems.length > 0 ? (
              paginatedItems.map(item => renderLibraryItem(item))
            ) : (
              <div className="col-span-full py-16 text-center glass-panel rounded-3xl border border-white/5 space-y-4 w-full">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant">search_off</span>
                <p className="text-on-surface font-bold text-lg">Sem títulos na biblioteca com este filtro.</p>
                <p className="text-on-surface-variant text-sm">Adiciona títulos novos usando a pesquisa superior!</p>
              </div>
            )}
          </div>
        )}

        {/* Load More Button */}
        {!loading && hasMore && filtroStatus !== 'WATCHING' && (
          <div className="flex justify-center pt-8 pb-4 relative z-20">
            <button
              onClick={() => setVisibleCount(prev => prev + 24)}
              className={`px-8 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-lg active:scale-95 cursor-pointer ${
                categoria === 'anime' 
                  ? 'bg-secondary hover:bg-secondary/90 hover:shadow-[0_0_20px_rgba(194,24,91,0.4)]' 
                  : 'bg-primary hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(106,27,154,0.4)]'
              }`}
            >
              {t("Ver Mais")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default LibraryPage;
