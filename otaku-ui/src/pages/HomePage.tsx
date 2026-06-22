import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { useToast } from '../context/ToastContext';
import { Loader2, Smartphone, Award, BookOpen, Clock, Film, PlayCircle, Shield, User, X } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTranslation } from '../hooks/useTranslation';

const MangaWebView = registerPlugin<any>('MangaWebView');

// const GENRES = [
//   "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
//   "Horror", "Mecha", "Mystery", "Psychological", "Romance", 
//   "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
// ];

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

type OverallRating = {
  avaliacao_geral: number;
  total_votos_users: number;
};

type MediaComment = {
  id: number;
  userId: number;
  mediaId: number;
  text: string;
  likes: number;
  createdAt: string;
  user?: {
    nome?: string;
    iconUrl?: string | null;
  };
};

const HomePage = () => {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { categoria, setCategoria, isShowingFavorites, setIsShowingFavorites, isSearchOpen, searchTerm, homeTrigger, setIsViewingDetails } = useMedia();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [resultadosPesquisa, setResultadosPesquisa] = useState<any[]>([]);
  const [resultadosDB, setResultadosDB] = useState<any[]>([]);
  const [animesDashboard, setAnimesDashboard] = useState<any[]>([]);
  const [mangasDashboard, setMangasDashboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [view, setView] = useState<'home' | 'details'>('home');
  const [externalProfile, setExternalProfile] = useState<any>(null);
  const [loadingExternalProfile, setLoadingExternalProfile] = useState(false);
  const [showExternalProfile, setShowExternalProfile] = useState(false);
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
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [overallRating, setOverallRating] = useState<OverallRating | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);

  const [filtroStatus, setFiltroStatus] = useState<string>('ALL');
  const [filtroLancamento, setFiltroLancamento] = useState<string>('ALL');
  const [ordenacao, setOrdenacao] = useState<string>('PRIORITY');
  const [showLancamentoMenu, setShowLancamentoMenu] = useState(false);
  const [showOrdemMenu, setShowOrdemMenu] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const getMediaId = (item = selectedItem) => item?.mangaId || item?.animeId || item?.id;

  const formatCommentDate = (value: string) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const carregarDadosInterativos = async (mediaId: number) => {
    setLoadingComments(true);
    setComments([]);
    setOverallRating(null);
    setUserRating(null);
    setNewCommentText('');

    try {
      const requests: Promise<Response>[] = [
        customFetch(`${API_BASE_URL}/comment/media/${mediaId}`),
        customFetch(`${API_BASE_URL}/rating/media/${mediaId}`),
      ];

      if (token) {
        requests.push(customFetch(`${API_BASE_URL}/rating/media/${mediaId}/user`, { headers: getHeaders() }));
      }

      const [commentsRes, overallRes, userRatingRes] = await Promise.all(requests);

      if (commentsRes.ok) {
        const data = await commentsRes.json();
        setComments(Array.isArray(data) ? data : []);
      }

      if (overallRes.ok) {
        const data = await overallRes.json();
        setOverallRating({
          avaliacao_geral: Number(data?.avaliacao_geral || 0),
          total_votos_users: Number(data?.total_votos_users || 0),
        });
      }

      if (userRatingRes?.ok) {
        const data = await userRatingRes.json();
        setUserRating(data?.score ?? null);
      }
    } catch (error) {
      console.error('Erro ao carregar avaliações/comentários:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const votarConteudo = async (score: number) => {
    const mediaId = getMediaId();
    if (!token || !mediaId || isSubmittingRating) return;
    setIsSubmittingRating(true);

    try {
      const response = await customFetch(`${API_BASE_URL}/rating`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ mediaId, score }),
      });

      if (!response.ok) throw new Error('Erro ao submeter avaliação');
      const data = await response.json();
      setUserRating(score);
      if (data?.media) {
        setOverallRating({
          avaliacao_geral: Number(data.media.avaliacao_geral || 0),
          total_votos_users: Number(data.media.total_votos_users || 0),
        });
      }
      showToast('Avaliação guardada.', 'success');
    } catch (error) {
      console.error('Erro ao votar:', error);
      showToast('Não foi possível guardar a avaliação.', 'error');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const enviarComentario = async () => {
    const mediaId = getMediaId();
    const text = newCommentText.trim();
    if (!token || !mediaId || !text || isSubmittingComment) return;
    setIsSubmittingComment(true);

    try {
      const response = await customFetch(`${API_BASE_URL}/comment`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ mediaId, text }),
      });

      if (!response.ok) throw new Error('Erro ao enviar comentário');
      const created = await response.json();
      setComments(prev => [created, ...prev]);
      setNewCommentText('');
      showToast('Comentário publicado.', 'success');
    } catch (error) {
      console.error('Erro ao comentar:', error);
      showToast('Não foi possível publicar o comentário.', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const gostarComentario = async (commentId: number) => {
    try {
      const response = await customFetch(`${API_BASE_URL}/comment/${commentId}/like`, { method: 'POST' });
      if (!response.ok) throw new Error('Erro ao gostar do comentário');
      setComments(prev => prev.map(comment => comment.id === commentId ? { ...comment, likes: comment.likes + 1 } : comment));
    } catch (error) {
      console.error('Erro ao gostar do comentário:', error);
    }
  };

  const eliminarComentario = async (commentId: number) => {
    if (!token) return;
    try {
      const response = await customFetch(`${API_BASE_URL}/comment/${commentId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Erro ao eliminar comentário');
      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (error) {
      console.error('Erro ao eliminar comentário:', error);
      showToast('Não foi possível eliminar o comentário.', 'error');
    }
  };

  const abrirPerfilExterno = async (userId: number) => {
    setLoadingExternalProfile(true);
    setShowExternalProfile(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/profile/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setExternalProfile(data);
      } else {
        showToast('Não foi possível obter o perfil deste utilizador.', 'error');
        setShowExternalProfile(false);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil de terceiros:', error);
      showToast('Erro ao obter perfil do utilizador.', 'error');
      setShowExternalProfile(false);
    } finally {
      setLoadingExternalProfile(false);
    }
  };

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
    setIsAddingToLibrary(true);
    const url = `${API_BASE_URL}/${categoria}/import`;
    try {
      const response = await customFetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nome: titulo, userId: user?.id, anilistId })
      });
      
      if (response.ok) {
        // Reset random clicks for today since we added a title to list
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.removeItem(`random_clicks_anime_${todayStr}`);
        localStorage.removeItem(`random_clicks_manga_${todayStr}`);

        const novoItem = await response.json();
        await Promise.all([
          consultarMinhaLista(),
          carregarDashboard()
        ]);
        
        const itemData = novoItem.manga || novoItem.anime || novoItem;
        setSelectedItem({ ...itemData, ...novoItem, dbId: novoItem.id, isExternal: false });
        if (categoria === 'manga' && anilistId) {
          carregarCapituloMaisRecente(anilistId, true);
        }
        showToast('Adicionado à biblioteca com sucesso!', 'success');
      } else {
        showToast('Não foi possível adicionar à biblioteca.', 'error');
      }
    } catch (error) {
      console.error("Erro no POST:", error);
      showToast('Erro ao adicionar à biblioteca.', 'error');
    } finally {
      setIsAddingToLibrary(false);
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
    setLoadingDetails(true);
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
          generos: [...(data.genres || []), ...(data.tags ? data.tags.map((t: any) => t.name) : [])].join(', '),
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

      carregarDadosInterativos(data.mangaId || data.animeId || data.id);
      setView('details');
      setShowEpList(false);
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoading(false);
      setLoadingDetails(false);
    }
  };


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

      // 1. Choose priority level (1 = highest, 10 = lowest)
      const pRand = Math.random() * 100;
      let chosenPriority = 10;
      if (pRand < 35) chosenPriority = 1;
      else if (pRand < 55) chosenPriority = 2;      // 35 + 20
      else if (pRand < 70) chosenPriority = 3;      // 55 + 15
      else if (pRand < 80) chosenPriority = 4;      // 70 + 10
      else if (pRand < 88) chosenPriority = 5;      // 80 + 8
      else if (pRand < 92) chosenPriority = 6;      // 88 + 4
      else if (pRand < 95) chosenPriority = 7;      // 92 + 3
      else if (pRand < 97.5) chosenPriority = 8;    // 95 + 2.5
      else if (pRand < 99) chosenPriority = 9;      // 97.5 + 1.5

      // 2. Choose finished status (75% finished, 25% releasing)
      const finishedRand = Math.random() < 0.75;

      // 3. Filter candidates
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

    // Fallback if no matches after 100 attempts
    if (!selected) {
      const idx = Math.floor(Math.random() * candidates.length);
      selected = candidates[idx];
    }

    if (selected) {
      await abrirDetalhes(selected.id, false, categoria);
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

  const eliminarLinkPessoal = async (siteName: string) => {
    if (selectedItem.isExternal) return;
    const links = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados) : [];
    const filtrados = links.filter((l: any) => l.site !== siteName);
    const jsonStr = JSON.stringify(filtrados);
    await atualizarCampo('linksPersonalizados', jsonStr);
    showToast('Link personalizado removido.', 'success');
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
    if (searchTerm.trim()) {
      setTermoPesquisa(searchTerm);
      const delayDebounceFn = setTimeout(() => {
        const pesquisarComTermo = async (term: string) => {
          setLoading(true);
          setSearchPage(1);
          setIsShowingFavorites(false);
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

  useEffect(() => {
    setView('home');
    setSelectedItem(null);
  }, [isShowingFavorites, isSearchOpen, homeTrigger]);

  useEffect(() => {
    setIsViewingDetails(view === 'details');
    return () => {
      setIsViewingDetails(false);
    };
  }, [view, setIsViewingDetails]);

  useEffect(() => {
    if (location.state?.openDetailsId) {
      const { openDetailsId, openDetailsType } = location.state;
      window.history.replaceState(null, '');
      abrirDetalhes(openDetailsId, false, openDetailsType);
    }
  }, [location]);

  const renderRatingCommentsSection = () => {
    const ratingValue = overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A';

    return (
      <div className={`space-y-6 pt-8 border-t border-white/5 ${isMobile ? '' : 'mt-4'}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className={`${isMobile ? 'text-base' : 'font-headline-lg text-2xl'} font-bold flex items-center gap-3 text-white`}>
            <span className={`${isMobile ? 'w-1 h-4' : 'w-1.5 h-6'} rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
            Avaliações e comentários
          </h3>
          <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${categoria === 'anime' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/10 border-secondary/30 text-secondary'}`}>
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            <span className="font-black">{ratingValue}</span>
            <span className="text-xs text-on-surface-variant">/ 10</span>
          </div>
        </div>

        {token ? (
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                {userRating ? `A tua avaliação atual: ${userRating}/10` : 'Dá a tua avaliação'}
              </p>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {Array.from({ length: 10 }, (_, index) => index + 1).map(score => {
                  const active = userRating === score;
                  return (
                    <button
                      key={score}
                      onClick={() => votarConteudo(score)}
                      disabled={isSubmittingRating}
                      className={`aspect-square rounded-full border text-sm font-black transition-all active:scale-95 disabled:opacity-60 ${
                        active
                          ? `${categoria === 'anime' ? 'bg-primary border-primary text-on-primary shadow-[0_0_18px_rgba(221,184,255,0.35)]' : 'bg-secondary border-secondary text-on-secondary shadow-[0_0_18px_rgba(255,176,203,0.35)]'}`
                          : `bg-surface-variant/30 border-white/10 text-on-surface-variant hover:text-white ${categoria === 'anime' ? 'hover:border-primary/40 hover:bg-primary/10' : 'hover:border-secondary/40 hover:bg-secondary/10'}`
                      }`}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ${categoria === 'anime' ? 'border-primary/40 bg-primary/10' : 'border-secondary/40 bg-secondary/10'}`}>
                {user?.iconUrl ? (
                  <img src={user.iconUrl} alt={user.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center font-black ${categoria === 'anime' ? 'text-primary' : 'text-secondary'}`}>
                    {(user?.nome || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <textarea
                  value={newCommentText}
                  onChange={event => setNewCommentText(event.target.value)}
                  placeholder="Escreve um comentário..."
                  rows={3}
                  className={`w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none resize-none transition-all ${categoria === 'anime' ? 'focus:border-primary/60' : 'focus:border-secondary/60'}`}
                />
                <button
                  onClick={enviarComentario}
                  disabled={!newCommentText.trim() || isSubmittingComment}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:bg-surface-variant disabled:text-on-surface-variant disabled:shadow-none ${categoria === 'anime' ? 'bg-primary hover:bg-primary/80 text-on-primary' : 'bg-secondary hover:bg-secondary/80 text-on-secondary'}`}
                >
                  {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="material-symbols-outlined text-base">send</span>}
                  Publicar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`p-4 rounded-2xl border bg-surface-variant/20 text-sm text-on-surface-variant ${categoria === 'anime' ? 'border-primary/20' : 'border-secondary/20'}`}>
            Inicia sessão para avaliar e comentar este conteúdo.
          </div>
        )}

        <div className="space-y-3">
          {loadingComments ? (
            <div className="flex items-center gap-2 text-on-surface-variant text-sm">
              <Loader2 className={`w-4 h-4 animate-spin ${categoria === 'anime' ? 'text-primary' : 'text-secondary'}`} />
              A carregar comentários...
            </div>
          ) : comments.length === 0 ? (
            <div className="p-5 rounded-2xl border border-white/10 bg-surface-variant/20 text-center text-on-surface-variant text-sm">
              Ninguém comentou ainda. Seja o primeiro a comentar!
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="glass-panel rounded-2xl border border-white/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-9 h-9 rounded-full overflow-hidden bg-surface-variant flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                      onClick={() => abrirPerfilExterno(comment.userId)}
                      title={`Ver perfil de ${comment.user?.nome || 'Utilizador'}`}
                    >
                      {comment.user?.iconUrl ? (
                        <img src={comment.user.iconUrl} alt={comment.user?.nome || 'User'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-black text-on-surface-variant">
                          {(comment.user?.nome || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div 
                      className="min-w-0 cursor-pointer group"
                      onClick={() => abrirPerfilExterno(comment.userId)}
                      title={`Ver perfil de ${comment.user?.nome || 'Utilizador'}`}
                    >
                      <p className="font-bold text-white text-sm truncate group-hover:text-primary-light transition-colors">{comment.user?.nome || 'Utilizador'}</p>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">{formatCommentDate(comment.createdAt)}</p>
                    </div>
                  </div>
                  {comment.userId === user?.id && (
                    <button onClick={() => eliminarComentario(comment.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error/10 transition-all" title="Eliminar comentário">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  )}
                </div>
                <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                <button onClick={() => gostarComentario(comment.id)} className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-white transition-all">
                  <span className="material-symbols-outlined text-base">favorite</span>
                  {comment.likes}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // const totalEpsNum = selectedItem ? (categoria === 'anime' 
  //   ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || 0)) 
  //   : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 0)))
  // : 0;

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-4 md:py-8">
      {view === 'home' ? (
        <div className="w-full space-y-5 md:space-y-12">
          
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

              {/* Grid de Resultados */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6">
                {resultadosPesquisa.length > 0 ? (
                  resultadosPesquisa.map((item) => (
                    <div 
                      key={item.id} 
                      className="group cursor-pointer space-y-2" 
                      onClick={() => abrirDetalhes(item.id, true, categoria)}
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
                ) : !loading && (
                  <p className="col-span-full text-center text-on-surface-variant py-10 italic">Nenhum resultado encontrado.</p>
                )}
              </div>

              {/* Load More Button */}
              {hasMoreResults && (
                <div className="flex justify-center pt-8 pb-4">
                  <button 
                    onClick={carregarMais} 
                    disabled={loadingMore} 
                    className={`px-8 py-3 rounded-2xl font-bold flex items-center gap-3 border transition-all shadow-lg ${
                      categoria === 'anime' 
                        ? 'bg-primary/20 hover:bg-primary border-primary/30 text-primary hover:text-on-primary' 
                        : 'bg-secondary/20 hover:bg-secondary border-secondary/30 text-secondary hover:text-on-secondary'
                    }`}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        A carregar...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">expand_more</span>
                        Carregar Mais
                      </>
                    )}
                  </button>
                </div>
              )}
            </section>
          ) : (
            
            /* Dashboard Home View */
            <div className="w-full space-y-5 md:space-y-12">
              
              {!isShowingFavorites && (
                <>
                  {/* 1. Hero Banner */}
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
                
                // Banner Static or Dynamic
                const heroCover = featured 
                  ? (featured.anime?.capaUrl || featured.manga?.capaUrl || featured.capaUrl) 
                  : "https://lh3.googleusercontent.com/aida-public/AB6AXuAdtT1AIxrRwBQnzU-fRoU_CPtKD9Xg1BvY8Y0s8RmV9b72bUNwYypAj6y1bSs3zGLoHsC42HBjrc-vfOd-GCn8zJ7t7_bAD64gVr-zkqRjmztIwOu65eWLmgtjLa7JAfnvqQfYW8zyifOI02asFkKaoqhR5efMIXzhP1VCrztKNkT-VnbHIY6U8jNEjGTUgZ2KmPbTyk_yFAVbf66hQw16YdK6fz4WhziI1BJhuQPEW8mcUT8GLAug_FE1_g-JhwikhX1qCIAflXZZ";
                
                const heroTitle = featured ? (featured.anime?.titulo || featured.manga?.titulo || featured.titulo) : "Cyberpunk: Edgerunners";
                const heroDesc = featured ? (featured.anime?.sinopse || featured.manga?.sinopse || featured.descricao || "Continua a acompanhar o teu anime favorito na lista.") : "Numa distopia mergulhada em corrupção e implantes cibernéticos, um talentoso miúdo de rua decide tornar-se um fora da lei.";
                
                return (
                  <section className={`relative rounded-3xl overflow-hidden glass-panel rim-light group ${isMobile ? 'h-[190px]' : 'h-[240px] md:h-[280px]'} flex items-center`}>
                    {/* Ambient Glow Blurred Backdrop */}
                    <div className="absolute inset-0 pointer-events-none z-0">
                      <img 
                        src={heroCover} 
                        className="w-full h-full object-cover scale-125 blur-3xl opacity-20 transition-transform duration-700 group-hover:scale-130" 
                        alt="" 
                      />
                      <div className="absolute inset-0 bg-[#0F1014]/40"></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent"></div>
                    </div>
                    
                    {/* Flex Row Container */}
                    <div className="relative w-full h-full flex items-center justify-between gap-6 p-5 md:p-8 z-10">
                      {/* Left: Text Details */}
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
                            onClick={() => featured ? abrirDetalhes(featured.id, false, categoria) : showToast(t("Procura por Cyberpunk na barra superior!"), "info")}
                            className={`px-4 py-2 rounded-xl text-white font-label-md text-[11px] font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer hover:shadow-lg ${categoria === 'anime' ? 'bg-secondary hover:shadow-[0_0_20px_rgba(194,24,91,0.4)]' : 'bg-primary hover:shadow-[0_0_20px_rgba(106,27,154,0.4)]'}`}
                          >
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>info</span> 
                            {t("Ver Detalhes")}
                          </button>
                        </div>
                      </div>
                      
                      {/* Right: High-Resolution Vertical Poster Card */}
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

              {/* 3. Up Next Section */}
              {(() => {
                const dashboardItems = categoria === 'anime' ? animesDashboard : mangasDashboard;
                if (dashboardItems.length === 0) return null;
                
                return (
                  <section className="space-y-4 md:space-y-6">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className={`font-label-md text-[10px] uppercase tracking-widest block mb-1 ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`}>{t("Continuar")}</span>
                        <h3 className="font-headline-lg text-lg md:text-xl text-white font-black">{t(categoria === 'anime' ? 'Próximo Episódio' : 'Próximo Capítulo')}</h3>
                      </div>
                    </div>

                    {isMobile ? (
                      /* Mobile Scroll Horizontal - Portrait cards (taller & narrower) to prevent cover crop and fill space */
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
                              className="flex-shrink-0 w-[120px] glass-panel rounded-2xl overflow-hidden border border-white/5 rim-light group transition-all duration-300 active:scale-98 cursor-pointer"
                              onClick={() => abrirDetalhes(item.id, false, categoria)}
                            >
                              {/* Top: Portrait Cover Card (No crop) */}
                              <div className="relative aspect-[3/4] w-full overflow-hidden border-b border-white/5">
                                <img src={coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                                <div className="absolute inset-0 bg-black/10"></div>
                                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md text-[8px] font-black text-white border border-white/5 uppercase">
                                  {categoria === 'anime' ? `EP ${epQueVouVer}` : `CAP ${epQueVouVer}`}
                                </div>
                              </div>
                              
                              {/* Bottom: Info & Controls */}
                              <div className="p-2 space-y-2">
                                <div className="space-y-1 min-w-0">
                                  <h4 className="text-white font-bold text-xs truncate group-hover:text-primary transition-colors">{title}</h4>
                                  <div className="w-full">
                                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`} style={{ width: `${percent}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <div className="text-[9px] text-on-surface-variant flex items-center gap-0.5 font-bold">
                                    <span className={`material-symbols-outlined text-[11px] ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`}>hourglass_empty</span>
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
                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 cursor-pointer"
                                    title="Marcar mais um visto"
                                  >
                                    {savingItems[item.id] ? (
                                      <Loader2 className={`w-3 h-3 animate-spin ${categoria === 'anime' ? 'text-secondary' : 'text-primary'}`} />
                                    ) : (
                                      <span className="material-symbols-outlined text-[13px]">play_arrow</span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Desktop Grid (3 columns) */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                              className="glass-panel rim-light p-3.5 rounded-2xl flex gap-4 hover:border-primary/50 transition-all cursor-pointer group min-w-0"
                              onClick={() => abrirDetalhes(item.id, false, categoria)}
                            >
                              <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 relative">
                                <img src={coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                              </div>
                              <div className="flex flex-col justify-between py-1.5 min-w-0 flex-1">
                                <div className="min-w-0 space-y-1">
                                  <h4 className="font-label-md text-sm text-white mb-1 group-hover:text-primary transition-colors truncate">{title}</h4>
                                  <p className="text-xs text-on-surface-variant font-medium">
                                    {categoria === 'anime' ? `Episódio ${epQueVouVer}` : `Capítulo ${epQueVouVer}`}
                                  </p>
                                  {/* Progress bar moved to details column */}
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
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center active:scale-90 cursor-pointer"
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
                </>
              )}

              {/* 4. Minha Biblioteca Section */}
              {isShowingFavorites && (
                <section id="biblioteca-section" className="space-y-6 md:space-y-8 relative z-30">
                  {/* Vista Biblioteca Principal (quando ativada a partir do menu lateral) */}
                  <div className="flex flex-col space-y-6 border-b border-white/10 pb-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <span className="material-symbols-outlined text-primary text-3xl sm:text-4xl md:text-5xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>video_library</span>
                        <div className="min-w-0">
                          <h2 className="text-xl sm:text-4xl md:text-5xl font-black text-white tracking-tight capitalize mb-0.5 sm:mb-1 truncate">
                            Biblioteca ({categoria === 'anime' ? 'Anime' : 'Mangá'})
                          </h2>
                          <p className="text-xs sm:text-base text-on-surface-variant font-medium">
                            {(() => {
                              const filtrados = resultadosDB.filter(item => {
                                if (filtroStatus !== 'ALL' && item.status !== filtroStatus) return false;
                                const statusLancamento = item.anime?.statusLancamento || item.manga?.statusLancamento || item.statusLancamento;
                                if (filtroLancamento !== 'ALL' && statusLancamento !== filtroLancamento) return false;
                                return true;
                              });
                              return `A mostrar ${filtrados.length} de ${resultadosDB.length} títulos guardados`;
                            })()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Top Right action: Raffle Button */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button 
                          onClick={() => {
                            sorteioAleatorioBiblioteca();
                          }}
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


                {/* Filters & Sorting Controls */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-surface-variant/10 p-2 rounded-2xl border border-white/5 backdrop-blur-md w-full sm:w-fit relative z-30">
                  {/* Status Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 w-full sm:w-auto justify-center">
                    {[
                      { id: 'ALL', label: 'Todos' },
                      { id: 'WATCHING', label: categoria === 'anime' ? 'A Ver' : 'A Ler' },
                      { id: 'COMPLETED', label: 'Completo' },
                      { id: 'PLANNED', label: 'Planeado' },
                      { id: 'PAUSED', label: 'Pausado' },
                      { id: 'DROPPED', label: 'Desistido' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setFiltroStatus(tab.id)}
                        className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex-1 sm:flex-initial text-center cursor-pointer ${
                          filtroStatus === tab.id 
                            ? (categoria === 'anime' 
                                ? 'bg-secondary/20 text-secondary border border-secondary/40 shadow-sm' 
                                : 'bg-primary/20 text-primary border border-primary/40 shadow-sm') 
                            : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Release Status Dropdown */}
                  <div className="relative z-30 flex-1 sm:flex-initial min-w-[140px]">
                    <button
                      onClick={() => { setShowLancamentoMenu(!showLancamentoMenu); setShowOrdemMenu(false); }}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/40 hover:bg-white/5 border border-white/5 text-[11px] sm:text-xs font-bold text-white transition-all shadow-sm w-full cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs sm:text-sm text-on-surface-variant flex-shrink-0">sensors</span>
                      <span className="truncate">
                        {filtroLancamento === 'ALL' ? 'Lançamento: Todos' :
                         filtroLancamento === 'RELEASING' ? 'Lançamento: Em Curso' :
                         filtroLancamento === 'FINISHED' ? 'Lançamento: Terminado' :
                         filtroLancamento === 'HIATUS' ? 'Lançamento: Hiato' : 'Lançamento: Cancelado'}
                      </span>
                      <span className="material-symbols-outlined text-xs sm:text-sm text-on-surface-variant ml-auto">expand_more</span>
                    </button>

                    {showLancamentoMenu && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setShowLancamentoMenu(false)}></div>
                        <div className="absolute top-full mt-2 left-0 w-48 bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-200">
                          {[
                            { id: 'ALL', label: 'Todos' },
                            { id: 'RELEASING', label: 'Em Curso' },
                            { id: 'FINISHED', label: 'Terminado' },
                            { id: 'HIATUS', label: 'Hiato' },
                            { id: 'CANCELLED', label: 'Cancelado' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => { setFiltroLancamento(opt.id); setShowLancamentoMenu(false); }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                filtroLancamento === opt.id 
                                  ? (categoria === 'anime' ? 'bg-secondary/20 text-secondary border border-secondary/30 shadow-sm' : 'bg-primary/20 text-primary border border-primary/30 shadow-sm') 
                                  : 'text-on-surface-variant hover:text-white hover:bg-slate-900/50'
                              }`}
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

                  {/* Sorting Dropdown */}
                  <div className="relative z-30 flex-1 sm:flex-initial min-w-[140px]">
                    <button
                      onClick={() => { setShowOrdemMenu(!showOrdemMenu); setShowLancamentoMenu(false); }}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/40 hover:bg-white/5 border border-white/5 text-[11px] sm:text-xs font-bold text-white transition-all shadow-sm w-full cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs sm:text-sm text-on-surface-variant flex-shrink-0">sort</span>
                      <span className="truncate">
                        {ordenacao === 'PRIORITY' ? 'Ordenar: Prioridade' :
                         ordenacao === 'TITLE' ? 'Ordenar: Nome (A-Z)' :
                         ordenacao === 'PROGRESS_DESC' ? 'Ordenar: Mais Atrasado' : 'Ordenar: Mais Próximo'}
                      </span>
                      <span className="material-symbols-outlined text-xs sm:text-sm text-on-surface-variant ml-auto">expand_more</span>
                    </button>

                    {showOrdemMenu && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setShowOrdemMenu(false)}></div>
                        <div className="absolute top-full mt-2 left-0 w-48 bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-200">
                          {[
                            { id: 'PRIORITY', label: 'Prioridade' },
                            { id: 'TITLE', label: 'Nome (A-Z)' },
                            { id: 'PROGRESS_DESC', label: 'Mais Atrasado' },
                            { id: 'PROGRESS_ASC', label: 'Mais Próximo' },
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => { setOrdenacao(opt.id); setShowOrdemMenu(false); }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                                ordenacao === opt.id 
                                  ? (categoria === 'anime' ? 'bg-secondary/20 text-secondary border border-secondary/30 shadow-sm' : 'bg-primary/20 text-primary border border-primary/30 shadow-sm') 
                                  : 'text-on-surface-variant hover:text-white hover:bg-slate-900/50'
                              }`}
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

                {/* Grid de Posters */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6 pt-4 relative z-10">
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
                      filtrados.map((item) => {
                        const coverUrl = item.anime?.capaUrl || item.manga?.capaUrl || item.capaUrl;
                        const title = item.anime?.titulo || item.manga?.titulo || item.titulo;
                        
                        return (
                          <div 
                            key={item.id} 
                            className="group cursor-pointer" 
                            onClick={() => abrirDetalhes(item.id, false, categoria)}
                          >
                            <div className={`relative aspect-[2/3] rounded-3xl overflow-hidden shadow-xl transform transition-all duration-500 group-hover:scale-[1.03] group-hover:-translate-y-2 border border-white/10 ${categoria === 'anime' ? 'group-hover:border-secondary/60 group-hover:shadow-[0_0_30px_rgba(194,24,91,0.25)]' : 'group-hover:border-primary/60 group-hover:shadow-[0_0_30px_rgba(106,27,154,0.25)]'}`}>
                              <img src={coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={title} />
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
                                    'bg-surface-variant/50 border-white/10 text-on-surface-variant'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                      item.status === 'WATCHING' ? (categoria === 'anime' ? 'bg-secondary animate-pulse shadow-[0_0_8px_rgba(194,24,91,0.8)]' : 'bg-primary animate-pulse shadow-[0_0_8px_rgba(106,27,154,0.8)]') :
                                      item.status === 'COMPLETED' ? 'bg-emerald-400' :
                                      item.status === 'PAUSED' ? 'bg-amber-400' :
                                      item.status === 'PLANNED' ? 'bg-blue-400' :
                                      'bg-on-surface-variant'
                                    }`}></span>
                                    <span className="truncate">
                                      {item.status === 'WATCHING' ? (categoria === 'anime' ? 'A Ver' : 'A Ler') :
                                       item.status === 'COMPLETED' ? 'Completo' :
                                       item.status === 'PAUSED' ? 'Pausado' :
                                       item.status === 'PLANNED' ? 'Planeado' : 'Salvo'}
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
                                <span className={`w-fit px-2 py-0.5 rounded-lg text-[9px] font-extrabold tracking-wider mb-1.5 border ${categoria === 'anime' ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-secondary/20 border-secondary/30 text-secondary'}`}>
                                  {categoria === 'anime' ? 'ANIME' : 'MANGÁ'}
                                </span>
                                <p className={`font-bold text-sm text-white line-clamp-2 mb-2 ${categoria === 'anime' ? 'group-hover:text-primary-light' : 'group-hover:text-secondary-light'} transition-colors`}>
                                  {title}
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
                                          Progresso
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
                        );
                      })
                    ) : (
                      <div className="col-span-full py-16 text-center glass-panel rounded-3xl border border-white/5 space-y-4">
                        <span className="material-symbols-outlined text-5xl text-on-surface-variant">search_off</span>
                        <p className="text-on-surface font-bold text-lg">Sem títulos na biblioteca com este filtro.</p>
                        <p className="text-on-surface-variant text-sm">Adiciona títulos novos usando a pesquisa superior!</p>
                      </div>
                    );
                  })()}
                </div>
              </section>
              )}
            </div>
          )}
        </div>
      ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            <button onClick={() => setView('home')} className={`mb-10 flex items-center gap-2 px-5 py-2.5 rounded-full glass-panel border border-white/10 text-on-surface-variant hover:text-white transition-all group font-bold shadow-lg ${categoria === 'anime' ? 'hover:border-secondary/50 hover:shadow-[0_0_15px_rgba(194,24,91,0.3)]' : 'hover:border-primary/50 hover:shadow-[0_0_15px_rgba(106,27,154,0.3)]'}`}>
              <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
              Back to Home
            </button>
            {selectedItem && (
              isMobile ? (
                /* VERSÃO ANDROID NATIVA: Ordem Exata Solicitada pelo Utilizador + Margens Otimizadas */
                <div className={`glass-panel rounded-2xl sm:rounded-3xl overflow-hidden border p-4 sm:p-6 space-y-6 ${categoria === 'anime' ? 'border-secondary/20 shadow-lg' : 'border-primary/20 shadow-lg'}`}>
                  {/* 1. Capa & Título */}
                  <div className="flex gap-4 items-start">
                    <div className={`w-28 sm:w-36 aspect-[2/3] rounded-xl overflow-hidden shadow-lg border-2 border-background ring-1 ${categoria === 'anime' ? 'ring-secondary/50' : 'ring-primary/50'} flex-shrink-0`}>
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
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black w-fit ${categoria === 'anime' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/10 border-secondary/30 text-secondary'}`}>
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'} / 10
                      </div>
                      
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
                    {Array.from(new Set<string>(
                      (selectedItem.generos ? selectedItem.generos.split(',') : [])
                        .map((g: string) => g.trim())
                        .filter(Boolean)
                    )).map((g: string) => (
                      <span key={g} className={`px-3 py-1 bg-white/5 rounded-lg text-[11px] font-bold text-on-surface border tracking-wider ${categoria === 'anime' ? 'border-secondary/30' : 'border-primary/30'}`}>
                        {g}
                      </span>
                    ))}
                  </div>

                  {/* Info Grid: Release Status, Season & Total Episodes/Chapters (Visible always) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 border-t border-white/5">
                    <div className="glass-panel p-2 flex flex-col items-center justify-center text-center border border-white/5 min-w-0">
                      <p className="text-on-surface-variant text-[8px] uppercase font-bold tracking-widest mb-1 truncate w-full">Status</p>
                      <p className={`font-bold text-xs truncate w-full ${selectedItem.statusLancamento === 'RELEASING' ? (categoria === 'anime' ? 'text-primary' : 'text-secondary') : 'text-white'}`}>
                        {selectedItem.statusLancamento === 'RELEASING' ? 'Releasing' : 
                         selectedItem.statusLancamento === 'FINISHED' ? 'Finished' : 
                         selectedItem.statusLancamento === 'HIATUS' ? 'Hiatus' : 
                         selectedItem.statusLancamento === 'CANCELLED' ? 'Cancelled' : 
                         selectedItem.statusLancamento || 'Unknown'}
                      </p>
                    </div>
                    <div className="glass-panel p-2 flex flex-col items-center justify-center text-center border border-white/5 min-w-0">
                      <p className="text-on-surface-variant text-[8px] uppercase font-bold tracking-widest mb-1 truncate w-full">Season</p>
                      <p className="font-bold text-xs text-white capitalize truncate w-full">
                        {selectedItem.temporada ? `${selectedItem.temporada.toLowerCase()} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A'}
                      </p>
                    </div>
                    <div className="glass-panel p-2 flex flex-col items-center justify-center text-center border border-white/5 min-w-0">
                      <p className="text-on-surface-variant text-[8px] uppercase font-bold tracking-widest mb-1 truncate w-full">
                        {categoria === 'anime' ? 'Episodes' : 'Chapters'}
                      </p>
                      <p className="font-bold text-xs text-white truncate w-full">
                        {categoria === 'anime' ? (selectedItem.numEpisodiosTotal || 'N/A') : (selectedItem.numCapitulosTotal || 'N/A')}
                      </p>
                    </div>
                    <div className="glass-panel p-2 flex flex-col items-center justify-center text-center border border-white/5 min-w-0">
                      <p className="text-on-surface-variant text-[8px] uppercase font-bold tracking-widest mb-1 truncate w-full">Nota Geral</p>
                      <p className={`font-bold text-xs truncate w-full ${categoria === 'anime' ? 'text-primary' : 'text-secondary'}`}>
                        {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'} / 10
                      </p>
                    </div>
                  </div>

                  {/* 3. Ações (Quick Actions & My Progress) */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h3 className="text-base font-bold flex items-center gap-2 text-white">
                      <span className={`w-1 h-4 rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                      Actions & Progress
                    </h3>

                    {selectedItem.isExternal ? (
                      <button 
                        onClick={() => { adicionarAoBanco(selectedItem.titulo, selectedItem.id); }} 
                        disabled={isAddingToLibrary}
                        className="w-full bg-primary hover:bg-primary/80 text-on-primary py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAddingToLibrary ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            ADDING...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">add</span> ADD TO LIBRARY
                          </>
                        )}
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
                                <button key={opt.value} onClick={() => atualizarCampo('status', opt.value)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-bold relative overflow-hidden group active:scale-95 ${isSelected ? (categoria === 'anime' ? 'bg-secondary/20 border-secondary text-secondary shadow-sm' : 'bg-primary/20 border-primary text-primary shadow-sm') : 'bg-surface-variant/30 border-white/5 text-on-surface-variant'}`}>
                                  {isSelected && (
                                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${categoria === 'anime' ? 'bg-secondary' : 'bg-primary'}`}></span>
                                  )}
                                  <span className={`material-symbols-outlined text-base ${isSelected ? (categoria === 'anime' ? 'text-secondary' : 'text-primary') : 'text-on-surface-variant'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
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
                        <div className={`p-4 rounded-2xl border ${showEpList ? (categoria === 'anime' ? 'bg-secondary/10 border-secondary/40' : 'bg-primary/10 border-primary/40') : 'glass-panel border-white/5'}`}>
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
                                <input type="number" min="0" max={categoria === 'anime' ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || 9999)) : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 9999))} value={categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual} onChange={(e) => { const val = parseInt(e.target.value) || 0; atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', val); }} className={`bg-transparent ${categoria === 'anime' ? 'text-primary focus:bg-secondary/10' : 'text-secondary focus:bg-primary/10'} font-black text-3xl w-16 text-center outline-none border-b border-white/10 focus:border-white/40 rounded transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-0.5`} />
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
                            <div key={index} className="w-full flex items-center justify-between p-3.5 glass-panel rounded-xl shadow-sm border border-white/5">
                              <div onClick={() => abrirLink(link.url, selectedItem.titulo)} className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer">
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
                              <div className="flex items-center gap-2">
                                {link.tipo === 'Custom' && (
                                  <button onClick={(e) => { e.stopPropagation(); eliminarLinkPessoal(link.site); }} className="text-red-400 hover:text-red-300 p-1 flex items-center justify-center cursor-pointer" title="Remover link">
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                )}
                                <span onClick={() => abrirLink(link.url, selectedItem.titulo)} className="material-symbols-outlined text-sm flex-shrink-0 text-on-surface-variant cursor-pointer">chevron_right</span>
                              </div>
                            </div>
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
                  {renderRatingCommentsSection()}
                </div>
              ) : (
                /* VERSÃO WEB INTOCADA (Exatamente o código original) */
                <div className={`glass-panel rounded-3xl overflow-hidden border ${categoria === 'anime' ? 'border-secondary/20 shadow-[0_0_100px_rgba(194,24,91,0.15)]' : 'border-primary/20 shadow-[0_0_100px_rgba(106,27,154,0.15)]'}`}>
                  <div className="relative h-[400px] md:h-[500px]">
                    <img src={selectedItem.capaUrl} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30" alt="" />
                    <div className={`absolute inset-0 bg-gradient-to-t from-background via-background/80 ${categoria === 'anime' ? 'to-secondary-container/20' : 'to-primary-container/20'}`}></div>
                    <div className="relative h-full flex flex-col md:flex-row items-end p-8 md:p-12 gap-8">
                      <div className={`w-48 md:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] border-4 border-background ring-2 ${categoria === 'anime' ? 'ring-secondary/50' : 'ring-primary/50'} flex-shrink-0 group`}>
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
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border mb-6 font-black ${categoria === 'anime' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/10 border-secondary/30 text-secondary'}`}>
                          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'} / 10
                        </div>
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
                          {Array.from(new Set<string>(
                            (selectedItem.generos ? selectedItem.generos.split(',') : [])
                              .map((g: string) => g.trim())
                              .filter(Boolean)
                          )).map((g: string) => (
                            <span key={g} className={`px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full text-xs font-bold text-on-surface border tracking-wider transition-all hover:scale-105 ${categoria === 'anime' ? 'border-secondary/30 hover:bg-secondary/20 hover:border-secondary/60 hover:text-secondary shadow-[0_0_10px_rgba(194,24,91,0.1)]' : 'border-primary/30 hover:bg-primary/20 hover:border-primary/60 hover:text-primary shadow-[0_0_10px_rgba(106,27,154,0.1)]'}`}>
                              {g}
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
                              <div key={idx} className="flex items-center justify-between p-5 glass-panel hover:bg-white/5 rounded-2xl transition-all border border-primary/30 hover:border-primary/50 shadow-lg group">
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
                                <div key={index} className={`w-full flex items-center justify-between p-5 glass-panel rounded-2xl shadow-lg border transition-all ${categoria === 'anime' ? 'border-white/5' : 'border-primary/50'}`}>
                                  <div onClick={() => abrirLink(link.url, selectedItem.titulo)} className="flex-1 flex items-center gap-4 cursor-pointer min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${link.tipo === 'Custom' ? 'bg-secondary/10 text-secondary shadow-[0_0_10px_rgba(255,176,203,0.2)]' : 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(221,184,255,0.2)]'}`}>
                                      <span className="material-symbols-outlined">open_in_new</span>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2 truncate">
                                        {link.site}
                                        {link.tipo === 'Custom' && <span className="px-2 py-0.5 bg-secondary/20 text-secondary text-[10px] rounded-full border border-secondary/30 flex-shrink-0">CUSTOM</span>}
                                      </p>
                                      <p className="text-xs text-on-surface-variant font-bold uppercase">{link.language || 'Global'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {link.tipo === 'Custom' && (
                                      <button onClick={(e) => { e.stopPropagation(); eliminarLinkPessoal(link.site); }} className="text-red-400 hover:text-red-300 p-1.5 flex items-center justify-center cursor-pointer" title="Remover link">
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                      </button>
                                    )}
                                    <span onClick={() => abrirLink(link.url, selectedItem.titulo)} className={`material-symbols-outlined cursor-pointer text-on-surface-variant hover:text-white`}>chevron_right</span>
                                  </div>
                                </div>
                              ))}
                              {todosLinks.length === 0 && (
                                <p className="text-on-surface-variant italic text-sm col-span-2">No links available. Add one above!</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div className={`grid grid-cols-1 ${!selectedItem.isExternal ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-6 py-8 border-t border-white/5`}>
                        {/* Status Card */}
                        <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all ${categoria === 'anime' ? 'hover:border-secondary/30 hover:bg-secondary/5 hover:shadow-[0_0_20px_rgba(194,24,91,0.1)]' : 'hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(106,27,154,0.1)]'}`}>
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
                        <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all ${categoria === 'anime' ? 'hover:border-secondary/30 hover:bg-secondary/5 hover:shadow-[0_0_20px_rgba(194,24,91,0.1)]' : 'hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(106,27,154,0.1)]'}`}>
                          <div className="w-10 h-10 rounded-2xl bg-surface-variant/30 text-on-surface-variant flex items-center justify-center mb-3">
                            <span className="material-symbols-outlined text-xl">calendar_month</span>
                          </div>
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Season / Year</p>
                          <p className="font-bold text-lg text-white capitalize">
                            {selectedItem.temporada ? `${selectedItem.temporada.toLowerCase()} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A'}
                          </p>
                        </div>

                        {/* Planned Episodes/Chapters Card */}
                        <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all ${categoria === 'anime' ? 'hover:border-secondary/30 hover:bg-secondary/5 hover:shadow-[0_0_20px_rgba(194,24,91,0.1)]' : 'hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(106,27,154,0.1)]'}`}>
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${categoria === 'anime' ? 'bg-primary/10 text-primary shadow-[0_0_15px_rgba(221,184,255,0.2)]' : 'bg-secondary/10 text-secondary shadow-[0_0_15px_rgba(255,176,203,0.2)]'}`}>
                            <span className="material-symbols-outlined text-xl">update</span>
                          </div>
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">{categoria === 'anime' ? 'Total Episodes' : 'Total Chapters'}</p>
                          <p className="font-bold text-lg text-white">
                            {categoria === 'anime' ? (selectedItem.numEpisodiosTotal || 'No official info') : (selectedItem.numCapitulosTotal || 'No official info')}
                          </p>
                        </div>

                        {/* Last Modified Card */}
                        {!selectedItem.isExternal && (
                          <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all ${categoria === 'anime' ? 'hover:border-secondary/30 hover:bg-secondary/5 hover:shadow-[0_0_20px_rgba(194,24,91,0.1)]' : 'hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(106,27,154,0.1)]'}`}>
                            <div className="w-10 h-10 rounded-2xl bg-surface-variant/30 text-on-surface-variant flex items-center justify-center mb-3">
                              <span className="material-symbols-outlined text-xl">history</span>
                            </div>
                            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Last Content Update</p>
                            <p className="font-bold text-lg text-white font-mono">
                              {formatLastModified(selectedItem)}
                            </p>
                          </div>
                        )}
                        <div className={`glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center border transition-all ${categoria === 'anime' ? 'hover:border-secondary/30 hover:bg-secondary/5 hover:shadow-[0_0_20px_rgba(194,24,91,0.1)]' : 'hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(106,27,154,0.1)]'}`}>
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${categoria === 'anime' ? 'bg-primary/10 text-primary shadow-[0_0_15px_rgba(221,184,255,0.2)]' : 'bg-secondary/10 text-secondary shadow-[0_0_15px_rgba(255,176,203,0.2)]'}`}>
                            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          </div>
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-1">Nota Geral</p>
                          <p className={`font-bold text-lg ${categoria === 'anime' ? 'text-primary' : 'text-secondary'}`}>
                            {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'} / 10
                          </p>
                        </div>
                      </div>
                      {renderRatingCommentsSection()}
                    </div>
                    <div className="space-y-6">
                      <div className={`glass-panel p-8 rounded-[32px] border ${categoria === 'anime' ? 'border-secondary/20 shadow-[0_0_50px_rgba(194,24,91,0.08)]' : 'border-primary/20 shadow-[0_0_50px_rgba(106,27,154,0.08)]'}`}>
                        <h4 className="text-lg font-bold mb-6 flex items-center gap-2">Quick Actions</h4>
                        {selectedItem.isExternal ? (
                          <button 
                            onClick={() => { adicionarAoBanco(selectedItem.titulo, selectedItem.id); }} 
                            disabled={isAddingToLibrary}
                            className="w-full bg-primary hover:bg-primary/80 text-on-primary py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAddingToLibrary ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                ADDING TO LIBRARY...
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined">add</span> ADD TO LIBRARY
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="space-y-6">
                            <div className="space-y-3">
                              <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Tracking Status</label>
                              <div className="grid grid-cols-1 gap-2.5">
                                {TRACKING_STATUS_OPTIONS.map((opt) => {
                                  const isSelected = selectedItem.status === opt.value;
                                  return (
                                    <button key={opt.value} onClick={() => atualizarCampo('status', opt.value)} className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all text-sm font-bold backdrop-blur-md relative overflow-hidden group active:scale-95 ${isSelected ? (categoria === 'anime' ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_20px_rgba(194,24,91,0.35)] scale-[1.02]' : 'bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(106,27,154,0.35)] scale-[1.02]') : `bg-surface-variant/30 border-white/5 text-on-surface-variant ${categoria === 'anime' ? 'hover:border-secondary/30 hover:bg-secondary/10 hover:text-white hover:shadow-[0_0_15px_rgba(194,24,91,0.15)]' : 'hover:border-primary/30 hover:bg-primary/10 hover:text-white hover:shadow-[0_0_15px_rgba(106,27,154,0.15)]'}`}`}>
                                      {isSelected && (
                                        <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${categoria === 'anime' ? 'bg-secondary shadow-[0_0_10px_rgba(194,24,91,0.8)]' : 'bg-primary shadow-[0_0_10px_rgba(106,27,154,0.8)]'}`}></span>
                                      )}
                                      <span className={`material-symbols-outlined text-[22px] transition-transform group-hover:scale-110 ${isSelected ? (categoria === 'anime' ? 'text-secondary' : 'text-primary') : 'text-on-surface-variant group-hover:text-white'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
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
                        <div className={`p-8 rounded-[32px] transition-all flex flex-col items-center justify-center text-center border ${showEpList ? (categoria === 'anime' ? 'bg-secondary/10 border-secondary/40 shadow-[0_0_40px_rgba(194,24,91,0.15)] backdrop-blur-xl' : 'bg-primary/10 border-primary/40 shadow-[0_0_40px_rgba(106,27,154,0.15)] backdrop-blur-xl') : `glass-panel ${categoria === 'anime' ? 'hover:border-secondary/30 hover:bg-secondary/5 hover:shadow-[0_0_20px_rgba(194,24,91,0.1)]' : 'hover:border-primary/30 hover:bg-primary/5 hover:shadow-[0_0_20px_rgba(106,27,154,0.1)]'}`}`}>
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
                                <input type="number" min="0" max={categoria === 'anime' ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || 9999)) : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 9999))} value={categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual} onChange={(e) => { const val = parseInt(e.target.value) || 0; atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', val); }} className={`bg-transparent ${categoria === 'anime' ? 'text-primary focus:bg-secondary/10' : 'text-secondary focus:bg-primary/10'} font-black text-4xl w-20 text-center outline-none border-b-2 border-white/10 focus:border-white/40 rounded transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-0.5`} />
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
                            <button onClick={() => atualizarProgresso(1)} disabled={isSavingDetailsProgress} title="Add 1" className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center shadow-md active:scale-95 font-bold ${categoria === 'anime' ? 'bg-primary hover:bg-primary/80 text-on-primary shadow-[0_0_15px_rgba(194,24,91,0.3)]' : 'bg-secondary hover:bg-secondary/80 text-on-secondary shadow-[0_0_15px_rgba(106,27,154,0.3)]'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                              <span className="material-symbols-outlined text-lg">add</span>
                            </button>
                            <button onClick={() => setShowEpList(!showEpList)} className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border active:scale-95 ${showEpList ? (categoria === 'anime' ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(194,24,91,0.2)]' : 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_15px_rgba(106,27,154,0.2)]') : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:border-white/20 hover:text-white'}`}>
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

      {loadingDetails && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
          <div className={`p-8 rounded-3xl glass-panel border flex flex-col items-center max-w-sm w-full mx-4 text-center space-y-6 shadow-2xl animate-slide-up ${categoria === 'anime' ? 'border-primary/30' : 'border-secondary/30'}`}>
            {/* Thematic loading icon */}
            <div className="relative flex items-center justify-center w-24 h-24">
              {/* Pulsing glow ring */}
              <div className={`absolute inset-0 rounded-full blur-xl animate-pulse ${categoria === 'anime' ? 'bg-primary/20 shadow-[0_0_30px_rgba(106,27,154,0.4)]' : 'bg-secondary/20 shadow-[0_0_30px_rgba(194,24,91,0.4)]'}`}></div>
              
              {/* Outer spinning ring */}
              <div className={`absolute inset-0 rounded-full border-4 border-t-transparent border-r-transparent animate-spin ${categoria === 'anime' ? 'border-primary' : 'border-secondary'}`} style={{ animationDuration: '1s' }}></div>
              
              {/* Inner spinning ring (opposite direction) */}
              <div className={`absolute w-16 h-16 rounded-full border-4 border-b-transparent border-l-transparent animate-spin ${categoria === 'anime' ? 'border-secondary-light' : 'border-primary-light'}`} style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
              
              {/* Center icon */}
              <span className={`material-symbols-outlined text-3xl font-bold animate-bounce ${categoria === 'anime' ? 'text-primary-light' : 'text-secondary-light'}`}>
                {categoria === 'anime' ? 'play_circle' : 'menu_book'}
              </span>
            </div>
            
            {/* Loading text */}
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-white tracking-tight">
                {categoria === 'anime' ? 'Carregando Anime...' : 'Carregando Mangá...'}
              </h4>
              <p className="text-on-surface-variant text-sm font-medium animate-pulse">
                Procurando informações detalhadas...
              </p>
            </div>

            {/* Custom Indeterminate Progress Bar */}
            <div className="w-full h-1.5 bg-surface-variant/40 rounded-full overflow-hidden relative">
              <div className={`animate-loading-bar rounded-full ${categoria === 'anime' ? 'bg-primary shadow-[0_0_8px_rgba(106,27,154,0.6)]' : 'bg-secondary shadow-[0_0_8px_rgba(194,24,91,0.6)]'}`}></div>
            </div>
          </div>
        </div>
      )}

      {showExternalProfile && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl bg-surface-container rounded-[32px] border border-white/10 shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            
            {/* Close Button */}
            <button 
              onClick={() => { setShowExternalProfile(false); setExternalProfile(null); }} 
              className="absolute top-4 right-4 z-[120] p-2 rounded-full bg-black/40 hover:bg-black/60 text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingExternalProfile ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className={`w-10 h-10 animate-spin ${categoria === 'anime' ? 'text-primary' : 'text-secondary'}`} />
                <p className="text-on-surface-variant text-sm font-bold animate-pulse">Carregando perfil...</p>
              </div>
            ) : externalProfile ? (
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                
                {/* Banner & Avatar Header */}
                <div className="relative w-full min-h-[180px] flex flex-col justify-end">
                  {externalProfile.bannerUrl ? (
                    <img 
                      src={externalProfile.bannerUrl} 
                      alt="Banner" 
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                      style={{ objectPosition: `center ${externalProfile.preferences?.bannerPosition ?? '50'}%` }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-surface-container-highest z-0" />
                  )}
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-black/40 to-transparent z-10"></div>
                  
                  {/* User Avatar, Name, Account Type */}
                  <div className="p-6 flex flex-col sm:flex-row items-center gap-4 relative z-20 text-center sm:text-left w-full">
                    <div className="w-20 h-20 rounded-full bg-primary p-0.5 shadow-[0_0_20px_rgba(106,27,154,0.4)] flex-shrink-0 relative overflow-hidden">
                      <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-3xl font-black text-white overflow-hidden">
                        {externalProfile.iconUrl ? (
                          <img src={externalProfile.iconUrl} className="w-full h-full object-cover rounded-full" alt="Avatar" />
                        ) : (
                          (externalProfile.nome || 'O').charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h2 className="text-xl sm:text-2xl font-black text-white truncate drop-shadow">{externalProfile.nome || 'Utilizador'}</h2>
                        {externalProfile.tipoConta === 'ADMIN' ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                            <Shield className="w-3 h-3" /> ADMIN
                          </span>
                        ) : externalProfile.tipoConta === 'pro' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                            <Award className="w-3 h-3" /> PRO TIER
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-gray-500/20 border border-gray-500/40 text-gray-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                            <User className="w-3 h-3" /> MEMBRO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 font-medium drop-shadow">Pro Member</p>
                    </div>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="p-6 space-y-6">
                  
                  {/* Statistics */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-secondary" />
                      <span>Estatísticas de Consumo</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {/* Completed Anime */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <PlayCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                        <span className="text-lg font-black text-white mt-1">
                          {externalProfile.statistics?.totalAnimeCompleted || 0}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Animes</span>
                      </div>
                      {/* Episodes Watched */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <Film className="w-4 h-4 text-primary mx-auto" />
                        <span className="text-lg font-black text-white mt-1">
                          {externalProfile.statistics?.totalEpisodesWatched || 0}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Episódios</span>
                      </div>
                      {/* Manga Read */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <BookOpen className="w-4 h-4 text-secondary mx-auto" />
                        <span className="text-lg font-black text-white mt-1">
                          {externalProfile.statistics?.totalMangaRead || 0}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Capítulos</span>
                      </div>
                      {/* Anime Time */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <Clock className="w-4 h-4 text-amber-400 mx-auto" />
                        <span className="text-lg font-black text-white mt-1 truncate">
                          {externalProfile.statistics?.animeDaysWasted ? `${externalProfile.statistics.animeDaysWasted}d` : '0d'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Tempo Anime</span>
                      </div>
                      {/* Manga Time */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <Clock className="w-4 h-4 text-pink-400 mx-auto" />
                        <span className="text-lg font-black text-white mt-1 truncate">
                          {externalProfile.statistics?.mangaDaysWasted ? `${externalProfile.statistics.mangaDaysWasted}d` : '0d'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Tempo Mangá</span>
                      </div>
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Conquistas Otaku ({externalProfile.achievements?.length || 0})</span>
                    </h3>
                    
                    {externalProfile.achievements && externalProfile.achievements.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {externalProfile.achievements.map((ua: any) => {
                          const ach = ua.achievement;
                          if (!ach) return null;
                          let borderClass = 'border-white/5 bg-black/40';
                          if (ach.rarity === 'RARE') borderClass = 'border-cyan-500/20 bg-cyan-500/5';
                          else if (ach.rarity === 'EPIC') borderClass = 'border-purple-500/20 bg-purple-500/5';
                          else if (ach.rarity === 'LEGENDARY') borderClass = 'border-amber-500/20 bg-amber-500/5';
                          else borderClass = 'border-primary/20 bg-primary/5';

                          return (
                            <div key={ua.id} className={`glass-panel p-3.5 rounded-2xl border flex items-start gap-3 transition-all ${borderClass}`}>
                              <div className="w-12 h-12 rounded-full bg-white/5 p-1 relative flex items-center justify-center flex-shrink-0">
                                {ach.badgeImageUrl ? (
                                  <img src={ach.badgeImageUrl} className="w-full h-full object-contain" alt={ach.name} />
                                ) : (
                                  <Award className="w-6 h-6 text-primary" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h5 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 flex-wrap">
                                  <span>{ach.name}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider ${
                                    ach.rarity === 'RARE' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                                    ach.rarity === 'EPIC' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                    ach.rarity === 'LEGENDARY' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' :
                                    'bg-primary/20 text-primary-light border border-primary/30'
                                  }`}>
                                    {ach.rarity}
                                  </span>
                                </h5>
                                <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-tight">{ach.description}</p>
                                <span className="inline-block text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 mt-1.5">
                                  Ganho {new Date(ua.unlockedAt).toLocaleDateString('pt-PT')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center py-6 bg-white/5 rounded-2xl border border-white/5 text-xs text-gray-400 italic">
                        Este utilizador ainda não desbloqueou nenhuma conquista.
                      </p>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center text-on-surface-variant text-sm italic">
                Erro ao obter dados do utilizador.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
