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
import { CommentsSection } from '../components/details/CommentsSection';
import { CustomListsModal } from '../components/details/CustomListsModal';
import { TrackingTab } from '../components/details/TrackingTab';
import { InfoTab } from '../components/details/InfoTab';

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
  const { setCategoria, setIsViewingDetails, animeLibraryData, mangaLibraryData, setAnimeLibraryData, setMangaLibraryData } = useMedia();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [showSourcesSelector, setShowSourcesSelector] = useState(false);
  const [sourcesToSelect] = useState<any[]>([]);

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
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // States for list removal confirmation when deleting from library
  const [showListRemovalConfirm, setShowListRemovalConfirm] = useState(false);
  const [listsWithMedia, setListsWithMedia] = useState<any[]>([]);
  const [isCheckingLists, setIsCheckingLists] = useState(false);
  const [isDeletingFromLists, setIsDeletingFromLists] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracking' | 'info' | 'comments'>('tracking');
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

  // Sync viewedSeason with selectedItem.proximaSeason when it changes (initial load or automatic update)
  useEffect(() => {
    if (selectedItem?.proximaSeason) {
      setViewedSeason(selectedItem.proximaSeason);
    } else if (selectedItem?.seasonAtual) {
      setViewedSeason(selectedItem.seasonAtual);
    }
  }, [selectedItem?.proximaSeason, selectedItem?.seasonAtual]);

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
      let data = null;

      // Ensure library cache is populated before checking if it already exists
      let currentCache = mediaType === 'manga' ? mangaLibraryData : animeLibraryData;
      if (!currentCache || currentCache.length === 0) {
        try {
          const response = await customFetch(`${API_BASE_URL}/${mediaType}`, { headers: getHeaders() });
          if (response.ok) {
            const listData = await response.json();
            if (Array.isArray(listData)) {
              currentCache = listData;
              if (mediaType === 'anime') {
                setAnimeLibraryData(listData);
              } else {
                setMangaLibraryData(listData);
              }
            }
          }
        } catch (e) {
          console.error("Error fetching library data in DetailsPage:", e);
        }
      }

      // Check if it already exists in database using local cache lookup first
      let matched = null;
      if (currentCache && currentCache.length > 0) {
        matched = currentCache.find(item => 
          item.id === targetId || (mediaType === 'manga' ? item.mangaId : item.animeId) === targetId
        );
      }

      if (matched) {
        targetId = matched.id;
        isExternal = false;
        try {
          const response = await customFetch(`${API_BASE_URL}/${mediaType}/${targetId}`, { headers: getHeaders() });
          if (response.ok) {
            data = await response.json();
          }
        } catch (e) {
          console.error("Error fetching matching library details:", e);
        }
      } else {
        // Fallback: Query the single item locally first. If 404/NotFound or empty, we know it's external
        try {
          const response = await customFetch(`${API_BASE_URL}/${mediaType}/${targetId}`, { headers: getHeaders() });
          if (response.ok) {
            const temp = await response.json();
            if (temp && (temp.id || temp.animeId || temp.mangaId)) {
              data = temp;
              isExternal = false;
            }
          }
        } catch (e) {
          // Silent fallback to external
        }
      }

      // If not resolved locally, fetch external AniList/TMDB details
      if (!data) {
        isExternal = true;
        const formatQuery = formatParam ? `?format=${formatParam}` : '';
        try {
          const response = await customFetch(`${API_BASE_URL}/${mediaType}/anilist/${targetId}${formatQuery}`, { headers: getHeaders() });
          if (!response.ok) {
            showToast('Could not load details. Please try again later.', 'error');
            navigate(-1);
            return;
          }
          data = await response.json();
        } catch (error) {
          console.error("Error loading external details:", error);
          showToast('Error loading details.', 'error');
          navigate(-1);
          return;
        }
      }

      try {
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
            dataLancamento: data.dataLancamento,
            numEpisodiosTotal: data.episodes,
            numCapitulosTotal: data.chapters,
            temporada: data.season,
            ano: data.seasonYear,
            linksExternos: data.externalLinks ? JSON.stringify(data.externalLinks) : null,
            isExternal: true,
            formato: data.format,
            relations: data.relations
          };
          setSelectedItem(normalized);
        } else if (data) {
          const itemData = data.manga || data.anime || data;
          const localItem = { ...itemData, ...data, dbId: data.id, isExternal: false };
          if (!localItem.formato && localItem.tipo === 'FILME') {
            localItem.formato = 'MOVIE';
          }
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
        console.error("Error parsing details:", error);
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
        if (!localItem.formato && localItem.tipo === 'FILME') {
          localItem.formato = 'MOVIE';
        }
        setSelectedItem(localItem);

        if (mediaType === 'anime') {
          setAnimeLibraryData((prev: any[]) => [...prev, localItem]);
        } else {
          setMangaLibraryData((prev: any[]) => [...prev, localItem]);
        }

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
        if (mediaType === 'anime') {
          setAnimeLibraryData((prev: any[]) => prev.filter((item: any) => item.id !== targetId));
        } else {
          setMangaLibraryData((prev: any[]) => prev.filter((item: any) => item.id !== targetId));
        }
        const externalId = getMediaId();
        if (externalId) {
          navigate(`/details/${mediaType}/${externalId}?external=true`, { replace: true });
          setReloadTrigger((prev: number) => prev + 1);
        } else {
          navigate('/library');
        }
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
        const isFinished = selectedItem.statusLancamento === 'FINISHED';
        if (isFinished && totalAll && val >= totalAll) {
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

  const renderMovieVersion = () => {
    if (!selectedItem) return null;

    const isWatched = selectedItem.status === 'COMPLETED';

    return (
      <div className="w-full text-left space-y-6">
        {/* Back cover background gradient */}
        <div className="relative w-full rounded-[32px] overflow-hidden border border-white/5 bg-[#121214]/65 p-6 md:p-8 flex flex-col md:flex-row gap-8 shadow-2xl backdrop-blur-md animate-in fade-in duration-300">
          
          {/* BACKGROUND BLUR */}
          <img src={selectedItem.capaUrl} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-15 pointer-events-none" alt="" />
          
          {/* COLUNA ESQUERDA: Poster + Rating */}
          <div className="w-full md:w-[280px] flex-shrink-0 flex flex-col gap-5 relative z-10">
            {/* Poster Image */}
            <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10 group relative">
              <img src={selectedItem.capaUrl} className="w-full h-full object-cover" alt={selectedItem.titulo} />
            </div>

            {/* Rating Card */}
            <div className="bg-[#18181c]/90 border border-white/5 rounded-2xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md">
              <div className="flex flex-col items-center justify-center text-center py-2.5 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black text-white">
                    {overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A'}
                  </span>
                  <span className="text-xs text-on-surface-variant font-bold">/ 10</span>
                </div>
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
            </div>
          </div>

          {/* COLUNA DIREITA: Main Content (Synopsis & Tracking) */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 relative z-10">
            {/* Header info */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)] flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  FILME
                </span>
                {selectedItem.ano && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold border border-white/10 bg-[#18181c] text-gray-300">
                    {selectedItem.ano}
                  </span>
                )}
                {selectedItem.statusLancamento && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold border border-white/10 bg-[#18181c] text-gray-300 capitalize">
                    {selectedItem.statusLancamento === 'FINISHED' ? 'Finished' : selectedItem.statusLancamento.toLowerCase()}
                  </span>
                )}
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                {selectedItem.titulo}
              </h2>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {getGenresList(selectedItem.generos).map((g) => (
                <span key={g.name} className="px-3 py-1 bg-white/5 rounded-lg text-[11px] font-bold text-on-surface border border-white/10 tracking-wider">
                  {g.name}
                </span>
              ))}
            </div>

            {/* Unified Synopsis & Acompanhamento grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-white/5">
              {/* Sinopse */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-white">
                  <span className="material-symbols-outlined text-base text-amber-400">info</span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">Sinopse</h3>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed text-justify whitespace-pre-line">
                  {selectedItem.descricao || "Sem sinopse disponível."}
                </p>
              </div>

              {/* Acompanhamento */}
              <div className="space-y-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl h-fit">
                <div className="flex items-center gap-2 text-white">
                  <span className="material-symbols-outlined text-base text-amber-400">analytics</span>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider">Acompanhamento</h3>
                </div>

                {selectedItem.isExternal ? (
                  <div className="space-y-4">
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Este filme ainda não está na tua biblioteca. Adiciona-o para o poderes marcar como assistido.
                    </p>
                    <button 
                      type="button"
                      onClick={() => adicionarAoBanco(selectedItem.titulo, selectedItem.id, selectedItem.formato)} 
                      disabled={isAddingToLibrary}
                      className="w-full bg-primary hover:bg-primary/80 text-on-primary py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 cursor-pointer animate-pulse-glow"
                    >
                      {isAddingToLibrary ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>A ADICIONAR...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">add</span> <span>ADICIONAR À BIBLIOTECA</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest block">
                        Estado de Visualização
                      </label>
                      
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {/* Option 1: Não Assistido */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (isSavingDetailsProgress) return;
                            setIsSavingDetailsProgress(true);
                            await atualizarCampo({ status: 'PLANNED', epAtual: 0, epAtualGlobal: 0 });
                            setIsSavingDetailsProgress(false);
                          }}
                          disabled={isSavingDetailsProgress}
                          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                            selectedItem.status === 'PLANNED'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                              : 'bg-white/5 border-white/10 hover:border-white/20 text-on-surface-variant hover:text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">schedule</span>
                          <span>Não Assistido</span>
                        </button>

                        {/* Option 2: Assistido */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (isSavingDetailsProgress) return;
                            setIsSavingDetailsProgress(true);
                            await atualizarCampo({ status: 'COMPLETED', epAtual: 1, epAtualGlobal: 1 });
                            setIsSavingDetailsProgress(false);
                          }}
                          disabled={isSavingDetailsProgress}
                          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                            isWatched
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                              : 'bg-white/5 border-white/10 hover:border-white/20 text-on-surface-variant hover:text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                          <span>Assistido</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/5">
                      {showDeleteConfirm ? (
                        <div className="p-4 rounded-2xl bg-error/10 border border-error/30 animate-in fade-in zoom-in-95 duration-300 space-y-3 text-left">
                          <div className="flex items-center gap-2.5 text-error">
                            <span className="material-symbols-outlined text-lg">warning</span>
                            <h5 className="font-bold text-sm">Remover Filme</h5>
                          </div>
                          <p className="text-xs text-on-surface-variant font-medium">
                            Remover <span className="text-white font-bold">{selectedItem.titulo}</span> da biblioteca?
                          </p>
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={() => setShowDeleteConfirm(false)} 
                              disabled={isCheckingLists}
                              className="flex-1 py-2 bg-surface-variant hover:bg-surface-variant/80 text-on-surface-variant rounded-xl font-bold text-xs border border-white/10 disabled:opacity-50 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="button"
                              onClick={handleRemoveFromLibraryClick} 
                              disabled={isCheckingLists}
                              className="flex-1 py-2 bg-error hover:bg-error/80 text-on-error rounded-xl font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {isCheckingLists && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                              Sim, Remover
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)} 
                          className="w-full bg-error/10 hover:bg-error text-error hover:text-on-error py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs border border-error/20 active:scale-95 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          REMOVER DA BIBLIOTECA
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Relations */}
            {selectedItem.relations && selectedItem.relations.edges && selectedItem.relations.edges.length > 0 && (
              <div className="pt-6 border-t border-white/5 space-y-4">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-white">Conteúdos Relacionados</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {selectedItem.relations.edges.map((edge: any) => (
                    <a 
                      key={edge.node.id} 
                      href={`/details/anime/${edge.node.id}?external=true`}
                      className="glass-panel p-2 rounded-xl border border-white/5 hover:border-white/10 transition-all flex flex-col gap-2 group min-w-0"
                    >
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 relative">
                        <img src={edge.node.coverImage?.large} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 animate-fade-in" alt={edge.node.title?.userPreferred} />
                      </div>
                      <span className="text-[10px] font-bold text-white truncate block">{edge.node.title?.userPreferred}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <CommentsSection
              overallRating={overallRating}
              mediaType={mediaType as 'anime' | 'manga'}
              isMobile={isMobile}
              token={token}
              userRating={userRating}
              votarConteudo={votarConteudo}
              isSubmittingRating={isSubmittingRating}
              user={user}
              newCommentText={newCommentText}
              setNewCommentText={setNewCommentText}
              enviarComentario={enviarComentario}
              isSubmittingComment={isSubmittingComment}
              loadingComments={loadingComments}
              comments={comments}
              abrirPerfilExterno={abrirPerfilExterno}
              eliminarComentario={eliminarComentario}
              gostarComentario={gostarComentario}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderDesktopVersion = () => {
    if (!selectedItem) return null;

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
            {selectedItem.formato !== 'MOVIE' && (
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
            )}

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
                  Nível de Prioridade
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
                          <span>{currentPriorityOpt.label} - {t(currentPriorityOpt.desc)}</span>
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
                                    <span>{p.label} - {t(p.desc)}</span>
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
                  {selectedItem.isExternal ? 'Novo' : `#${selectedItem.prioridade}`}
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
              <TrackingTab
                selectedItem={selectedItem}
                mediaType={mediaType as 'anime' | 'manga'}
                isMobile={false}
                isAddingToLibrary={isAddingToLibrary}
                adicionarAoBanco={adicionarAoBanco}
                TRACKING_STATUS_OPTIONS={TRACKING_STATUS_OPTIONS}
                atualizarCampo={atualizarCampo}
                setShowPriorityModal={setShowPriorityModal}
                viewedSeason={viewedSeason}
                setViewedSeason={setViewedSeason}
                getEpisodesCountForSeason={getEpisodesCountForSeason}
                isSavingDetailsProgress={isSavingDetailsProgress}
                totalEpisodesAllSeasons={totalEpisodesAllSeasons}
                totalAiredEpisodes={totalAiredEpisodes}
                showToast={showToast}
                atualizarProgresso={atualizarProgresso}
                showEpList={showEpList}
                setShowEpList={setShowEpList}
                viewedEpisodes={seasonEpisodes}
                loadingEpisodes={loadingEpisodes}
                getGlobalEpisodeNumber={getGlobalEpisodeNumber}
                lastAiredEpNumber={lastAiredEpNumber}
                latestChapter={latestChapter}
                handleOpenListsModal={handleOpenListsModal}
                showDeleteConfirm={showDeleteConfirm}
                setShowDeleteConfirm={setShowDeleteConfirm}
                isCheckingLists={isCheckingLists}
                handleRemoveFromLibraryClick={handleRemoveFromLibraryClick}
                newLinkSite={newLinkSite}
                setNewLinkSite={setNewLinkSite}
                newLinkUrl={newLinkUrl}
                setNewLinkUrl={setNewLinkUrl}
                showAddLink={showAddLink}
                setShowAddLink={setShowAddLink}
                adicionarLinkPessoal={adicionarLinkPessoal}
                eliminarLinkPessoal={eliminarLinkPessoal}
                abrirLink={abrirLink}
                t={t}
              />
            ) : (
              <InfoTab
                selectedItem={selectedItem}
                mediaType={mediaType as 'anime' | 'manga'}
                loadingLatest={loadingLatest}
                latestChapter={latestChapter}
                latestChapterSource={latestChapterSource}
                latestChapterError={latestChapterError}
                latestBreakdown={latestBreakdown}
                showAddLink={showAddLink}
                setShowAddLink={setShowAddLink}
                newLinkSite={newLinkSite}
                setNewLinkSite={setNewLinkSite}
                newLinkUrl={newLinkUrl}
                setNewLinkUrl={setNewLinkUrl}
                adicionarLinkPessoal={adicionarLinkPessoal}
                abrirLink={abrirLink}
                overallRating={overallRating}
                totalEpisodesAllSeasons={totalEpisodesAllSeasons}
              />
            )}

            <CommentsSection
              overallRating={overallRating}
              mediaType={mediaType as 'anime' | 'manga'}
              isMobile={false}
              token={token}
              userRating={userRating}
              votarConteudo={votarConteudo}
              isSubmittingRating={isSubmittingRating}
              user={user}
              newCommentText={newCommentText}
              setNewCommentText={setNewCommentText}
              enviarComentario={enviarComentario}
              isSubmittingComment={isSubmittingComment}
              loadingComments={loadingComments}
              comments={comments}
              abrirPerfilExterno={abrirPerfilExterno}
              eliminarComentario={eliminarComentario}
              gostarComentario={gostarComentario}
            />
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
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-4 md:py-8 pb-32">
      <div className="animate-in fade-in slide-in-from-left-4 duration-500">
        <button onClick={() => navigate(-1)} className={`mb-10 flex items-center gap-2 px-5 py-2.5 rounded-full glass-panel border border-white/10 text-on-surface-variant hover:text-white transition-all group font-bold shadow-lg ${mediaType === 'anime' ? 'hover:border-secondary/50 hover:shadow-[0_0_15px_rgba(194,24,91,0.3)]' : 'hover:border-primary/50 hover:shadow-[0_0_15px_rgba(106,27,154,0.3)]'}`}>
          <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
          {t("Voltar")}
        </button>

        {selectedItem && (
          selectedItem.formato === 'MOVIE' ? (
            renderMovieVersion()
          ) : isMobile ? (
            /* VERSÃO ANDROID NATIVA: Reorganizada em cartões verticais independentes, sem aninhamento duplo e com aba dedicada para Comentários */
            <div className="w-full flex flex-col gap-4 text-left animate-in fade-in duration-300">
              
              {/* CARTÃO DO CABEÇALHO (Hero Header Card) */}
              <div className={`relative w-full rounded-[28px] overflow-hidden border bg-[#121214]/65 p-4 flex flex-col gap-4 shadow-xl backdrop-blur-md ${
                mediaType === 'anime' ? 'border-secondary/20 shadow-lg' : 'border-primary/20 shadow-lg'
              }`}>
                {/* BACKGROUND COVER BLUR */}
                <img src={selectedItem.capaUrl} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-15 pointer-events-none z-0" alt="" />
                
                {/* Capa & Título Info */}
                <div className="flex gap-4 items-start relative z-10">
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

                {/* Géneros */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5 relative z-10">
                  {getGenresList(selectedItem.generos).map((g) => (
                    <span key={g.name} className={`px-3 py-1 bg-white/5 rounded-lg text-[11px] font-bold text-on-surface border tracking-wider flex items-center gap-1 ${mediaType === 'anime' ? 'border-secondary/30' : 'border-primary/30'}`}>
                      {g.name}
                    </span>
                  ))}
                </div>

                {/* Info Grid: Status, Season, Total Episodes/Chapters, Nota Geral */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5 relative z-10">
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
                    <p className="text-on-surface-variant text-[8px] uppercase font-bold tracking-widest mb-1 truncate w-full">
                      {selectedItem.formato === 'MOVIE' ? 'Format' : 'Season'}
                    </p>
                    <p className="font-bold text-xs text-white capitalize truncate w-full">
                      {selectedItem.formato === 'MOVIE' ? 'Movie' : (selectedItem.temporada ? `${selectedItem.temporada.toLowerCase()} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A')}
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
              </div>

              {/* TABS SWITCHER (Standalone Segmented Control) */}
              <div className="flex border border-white/5 bg-[#121214]/40 backdrop-blur-md rounded-2xl p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('tracking')}
                  className={`flex-1 py-3 text-[10px] font-black transition-all flex items-center justify-center gap-1.5 rounded-xl ${
                    activeTab === 'tracking'
                      ? (mediaType === 'anime' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/20 text-secondary border border-secondary/30')
                      : 'text-on-surface-variant hover:text-white border border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">analytics</span>
                  ACOMPANHAMENTO
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className={`flex-1 py-3 text-[10px] font-black transition-all flex items-center justify-center gap-1.5 rounded-xl ${
                    activeTab === 'info'
                      ? (mediaType === 'anime' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/20 text-secondary border border-secondary/30')
                      : 'text-on-surface-variant hover:text-white border border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">info</span>
                  SINOPSE
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`flex-1 py-3 text-[10px] font-black transition-all flex items-center justify-center gap-1.5 rounded-xl ${
                    activeTab === 'comments'
                      ? (mediaType === 'anime' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/20 text-secondary border border-secondary/30')
                      : 'text-on-surface-variant hover:text-white border border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">forum</span>
                  COMENTÁRIOS
                </button>
              </div>

              {/* TAB CONTENT: Tracking */}
              {activeTab === 'tracking' && (
                <TrackingTab
                  selectedItem={selectedItem}
                  mediaType={mediaType as 'anime' | 'manga'}
                  isMobile={isMobile}
                  isAddingToLibrary={isAddingToLibrary}
                  adicionarAoBanco={adicionarAoBanco}
                  TRACKING_STATUS_OPTIONS={TRACKING_STATUS_OPTIONS}
                  atualizarCampo={atualizarCampo}
                  setShowPriorityModal={setShowPriorityModal}
                  viewedSeason={viewedSeason}
                  setViewedSeason={setViewedSeason}
                  getEpisodesCountForSeason={getEpisodesCountForSeason}
                  isSavingDetailsProgress={isSavingDetailsProgress}
                  totalEpisodesAllSeasons={totalEpisodesAllSeasons}
                  totalAiredEpisodes={totalAiredEpisodes}
                  showToast={showToast}
                  atualizarProgresso={atualizarProgresso}
                  showEpList={showEpList}
                  setShowEpList={setShowEpList}
                  viewedEpisodes={seasonEpisodes}
                  loadingEpisodes={loadingEpisodes}
                  getGlobalEpisodeNumber={getGlobalEpisodeNumber}
                  lastAiredEpNumber={lastAiredEpNumber}
                  latestChapter={latestChapter}
                  handleOpenListsModal={handleOpenListsModal}
                  showDeleteConfirm={showDeleteConfirm}
                  setShowDeleteConfirm={setShowDeleteConfirm}
                  isCheckingLists={isCheckingLists}
                  handleRemoveFromLibraryClick={handleRemoveFromLibraryClick}
                  newLinkSite={newLinkSite}
                  setNewLinkSite={setNewLinkSite}
                  newLinkUrl={newLinkUrl}
                  setNewLinkUrl={setNewLinkUrl}
                  showAddLink={showAddLink}
                  setShowAddLink={setShowAddLink}
                  adicionarLinkPessoal={adicionarLinkPessoal}
                  eliminarLinkPessoal={eliminarLinkPessoal}
                  abrirLink={abrirLink}
                  t={t}
                />
              )}

              {/* TAB CONTENT: Info / Synopsis */}
              {activeTab === 'info' && (
                <div className={`glass-panel rounded-[28px] border p-5 bg-[#121214]/65 shadow-xl backdrop-blur-md ${
                  mediaType === 'anime' ? 'border-secondary/20 shadow-lg' : 'border-primary/20 shadow-lg'
                }`}>
                  <InfoTab
                    selectedItem={selectedItem}
                    mediaType={mediaType as 'anime' | 'manga'}
                    loadingLatest={loadingLatest}
                    latestChapter={latestChapter}
                    latestChapterSource={latestChapterSource}
                    latestChapterError={latestChapterError}
                    latestBreakdown={latestBreakdown}
                    showAddLink={showAddLink}
                    setShowAddLink={setShowAddLink}
                    newLinkSite={newLinkSite}
                    setNewLinkSite={setNewLinkSite}
                    newLinkUrl={newLinkUrl}
                    setNewLinkUrl={setNewLinkUrl}
                    adicionarLinkPessoal={adicionarLinkPessoal}
                    abrirLink={abrirLink}
                    overallRating={overallRating}
                    totalEpisodesAllSeasons={totalEpisodesAllSeasons}
                    isMobile={true}
                  />
                </div>
              )}

              {/* TAB CONTENT: Comments */}
              {activeTab === 'comments' && (
                <div className={`glass-panel rounded-[28px] border p-5 bg-[#121214]/65 shadow-xl backdrop-blur-md ${
                  mediaType === 'anime' ? 'border-secondary/20 shadow-lg' : 'border-primary/20 shadow-lg'
                }`}>
                  <CommentsSection
                    overallRating={overallRating}
                    mediaType={mediaType as 'anime' | 'manga'}
                    isMobile={isMobile}
                    token={token}
                    userRating={userRating}
                    votarConteudo={votarConteudo}
                    isSubmittingRating={isSubmittingRating}
                    user={user}
                    newCommentText={newCommentText}
                    setNewCommentText={setNewCommentText}
                    enviarComentario={enviarComentario}
                    isSubmittingComment={isSubmittingComment}
                    loadingComments={loadingComments}
                    comments={comments}
                    abrirPerfilExterno={abrirPerfilExterno}
                    eliminarComentario={eliminarComentario}
                    gostarComentario={gostarComentario}
                  />
                </div>
              )}

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

            <CustomListsModal
        showListsModal={showListsModal}
        setShowListsModal={setShowListsModal}
        selectedItem={selectedItem}
        mediaType={mediaType as 'anime' | 'manga'}
        loadingLists={loadingLists}
        lists={lists}
        getMediaId={getMediaId}
        toggleItemInList={toggleItemInList}
        navigate={navigate}
        showPriorityModal={showPriorityModal}
        setShowPriorityModal={setShowPriorityModal}
        atualizarCampo={atualizarCampo}
        t={t}
        showListRemovalConfirm={showListRemovalConfirm}
        setShowListRemovalConfirm={setShowListRemovalConfirm}
        listsWithMedia={listsWithMedia}
        isDeletingFromLists={isDeletingFromLists}
        handleRemoveFromEverything={handleRemoveFromEverything}
        handleRemoveFromLibraryOnly={handleRemoveFromLibraryOnly}
      />
      
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
