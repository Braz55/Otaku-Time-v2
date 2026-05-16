import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  categoria: 'anime' | 'manga';
  setCategoria: (cat: 'anime' | 'manga') => void;
  onShowFavorites: () => void;
  onShowDashboard: () => void;
}

const Header: React.FC<HeaderProps> = ({ categoria, setCategoria }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-surface/60 backdrop-blur-lg border-b border-white/10 shadow-2xl flex justify-between items-center px-margin-mobile md:px-margin-desktop">
      <h1 className="lg:hidden font-display-lg text-display-lg bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent tracking-tight font-black cursor-pointer" onClick={() => navigate('/')}>
        Otaku-Time
      </h1>
      
      <div className="hidden md:flex gap-8">
        <button 
          onClick={() => setCategoria('anime')}
          className={`font-label-md text-label-md px-4 py-1.5 rounded-full transition-all ${categoria === 'anime' ? 'bg-primary/20 text-primary font-bold border border-primary/30' : 'text-on-surface-variant hover:bg-white/5'}`}
        >
          Anime
        </button>
        <button 
          onClick={() => setCategoria('manga')}
          className={`font-label-md text-label-md px-4 py-1.5 rounded-full transition-all ${categoria === 'manga' ? 'bg-secondary/20 text-secondary font-bold border border-secondary/30' : 'text-on-surface-variant hover:bg-white/5'}`}
        >
          Manga
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-on-surface-variant hover:bg-white/5 rounded-full transition-colors relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full"></span>
        </button>
        <button onClick={logout} className="p-2 text-on-surface-variant hover:text-red-400 hover:bg-white/5 rounded-full transition-colors" title="Logout">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
