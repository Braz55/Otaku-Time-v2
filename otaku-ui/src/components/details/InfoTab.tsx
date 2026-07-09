import React from 'react';
import { Loader2 } from 'lucide-react';

interface InfoTabProps {
  selectedItem: any;
  mediaType: 'anime' | 'manga';
  loadingLatest: boolean;
  latestChapter: number | null;
  latestChapterSource: string | null;
  latestChapterError: string | null;
  latestBreakdown: any[];
  showAddLink: boolean;
  setShowAddLink: (show: boolean) => void;
  newLinkSite: string;
  setNewLinkSite: (val: string) => void;
  newLinkUrl: string;
  setNewLinkUrl: (val: string) => void;
  adicionarLinkPessoal: () => void;
  abrirLink: (url: string, title: string) => void;
  overallRating: any;
  totalEpisodesAllSeasons: number;
  commentsElement?: React.ReactNode;
}

export const InfoTab: React.FC<InfoTabProps> = ({
  selectedItem,
  mediaType,
  loadingLatest,
  latestChapter,
  latestChapterSource,
  latestChapterError,
  latestBreakdown,
  showAddLink,
  setShowAddLink,
  newLinkSite,
  setNewLinkSite,
  newLinkUrl,
  setNewLinkUrl,
  adicionarLinkPessoal,
  abrirLink,
  overallRating,
  totalEpisodesAllSeasons,
  commentsElement,
}) => {
  const linksOficiais = selectedItem.linksExternos ? JSON.parse(selectedItem.linksExternos).map((l: any) => ({ ...l, tipo: 'Official' })) : [];

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300 text-left">
      {/* Synopsis Section */}
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2 text-white">
          <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
          Sinopse
        </h3>
        <p className="text-on-surface-variant leading-relaxed text-sm mt-3">
          {selectedItem.descricao || "Sem sinopse disponível."}
        </p>
        
        {mediaType === 'manga' && (
          <div className="flex items-center gap-2.5 mt-3">
            {loadingLatest ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-variant/40 rounded-full border border-white/5 animate-pulse text-[10px] font-bold text-on-surface-variant">
                <Loader2 className="w-3.5 h-3.5 text-secondary animate-spin" />
                <span>A verificar fontes...</span>
              </div>
            ) : latestChapter ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-[10px] font-bold">
                <span className="material-symbols-outlined text-xs">auto_awesome</span>
                <span>Último capítulo em {latestChapterSource}: {latestChapter}</span>
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

      {/* Season/Chapter Breakdown (MangaDex, etc.) */}
      {mediaType === 'manga' && latestBreakdown && latestBreakdown.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-white/5 animate-in fade-in">
          <h3 className="text-sm font-bold flex items-center gap-2 text-white">
            <span className="w-1 h-4 rounded-full bg-secondary"></span>
            Breakdown por Volume
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {latestBreakdown.map((b: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-primary/20 rounded-xl">
                <span className="text-xs font-bold text-white truncate pr-2">{b.label}</span>
                <span className="px-2.5 py-1 bg-secondary/15 text-secondary text-xs font-black rounded-lg border border-secondary/20 flex-shrink-0">
                  {b.chapters} Caps
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Official Where to Watch/Read links */}
      {(linksOficiais.length > 0 || (!selectedItem.isExternal)) && (
        <div className="space-y-4 pt-6 border-t border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-white">
              <span className={`w-1 h-4 rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
              Onde {mediaType === 'anime' ? 'Assistir' : 'Ler'}
            </h3>
            {!selectedItem.isExternal && (
              <button 
                type="button"
                onClick={() => setShowAddLink(!showAddLink)} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all text-xs border cursor-pointer ${mediaType === 'anime' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}
              >
                <span className="material-symbols-outlined text-[16px]">add</span> ADICIONAR LINK
              </button>
            )}
          </div>

          {showAddLink && !selectedItem.isExternal && (
            <div className="flex flex-col sm:flex-row gap-2.5 p-3 bg-surface-variant/30 border border-white/10 rounded-xl animate-in slide-in-from-top-4">
              <input 
                type="text" 
                placeholder="Nome (Ex: Crunchyroll)" 
                value={newLinkSite} 
                onChange={e => setNewLinkSite(e.target.value)} 
                className="flex-grow bg-black/30 px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-primary transition-all text-xs text-white" 
              />
              <input 
                type="url" 
                placeholder="URL (https://...)" 
                value={newLinkUrl} 
                onChange={e => setNewLinkUrl(e.target.value)} 
                className="flex-[2] bg-black/30 px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-primary transition-all text-xs text-white" 
              />
              <button 
                type="button"
                onClick={adicionarLinkPessoal} 
                disabled={!newLinkSite || !newLinkUrl} 
                className="px-5 py-2 bg-primary hover:bg-primary/80 disabled:bg-surface-variant disabled:text-on-surface-variant text-on-primary rounded-lg font-bold transition-all text-xs cursor-pointer"
              >
                GRAVAR
              </button>
            </div>
          )}

          {linksOficiais.length > 0 ? (
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
          ) : (
            <p className="text-xs text-on-surface-variant italic">Ainda sem links oficiais.</p>
          )}
        </div>
      )}

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-white/5">
        <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
          <span className="material-symbols-outlined text-lg mb-2 text-on-surface-variant">sensors</span>
          <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">Estado Lançamento</p>
          <p className="font-bold text-xs text-white">
            {selectedItem.statusLancamento || 'Desconhecido'}
          </p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
          <span className="material-symbols-outlined text-lg mb-2 text-on-surface-variant">calendar_month</span>
          <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">Época / Ano</p>
          <p className="font-bold text-xs text-white capitalize">
            {selectedItem.temporada ? `${selectedItem.temporada.toLowerCase()} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A'}
          </p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5">
          <span className="material-symbols-outlined text-lg mb-2 text-on-surface-variant">update</span>
          <p className="text-on-surface-variant text-[9px] uppercase font-bold tracking-widest mb-0.5">{mediaType === 'anime' ? 'Total Episódios' : 'Total Capítulos'}</p>
          <p className="font-bold text-xs text-white">
            {totalEpisodesAllSeasons || 'N/A'}
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

      {/* Render comments here if passed */}
      {commentsElement}
    </div>
  );
};
