import React, { useState, useEffect } from 'react';
import { Loader2, X, Image as ImageIcon, Check } from 'lucide-react';
import { customFetch } from '../../services/apiBridge';
import { API_BASE_URL } from '../../config';

interface ArtworkSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaId: number;
  format?: string;
  title?: string;
  token: string | null;
  currentCapaUrl: string;
  currentBannerUrl?: string;
  onSelectCover: (newUrl: string, type: 'cover' | 'banner') => void;
}

export const ArtworkSelectorModal: React.FC<ArtworkSelectorModalProps> = ({
  isOpen,
  onClose,
  mediaId,
  format,
  title,
  token,
  currentCapaUrl,
  currentBannerUrl,
  onSelectCover,
}) => {
  const [loading, setLoading] = useState(true);
  const [posters, setPosters] = useState<string[]>([]);
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'posters' | 'backdrops'>('posters');

  useEffect(() => {
    if (!isOpen || !mediaId) return;
    setLoading(true);

    const fetchImages = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (format) queryParams.append('format', format);
        if (title) queryParams.append('title', title);
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await customFetch(`${API_BASE_URL}/anime/tmdb/${mediaId}/images${queryString}`, {
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          const fetchedPosters = data.posters || [];
          const fetchedBackdrops = data.backdrops || [];
          setPosters(fetchedPosters);
          setBackdrops(fetchedBackdrops);
          if (fetchedPosters.length === 0 && fetchedBackdrops.length > 0) {
            setActiveTab('backdrops');
          }
        } else {
          console.error("Failed to fetch images from backend API:", res.status, res.statusText);
        }
      } catch (err) {
        console.error("Error fetching TMDB images:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [isOpen, mediaId, format, token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#16161a] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-left">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Escolher Capa ou Banner</h3>
              <p className="text-xs text-on-surface-variant">Personaliza as imagens do teu anime/filme</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/5 bg-black/30 px-5 pt-3 gap-4">
          <button
            onClick={() => setActiveTab('posters')}
            className={`pb-3 text-xs font-extrabold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
              activeTab === 'posters'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-white'
            }`}
          >
            Posteres ({posters.length})
          </button>
          {backdrops.length > 0 && (
            <button
              onClick={() => setActiveTab('backdrops')}
              className={`pb-3 text-xs font-extrabold transition-all border-b-2 uppercase tracking-wider cursor-pointer ${
                activeTab === 'backdrops'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-white'
              }`}
            >
              Banners ({backdrops.length})
            </button>
          )}
        </div>

        {/* Modal Content / Gallery Grid */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-on-surface-variant font-bold animate-pulse">A procurar posteres e banners...</p>
            </div>
          ) : activeTab === 'posters' ? (
            posters.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {posters.map((url, idx) => {
                  const isSelected = currentCapaUrl === url;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        onSelectCover(url, 'cover');
                        onClose();
                      }}
                      className={`relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all group ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/50 scale-95 shadow-xl'
                          : 'border-white/10 hover:border-white/40 hover:scale-[1.02]'
                      }`}
                    >
                      <img src={url} className="w-full h-full object-cover" alt={`Poster ${idx}`} loading="lazy" />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-primary text-on-primary w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                          <Check className="w-3.5 h-3.5 font-bold" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-extrabold text-white">
                        Aplicar Capa
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-on-surface-variant font-bold">
                Nenhum poster alternativo encontrado para este item.
              </div>
            )
          ) : (
            backdrops.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {backdrops.map((url, idx) => {
                  const isSelected = currentBannerUrl === url;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        onSelectCover(url, 'banner');
                        onClose();
                      }}
                      className={`relative aspect-video rounded-2xl overflow-hidden cursor-pointer border-2 transition-all group ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/50 scale-95 shadow-xl'
                          : 'border-white/10 hover:border-white/40 hover:scale-[1.02]'
                      }`}
                    >
                      <img src={url} className="w-full h-full object-cover" alt={`Banner ${idx}`} loading="lazy" />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-primary text-on-primary w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                          <Check className="w-3.5 h-3.5 font-bold" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-extrabold text-white">
                        Aplicar Banner
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-on-surface-variant font-bold">
                Nenhum banner alternativo encontrado para este item.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
