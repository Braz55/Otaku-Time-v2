import React, { createContext, useContext, useState } from 'react';

type Categoria = 'anime' | 'manga';

export interface DashboardData {
  items: any[];
  featured: any;
}

interface MediaContextType {
  categoria: Categoria;
  setCategoria: (cat: Categoria) => void;
  isShowingFavorites: boolean;
  setIsShowingFavorites: (show: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  homeTrigger: number;
  triggerHome: () => void;
  isViewingDetails: boolean;
  setIsViewingDetails: (viewing: boolean) => void;
  
  // Cache States
  animeLibraryData: any[];
  setAnimeLibraryData: React.Dispatch<React.SetStateAction<any[]>>;
  mangaLibraryData: any[];
  setMangaLibraryData: React.Dispatch<React.SetStateAction<any[]>>;
  animeDashboardData: DashboardData;
  setAnimeDashboardData: React.Dispatch<React.SetStateAction<DashboardData>>;
  mangaDashboardData: DashboardData;
  setMangaDashboardData: React.Dispatch<React.SetStateAction<DashboardData>>;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categoria, setCategoria] = useState<Categoria>('anime');
  const [isShowingFavorites, setIsShowingFavorites] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [homeTrigger, setHomeTrigger] = useState(0);
  const [isViewingDetails, setIsViewingDetails] = useState(false);

  // Cache States
  const [animeLibraryData, setAnimeLibraryData] = useState<any[]>([]);
  const [mangaLibraryData, setMangaLibraryData] = useState<any[]>([]);
  const [animeDashboardData, setAnimeDashboardData] = useState<DashboardData>({ items: [], featured: null });
  const [mangaDashboardData, setMangaDashboardData] = useState<DashboardData>({ items: [], featured: null });

  const triggerHome = () => {
    setIsShowingFavorites(false);
    setIsSearchOpen(false);
    setSearchTerm('');
    setIsViewingDetails(false);
    setHomeTrigger(prev => prev + 1);
  };

  return (
    <MediaContext.Provider value={{
      categoria,
      setCategoria,
      isShowingFavorites,
      setIsShowingFavorites,
      isSearchOpen,
      setIsSearchOpen,
      searchTerm,
      setSearchTerm,
      homeTrigger,
      triggerHome,
      isViewingDetails,
      setIsViewingDetails,
      animeLibraryData,
      setAnimeLibraryData,
      mangaLibraryData,
      setMangaLibraryData,
      animeDashboardData,
      setAnimeDashboardData,
      mangaDashboardData,
      setMangaDashboardData
    }}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) throw new Error('useMedia must be used within a MediaProvider');
  return context;
};

