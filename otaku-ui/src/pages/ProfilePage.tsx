import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ChevronLeft, Database, RefreshCw, AlertCircle, User, Shield, Smartphone, Download, Upload, Copy, Check } from 'lucide-react';
import { localDb } from '../services/localDb';
import { API_BASE_URL } from '../config';
import { Capacitor } from '@capacitor/core';
import { customFetch } from '../services/apiBridge';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';


import { getCurrentPalette, savePalette } from '../services/paletteService';

const ProfilePage = () => {
  const { user, logout, token, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'sync' | 'account'>('sync');
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState(() => getCurrentPalette());

  const handlePaletteChange = (paletteName: string) => {
    savePalette(paletteName);
    setSelectedPalette(paletteName);
    showToast('Paleta de cores atualizada!', 'success');
  };

  // Account Information Edit state
  const [newName, setNewName] = useState(user?.nome || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Sync newName when user object is loaded
  useEffect(() => {
    if (user?.nome) {
      setNewName(user.nome);
    }
  }, [user]);

  const handleSaveAccountInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword) {
      if (!currentPassword) {
        showToast('A palavra-passe atual é obrigatória para definir uma nova!', 'warning');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast('As novas palavras-passe não coincidem!', 'warning');
        return;
      }
    }
    setIsSavingAccount(true);
    try {
      const updateData: any = {};
      if (newName && newName !== user?.nome) {
        updateData.nome = newName;
      }
      if (newPassword) {
        updateData.password = newPassword;
        updateData.currentPassword = currentPassword;
      }

      if (Object.keys(updateData).length === 0) {
        showToast('Nenhuma alteração detetada.', 'info');
        setIsSavingAccount(false);
        return;
      }

      const res = await customFetch(`${API_BASE_URL}/user/profile`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(updateData)
      });
      if (res.ok) {
        if (updateData.password) {
          showToast('Palavra-passe alterada com sucesso! A iniciar sessão novamente...', 'success');
          setTimeout(() => {
            logout();
          }, 2000);
        } else {
          updateUser(updateData);
          showToast('Dados da conta atualizados com sucesso!', 'success');
        }
        setNewPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'Falha ao atualizar dados da conta.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleUpdatePreference = async (field: string, value: any) => {
    if (!token) return;
    setIsUpdatingPreferences(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/profile`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        updateUser({ [field]: value });
      } else {
        showToast('Falha ao atualizar preferência.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    } finally {
      setIsUpdatingPreferences(false);
    }
  };
  const [localAnimeCount, setLocalAnimeCount] = useState(0);
  const [localMangaCount, setLocalMangaCount] = useState(0);

  const [connectionMode, setConnectionMode] = useState<'online' | 'offline'>(() => {
    return (localStorage.getItem('otaku_connection_mode') as 'online' | 'offline') || 'online';
  });

  const handleConnectionModeChange = (mode: 'online' | 'offline') => {
    localStorage.setItem('otaku_connection_mode', mode);
    setConnectionMode(mode);
    window.location.reload();
  };

  // Backup & Restore State
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importJsonInput, setImportJsonInput] = useState('');
  const [cleanRestore, setCleanRestore] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const handleWipeLibrary = async () => {
    setIsWiping(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/library`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) {
        throw new Error('Falha ao apagar dados no servidor.');
      }
      
      // Atualizar contagens locais
      const aCount = await localDb.animes.count();
      const mCount = await localDb.mangas.count();
      setLocalAnimeCount(aCount);
      setLocalMangaCount(mCount);
      
      showToast('Biblioteca apagada com sucesso!', 'success');
      setShowWipeConfirm(false);
    } catch (err: any) {
      showToast(`Erro ao apagar biblioteca: ${err.message || err}`, 'error');
    } finally {
      setIsWiping(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    setBackupText('');
    setCopied(false);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/backup`, {
        headers: getHeaders()
      });
      if (!res.ok) {
        throw new Error(`Erro ao gerar backup: ${res.statusText}`);
      }
      const backupData = await res.json();
      const backupString = JSON.stringify(backupData, null, 2);
      setBackupText(backupString);

      // Se for Android (Native Platform)
      if (Capacitor.isNativePlatform()) {
        try {
          const fileName = `otaku_time_backup_${new Date().toISOString().split('T')[0]}.json`;
          
          // Gravar o ficheiro temporariamente no sistema de ficheiros nativo do Android
          const writeResult = await Filesystem.writeFile({
            path: fileName,
            data: backupString,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          });

          // Partilhar o ficheiro através do menu de partilha nativo do Android
          await Share.share({
            title: 'Backup Otaku-Time',
            text: 'Ficheiro de cópia de segurança do Otaku-Time.',
            url: writeResult.uri,
            dialogTitle: 'Partilhar Cópia de Segurança'
          });
        } catch (shareErr: any) {
          console.error("Erro ao partilhar via Capacitor:", shareErr);
          // Se falhar a partilha nativa (por ex. cancelada), mostramos o modal para o utilizador copiar
          setShowBackupModal(true);
        }
      } else {
        // No PC / Web: Download direto
        const blob = new Blob([backupString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `otaku_time_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setShowBackupModal(true);
      }
    } catch (err: any) {
      showToast(`Erro ao exportar backup: ${err.message || err}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        setImportJsonInput(text);
      } catch (err) {
        setImportError('Não foi possível ler o ficheiro selecionado.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreBackup = async () => {
    if (!importJsonInput.trim()) {
      setImportError('Por favor, cole o texto do backup ou selecione um ficheiro JSON.');
      return;
    }

    setImportError(null);
    setImportSuccess(null);
    setIsImporting(true);

    try {
      // Validar JSON localmente antes de enviar
      let parsed;
      try {
        parsed = JSON.parse(importJsonInput);
      } catch {
        throw new Error('O formato do texto/ficheiro não é um JSON válido.');
      }

      if (!parsed.data || (!parsed.data.animes && !parsed.data.mangas)) {
        throw new Error('O backup selecionado não contém dados válidos de animes ou mangás.');
      }

      // Se for restauro limpo, apagar biblioteca primeiro
      if (cleanRestore) {
        const wipeRes = await customFetch(`${API_BASE_URL}/user/library`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        if (!wipeRes.ok) {
          throw new Error('Não foi possível apagar os dados existentes para o restauro limpo.');
        }
      }

      const res = await customFetch(`${API_BASE_URL}/user/restore`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(parsed)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Falha ao restaurar dados no servidor.');
      }

      setImportSuccess('Cópia de segurança restaurada com sucesso! A recarregar biblioteca...');
      setImportJsonInput('');
      setCleanRestore(false);
      
      // Recarregar os contadores da página e atualizar as listas
      setTimeout(async () => {
        try {
          const aCount = await localDb.animes.count();
          const mCount = await localDb.mangas.count();
          setLocalAnimeCount(aCount);
          setLocalMangaCount(mCount);
        } catch {}
        setShowRestoreModal(false);
        setImportSuccess(null);
      }, 2500);

    } catch (err: any) {
      setImportError(err.message || 'Erro inesperado ao restaurar o backup.');
    } finally {
      setIsImporting(false);
    }
  };
  
  // AutoSync Releases State (Animes & Mangas)
  const [syncStatus, setSyncStatus] = useState<{ isSyncing: boolean; total: number; current: number; currentItemTitle: string }>({
    isSyncing: false,
    total: 0,
    current: 0,
    currentItemTitle: ''
  });

  const checkSyncStatus = async () => {
    try {
      const res = await customFetch(`${API_BASE_URL}/sync/status`);
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const [releaseSyncError, setReleaseSyncError] = useState<string | null>(null);

  const triggerManualReleaseSync = async () => {
    setReleaseSyncError(null);
    try {
      const res = await customFetch(`${API_BASE_URL}/sync/start`, { method: 'POST' });
      if (!res.ok) {
        await res.json().catch(() => ({}));
        setReleaseSyncError('Falha ao ligar ao servidor. Verifique se o backend está a correr.');
        return;
      }
      checkSyncStatus();
    } catch (err: any) {
      setReleaseSyncError(`Erro de conexão: ${err.message || 'Servidor indisponível'}`);
    }
  };

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
              <h1 className="text-2xl sm:text-4xl font-black text-primary-light tracking-tight">
                Profile & Settings
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage your account, offline storage, and database synchronization</p>
            </div>
          </div>
        </header>

        {/* User Card Hero */}
        <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-secondary/20 shadow-2xl relative overflow-hidden hero-gradient">
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/15 via-secondary-light/5 to-transparent blur-3xl"></div>
          <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 text-center sm:text-left">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary p-1 shadow-[0_0_30px_rgba(194,24,91,0.4)] flex-shrink-0">
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
                  <Database className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-gray-300">Animes: <span className="text-primary font-black">{localAnimeCount}</span></span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-3.5 py-1.5 rounded-xl border border-white/5">
                  <Database className="w-4 h-4 text-secondary" />
                  <span className="text-xs font-bold text-gray-300">Mangas: <span className="text-secondary font-black">{localMangaCount}</span></span>
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
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'sync' ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'}`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Database Synchronization</span>
          </button>
          <button 
            onClick={() => setActiveTab('account')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'account' ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'}`}
          >
            <User className="w-4 h-4" />
            <span>Account Details</span>
          </button>
        </div>

        {/* Tab Content: Database Synchronization */}
        {activeTab === 'sync' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Connection Mode Selection Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 border border-primary/30 rounded-2xl text-primary">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Modo de Ligação da App</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Escolhe se queres ligar-te em tempo real à base de dados na nuvem (PostgreSQL) ou usar a base de dados local offline no telemóvel.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => handleConnectionModeChange('online')}
                  className={`p-4 rounded-2xl border text-left transition-all ${connectionMode === 'online' ? 'border-secondary bg-primary/10 shadow-[0_0_15px_rgba(194,24,91,0.2)]' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">Modo Online (Nuvem)</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${connectionMode === 'online' ? 'bg-secondary animate-pulse' : 'bg-gray-600'}`}></span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Liga-se diretamente ao teu Render e ao Neon DB PostgreSQL na nuvem para veres e atualizares os teus dados em tempo real.
                  </p>
                </button>
                <button
                  onClick={() => handleConnectionModeChange('offline')}
                  className={`p-4 rounded-2xl border text-left transition-all ${connectionMode === 'offline' ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(106,27,154,0.2)]' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">Modo Offline (Local)</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${connectionMode === 'offline' ? 'bg-primary animate-pulse' : 'bg-gray-600'}`}></span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Guarda os teus progressos na base de dados IndexedDB (Dexie) local do telemóvel para funcionar sem internet.
                  </p>
                </button>
              </div>
            </div>

            {/* AutoSync Releases Card (Animes & Mangas) */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-secondary/10 via-primary/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-2xl text-secondary shadow-inner">
                    <RefreshCw className={`w-6 h-6 ${syncStatus.isSyncing ? 'animate-spin text-secondary' : ''}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>AutoSync Releases (Animes & Mangas)</span>
                      {syncStatus.isSyncing && (
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-[10px] font-black text-primary animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span> ACTIVE
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 max-w-xl">
                      Automatically queries external APIs (AniList, MangaDex, Baka-Updates) to fetch the latest published episode and chapter numbers for all your Releasing titles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5 relative z-10">
                <button
                  onClick={triggerManualReleaseSync}
                  disabled={syncStatus.isSyncing}
                  className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 shadow-xl ${syncStatus.isSyncing ? 'bg-primary/20 border border-primary/30 text-primary cursor-not-allowed shadow-[0_0_25px_rgba(106,27,154,0.2)]' : 'bg-primary hover:opacity-90 text-on-primary shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99]'}`}
                >
                  {syncStatus.isSyncing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-secondary" />
                      <span>AUTOSYNC IN PROGRESS ({syncStatus.current}/{syncStatus.total})</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      <span>START RELEASE AUTOSYNC NOW</span>
                    </>
                  )}
                </button>

                {/* Expanding Details Panel */}
                {syncStatus.isSyncing && (
                  <div className="p-6 rounded-2xl bg-black/40 border border-primary/30 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-secondary uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span> Live Background Progress
                      </span>
                      <span className="text-white bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/30 font-mono">
                        {syncStatus.current} / {syncStatus.total} Completed
                      </span>
                    </div>

                    <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-primary via-secondary to-indigo-500 rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(106,27,154,0.8)]" 
                        style={{ width: `${syncStatus.total > 0 ? (syncStatus.current / syncStatus.total) * 100 : 0}%` }}
                      ></div>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-variant/40 border border-white/5 flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-secondary flex-shrink-0 shadow-md">
                        <span className="material-symbols-outlined text-base animate-spin">sync</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Currently Updating Media</p>
                        <p className="font-black text-white text-base truncate mt-0.5">
                          {syncStatus.currentItemTitle || 'Initializing external API connections...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Connection Error Alert */}
                {releaseSyncError && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 animate-in fade-in zoom-in-95 duration-300 shadow-lg">
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-sm text-white">Falha no AutoSync</p>
                      <p className="text-xs text-red-300 mt-0.5">{releaseSyncError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Backup & Portability Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden animate-in fade-in duration-500">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-secondary/10 via-primary/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-2xl text-primary shadow-inner">
                    <Database className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>Cópia de Segurança (Backup & Portabilidade)</span>
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 max-w-xl">
                      Exporte toda a sua biblioteca de Animes e Mangas (títulos, estados de acompanhamento, progresso atual e prioridade) para um ficheiro JSON portátil, facilitando a migração entre o PC e o Android.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5 relative z-10">
                {/* Export Button */}
                <button
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl bg-primary hover:opacity-90 text-on-primary shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>A GERAR BACKUP...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      <span>CRIAR CÓPIA DE SEGURANÇA</span>
                    </>
                  )}
                </button>

                {/* Import Button */}
                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Upload className="w-4 h-4 text-primary" />
                  <span>RESTAURAR CÓPIA DE SEGURANÇA</span>
                </button>

                {/* Wipe Button */}
                <button
                  onClick={() => setShowWipeConfirm(true)}
                  className="sm:col-span-2 py-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-3 shadow-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>LIMPAR BIBLIOTECA (APAGAR TODOS OS PROGRESSOS)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Account Details */}
        {activeTab === 'account' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <User className="w-6 h-6 text-primary" />
                <span>Account Information</span>
              </h3>
              <form onSubmit={handleSaveAccountInfo} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Display Name</label>
                    <input 
                      type="text" 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)} 
                      className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all"
                      placeholder="Novo nome de utilizador"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Email Address</label>
                    <p className="text-base font-bold text-gray-500 bg-black/20 p-3 rounded-xl border border-white/5 cursor-not-allowed select-none">{user?.email || 'enthusiast@otakutime.com'}</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Palavra-passe Atual</label>
                    <input 
                      type="password" 
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)} 
                      className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all"
                      placeholder="Preenche apenas se pretenderes alterar a palavra-passe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Nova Palavra-passe</label>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all"
                      placeholder="Nova palavra-passe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Confirmar Nova Palavra-passe</label>
                    <input 
                      type="password" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all"
                      placeholder="Confirmar nova palavra-passe"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Membership Status</label>
                    <div className="flex items-center gap-3 bg-primary/10 p-4 rounded-xl border border-primary/30 text-primary-light font-bold text-sm">
                      <Shield className="w-5 h-5" />
                      <span>OtakuTime Pro Member (All premium features unlocked)</span>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-white/5 flex flex-wrap gap-3 justify-end">
                  <button 
                    type="button"
                    onClick={logout} 
                    className="px-6 py-3 rounded-2xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white font-bold text-sm transition-all border border-red-500/30 shadow-lg"
                  >
                    Log Out of Account
                  </button>
                  <button 
                    type="submit"
                    disabled={isSavingAccount}
                    className="px-6 py-3 rounded-2xl bg-primary hover:opacity-90 text-on-primary font-bold text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingAccount ? 'A guardar...' : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            </div>

            {/* User Preferences Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-secondary/10 via-transparent to-transparent rounded-full blur-2xl pointer-events-none"></div>
              
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Smartphone className="w-6 h-6 text-secondary" />
                <span>Preferências do Utilizador</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Preferred Language */}
                <div className="space-y-2">
                  <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">language</span>
                    Idioma de Preferência
                  </label>
                  <select 
                    value={user?.preferredLanguage || 'PT'} 
                    disabled={isUpdatingPreferences}
                    onChange={(e) => handleUpdatePreference('preferredLanguage', e.target.value)}
                    className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all cursor-pointer"
                  >
                    <option value="PT" className="bg-[#0f1014]">Português (PT)</option>
                    <option value="EN" className="bg-[#0f1014]">English (EN)</option>
                  </select>
                  <p className="text-[10px] text-gray-500">Idioma usado para os botões e interface principal da aplicação.</p>
                </div>

                {/* Theme */}
                <div className="space-y-2">
                  <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-secondary">dark_mode</span>
                    Tema Visual
                  </label>
                  <select 
                    value={user?.theme || 'dark'} 
                    disabled={isUpdatingPreferences}
                    onChange={(e) => handleUpdatePreference('theme', e.target.value)}
                    className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-secondary outline-none transition-all cursor-pointer"
                  >
                    <option value="dark" className="bg-[#0f1014]">Escuro (Dark Mode)</option>
                    <option value="light" className="bg-[#0f1014]">Claro (Light Mode)</option>
                  </select>
                  <p className="text-[10px] text-gray-500">Escolha de contraste para a interface gráfica.</p>
                </div>

                {/* Color Palette */}
                <div className="space-y-2">
                  <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary-light">palette</span>
                    Paleta de Cores (Tema)
                  </label>
                  <select 
                    value={selectedPalette} 
                    onChange={(e) => handlePaletteChange(e.target.value)}
                    className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary-light outline-none transition-all cursor-pointer"
                  >
                    <option value="default" className="bg-[#0f1014]">💜 Roxo Clássico (Padrão)</option>
                    <option value="shounen" className="bg-[#0f1014]">🟠 Laranja Shounen (Crunchyroll / Naruto)</option>
                    <option value="akatsuki" className="bg-[#0f1014]">🔴 Vermelho Akatsuki (Imponente)</option>
                    <option value="mutsu" className="bg-[#0f1014]">🟢 Verde Mutsu (Relaxante Mushi-Shi)</option>
                    <option value="sololeveling" className="bg-[#0f1014]">🔮 Roxo Solo Leveling (Neon)</option>
                    <option value="visionario" className="bg-[#0f1014]">🔵 Azul Visionário (AniList)</option>
                  </select>
                  <p className="text-[10px] text-gray-500">Mude a paleta cromática dos botões e destaques do ecrã.</p>
                </div>

                {/* Show Adult Content */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all">
                  <div className="space-y-1 flex-1">
                    <label htmlFor="adult-content-checkbox" className="text-sm font-bold text-white cursor-pointer select-none flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-red-400">no_adult_content</span>
                      Filtrar Conteúdos
                    </label>
                    <p className="text-xs text-gray-400">Filtra resultados NSFW/Adultos nas pesquisas da AniList.</p>
                  </div>
                  <div className="flex items-center pl-4">
                    <input
                      type="checkbox"
                      id="adult-content-checkbox"
                      checked={user?.showAdultContent === false}
                      disabled={isUpdatingPreferences}
                      onChange={(e) => handleUpdatePreference('showAdultContent', !e.target.checked)}
                      className="w-5 h-5 rounded border-white/10 text-primary focus:ring-primary/50 bg-black/40 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-2xl p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-secondary/15 to-transparent rounded-full blur-2xl"></div>
            
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <Check className="w-6 h-6 text-emerald-400" />
                <span>Backup Gerado com Sucesso!</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                {Capacitor.isNativePlatform() 
                  ? "O ficheiro foi partilhado através do menu do telemóvel. Em alternativa, pode copiar o código bruto abaixo para guardar como texto."
                  : "O download do ficheiro JSON iniciou-se automaticamente. Caso queira guardar o código bruto, pode copiá-lo abaixo."}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                <span>CÓDIGO DE SEGURANÇA (JSON)</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(backupText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                readOnly
                value={backupText}
                className="w-full h-48 font-mono text-xs p-4 rounded-xl bg-black/60 border border-white/5 text-gray-300 focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowBackupModal(false)}
                className="px-6 py-3 rounded-2xl bg-primary hover:opacity-90 text-on-primary font-bold text-sm transition-all shadow-lg shadow-primary/20"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-2xl p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/15 to-transparent rounded-full blur-2xl"></div>
            
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <Upload className="w-6 h-6 text-secondary" />
                <span>Restaurar Cópia de Segurança</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Selecione um ficheiro de backup JSON do seu dispositivo ou cole o código JSON diretamente no campo de texto abaixo.
              </p>
            </div>

            {/* File input selector */}
            <div className="p-4 rounded-2xl border border-dashed border-white/10 hover:border-white/20 transition-all bg-white/5 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-symbols-outlined text-gray-400 text-3xl">upload_file</span>
              <div>
                <label htmlFor="backup-file" className="cursor-pointer font-bold text-sm text-primary hover:text-primary-light">
                  Selecione um ficheiro JSON
                </label>
                <input 
                  type="file" 
                  id="backup-file" 
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden" 
                />
                <p className="text-[10px] text-gray-500 mt-1">Apenas ficheiros com extensão .json válidos</p>
              </div>
            </div>

            {/* JSON Textarea paste input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 block">OU COLE O CÓDIGO JSON DIRETAMENTE</label>
              <textarea
                placeholder='Cole aqui o conteúdo do seu ficheiro de backup (começando com { "version": 1, ... })'
                value={importJsonInput}
                onChange={(e) => setImportJsonInput(e.target.value)}
                className="w-full h-36 font-mono text-xs p-4 rounded-xl bg-black/60 border border-white/5 text-gray-300 focus:border-secondary/50 focus:outline-none resize-none placeholder:text-gray-600"
              />
            </div>

            {/* Clean Restore Checkbox */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-300">
              <input
                type="checkbox"
                id="clean-restore-checkbox"
                checked={cleanRestore}
                onChange={(e) => setCleanRestore(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-white/10 text-primary focus:ring-primary/50 bg-black/40 cursor-pointer"
              />
              <label htmlFor="clean-restore-checkbox" className="text-xs font-bold cursor-pointer select-none">
                Efetuar restauro limpo (APAGAR todos os dados atuais antes de importar)
              </label>
            </div>

            {/* Status Alert Messages */}
            {importError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 animate-in fade-in duration-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs font-bold">{importError}</p>
              </div>
            )}

            {importSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 animate-in fade-in duration-300">
                <Check className="w-5 h-5 flex-shrink-0 animate-bounce" />
                <p className="text-xs font-bold">{importSuccess}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setImportJsonInput('');
                  setImportError(null);
                  setImportSuccess(null);
                  setCleanRestore(false);
                }}
                className="px-6 py-3 rounded-2xl bg-surface-variant/30 text-on-surface-variant hover:text-white font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={isImporting || !importJsonInput}
                className="px-6 py-3 rounded-2xl bg-primary hover:opacity-90 text-on-primary font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A RESTAURAR...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>RESTAURAR PROGRESSO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wipe Confirmation Modal */}
      {showWipeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-[32px] border border-red-500/30 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/15 to-transparent rounded-full blur-2xl"></div>
            
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center justify-center sm:justify-start gap-2">
                <AlertCircle className="w-6 h-6 text-red-500 animate-bounce" />
                <span>Apagar Biblioteca?</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Esta ação é <span className="text-red-500 font-bold">destrutiva e irreversível</span>. Todos os animes, mangás, episódios/capítulos atuais e prioridades serão removidos da sua conta.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <button
                onClick={() => setShowWipeConfirm(false)}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-surface-variant/30 text-on-surface-variant hover:text-white font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleWipeLibrary}
                disabled={isWiping}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isWiping ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A APAGAR...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span>SIM, APAGAR TUDO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
