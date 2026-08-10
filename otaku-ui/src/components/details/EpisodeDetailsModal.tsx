import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Star, Calendar, Check } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { customFetch } from '../../services/apiBridge';

interface Episode {
  episode_number: number;
  season: number;
  name: string | null;
  air_date: string | null;
  still_path: string | null;
  globalEpisodeNumber?: number | null;
}

interface EpisodeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  episode: Episode;
  animeId: number;
  isWatched: boolean;
  onToggleWatch: () => void;
  mediaType: 'anime' | 'manga';
}

interface EpisodeDetails {
  overview?: string;
  runtime?: number;
  vote_average?: number;
  vote_count?: number;
  crew?: Array<{ name: string; job: string }>;
  guest_stars?: Array<{ name: string; character: string; profile_path: string | null }>;
  main_cast?: Array<{ name: string; character: string; profile_path: string | null }>;
}

export const EpisodeDetailsModal: React.FC<EpisodeDetailsModalProps> = ({
  isOpen,
  onClose,
  episode,
  animeId,
  isWatched,
  onToggleWatch,
}) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<EpisodeDetails | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await customFetch(
          `${API_BASE_URL}/anime/tmdb/${animeId}/season/${episode.season}/episode/${episode.episode_number}`
        );
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
        } else {
          setDetails({});
        }
      } catch (err) {
        console.error('Error fetching episode details:', err);
        setDetails({});
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, animeId, episode.season, episode.episode_number]);

  if (!isOpen) return null;

  // Extract Directors, Writers and Characters
  const directors = details?.crew?.filter((member) => member.job === 'Director') || [];
  const writers = details?.crew?.filter((member) => member.job === 'Writer') || [];
  
  // If guest stars exist, use them. Otherwise fallback to the main cast (characters)
  const guestStars = details?.guest_stars?.slice(0, 6) || [];
  const showCast = guestStars.length > 0 ? guestStars : (details?.main_cast?.slice(0, 6) || []);
  const castTitle = guestStars.length > 0 ? 'Atores Convidados' : 'Personagens Principais';

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formattedDate = episode.air_date
    ? new Date(episode.air_date).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Data indisponível';

  const hasAired = episode.air_date
    ? new Date(episode.air_date).getTime() <= new Date().getTime()
    : true;

  // Resolve still path image: if it's already full url, use it. If not, append tmdb prefix.
  const imageUrl = episode.still_path
    ? episode.still_path.startsWith('http')
      ? episode.still_path
      : `https://image.tmdb.org/t/p/w500${episode.still_path}`
    : null;

  // Render the modal inside document.body using React Portal
  return createPortal(
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#141519]/95 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] text-left">
        
        {/* Banner Image */}
        <div className="w-full aspect-video relative bg-zinc-950 flex-shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={episode.name || `Episódio ${episode.episode_number}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-white/20">
              <span className="material-symbols-outlined text-5xl mb-2">movie</span>
              <span className="text-xs">Sem Imagem Disponível</span>
            </div>
          )}

          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141519] via-transparent to-black/40" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Episode Info Overlay */}
          <div className="absolute bottom-4 left-6 right-6">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              Temporada {episode.season} • EP {episode.episode_number}
            </span>
            <h3 className="text-lg md:text-xl font-black text-white mt-2.5 leading-tight drop-shadow-md">
              {episode.name || `Episódio ${episode.episode_number}`}
            </h3>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-5 text-on-background">
          
          {/* Quick info row (Badges) */}
          <div className="flex flex-wrap gap-2 text-xs font-bold text-on-surface-variant/80 border-b border-white/5 pb-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{formattedDate}</span>
            </div>

            {loading ? (
              <div className="h-7 w-20 bg-white/5 animate-pulse rounded-xl" />
            ) : (
              details?.runtime && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{details.runtime} min</span>
                </div>
              )
            )}

            {loading ? (
              <div className="h-7 w-16 bg-white/5 animate-pulse rounded-xl" />
            ) : (
              details?.vote_average ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-xl">
                  <Star className="w-3.5 h-3.5 fill-yellow-500" />
                  <span>
                    {details.vote_average.toFixed(1)}/10
                  </span>
                </div>
              ) : null
            )}
          </div>

          {/* Synopsis */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-white/50 mb-2">Sinopse</h4>
            {loading ? (
              <div className="space-y-2">
                <div className="h-4 bg-white/5 animate-pulse rounded w-full" />
                <div className="h-4 bg-white/5 animate-pulse rounded w-5/6" />
                <div className="h-4 bg-white/5 animate-pulse rounded w-2/3" />
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-gray-300 font-medium font-sans">
                {details?.overview || 'Sem sinopse disponível para este episódio.'}
              </p>
            )}
          </div>

          {/* Crew & Characters */}
          {!loading && (directors.length > 0 || writers.length > 0 || showCast.length > 0) && (
            <div className="space-y-4 pt-4 border-t border-white/5">
              
              {/* Directors & Writers */}
              {(directors.length > 0 || writers.length > 0) && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {directors.length > 0 && (
                    <div>
                      <h5 className="font-black uppercase tracking-widest text-white/40 mb-1">Diretor</h5>
                      <p className="font-bold text-white truncate">
                        {directors.map((d) => d.name).join(', ')}
                      </p>
                    </div>
                  )}
                  {writers.length > 0 && (
                    <div>
                      <h5 className="font-black uppercase tracking-widest text-white/40 mb-1">Argumentista</h5>
                      <p className="font-bold text-white truncate">
                        {writers.map((w) => w.name).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Characters / Cast */}
              {showCast.length > 0 && (
                <div>
                  <h5 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2.5">{castTitle}</h5>
                  <div className="grid grid-cols-2 gap-2.5 text-xs font-bold">
                    {showCast.map((actor: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.02]">
                        {actor.profile_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                            alt={actor.name}
                            className="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20 flex-shrink-0">
                            <span className="material-symbols-outlined text-[14px]">person</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-white truncate">{actor.character || 'Desconhecido'}</p>
                          <p className="text-[10px] text-on-surface-variant truncate font-medium">{actor.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {hasAired && (
          <div className="p-6 bg-white/[0.02] border-t border-white/10 flex-shrink-0 flex items-center justify-between">
            <span className="text-xs font-extrabold text-on-surface-variant">
              {isWatched ? 'Marcar como não visto?' : 'Viste este episódio?'}
            </span>

            <button
              onClick={onToggleWatch}
              className={`px-5 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-extrabold cursor-pointer transition-all active:scale-95 shadow-md ${
                isWatched
                  ? 'bg-primary text-on-primary hover:bg-primary/90'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10'
              }`}
            >
              {isWatched ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Visto</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">visibility</span>
                  <span>Marcar como Visto</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
