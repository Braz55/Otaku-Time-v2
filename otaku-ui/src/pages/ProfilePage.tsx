import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, Database, Wifi, Usb, Cloud, RefreshCw, CheckCircle2, AlertCircle, User, Shield, Smartphone } from 'lucide-react';
import { localDb } from '../services/localDb';
import { API_BASE_URL } from '../config';
import { Capacitor } from '@capacitor/core';
import { customFetch } from '../services/apiBridge';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'sync' | 'account'>('sync');
  const [localAnimeCount, setLocalAnimeCount] = useState(0);
  const [localMangaCount, setLocalMangaCount] = useState(0);
  
  // Sync Settings State
  const [syncMode, setSyncMode] = useState<'wifi' | 'usb' | 'cloud'>('wifi');
  const [customIp, setCustomIp] = useState('192.168.1.50');
  const [cloudUrl, setCloudUrl] = useState('https://otakutime-api.onrender.com');
  
  // Two-way Sync Execution State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('');
  const [syncResult, setSyncResult] = useState<'success' | 'error' | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(localStorage.getItem('otaku_last_db_sync'));

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const aCount = await localDb.animes.count();
        const mCount = await localDb.mangas.count();
        setLocalAnimeCount(aCount);
        setLocalMangaCount(mCount);
      } catch (err) {
        console.error("Erro ao carregar contagens locais:", err);
      }
    };
    loadCounts();
  }, []);

  const handleStartTwoWaySync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setSyncProgress(15);
    setSyncStatusText('Connecting to PC / Server...');

    // Determinar o URL base correto com base na configuração do utilizador
    let targetBaseUrl = API_BASE_URL;
    if (syncMode === 'wifi') {
      targetBaseUrl = `http://${customIp}:3001`;
    } else if (syncMode === 'cloud') {
      targetBaseUrl = cloudUrl;
    } else if (syncMode === 'usb') {
      targetBaseUrl = 'http://localhost:3001';
    }

    try {
      // Passo 1: Recolher dados locais da Dexie DB
      setSyncStatusText('Reading local offline items...');
      setSyncProgress(35);
      const localAnimes = await localDb.animes.toArray();
      const localMangas = await localDb.mangas.toArray();

      // Passo 2: Enviar pacote de sincronização para o servidor (Handshake & Merge)
      setSyncStatusText(`Merging databases at ${targetBaseUrl}...`);
      setSyncProgress(65);

      const response = await customFetch(`${targetBaseUrl}/sync/twoway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastSyncTime: lastSyncTime || new Date(0).toISOString(),
          clientAnimes: localAnimes,
          clientMangas: localMangas,
          deviceInfo: Capacitor.isNativePlatform() ? 'Android Mobile' : 'Web PC'
        })
      });

      if (response.ok) {
        const mergedData = await response.json();
        setSyncStatusText('Updating local database with merged results...');
        setSyncProgress(85);

        // Atualizar tabelas locais se o servidor devolveu dados fundidos
        if (mergedData && mergedData.animes && mergedData.mangas) {
          await localDb.animes.clear();
          await localDb.animes.bulkPut(mergedData.animes);
          await localDb.mangas.clear();
          await localDb.mangas.bulkPut(mergedData.mangas);

          setLocalAnimeCount(mergedData.animes.length);
          setLocalMangaCount(mergedData.mangas.length);
        }

        setSyncProgress(100);
        setSyncStatusText('Databases perfectly synchronized!');
        setSyncResult('success');
        const nowStr = new Date().toLocaleString();
        setLastSyncTime(nowStr);
        localStorage.setItem('otaku_last_db_sync', nowStr);
      } else {
        throw new Error('Server handshake failed');
      }
    } catch (error: any) {
      console.error('Two-way sync error:', error);
      setSyncProgress(100);
      setSyncStatusText(`Sync Failed: ${error.message || 'Connection Error'}`);
      setSyncResult('error');
    } finally {
      setTimeout(() => setIsSyncing(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1014] text-gray-200 p-3 sm:p-6 font-sans pb-24">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 sm:p-2.5 rounded-2xl bg-surface-variant/30 hover:bg-white/10 text-on-surface-variant hover:text-white transition-all border border-white/5 flex items-center gap-2 font-bold text-xs sm:text-sm"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent tracking-tight">
                Profile & Settings
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage your account, offline storage, and database synchronization</p>
            </div>
          </div>
        </header>

        {/* User Card Hero */}
        <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-purple-500/20 shadow-2xl relative overflow-hidden hero-gradient">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-transparent blur-3xl"></div>
          <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 text-center sm:text-left">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 p-1 shadow-[0_0_30px_rgba(168,85,247,0.4)] flex-shrink-0">
              <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-4xl font-black text-white overflow-hidden">
                {user?.nome ? user.nome.charAt(0).toUpperCase() : 'O'}
              </div>
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                <h2 className="text-2xl sm:text-3xl font-black text-white truncate">{user?.nome || 'Otaku Enthusiast'}</h2>
                <span className="px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <Shield className="w-3.5 h-3.5" /> PRO TIER
                </span>
              </div>
              <p className="text-sm sm:text-base text-on-surface-variant font-medium">{user?.email || 'enthusiast@otakutime.com'}</p>
              
              {/* Storage Quick Stats */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-4 pt-2">
                <div className="flex items-center gap-2 bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/5">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-gray-300">Animes: <span className="text-purple-400 font-black">{localAnimeCount}</span></span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/5">
                  <Database className="w-4 h-4 text-pink-400" />
                  <span className="text-xs font-bold text-gray-300">Mangas: <span className="text-pink-400 font-black">{localMangaCount}</span></span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-gray-300">Mode: <span className="text-emerald-400 font-black">{Capacitor.isNativePlatform() ? 'Android Native' : 'Web Browser'}</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-3 border-b border-white/10 pb-4">
          <button 
            onClick={() => setActiveTab('sync')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'sync' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-105' : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'}`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Database Synchronization</span>
          </button>
          <button 
            onClick={() => setActiveTab('account')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'account' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-105' : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'}`}
          >
            <User className="w-4 h-4" />
            <span>Account Details</span>
          </button>
        </div>

        {/* Tab Content: Database Synchronization */}
        {activeTab === 'sync' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-purple-400 shadow-inner">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Two-Way Database Sync</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Analyze and merge changes between PC and Android seamlessly</p>
                  </div>
                </div>
                {lastSyncTime && (
                  <span className="text-xs bg-surface-variant/50 px-3 py-1.5 rounded-full border border-white/5 font-medium text-gray-400">
                    Last Synced: <span className="text-white font-bold">{lastSyncTime}</span>
                  </span>
                )}
              </div>

              {/* Sync Mode Selector */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Select Connection Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Wi-Fi Mode */}
                  <button 
                    onClick={() => setSyncMode('wifi')}
                    className={`flex flex-col items-start p-5 rounded-2xl border transition-all text-left group relative overflow-hidden ${syncMode === 'wifi' ? 'bg-purple-500/20 border-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.25)] scale-[1.02]' : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:border-white/20 hover:text-white'}`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className={`p-2 rounded-xl ${syncMode === 'wifi' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/50' : 'bg-surface-variant text-on-surface-variant'}`}>
                        <Wifi className="w-5 h-5" />
                      </div>
                      {syncMode === 'wifi' && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>}
                    </div>
                    <span className="font-bold text-base text-white mb-1">Wi-Fi (Local Network)</span>
                    <span className="text-xs text-on-surface-variant line-clamp-2">Connect directly to your PC's NestJS server via local IP. Perfect for home Wi-Fi.</span>
                  </button>

                  {/* USB Mode */}
                  <button 
                    onClick={() => setSyncMode('usb')}
                    className={`flex flex-col items-start p-5 rounded-2xl border transition-all text-left group relative overflow-hidden ${syncMode === 'usb' ? 'bg-purple-500/20 border-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.25)] scale-[1.02]' : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:border-white/20 hover:text-white'}`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className={`p-2 rounded-xl ${syncMode === 'usb' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/50' : 'bg-surface-variant text-on-surface-variant'}`}>
                        <Usb className="w-5 h-5" />
                      </div>
                      {syncMode === 'usb' && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>}
                    </div>
                    <span className="font-bold text-base text-white mb-1">USB Cable (ADB Reverse)</span>
                    <span className="text-xs text-on-surface-variant line-clamp-2">Use localhost with ADB reverse bridge. Ideal when testing via USB cable.</span>
                  </button>

                  {/* Cloud Mode */}
                  <button 
                    onClick={() => setSyncMode('cloud')}
                    className={`flex flex-col items-start p-5 rounded-2xl border transition-all text-left group relative overflow-hidden ${syncMode === 'cloud' ? 'bg-purple-500/20 border-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.25)] scale-[1.02]' : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:border-white/20 hover:text-white'}`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className={`p-2 rounded-xl ${syncMode === 'cloud' ? 'bg-purple-500 text-white shadow-md shadow-purple-500/50' : 'bg-surface-variant text-on-surface-variant'}`}>
                        <Cloud className="w-5 h-5" />
                      </div>
                      {syncMode === 'cloud' && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>}
                    </div>
                    <span className="font-bold text-base text-white mb-1">Cloud Server (Global)</span>
                    <span className="text-xs text-on-surface-variant line-clamp-2">Connect to your hosted online API (e.g. Render, Railway). Sync anywhere on 4G/5G.</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Configuration Input based on Selected Mode */}
              <div className="p-5 rounded-2xl bg-black/30 border border-white/5 space-y-4">
                {syncMode === 'wifi' && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <label className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5" /> PC Local IPv4 Address
                    </label>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={customIp} 
                        onChange={(e) => setCustomIp(e.target.value)} 
                        placeholder="Ex: 192.168.1.50"
                        className="flex-1 bg-surface px-4 py-3 rounded-xl border border-white/10 text-white font-mono text-sm focus:border-purple-500 outline-none transition-all"
                      />
                    </div>
                    <p className="text-xs text-on-surface-variant">Check your PC terminal with <code className="bg-white/10 px-1.5 py-0.5 rounded text-white">ipconfig</code> to get your IPv4 address.</p>
                  </div>
                )}

                {syncMode === 'usb' && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <label className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Usb className="w-3.5 h-3.5" /> USB Bridge Active
                    </label>
                    <div className="p-4 rounded-xl bg-surface border border-white/10 text-sm text-gray-300 font-mono">
                      http://localhost:3001
                    </div>
                    <p className="text-xs text-on-surface-variant">Ensure you ran <code className="bg-white/10 px-1.5 py-0.5 rounded text-white">adb reverse tcp:3001 tcp:3001</code> in your PC terminal.</p>
                  </div>
                )}

                {syncMode === 'cloud' && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <label className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5" /> Hosted Cloud API URL
                    </label>
                    <input 
                      type="url" 
                      value={cloudUrl} 
                      onChange={(e) => setCloudUrl(e.target.value)} 
                      placeholder="https://your-api.onrender.com"
                      className="w-full bg-surface px-4 py-3 rounded-xl border border-white/10 text-white font-mono text-sm focus:border-purple-500 outline-none transition-all"
                    />
                    <p className="text-xs text-on-surface-variant">Enter your public backend URL deployed on Render, Railway, or Fly.io.</p>
                  </div>
                )}
              </div>

              {/* Sync Execution Button & Progress */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <button
                  onClick={handleStartTwoWaySync}
                  disabled={isSyncing}
                  className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 shadow-xl ${isSyncing ? 'bg-surface-variant text-on-surface-variant cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:opacity-90 text-white shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.01] active:scale-[0.99]'}`}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                      <span>SYNCHRONIZING DATABASES...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      <span>START TWO-WAY SYNCHRONIZATION</span>
                    </>
                  )}
                </button>

                {/* Progress Bar & Status Text */}
                {isSyncing && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 shadow-[0_0_12px_rgba(168,85,247,0.8)]" style={{ width: `${syncProgress}%` }}></div>
                    </div>
                    <p className="text-xs font-bold text-center text-purple-300 animate-pulse">{syncStatusText}</p>
                  </div>
                )}

                {/* Sync Result Feedback */}
                {syncResult === 'success' && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 animate-in fade-in zoom-in-95 duration-300 shadow-lg">
                    <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-white">Synchronization Successful!</p>
                      <p className="text-xs text-emerald-300 mt-0.5">PC and Android databases have been analyzed and merged perfectly.</p>
                    </div>
                  </div>
                )}

                {syncResult === 'error' && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 animate-in fade-in zoom-in-95 duration-300 shadow-lg">
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-white">Synchronization Failed</p>
                      <p className="text-xs text-red-300 mt-0.5">Could not reach the server. Please check your IP address or USB connection.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Account Details */}
        {activeTab === 'account' && (
          <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-xl">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <User className="w-6 h-6 text-purple-400" />
              <span>Account Information</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Display Name</label>
                <p className="text-base font-bold text-white bg-black/30 p-3.5 rounded-xl border border-white/5">{user?.nome || 'Otaku Enthusiast'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Email Address</label>
                <p className="text-base font-bold text-white bg-black/30 p-3.5 rounded-xl border border-white/5">{user?.email || 'enthusiast@otakutime.com'}</p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Membership Status</label>
                <div className="flex items-center gap-3 bg-purple-500/10 p-4 rounded-xl border border-purple-500/30 text-purple-300 font-bold text-sm">
                  <Shield className="w-5 h-5" />
                  <span>OtakuTime Pro Member (All premium features unlocked)</span>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-white/5 flex justify-end">
              <button 
                onClick={logout} 
                className="px-6 py-3 rounded-2xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white font-bold text-sm transition-all border border-red-500/30 shadow-lg"
              >
                Log Out of Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
