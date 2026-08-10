import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EpisodeDetailsModal } from './EpisodeDetailsModal';

interface TrackingTabProps {
  selectedItem: any;
  mediaType: 'anime' | 'manga';
  isMobile: boolean;
  isAddingToLibrary: boolean;
  adicionarAoBanco: (titulo: string, id: number, formato: string) => void;
  TRACKING_STATUS_OPTIONS: any[];
  atualizarCampo: (field: string, val: any) => void;
  setShowPriorityModal: (show: boolean) => void;
  viewedSeason: number | null;
  setViewedSeason: (season: number) => void;
  getEpisodesCountForSeason: (season: number) => number;
  isSavingDetailsProgress: boolean;
  totalEpisodesAllSeasons: number;
  totalAiredEpisodes: number;
  loadingEpisodes: boolean;
  showToast: any;
  atualizarProgresso: (delta: number) => void;
  showEpList: boolean;
  setShowEpList: (show: boolean) => void;
  viewedEpisodes: any[];
  getGlobalEpisodeNumber: (season: number, epNum: number) => number;
  lastAiredEpNumber: number;
  latestChapter: number | null;
  handleOpenListsModal: () => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  isCheckingLists: boolean;
  handleRemoveFromLibraryClick: () => void;
  newLinkSite: string;
  setNewLinkSite: (val: string) => void;
  newLinkUrl: string;
  setNewLinkUrl: (val: string) => void;
  showAddLink: boolean;
  setShowAddLink: (show: boolean) => void;
  adicionarLinkPessoal: () => void;
  eliminarLinkPessoal: (site: string) => void;
  abrirLink: (url: string, title: string) => void;
  t: (key: string) => string;
}

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

export const TrackingTab: React.FC<TrackingTabProps> = ({
  selectedItem,
  mediaType,
  isMobile,
  isAddingToLibrary,
  adicionarAoBanco,
  TRACKING_STATUS_OPTIONS,
  atualizarCampo,
  setShowPriorityModal,
  viewedSeason,
  setViewedSeason,
  getEpisodesCountForSeason,
  isSavingDetailsProgress,
  totalEpisodesAllSeasons,
  totalAiredEpisodes,
  loadingEpisodes,
  showToast,
  atualizarProgresso,
  showEpList,
  setShowEpList,
  viewedEpisodes,
  getGlobalEpisodeNumber,
  lastAiredEpNumber,
  latestChapter,
  handleOpenListsModal,
  showDeleteConfirm,
  setShowDeleteConfirm,
  isCheckingLists,
  handleRemoveFromLibraryClick,
  newLinkSite,
  setNewLinkSite,
  newLinkUrl,
  setNewLinkUrl,
  showAddLink,
  setShowAddLink,
  adicionarLinkPessoal,
  eliminarLinkPessoal,
  abrirLink,
  t,
}) => {
  const [selectedEpisodeDetails, setSelectedEpisodeDetails] = useState<any | null>(null);
  const currentPriorityOpt = PRIORITY_OPTIONS.find(opt => opt.num === selectedItem.prioridade) || PRIORITY_OPTIONS[4];
  const isAnimePorEstrear = 
    mediaType === 'anime' && 
    (selectedItem.statusLancamento === 'NOT_YET_RELEASED' || 
     (selectedItem.dataLancamento && new Date(selectedItem.dataLancamento) > new Date()) ||
     (totalAiredEpisodes === 0 && selectedItem.statusLancamento !== 'FINISHED'));
  const [statusDropdownOpen, setStatusDropdownOpen] = React.useState(false);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = React.useState(false);

  const seasonsList = React.useMemo(() => {
    let list: any[] = [];
    if (selectedItem.episodes && selectedItem.episodes.length > 0) {
      list = Array.from(new Set(selectedItem.episodes.map((ep: any) => ep.season as number)))
        .sort((a: any, b: any) => a - b);
    } else {
      const relationSeasons = selectedItem.relations?.edges
        ?.filter((edge: any) => edge.node.format === 'TV_SEASON')
        ?.sort((a: any, b: any) => a.node.seasonNumber - b.node.seasonNumber) || [];
      list = relationSeasons.map((edge: any) => edge.node.seasonNumber);
    }
    if (list.length === 0) {
      list = [viewedSeason || 1];
    }
    return list;
  }, [selectedItem.episodes, selectedItem.relations, viewedSeason]);

  const releaseDateFormatted = React.useMemo(() => {
    if (!selectedItem.dataLancamento) return '';
    try {
      const d = new Date(selectedItem.dataLancamento);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('pt-PT');
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  }, [selectedItem.dataLancamento]);


  const linksPessoais = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados).map((l: any) => ({ ...l, tipo: 'Custom' })) : [];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* 1. Main Action Card */}
      <div className="bg-[#18181c]/80 border border-white/5 rounded-3xl p-6 relative z-30 shadow-xl backdrop-blur-md space-y-6">
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none z-0">
          <div className="absolute -right-8 -bottom-8 text-white/3 transform rotate-12 select-none">
            <span className="material-symbols-outlined text-[140px] font-thin">explore</span>
          </div>
        </div>

        <div className="relative z-10 space-y-5">
          <h3 className="text-base font-extrabold text-white mb-2">Acompanhamento & Progresso</h3>

          {selectedItem.isExternal ? (
            <div className="space-y-4">
              <button 
                type="button"
                onClick={() => { adicionarAoBanco(selectedItem.titulo, selectedItem.id, selectedItem.formato); }} 
                disabled={isAddingToLibrary}
                className="w-full bg-primary hover:bg-primary/80 text-on-primary py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 cursor-pointer"
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

              {mediaType === 'anime' && selectedItem.formato !== 'MOVIE' && (
                <div className="border-t border-white/5 pt-4 space-y-4">
                  {/* Season Selector */}
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
                      uniqueSeasonNums = [viewedSeason || 1];
                    }

                    if (isMobile) {
                      if (uniqueSeasonNums.length <= 1 && !uniqueSeasonNums.includes(0)) {
                        return null;
                      }
                      return (
                        <div className="space-y-1.5 w-full text-center">
                          <label className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1 justify-center">
                            <span className="material-symbols-outlined text-[11px]">folder_open</span>
                            Temporada
                          </label>
                          <div className="flex overflow-x-auto gap-2 pb-2 pt-1 w-full justify-start scrollbar-none snap-x no-scrollbar">
                            {uniqueSeasonNums.map((seasonNum) => {
                              const isSelected = viewedSeason === seasonNum;
                              const epsCount = getEpisodesCountForSeason(seasonNum);
                              return (
                                <button
                                  key={seasonNum}
                                  type="button"
                                  onClick={() => setViewedSeason(seasonNum)}
                                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 snap-center cursor-pointer ${
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
                    } else {
                      // Desktop Season Selector
                      return (
                        <div className="flex flex-col gap-1.5 text-left max-w-xs">
                          <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest font-extrabold">
                            Temporada
                          </label>
                          <div className="relative w-full">
                            <button
                              type="button"
                              onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                              className="w-full flex items-center justify-between bg-[#18181c] text-white border border-white/10 hover:border-white/20 px-4 py-2.5 rounded-2xl outline-none focus:border-primary/50 text-xs font-bold cursor-pointer transition-all h-[46px] relative text-left"
                            >
                              {(() => {
                                const epsCount = getEpisodesCountForSeason(viewedSeason || 1);
                                return (
                                  <div className="flex items-center gap-1.5 justify-between w-full pr-1.5 min-w-0">
                                    <span className="truncate">{viewedSeason === 0 ? 'Especiais' : `Temporada ${viewedSeason}`}</span>
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
                                  {uniqueSeasonNums.map((seasonNum: number) => {
                                    const epsCount = getEpisodesCountForSeason(seasonNum);
                                    const isSelected = viewedSeason === seasonNum;
                                    let optColor = 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent';
                                    if (isSelected) optColor = 'bg-primary/20 text-primary border border-primary/30';
                                    return (
                                      <button
                                        key={`ext-s-drop-${seasonNum}`}
                                        type="button"
                                        onClick={() => {
                                          setViewedSeason(seasonNum);
                                          setSeasonDropdownOpen(false);
                                        }}
                                        className={`w-full flex-shrink-0 flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-all ${optColor}`}
                                      >
                                        <span>{seasonNum === 0 ? 'Especiais' : `Temporada ${seasonNum}`}</span>
                                        <span className="text-[10px] opacity-60 font-medium">({epsCount} eps)</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }
                  })()}

                  {/* Toggle Episodes view button */}
                  <div className={`flex ${isMobile ? 'justify-center' : 'justify-start'} mt-2`}>
                    <button 
                      type="button"
                      onClick={() => setShowEpList(!showEpList)}
                      className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border active:scale-95 cursor-pointer ${showEpList ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(139,92,246,0.2)]' : 'bg-surface-variant/30 border-white/5 text-on-surface-variant'}`}
                    >
                      <span className="material-symbols-outlined text-sm">grid_view</span>
                      <span>{showEpList ? 'Fechar Grelha' : 'Ver Episódios'}</span>
                    </button>
                  </div>

                  {/* Episode List grid / scroll panel */}
                  {showEpList && (
                    <div className="w-full mt-4 border-t border-white/10 pt-4 animate-in slide-in-from-top-4 duration-300 text-left">
                      {loadingEpisodes ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        viewedEpisodes && viewedEpisodes.length > 0 ? (
                          <div className={isMobile 
                            ? "space-y-3.5 max-h-[340px] overflow-y-auto pr-2 custom-scrollbar"
                            : "grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
                          }>
                            {viewedEpisodes.map((ep: any) => {
                              const isSpecial = ep.season === 0;
                              const airTime = new Date(ep.air_date).getTime();
                              const nowTime = new Date().getTime();
                              const hasAired = ep.air_date ? airTime <= nowTime : true;
                              
                              return (
                                <div 
                                  key={ep.id || ep.episode_number} 
                                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 border border-white/[0.02] transition-colors group cursor-pointer"
                                  onClick={() => setSelectedEpisodeDetails({ ...ep, season: ep.season !== undefined ? ep.season : (viewedSeason || 1) })}
                                >
                                  {ep.still_path ? (
                                    <img 
                                      src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                      alt={`Episódio ${ep.episode_number}`}
                                      className="w-20 aspect-video object-cover rounded-xl border border-white/10 flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-20 aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-on-surface-variant/30">
                                      <span className="material-symbols-outlined text-base">movie</span>
                                    </div>
                                  )}
                                  <div className="flex-grow min-w-0">
                                    <h5 className="text-xs font-bold text-white truncate flex items-center gap-2">
                                      <span className={isSpecial ? 'text-secondary' : 'text-primary'}>
                                        {isSpecial ? `Especial ${ep.episode_number}` : `Ep. ${ep.episode_number}`}
                                      </span>
                                      {ep.name && <span className="text-gray-400 font-medium truncate">— {ep.name}</span>}
                                    </h5>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                                        {ep.air_date ? new Date(ep.air_date).toLocaleDateString('pt-PT') : 'Data Indisponível'}
                                        {!hasAired && (
                                          <>
                                            <span className="text-white/10 mx-1.5">•</span>
                                            <span className="text-amber-500 text-[9px] font-extrabold uppercase tracking-wider">Por estrear</span>
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {hasAired ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          showToast('Adiciona o anime à tua biblioteca para começares a marcar episódios como vistos!', 'info');
                                        }}
                                        className="w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer bg-surface-variant/40 hover:bg-surface-variant hover:text-white text-on-surface-variant border border-white/10"
                                        title="Adiciona à biblioteca para marcar como visto"
                                      >
                                        <span className="material-symbols-outlined text-sm font-bold">
                                          check_box_outline_blank
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
                          <div className="text-xs text-on-surface-variant/60 text-center py-4">
                            Nenhum episódio disponível para esta temporada.
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            isMobile ? (
              isAnimePorEstrear ? (
                <div className="space-y-3 text-left w-full">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Estado</label>
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-400 font-bold text-xs">
                        <span className="material-symbols-outlined text-base">schedule</span>
                        <span>Por estrear</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant italic leading-relaxed">
                    {selectedItem.formato === 'MOVIE' ? 'Este filme' : 'Este anime'} ainda não estreou.{releaseDateFormatted ? ` Estreia a ${releaseDateFormatted}.` : ''} Quando estrear, poderás alterar o estado.
                  </p>

                  {selectedItem.formato !== 'MOVIE' && (
                    <div className="border-t border-white/5 pt-4 space-y-4">
                      {/* Season Selector */}
                      {seasonsList.length > 1 || seasonsList.includes(0) ? (
                        <div className="space-y-1.5 w-full text-center">
                          <label className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1 justify-center">
                            <span className="material-symbols-outlined text-[11px]">folder_open</span>
                            Temporada
                          </label>
                          <div className="flex overflow-x-auto gap-2 pb-2 pt-1 w-full justify-start scrollbar-none snap-x no-scrollbar">
                            {seasonsList.map((seasonNum) => {
                              const isSelected = viewedSeason === seasonNum;
                              const epsCount = getEpisodesCountForSeason(seasonNum);
                              return (
                                <button
                                  key={seasonNum}
                                  type="button"
                                  onClick={() => setViewedSeason(seasonNum)}
                                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 snap-center cursor-pointer ${
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
                      ) : null}

                      {/* Toggle Episodes view button */}
                      <div className="flex justify-center mt-2">
                        <button 
                          type="button"
                          onClick={() => setShowEpList(!showEpList)}
                          className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border active:scale-95 cursor-pointer ${showEpList ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(139,92,246,0.2)]' : 'bg-surface-variant/30 border-white/5 text-on-surface-variant'}`}
                        >
                          <span className="material-symbols-outlined text-sm">grid_view</span>
                          <span>{showEpList ? 'Fechar Grelha' : 'Ver Episódios'}</span>
                        </button>
                      </div>

                      {/* Episode List grid / scroll panel */}
                      {showEpList && (
                        <div className="w-full mt-4 border-t border-white/10 pt-4 animate-in slide-in-from-top-4 duration-300 text-left">
                          {loadingEpisodes ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                          ) : (
                            viewedEpisodes && viewedEpisodes.length > 0 ? (
                              <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-2 custom-scrollbar">
                                {viewedEpisodes.map((ep: any) => {
                                  const isSpecial = ep.season === 0;
                                  const airTime = new Date(ep.air_date).getTime();
                                  const nowTime = new Date().getTime();
                                  const hasAired = ep.air_date ? airTime <= nowTime : true;
                                  
                                  return (
                                    <div 
                                      key={ep.id || ep.episode_number} 
                                      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 border border-white/[0.02] transition-colors group cursor-pointer"
                                      onClick={() => setSelectedEpisodeDetails({ ...ep, season: ep.season !== undefined ? ep.season : (viewedSeason || 1) })}
                                    >
                                      {ep.still_path ? (
                                        <img 
                                          src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                          alt={`Episódio ${ep.episode_number}`}
                                          className="w-20 aspect-video object-cover rounded-xl border border-white/10 flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="w-20 aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-on-surface-variant/30">
                                          <span className="material-symbols-outlined text-base">movie</span>
                                        </div>
                                      )}
                                      <div className="flex-grow min-w-0">
                                        <h5 className="text-xs font-bold text-white truncate flex items-center gap-2">
                                          <span className="text-primary">
                                            {isSpecial ? `Especial ${ep.episode_number}` : `Ep. ${ep.episode_number}`}
                                          </span>
                                          {ep.name && <span className="text-gray-400 font-medium truncate">— {ep.name}</span>}
                                        </h5>
                                        <div className="flex items-center gap-2 mt-1">
                                          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                                            {ep.air_date ? new Date(ep.air_date).toLocaleDateString('pt-PT') : 'Data Indisponível'}
                                            {!hasAired && (
                                              <>
                                                <span className="text-white/10 mx-1.5">•</span>
                                                <span className="text-amber-500 text-[9px] font-extrabold uppercase tracking-wider">Por estrear</span>
                                              </>
                                            )}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <div className="w-9 h-9 flex items-center justify-center text-on-surface-variant/30 font-bold" title="Não estreado">
                                          <span className="material-symbols-outlined text-sm">schedule</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-on-surface-variant/60 text-center py-4">
                                Nenhum episódio disponível para esta temporada.
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                {/* Tracking Status Choices */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Estado</label>
                <div className="flex overflow-x-auto gap-2 pb-2 pt-1 w-full justify-start scrollbar-none snap-x no-scrollbar">
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
                        type="button"
                        onClick={() => atualizarCampo('status', opt.value)} 
                        style={{ '--pulse-color': pulseColor } as React.CSSProperties}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-all text-xs font-bold relative overflow-hidden group active:scale-95 snap-center cursor-pointer ${
                          isSelected 
                            ? `${mediaType === 'anime' ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/20 border-secondary text-secondary'} animate-pulse-glow` 
                            : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:text-white'
                        }`}
                      >
                        {isSelected && (
                          <span className={`absolute left-0 top-0 bottom-0 w-1 ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                        )}
                        <span className={`material-symbols-outlined text-sm ${isSelected ? (mediaType === 'anime' ? 'text-primary' : 'text-secondary') : 'text-on-surface-variant'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
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
              </div>

              {/* Priority Dropdown Trigger */}
              <div className="space-y-1.5 pt-1.5 border-t border-white/5 text-left">
                <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  Prioridade de Acompanhamento
                </label>
                <button
                  type="button"
                  onClick={() => setShowPriorityModal(true)}
                  className="w-full flex items-center justify-between bg-black/40 text-white border border-white/10 px-4 py-2.5 rounded-xl outline-none focus:border-primary text-xs font-bold cursor-pointer text-left h-[46px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-xs text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span>#{selectedItem.prioridade} - {t(currentPriorityOpt.desc)}</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-base">unfold_more</span>
                </button>
              </div>

              {/* My Progress Selector */}
              {selectedItem.formato !== 'MOVIE' && (
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant text-xs">timelapse</span>
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">O Meu Progresso</p>
                </div>
                 
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
                      <div className="space-y-1.5 w-full pt-0.5 text-center">
                        <label className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest flex items-center gap-1 justify-center">
                          <span className="material-symbols-outlined text-[11px]">folder_open</span>
                          Temporada
                        </label>
                        <div className="flex overflow-x-auto gap-2 pb-2 pt-1 w-full justify-start scrollbar-none snap-x no-scrollbar">
                          {uniqueSeasonNums.map((seasonNum) => {
                            const isSelected = viewedSeason === seasonNum;
                            const epsCount = getEpisodesCountForSeason(seasonNum);
                            
                            return (
                              <button
                                key={seasonNum}
                                type="button"
                                onClick={() => setViewedSeason(seasonNum)}
                                className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 snap-center cursor-pointer ${
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

                <div className="flex items-baseline gap-2 mb-2 mt-1 justify-center">
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
                  <button 
                    type="button"
                    onClick={() => atualizarProgresso(-1)} 
                    disabled={isSavingDetailsProgress} 
                    title="Diminuir" 
                    className="w-9 h-9 rounded-xl bg-surface-variant/40 hover:bg-surface-variant border border-white/5 text-on-surface-variant hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">remove</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => atualizarProgresso(1)} 
                    disabled={
                      isSavingDetailsProgress || 
                      (mediaType === 'anime' && (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) >= totalAiredEpisodes)
                    } 
                    title="Aumentar" 
                    className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center shadow-md active:scale-95 font-bold cursor-pointer ${mediaType === 'anime' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowEpList(!showEpList)} 
                    className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border active:scale-95 cursor-pointer ${showEpList ? (mediaType === 'anime' ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/20 border-secondary text-secondary') : 'bg-surface-variant/30 border-white/5 text-on-surface-variant'}`}
                  >
                    <span className="material-symbols-outlined text-sm">grid_view</span>
                    <span>{showEpList ? 'Fechar Grelha' : 'Ver Episódios'}</span>
                  </button>
                </div>

                {showEpList && (
                  <div className="w-full mt-4 border-t border-white/10 pt-4 animate-in slide-in-from-top-4 duration-300 text-left">
                    {loadingEpisodes ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className={`w-6 h-6 animate-spin ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`} />
                      </div>
                    ) : mediaType === 'anime' ? (
                      viewedEpisodes && viewedEpisodes.length > 0 ? (
                        <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-2 custom-scrollbar">
                          {viewedEpisodes.map((ep: any) => {
                            const isSpecial = ep.season === 0;
                            const isWatched = isSpecial
                              ? (Array.isArray(selectedItem.watchedSpecials) && selectedItem.watchedSpecials.includes(ep.episode_number))
                              : (ep.globalEpisodeNumber || getGlobalEpisodeNumber(ep.season, ep.episode_number)) <= (selectedItem.epAtualGlobal || selectedItem.epAtual || 0);

                            const airTime = new Date(ep.air_date).getTime();
                            const nowTime = new Date().getTime();
                            const hasAired = ep.air_date ? airTime <= nowTime : true;
                            
                            return (
                              <div 
                                key={ep.id || ep.episode_number} 
                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 border border-white/[0.02] transition-colors group cursor-pointer"
                                onClick={() => setSelectedEpisodeDetails({ ...ep, season: ep.season !== undefined ? ep.season : (viewedSeason || 1) })}
                              >
                                {ep.still_path ? (
                                  <img 
                                    src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                    alt={`Episódio ${ep.episode_number}`}
                                    className="w-20 aspect-video object-cover rounded-xl border border-white/10 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-20 aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-on-surface-variant/30">
                                    <span className="material-symbols-outlined text-base">movie</span>
                                  </div>
                                )}
                                <div className="flex-grow min-w-0">
                                  <h5 className="text-xs font-bold text-white truncate flex items-center gap-2">
                                    <span className={isSpecial ? 'text-secondary' : 'text-primary'}>
                                      {isSpecial ? `Especial ${ep.episode_number}` : `Ep. ${ep.episode_number}`}
                                    </span>
                                    {ep.name && <span className="text-gray-400 font-medium truncate">— {ep.name}</span>}
                                  </h5>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                                      {ep.air_date ? new Date(ep.air_date).toLocaleDateString('pt-PT') : 'Data Indisponível'}
                                      {!hasAired && (
                                        <>
                                          <span className="text-white/10 mx-1.5">•</span>
                                          <span className="text-amber-500 text-[9px] font-extrabold uppercase tracking-wider">Por estrear</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {hasAired ? (
                                    <button
                                      type="button"
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
                                          ? 'bg-primary text-on-primary scale-105 shadow-sm'
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
                                  type="button"
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
                                      ? 'bg-primary text-on-primary scale-105 shadow-md'
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
                            <button 
                              key={num} 
                              type="button"
                              onClick={() => atualizarCampo('capAtual', num)} 
                              disabled={isSavingDetailsProgress} 
                              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${isWatched ? 'bg-secondary text-on-secondary scale-105 shadow-md' : 'bg-surface-variant/30 text-on-surface-variant border border-white/5'}`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
              </>
              )
            ) : (
              isAnimePorEstrear ? (
                <div className="space-y-6 text-left w-full">
                  <div className={`grid grid-cols-1 ${selectedItem.formato === 'MOVIE' ? 'max-w-xs' : 'md:grid-cols-3'} gap-6 items-end`}>
                    {/* 1. Status Column */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                        Estado de Acompanhamento
                      </label>
                      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-amber-400 font-bold text-xs w-fit h-[46px]">
                        <span className="material-symbols-outlined text-base">schedule</span>
                        <span>Por estrear</span>
                      </div>
                    </div>

                    {/* 2. Season Selector Column (only if anime and not movie, and multiple seasons exist) */}
                    {selectedItem.formato !== 'MOVIE' && (seasonsList.length > 1 || seasonsList.includes(0)) ? (
                      <div className="flex flex-col gap-1.5 text-left font-bold">
                        <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest font-extrabold">
                          Temporada
                        </label>
                        <div className="relative w-full">
                          <button
                            type="button"
                            onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                            className="w-full flex items-center justify-between bg-[#18181c] text-white border border-white/10 hover:border-white/20 px-4 py-2.5 rounded-2xl outline-none focus:border-primary/50 text-xs font-bold cursor-pointer transition-all h-[46px] relative text-left"
                          >
                            {(() => {
                              const epsCount = getEpisodesCountForSeason(viewedSeason || 1);
                              return (
                                <div className="flex items-center gap-1.5 justify-between w-full pr-1.5 min-w-0">
                                  <span className="truncate">{viewedSeason === 0 ? 'Especiais' : `Temporada ${viewedSeason}`}</span>
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
                              <div className="absolute left-0 right-0 bottom-full mb-2 bg-[#1c1c22] border border-white/10 rounded-2xl p-2.5 z-40 shadow-2xl max-h-[220px] overflow-y-auto custom-scrollbar space-y-1">
                                {seasonsList.map((seasonNum: number) => {
                                  const epsCount = getEpisodesCountForSeason(seasonNum);
                                  const isSelected = viewedSeason === seasonNum;
                                  let optColor = 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent';
                                  if (isSelected) optColor = 'bg-primary/20 text-primary border border-primary/30';
                                  return (
                                    <button
                                      key={`s-drop-${seasonNum}`}
                                      type="button"
                                      onClick={() => {
                                        setViewedSeason(seasonNum);
                                        setSeasonDropdownOpen(false);
                                      }}
                                      className={`w-full flex-shrink-0 flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-all ${optColor}`}
                                    >
                                      <span>{seasonNum === 0 ? 'Especiais' : `Temporada ${seasonNum}`}</span>
                                      <span className="text-[10px] opacity-60 font-medium">({epsCount} eps)</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      selectedItem.formato !== 'MOVIE' && <div /> // empty column for grid alignment
                    )}

                    {/* 3. Toggle Episodes List Button Column */}
                    {selectedItem.formato !== 'MOVIE' ? (
                      <div className="flex justify-end h-[46px] items-center">
                        <button 
                          type="button"
                          onClick={() => setShowEpList(!showEpList)}
                          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex items-center gap-2 text-xs font-bold text-white cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-sm">grid_view</span>
                          {showEpList ? 'Esconder Lista de Episódios' : 'Mostrar Lista de Episódios'}
                        </button>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>

                  <p className="text-xs text-on-surface-variant italic leading-relaxed">
                    {selectedItem.formato === 'MOVIE' ? 'Este filme' : 'Este anime'} ainda não estreou.{releaseDateFormatted ? ` Estreia a ${releaseDateFormatted}.` : ''} Quando estrear, poderás alterar o estado.
                  </p>

                  {/* Desktop Episodes List Grid */}
                  {showEpList && selectedItem.formato !== 'MOVIE' && (
                    <div className="w-full mt-6 border-t border-white/10 pt-6 animate-in slide-in-from-top-4 duration-300 text-left">
                      {loadingEpisodes ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        viewedEpisodes && viewedEpisodes.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {viewedEpisodes.map((ep: any) => {
                              const isSpecial = ep.season === 0;
                              const airTime = new Date(ep.air_date).getTime();
                              const nowTime = new Date().getTime();
                              const hasAired = ep.air_date ? airTime <= nowTime : true;
                              
                              return (
                                <div 
                                  key={ep.id || ep.episode_number} 
                                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 border border-white/[0.02] transition-colors group cursor-pointer"
                                  onClick={() => setSelectedEpisodeDetails({ ...ep, season: ep.season !== undefined ? ep.season : (viewedSeason || 1) })}
                                >
                                  {ep.still_path ? (
                                    <img 
                                      src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                      alt={`Episódio ${ep.episode_number}`}
                                      className="w-24 aspect-video object-cover rounded-xl border border-white/10 flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-24 aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-on-surface-variant/30">
                                      <span className="material-symbols-outlined text-lg">movie</span>
                                    </div>
                                  )}
                                  <div className="flex-grow min-w-0">
                                    <h5 className="text-xs font-bold text-white truncate flex items-center gap-2">
                                      <span className="text-primary">
                                        {isSpecial ? `Especial ${ep.episode_number}` : `Ep. ${ep.episode_number}`}
                                      </span>
                                      {ep.name && <span className="text-gray-400 font-medium truncate">— {ep.name}</span>}
                                    </h5>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                                        {ep.air_date ? new Date(ep.air_date).toLocaleDateString('pt-PT') : 'Data Indisponível'}
                                        {!hasAired && (
                                          <>
                                            <span className="text-white/10 mx-1.5">•</span>
                                            <span className="text-amber-500 text-[9px] font-extrabold uppercase tracking-wider">Por estrear</span>
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <div className="w-9 h-9 flex items-center justify-center text-on-surface-variant/30 font-bold" title="Não estreado">
                                      <span className="material-symbols-outlined text-sm">schedule</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-on-surface-variant/60 text-center py-4">
                            Nenhum episódio disponível para esta temporada.
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop layout */}
                <div className={`grid grid-cols-1 ${selectedItem.formato === 'MOVIE' ? 'max-w-xs' : 'md:grid-cols-3'} gap-6 items-end`}>
                  {/* 1. Tracking Status Column */}
                  <div className="relative flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                      Estado de Acompanhamento
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
                            type="button"
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
                                      type="button"
                                      onClick={() => {
                                        atualizarCampo('status', opt.value);
                                        setStatusDropdownOpen(false);
                                      }}
                                      className={`w-full flex-shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-all ${optColor}`}
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

                  {selectedItem.formato !== 'MOVIE' && (
                    <>
                      {/* 2. Season Selector Column */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                      {mediaType === 'anime' ? (viewedSeason === 0 ? 'Especiais' : `Temporada ${viewedSeason}`) : 'Progresso'}
                    </label>
                    
                    {mediaType === 'anime' ? (
                      <div className="relative w-full">
                        <button
                          type="button"
                          onClick={() => setSeasonDropdownOpen(!seasonDropdownOpen)}
                          className="w-full flex items-center justify-between bg-[#18181c] text-white border border-white/10 hover:border-white/20 px-4 py-2.5 rounded-2xl outline-none focus:border-primary/50 text-xs font-bold cursor-pointer transition-all h-[46px] relative text-left"
                        >
                          {(() => {
                            const epsCount = getEpisodesCountForSeason(viewedSeason || 1);
                            return (
                              <div className="flex items-center gap-1.5 justify-between w-full pr-1.5 min-w-0">
                                <span className="truncate">{viewedSeason === 0 ? 'Especiais' : `Temporada ${viewedSeason}`}</span>
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
                                  uniqueSeasonNums = [viewedSeason || 1];
                                }

                                return uniqueSeasonNums.map((seasonNum: number) => {
                                  const epsCount = getEpisodesCountForSeason(seasonNum);
                                  const isSelected = viewedSeason === seasonNum;
                                  let optColor = 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent';
                                  if (isSelected) optColor = mediaType === 'anime' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/20 text-secondary border-secondary/30';

                                  return (
                                    <button
                                      key={`s-drop-${seasonNum}`}
                                      type="button"
                                      onClick={() => {
                                        setViewedSeason(seasonNum);
                                        setSeasonDropdownOpen(false);
                                      }}
                                      className={`w-full flex-shrink-0 flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-all ${optColor}`}
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
                          style={{ width: `${Math.min(100, (((mediaType === 'anime' ? (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) : selectedItem.capAtual) / (totalEpisodesAllSeasons || 1)) * 100))}%` }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white animate-pulse" />
                        </div>
                      </div>

                      {/* Big digits with quick watch buttons */}
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={() => atualizarProgresso(-1)} 
                          disabled={isSavingDetailsProgress} 
                          title="Subtrair 1" 
                          className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-on-surface-variant hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-base">remove</span>
                        </button>

                        <div className="text-center min-w-[45px]">
                          <span className={`font-black text-xl ${mediaType === 'anime' ? 'text-primary-light' : 'text-secondary-light'}`}>
                            {mediaType === 'anime' ? (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) : (selectedItem.capAtual || 0)}
                          </span>
                          <span className="text-on-surface-variant font-medium text-sm mx-1">/</span>
                          <span className="text-on-surface-variant font-bold text-sm">
                            {totalEpisodesAllSeasons || '?'}
                          </span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => atualizarProgresso(1)} 
                          disabled={
                            isSavingDetailsProgress || 
                            (mediaType === 'anime' && (selectedItem.epAtualGlobal || selectedItem.epAtual || 0) >= totalAiredEpisodes)
                          } 
                          title="Adicionar 1" 
                          className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95 font-bold ${mediaType === 'anime' ? 'bg-primary text-on-primary shadow-sm hover:bg-primary/80' : 'bg-secondary text-on-secondary shadow-sm hover:bg-secondary/80'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <span className="material-symbols-outlined text-base">add</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setShowEpList(!showEpList)}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex items-center gap-2 text-xs font-bold text-white cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-sm">grid_view</span>
                        {showEpList ? 'Esconder Lista de Episódios' : 'Mostrar Lista de Episódios'}
                      </button>
                    </div>
                  </div>
                    </>
                  )}
                </div>

                {/* Episode List grid / scroll panel */}
                {showEpList && selectedItem.formato !== 'MOVIE' && (
                  <div className="w-full mt-6 border-t border-white/10 pt-6 animate-in slide-in-from-top-4 duration-300 text-left">
                    {loadingEpisodes ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className={`w-6 h-6 animate-spin ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`} />
                      </div>
                    ) : mediaType === 'anime' ? (
                      viewedEpisodes && viewedEpisodes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {viewedEpisodes.map((ep: any) => {
                            const isSpecial = ep.season === 0;
                            const isWatched = isSpecial
                              ? (Array.isArray(selectedItem.watchedSpecials) && selectedItem.watchedSpecials.includes(ep.episode_number))
                              : (ep.globalEpisodeNumber || getGlobalEpisodeNumber(ep.season, ep.episode_number)) <= (selectedItem.epAtualGlobal || selectedItem.epAtual || 0);

                            const airTime = new Date(ep.air_date).getTime();
                            const nowTime = new Date().getTime();
                            const hasAired = ep.air_date ? airTime <= nowTime : true;
                            
                            return (
                              <div 
                                key={ep.id || ep.episode_number} 
                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 border border-white/[0.02] transition-colors group cursor-pointer"
                                onClick={() => setSelectedEpisodeDetails({ ...ep, season: ep.season !== undefined ? ep.season : (viewedSeason || 1) })}
                              >
                                {ep.still_path ? (
                                  <img 
                                    src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                    alt={`Episódio ${ep.episode_number}`}
                                    className="w-24 aspect-video object-cover rounded-xl border border-white/10 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-24 aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-on-surface-variant/30">
                                    <span className="material-symbols-outlined text-lg">movie</span>
                                  </div>
                                )}
                                <div className="flex-grow min-w-0">
                                  <h5 className="text-xs font-bold text-white truncate flex items-center gap-2">
                                    <span className={isSpecial ? 'text-secondary' : 'text-primary'}>
                                      {isSpecial ? `Especial ${ep.episode_number}` : `Ep. ${ep.episode_number}`}
                                    </span>
                                    {ep.name && <span className="text-gray-400 font-medium truncate">— {ep.name}</span>}
                                  </h5>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                                      {ep.air_date ? new Date(ep.air_date).toLocaleDateString('pt-PT') : 'Data Indisponível'}
                                      {!hasAired && (
                                        <>
                                          <span className="text-white/10 mx-1.5">•</span>
                                          <span className="text-amber-500 text-[9px] font-extrabold uppercase tracking-wider">Por estrear</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {hasAired ? (
                                    <button
                                      type="button"
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
                                          ? 'bg-primary text-on-primary scale-105 shadow-sm'
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
                                  type="button"
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
                                      ? 'bg-primary text-on-primary scale-105 shadow-md'
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
                            <button 
                              key={num} 
                              type="button"
                              onClick={() => atualizarCampo('capAtual', num)} 
                              disabled={isSavingDetailsProgress} 
                              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${isWatched ? 'bg-secondary text-on-secondary scale-105 shadow-md' : 'bg-surface-variant/30 text-on-surface-variant border border-white/5'}`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
              )
            )
          )}
        </div>
      </div>

      {/* 2. Personal Links & Library Deletion */}
      {!selectedItem.isExternal && (
        <div className="space-y-6">

          {/* List Management and Library Removal triggers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <button 
              type="button"
              onClick={handleOpenListsModal}
              className="w-full bg-[#18181c]/40 hover:bg-[#18181c]/80 border border-white/10 hover:border-white/20 text-white py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2.5 text-sm active:scale-95 shadow-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">format_list_bulleted</span>
              GERIR NAS LISTAS
            </button>

            {showDeleteConfirm ? (
              <div className="p-4 rounded-2xl bg-error/10 border border-error/30 animate-in fade-in zoom-in-95 duration-300 space-y-3 shadow-lg text-left">
                <div className="flex items-center gap-2.5 text-error">
                  <span className="material-symbols-outlined text-lg">warning</span>
                  <h5 className="font-bold text-sm">Remover Conteúdo</h5>
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
                className="w-full bg-error/10 hover:bg-error text-error hover:text-on-error py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2.5 text-sm border border-error/25 active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                REMOVER DA BIBLIOTECA
              </button>
            )}
          </div>

          {/* Watch/Read Personal Links */}
          <div className="space-y-4 pt-6 border-t border-white/5 text-left">
            <div className="flex justify-between items-center gap-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                Links Personalizados
              </h3>
              <button
                type="button"
                onClick={() => setShowAddLink(!showAddLink)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${showAddLink ? 'bg-primary text-on-primary border-primary' : 'bg-white/5 border-white/10 text-white'}`}
              >
                {showAddLink ? 'Cancelar' : 'Adicionar Link'}
              </button>
            </div>

            {showAddLink && (
              <div className="p-4 bg-black/40 border border-white/10 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">Nome do Website</label>
                    <input
                      type="text"
                      placeholder="Ex: Crunchyroll"
                      value={newLinkSite}
                      onChange={(e) => setNewLinkSite(e.target.value)}
                      className="w-full bg-black/40 text-white font-bold p-2.5 rounded-xl border border-white/10 outline-none text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">URL do Link</label>
                    <input
                      type="url"
                      placeholder="Ex: https://..."
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      className="w-full bg-black/40 text-white font-bold p-2.5 rounded-xl border border-white/10 outline-none text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={adicionarLinkPessoal}
                  disabled={!newLinkSite.trim() || !newLinkUrl.trim()}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mediaType === 'anime' ? 'bg-primary text-on-primary hover:bg-primary/80' : 'bg-secondary text-on-secondary hover:bg-secondary/80'} disabled:opacity-50`}
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Gravar Link</span>
                </button>
              </div>
            )}

            {linksPessoais.length > 0 ? (
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
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); eliminarLinkPessoal(link.site); }} 
                        className="text-red-400 hover:text-red-300 p-1 flex items-center justify-center cursor-pointer" 
                        title="Remover link"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                      <span onClick={() => abrirLink(link.url, selectedItem.titulo)} className="material-symbols-outlined text-sm cursor-pointer text-on-surface-variant">chevron_right</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !showAddLink && <p className="text-xs text-on-surface-variant italic">Ainda sem links personalizados.</p>
            )}
          </div>
        </div>
      )}

      {selectedEpisodeDetails && (
        <EpisodeDetailsModal
          isOpen={!!selectedEpisodeDetails}
          onClose={() => setSelectedEpisodeDetails(null)}
          episode={selectedEpisodeDetails}
          animeId={selectedItem.isExternal ? selectedItem.id : (selectedItem.animeId || selectedItem.id)}
          isWatched={
            selectedEpisodeDetails.season === 0
              ? (Array.isArray(selectedItem.watchedSpecials) && selectedItem.watchedSpecials.includes(selectedEpisodeDetails.episode_number))
              : (selectedEpisodeDetails.globalEpisodeNumber || getGlobalEpisodeNumber(selectedEpisodeDetails.season, selectedEpisodeDetails.episode_number)) <= (selectedItem.epAtualGlobal || selectedItem.epAtual || 0)
          }
          onToggleWatch={() => {
            if (selectedEpisodeDetails.season === 0) {
              const currentSpecials = Array.isArray(selectedItem.watchedSpecials)
                ? selectedItem.watchedSpecials
                : [];
              const isAlreadyWatched = currentSpecials.includes(selectedEpisodeDetails.episode_number);
              const updatedSpecials = isAlreadyWatched
                ? currentSpecials.filter((n: number) => n !== selectedEpisodeDetails.episode_number)
                : [...currentSpecials, selectedEpisodeDetails.episode_number];
              atualizarCampo('watchedSpecials', updatedSpecials);
            } else {
              const globalEpNum = selectedEpisodeDetails.globalEpisodeNumber || getGlobalEpisodeNumber(selectedEpisodeDetails.season, selectedEpisodeDetails.episode_number);
              const isEpWatched = globalEpNum <= (selectedItem.epAtualGlobal || selectedItem.epAtual || 0);
              if (isEpWatched) {
                atualizarCampo('epAtual', globalEpNum - 1);
              } else {
                atualizarCampo('epAtual', globalEpNum);
              }
            }
          }}
          mediaType={mediaType}
        />
      )}
    </div>
  );
};
