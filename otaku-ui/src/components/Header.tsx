import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, User, LogOut, Home, MessageSquare } from 'lucide-react';

interface HeaderProps {
  categoria: 'anime' | 'manga';
  setCategoria: (cat: 'anime' | 'manga') => void;
  onShowFavorites: () => void;
  onShowDashboard: () => void;
}

const Header: React.FC<HeaderProps> = ({ categoria, setCategoria, onShowFavorites, onShowDashboard }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-[#0f1014]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-24 flex items-center justify-between">
        {/* Left Side: Logo + Navigation */}
        <div className="flex items-center gap-10">
          <div 
            onClick={() => navigate('/')} 
            className="cursor-pointer"
          >
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent tracking-tighter">
              OTAKU-TIME
            </h1>
          </div>

          <nav className="hidden lg:flex items-center bg-[#1a1c23] p-1.5 rounded-2xl border border-gray-800 shadow-inner">
            <button 
              onClick={() => setCategoria('anime')}
              className={`px-8 py-3 rounded-xl text-base font-black transition-all ${categoria === 'anime' ? 'bg-purple-600 text-white shadow-lg scale-105' : 'text-gray-500 hover:text-white'}`}
            >
              Anime
            </button>
            <button 
              onClick={() => setCategoria('manga')}
              className={`px-8 py-3 rounded-xl text-base font-black transition-all ${categoria === 'manga' ? 'bg-pink-600 text-white shadow-lg scale-105' : 'text-gray-500 hover:text-white'}`}
            >
              Manga
            </button>
          </nav>
        </div>

        {/* Actions Right */}
        <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={onShowDashboard}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1c23] text-gray-400 rounded-xl hover:text-white transition-all border border-gray-800 font-bold text-sm active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span className="hidden md:inline uppercase tracking-wider">Início</span>
          </button>
          <button 
            onClick={() => navigate('/chat')}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-500/10 text-purple-400 rounded-xl hover:bg-purple-600 hover:text-white transition-all border border-purple-500/20 font-bold text-sm active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline uppercase tracking-wider">Chat AI</span>
          </button>
          <button 
            onClick={onShowFavorites}
            className="flex items-center gap-2 px-5 py-2.5 bg-pink-500/10 text-pink-400 rounded-xl hover:bg-pink-600 hover:text-white transition-all border border-pink-500/20 font-bold text-sm active:scale-95"
          >
            <Heart className="w-4 h-4 fill-current" />
            <span className="hidden md:inline uppercase tracking-wider">A Minha Lista</span>
          </button>
        </div>
          
          <div className="flex items-center gap-3 ml-2 pl-6 border-l border-gray-800">
            <button className="p-4 bg-[#1a1c23] text-gray-400 rounded-2xl hover:text-white border border-gray-800 transition-all hover:border-purple-500/50 shadow-md">
              <User className="w-6 h-6" />
            </button>
            <button 
              onClick={logout}
              className="p-4 text-gray-500 hover:text-red-500 transition-colors"
              title="Sair"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
