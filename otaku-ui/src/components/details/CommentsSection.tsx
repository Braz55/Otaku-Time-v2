import React from 'react';
import { Loader2 } from 'lucide-react';

interface MediaComment {
  id: number;
  userId: number;
  mediaId?: number;
  text: string;
  createdAt: string;
  likes: number;
  user?: {
    nome?: string;
    iconUrl?: string | null;
  };
}

interface CommentsSectionProps {
  overallRating: { avaliacao_geral: number; total_votos_users: number } | null;
  mediaType: 'anime' | 'manga';
  isMobile: boolean;
  token: string | null;
  userRating: number | null;
  votarConteudo: (score: number) => void;
  isSubmittingRating: boolean;
  user: any;
  newCommentText: string;
  setNewCommentText: (val: string) => void;
  enviarComentario: () => void;
  isSubmittingComment: boolean;
  loadingComments: boolean;
  comments: MediaComment[];
  abrirPerfilExterno: (userId: number) => void;
  eliminarComentario: (commentId: number) => void;
  gostarComentario: (commentId: number) => void;
}

const formatCommentDate = (value: string) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  overallRating,
  mediaType,
  isMobile,
  token,
  userRating,
  votarConteudo,
  isSubmittingRating,
  user,
  newCommentText,
  setNewCommentText,
  enviarComentario,
  isSubmittingComment,
  loadingComments,
  comments,
  abrirPerfilExterno,
  eliminarComentario,
  gostarComentario,
}) => {
  const ratingValue = overallRating?.avaliacao_geral ? overallRating.avaliacao_geral.toFixed(1) : 'N/A';

  return (
    <div className={`space-y-6 pt-8 border-t border-white/5 ${isMobile ? '' : 'mt-4'}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className={`${isMobile ? 'text-base' : 'font-headline-lg text-2xl'} font-bold flex items-center gap-3 text-white`}>
          <span className={`${isMobile ? 'w-1 h-4' : 'w-1.5 h-6'} rounded-full ${mediaType === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
          Avaliações e comentários
        </h3>
        <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 ${mediaType === 'anime' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-secondary/10 border-secondary/30 text-secondary'}`}>
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span className="font-black">{ratingValue}</span>
          <span className="text-xs text-on-surface-variant">/ 10</span>
        </div>
      </div>

      {token ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
              {userRating ? `A tua avaliação atual: ${userRating}/10` : 'Dá a tua avaliação'}
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {Array.from({ length: 10 }, (_, index) => index + 1).map(score => {
                const active = userRating === score;
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => votarConteudo(score)}
                    disabled={isSubmittingRating}
                    className={`aspect-square rounded-full border text-sm font-black transition-all active:scale-95 disabled:opacity-60 cursor-pointer ${
                      active
                        ? `${mediaType === 'anime' ? 'bg-primary border-primary text-on-primary shadow-[0_0_18px_rgba(221,184,255,0.35)]' : 'bg-secondary border-secondary text-on-secondary shadow-[0_0_18px_rgba(255,176,203,0.35)]'}`
                        : `bg-surface-variant/30 border-white/10 text-on-surface-variant hover:text-white ${mediaType === 'anime' ? 'hover:border-primary/40 hover:bg-primary/10' : 'hover:border-secondary/40 hover:bg-secondary/10'}`
                    }`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border ${mediaType === 'anime' ? 'border-primary/40 bg-primary/10' : 'border-secondary/40 bg-secondary/10'}`}>
              {user?.iconUrl ? (
                <img src={user.iconUrl} alt={user.nome} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center font-black ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`}>
                  {(user?.nome || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-grow space-y-3">
              <textarea
                value={newCommentText}
                onChange={event => setNewCommentText(event.target.value)}
                placeholder="Escreve um comentário..."
                rows={3}
                className={`w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none resize-none transition-all ${mediaType === 'anime' ? 'focus:border-primary/60' : 'focus:border-secondary/60'}`}
              />
              <button
                type="button"
                onClick={enviarComentario}
                disabled={!newCommentText.trim() || isSubmittingComment}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:bg-surface-variant disabled:text-on-surface-variant disabled:shadow-none cursor-pointer ${mediaType === 'anime' ? 'bg-primary hover:bg-primary/80 text-on-primary' : 'bg-secondary hover:bg-secondary/80 text-on-secondary'}`}
              >
                {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="material-symbols-outlined text-base">send</span>}
                Publicar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`p-4 rounded-2xl border bg-surface-variant/20 text-sm text-on-surface-variant ${mediaType === 'anime' ? 'border-primary/20' : 'border-secondary/20'}`}>
          Inicia sessão para avaliar e comentar este conteúdo.
        </div>
      )}

      <div className="space-y-3">
        {loadingComments ? (
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Loader2 className={`w-4 h-4 animate-spin ${mediaType === 'anime' ? 'text-primary' : 'text-secondary'}`} />
            A carregar comentários...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-5 rounded-2xl border border-white/10 bg-surface-variant/20 text-center text-on-surface-variant text-sm">
            Ninguém comentou ainda. Seja o primeiro a comentar!
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="glass-panel rounded-2xl border border-white/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-9 h-9 rounded-full overflow-hidden bg-surface-variant flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                    onClick={() => abrirPerfilExterno(comment.userId)}
                    title={`Ver perfil de ${comment.user?.nome || 'Utilizador'}`}
                  >
                    {comment.user?.iconUrl ? (
                      <img src={comment.user.iconUrl} alt={comment.user?.nome || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-black text-on-surface-variant">
                        {(comment.user?.nome || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div 
                    className="min-w-0 cursor-pointer group"
                    onClick={() => abrirPerfilExterno(comment.userId)}
                    title={`Ver perfil de ${comment.user?.nome || 'Utilizador'}`}
                  >
                    <p className="font-bold text-white text-sm truncate group-hover:text-primary-light transition-colors">{comment.user?.nome || 'Utilizador'}</p>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">{formatCommentDate(comment.createdAt)}</p>
                  </div>
                </div>
                {comment.userId === user?.id && (
                  <button 
                    type="button"
                    onClick={() => eliminarComentario(comment.id)} 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error/10 transition-all cursor-pointer" 
                    title="Eliminar comentário"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                )}
              </div>
              <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{comment.text}</p>
              <button 
                type="button"
                onClick={() => gostarComentario(comment.id)} 
                className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">favorite</span>
                {comment.likes}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
