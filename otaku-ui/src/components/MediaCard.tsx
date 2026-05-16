import React from 'react';

interface MediaCardProps {
  titulo: string;
  capaUrl: string;
  generos?: string;
  ranking?: number;
  progresso?: string;
  onClick: () => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ titulo, capaUrl, ranking, progresso, onClick }) => {
  return (
    <div className="group cursor-pointer space-y-3" onClick={onClick}>
      <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-lg transform transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1">
        <img src={capaUrl} className="w-full h-full object-cover" alt={titulo} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
        <div className="absolute bottom-4 left-4 right-4 z-10">
          {progresso && (
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-2 bg-primary text-on-primary">
              {progresso}
            </span>
          )}
          <p className="font-bold text-sm text-white line-clamp-2">{titulo}</p>
        </div>
        {ranking && (
          <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 text-white z-10">
            <span className="material-symbols-outlined text-[12px] text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> #{ranking}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaCard;
