import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface CustomListsModalProps {
  showListsModal: boolean;
  setShowListsModal: (show: boolean) => void;
  selectedItem: any;
  mediaType: 'anime' | 'manga';
  loadingLists: boolean;
  lists: any[];
  getMediaId: () => number;
  toggleItemInList: (listId: number, isCurrentlyInList: boolean) => void;
  navigate: any;
  showPriorityModal: boolean;
  setShowPriorityModal: (show: boolean) => void;
  atualizarCampo: (field: string, val: any) => void;
  t: (key: string) => string;
  showListRemovalConfirm: boolean;
  setShowListRemovalConfirm: (show: boolean) => void;
  listsWithMedia: any[];
  isDeletingFromLists: boolean;
  handleRemoveFromEverything: () => void;
  handleRemoveFromLibraryOnly: () => void;
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

export const CustomListsModal: React.FC<CustomListsModalProps> = ({
  showListsModal,
  setShowListsModal,
  selectedItem,
  mediaType,
  loadingLists,
  lists,
  getMediaId,
  toggleItemInList,
  navigate,
  showPriorityModal,
  setShowPriorityModal,
  atualizarCampo,
  t,
  showListRemovalConfirm,
  setShowListRemovalConfirm,
  listsWithMedia,
  isDeletingFromLists,
  handleRemoveFromEverything,
  handleRemoveFromLibraryOnly,
}) => {
  return (
    <>
      {showListsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-surface-container rounded-[24px] border border-white/10 shadow-2xl p-6 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display-md text-xl font-extrabold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
                Adicionar às Listas
              </h3>
              <button 
                type="button"
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
                        type="button"
                        onClick={() => toggleItemInList(list.id, isCurrentlyInList)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 cursor-pointer ${
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
              type="button"
              onClick={() => { setShowListsModal(false); navigate('/lists'); }}
              className="mt-6 w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
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
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-4 sm:hidden flex-shrink-0" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display-md text-lg font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                Nível de Prioridade
              </h3>
              <button 
                type="button"
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
                    type="button"
                    onClick={() => {
                      atualizarCampo('prioridade', p.num);
                      setShowPriorityModal(false);
                    }}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] cursor-pointer ${
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

      {showListRemovalConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md bg-surface-container rounded-[24px] border border-white/10 shadow-2xl p-6 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display-md text-lg font-extrabold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-error">warning</span>
                Remover das Listas?
              </h3>
              <button 
                type="button"
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
                type="button"
                onClick={handleRemoveFromEverything}
                disabled={isDeletingFromLists}
                className="w-full bg-error text-on-error py-3 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-error/85 animate-none cursor-pointer"
              >
                {isDeletingFromLists && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Sim, remover de tudo
              </button>
              <button
                type="button"
                onClick={handleRemoveFromLibraryOnly}
                disabled={isDeletingFromLists}
                className="w-full bg-surface-variant hover:bg-surface-variant/80 border border-white/10 text-white py-3 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50 animate-none cursor-pointer"
              >
                Não, manter nas listas
              </button>
              <button
                type="button"
                onClick={() => setShowListRemovalConfirm(false)}
                disabled={isDeletingFromLists}
                className="w-full bg-transparent hover:bg-white/5 text-on-surface-variant hover:text-white py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50 animate-none cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
