import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useTranslation } from '../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import MediaCard from '../components/MediaCard';
import { 
  RefreshCw, X, Grid, Tag, ChevronDown, ChevronUp, Check, SlidersHorizontal, ArrowUpDown, Plus
} from 'lucide-react';

interface GenreTag {
  id: number;
  name: string;
  type: 'GENRE' | 'TAG';
  category: string;
  subcategory: string;
  isAdult: boolean;
  isExposed: boolean;
}

interface ExploreMedia {
  id: number;
  title: {
    english?: string;
    romaji?: string;
    native?: string;
  };
  coverImage: {
    large: string;
  };
  genres: string[];
  averageScore?: number;
  episodes?: number;
  chapters?: number;
  status?: string;
  format?: string;
}

const ExplorePage = () => {
  const { token, user } = useAuth();
  const { categoria } = useMedia();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Metadata & Library States
  const [metadata, setMetadata] = useState<GenreTag[]>([]);
  const [localLibraryIds, setLocalLibraryIds] = useState<Set<number>>(new Set());
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  // Search Results State
  const [results, setResults] = useState<ExploreMedia[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters State (AniList style)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [year, setYear] = useState('Any');
  const [season, setSeason] = useState('Any');
  const [format, setFormat] = useState('Any');
  const [country, setCountry] = useState('Any');
  
  // Advanced Filters State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [airingStatus, setAiringStatus] = useState('Any');
  const [sourceMaterial, setSourceMaterial] = useState('Any');
  const [hideMyLibrary, setHideMyLibrary] = useState(false);
  const [onlyShowMyLibrary, setOnlyShowMyLibrary] = useState(false);

  // Sorting State
  const [sortOrder, setSortOrder] = useState('RECOMMENDED');

  // If user selects genres or tags while sortOrder is 'RECOMMENDED', automatically switch to 'TRENDING_DESC'
  useEffect(() => {
    if (sortOrder === 'RECOMMENDED' && (selectedGenres.length > 0 || selectedTags.length > 0)) {
      setSortOrder('TRENDING_DESC');
    }
  }, [selectedGenres, selectedTags, sortOrder]);

  // Modal / Dropdown UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const genreDropdownRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [collapsedSubcats, setCollapsedSubcats] = useState<Record<string, boolean>>({});

  // Refs to preserve state
  const isRestoringRef = useRef(false);
  const prevCategoryRef = useRef<string | null>(null);
  const stateRef = useRef<any>(null);

  // Fetch metadata on mount
  const fetchMetadata = async () => {
    setLoadingMetadata(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/anime/genres-and-tags?type=${categoria.toUpperCase()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMetadata(data);
      }
    } catch (error) {
      console.error("Error loading metadata:", error);
    } finally {
      setLoadingMetadata(false);
    }
  };

  // Fetch user local library to support library filtering
  const fetchLocalLibrary = async () => {
    try {
      const endpoint = categoria === 'anime' ? '/anime' : '/manga';
      const res = await customFetch(`${API_BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Extract IDs depending on the shape of UserAnime / UserManga
        const ids = new Set<number>(data.map((item: any) => item.animeId || item.mangaId || item.id));
        setLocalLibraryIds(ids);
      }
    } catch (e) {
      console.error("Error fetching library:", e);
    }
  };

  // Fetch results from backend explore
  const fetchResults = async (resetPage = false) => {
    setLoadingResults(true);
    const targetPage = resetPage ? 1 : page;

    try {
      const genresParam = selectedGenres.length > 0 ? encodeURIComponent(selectedGenres.join(',')) : '';
      const tagsParam = selectedTags.length > 0 ? encodeURIComponent(selectedTags.join(',')) : '';
      const typeParam = categoria.toUpperCase(); // 'ANIME' or 'MANGA'
      
      let url = `${API_BASE_URL}/anime/explore?type=${typeParam}&genres=${genresParam}&tags=${tagsParam}&sort=${sortOrder}&page=${targetPage}`;
      
      if (categoria === 'anime') {
        if (year !== 'Any') url += `&year=${year}`;
        if (season !== 'Any') url += `&season=${season}`;
      }
      if (format !== 'Any') url += `&format=${format}`;
      if (categoria === 'manga') {
        if (airingStatus !== 'Any') url += `&status=${airingStatus}`;
        if (country !== 'Any') url += `&country=${country}`;
      } else {
        if (airingStatus !== 'Any') url += `&status=${airingStatus}`;
      }
      if (sourceMaterial !== 'Any') url += `&source=${sourceMaterial}`;

      const res = await customFetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = (await res.json()) as ExploreMedia[];

        if (resetPage) {
          setResults(data);
          setPage(1);
        } else {
          setResults(prev => [...prev, ...data]);
        }
        setHasMore(data.length === 24);
      }
    } catch (error) {
      console.error("Error loading explore results:", error);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [token, categoria]);

  useEffect(() => {
    fetchLocalLibrary();
  }, [categoria, token]);

  // Clear saved explore state if not returning from details page
  useEffect(() => {
    const prevPath = sessionStorage.getItem('otaku_prev_path') || '';
    const cameFromDetails = prevPath.startsWith('/details/');
    console.log("[Explore] Mounted. prevPath:", prevPath, "cameFromDetails:", cameFromDetails);
    if (!cameFromDetails) {
      console.log("[Explore] Clearing saved states because we did not come from Details.");
      sessionStorage.removeItem('otaku_explore_state_anime');
      sessionStorage.removeItem('otaku_explore_state_manga');
    }
  }, []);

  // Keep stateRef updated with the latest state
  useEffect(() => {
    stateRef.current = {
      categoria,
      selectedGenres,
      selectedTags,
      year,
      season,
      format,
      country,
      airingStatus,
      sourceMaterial,
      hideMyLibrary,
      onlyShowMyLibrary,
      sortOrder,
      page,
      results,
      loadingMetadata,
      scrollPosition: window.scrollY
    };
  }, [
    categoria,
    selectedGenres,
    selectedTags,
    year,
    season,
    format,
    country,
    airingStatus,
    sourceMaterial,
    hideMyLibrary,
    onlyShowMyLibrary,
    sortOrder,
    page,
    results,
    loadingMetadata
  ]);

  // Save state on unmount
  useEffect(() => {
    return () => {
      if (stateRef.current) {
        if (!stateRef.current.loadingMetadata) {
          stateRef.current.scrollPosition = window.scrollY;
          const activeCat = stateRef.current.categoria;
          console.log("[Explore] Component unmounting. Saving state for:", activeCat, stateRef.current);
          sessionStorage.setItem(`otaku_explore_state_${activeCat}`, JSON.stringify(stateRef.current));
        } else {
          console.log("[Explore] Component unmounting but metadata is still loading. Skipping save to prevent overwriting.");
        }
      }
    };
  }, []);

  // Handle category switch and state restoration
  useEffect(() => {
    if (loadingMetadata) {
      console.log("[Explore] metadata still loading, skipping restore");
      return;
    }

    // 1. Save previous category state if it's changing
    if (prevCategoryRef.current && prevCategoryRef.current !== categoria) {
      if (stateRef.current) {
        stateRef.current.scrollPosition = window.scrollY;
        console.log("[Explore] Category changing. Saving state for:", prevCategoryRef.current, stateRef.current);
        sessionStorage.setItem(`otaku_explore_state_${prevCategoryRef.current}`, JSON.stringify(stateRef.current));
      }
    }
    prevCategoryRef.current = categoria;

    // 2. Try to load the state for the new category
    const saved = sessionStorage.getItem(`otaku_explore_state_${categoria}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        console.log("[Explore] Found saved state for:", categoria, state);
        
        isRestoringRef.current = true;
        
        setSelectedGenres(state.selectedGenres || []);
        setSelectedTags(state.selectedTags || []);
        setYear(state.year || 'Any');
        setSeason(state.season || 'Any');
        setFormat(state.format || 'Any');
        setCountry(state.country || 'Any');
        setAiringStatus(state.airingStatus || 'Any');
        setSourceMaterial(state.sourceMaterial || 'Any');
        setHideMyLibrary(state.hideMyLibrary || false);
        setOnlyShowMyLibrary(state.onlyShowMyLibrary || false);
        setSortOrder(state.sortOrder || 'TRENDING_DESC');
        setPage(state.page || 1);
        setResults(state.results || []);
        
        // Restore scroll position after React renders the cards
        setTimeout(() => {
          console.log("[Explore] Restoring scroll position to:", state.scrollPosition);
          window.scrollTo(0, state.scrollPosition || 0);
          isRestoringRef.current = false;
        }, 150);
        
        return; // Skip default fetching
      } catch (e) {
        console.error("[Explore] Error restoring state:", e);
      }
    }

    console.log("[Explore] No state saved. Performing default search for:", categoria);
    // If no state was restored, perform a clean default search
    setSelectedGenres([]);
    setSelectedTags([]);
    setYear('Any');
    setSeason('Any');
    setFormat('Any');
    setAiringStatus('Any');
    setCountry('Any');
    setSourceMaterial('Any');
    setHideMyLibrary(false);
    setOnlyShowMyLibrary(false);
    setSortOrder('RECOMMENDED');
    setPage(1);
    setResults([]);
    fetchResults(true);

  }, [categoria, loadingMetadata]);

  // Handle click outside to close custom genre dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(event.target as Node)) {
        setIsGenreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Trigger search when sort order changes
  useEffect(() => {
    if (!loadingMetadata) {
      if (isRestoringRef.current) return;
      fetchResults(true);
    }
  }, [sortOrder]);

  // Handle load more
  const handleLoadMore = () => {
    if (!loadingResults && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (page > 1) {
      if (isRestoringRef.current) return;
      fetchResults(false);
    }
  }, [page]);

  const showAdultSettings = user?.showAdultContent === true;

  // Filter allowed metadata based on adult settings
  const allowedMetadata = metadata.filter(m => showAdultSettings || !m.isAdult);
  const genresList = allowedMetadata.filter(m => m.type === 'GENRE');
  const tagsList = allowedMetadata.filter(m => m.type === 'TAG');

  // Grouped tags for modal
  const groupedTags: Record<string, Record<string, GenreTag[]>> = {};
  tagsList.forEach(tag => {
    if (!groupedTags[tag.category]) {
      groupedTags[tag.category] = {};
    }
    if (!groupedTags[tag.category][tag.subcategory]) {
      groupedTags[tag.category][tag.subcategory] = [];
    }
    groupedTags[tag.category][tag.subcategory].push(tag);
  });

  const categories = Object.keys(groupedTags);
  const currentActive = categories.includes(activeCategory) ? activeCategory : (categories[0] || '');

  const getSelectedCount = (cat: string) => {
    const tagsInCat = groupedTags[cat]
      ? Object.values(groupedTags[cat]).flat().map(t => t.name)
      : [];
    return selectedTags.filter(t => tagsInCat.includes(t)).length;
  };

  const toggleSubcat = (subcatKey: string) => {
    setCollapsedSubcats(prev => ({
      ...prev,
      [subcatKey]: !prev[subcatKey]
    }));
  };

  // Toggle selected genre
  const handleToggleGenre = (genreName: string) => {
    setSelectedGenres(prev => {
      if (prev.includes(genreName)) {
        return prev.filter(g => g !== genreName);
      } else {
        return [...prev, genreName];
      }
    });
  };

  // Clear selected genres
  const handleClearGenres = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGenres([]);
  };

  // Toggle tag selection
  const handleToggleTag = (tagName: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagName)) {
        return prev.filter(t => t !== tagName);
      } else {
        return [...prev, tagName];
      }
    });
  };

  // Apply local library filters in frontend
  const filteredResults = results.filter(item => {
    const inLibrary = localLibraryIds.has(item.id);
    if (onlyShowMyLibrary && !inLibrary) return false;
    if (hideMyLibrary && inLibrary) return false;
    return true;
  });

  // Generate Year Options
  const currentYear = new Date().getFullYear();
  const yearOptions = ['Any'];
  for (let y = currentYear + 1; y >= 1970; y--) {
    yearOptions.push(String(y));
  }

  const formatOptions = categoria === 'anime' 
    ? [
        { value: 'Any', label: t('Qualquer') },
        { value: 'TV', label: t('TV') },
        { value: 'TV_SHORT', label: t('TV Curta') },
        { value: 'MOVIE', label: t('Filme') },
        { value: 'SPECIAL', label: t('Especial') },
        { value: 'OVA', label: t('OVA') },
        { value: 'ONA', label: t('ONA') },
        { value: 'MUSIC', label: t('Música') },
      ]
    : [
        { value: 'Any', label: t('Qualquer') },
        { value: 'MANGA', label: t('Manga') },
        { value: 'NOVEL', label: t('Novel') },
        { value: 'ONE_SHOT', label: t('One-shot') },
      ];

  const countryOptions = [
    { value: 'Any', label: t('Qualquer') },
    { value: 'JP', label: t('Japão') },
    { value: 'KR', label: t('Coreia do Sul') },
    { value: 'CN', label: t('China') },
    { value: 'TW', label: t('Taiwan') },
  ];

  const statusOptions = [
    { value: 'Any', label: t('Qualquer') },
    { value: 'FINISHED', label: t('Terminado') },
    { value: 'RELEASING', label: t('Em Lançamento') },
    { value: 'NOT_YET_RELEASED', label: t('Não Lançado') },
    { value: 'CANCELLED', label: t('Cancelado') },
    { value: 'HIATUS', label: t('Hiato') },
  ];

  // Handle card click
  const handleCardClick = (id: number, format?: string) => {
    if (stateRef.current) {
      stateRef.current.scrollPosition = window.scrollY;
      const activeCat = stateRef.current.categoria;
      console.log("[Explore] Card clicked. Saving state for:", activeCat, stateRef.current);
      sessionStorage.setItem(`otaku_explore_state_${activeCat}`, JSON.stringify(stateRef.current));
    }
    const formatQuery = format ? `&format=${format}` : '';
    navigate(`/details/${categoria}/${id}?external=true${formatQuery}`);
  };



  return (
    <div className="p-4 md:p-8 min-h-screen bg-background text-on-background max-w-full overflow-hidden flex flex-col gap-6">
      
      {/* 1. Filter Bar (AniList Style) */}
      <div className="bg-surface-container-low rounded-2xl p-5 border border-border-glass shadow-xl flex flex-col gap-4">
        
        {/* Row 1: Quick Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 items-end gap-4 relative">
          
          {/* A. Genres Multiselect Dropdown */}
          <div className="flex flex-col gap-2" ref={genreDropdownRef}>
            <label className="text-xs font-bold text-on-surface-variant">{t("Géneros")}</label>
            <div className="relative">
              <button
                onClick={() => setIsGenreDropdownOpen(!isGenreDropdownOpen)}
                className="w-full flex items-center justify-between bg-surface-container border border-border-glass hover:border-white/10 rounded-xl px-4 py-3 text-xs text-white font-semibold focus:outline-none transition-all shadow-md text-left min-h-[44px]"
              >
                <div className="truncate flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                  {selectedGenres.length === 0 ? (
                    <span className="text-white/40">{t("Qualquer")}</span>
                  ) : (
                    <>
                      <span className="bg-primary/20 text-primary-light px-2 py-0.5 rounded text-[11px] font-semibold border border-primary/20 truncate">
                        {selectedGenres[0]}
                      </span>
                      {selectedGenres.length > 1 && (
                        <span className="bg-white/5 text-white/60 px-1.5 py-0.5 rounded text-[10px]">
                          +{selectedGenres.length - 1}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {selectedGenres.length > 0 && (
                    <span 
                      onClick={handleClearGenres}
                      className="p-0.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </span>
                  )}
                  <ChevronDown size={14} className={`text-on-surface-variant transition-transform ${isGenreDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Genre Popup List */}
              {isGenreDropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 z-50 bg-surface-container border border-border-glass rounded-2xl shadow-2xl p-3 max-h-60 overflow-y-auto no-scrollbar flex flex-col gap-1">
                  {genresList.map(genre => {
                    const isSelected = selectedGenres.includes(genre.name);
                    return (
                      <button
                        key={genre.id}
                        onClick={() => handleToggleGenre(genre.name)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                          isSelected
                            ? 'bg-primary/20 text-primary-light'
                            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-white'
                        }`}
                      >
                        <span>{genre.name}</span>
                        {isSelected && <Check size={14} className="text-primary-light" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Conditional Filters depending on Anime vs Manga */}
          {categoria === 'anime' ? (
            <>
              {/* B. Year Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant">{t("Ano")}</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-surface-container border border-border-glass rounded-xl px-4 py-3 text-xs text-white font-semibold focus:outline-none transition-all shadow-md min-h-[44px] cursor-pointer"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y} className="bg-surface-dim text-white">{y === 'Any' ? t('Qualquer') : y}</option>
                  ))}
                </select>
              </div>

              {/* C. Season Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant">{t("Estação")}</label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full bg-surface-container border border-border-glass rounded-xl px-4 py-3 text-xs text-white font-semibold focus:outline-none transition-all shadow-md min-h-[44px] cursor-pointer"
                >
                  <option value="Any" className="bg-surface-dim text-white">{t("Qualquer")}</option>
                  <option value="WINTER" className="bg-surface-dim text-white">{t("Inverno")}</option>
                  <option value="SPRING" className="bg-surface-dim text-white">{t("Primavera")}</option>
                  <option value="SUMMER" className="bg-surface-dim text-white">{t("Verão")}</option>
                  <option value="FALL" className="bg-surface-dim text-white">{t("Outono")}</option>
                </select>
              </div>

              {/* D. Format Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant">{t("Formato")}</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-surface-container border border-border-glass rounded-xl px-4 py-3 text-xs text-white font-semibold focus:outline-none transition-all shadow-md min-h-[44px] cursor-pointer"
                >
                  {formatOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-surface-dim text-white">{opt.label}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              {/* B. Format Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant">{t("Formato")}</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-surface-container border border-border-glass rounded-xl px-4 py-3 text-xs text-white font-semibold focus:outline-none transition-all shadow-md min-h-[44px] cursor-pointer"
                >
                  {formatOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-surface-dim text-white">{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* C. Publishing Status Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant">{t("Estado de Publicação")}</label>
                <select
                  value={airingStatus}
                  onChange={(e) => setAiringStatus(e.target.value)}
                  className="w-full bg-surface-container border border-border-glass rounded-xl px-4 py-3 text-xs text-white font-semibold focus:outline-none transition-all shadow-md min-h-[44px] cursor-pointer"
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-surface-dim text-white">{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* D. Country Of Origin Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant">{t("País de Origem")}</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-surface-container border border-border-glass rounded-xl px-4 py-3 text-xs text-white font-semibold focus:outline-none transition-all shadow-md min-h-[44px] cursor-pointer"
                >
                  {countryOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-surface-dim text-white">{opt.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* E. Controls Column (Filter Button + Advanced Toggle) */}
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => fetchResults(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/80 text-xs font-bold text-on-primary transition-all px-4 h-[44px] shadow-md shadow-primary/20 cursor-pointer flex-1 animate-fade-in"
              title={t("Filtrar")}
            >
              <span>{t("Filtrar")}</span>
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center justify-center rounded-xl border p-3 hover:bg-white/5 transition-all h-[44px] min-w-[44px] cursor-pointer ${
                showAdvanced
                  ? 'bg-primary/20 border-primary/40 text-primary-light shadow-md'
                  : 'bg-surface-container border-border-glass text-on-surface-variant hover:text-white'
              }`}
              title={t("Filtros Avançados")}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

        </div>

        {/* Row 2: Advanced Filters (Expandable) */}
        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-border-glass pt-4 animate-slide-down">
            
            {/* Status Dropdown (Anime only - for Manga it is a Quick Filter) */}
            {categoria === 'anime' && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant">{t("Estado de Exibição")}</label>
                <select
                  value={airingStatus}
                  onChange={(e) => setAiringStatus(e.target.value)}
                  className="w-full bg-surface-container border border-border-glass rounded-xl px-4 py-2.5 text-xs text-white font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="Any" className="bg-surface-dim text-white">{t("Qualquer")}</option>
                  <option value="FINISHED" className="bg-surface-dim text-white">{t("Terminado")}</option>
                  <option value="RELEASING" className="bg-surface-dim text-white">{t("Em Lançamento")}</option>
                  <option value="NOT_YET_RELEASED" className="bg-surface-dim text-white">{t("Não Lançado")}</option>
                  <option value="CANCELLED" className="bg-surface-dim text-white">{t("Cancelado")}</option>
                  <option value="HIATUS" className="bg-surface-dim text-white">{t("Hiato")}</option>
                </select>
              </div>
            )}

            {/* Source Material Dropdown */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface-variant">{t("Material de Origem")}</label>
              <select
                value={sourceMaterial}
                onChange={(e) => setSourceMaterial(e.target.value)}
                className="w-full bg-surface-container border border-border-glass rounded-xl px-4 py-2.5 text-xs text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="Any" className="bg-surface-dim text-white">{t("Qualquer")}</option>
                <option value="ORIGINAL" className="bg-surface-dim text-white">{t("Original")}</option>
                <option value="MANGA" className="bg-surface-dim text-white">{t("Manga")}</option>
                <option value="LIGHT_NOVEL" className="bg-surface-dim text-white">{t("Light Novel")}</option>
                <option value="VISUAL_NOVEL" className="bg-surface-dim text-white">{t("Visual Novel")}</option>
                <option value="VIDEO_GAME" className="bg-surface-dim text-white">{t("Video Game")}</option>
                <option value="OTHER" className="bg-surface-dim text-white">{t("Outro")}</option>
              </select>
            </div>

            {/* Local Library Checkboxes */}
            <div className="flex flex-col gap-3 justify-end h-full py-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-white/80 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={onlyShowMyLibrary} 
                  onChange={(e) => {
                    setOnlyShowMyLibrary(e.target.checked);
                    if (e.target.checked) setHideMyLibrary(false);
                  }}
                  className="rounded bg-surface-container border border-border-glass text-primary focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                <span>{categoria === 'anime' ? t("Apenas os meus Animes") : t("Apenas os meus Mangas")}</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-white/80 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={hideMyLibrary} 
                  onChange={(e) => {
                    setHideMyLibrary(e.target.checked);
                    if (e.target.checked) setOnlyShowMyLibrary(false);
                  }}
                  className="rounded bg-surface-container border border-border-glass text-primary focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                <span>{categoria === 'anime' ? t("Ocultar os meus Animes") : t("Ocultar os meus Mangas")}</span>
              </label>
            </div>

          </div>
        )}

      </div>

      {/* 2. Active Tags & Genres Pill Row + Sort Control */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low/40 rounded-2xl p-4 border border-border-glass shadow-md">
        
        {/* Left: Active Tag pills, styled exactly as the second row of image 1 */}
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
          <div className="flex items-center text-on-surface-variant flex-shrink-0" title={t("Tags Ativas")}>
            <Tag size={16} />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {/* Show Selected Genres */}
            {selectedGenres.map(genreName => (
              <span 
                key={genreName}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm shadow-primary/20"
              >
                <span>{genreName}</span>
                <button 
                  onClick={() => handleToggleGenre(genreName)}
                  className="p-0.5 rounded-full hover:bg-black/20 text-white/70 hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            ))}

            {/* Show Selected Tags */}
            {selectedTags.map(tagName => (
              <span 
                key={tagName}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#00b0ff] text-white text-xs font-bold shadow-sm"
              >
                <span>{tagName}</span>
                <button 
                  onClick={() => handleToggleTag(tagName)}
                  className="p-0.5 rounded-full hover:bg-black/20 text-white/70 hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            ))}

            {/* Button to open tag selector modal */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-border-glass hover:bg-white/10 text-xs font-bold text-white active:scale-95 transition-all"
            >
              <Plus size={12} />
              <span>{t("Adicionar Tags")}</span>
            </button>

            {/* Clear all helper */}
            {(selectedGenres.length > 0 || selectedTags.length > 0) && (
              <button
                onClick={() => {
                  setSelectedGenres([]);
                  setSelectedTags([]);
                }}
                className="text-xs text-primary-light hover:text-primary font-bold ml-2 transition-colors"
              >
                {t("Limpar Filtros")}
              </button>
            )}
          </div>
        </div>

        {/* Right: Feito para si Toggle + Sort selector */}
        <div className="flex items-center gap-4 self-end sm:self-auto flex-shrink-0">
          
          {/* Feito para si Toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none bg-surface-container border border-border-glass hover:bg-surface-container-high rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-sm">
            <span className="text-white">{t("Feito para si")}</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={sortOrder === 'RECOMMENDED'}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedGenres([]);
                    setSelectedTags([]);
                    setSortOrder('RECOMMENDED');
                  } else {
                    setSortOrder('TRENDING_DESC');
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-white/10 rounded-full transition-colors peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
            </div>
          </label>

          {/* Sort Selector */}
          {sortOrder !== 'RECOMMENDED' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <ArrowUpDown size={14} className="text-white/40" />
              <select 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-surface-container border border-border-glass text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer transition-colors shadow-sm"
              >
                <option value="TRENDING_DESC" className="bg-surface-dim text-white">{t("Em Alta")}</option>
                <option value="POPULARITY_DESC" className="bg-surface-dim text-white">{t("Mais Populares")}</option>
                <option value="SCORE_DESC" className="bg-surface-dim text-white">{t("Mais Bem Avaliados")}</option>
                <option value="START_DATE_DESC" className="bg-surface-dim text-white">{t("Mais Recentes")}</option>
              </select>
            </div>
          )}
        </div>

      </div>

      {/* 3. Results Catalog */}
      <div className="flex-1">
        {loadingResults && filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="animate-spin text-primary" size={32} />
            <p className="text-sm text-white/50">{t("A carregar catálogo de obras...")}</p>
          </div>
        ) : filteredResults.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
              {filteredResults.map(item => {
                const title = item.title.english || item.title.romaji || item.title.native || '';
                const displayRanking = item.averageScore ? item.averageScore / 10 : undefined;
                const progressText = item.episodes ? `${item.episodes} Ep` : item.chapters ? `${item.chapters} Cap` : undefined;
                return (
                  <MediaCard
                    key={item.id}
                    titulo={title}
                    capaUrl={item.coverImage.large}
                    ranking={displayRanking}
                    progresso={progressText}
                    onClick={() => handleCardClick(item.id, item.format)}
                  />
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingResults}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-border-glass text-xs font-bold text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {loadingResults && <RefreshCw size={12} className="animate-spin text-primary" />}
                  <span>{loadingResults ? t("A carregar...") : t("Carregar Mais Resultados")}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border-glass rounded-3xl text-center px-4">
            <span className="material-symbols-outlined text-3xl text-white/30 mb-2">sentiment_dissatisfied</span>
            <h4 className="text-white font-bold text-sm">{t("Nenhum resultado encontrado")}</h4>
            <p className="text-xs text-white/40 mt-1 max-w-xs">
              {t("Não encontrámos nenhuma obra correspondente a estes filtros. Tenta ajustar os teus critérios.")}
            </p>
          </div>
        )}
      </div>

      {/* 4. Modal - "Add Tags" (Detailed Categorized Tag Selection) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-dim border border-border-glass rounded-3xl w-full max-w-4xl h-[80vh] md:h-[650px] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border-glass flex justify-between items-center bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <Grid size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-white">{t("Selecionar Tags Avançadas")}</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
              {/* Sidebar: Categories */}
              <div className="flex flex-row md:flex-col gap-1.5 p-3 md:p-4 border-b md:border-b-0 md:border-r border-border-glass bg-surface-container-low/20 overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:w-60 flex-shrink-0 no-scrollbar">
                {categories.map(cat => {
                  const isSelected = currentActive === cat;
                  const count = getSelectedCount(cat);

                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap md:w-full md:text-left border active:scale-95 ${
                        isSelected
                          ? 'bg-primary border-primary text-on-primary shadow-sm shadow-primary/25'
                          : 'bg-surface-container border-border-glass text-on-surface-variant hover:bg-surface-container-high hover:text-white'
                      }`}
                    >
                      <span>{cat}</span>
                      {count > 0 && (
                        <span className={`ml-auto flex items-center justify-center text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-white text-primary' : 'bg-primary text-on-primary'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar min-h-0">
                <div className="space-y-6">
                  <h3 className="text-xs font-extrabold text-white tracking-wider uppercase flex items-center gap-1.5">
                    <Tag size={14} className="text-primary-light" />
                    <span>{currentActive}</span>
                  </h3>
                  <div className="flex flex-col gap-3">
                    {Object.entries(groupedTags[currentActive] || {}).map(([subcategory, tagList]) => {
                      const isCollapsed = !!collapsedSubcats[subcategory];
                      const subcatSelectedCount = tagList.filter(t => selectedTags.includes(t.name)).length;

                      return (
                        <div key={subcategory} className="bg-surface-container border border-border-glass rounded-2xl flex flex-col overflow-hidden">
                          <button
                            onClick={() => toggleSubcat(subcategory)}
                            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white/70">{subcategory}</h4>
                              {subcatSelectedCount > 0 && (
                                <span className="bg-primary/20 text-primary text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                                  {subcatSelectedCount}
                                </span>
                              )}
                            </div>
                            <span className="text-on-surface-variant">
                              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </span>
                          </button>
                          
                          {!isCollapsed && (
                            <div className="px-4 pb-4 pt-1 flex flex-wrap gap-1.5 border-t border-white/5">
                              {tagList.map(tag => {
                                const isSelected = selectedTags.includes(tag.name);
                                return (
                                  <button
                                    key={tag.id}
                                    onClick={() => handleToggleTag(tag.name)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                                      isSelected
                                        ? 'bg-[#00b0ff] border-[#00b0ff] text-white shadow-sm shadow-[#00b0ff]/25'
                                        : 'bg-surface-container border-border-glass text-on-surface-variant hover:bg-surface-container-high hover:text-white'
                                    }`}
                                  >
                                    {isSelected && <Check size={10} />}
                                    <span>{tag.name}</span>
                                    {tag.isAdult && (
                                      <span className="text-[7px] text-red-400 font-extrabold bg-red-500/10 px-0.5 rounded border border-red-500/20">
                                        18+
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border-glass bg-surface-container-low/40 flex items-center justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/80 text-xs font-semibold text-on-primary transition-all shadow-md shadow-primary/10"
              >
                {t("Fechar")}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ExplorePage;
