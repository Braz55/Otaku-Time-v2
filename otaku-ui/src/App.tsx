import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CalendarPage from './pages/CalendarPage';
import ProfilePage from './pages/ProfilePage';
import ExplorePage from './pages/ExplorePage';
import LibraryPage from './pages/LibraryPage';
import DetailsPage from './pages/DetailsPage';
import ListsPage from './pages/ListsPage';
import ListDetailsPage from './pages/ListDetailsPage';
import Layout from './components/Layout';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { applyPalette, getCurrentPalette } from './services/paletteService';
import { API_BASE_URL } from './config';
import { customFetch } from './services/apiBridge';
import { useMedia } from './context/MediaContext';

// Listener para o botão físico / gesto de voltar no Android
const AndroidBackButtonListener = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const subscription = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const executeBack = () => {
        if (location.pathname === '/') {
          CapacitorApp.exitApp();
        } else if (canGoBack) {
          navigate(-1);
        } else {
          navigate('/');
        }
      };

      if ((window as any).hasUnsavedChanges) {
        window.dispatchEvent(new CustomEvent('show-unsaved-changes-modal', {
          detail: { action: executeBack }
        }));
      } else {
        executeBack();
      }
    });

    return () => {
      subscription.then(sub => sub.remove());
    };
  }, [location, navigate]);

  return null;
};

// Componente para rastrear o caminho anterior (prevPath)
const PathTracker = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  const currentPath = sessionStorage.getItem('otaku_current_path');
  if (currentPath !== location.pathname) {
    if (currentPath) {
      sessionStorage.setItem('otaku_prev_path', currentPath);
    }
    sessionStorage.setItem('otaku_current_path', location.pathname);
  }

  return <>{children}</>;
};

// Splash Loader de Carregamento Premium
const SplashLoader = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f1014] relative overflow-hidden">
      {/* Luzes de ambiente em degradê */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-secondary/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="flex flex-col items-center z-10">
        {/* Logótipo com brilho pulsante */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-110 animate-pulse"></div>
          <img 
            src="/logo.png" 
            className="w-28 h-28 rounded-3xl shadow-2xl border border-white/10 object-cover relative z-10" 
            alt="Otaku Time Logo" 
          />
        </div>

        {/* Nome da App */}
        <h1 className="text-3xl font-extrabold text-white tracking-wider mb-2">
          Otaku <span className="text-primary font-bold">Time</span>
        </h1>
        <p className="text-gray-500 text-xs tracking-widest uppercase mb-8">
          A carregar a tua biblioteca...
        </p>

        {/* Indicador de Carregamento */}
        <div className="flex items-center gap-2 text-primary bg-[#1a1c23] border border-white/5 py-2.5 px-5 rounded-full shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-gray-300 text-xs font-semibold">A validar sessão...</span>
        </div>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <SplashLoader />;
  }

  return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

// Guest Route Component (previnir visitas autenticadas a páginas públicas)
const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <SplashLoader />;
  }

  return isAuthenticated ? <Navigate to="/" /> : <>{children}</>;
};

function App() {
  const { user, token } = useAuth();
  const { setAnimeLibraryData, setMangaLibraryData } = useMedia();

  useEffect(() => {
    // Aplicar a paleta de cores guardada no localStorage
    applyPalette(getCurrentPalette());
  }, []);

  useEffect(() => {
    if (user?.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [user?.theme]);

  useEffect(() => {
    if (token) {
      const getHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      });

      customFetch(`${API_BASE_URL}/anime`, { headers: getHeaders() })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Failed to fetch anime library');
        })
        .then(data => {
          if (Array.isArray(data)) {
            const sorted = data.sort((a, b) => (a.prioridade || 999) - (b.prioridade || 999));
            setAnimeLibraryData(sorted);
          }
        })
        .catch(err => console.error('Error prefetching anime library:', err));

      customFetch(`${API_BASE_URL}/manga`, { headers: getHeaders() })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Failed to fetch manga library');
        })
        .then(data => {
          if (Array.isArray(data)) {
            const sorted = data.sort((a, b) => (a.prioridade || 999) - (b.prioridade || 999));
            setMangaLibraryData(sorted);
          }
        })
        .catch(err => console.error('Error prefetching manga library:', err));
    }
  }, [token, setAnimeLibraryData, setMangaLibraryData]);

  return (
    <Router>
      <PathTracker>
        <AndroidBackButtonListener />
        <Routes>
          <Route 
            path="/" 
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/explore" 
          element={
            <ProtectedRoute>
              <ExplorePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/calendar" 
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/library" 
          element={
            <ProtectedRoute>
              <LibraryPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/lists" 
          element={
            <ProtectedRoute>
              <ListsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/lists/:id" 
          element={
            <ProtectedRoute>
              <ListDetailsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/details/:mediaType/:id" 
          element={
            <ProtectedRoute>
              <DetailsPage />
            </ProtectedRoute>
          } 
        />
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </PathTracker>
    </Router>
  );
}

export default App;
