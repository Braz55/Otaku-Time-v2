import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useTranslation } from '../hooks/useTranslation';
import { RefreshCw, Eye, EyeOff, Tag, Grid } from 'lucide-react';

interface GenreTag {
  id: number;
  name: string;
  type: 'GENRE' | 'TAG';
  category: string;
  subcategory: string;
  isAdult: boolean;
  isExposed: boolean;
}

const ExplorePage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState<GenreTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyExposed, setShowOnlyExposed] = useState(true);

  const fetchGenresAndTags = async () => {
    setLoading(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/anime/genres-and-tags`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        console.error("Failed to fetch genres and tags:", res.status);
      }
    } catch (error) {
      console.error("Error loading genres/tags:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGenresAndTags();
  }, [token]);

  // Filter items based on exposed toggle
  const filteredItems = showOnlyExposed 
    ? items.filter(item => item.isExposed) 
    : items;

  // Group items by type, then category, then subcategory
  const genres = filteredItems.filter(item => item.type === 'GENRE');
  const tags = filteredItems.filter(item => item.type === 'TAG');

  const groupedTags: Record<string, Record<string, GenreTag[]>> = {};
  tags.forEach(tag => {
    if (!groupedTags[tag.category]) {
      groupedTags[tag.category] = {};
    }
    if (!groupedTags[tag.category][tag.subcategory]) {
      groupedTags[tag.category][tag.subcategory] = [];
    }
    groupedTags[tag.category][tag.subcategory].push(tag);
  });

  return (
    <div className="p-4 md:p-8 min-h-screen bg-background text-on-background max-w-full overflow-hidden">
      {/* Top Banner/Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">explore</span>
            {t("Explorar")}
          </h1>
          <p className="text-sm text-white/60 mt-1">
            {t("Descobre novos animes e mangás filtrando por géneros e tags.")}
          </p>
        </div>

        {/* Filters/Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-surface-dim/40 backdrop-blur-md p-2 rounded-2xl border border-white/5 shadow-lg">
          <button 
            onClick={() => setShowOnlyExposed(!showOnlyExposed)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
              showOnlyExposed 
                ? 'bg-primary text-on-primary shadow-md shadow-primary/20' 
                : 'bg-white/5 hover:bg-white/10 text-white/80'
            }`}
          >
            {showOnlyExposed ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{showOnlyExposed ? t("Apenas Expostas") : t("Mostrar Todas")}</span>
          </button>
          
          <button 
            onClick={fetchGenresAndTags} 
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-sm text-white/50">{t("A carregar tags e géneros...")}</p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* 1. Genres Section */}
          {genres.length > 0 && (
            <section className="bg-surface-dim/20 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-4">
                <Grid size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-white">{t("Géneros Principais")}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary-light font-medium">
                  {genres.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {genres.map(genre => (
                  <div 
                    key={genre.id}
                    className={`relative overflow-hidden group cursor-pointer px-4.5 py-2.5 rounded-2xl border text-sm font-semibold transition-all duration-300 bg-gradient-to-br from-primary/15 to-secondary/15 hover:from-primary/25 hover:to-secondary/25 border-primary/30 text-white shadow-sm hover:shadow-md hover:scale-[1.02]`}
                  >
                    {genre.name}
                    {genre.isAdult && (
                      <span className="ml-1.5 text-[10px] text-red-400 font-extrabold uppercase tracking-wide bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">
                        18+
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. Tags grouped by Categories */}
          <div className="space-y-8">
            {Object.entries(groupedTags).map(([category, subcategories]) => (
              <section key={category} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <Tag size={18} className="text-secondary-light" />
                  <h2 className="text-lg font-extrabold text-white tracking-wide uppercase">{category}</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.entries(subcategories).map(([subcategory, tagList]) => (
                    <div 
                      key={subcategory} 
                      className="bg-surface-container-low/40 backdrop-blur-md rounded-2xl p-5 border border-white/5 shadow-md flex flex-col"
                    >
                      <h3 className="text-sm font-bold text-secondary-light/90 mb-3 flex justify-between items-center">
                        <span>{subcategory}</span>
                        <span className="text-[10px] bg-white/5 text-white/50 px-2 py-0.5 rounded-full font-medium">
                          {tagList.length}
                        </span>
                      </h3>
                      
                      <div className="flex flex-wrap gap-2">
                        {tagList.map(tag => (
                          <div 
                            key={tag.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 select-none ${
                              tag.isExposed 
                                ? 'bg-secondary/10 hover:bg-secondary/20 border-secondary/30 text-white hover:scale-[1.02]' 
                                : 'bg-white/5 border-white/5 text-white/40 cursor-not-allowed opacity-50'
                            }`}
                            title={tag.isExposed ? `${tag.name} (Exposta)` : `${tag.name} (Oculta nos filtros)`}
                          >
                            <span>{tag.name}</span>
                            
                            {tag.isAdult && (
                              <span className="text-[8px] leading-none text-red-400 font-extrabold bg-red-500/10 px-1 py-0.5 rounded border border-red-500/20">
                                18+
                              </span>
                            )}

                            {!tag.isExposed && (
                              <EyeOff size={10} className="text-white/30" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

        </div>
      )}
    </div>
  );
};

export default ExplorePage;
