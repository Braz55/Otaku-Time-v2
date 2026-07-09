import React from 'react';
import { 
  Smartphone, Award, BarChart3, ChevronDown, ChevronUp, 
  Trash2, Plus 
} from 'lucide-react';

interface DashboardTabProps {
  profile: any;
  catalog: any[];
  favoritePodiumType: 'ANIME' | 'MANGA';
  setFavoritePodiumType: (type: 'ANIME' | 'MANGA') => void;
  favoriteDetails: Record<string, { title: string; coverUrl: string }>;
  recentActivities: any[];
  visibleActivitiesCount: number;
  setVisibleActivitiesCount: React.Dispatch<React.SetStateAction<number>>;
  setShowDetailedStatsModal: (show: boolean) => void;
  openFavoritesSearch: (mediaType: 'anime' | 'manga', rank: number) => void;
  handleRemoveFavorite: (mediaType: 'ANIME' | 'MANGA', rank: number) => void;
  handleAdminSeedAchievements?: () => void;
  isSeedingAchievements?: boolean;
  user: any;
  customFetch: any;
  API_BASE_URL: string;
  showToast: any;
  fetchCatalog: () => void;
  fetchProfile: () => void;
  navigate: any;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  profile,
  catalog,
  favoritePodiumType,
  setFavoritePodiumType,
  favoriteDetails,
  recentActivities,
  visibleActivitiesCount,
  setVisibleActivitiesCount,
  setShowDetailedStatsModal,
  openFavoritesSearch,
  handleRemoveFavorite,
  user,
  customFetch,
  API_BASE_URL,
  showToast,
  fetchCatalog,
  fetchProfile,
  navigate,
}) => {
  const isUnlocked = (achievementId: number) => {
    return profile?.achievements?.some((ua: any) => ua.achievementId === achievementId);
  };

  const getUnlockDate = (achievementId: number) => {
    const record = profile?.achievements?.find((ua: any) => ua.achievementId === achievementId);
    if (!record?.unlockedAt) return '';
    return new Date(record.unlockedAt).toLocaleDateString('pt-PT');
  };

  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Recentemente';
    try {
      const past = new Date(dateStr).getTime();
      const now = new Date().getTime();
      const diffMs = now - past;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Agora mesmo';
      if (diffMins < 60) return `Há ${diffMins} min`;
      if (diffHours < 24) return `Há ${diffHours} h`;
      return `Há ${diffDays} dias`;
    } catch {
      return 'Recentemente';
    }
  };

  const renderPodiumPosition = (rank: number) => {
    const key = `${favoritePodiumType}-${rank}` as const;
    const fav = favoriteDetails[key];
    const mediaTypeLower = favoritePodiumType.toLowerCase() as 'anime' | 'manga';

    let rankLabel = '';
    let rankClass = '';
    let ringClass = '';
    let plusColor = '';

    if (rank === 1) {
      rankLabel = '1º GOLD';
      rankClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      ringClass = 'border-amber-500/30 ring-2 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      plusColor = 'text-amber-400';
    } else if (rank === 2) {
      rankLabel = '2º SILVER';
      rankClass = 'bg-slate-400/20 text-slate-300 border-slate-400/40';
      ringClass = 'border-slate-400/30 ring-2 ring-slate-400/10 shadow-md';
      plusColor = 'text-primary-light';
    } else {
      rankLabel = '3º BRONZE';
      rankClass = 'bg-amber-700/20 text-amber-500 border-amber-700/40';
      ringClass = 'border-amber-700/30 ring-2 ring-amber-700/10 shadow-md';
      plusColor = 'text-orange-400';
    }

    return (
      <div className="flex flex-col items-center gap-2" key={rank}>
        <div className={`w-full aspect-[2/3] rounded-2xl border bg-black/40 overflow-hidden relative group flex items-center justify-center text-center ${ringClass}`}>
          {fav ? (
            <>
              <img 
                src={fav.coverUrl} 
                className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-300" 
                alt={`${rankLabel} Place`} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-2 leading-tight">{fav.title}</p>
                <button 
                  onClick={() => handleRemoveFavorite(favoritePodiumType, rank)}
                  className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg self-center mt-2 scale-90 active:scale-75 transition-all shadow cursor-pointer"
                  title="Remover"
                  type="button"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={() => openFavoritesSearch(mediaTypeLower, rank)}
              className="w-full h-full flex flex-col items-center justify-center p-3 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 cursor-pointer"
              type="button"
            >
              <Plus className={`w-6 h-6 mb-1 ${plusColor}`} />
              <span className="text-[9px] sm:text-xs font-bold">{rank}º Lugar</span>
            </button>
          )}
        </div>
        <div className={`h-6 w-full rounded-lg flex items-center justify-center text-[9px] min-[375px]:text-[10px] sm:text-xs font-black border truncate px-1 ${rankClass}`}>
          {rankLabel}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Left Column: Stats & Conquistas */}
      <div className="col-span-12 lg:col-span-4 space-y-6 md:space-y-8">
        
        {/* Stats Card */}
        <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-xl pointer-events-none"></div>
          <h3 className="font-headline-lg text-lg md:text-xl text-white flex items-center gap-2.5 mb-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <span>Estatísticas</span>
          </h3>
          
          <div className="space-y-6">
            <div>
              <p className="text-on-surface-variant text-[10px] uppercase tracking-widest mb-1">Tempo de Anime</p>
              <p className="text-3xl font-display-md text-white font-extrabold">
                {profile.statistics?.animeDaysWasted ? Number(profile.statistics.animeDaysWasted).toFixed(1) : '0.0'}
                <span className="text-xs font-body-md text-primary ml-1.5 font-normal">dias</span>
              </p>
            </div>
            
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(((profile.statistics?.totalEpisodesWatched || 0) / 1000) * 100, 100)}%` }}></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-border-glass">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-1 font-bold">Capítulos Lidos</p>
                <p className="text-xl font-headline-lg text-white font-extrabold">{profile.statistics?.totalMangaRead || 0}</p>
              </div>
              <div className="p-4 bg-surface-container-low rounded-2xl border border-border-glass">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-1 font-bold">Episódios Vistos</p>
                <p className="text-xl font-headline-lg text-white font-extrabold">{profile.statistics?.totalEpisodesWatched || 0}</p>
              </div>
              <div className="p-4 bg-surface-container-low rounded-2xl border border-border-glass">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-1 font-bold">Animes Completos</p>
                <p className="text-xl font-headline-lg text-white font-extrabold">{profile.statistics?.totalAnimeCompleted || 0}</p>
              </div>
              <div className="p-4 bg-surface-container-low rounded-2xl border border-border-glass">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-1 font-bold">Média Score</p>
                <p className="text-xl font-headline-lg text-white font-extrabold">
                  {profile.statsSummary?.averageScore ? profile.statsSummary.averageScore.toFixed(1) : '0.0'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDetailedStatsModal(true)}
              className="w-full mt-2 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Ver Estatísticas Detalhadas</span>
            </button>
          </div>
        </div>

        {/* Achievements Gallery */}
        <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-headline-lg text-lg md:text-xl text-white">Conquistas</h3>
            <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
              {profile.achievements?.length || 0}/{catalog.length || 5}
            </span>
          </div>
          
          {catalog.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide no-scrollbar md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 md:overflow-visible">
              {catalog.map(ach => {
                const unlocked = isUnlocked(ach.id);
                let borderClass = 'border-white/5 bg-black/40 grayscale opacity-45';
                if (unlocked) {
                  if (ach.rarity === 'RARE') borderClass = 'border-cyan-500/20 bg-cyan-500/5 hover:scale-[1.02] shadow-[0_0_15px_rgba(6,182,212,0.2)]';
                  else if (ach.rarity === 'EPIC') borderClass = 'border-purple-500/20 bg-purple-500/5 hover:scale-[1.02] shadow-[0_0_15px_rgba(139,92,246,0.2)]';
                  else if (ach.rarity === 'LEGENDARY') borderClass = 'border-amber-500/20 bg-amber-500/5 hover:scale-[1.02] shadow-[0_0_15px_rgba(245,158,11,0.2)]';
                  else borderClass = 'border-primary/20 bg-primary/5 hover:scale-[1.02]';
                }
                return (
                  <div 
                    key={ach.id} 
                    className={`flex-shrink-0 flex flex-col items-center w-20 md:w-auto md:p-3.5 glass-panel border rounded-2xl transition-all group relative ${borderClass}`}
                    title={`${ach.name}: ${ach.description}${unlocked ? ` (Ganho em: ${getUnlockDate(ach.id)})` : ''}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 p-1 relative flex items-center justify-center mb-1.5 flex-shrink-0">
                      {ach.badgeImageUrl ? (
                        <img src={ach.badgeImageUrl} className="w-full h-full object-contain rounded-full" alt="" />
                      ) : (
                        <Award className="w-6 h-6 text-primary" />
                      )}
                      {!unlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                          <span className="material-symbols-outlined text-white !text-xs">lock</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-white text-center tracking-tight leading-tight line-clamp-1 w-full uppercase">{ach.name}</span>
                    {unlocked && (
                      <span className="hidden md:inline-block text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 mt-1">
                        Ganho
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/5 space-y-3">
              <p className="text-xs italic text-gray-500">Nenhuma conquista registada.</p>
              {user?.tipoConta === 'ADMIN' && (
                <button 
                  type="button"
                  onClick={async () => {
                    const res = await customFetch(`${API_BASE_URL}/user/achievements/seed`, { method: 'POST' });
                    if (res.ok) {
                      showToast('Conquistas semeadas!', 'success');
                      fetchCatalog();
                      fetchProfile();
                    }
                  }}
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl active:scale-95 transition-all shadow"
                >
                  Popular Conquistas
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Podium Favorites & Activity Log */}
      <div className="col-span-12 lg:col-span-8 space-y-6 md:space-y-8">
        
        {/* Favorites Podium Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 shadow-xl relative overflow-hidden min-h-[300px] sm:min-h-[420px]">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <span className="material-symbols-outlined text-[150px]">stars</span>
          </div>
          
          <div className="flex justify-between items-center mb-10 flex-wrap gap-3">
            <div>
              <span className={`font-label-md text-[10px] uppercase tracking-widest block mb-0.5 ${favoritePodiumType === 'ANIME' ? 'text-secondary' : 'text-primary'}`}>Destaques</span>
              <h3 className="font-headline-lg text-lg md:text-xl text-white">Favoritos de Ouro</h3>
            </div>
            
            <div className="flex p-0.5 bg-black/40 border border-white/10 rounded-xl">
              <button 
                type="button"
                onClick={() => setFavoritePodiumType('ANIME')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${favoritePodiumType === 'ANIME' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-white'}`}
              >
                Anime
              </button>
              <button 
                type="button"
                onClick={() => setFavoritePodiumType('MANGA')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${favoritePodiumType === 'MANGA' ? 'bg-secondary text-on-secondary shadow' : 'text-on-surface-variant hover:text-white'}`}
              >
                Mangá
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-8 items-end h-[200px] min-[400px]:h-[240px] sm:h-[340px] max-w-2xl mx-auto pt-2">
            {renderPodiumPosition(2)}
            {renderPodiumPosition(1)}
            {renderPodiumPosition(3)}
          </div>
          
          <p className="text-center mt-6 text-xs text-on-surface-variant italic leading-relaxed">
            Títulos em destaque que definiram a minha jornada Otaku. Clica para alterar.
          </p>
        </div>

        {/* Recent Activity Log */}
        <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-4 shadow-xl">
          <h3 className="font-headline-lg text-lg md:text-xl text-white mb-2">Atividade Recente</h3>
          
          <div className="space-y-3.5">
            {recentActivities.length > 0 ? (
              <>
                {recentActivities.slice(0, visibleActivitiesCount).map((act: any) => {
                  const cover = act.capaUrl || act.anime?.capaUrl || act.manga?.capaUrl;
                  const title = act.titulo || act.anime?.titulo || act.manga?.titulo;
                  const current = act.mediaType === 'anime' ? act.epAtual : act.capAtual;
                  const isAnime = act.mediaType === 'anime';
                  
                  return (
                    <div key={act.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 border border-white/[0.02] transition-colors group">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative border border-white/5">
                        <img src={cover} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <p className="text-sm text-white font-medium truncate leading-snug">
                          {isAnime ? 'Viu o episódio' : 'Leu o capítulo'}{' '}
                          <span className={isAnime ? 'text-primary font-bold' : 'text-secondary font-bold'}>{current}</span>
                          {' de '}
                          <span className="font-bold text-white hover:underline cursor-pointer" onClick={() => navigate('/')}>{title}</span>
                        </p>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mt-0.5">
                          {getRelativeTime(act.lastProgressUpdate)}
                        </p>
                      </div>
                      
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase ${isAnime ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                        {act.mediaType}
                      </span>
                    </div>
                  );
                })}
                {recentActivities.length > 3 && (
                  <div className="flex gap-2 mt-2 w-full">
                    {visibleActivitiesCount < recentActivities.length && (
                      <button
                        onClick={() => setVisibleActivitiesCount(prev => prev + 5)}
                        className="flex-grow py-2 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                      >
                        <span>Ver Mais (+{Math.min(5, recentActivities.length - visibleActivitiesCount)})</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    )}
                    {visibleActivitiesCount > 3 && (
                      <button
                        onClick={() => setVisibleActivitiesCount(3)}
                        className={`${visibleActivitiesCount >= recentActivities.length ? 'w-full' : 'px-4'} py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/60 hover:text-white transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer`}
                      >
                        <span>Ver Menos</span>
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-center py-8 text-xs text-on-surface-variant italic">
                Ainda sem atividade registada. Começa a consumir da tua biblioteca!
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
