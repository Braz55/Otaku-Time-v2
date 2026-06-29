import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Grid, Plus, Tag, X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export interface GenreTag {
  id: number;
  name: string;
  type: 'GENRE' | 'TAG';
  category: string;
  subcategory: string;
  isAdult: boolean;
  isExposed: boolean;
}

interface GenreTagPickerProps {
  metadata: GenreTag[];
  selectedGenres: string[];
  selectedTags: string[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggleGenre: (name: string) => void;
  onToggleTag: (name: string) => void;
  onClear: () => void;
  hideInlineTrigger?: boolean;
}

const GenreTagPicker = ({
  metadata,
  selectedGenres,
  selectedTags,
  isOpen,
  onOpen,
  onClose,
  onToggleGenre,
  onToggleTag,
  onClear,
  hideInlineTrigger = false,
}: GenreTagPickerProps) => {
  const { t } = useTranslation();
  const genresList = metadata.filter(m => m.type === 'GENRE');
  const tagsList = metadata.filter(m => m.type === 'TAG');
  const groupedTags: Record<string, Record<string, GenreTag[]>> = {};

  tagsList.forEach(tag => {
    if (!groupedTags[tag.category]) groupedTags[tag.category] = {};
    if (!groupedTags[tag.category][tag.subcategory]) groupedTags[tag.category][tag.subcategory] = [];
    groupedTags[tag.category][tag.subcategory].push(tag);
  });

  const categories: string[] = [];
  if (genresList.length > 0) {
    categories.push('GENRE');
  }
  categories.push(...Object.keys(groupedTags));

  const [activeCategory, setActiveCategory] = useState<string>('GENRE');
  const currentActive = categories.includes(activeCategory) ? activeCategory : (categories[0] || '');

  const getSelectedCount = (cat: string) => {
    if (cat === 'GENRE') {
      return selectedGenres.length;
    }
    const tagsInCat = groupedTags[cat]
      ? Object.values(groupedTags[cat]).flat().map(t => t.name)
      : [];
    return selectedTags.filter(t => tagsInCat.includes(t)).length;
  };

  const [collapsedSubcats, setCollapsedSubcats] = useState<Record<string, boolean>>({});

  const toggleSubcat = (subcatKey: string) => {
    setCollapsedSubcats(prev => ({
      ...prev,
      [subcatKey]: !prev[subcatKey]
    }));
  };

  return (
    <>
      {!hideInlineTrigger && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-bold text-on-surface-variant">Géneros e tags</label>
            {(selectedGenres.length > 0 || selectedTags.length > 0) && (
              <button onClick={onClear} className="text-xs text-primary-light hover:text-primary font-bold">
                Limpar
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center rounded-2xl bg-black/20 border border-white/10 p-3 min-h-[54px]">
            <Tag size={16} className="text-on-surface-variant flex-shrink-0" />
            {selectedGenres.map(genre => (
              <span key={genre} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-on-primary text-xs font-bold">
                {genre}
                <button onClick={() => onToggleGenre(genre)} className="p-0.5 rounded-full hover:bg-black/20">
                  <X size={10} />
                </button>
              </span>
            ))}
            {selectedTags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#00b0ff] text-white text-xs font-bold">
                {tag}
                <button onClick={() => onToggleTag(tag)} className="p-0.5 rounded-full hover:bg-black/20">
                  <X size={10} />
                </button>
              </span>
            ))}
            <button onClick={onOpen} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-white active:scale-95 transition-all">
              <Plus size={12} />
              <span>Adicionar</span>
            </button>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-dim border border-border-glass rounded-3xl w-full max-w-4xl h-[80vh] md:h-[650px] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-border-glass flex justify-between items-center bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <Grid size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-white">Selecionar géneros e tags</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
              {/* Sidebar: Categories */}
              <div className="flex flex-row md:flex-col gap-1.5 p-3 pr-8 md:p-4 border-b md:border-b-0 md:border-r border-border-glass bg-surface-container-low/20 overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:w-60 flex-shrink-0 no-scrollbar">
                {categories.map(cat => {
                  const isSelected = currentActive === cat;
                  const count = getSelectedCount(cat);
                  const displayName = cat === 'GENRE' ? t('Géneros') : cat;

                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`flex-shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap md:w-full md:text-left border active:scale-95 ${
                        isSelected
                          ? 'bg-primary border-primary text-on-primary shadow-sm shadow-primary/25'
                          : 'bg-surface-container border-border-glass text-on-surface-variant hover:bg-surface-container-high hover:text-white'
                      }`}
                    >
                      <span>{displayName}</span>
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
                {currentActive === 'GENRE' ? (
                  <div className="space-y-4">
                    <h3 className="text-xs font-extrabold text-white tracking-wider uppercase flex items-center gap-1.5">
                      <Tag size={14} className="text-primary-light" />
                      <span>{t('Géneros')}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {genresList.map(genre => {
                        const isSelected = selectedGenres.includes(genre.name);
                        return (
                          <button
                            key={genre.id}
                            onClick={() => onToggleGenre(genre.name)}
                            className={`flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                              isSelected
                                ? 'bg-primary border-primary text-on-primary shadow-sm shadow-primary/25'
                                : 'bg-surface-container border-border-glass text-on-surface-variant hover:bg-surface-container-high hover:text-white'
                            }`}
                          >
                            {isSelected && <Check size={12} />}
                            <span>{genre.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
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
                                      onClick={() => onToggleTag(tag.name)}
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
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-glass bg-surface-container-low/40 flex items-center justify-end">
              <button onClick={onClose} className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/80 text-xs font-semibold text-on-primary transition-all shadow-md shadow-primary/10">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GenreTagPicker;
