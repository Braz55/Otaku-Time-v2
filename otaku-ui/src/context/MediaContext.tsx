import React, { createContext, useContext, useState } from 'react';

type Categoria = 'anime' | 'manga';

interface MediaContextType {
  categoria: Categoria;
  setCategoria: (cat: Categoria) => void;
  isShowingFavorites: boolean;
  setIsShowingFavorites: (show: boolean) => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categoria, setCategoria] = useState<Categoria>('anime');
  const [isShowingFavorites, setIsShowingFavorites] = useState(false);

  return (
    <MediaContext.Provider value={{ categoria, setCategoria, isShowingFavorites, setIsShowingFavorites }}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) throw new Error('useMedia must be used within a MediaProvider');
  return context;
};
