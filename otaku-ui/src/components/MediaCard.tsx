import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface MediaCardProps {
  titulo: string;
  capaUrl: string;
  generos?: any;
  ranking?: number;
  progresso?: string;
  onClick: () => void;
  index?: number;
}

const MediaCard: React.FC<MediaCardProps> = ({ 
  titulo, 
  capaUrl, 
  ranking, 
  progresso, 
  onClick,
  index = 0
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <motion.div 
      className="group cursor-pointer space-y-3 select-none"
      onClick={onClick}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.35, 
        delay: Math.min(index * 0.04, 0.4),
        ease: [0.22, 1, 0.36, 1] as const
      }}
      whileHover={{ scale: 1.04, y: -6 }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-lg transition-shadow duration-300 group-hover:shadow-2xl group-hover:shadow-primary/25 border border-white/5 group-hover:border-primary/30">
        {/* Placeholder / Skeleton Loader */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-surface-container-high animate-pulse" />
        )}

        {/* Imagem do Anime / Mangá */}
        <img 
          src={capaUrl} 
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          alt={titulo}
          onLoad={() => setImageLoaded(true)}
          loading="lazy"
        />

        {/* Overlay em degradê */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-70 group-hover:opacity-85 transition-opacity duration-300"></div>

        {/* Informação no fundo do card */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          {progresso && (
            <motion.span 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold mb-2 bg-primary text-on-primary shadow-sm tracking-wide"
            >
              {progresso}
            </motion.span>
          )}
          <p className="font-bold text-sm text-white line-clamp-2 leading-snug drop-shadow-md group-hover:text-primary-light transition-colors">
            {titulo}
          </p>
        </div>

        {/* Badge de Ranking */}
        {ranking && (
          <div className="absolute top-3.5 right-3.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 text-white border border-white/10 shadow-md z-10">
            <span className="material-symbols-outlined text-[12px] text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> #{ranking}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MediaCard;
