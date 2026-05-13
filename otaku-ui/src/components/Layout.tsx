import React from 'react';
import { useMedia } from '../context/MediaContext';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { categoria, setCategoria, setIsShowingFavorites, triggerHome } = useMedia();
  const navigate = useNavigate();

  const handleShowFavorites = () => {
    setIsShowingFavorites(true);
    navigate('/'); // Sempre volta para a home para mostrar a biblioteca
  };

  const handleShowDashboard = () => {
    triggerHome();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0f1014] text-gray-200">
      <Header 
        categoria={categoria} 
        setCategoria={(cat) => {
          setCategoria(cat);
        }} 
        onShowFavorites={handleShowFavorites}
        onShowDashboard={handleShowDashboard}
      />
      <main>
        {children}
      </main>
    </div>
  );
};

export default Layout;
