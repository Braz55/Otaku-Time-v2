import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { MediaProvider } from './context/MediaContext'
import { ToastProvider } from './context/ToastContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <MediaProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MediaProvider>
    </AuthProvider>
  </StrictMode>,
)
