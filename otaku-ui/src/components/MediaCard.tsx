import React from 'react';

interface MediaCardProps {
  titulo: string;
  capaUrl: string;
  generos?: string;
  ranking?: number;
  progresso?: string;
  onClick: () => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ titulo, capaUrl, generos, ranking, progresso, onClick }) => {
  const generosArray = generos ? generos.split(',').slice(0, 2) : [];

  return (
    <div 
      onClick={onClick}
      className="group cursor-pointer flex flex-col bg-[#1a1c23] rounded-2xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
    >
      {/* Cover Image Area */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img 
          src={capaUrl} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
          alt={titulo} 
        />
        
        {/* Overlay Badges */}
        {ranking && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-purple-600 rounded-lg text-xs font-black shadow-lg border border-purple-400/30">
            #{ranking}
          </div>
        )}
        
        {progresso && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black border border-white/10 uppercase tracking-tighter">
            {progresso}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-transparent to-transparent opacity-60"></div>
      </div>

      {/* Info Area */}
      <div className="p-4 flex flex-col gap-2">
        <h3 className="font-bold text-sm line-clamp-2 leading-snug group-hover:text-purple-400 transition-colors">
          {titulo}
        </h3>
        
        <div className="flex flex-wrap gap-1">
          {generosArray.map((g, i) => (
            <span key={i} className="text-[9px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded-md uppercase font-bold tracking-wider">
              {g.trim()}
            </span>
          ))}
          {generos && generos.split(',').length > 2 && (
            <span className="text-[9px] text-gray-600 font-bold px-1">...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaCard;
