import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CalendarPage from './pages/CalendarPage';
import ProfilePage from './pages/ProfilePage';
import ExplorePage from './pages/ExplorePage';
import LibraryPage from './pages/LibraryPage';
import DetailsPage from './pages/DetailsPage';
import Layout from './components/Layout';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { applyPalette, getCurrentPalette } from './services/paletteService';

// Listener para o botão físico / gesto de voltar no Android
const AndroidBackButtonListener = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const subscription = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname === '/') {
        CapacitorApp.exitApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        navigate('/');
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

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function App() {
  const { user } = useAuth();

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
          path="/details/:mediaType/:id" 
          element={
            <ProtectedRoute>
              <DetailsPage />
            </ProtectedRoute>
          } 
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </PathTracker>
    </Router>
  );
}

export default App;