import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { useToast } from '../context/ToastContext';
import { Loader2, Smartphone, Award, BookOpen, Clock, Film, PlayCircle, Shield, User, X } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTranslation } from '../hooks/useTranslation';
import { PALETTES, getCurrentPalette } from '../services/paletteService';

const getGenresList = (generos: any): { name: string; weight: number }[] => {
  if (!generos) return [];
  
  // 1. If it's a string (e.g. comma-separated genres)
  if (typeof generos === 'string') {
    return generos.split(',').map((g: string) => g.trim()).filter(Boolean).map((name: string) => ({ name, weight: 100 }));
  }
  
  // 2. If it's an array (e.g. list of tags/genres)
  if (Array.isArray(generos)) {
    const list = generos.map((item: any) => {
      if (typeof item === 'object' && item !== null) {
        const parsedWeight = Number(item.weight ?? item.rank ?? 100);
        return {
          name: item.name || '',
          weight: isNaN(parsedWeight) ? 100 : parsedWeight
        };
      }
      return { name: String(item), weight: 100 };
    }).filter(g => g.name).sort((a, b) => b.weight - a.weight);

    const filtered = list.filter(g => g.weight >= 80);
    if (filtered.length === 0) {
      return list.slice(0, 5);
    }
    return filtered.slice(0, 12);
  }
  
  // 3. If it's a key-value object (e.g. { Genre: weight })
  if (typeof generos === 'object') {
    const list = Object.entries(generos).map(([name, weight]) => {
      const parsedWeight = Number(weight);
      return {
        name,
        weight: isNaN(parsedWeight) ? 100 : parsedWeight
      };
    }).sort((a, b) => b.weight - a.weight);

    const filtered = list.filter(g => g.weight >= 80);
    if (filtered.length === 0) {
      return list.slice(0, 5);
    }
    return filtered.slice(0, 12);
  }
  
  return [];
};

const MangaWebView = registerPlugin<any>('MangaWebView');

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

const formatCommentDate = (value: string) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
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

const DetailsPage = () => {
  const { mediaType, id } = useParams<{ mediaType: 'anime' | 'manga'; id: string }>();
  const [searchParams] = useSearchParams();
  const isExternalParam = searchParams.get('external') === 'true';
  const formatParam = searchParams.get('format') || undefined;
  const navigate = useNavigate();

  const { user, token } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { setCategoria, setIsViewingDetails } = useMedia();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [showSourcesSelector, setShowSourcesSelector] = useState(false);
  const [sourcesToSelect, setSourcesToSelect] = useState<any[]>([]);

  const [latestChapter, setLatestChapter] = useState<number | null>(null);
  const [latestChapterSource, setLatestChapterSource] = useState<string>('MangaDex');
  const [latestChapterError, setLatestChapterError] = useState<string | null>(null);
  const [latestBreakdown, setLatestBreakdown] = useState<any[]>([]);
  const [loadingLatest, setLoadingLatest] = useState(false);

  const [showEpList, setShowEpList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkSite, setNewLinkSite] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);

  const [isSavingDetailsProgress, setIsSavingDetailsProgress] = useState(false);
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [overallRating, setOverallRating] = useState<OverallRating | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);


  const [externalProfile, setExternalProfile] = useState<any>(null);
  const [loadingExternalProfile, setLoadingExternalProfile] = useState(false);
  const [showExternalProfile, setShowExternalProfile] = useState(false);

  // States and functions for custom lists
  const [showListsModal, setShowListsModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // States for list removal confirmation when deleting from library
  const [showListRemovalConfirm, setShowListRemovalConfirm] = useState(false);
  const [listsWithMedia, setListsWithMedia] = useState<any[]>([]);
  const [isCheckingLists, setIsCheckingLists] = useState(false);
  const [isDeletingFromLists, setIsDeletingFromLists] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracking' | 'info'>('tracking');
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const lastAiredEpNumber = useMemo(() => {
    if (selectedItem?.statusLancamento === 'FINISHED') {
      return Infinity;
    }
    if (!seasonEpisodes || seasonEpisodes.length === 0) return 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    const lastAired = [...seasonEpisodes]
      .sort((a, b) => b.episode_number - a.episode_number)
      .find((ep: any) => ep.air_date && ep.air_date.slice(0, 10) <= todayStr);
    
    if (!lastAired && selectedItem?.statusLancamento !== 'RELEASING') {
      return Infinity;
    }
    return lastAired ? lastAired.episode_number : 0;
  }, [seasonEpisodes, selectedItem?.statusLancamento]);

  const totalAiredEpisodes = useMemo(() => {
    if (mediaType !== 'anime' || !selectedItem) return Infinity;
    if (selectedItem.statusLancamento === 'FINISHED') {
      return selectedItem.numEpisodiosTotal || Infinity;
    }
    if (selectedItem.episodes && Array.isArray(selectedItem.episodes) && selectedItem.episodes.length > 0) {
      const now = new Date();
      return selectedItem.episodes.filter(
        (ep: any) => ep.season > 0 && (ep.airDate || ep.air_date) && new Date(ep.airDate || ep.air_date) <= now
      ).length;
    }
    if (selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) {
      return selectedItem.proximoEpisodio - 1;
    }
    return selectedItem.numEpisodiosTotal || Infinity;
  }, [selectedItem, mediaType]);

  const [viewedSeason, setViewedSeason] = useState<number>(1);

  // Sync viewedSeason with selectedItem.seasonAtual when it changes (initial load or automatic update)
  useEffect(() => {
    if (selectedItem?.seasonAtual) {
      setViewedSeason(selectedItem.seasonAtual);
    }
  }, [selectedItem?.seasonAtual]);

  useEffect(() => {
    if (!selectedItem || mediaType !== 'anime') return;
    
    // If the episodes are already present in selectedItem.episodes, filter them locally!
    if (selectedItem.episodes && selectedItem.episodes.length > 0) {
      const filtered = selectedItem.episodes.filter((ep: any) => ep.season === viewedSeason);
      
      // Map database schema fields (name, stillPath, episodeNumber) to what the UI expects (name, still_path, episode_number)
      const mapped = filtered.map((ep: any) => ({
        ...ep,
        episode_number: ep.episodeNumber,
        still_path: ep.stillPath ? ep.stillPath.replace('https://image.tmdb.org/t/p/w300', '') : null,
        air_date: ep.airDate
      }));
      setSeasonEpisodes(mapped);
      setLoadingEpisodes(false);
      return;
    }

    // Otherwise, fall back to fetching them from TMDB
    const fetchSeasonEpisodes = async () => {
      const tmdbId = selectedItem.isExternal ? selectedItem.id : (selectedItem.animeId || selectedItem.id);
      if (!tmdbId) return;
      const seasonNumber = viewedSeason;
      setLoadingEpisodes(true);
      try {
        const res = await customFetch(`${API_BASE_URL}/anime/tmdb/${tmdbId}/season/${seasonNumber}`, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data && data.episodes) {
            setSeasonEpisodes(data.episodes);
          } else {
            setSeasonEpisodes([]);
          }
        } else {
          setSeasonEpisodes([]);
        }
      } catch (err) {
        console.error("Error fetching season episodes:", err);
        setSeasonEpisodes([]);
      } finally {
        setLoadingEpisodes(false);
      }
    };

    fetchSeasonEpisodes();
  }, [selectedItem?.id, selectedItem?.animeId, viewedSeason, selectedItem?.episodes, mediaType]);

  const handleOpenListsModal = async () => {
    setShowListsModal(true);
    setLoadingLists(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/lists`, { headers: getHeaders() });
      if (res.ok) {
        setLists(await res.json());
      } else {
        showToast('Erro ao carregar listas.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar listas.', 'error');
    } finally {
      setLoadingLists(false);
    }
  };

  const toggleItemInList = async (listId: number, isCurrentlyInList: boolean) => {
    const currentAnilistId = getMediaId();
    const currentMediaType = mediaType?.toUpperCase() as 'ANIME' | 'MANGA';
    if (!currentAnilistId || !currentMediaType) return;

    try {
      if (isCurrentlyInList) {
        const res = await customFetch(`${API_BASE_URL}/lists/${listId}/items/${currentMediaType}/${currentAnilistId}`, {
          method: 'DELETE',
          headers: getHeaders(),
        });
        if (res.ok) {
          const updatedList = await res.json();
          setLists(prev => prev.map(l => l.id === listId ? {
            ...l,
            items: updatedList.items.map((i: any) => ({ anilistMediaId: i.anilistMediaId, mediaType: i.mediaType })),
            _count: { items: updatedList.items.length }
          } : l));
          showToast('Item removido da lista!', 'success');
        } else {
          throw new Error('Failed to remove');
        }
      } else {
        const res = await customFetch(`${API_BASE_URL}/lists/${listId}/items`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            anilistMediaId: currentAnilistId,
            mediaType: currentMediaType,
          }),
        });
        if (res.ok) {
          const updatedList = await res.json();
          setLists(prev => prev.map(l => l.id === listId ? {
            ...l,
            items: updatedList.items.map((i: any) => ({ anilistMediaId: i.anilistMediaId, mediaType: i.mediaType })),
            _count: { items: updatedList.items.length }
          } : l));
          showToast('Item adicionado à lista!', 'success');
        } else {
          throw new Error('Failed to add');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar a lista.', 'error');
    }
  };

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const getMediaId = (item = selectedItem) => item?.mangaId || item?.animeId || item?.id;

  // Load details and configurations
  useEffect(() => {
    if (!mediaType || !id) return;
    setCategoria(mediaType);
    setIsViewingDetails(true);

    const loadData = async () => {
      setLoading(true);
      setLoadingDetails(true);

      let targetId = parseInt(id);
      let isExternal = isExternalParam;

      // Check if it already exists in database (user library)
      try {
        const libraryRes = await customFetch(`${API_BASE_URL}/${mediaType}`, { headers: getHeaders() });
        if (libraryRes.ok) {
          const libraryItems = await libraryRes.json();
          if (Array.isArray(libraryItems)) {
            const matched = libraryItems.find(item => 
              item.id === targetId || (mediaType === 'manga' ? item.mangaId : item.animeId) === targetId
            );
            if (matched) {
              targetId = matched.id;
              isExternal = false;
            } else {
              // If not found in the library, treat as external since GET /anime/:id or /manga/:id
              // only works for user tracked items.
              isExternal = true;
            }
          }
        }
      } catch (e) {
        console.error("Error verifying item in library:", e);
      }

      const formatQuery = formatParam ? `?format=${formatParam}` : '';
      const url = isExternal 
        ? `${API_BASE_URL}/${mediaType}/anilist/${targetId}${formatQuery}`
        : `${API_BASE_URL}/${mediaType}/${targetId}`;

      try {
        const response = await customFetch(url, { headers: getHeaders() });
        if (!response.ok) {
          showToast('Could not load details. Please try again later.', 'error');
          navigate(-1);
          return;
        }
        const data = await response.json();
        if (isExternal && data) {
          const normalized = {
            id: data.id,
            titulo: data.title?.english || data.title?.romaji || 'Unknown Title',
            capaUrl: data.coverImage?.large,
            descricao: data.description ? data.description.replace(/<[^>]*>?/gm, '') : "No description available.",
            generos: {
              ...((data.genres || []).reduce((acc: any, g: string) => ({ ...acc, [g]: 100 }), {})),
              ...((data.tags || []).reduce((acc: any, t: any) => ({ ...acc, [t.name]: t.rank ?? 100 }), {}))
            },
            statusLancamento: data.status,
            numEpisodiosTotal: data.episodes,
            numCapitulosTotal: data.chapters,
            temporada: data.season,
            ano: data.seasonYear,
            linksExternos: data.externalLinks ? JSON.stringify(data.externalLinks) : null,
            isExternal: true,
            formato: data.format
          };
          setSelectedItem(normalized);
        } else if (data) {
          const itemData = data.manga || data.anime || data;
          const localItem = { ...itemData, ...data, dbId: data.id, isExternal: false };
          setSelectedItem(localItem);

          // Fetch AniList metadata in the background to populate relations
          const externalId = data.animeId || data.mangaId || itemData.animeId || itemData.mangaId;
          const formatVal = itemData.formato;
          if (externalId) {
            const formatQueryVal = formatVal ? `?format=${formatVal}` : '';
            customFetch(`${API_BASE_URL}/${mediaType}/anilist/${externalId}${formatQueryVal}`, { headers: getHeaders() })
              .then(res => {
                if (res.ok) return res.json();
                throw new Error("Failed to fetch external metadata");
              })
              .then(extData => {
                if (extData) {
                  setSelectedItem((prev: any) => {
                    if (prev && (prev.animeId === externalId || prev.mangaId === externalId || prev.id === externalId)) {
                      return { ...prev, relations: extData.relations, relationsManga: extData.relationsManga };
                    }
                    return prev;
                  });
                }
              })
              .catch(err => console.error("Error loading external relations metadata:", err));
          }
        }

        const realId = isExternal ? targetId : (data.mangaId || data.animeId || data.id);
        if (mediaType === 'manga') {
          carregarCapituloMaisRecente(realId);
        }
        carregarDadosInterativos(data.mangaId || data.animeId || data.id);
      } catch (error) {
        console.error("Error loading details:", error);
        showToast('Error loading details.', 'error');
        navigate(-1);
      } finally {
        setLoading(false);
        setLoadingDetails(false);
      }
    };

    loadData();

    return () => {
      setIsViewingDetails(false);
    };
  }, [mediaType, id, isExternalParam, reloadTrigger]);

  useEffect(() => {
    const handleReload = () => {
      setReloadTrigger(prev => prev + 1);
    };
    window.addEventListener('reload-details-links', handleReload);
    return () => {
      window.removeEventListener('reload-details-links', handleReload);
    };
  }, []);

  const handleGoToTabClick = (links: any[]) => {
    if (links.length === 1) {
      abrirLink(links[0].url, links[0].site);
    } else {
      setSourcesToSelect(links);
      setShowSourcesSelector(true);
    }
  };

  const carregarCapituloMaisRecente = async (anilistId: number) => {
    if (mediaType !== 'manga') return;
    setLoadingLatest(true);
    setLatestChapter(null);
    setLatestChapterSource('MangaDex');
    setLatestChapterError(null);
    setLatestBreakdown([]);
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

  const adicionarAoBanco = async (titulo: string, anilistId?: number, format?: string) => {
    if (!mediaType) return;
    setIsAddingToLibrary(true);
    const url = `${API_BASE_URL}/${mediaType}/import`;
    try {
      const response = await customFetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nome: titulo, userId: user?.id, anilistId, format })
      });
      
      if (response.ok) {
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.removeItem(`random_clicks_anime_${todayStr}`);
        localStorage.removeItem(`random_clicks_manga_${todayStr}`);

        const novoItem = await response.json();
        const itemData = novoItem.manga || novoItem.anime || novoItem;
        const localItem = { ...itemData, ...novoItem, dbId: novoItem.id, isExternal: false };
        setSelectedItem(localItem);

        // Fetch relations in background immediately after adding to library
        const externalId = localItem.animeId || localItem.mangaId || localItem.id;
        const formatVal = localItem.formato;
        if (externalId) {
          const formatQuery = formatVal ? `?format=${formatVal}` : '';
          customFetch(`${API_BASE_URL}/${mediaType}/anilist/${externalId}${formatQuery}`, { headers: getHeaders() })
            .then(res => {
              if (res.ok) return res.json();
              throw new Error("Failed to fetch external metadata after import");
            })
            .then(extData => {
              if (extData) {
                setSelectedItem((prev: any) => {
                  if (prev && (prev.animeId === externalId || prev.mangaId === externalId || prev.id === externalId)) {
                    return { ...prev, relations: extData.relations, relationsManga: extData.relationsManga };
                  }
                  return prev;
                });
              }
            })
            .catch(err => console.error("Error loading relations after import:", err));
        }

        if (mediaType === 'manga' && anilistId) {
          carregarCapituloMaisRecente(anilistId);
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

  const removerDaLista = async (id: number) => {
    if (!mediaType) return;
    const targetId = selectedItem?.dbId || id;
    const url = `${API_BASE_URL}/${mediaType}/${targetId}`;
    try {
      const response = await customFetch(url, { method: 'DELETE', headers: getHeaders() });
      if (response.ok) {
        showToast('Removido da biblioteca com sucesso.', 'success');
        setShowDeleteConfirm(false);
        navigate('/library');
      } else {
        showToast('Não foi possível remover da biblioteca.', 'error');
      }
    } catch (error) {
      console.error("Erro ao remover:", error);
      showToast('Erro ao remover da biblioteca.', 'error');
    }
  };

  const handleRemoveFromLibraryClick = async () => {
    if (!mediaType || !selectedItem) return;
    setIsCheckingLists(true);
    try {
      const currentAnilistId = getMediaId();
      const currentMediaType = mediaType.toUpperCase();
      
      const res = await customFetch(`${API_BASE_URL}/lists`, { headers: getHeaders() });
      if (res.ok) {
        const userLists = await res.json();
        const containingLists = userLists.filter((list: any) =>
          list.items?.some((i: any) => i.anilistMediaId === currentAnilistId && i.mediaType === currentMediaType)
        );
        
        if (containingLists.length > 0) {
          setListsWithMedia(containingLists);
          setShowListRemovalConfirm(true);
          setIsCheckingLists(false);
          return;
        }
      }
    } catch (err) {
      console.error("Error checking lists before deletion:", err);
    } finally {
      setIsCheckingLists(false);
    }
    
    // If not in any list, just remove from library directly
    await removerDaLista(selectedItem.dbId || selectedItem.id);
  };

  const handleRemoveFromEverything = async () => {
    if (!mediaType || !selectedItem) return;
    setIsDeletingFromLists(true);
    const currentAnilistId = getMediaId();
    const currentMediaType = mediaType.toUpperCase();
    
    try {
      // Remove from all containing lists
      await Promise.all(listsWithMedia.map(list =>
        customFetch(`${API_BASE_URL}/lists/${list.id}/items/${currentMediaType}/${currentAnilistId}`, {
          method: 'DELETE',
          headers: getHeaders(),
        })
      ));
    } catch (err) {
      console.error("Erro ao remover das listas:", err);
      showToast("Ocorreu um erro ao remover de algumas listas.", "warning");
    } finally {
      setIsDeletingFromLists(false);
      setShowListRemovalConfirm(false);
      // Finally, remove from library
      await removerDaLista(selectedItem.dbId || selectedItem.id);
    }
  };

  const handleRemoveFromLibraryOnly = async () => {
    setShowListRemovalConfirm(false);
    await removerDaLista(selectedItem.dbId || selectedItem.id);
  };

  const atualizarCampo = async (campoOrObj: string | Record<string, any>, valor?: any) => {
    if (!mediaType || !selectedItem || selectedItem.isExternal) return;
    const targetId = selectedItem.dbId || selectedItem.id;
    
    let updates: Record<string, any> = {};
    if (typeof campoOrObj === 'string') {
      updates = { [campoOrObj]: valor };
    } else {
      updates = { ...campoOrObj };
    }

    const isProgressUpdate = 'epAtual' in updates || 'capAtual' in updates;
    if (isProgressUpdate) {
      if (isSavingDetailsProgress) return;
      setIsSavingDetailsProgress(true);
    }

    let optimisticUpdates: any = { ...updates };

    // Calculate total episodes/chapters across all seasons (only counting aired episodes for anime)
    const totalAll = mediaType === 'anime'
      ? (
          selectedItem.episodes && selectedItem.episodes.length > 0
            ? selectedItem.episodes.filter((ep: any) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= new Date()).length
            : (selectedItem.relations?.edges
                ?.filter((edge: any) => edge.node.format === 'TV_SEASON' && edge.node.seasonNumber > 0)
                ?.reduce((sum: number, edge: any) => sum + (edge.node.episodes || 0), 0) || selectedItem.numEpisodiosTotal || 0)
        )
      : (selectedItem.numCapitulosTotal || 0);

    if ('status' in updates && updates.status === 'COMPLETED') {
      const prop = mediaType === 'anime' ? 'epAtual' : 'capAtual';
      optimisticUpdates[prop] = totalAll;
      if (mediaType === 'anime') {
        const { season, episode } = getSeasonAndEpisodeFromGlobal(totalAll);
        optimisticUpdates.seasonAtual = season;
        optimisticUpdates.epAtual = episode;
        optimisticUpdates.epAtualGlobal = totalAll;
      }
    }
    
    if ('epAtual' in updates || 'capAtual' in updates) {
      const field = 'epAtual' in updates ? 'epAtual' : 'capAtual';
      const val = updates[field];
      
      if (selectedItem.status === 'PLANNED' && val > 0) {
        optimisticUpdates.status = 'WATCHING';
      }
      if (selectedItem.status === 'COMPLETED' && totalAll && val < totalAll) {
        optimisticUpdates.status = 'WATCHING';
      }
      if (mediaType === 'anime') {
        if (totalAll && val >= totalAll) {
          optimisticUpdates.status = 'COMPLETED';
        }
      } else {
        const isReleasing = selectedItem.statusLancamento === 'RELEASING' || selectedItem.manga?.statusLancamento === 'RELEASING';
        if (!isReleasing && totalAll && val === totalAll) {
          optimisticUpdates.status = 'COMPLETED';
        }
      }

      if (field === 'epAtual') {
        const { season, episode } = getSeasonAndEpisodeFromGlobal(val);
        optimisticUpdates.seasonAtual = season;
        optimisticUpdates.epAtual = episode;
        optimisticUpdates.epAtualGlobal = val;
      }
    }

    setSelectedItem((prev: any) => ({ ...prev, ...optimisticUpdates }));
    const url = `${API_BASE_URL}/${mediaType}/${targetId}`;
    try {
      const { epAtualGlobal, ...payload } = optimisticUpdates;
      const response = await customFetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedItem((prev: any) => ({ ...prev, ...data, dbId: data.id }));
      }
    } catch (error) {
      console.error("Erro ao atualizar campo:", error);
    } finally {
      if (isProgressUpdate) {
        setIsSavingDetailsProgress(false);
      }
    }
  };

  const getSeasonsList = (): number[] => {
    if (!selectedItem) return [1];
    if (selectedItem.episodes && selectedItem.episodes.length > 0) {
      const seasons = Array.from(new Set(selectedItem.episodes.map((ep: any) => ep.season as number)))
        .filter((s: any) => typeof s === 'number' && s > 0)
        .sort((a: any, b: any) => a - b) as number[];
      if (seasons.length > 0) return seasons;
    }
    const edges = selectedItem.relations?.edges?.filter((edge: any) => edge.node.format === 'TV_SEASON' && edge.node.seasonNumber > 0) || [];
    if (edges.length > 0) {
      return edges.map((e: any) => e.node.seasonNumber).sort((a: number, b: number) => a - b);
    }
    return [1];
  };

  const getEpisodesCountForSeason = (seasonNum: number): number => {
    if (!selectedItem) return 0;
    if (selectedItem.episodes && selectedItem.episodes.length > 0) {
      const count = selectedItem.episodes.filter((ep: any) => ep.season === seasonNum).length;
      if (count > 0) return count;
    }
    if (selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) {
      const seasons = getSeasonsList();
      const maxSeason = seasons.length > 0 ? Math.max(...seasons) : 1;
      if (seasonNum === maxSeason) {
        return selectedItem.proximoEpisodio - 1;
      }
    }
    const seasonEdge = selectedItem.relations?.edges?.find(
      (ed: any) => ed.node.seasonNumber === seasonNum && ed.node.format === 'TV_SEASON'
    );
    if (seasonEdge && seasonEdge.node.episodes) return seasonEdge.node.episodes;
    return selectedItem.numEpisodiosTotal || 12;
  };

  const getAiredEpisodesCountForSeason = (seasonNum: number): number => {
    if (!selectedItem) return 0;
    if (selectedItem.episodes && selectedItem.episodes.length > 0) {
      const hasSeason = selectedItem.episodes.some((ep: any) => ep.season === seasonNum);
      if (hasSeason) {
        const now = new Date();
        return selectedItem.episodes.filter((ep: any) => ep.season === seasonNum && ep.airDate && new Date(ep.airDate) <= now).length;
      }
    }
    return getEpisodesCountForSeason(seasonNum);
  };

  const getGlobalEpisodeNumber = (seasonNumber: number, episodeNumber: number) => {
    if (!selectedItem) return episodeNumber;
    const seasons = getSeasonsList();
    let sum = 0;
    for (const s of seasons) {
      if (s < seasonNumber) {
        sum += getEpisodesCountForSeason(s);
      }
    }
    return sum + episodeNumber;
  };

  const getSeasonAndEpisodeFromGlobal = (globalEp: number): { season: number, episode: number } => {
    if (!selectedItem) return { season: 1, episode: globalEp };
    const seasons = getSeasonsList();
    if (seasons.length === 0) return { season: 1, episode: globalEp };
    if (globalEp <= 0) return { season: seasons[0] || 1, episode: 0 };
    
    let remaining = globalEp;
    let lastSeason = seasons[0];
    let lastCount = 0;
    
    for (const s of seasons) {
      lastSeason = s;
      lastCount = getEpisodesCountForSeason(s);
      if (remaining <= lastCount) {
        return { season: s, episode: remaining };
      }
      remaining -= lastCount;
    }
    return { season: lastSeason, episode: lastCount };
  };


  const atualizarProgresso = async (delta: number) => {
    if (!mediaType || !selectedItem || selectedItem.isExternal) return;
    if (mediaType === 'anime') {
      const currentGlobal = selectedItem.epAtualGlobal !== undefined ? selectedItem.epAtualGlobal : (selectedItem.epAtual || 0);
      const novoValor = currentGlobal + delta;
      if (novoValor < 0) return;
      if (delta > 0 && novoValor > totalAiredEpisodes) {
        showToast('Não é possível marcar episódios que ainda não estrearam.', 'error');
        return;
      }
      atualizarCampo('epAtual', novoValor);
    } else {
      const novoValor = (selectedItem.capAtual || 0) + delta;
      if (novoValor < 0) return;
      atualizarCampo('capAtual', novoValor);
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

  const abrirLink = async (url: string, title: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const paletteName = getCurrentPalette();
        const colors = PALETTES[paletteName] || PALETTES.default;

        // Carregar itens da biblioteca para passar ao Android nativo
        let itemsListJson = "[]";
        try {
          const [animesRes, mangasRes] = await Promise.all([
            customFetch(`${API_BASE_URL}/anime`, { headers: getHeaders() }),
            customFetch(`${API_BASE_URL}/manga`, { headers: getHeaders() })
          ]);
          const animes = animesRes.ok ? await animesRes.json() : [];
          const mangas = mangasRes.ok ? await mangasRes.json() : [];
          
          const items = [
            ...animes.map((a: any) => ({ id: a.id, titulo: a.anime?.titulo || a.titulo || '', tipo: 'anime' })),
            ...mangas.map((m: any) => ({ id: m.id, titulo: m.manga?.titulo || m.titulo || '', tipo: 'manga' }))
          ];
          itemsListJson = JSON.stringify(items);
        } catch (e) {
          console.error("Error loading library items for browser:", e);
        }

        await MangaWebView.open({
          url,
          title,
          primaryColor: colors.primary,
          secondaryColor: colors.secondary,
          userId: user?.id || 'guest',
          libraryItems: itemsListJson
        });
      } catch (e) {
        console.error("Failed to open MangaWebView", e);
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const renderRatingCommentsSection = () => {
    const ratingValue = overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A';

    return (
      <div className={`space-y-6 pt-8 border-t border-white/5 ${isMobile ? '' : 'mt-4'}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className={`${isMobile ? 'text-base' : 'font-headline-lg text-2xl'} font-bold flex items-center gap-3 text-white`}>
            <span className={`${isMobile ? 'w-1 h-4' : 'w-1.5 h-6'} rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
            Avaliações e comentários
          </h3>
          <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${mediaType === 'anime' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/10 border-secondary/30 text-secondary'}`}>
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
                          ? `${mediaType === 'anime' ? 'bg-primary border-primary text-on-primary shadow-[0_0_18px_rgba(221,184,255,0.35)]' : 'bg-secondary border-secondary text-on-secondary shadow-[0_0_18px_rgba(255,176,203,0.35)]'}`
                          : `bg-surface-variant/30 border-white/10 text-on-surface-variant hover:text-white ${mediaType === 'anime' ? 'hover:border-primary/40 hover:bg-primary/10' : 'hover:border-secondary/40 hover:bg-secondary/10'}`
                      }`}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ${mediaType === 'anime' ? 'border-primary/40 bg-primary/10' : 'border-secondary/40 bg-secondary/10'}`}>
                {user?.iconUrl ? (
                  <img src={user.iconUrl} alt={user.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center font-black ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`}>
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
                  className={`w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none resize-none transition-all ${mediaType === 'anime' ? 'focus:border-primary/60' : 'focus:border-secondary/60'}`}
                />
                <button
                  onClick={enviarComentario}
                  disabled={!newCommentText.trim() || isSubmittingComment}
                  className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:bg-surface-variant disabled:text-on-surface-variant disabled:shadow-none ${mediaType === 'anime' ? 'bg-primary hover:bg-primary/80 text-on-primary' : 'bg-secondary hover:bg-secondary/80 text-on-secondary'}`}
                >
                  {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="material-symbols-outlined text-base">send</span>}
                  Publicar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`p-4 rounded-2xl border bg-surface-variant/20 text-sm text-on-surface-variant ${mediaType === 'anime' ? 'border-primary/20' : 'border-secondary/20'}`}>
            Inicia sessão para avaliar e comentar este conteúdo.
          </div>
        )}

        <div className="space-y-3">
          {loadingComments ? (
            <div className="flex items-center gap-2 text-on-surface-variant text-sm">
              <Loader2 className={`w-4 h-4 animate-spin ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`} />
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

  const renderDesktopVersion = () => {
    if (!selectedItem) return null;

    const epAtualDisplay = mediaType === 'anime' ? (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) : (selectedItem.capAtual || 0);
    const totalEps = totalEpisodesAllSeasons;
    const progressPercentage = globalPercentage;

    return (
      /* VERSÃO WEB PERSONALIZADA (Design alinhado com o mockup do utilizador) */
      <div className="w-full text-left space-y-6">
        {/* Back cover background gradient */}
        <div className="relative w-full rounded-[32px] overflow-hidden border border-white/5 bg-[#121214]/65 p-6 md:p-8 flex flex-col md:flex-row gap-8 shadow-2xl backdrop-blur-md">
          
          {/* BACKGROUND BLUR */}
          <img src={selectedItem.capaUrl} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-15 pointer-events-none" alt="" />
          
          {/* COLUNA ESQUERDA: Poster + Info Card */}
          <div className="w-full md:w-[280px] flex-shrink-0 flex flex-col gap-5 relative z-10">
            {/* Poster Image */}
            <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10 group relative">
              <img src={selectedItem.capaUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={selectedItem.titulo} />
            </div>

            {/* Global Progress Bar (Visual effect under poster) */}
            <div className="bg-[#18181c]/90 border border-white/5 rounded-2xl p-4 flex flex-col gap-2 shadow-xl backdrop-blur-md">
              <div className="flex justify-between items-center text-[9px] text-on-surface-variant uppercase font-bold tracking-widest">
                <span>Progresso Global</span>
                <span className="text-white text-xs font-mono font-bold">
                  {mediaType === 'anime' ? (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) : selectedItem.capAtual} / {totalEpisodesAllSeasons || '?'}
                </span>
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-500"
                  style={{ width: `${globalPercentage}%` }}
                />
              </div>
            </div>

            {/* Info Card (Below poster) */}
            <div className="bg-[#18181c]/90 border border-white/5 rounded-2xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md">

              {/* Stars and Rating */}
              <div className="flex flex-col items-center justify-center text-center py-2.5 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black text-white">
                    {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'}
                  </span>
                  <span className="text-xs text-on-surface-variant font-bold">/ 10</span>
                  <span className="text-xs text-yellow-400 font-bold ml-2">⭐ #{selectedItem.prioridade || 5}</span>
                </div>
                {/* Rating Stars Representation */}
                <div className="flex gap-0.5 mt-1.5">
                  {(() => {
                    const rating = overallRating?.avaliacao_geral || 8.0;
                    const starsCount = Math.round(rating / 2);
                    return [...Array(5)].map((_, i) => (
                      <span 
                        key={i} 
                        className={`material-symbols-outlined text-[15px] ${i < starsCount ? 'text-yellow-400' : 'text-on-surface-variant/30'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                    ));
                  })()}
                </div>
              </div>

              {/* Priority Level Dropdown (Sidebar style) */}
              <div className="relative">
                <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest block mb-1">
                  Priority Level
                </label>
                {(() => {
                  const currentPriorityOpt = PRIORITY_OPTIONS.find(opt => opt.num === selectedItem.prioridade) || PRIORITY_OPTIONS[4];
                  return (
                    <>
                      <button
                        onClick={() => setPriorityDropdownOpen(!priorityDropdownOpen)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all font-bold text-xs cursor-pointer active:scale-95 ${currentPriorityOpt.starColor}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          <span>{currentPriorityOpt.label} - {currentPriorityOpt.desc}</span>
                        </div>
                        <span className={`material-symbols-outlined text-sm transition-transform duration-200 ${priorityDropdownOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
                      </button>
                      {priorityDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setPriorityDropdownOpen(false)} />
                          <div className="absolute left-0 right-0 mt-2 bg-[#1c1c22] border border-white/10 rounded-xl p-2 z-40 shadow-2xl max-h-[180px] overflow-y-auto custom-scrollbar space-y-1">
                            {PRIORITY_OPTIONS.map((p) => {
                              const isSelected = selectedItem.prioridade === p.num;
                              return (
                                <button
                                  key={p.num}
                                  onClick={() => {
                                    atualizarCampo('prioridade', p.num);
                                    setPriorityDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] font-bold text-left cursor-pointer transition-all ${
                                    isSelected 
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                      : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                    <span>{p.label} - {p.desc}</span>
                                  </div>
                                  {isSelected && <span className="material-symbols-outlined text-xs text-yellow-400">check</span>}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Genres tag list */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5 justify-center">
                {getGenresList(selectedItem.generos).map((g) => (
                  <span key={g.name} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-on-surface tracking-wider">
                    {g.name}
                  </span>
                ))}
              </div>

            </div>
          </div>

          {/* COLUNA DIREITA: Main Content */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 relative z-10">
            {/* Web Header Info */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                  mediaType === 'anime' 
                    ? (selectedItem.tipo === 'ANIME' 
                      ? 'bg-primary/20 text-primary border-primary/30 shadow-[0_0_10px_rgba(221,184,255,0.2)]' 
                      : selectedItem.tipo === 'SERIE'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]')
                    : 'bg-secondary/20 text-secondary border-secondary/30 shadow-[0_0_10px_rgba(255,176,203,0.2)]'
                }`}>
                  {mediaType === 'anime' ? (selectedItem.tipo === 'SERIE' ? 'SÉRIE' : (selectedItem.tipo || 'ANIME')) : 'MANGA'}
                </span>
                <span className="text-xs font-bold text-yellow-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  {selectedItem.isExternal ? 'New' : `#${selectedItem.prioridade}`}
                </span>
              </div>
              <h2 className={`text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2.5 ${mediaType === 'anime' ? 'text-primary-light' : 'text-secondary-light'}`}>
                {selectedItem.titulo}
              </h2>
              <div className="flex items-center gap-1.5 text-sm font-black text-on-surface-variant">
                <span className="material-symbols-outlined text-base text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span>{overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'} / 10</span>
              </div>
            </div>

            {/* Tabs Switcher at top of right panel */}
            <div className="flex border-b border-white/10 mb-2 w-fit">
              <button
                onClick={() => setActiveTab('tracking')}
                className={`px-6 py-3 text-sm font-black tracking-wider transition-all flex items-center gap-2 border-b-2 uppercase ${
                  activeTab === 'tracking'
                    ? (mediaType === 'anime' ? 'border-primary text-primary drop-shadow-[0_0_10px_rgba(221,184,255,0.3)]' : 'border-secondary text-secondary drop-shadow-[0_0_10px_rgba(255,176,203,0.3)]')
                    : 'border-transparent text-on-surface-variant hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">analytics</span>
                Acompanhamento
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`px-6 py-3 text-sm font-black tracking-wider transition-all flex items-center gap-2 border-b-2 uppercase ${
                  activeTab === 'info'
                    ? (mediaType === 'anime' ? 'border-primary text-primary drop-shadow-[0_0_10px_rgba(221,184,255,0.3)]' : 'border-secondary text-secondary drop-shadow-[0_0_10px_rgba(255,176,203,0.3)]')
                    : 'border-transparent text-on-surface-variant hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">info</span>
                Sinopse & Detalhes
              </button>
            </div>

            {activeTab === 'tracking' ? (
              <div className="w-full space-y-6 animate-in fade-in duration-300">
                
                {/* CARD PRINCIPAL: Quick Actions & Season */}
                <div className="bg-[#18181c]/80 border border-white/5 rounded-3xl p-6 relative z-20 shadow-xl backdrop-blur-md space-y-6">
                  {/* Watermark wrapper to allow absolute clipping without clipping dropdowns */}
                  <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
                    {/* Compass watermark icon in corner */}
                    <div className="absolute -right-8 -bottom-8 text-white/3 transform rotate-12 select-none">
                      <span className="material-symbols-outlined text-[140px] font-thin">explore</span>
                    </div>
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="text-base font-extrabold text-white mb-4">Quick Actions & Season</h3>
                    
                    {selectedItem.isExternal ? (
                      <button 
                        onClick={() => { adicionarAoBanco(selectedItem.titulo, selectedItem.id, selectedItem.formato); }} 
                        disabled={isAddingToLibrary}
                        className="w-full bg-primary hover:bg-primary/80 text-on-primary py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
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
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        {/* 1. Tracking Status Column */}
                        <div className="relative flex flex-col gap-1.5 text-left">
                          <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                            Tracking Status
                          </label>
                          {(() => {
                            const currentStatusOpt = TRACKING_STATUS_OPTIONS.find(opt => opt.value === selectedItem.status) || TRACKING_STATUS_OPTIONS[1];
                            let statusColorClass = 'text-white border-white/10 bg-white/5';
                            if (selectedItem.status === 'WATCHING') statusColorClass = mediaType === 'anime' ? 'text-primary border-primary/30 bg-primary/5 shadow-[0_0_15px_rgba(194,24,91,0.15)]' : 'text-secondary border-secondary/30 bg-secondary/5 shadow-[0_0_15px_rgba(106,27,154,0.15)]';
                            else if (selectedItem.status === 'PLANNED') statusColorClass = 'text-violet-400 border-violet-500/30 bg-violet-500/5';
                            else if (selectedItem.status === 'COMPLETED') statusColorClass = 'text-amber-400 border-amber-500/30 bg-amber-500/5';
                            else if (selectedItem.status === 'PAUSED') statusColorClass = 'text-orange-400 border-orange-500/30 bg-orange-500/5';
                            else if (selectedItem.status === 'DROPPED') statusColorClass = 'text-red-400 border-red-500/30 bg-red-500/5';

                            return (
                              <>
                                <button
                                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all font-bold text-xs cursor-pointer active:scale-95 ${statusColorClass}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                                      {selectedItem.status === 'WATCHING' ? 'play_circle' : 
                                       selectedItem.status === 'PLANNED' ? 'schedule' : 
                                       selectedItem.status === 'COMPLETED' ? 'check_circle' : 
                                       selectedItem.status === 'PAUSED' ? 'pause_circle' : 'cancel'}
                                    </span>
                                    <span className="truncate">{mediaType === 'anime' ? currentStatusOpt.animeLabel : currentStatusOpt.mangaLabel}</span>
                                  </div>
                                  <span className={`material-symbols-outlined transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
                                </button>
                                {statusDropdownOpen && (
                                  <>
                                    <div className="fixed inset-0 z-30" onClick={() => setStatusDropdownOpen(false)} />
                                    <div className="absolute left-0 right-0 mt-2 bg-[#1c1c22] border border-white/10 rounded-2xl p-2.5 z-40 shadow-2xl space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                      {TRACKING_STATUS_OPTIONS.map((opt) => {
                                        const isSelected = selectedItem.status === opt.value;
                                        let optColor = 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent';
                                        if (isSelected) optColor = mediaType === 'anime' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/20 text-secondary border-secondary/30';
                                        return (
                                          <button
                                            key={opt.value}
                                            onClick={() => {
                                              atualizarCampo('status', opt.value);
                                              setStatusDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-all ${optColor}`}
                                          >
                                            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                                              {opt.value === 'WATCHING' ? 'play_circle' : 
                                               opt.value === 'PLANNED' ? 'schedule' : 
                                               opt.value === 'COMPLETED' ? 'check_circle' : 
                                               opt.value === 'PAUSED' ? 'pause_circle' : 'cancel'}
                                            </span>
                                            <span>{mediaType === 'anime' ? opt.animeLabel : opt.mangaLabel}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* 2. Season Selector Column */}
                        <div className="flex flex-col gap-1.5 text-left">
                          <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                            {mediaType === 'anime' ? (viewedSeason === 0 ? 'Especiais' : `Temporada ${viewedSeason}`) : 'Progress'}
                          </label>
                          
                          {mediaType === 'anime' ? (
                            <div className="relative w-full">
                              <button
                                onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                                className="w-full flex items-center justify-between bg-[#18181c] text-white border border-white/10 hover:border-white/20 px-4 py-2.5 rounded-2xl outline-none focus:border-primary/50 text-xs font-bold cursor-pointer transition-all h-[46px] relative text-left"
                              >
                                {(() => {
                                  const currentSeasonNum = viewedSeason;
                                  const epsCount = getEpisodesCountForSeason(currentSeasonNum);
                                  return (
                                    <div className="flex items-center gap-1.5 justify-between w-full pr-1.5 min-w-0">
                                      <span className="truncate">{currentSeasonNum === 0 ? 'Especiais' : `Temporada ${currentSeasonNum}`}</span>
                                      <span className="text-[10px] opacity-60 font-medium shrink-0">({epsCount} eps)</span>
                                    </div>
                                  );
                                })()}
                                <span className={`material-symbols-outlined text-on-surface-variant text-base transition-transform duration-200 ${seasonDropdownOpen ? 'rotate-180' : ''}`}>
                                  keyboard_arrow_down
                                </span>
                              </button>
                              
                              {seasonDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-30" onClick={() => setSeasonDropdownOpen(false)} />
                                  <div className="absolute left-0 right-0 mt-2 bg-[#1c1c22] border border-white/10 rounded-2xl p-2.5 z-40 shadow-2xl max-h-[300px] overflow-y-auto custom-scrollbar space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {(() => {
                                      let uniqueSeasonNums: any[] = [];
                                      if (selectedItem.episodes && selectedItem.episodes.length > 0) {
                                        uniqueSeasonNums = Array.from(new Set(selectedItem.episodes.map((ep: any) => ep.season)))
                                          .sort((a: any, b: any) => a - b);
                                      } else {
                                        const seasons = selectedItem.relations?.edges
                                          ?.filter((edge: any) => edge.node.format === 'TV_SEASON')
                                          ?.sort((a: any, b: any) => a.node.seasonNumber - b.node.seasonNumber) || [];
                                        uniqueSeasonNums = seasons.map((edge: any) => edge.node.seasonNumber);
                                      }

                                      if (uniqueSeasonNums.length === 0) {
                                        uniqueSeasonNums = [viewedSeason];
                                      }

                                      return uniqueSeasonNums.map((seasonNum: number) => {
                                        const epsCount = getEpisodesCountForSeason(seasonNum);

                                        const isSelected = viewedSeason === seasonNum;
                                        let optColor = 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent';
                                        if (isSelected) optColor = mediaType === 'anime' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/20 text-secondary border-secondary/30';

                                        return (
                                          <button
                                            key={`s-drop-${seasonNum}`}
                                            onClick={() => {
                                              // Muda apenas localmente a temporada visualizada
                                              setViewedSeason(seasonNum);
                                              setSeasonDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-all ${optColor}`}
                                          >
                                            <span>{seasonNum === 0 ? 'Especiais' : `Temporada ${seasonNum}`}</span>
                                            <span className="text-[10px] opacity-60 font-medium">({epsCount} eps)</span>
                                          </button>
                                        );
                                      });
                                    })()}
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl px-3 py-2 w-full h-[46px] text-xs font-bold text-white">
                              Capítulos
                            </div>
                          )}
                        </div>

                        {/* 3. Progress Column */}
                        <div className="flex flex-col gap-2 text-right w-full">
                          <div className="flex items-center justify-between gap-4">
                            {/* Linear Progress Bar */}
                            <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 relative ${
                                  mediaType === 'anime' 
                                    ? 'bg-gradient-to-r from-primary to-primary-light shadow-[0_0_12px_rgba(194,24,91,0.5)]' 
                                    : 'bg-gradient-to-r from-secondary to-secondary-light shadow-[0_0_12px_rgba(106,27,154,0.5)]'
                                }`}
                                style={{ width: `${progressPercentage}%` }}
                              >
                                <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white animate-pulse" />
                              </div>
                            </div>

                            {/* Big digits with quick watch buttons */}
                            <div className="flex items-center gap-2">
                              {/* Minus Button */}
                              <button 
                                onClick={() => atualizarProgresso(-1)} 
                                disabled={isSavingDetailsProgress} 
                                title="Subtrair 1" 
                                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-on-surface-variant hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="material-symbols-outlined text-base">remove</span>
                              </button>

                              <div className="text-center min-w-[45px]">
                                <span className={`font-black text-xl ${mediaType === 'anime' ? 'text-primary-light' : 'text-secondary-light'}`}>
                                  {epAtualDisplay}
                                </span>
                                <span className="text-on-surface-variant font-medium text-sm mx-1">/</span>
                                <span className="text-on-surface-variant font-bold text-sm">
                                  {totalEps || '?'}
                                </span>
                              </div>

                              {/* Plus Button */}
                              <button 
                                onClick={() => atualizarProgresso(1)} 
                                disabled={
                                  isSavingDetailsProgress || 
                                  (mediaType === 'anime' && epAtualDisplay >= totalAiredEpisodes)
                                } 
                                title="Adicionar 1" 
                                className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95 font-bold ${mediaType === 'anime' ? 'bg-primary text-on-primary shadow-sm shadow-primary/20 hover:bg-primary/80' : 'bg-secondary text-on-secondary shadow-sm shadow-secondary/20 hover:bg-secondary/80'} disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                <span className="material-symbols-outlined text-base">add</span>
                              </button>
                            </div>
                          </div>

                          {/* Esconder/Mostrar Lista de Episódios Button */}
                          <div className="flex justify-end">
                            <button 
                              onClick={() => setShowEpList(!showEpList)}
                              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex items-center gap-2 text-xs font-bold text-white cursor-pointer active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">grid_view</span>
                              {showEpList ? 'Esconder Lista de Episódios' : 'Mostrar Lista de Episódios'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* CARD DE EPISÓDIOS: Episódios de Acompanhamento */}
                {showEpList && (
                  <div className="bg-[#18181c]/80 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-4 text-left">
                    <h3 className="text-base font-extrabold text-white">Episódios de Acompanhamento</h3>
                    
                    {mediaType === 'anime' ? (
                      loadingEpisodes ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                      ) : seasonEpisodes && seasonEpisodes.length > 0 ? (
                        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar text-left font-sans">
                          {seasonEpisodes.map((ep: any) => {
                            const isSpecial = ep.season === 0 || ep.season_number === 0 || viewedSeason === 0;
                            const isWatched = isSpecial
                              ? Array.isArray(selectedItem.watchedSpecials) && selectedItem.watchedSpecials.includes(ep.episode_number)
                              : (ep.globalEpisodeNumber || getGlobalEpisodeNumber(viewedSeason || 1, ep.episode_number)) <= (selectedItem.epAtualGlobal || selectedItem.epAtual || 0);
                            const hasAired = ep.episode_number <= lastAiredEpNumber;
                            const airDateStr = ep.air_date
                              ? new Date(ep.air_date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                              : 'Sem data';
                            const stillUrl = ep.still_path
                              ? `https://image.tmdb.org/t/p/w200${ep.still_path}`
                              : selectedItem.capaUrl;
                            
                            const runtimeStr = ep.runtime ? `${ep.runtime} min` : '24 min';

                            return (
                              <div
                                key={ep.id}
                                className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-all ${
                                  isWatched
                                    ? 'bg-primary/5 border-primary/20 hover:border-primary/45'
                                    : 'bg-surface-variant/20 border-white/5 hover:border-white/20'
                                }`}
                              >
                                {/* Left block: Still & details */}
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                  {/* Episode Still image */}
                                  <div className="w-24 aspect-[16/9] rounded-lg overflow-hidden shrink-0 bg-black/40 border border-white/10">
                                    <img src={stillUrl} className="w-full h-full object-cover" alt={ep.name} />
                                  </div>
                                  
                                  {/* Episode text */}
                                  <div className="min-w-0">
                                    <p className="text-white text-sm font-bold truncate">
                                      Ep {ep.episode_number} - {ep.name || `Episódio ${ep.episode_number}`}
                                    </p>
                                    <p className="text-on-surface-variant text-[11px] font-medium mt-0.5 font-mono">
                                      {airDateStr}
                                    </p>
                                  </div>
                                </div>

                                {/* Right block: Checked state and time metadata */}
                                <div className="flex items-center gap-5 flex-shrink-0">
                                  {/* Checked Status */}
                                  <div className="flex items-center gap-1.5 min-w-[85px]">
                                    <span className={`material-symbols-outlined text-sm font-bold ${
                                      !hasAired
                                        ? 'text-on-surface-variant/20'
                                        : isWatched
                                        ? 'text-emerald-400'
                                        : 'text-on-surface-variant/40'
                                    }`}>
                                      {!hasAired ? 'schedule' : isWatched ? 'check_circle' : 'radio_button_unchecked'}
                                    </span>
                                    <span className={`text-xs font-bold ${
                                      !hasAired
                                        ? 'text-on-surface-variant/30'
                                        : isWatched
                                        ? 'text-emerald-400'
                                        : 'text-on-surface-variant/50'
                                    }`}>
                                      {!hasAired ? 'Por estrear' : isWatched ? 'Visto' : 'Não Visto'}
                                    </span>
                                  </div>

                                  {/* Time duration details */}
                                  <div className="text-right min-w-[50px]">
                                    <p className="text-[10px] text-on-surface-variant font-medium uppercase">{runtimeStr}</p>
                                  </div>

                                  {/* Checked button toggle */}
                                  {hasAired ? (
                                    <button
                                      onClick={() => {
                                        if (isSpecial) {
                                          const currentSpecials = Array.isArray(selectedItem.watchedSpecials)
                                            ? selectedItem.watchedSpecials
                                            : [];
                                          const isAlreadyWatched = currentSpecials.includes(ep.episode_number);
                                          const updatedSpecials = isAlreadyWatched
                                            ? currentSpecials.filter((n: number) => n !== ep.episode_number)
                                            : [...currentSpecials, ep.episode_number];
                                          atualizarCampo('watchedSpecials', updatedSpecials);
                                        } else {
                                          const globalEpNum = ep.globalEpisodeNumber || getGlobalEpisodeNumber(selectedItem.seasonAtual || 1, ep.episode_number);
                                          if (isWatched) {
                                            atualizarCampo('epAtual', globalEpNum - 1);
                                          } else {
                                            atualizarCampo('epAtual', globalEpNum);
                                          }
                                        }
                                      }}
                                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                        isWatched
                                          ? 'bg-primary text-on-primary scale-105 shadow-sm shadow-primary/20'
                                          : 'bg-surface-variant/40 hover:bg-surface-variant hover:text-white text-on-surface-variant border border-white/10'
                                      }`}
                                    >
                                      <span className="material-symbols-outlined text-sm font-bold">
                                        {isWatched ? 'check' : 'check_box_outline_blank'}
                                      </span>
                                    </button>
                                  ) : (
                                    <div className="w-9 h-9 flex items-center justify-center text-on-surface-variant/30 font-bold" title="Não estreado">
                                      <span className="material-symbols-outlined text-sm">schedule</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {(() => {
                            const currentSeasonNum = viewedSeason || 1;
                            const pickerTotal = getEpisodesCountForSeason(currentSeasonNum);
                            return [...Array(pickerTotal)].map((_, i) => {
                              const num = i + 1;
                              const isWatched = (viewedSeason || 1) < (selectedItem.seasonAtual || 1)
                                ? true
                                : ((viewedSeason || 1) === (selectedItem.seasonAtual || 1)
                                    ? num <= (selectedItem.epAtual || 0)
                                    : false);
                              const hasAired = num <= lastAiredEpNumber;
                              return (
                                <button
                                  key={num}
                                  onClick={() => {
                                    if (hasAired) {
                                      const globalEpNum = getGlobalEpisodeNumber(viewedSeason || 1, num);
                                      atualizarCampo('epAtual', globalEpNum);
                                    }
                                  }}
                                  disabled={isSavingDetailsProgress || !hasAired}
                                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                                    !hasAired
                                      ? 'bg-surface-variant/10 text-on-surface-variant/20 border border-white/5 cursor-not-allowed'
                                      : isWatched
                                      ? 'bg-primary text-on-primary scale-105 shadow-md shadow-primary/25'
                                      : 'bg-surface-variant/30 text-on-surface-variant border border-white/5'
                                  }`}
                                >
                                  {num}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {[...Array(Math.max(selectedItem.capAtual || 0, (selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 0)))].map((_, i) => {
                          const num = i + 1;
                          const isWatched = num <= selectedItem.capAtual;
                          return (
                            <button key={num} onClick={() => atualizarCampo('capAtual', num)} disabled={isSavingDetailsProgress} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${isWatched ? 'bg-secondary text-on-secondary scale-105 shadow-md shadow-secondary/25' : 'bg-surface-variant/30 text-on-surface-variant border border-white/5'}`}>
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Outlines of bottom buttons: Gerir nas listas and Remover */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <button 
                    onClick={handleOpenListsModal}
                    className="w-full bg-[#18181c]/40 hover:bg-[#18181c]/80 border border-white/10 hover:border-white/20 text-white py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2.5 text-sm active:scale-95 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                    GERIR NAS LISTAS
                  </button>

                  {/* Remove Button */}
                  {showDeleteConfirm ? (
                    <div className="p-4 rounded-2xl bg-error/10 border border-error/30 animate-in fade-in zoom-in-95 duration-300 space-y-3 shadow-lg text-left">
                      <div className="flex items-center gap-2.5 text-error">
                        <span className="material-symbols-outlined text-lg">warning</span>
                        <h5 className="font-bold text-sm">Confirm Removal</h5>
                      </div>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Remove <span className="text-white font-bold">{selectedItem.titulo}</span> from library?
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowDeleteConfirm(false)} 
                          disabled={isCheckingLists}
                          className="flex-1 py-2 bg-surface-variant hover:bg-surface-variant/80 text-on-surface-variant rounded-xl font-bold text-xs border border-white/10 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleRemoveFromLibraryClick} 
                          disabled={isCheckingLists}
                          className="flex-1 py-2 bg-error hover:bg-error/80 text-on-error rounded-xl font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {isCheckingLists && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Yes, Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowDeleteConfirm(true)} className="w-full bg-error/10 hover:bg-error text-error hover:text-on-error py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2.5 text-sm border border-error/25 active:scale-95">
                      <span className="material-symbols-outlined text-base">delete</span>
                      REMOVER DA BIBLIOTECA
                    </button>
                  )}
                </div>

                {/* Personal Links (Web) */}
                {(() => {
                  const linksPessoais = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados).map((l: any) => ({ ...l, tipo: 'Custom' })) : [];
                  return linksPessoais.length > 0 && (
                    <div className="space-y-4 pt-6 border-t border-white/5 text-left">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                        <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                        Personal Links
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {linksPessoais.map((link: any, index: number) => (
                          <div key={index} className="w-full flex items-center justify-between p-4 bg-[#18181c]/60 glass-panel rounded-xl border border-white/5 shadow-md">
                            <div onClick={() => abrirLink(link.url, selectedItem.titulo)} className="flex-1 flex items-center gap-3 cursor-pointer min-w-0">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary/10 text-secondary flex-shrink-0">
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5 truncate">
                                  {link.site}
                                  <span className="px-1.5 py-0.5 bg-secondary/20 text-secondary text-[9px] rounded-md border border-secondary/30 flex-shrink-0">CUSTOM</span>
                                </p>
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase">{link.language || 'Global'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); eliminarLinkPessoal(link.site); }} className="text-red-400 hover:text-red-300 p-1 flex items-center justify-center cursor-pointer" title="Remover link">
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                              <span onClick={() => abrirLink(link.url, selectedItem.titulo)} className="material-symbols-outlined text-sm cursor-pointer text-on-surface-variant">chevron_right</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="w-full space-y-8 animate-in fade-in duration-300 text-left">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                    <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                    Synopsis
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed text-sm mt-3">
                    {selectedItem.descricao || "No description available."}
                  </p>
                  
                  {mediaType === 'manga' && (
                    <div className="flex items-center gap-2.5 mt-3">
                      {loadingLatest ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-variant/40 rounded-full border border-white/5 animate-pulse text-[10px] font-bold text-on-surface-variant">
                          <Loader2 className="w-3.5 h-3.5 text-secondary animate-spin" />
                          <span>Checking Sources...</span>
                        </div>
                      ) : latestChapter ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-[10px] font-bold">
                          <span className="material-symbols-outlined text-xs">auto_awesome</span>
                          <span>Latest on {latestChapterSource}: {latestChapter}</span>
                        </div>
                      ) : latestChapterError ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[10px] font-bold">
                          <span className="material-symbols-outlined text-xs">info</span>
                          <span>{latestChapterError}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Season Breakdown Web */}
                {mediaType === 'manga' && latestBreakdown && latestBreakdown.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-white/5 animate-in fade-in">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                      <span className="w-1 h-4 rounded-full bg-secondary"></span>
                      Season Breakdown
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {latestBreakdown.map((b: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-primary/20 rounded-xl">
                          <span className="text-xs font-bold text-white truncate pr-2">{b.label}</span>
                          <span className="px-2.5 py-1 bg-secondary/15 text-secondary text-xs font-black rounded-lg border border-secondary/20 flex-shrink-0">
                            {b.chapters} Chs
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Official Links */}
                {(() => {
                  const linksOficiais = selectedItem.linksExternos ? JSON.parse(selectedItem.linksExternos).map((l: any) => ({ ...l, tipo: 'Official' })) : [];
                  return (linksOficiais.length > 0 || (!selectedItem.isExternal)) && (
                    <div className="space-y-4 pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                          <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                          Where to {mediaType === 'anime' ? 'Watch' : 'Read'}
                        </h3>
                        {!selectedItem.isExternal && (
                          <button onClick={() => setShowAddLink(!showAddLink)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all text-xs border ${mediaType === 'anime' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                            <span className="material-symbols-outlined text-[16px]">add</span> ADD LINK
                          </button>
                        )}
                      </div>

                      {showAddLink && !selectedItem.isExternal && (
                        <div className="flex flex-col sm:flex-row gap-2.5 p-3 bg-surface-variant/30 border border-white/10 rounded-xl animate-in slide-in-from-top-4">
                          <input type="text" placeholder="Name (Ex: Crunchyroll)" value={newLinkSite} onChange={e => setNewLinkSite(e.target.value)} className="flex-1 bg-black/30 px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-primary transition-all text-xs text-white" />
                          <input type="url" placeholder="URL (https://...)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="flex-[2] bg-black/30 px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-primary transition-all text-xs text-white" />
                          <button onClick={adicionarLinkPessoal} disabled={!newLinkSite || !newLinkUrl} className="px-5 py-2 bg-primary hover:bg-primary/80 disabled:bg-surface-variant disabled:text-on-surface-variant text-on-primary rounded-lg font-bold transition-all text-xs">SAVE</button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {linksOficiais.map((link: any, index: number) => (
                          <div key={index} className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                            <div onClick={() => abrirLink(link.url, selectedItem.titulo)} className="flex-1 flex items-center gap-3 cursor-pointer min-w-0">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white uppercase tracking-wide truncate">
                                  {link.site}
                                </p>
                                <p className="text-[10px] text-on-surface-variant font-bold uppercase">{link.language || 'Global'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span onClick={() => abrirLink(link.url, selectedItem.titulo)} className="material-symbols-outlined text-sm cursor-pointer text-on-surface-variant">chevron_right</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-white/5">
                  <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
                    <span className="material-symbols-outlined text-lg mb-2 text-on-surface-variant">sensors</span>
                    <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">Release Status</p>
                    <p className="font-bold text-xs text-white">
                      {selectedItem.statusLancamento || 'Unknown'}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
                    <span className="material-symbols-outlined text-lg mb-2 text-on-surface-variant">calendar_month</span>
                    <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">Season / Year</p>
                    <p className="font-bold text-xs text-white capitalize">
                      {selectedItem.temporada ? `${selectedItem.temporada.toLowerCase()} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
                    <span className="material-symbols-outlined text-lg mb-2 text-on-surface-variant">update</span>
                    <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">{mediaType === 'anime' ? 'Total Episodes' : 'Total Chapters'}</p>
                    <p className="font-bold text-xs text-white">
                      {mediaType === 'anime' ? (selectedItem.numEpisodiosTotal || 'N/A') : (selectedItem.numCapitulosTotal || 'N/A')}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
                    <span className="material-symbols-outlined text-lg mb-2 text-on-surface-variant">star</span>
                    <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">Nota Geral</p>
                    <p className="font-bold text-xs text-white">
                      {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'} / 10
                    </p>
                  </div>
                </div>

                {renderRatingCommentsSection()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading && !selectedItem) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className={`w-12 h-12 animate-spin ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`} />
        <p className="text-on-surface-variant text-sm font-black animate-pulse">A carregar detalhes...</p>
      </div>
    );
  }

  const totalEpisodesAllSeasons = selectedItem
    ? (mediaType === 'anime'
        ? getSeasonsList().reduce((sum: number, s: number) => sum + getAiredEpisodesCountForSeason(s), 0)
        : (selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero
            ? selectedItem.proximoCapituloNumero - 1
            : (selectedItem.numCapitulosTotal || 0))
      )
    : 0;

  const globalPercentage = selectedItem && totalEpisodesAllSeasons > 0
    ? Math.min(100, Math.max(0, ((mediaType === 'anime' ? (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) : selectedItem.capAtual) / totalEpisodesAllSeasons) * 100))
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-4 md:py-8">
      <div className="animate-in fade-in slide-in-from-left-4 duration-500">
        <button onClick={() => navigate(-1)} className={`mb-10 flex items-center gap-2 px-5 py-2.5 rounded-full glass-panel border border-white/10 text-on-surface-variant hover:text-white transition-all group font-bold shadow-lg ${mediaType === 'anime' ? 'hover:border-secondary/50 hover:shadow-[0_0_15px_rgba(194,24,91,0.3)]' : 'hover:border-primary/50 hover:shadow-[0_0_15px_rgba(106,27,154,0.3)]'}`}>
          <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
          {t("Voltar")}
        </button>

        {selectedItem && (
          isMobile ? (
            /* VERSÃO ANDROID NATIVA: Ordem Exata Solicitada pelo Utilizador + Margens Otimizadas */
            <div className={`glass-panel rounded-2xl sm:rounded-3xl overflow-hidden border p-4 sm:p-6 space-y-6 ${mediaType === 'anime' ? 'border-secondary/20 shadow-lg' : 'border-primary/20 shadow-lg'}`}>
              {/* 1. Capa & Título */}
              <div className="flex gap-4 items-start">
                <div className={`w-28 sm:w-36 aspect-[2/3] rounded-xl overflow-hidden shadow-lg border-2 border-background ring-1 ${mediaType === 'anime' ? 'ring-secondary/50' : 'ring-primary/50'} flex-shrink-0`}>
                  <img src={selectedItem.capaUrl} className="w-full h-full object-cover" alt={selectedItem.titulo} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${mediaType === 'anime' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-secondary/20 text-secondary border-secondary/30'}`}>
                      {mediaType}
                    </span>
                    <span className={`text-xs flex items-center gap-0.5 font-bold ${
                      getPriorityStarColor(selectedItem.prioridade)
                    }`}>
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> {selectedItem.isExternal ? 'New' : `#${selectedItem.prioridade}`}
                    </span>
                  </div>
                  <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${mediaType === 'anime' ? 'text-primary-light' : 'text-secondary-light'} line-clamp-3`}>{selectedItem.titulo}</h2>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black w-fit ${mediaType === 'anime' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/10 border-secondary/30 text-secondary'}`}>
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'} / 10
                  </div>
                  
                  {mediaType === 'manga' && (
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
                          <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">{latestChapterError}</span>
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
                {getGenresList(selectedItem.generos).map((g) => (
                  <span key={g.name} className={`px-3 py-1 bg-white/5 rounded-lg text-[11px] font-bold text-on-surface border tracking-wider flex items-center gap-1 ${mediaType === 'anime' ? 'border-secondary/30' : 'border-primary/30'}`}>
                    {g.name}
                  </span>
                ))}
              </div>

              {/* Info Grid: Release Status, Season & Total Episodes/Chapters (Visible always) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 border-t border-white/5">
                <div className="glass-panel p-2 flex flex-col items-center justify-center text-center border border-white/5 min-w-0">
                  <p className="text-on-surface-variant text-[8px] uppercase font-bold tracking-widest mb-1 truncate w-full">Status</p>
                  <p className={`font-bold text-xs truncate w-full ${selectedItem.statusLancamento === 'RELEASING' ? (mediaType === 'anime' ? 'text-primary' : 'text-secondary') : 'text-white'}`}>
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
                    {mediaType === 'anime' ? 'Episodes' : 'Chapters'}
                  </p>
                  <p className="font-bold text-xs text-white truncate w-full">
                    {mediaType === 'anime' ? (selectedItem.numEpisodiosTotal || 'N/A') : (selectedItem.numCapitulosTotal || 'N/A')}
                  </p>
                </div>
                <div className="glass-panel p-2 flex flex-col items-center justify-center text-center border border-white/5 min-w-0">
                  <p className="text-on-surface-variant text-[8px] uppercase font-bold tracking-widest mb-1 truncate w-full">Nota Geral</p>
                  <p className={`font-bold text-xs truncate w-full ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`}>
                    {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'} / 10
                  </p>
                </div>
              </div>

              {/* TABS SWITCHER */}
              <div className="flex border-b border-white/10 mb-4">
                <button
                  onClick={() => setActiveTab('tracking')}
                  className={`flex-1 py-2.5 text-xs font-black transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                    activeTab === 'tracking'
                      ? (mediaType === 'anime' ? 'border-primary text-primary' : 'border-secondary text-secondary')
                      : 'border-transparent text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">analytics</span>
                  ACOMPANHAMENTO
                </button>
                <button
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 py-2.5 text-xs font-black transition-all flex items-center justify-center gap-1.5 border-b-2 ${
                    activeTab === 'info'
                      ? (mediaType === 'anime' ? 'border-primary text-primary' : 'border-secondary text-secondary')
                      : 'border-transparent text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">info</span>
                  SINOPSE
                </button>
              </div>

              {activeTab === 'tracking' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* 3. Ações (Quick Actions & My Progress) */}
                  <div className="space-y-4">
                    {selectedItem.isExternal ? (
                      <button 
                        onClick={() => { adicionarAoBanco(selectedItem.titulo, selectedItem.id, selectedItem.formato); }} 
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
                              let pulseColor = 'rgba(255, 255, 255, 0.2)';
                              if (opt.value === 'WATCHING') pulseColor = 'rgba(74, 222, 128, 0.45)';
                              else if (opt.value === 'PLANNED') pulseColor = 'rgba(139, 92, 246, 0.45)';
                              else if (opt.value === 'COMPLETED') pulseColor = 'rgba(251, 191, 36, 0.45)';
                              else if (opt.value === 'PAUSED') pulseColor = 'rgba(249, 115, 22, 0.45)';
                              else if (opt.value === 'DROPPED') pulseColor = 'rgba(239, 68, 68, 0.45)';
                              
                              return (
                                <button 
                                  key={opt.value} 
                                  onClick={() => atualizarCampo('status', opt.value)} 
                                  style={{ '--pulse-color': pulseColor } as React.CSSProperties}
                                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-bold relative overflow-hidden group active:scale-95 ${
                                    isSelected 
                                      ? `${mediaType === 'anime' ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-primary/20 border-primary text-primary'} animate-pulse-glow` 
                                      : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:text-white'
                                  }`}
                                >
                                  {isSelected && (
                                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${mediaType === 'anime' ? 'bg-secondary' : 'bg-primary'}`}></span>
                                  )}
                                  <span className={`material-symbols-outlined text-base ${isSelected ? (mediaType === 'anime' ? 'text-secondary' : 'text-primary') : 'text-on-surface-variant'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {opt.value === 'WATCHING' ? 'play_circle' : 
                                     opt.value === 'PLANNED' ? 'schedule' : 
                                     opt.value === 'COMPLETED' ? 'check_circle' : 
                                     opt.value === 'PAUSED' ? 'pause_circle' : 'cancel'}
                                  </span>
                                  <span className="truncate">{mediaType === 'anime' ? opt.animeLabel : opt.mangaLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Priority Selector */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            Prioridade
                          </label>
                          <div className="relative">
                            {(() => {
                              const currentPriorityOpt = PRIORITY_OPTIONS.find(opt => opt.num === selectedItem.prioridade) || PRIORITY_OPTIONS[4];
                              return (
                                <button
                                  onClick={() => setShowPriorityModal(true)}
                                  className="w-full flex items-center justify-between bg-black/40 text-white border border-white/10 px-4 py-2.5 rounded-xl outline-none focus:border-primary text-xs font-bold cursor-pointer text-left h-[46px] pr-4"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-xs text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                    <span>#{selectedItem.prioridade} - {t(currentPriorityOpt.desc)}</span>
                                  </div>
                                  <span className="material-symbols-outlined text-on-surface-variant text-base">
                                    unfold_more
                                  </span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>

                        {/* My Progress */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-1.5 justify-center">
                            <span className="material-symbols-outlined text-on-surface-variant text-xs">timelapse</span>
                            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">Meu Progresso</p>
                          </div>
                           
                          {/* Season Selector (Horizontal scrollable pills) */}
                          {mediaType === 'anime' && (
                            (() => {
                              let uniqueSeasonNums: any[] = [];
                              if (selectedItem.episodes && selectedItem.episodes.length > 0) {
                                uniqueSeasonNums = Array.from(new Set(selectedItem.episodes.map((ep: any) => ep.season)))
                                  .sort((a: any, b: any) => a - b);
                              } else {
                                const seasons = selectedItem.relations?.edges
                                  ?.filter((edge: any) => edge.node.format === 'TV_SEASON')
                                  ?.sort((a: any, b: any) => a.node.seasonNumber - b.node.seasonNumber) || [];
                                uniqueSeasonNums = seasons.map((edge: any) => edge.node.seasonNumber);
                              }

                              if (uniqueSeasonNums.length <= 1 && !uniqueSeasonNums.includes(0)) {
                                return null;
                              }
                              
                              return (
                                <div className="space-y-2 w-full pt-1">
                                  <label className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1 justify-center">
                                    <span className="material-symbols-outlined text-[11px]">folder_open</span>
                                    Temporada
                                  </label>
                                  <div className="flex overflow-x-auto gap-2 pb-2 pt-1 w-full justify-start scrollbar-none snap-x">
                                    {uniqueSeasonNums.map((seasonNum) => {
                                      const isSelected = viewedSeason === seasonNum;
                                      const epsCount = getEpisodesCountForSeason(seasonNum);
                                      
                                      return (
                                        <button
                                          key={seasonNum}
                                          onClick={() => setViewedSeason(seasonNum)}
                                          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 snap-center ${
                                            isSelected
                                              ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                                              : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:text-white'
                                          }`}
                                        >
                                          {seasonNum === 0 ? 'Especiais' : `Temp. ${seasonNum}`}
                                          {epsCount > 0 && <span className="text-[9px] opacity-60 ml-1">({epsCount})</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()
                          )}

                          <div className="flex items-baseline gap-2 mb-4 mt-2 justify-center">
                            {isSavingDetailsProgress ? (
                              <div className="h-10 flex items-center justify-center">
                                <Loader2 className={`w-6 h-6 animate-spin ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`} />
                              </div>
                            ) : (
                              <>
                                <input 
                                  type="number" 
                                  min="0" 
                                  max={totalEpisodesAllSeasons || 9999} 
                                  value={mediaType === 'anime' ? (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) : (selectedItem.capAtual || 0)} 
                                  onChange={(e) => { 
                                    const val = parseInt(e.target.value) || 0; 
                                    if (mediaType === 'anime') { 
                                      if (val > totalAiredEpisodes) {
                                        showToast('Não é possível marcar episódios que ainda não estrearam.', 'error');
                                        return;
                                      }
                                      atualizarCampo('epAtual', val); 
                                    } else { 
                                      atualizarCampo('capAtual', val); 
                                    } 
                                  }} 
                                  className={`bg-transparent ${mediaType === 'anime' ? 'text-primary focus:bg-secondary/10' : 'text-secondary focus:bg-primary/10'} font-black text-3xl w-16 text-center outline-none border-b border-white/10 focus:border-white/40 rounded transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-0.5`} 
                                />
                                <span className="text-on-surface-variant font-light text-2xl">/</span> 
                                <span className="text-on-surface-variant font-bold text-2xl">
                                  {totalEpisodesAllSeasons || '?'}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-center gap-2 w-full flex-wrap mb-1">
                            <button onClick={() => atualizarProgresso(-1)} disabled={isSavingDetailsProgress} title="Subtract 1" className={`w-9 h-9 rounded-xl bg-surface-variant/40 hover:bg-surface-variant border border-white/5 text-on-surface-variant hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}>
                              <span className="material-symbols-outlined text-base">remove</span>
                            </button>
                            <button 
                              onClick={() => atualizarProgresso(1)} 
                              disabled={
                                isSavingDetailsProgress || 
                                (mediaType === 'anime' && (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) >= totalAiredEpisodes)
                              } 
                              title="Add 1" 
                              className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center shadow-md active:scale-95 font-bold ${mediaType === 'anime' ? 'bg-primary text-on-primary shadow-sm shadow-primary/20' : 'bg-secondary text-on-secondary shadow-sm shadow-secondary/20'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <span className="material-symbols-outlined text-base">add</span>
                            </button>
                            <button onClick={() => setShowEpList(!showEpList)} className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border active:scale-95 ${showEpList ? (mediaType === 'anime' ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/20 border-secondary text-secondary') : 'bg-surface-variant/30 border-white/5 text-on-surface-variant'}`}>
                              <span className="material-symbols-outlined text-sm">grid_view</span>
                              {showEpList ? 'Close List' : 'Open List'}
                            </button>
                          </div>

                          {showEpList && (
                            <div className="w-full mt-4 border-t border-white/10 pt-4 animate-in slide-in-from-top-4 duration-300 text-left">
                              {mediaType === 'anime' ? (
                                loadingEpisodes ? (
                                  <div className="flex items-center justify-center py-6">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                  </div>
                                ) : seasonEpisodes && seasonEpisodes.length > 0 ? (
                                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {seasonEpisodes.map((ep: any) => {
                                      const isSpecial = ep.season === 0 || ep.season_number === 0 || viewedSeason === 0;
                                      const isWatched = isSpecial
                                        ? Array.isArray(selectedItem.watchedSpecials) && selectedItem.watchedSpecials.includes(ep.episode_number)
                                        : (ep.globalEpisodeNumber || getGlobalEpisodeNumber(viewedSeason || 1, ep.episode_number)) <= (selectedItem.epAtualGlobal || selectedItem.epAtual || 0);
                                      const hasAired = ep.episode_number <= lastAiredEpNumber;
                                      const airDateStr = ep.air_date
                                        ? new Date(ep.air_date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                        : 'Sem data';
                                      const stillUrl = ep.still_path
                                        ? `https://image.tmdb.org/t/p/w200${ep.still_path}`
                                        : selectedItem.capaUrl;
                                        
                                      const runtimeStr = ep.runtime ? `${ep.runtime} min` : '24 min';

                                      return (
                                        <div
                                          key={ep.id}
                                          className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-all ${
                                            isWatched
                                              ? 'bg-primary/5 border-primary/20 hover:border-primary/45'
                                              : 'bg-surface-variant/20 border-white/5 hover:border-white/20'
                                          }`}
                                        >
                                          {/* Left block: Still & details */}
                                          <div className="flex items-center gap-4 min-w-0 flex-1">
                                            {/* Episode Still image */}
                                            <div className="w-24 aspect-[16/9] rounded-lg overflow-hidden shrink-0 bg-black/40 border border-white/10">
                                              <img src={stillUrl} className="w-full h-full object-cover" alt={ep.name} />
                                            </div>
                                            
                                            {/* Episode text */}
                                            <div className="min-w-0">
                                              <p className="text-white text-sm font-bold truncate">
                                                Ep {ep.episode_number} - {ep.name || `Episódio ${ep.episode_number}`}
                                              </p>
                                              <p className="text-on-surface-variant text-[11px] font-medium mt-0.5 font-mono">
                                                {airDateStr}
                                              </p>
                                            </div>
                                          </div>

                                          {/* Right block: Checked state and time metadata */}
                                          <div className="flex items-center gap-5 flex-shrink-0">
                                            {/* Checked Status */}
                                            <div className="flex items-center gap-1.5 min-w-[85px]">
                                              <span className={`material-symbols-outlined text-sm font-bold ${
                                                !hasAired
                                                  ? 'text-on-surface-variant/20'
                                                  : isWatched
                                                  ? 'text-emerald-400'
                                                  : 'text-on-surface-variant/40'
                                              }`}>
                                                {!hasAired ? 'schedule' : isWatched ? 'check_circle' : 'radio_button_unchecked'}
                                              </span>
                                              <span className={`text-xs font-bold ${
                                                !hasAired
                                                  ? 'text-on-surface-variant/30'
                                                  : isWatched
                                                  ? 'text-emerald-400'
                                                  : 'text-on-surface-variant/50'
                                              }`}>
                                                {!hasAired ? 'Por estrear' : isWatched ? 'Visto' : 'Não Visto'}
                                              </span>
                                            </div>

                                            {/* Time duration details */}
                                            <div className="text-right min-w-[50px]">
                                              <p className="text-[10px] text-on-surface-variant font-medium uppercase">{runtimeStr}</p>
                                            </div>

                                            {/* Checked button toggle */}
                                            {hasAired ? (
                                              <button
                                                onClick={() => {
                                                  if (isSpecial) {
                                                    const currentSpecials = Array.isArray(selectedItem.watchedSpecials)
                                                      ? selectedItem.watchedSpecials
                                                      : [];
                                                    const isAlreadyWatched = currentSpecials.includes(ep.episode_number);
                                                    const updatedSpecials = isAlreadyWatched
                                                      ? currentSpecials.filter((n: number) => n !== ep.episode_number)
                                                      : [...currentSpecials, ep.episode_number];
                                                    atualizarCampo('watchedSpecials', updatedSpecials);
                                                  } else {
                                                    const globalEpNum = ep.globalEpisodeNumber || getGlobalEpisodeNumber(viewedSeason || 1, ep.episode_number);
                                                    if (isWatched) {
                                                      atualizarCampo('epAtual', globalEpNum - 1);
                                                    } else {
                                                      atualizarCampo('epAtual', globalEpNum);
                                                    }
                                                  }
                                                }}
                                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                                  isWatched
                                                    ? 'bg-primary text-on-primary scale-105 shadow-sm shadow-primary/20'
                                                    : 'bg-surface-variant/40 hover:bg-surface-variant hover:text-white text-on-surface-variant border border-white/10'
                                                }`}
                                              >
                                                <span className="material-symbols-outlined text-sm font-bold">
                                                  {isWatched ? 'check' : 'check_box_outline_blank'}
                                                </span>
                                              </button>
                                            ) : (
                                              <div className="w-9 h-9 flex items-center justify-center text-on-surface-variant/30 font-bold" title="Não estreado">
                                                <span className="material-symbols-outlined text-sm">schedule</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                                    {(() => {
                                      const currentSeasonNum2 = viewedSeason || 1;
                                      const pickerTotal2 = getEpisodesCountForSeason(currentSeasonNum2);
                                      return [...Array(pickerTotal2)].map((_, i) => {
                                        const num = i + 1;
                                        const isWatched = (viewedSeason || 1) < (selectedItem.seasonAtual || 1)
                                          ? true
                                          : ((viewedSeason || 1) === (selectedItem.seasonAtual || 1)
                                              ? num <= (selectedItem.epAtual || 0)
                                              : false);
                                        const hasAired = num <= lastAiredEpNumber;
                                        return (
                                          <button
                                            key={num}
                                            onClick={() => {
                                              if (hasAired) {
                                                const globalEpNum = getGlobalEpisodeNumber(viewedSeason || 1, num);
                                                atualizarCampo('epAtual', globalEpNum);
                                              }
                                            }}
                                            disabled={isSavingDetailsProgress || !hasAired}
                                            className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                              !hasAired
                                                ? 'bg-surface-variant/10 text-on-surface-variant/20 border border-white/5 cursor-not-allowed'
                                                : isWatched
                                                ? 'bg-primary text-on-primary scale-105 shadow-md shadow-primary/25'
                                                : 'bg-surface-variant/30 text-on-surface-variant border border-white/5'
                                            }`}
                                          >
                                            {num}
                                          </button>
                                        );
                                      });
                                    })()}
                                  </div>
                                )
                              ) : (
                                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                                  {[...Array(Math.max(selectedItem.capAtual || 0, (selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (latestChapter || selectedItem.numCapitulosTotal || 0)))].map((_, i) => {
                                    const num = i + 1;
                                    const isWatched = num <= selectedItem.capAtual;
                                    return (
                                      <button key={num} onClick={() => atualizarCampo('capAtual', num)} disabled={isSavingDetailsProgress} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isWatched ? 'bg-secondary text-on-secondary scale-105' : 'bg-surface-variant/30 text-on-surface-variant border border-white/5'}`}>
                                        {num}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Season Breakdown (Manga only) */}
                        {mediaType === 'manga' && latestBreakdown && latestBreakdown.length > 0 && (
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

                        {(() => {
                          const linksPessoais = selectedItem?.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados) : [];
                          if (linksPessoais.length === 0) return null;
                          return (
                            <button 
                              onClick={() => handleGoToTabClick(linksPessoais)}
                              className={`w-full ${mediaType === 'anime' ? 'bg-primary hover:bg-primary-light text-on-primary shadow-lg shadow-primary/20' : 'bg-secondary hover:bg-secondary-light text-on-secondary shadow-lg shadow-secondary/20'} py-3 rounded-xl font-extrabold transition-all flex items-center justify-center gap-2 text-xs active:scale-95 mb-2`}
                            >
                              <span className="material-symbols-outlined text-sm">open_in_new</span>
                              {mediaType === 'anime' ? 'ASSISTIR NO SEPARADOR' : 'LER NO SEPARADOR'}
                            </button>
                          );
                        })()}

                        <button 
                          onClick={handleOpenListsModal}
                          className="w-full bg-surface-variant/40 hover:bg-surface-variant border border-white/5 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs active:scale-95 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
                          GERIR NAS LISTAS
                        </button>

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
                              <button 
                                onClick={() => setShowDeleteConfirm(false)} 
                                disabled={isCheckingLists}
                                className="flex-1 py-2 bg-surface-variant text-on-surface-variant rounded-xl font-bold text-xs border border-white/10 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={handleRemoveFromLibraryClick} 
                                disabled={isCheckingLists}
                                className="flex-1 py-2 bg-error text-on-error rounded-xl font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                              >
                                {isCheckingLists && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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

                  {/* Personal Links in Tracking Tab */}
                  {(() => {
                    const linksPessoais = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados).map((l: any) => ({ ...l, tipo: 'Custom' })) : [];
                    return linksPessoais.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                          <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                          Personal Links
                        </h3>
                        <div className="grid grid-cols-1 gap-2.5">
                          {linksPessoais.map((link: any, index: number) => (
                            <div key={index} className="w-full flex items-center justify-between p-3.5 glass-panel rounded-xl shadow-sm border border-white/5">
                              <div onClick={() => abrirLink(link.url, selectedItem.titulo)} className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-secondary/10 text-secondary">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5 truncate">
                                    {link.site}
                                    <span className="px-1.5 py-0.5 bg-secondary/20 text-secondary text-[9px] rounded-md border border-secondary/30 flex-shrink-0">CUSTOM</span>
                                  </p>
                                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">{link.language || 'Global'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); eliminarLinkPessoal(link.site); }} className="text-red-400 hover:text-red-300 p-1 flex items-center justify-center cursor-pointer" title="Remover link">
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                                <span onClick={() => abrirLink(link.url, selectedItem.titulo)} className="material-symbols-outlined text-sm flex-shrink-0 text-on-surface-variant cursor-pointer">chevron_right</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* 5. Descrição (Sinopse) */}
                  <div className="space-y-2 text-left">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                      <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                      Synopsis
                    </h3>
                    <p className="text-on-surface-variant leading-relaxed text-xs sm:text-sm">
                      {selectedItem.descricao || "No description available."}
                    </p>
                  </div>

                  {/* Official Links in Details Tab */}
                  {(() => {
                    const linksOficiais = selectedItem.linksExternos ? JSON.parse(selectedItem.linksExternos).map((l: any) => ({ ...l, tipo: 'Official' })) : [];
                    return (linksOficiais.length > 0 || (!selectedItem.isExternal)) && (
                      <div className="space-y-4 pt-4 border-t border-white/5 text-left">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                            <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                            Where to {mediaType === 'anime' ? 'Watch' : 'Read'}
                          </h3>
                          {!selectedItem.isExternal && (
                            <button onClick={() => setShowAddLink(!showAddLink)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all text-xs border ${mediaType === 'anime' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
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
                          {linksOficiais.map((link: any, index: number) => (
                            <div key={index} className="w-full flex items-center justify-between p-3.5 glass-panel rounded-xl shadow-sm border border-white/5">
                              <div onClick={() => abrirLink(link.url, selectedItem.titulo)} className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white uppercase tracking-wide truncate">
                                    {link.site}
                                  </p>
                                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">{link.language || 'Global'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span onClick={() => abrirLink(link.url, selectedItem.titulo)} className="material-symbols-outlined text-sm flex-shrink-0 text-on-surface-variant cursor-pointer">chevron_right</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {renderRatingCommentsSection()}
            </div>
          ) : (
            renderDesktopVersion()
          )
        )}
      </div>



      {loadingDetails && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
          <div className={`p-8 rounded-3xl glass-panel border flex flex-col items-center max-w-sm w-full mx-4 text-center space-y-6 shadow-2xl animate-slide-up ${mediaType === 'anime' ? 'border-primary/30' : 'border-secondary/30'}`}>
            <div className="relative flex items-center justify-center w-24 h-24">
              <div className={`absolute inset-0 rounded-full blur-xl animate-pulse ${mediaType === 'anime' ? 'bg-primary/20 shadow-[0_0_30px_rgba(106,27,154,0.4)]' : 'bg-secondary/20 shadow-[0_0_30px_rgba(194,24,91,0.4)]'}`}></div>
              <div className={`absolute inset-0 rounded-full border-4 border-t-transparent border-r-transparent animate-spin ${mediaType === 'anime' ? 'border-primary' : 'border-secondary'}`} style={{ animationDuration: '1s' }}></div>
              <div className={`absolute w-16 h-16 rounded-full border-4 border-b-transparent border-l-transparent animate-spin ${mediaType === 'anime' ? 'border-secondary-light' : 'border-primary-light'}`} style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
              <span className={`material-symbols-outlined text-3xl font-bold animate-bounce ${mediaType === 'anime' ? 'text-primary-light' : 'text-secondary-light'}`}>
                {mediaType === 'anime' ? 'play_circle' : 'menu_book'}
              </span>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-white tracking-tight">
                {mediaType === 'anime' ? 'Carregando Anime...' : 'Carregando Mangá...'}
              </h4>
              <p className="text-on-surface-variant text-sm font-medium animate-pulse">
                Procurando informações detalhadas...
              </p>
            </div>

            <div className="w-full h-1.5 bg-surface-variant/40 rounded-full overflow-hidden relative">
              <div className={`animate-loading-bar rounded-full ${mediaType === 'anime' ? 'bg-primary shadow-[0_0_8px_rgba(106,27,154,0.6)]' : 'bg-secondary shadow-[0_0_8px_rgba(194,24,91,0.6)]'}`}></div>
            </div>
          </div>
        </div>
      )}

      {showListsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-surface-container rounded-[24px] border border-white/10 shadow-2xl p-6 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display-md text-xl font-extrabold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
                Adicionar às Listas
              </h3>
              <button 
                onClick={() => setShowListsModal(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-all animate-none flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-on-surface-variant mb-5">
              Adiciona ou remove <span className="text-white font-bold">{selectedItem.titulo}</span> das tuas coleções personalizadas.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-[180px]">
              {loadingLists ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <Loader2 className={`w-8 h-8 animate-spin ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`} />
                  <p className="text-xs text-on-surface-variant font-bold">A carregar listas...</p>
                </div>
              ) : lists.length === 0 ? (
                <p className="text-center py-10 text-xs text-on-surface-variant">
                  Não tens nenhuma lista personalizada. Cria uma na página de Listas!
                </p>
              ) : (
                lists.map(list => {
                  const isCurrentlyInList = list.items?.some((i: any) => i.anilistMediaId === getMediaId() && i.mediaType === (mediaType?.toUpperCase()));
                  
                  return (
                    <div 
                      key={list.id} 
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isCurrentlyInList 
                          ? (mediaType === 'anime' ? 'bg-primary/10 border-primary/30' : 'bg-secondary/10 border-secondary/30')
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-white truncate">{list.name}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">
                          {list._count?.items || 0} itens
                        </p>
                      </div>
                      
                      <button
                        onClick={() => toggleItemInList(list.id, isCurrentlyInList)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 ${
                          isCurrentlyInList
                            ? 'bg-error/20 hover:bg-error text-error hover:text-white border border-error/30'
                            : (mediaType === 'anime' ? 'bg-primary text-on-primary hover:bg-primary/80 shadow-md' : 'bg-secondary text-on-secondary hover:bg-secondary/80 shadow-md')
                        }`}
                      >
                        {isCurrentlyInList ? 'Remover' : 'Adicionar'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
            <button
              onClick={() => { setShowListsModal(false); navigate('/lists'); }}
              className="mt-6 w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">list</span>
              Ir para Gerir Listas
            </button>
          </div>
        </div>
      )}

      {showPriorityModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={() => setShowPriorityModal(false)}>
          <div 
            className="relative w-full sm:max-w-md bg-surface-container rounded-t-[24px] sm:rounded-[24px] border-t sm:border border-white/10 shadow-2xl p-6 overflow-hidden animate-slide-up flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle for bottom sheet on mobile */}
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-4 sm:hidden flex-shrink-0" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display-md text-lg font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                Nível de Prioridade
              </h3>
              <button 
                onClick={() => setShowPriorityModal(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-all flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-on-surface-variant mb-4">
              Define a prioridade de acompanhamento para <span className="text-white font-bold">{selectedItem.titulo}</span>.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {PRIORITY_OPTIONS.map((p) => {
                const isSelected = selectedItem.prioridade === p.num;
                
                return (
                  <button
                    key={p.num}
                    onClick={() => {
                      atualizarCampo('prioridade', p.num);
                      setShowPriorityModal(false);
                    }}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? `${mediaType === 'anime' ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(139,92,246,0.15)]' : 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_12px_rgba(194,24,91,0.15)]'}`
                        : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${
                        isSelected 
                          ? (mediaType === 'anime' ? 'bg-primary/30 border-primary/50 text-white' : 'bg-secondary/30 border-secondary/50 text-white')
                          : 'bg-white/5 border-white/10 text-on-surface-variant'
                      }`}>
                        #{p.num}
                      </span>
                      <div>
                        <p className="font-bold text-xs text-white">
                          {t(p.desc)}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          {p.num <= 3 ? 'Prioridade Alta' : p.num <= 5 ? 'Prioridade Média' : 'Fila de Espera'}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <span className={`material-symbols-outlined text-base font-black ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`}>
                        check_circle
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showExternalProfile && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl bg-surface-container rounded-[32px] border border-white/10 shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <button 
              onClick={() => { setShowExternalProfile(false); setExternalProfile(null); }} 
              className="absolute top-4 right-4 z-[120] p-2 rounded-full bg-black/40 hover:bg-black/60 text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingExternalProfile ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className={`w-10 h-10 animate-spin ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`} />
                <p className="text-on-surface-variant text-sm font-bold animate-pulse">Carregando perfil...</p>
              </div>
            ) : externalProfile ? (
              <div className="overflow-y-auto flex-1 custom-scrollbar">
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
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-black/40 to-transparent z-10"></div>
                  
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

                <div className="p-6 space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-secondary" />
                      <span>Estatísticas de Consumo</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <PlayCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                        <span className="text-lg font-black text-white mt-1">
                          {externalProfile.statistics?.totalAnimeCompleted || 0}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Animes</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <Film className="w-4 h-4 text-primary mx-auto" />
                        <span className="text-lg font-black text-white mt-1">
                          {externalProfile.statistics?.totalEpisodesWatched || 0}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Episódios</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <BookOpen className="w-4 h-4 text-secondary mx-auto" />
                        <span className="text-lg font-black text-white mt-1">
                          {externalProfile.statistics?.totalMangaRead || 0}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Capítulos</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <Clock className="w-4 h-4 text-amber-400 mx-auto" />
                        <span className="text-lg font-black text-white mt-1 truncate">
                          {externalProfile.statistics?.animeDaysWasted ? `${externalProfile.statistics.animeDaysWasted}d` : '0d'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Tempo Anime</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-center gap-0.5 text-center">
                        <Clock className="w-4 h-4 text-pink-400 mx-auto" />
                        <span className="text-lg font-black text-white mt-1 truncate">
                          {externalProfile.statistics?.mangaDaysWasted ? `${externalProfile.statistics.mangaDaysWasted}d` : '0d'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Tempo Mangá</span>
                      </div>
                    </div>
                  </div>

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

      {showListRemovalConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-surface-container rounded-[24px] border border-white/10 shadow-2xl p-6 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display-md text-lg font-extrabold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-error">warning</span>
                Remover das Listas?
              </h3>
              <button 
                onClick={() => setShowListRemovalConfirm(false)}
                disabled={isDeletingFromLists}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-all animate-none flex items-center justify-center disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
              Este conteúdo está presente em <span className="text-white font-bold">{listsWithMedia.length}</span> {listsWithMedia.length === 1 ? 'lista personalizada' : 'listas personalizadas'}:
            </p>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-5 max-h-[120px] overflow-y-auto space-y-1.5 custom-scrollbar">
              {listsWithMedia.map(list => (
                <div key={list.id} className="flex items-center gap-2 text-xs text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                  <span className="font-semibold truncate">{list.name}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-on-surface-variant/80 mb-6">
              Desejas remover este conteúdo também destas listas personalizadas ao removê-lo da biblioteca?
            </p>

            <div className="space-y-2">
              <button
                onClick={handleRemoveFromEverything}
                disabled={isDeletingFromLists}
                className="w-full bg-error text-on-error py-3 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-error/85 animate-none"
              >
                {isDeletingFromLists && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sim, remover de tudo
              </button>
              <button
                onClick={handleRemoveFromLibraryOnly}
                disabled={isDeletingFromLists}
                className="w-full bg-surface-variant hover:bg-surface-variant/80 border border-white/10 text-white py-3 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 animate-none"
              >
                Não, manter nas listas
              </button>
              <button
                onClick={() => setShowListRemovalConfirm(false)}
                disabled={isDeletingFromLists}
                className="w-full bg-transparent hover:bg-white/5 text-on-surface-variant hover:text-white py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50 animate-none"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {showSourcesSelector && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container border border-white/10 rounded-[28px] w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display-md text-sm font-extrabold text-white">
                {mediaType === 'anime' ? 'Escolhe a Fonte de Vídeo' : 'Escolhe a Fonte de Leitura'}
              </h3>
              <button onClick={() => setShowSourcesSelector(false)} className="text-on-surface-variant hover:text-white p-1 rounded-full hover:bg-white/5 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {sourcesToSelect.map((source, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    abrirLink(source.url, source.site);
                    setShowSourcesSelector(false);
                  }}
                  className={`w-full py-3.5 px-4 rounded-2xl text-left font-bold text-xs bg-white/5 hover:bg-white/10 border border-white/5 text-white transition-all flex items-center justify-between group active:scale-[0.98]`}
                >
                  <span>{source.site}</span>
                  <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-white transition-all">arrow_forward_ios</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailsPage;
