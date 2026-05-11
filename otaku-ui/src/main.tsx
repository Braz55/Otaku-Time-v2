import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { MediaProvider } from './context/MediaContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <MediaProvider>
        <App />
      </MediaProvider>
    </AuthProvider>
  </StrictMode>,
)
