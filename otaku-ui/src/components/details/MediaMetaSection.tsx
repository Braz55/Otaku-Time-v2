import React from 'react';
import type { MetaEntry, CastMember } from '../../services/mediaMeta';

interface MediaMetaSectionProps {
  title: string;
  icon: string;
  metadados: MetaEntry[];
  elenco: CastMember[];
  castTitle?: string;
  // Cor dos ícones dos títulos (âmbar nos filmes, cor principal nos animes/séries)
  accentClass?: string;
}

// Grelha de metadados + elenco, partilhada pelos filmes, séries e animes
export const MediaMetaSection: React.FC<MediaMetaSectionProps> = ({
  title,
  icon,
  metadados,
  elenco,
  castTitle = 'Elenco Principal',
  accentClass = 'text-amber-400',
}) => (
  <>
    {metadados.length > 0 && (
      <div className="pt-6 border-t border-white/5 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <span className={`material-symbols-outlined text-base ${accentClass}`}>{icon}</span>
          <h3 className="text-xs font-extrabold uppercase tracking-wider">{title}</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {metadados.map(m => (
            <div key={m.label} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 flex items-start gap-3 min-w-0">
              <span className="material-symbols-outlined text-base text-on-surface-variant flex-shrink-0 mt-0.5">{m.icon}</span>
              <div className="min-w-0">
                <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest mb-0.5">{m.label}</p>
                <p className="text-xs font-bold text-white break-words">{m.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {elenco.length > 0 && (
      <div className="pt-6 border-t border-white/5 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <span className={`material-symbols-outlined text-base ${accentClass}`}>groups</span>
          <h3 className="text-xs font-extrabold uppercase tracking-wider">{castTitle}</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
          {elenco.map((ator, idx) => (
            <div key={`${ator.nome}-${idx}`} className="w-24 flex-shrink-0 text-center">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                {ator.fotoUrl ? (
                  <img src={ator.fotoUrl} className="w-full h-full object-cover" alt={ator.nome} loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
                )}
              </div>
              <p className="text-[11px] font-bold text-white mt-1.5 line-clamp-2">{ator.nome}</p>
              {ator.personagem && (
                <p className="text-[10px] text-on-surface-variant line-clamp-2">{ator.personagem}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
  </>
);
