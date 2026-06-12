import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  ChevronLeft, Database, RefreshCw, AlertCircle, User, Shield, 
  Smartphone, Download, Upload, Copy, Check, Award, Heart, 
  Edit3, Trash2, Plus, Search, BookOpen, Clock, Film, PlayCircle 
} from 'lucide-react';
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
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sync' | 'account'>('dashboard');
  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState(() => getCurrentPalette());

  // Profile Data state
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [favoriteDetails, setFavoriteDetails] = useState<Record<string, { title: string; coverUrl: string }>>({});
  const [catalog, setCatalog] = useState<any[]>([]);

  // Edit Account/Profile state
  const [newName, setNewName] = useState(user?.nome || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Edit Profile Avatar/Banner state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIconUrl, setEditIconUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editBannerPosition, setEditBannerPosition] = useState<number>(50);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Compress/resize image using Canvas before converting to base64
  const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor, seleciona um ficheiro de imagem válido.', 'warning');
      return;
    }

    try {
      if (target === 'avatar') {
        const compressed = await compressImage(file, 150, 150);
        setEditIconUrl(compressed);
        showToast('Foto de perfil carregada e comprimida!', 'success');
      } else {
        const compressed = await compressImage(file, 800, 300);
        setEditBannerUrl(compressed);
        showToast('Banner carregado e comprimido!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao processar imagem.', 'error');
    }
  };

  // Favorites Podium Search state
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [selectedRank, setSelectedRank] = useState<number>(1);
  const [favSearchType, setFavSearchType] = useState<'anime' | 'manga'>('anime');
  const [favSearchTerm, setFavSearchTerm] = useState('');
  const [favSearchResults, setFavSearchResults] = useState<any[]>([]);
  const [loadingFavSearch, setLoadingFavSearch] = useState(false);
  const [libraryAnimes, setLibraryAnimes] = useState<any[]>([]);
  const [libraryMangas, setLibraryMangas] = useState<any[]>([]);

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

  // AutoSync Releases State
  const [syncStatus, setSyncStatus] = useState<{ isSyncing: boolean; total: number; current: number; currentItemTitle: string }>({
    isSyncing: false,
    total: 0,
    current: 0,
    currentItemTitle: ''
  });

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // Fetch Full Profile
  const fetchProfile = async () => {
    if (!token) return;
    setLoadingProfile(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/profile/me`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch Achievements Catalog
  const fetchCatalog = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/achievements/catalog`);
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      }
    } catch (e) {
      console.error('Error loading achievements catalog:', e);
    }
  };

  // Fetch details of top favorites from AniList/cache
  const fetchFavoriteDetails = async () => {
    if (!profile?.topFavorites) return;
    
    // Clear old details that are not in the new topFavorites
    const currentKeys = profile.topFavorites.map((f: any) => `${f.mediaType}-${f.rankPosition}`);
    setFavoriteDetails(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        if (!currentKeys.includes(k)) {
          delete updated[k];
        }
      });
      return updated;
    });

    profile.topFavorites.forEach(async (fav: any) => {
      try {
        const typeLower = fav.mediaType.toLowerCase();
        const res = await customFetch(`${API_BASE_URL}/${typeLower}/anilist/${fav.anilistMediaId}`, {
          headers: getHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          const title = data.title?.english || data.title?.romaji || 'Título Desconhecido';
          const coverUrl = data.coverImage?.large || '';
          setFavoriteDetails(prev => ({
            ...prev,
            [`${fav.mediaType}-${fav.rankPosition}`]: { title, coverUrl }
          }));
        }
      } catch (e) {
        console.error("Failed to load favorite details for id " + fav.anilistMediaId, e);
      }
    });
  };

  useEffect(() => {
    fetchProfile();
    fetchCatalog();
  }, [token]);

  useEffect(() => {
    fetchFavoriteDetails();
  }, [profile?.topFavorites]);

  // Sync edit name and profile states
  useEffect(() => {
    if (user?.nome) {
      setNewName(user.nome);
      setEditName(user.nome);
    }
    if (profile) {
      setEditIconUrl(profile.iconUrl || '');
      setEditBannerUrl(profile.bannerUrl || '');
      setEditBannerPosition(profile.preferences?.bannerPosition ?? 50);
    }
  }, [user, profile]);

  const handlePaletteChange = (paletteName: string) => {
    savePalette(paletteName);
    setSelectedPalette(paletteName);
    showToast('Paleta de cores atualizada!', 'success');
  };

  // Save profile edit (icon, banner, bannerPosition, name)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSavingProfile(true);

    const updatedPreferences = {
      ...profile?.preferences,
      bannerPosition: editBannerPosition
    };

    try {
      const res = await customFetch(`${API_BASE_URL}/user/profile`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          nome: editName,
          iconUrl: editIconUrl || null,
          bannerUrl: editBannerUrl || null,
          preferences: updatedPreferences
        })
      });
      if (res.ok) {
        updateUser({ 
          nome: editName,
          preferences: updatedPreferences
        });
        showToast('Perfil atualizado com sucesso!', 'success');
        setShowEditProfileModal(false);
        fetchProfile();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Falha ao atualizar perfil.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Save Account password
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

  // Genre toggling
  const handleToggleGenre = async (genre: string) => {
    if (!profile) return;
    const currentGenres = profile.preferences?.favoriteGenres || [];
    const updatedGenres = currentGenres.includes(genre)
      ? currentGenres.filter((g: string) => g !== genre)
      : [...currentGenres, genre];
    
    const updatedPreferences = {
      ...profile.preferences,
      favoriteGenres: updatedGenres
    };

    try {
      const res = await customFetch(`${API_BASE_URL}/user/profile`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ preferences: updatedPreferences })
      });
      if (res.ok) {
        setProfile((prev: any) => ({
          ...prev,
          preferences: updatedPreferences
        }));
        updateUser({ preferences: updatedPreferences });
        showToast(`Género ${genre} atualizado!`, 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Erro ao atualizar género favorito.', 'error');
    }
  };

  // Favorites logic
  const openFavoritesSearch = async (type: 'anime' | 'manga', rank: number) => {
    setFavSearchType(type);
    setSelectedRank(rank);
    setFavSearchResults([]);
    setFavSearchTerm('');
    setShowFavoritesModal(true);
    setLoadingFavSearch(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/${type}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((item: any) => {
            const mediaObj = type === 'anime' ? item.anime : item.manga;
            return {
              id: mediaObj.id,
              coverImage: {
                large: mediaObj.capaUrl
              },
              title: {
                english: mediaObj.titulo,
                romaji: mediaObj.titulo
              },
              status: mediaObj.statusLancamento
            };
          });
          if (type === 'anime') {
            setLibraryAnimes(mapped);
          } else {
            setLibraryMangas(mapped);
          }
          setFavSearchResults(mapped);
        }
      }
    } catch (err) {
      console.error(`Error loading library ${type}:`, err);
    } finally {
      setLoadingFavSearch(false);
    }
  };

  const handleSearchFavMedia = async () => {
    if (!favSearchTerm.trim()) return;
    setLoadingFavSearch(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/${favSearchType}/search/${encodeURIComponent(favSearchTerm)}?page=1`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setFavSearchResults(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error searching AniList:', err);
    } finally {
      setLoadingFavSearch(false);
    }
  };

  const handleSelectFavorite = async (mediaId: number) => {
    try {
      const res = await customFetch(`${API_BASE_URL}/user/favorites`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          anilistMediaId: mediaId,
          mediaType: favSearchType.toUpperCase(),
          rankPosition: selectedRank
        })
      });
      if (res.ok) {
        showToast('Destaque definido com sucesso!', 'success');
        setShowFavoritesModal(false);
        fetchProfile();
      } else {
        showToast('Falha ao definir destaque.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    }
  };

  const handleRemoveFavorite = async (type: 'ANIME' | 'MANGA', rank: number) => {
    try {
      const res = await customFetch(`${API_BASE_URL}/user/favorites/${type.toLowerCase()}/${rank}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Destaque removido.', 'success');
        fetchProfile();
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    }
  };

  // Wipe, Backups, Sync controllers
  const handleWipeLibrary = async () => {
    setIsWiping(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/library`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Falha ao apagar dados no servidor.');
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
      if (!res.ok) throw new Error(`Erro ao gerar backup: ${res.statusText}`);
      const backupData = await res.json();
      const backupString = JSON.stringify(backupData, null, 2);
      setBackupText(backupString);

      if (Capacitor.isNativePlatform()) {
        try {
          const fileName = `otaku_time_backup_${new Date().toISOString().split('T')[0]}.json`;
          const writeResult = await Filesystem.writeFile({
            path: fileName,
            data: backupString,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          });
          await Share.share({
            title: 'Backup Otaku-Time',
            text: 'Ficheiro de cópia de segurança do Otaku-Time.',
            url: writeResult.uri,
            dialogTitle: 'Partilhar Cópia de Segurança'
          });
        } catch (shareErr: any) {
          console.error("Erro ao partilhar via Capacitor:", shareErr);
          setShowBackupModal(true);
        }
      } else {
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
        setImportJsonInput(event.target?.result as string);
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
      let parsed;
      try {
        parsed = JSON.parse(importJsonInput);
      } catch {
        throw new Error('O formato do texto/ficheiro não é um JSON válido.');
      }

      if (!parsed.data || (!parsed.data.animes && !parsed.data.mangas)) {
        throw new Error('O backup selecionado não contém dados válidos de animes ou mangás.');
      }

      if (cleanRestore) {
        const wipeRes = await customFetch(`${API_BASE_URL}/user/library`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        if (!wipeRes.ok) throw new Error('Não foi possível apagar os dados existentes para o restauro limpo.');
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
      setTimeout(() => {
        setShowRestoreModal(false);
        setImportSuccess(null);
        fetchProfile();
      }, 2500);
    } catch (err: any) {
      setImportError(err.message || 'Erro inesperado ao restaurar o backup.');
    } finally {
      setIsImporting(false);
    }
  };
  
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
        setReleaseSyncError('Falha ao ligar ao servidor. Verifique se o backend está a correr.');
        return;
      }
      checkSyncStatus();
    } catch (err: any) {
      setReleaseSyncError(`Erro de conexão: ${err.message || 'Servidor indisponível'}`);
    }
  };

  const isUnlocked = (achievementId: number) => {
    return profile?.achievements?.some((ua: any) => ua.achievementId === achievementId);
  };

  const getUnlockDate = (achievementId: number) => {
    const record = profile?.achievements?.find((ua: any) => ua.achievementId === achievementId);
    if (!record?.unlockedAt) return '';
    return new Date(record.unlockedAt).toLocaleDateString('pt-PT');
  };

  const ALL_GENRES = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
    "Horror", "Mecha", "Mystery", "Psychological", "Romance", 
    "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
  ];

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
                Perfil & Definições
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Gere o teu perfil, estatísticas, conquistas e sincronização</p>
            </div>
          </div>
        </header>

        {/* User Card Hero (Profile Banner & Avatar) */}
        <div 
          className="relative w-full rounded-[32px] border border-secondary/20 shadow-2xl overflow-hidden min-h-[220px] transition-all duration-500 flex flex-col justify-end"
          style={{
            backgroundImage: profile?.bannerUrl ? `url(${profile.bannerUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: `center ${profile?.preferences?.bannerPosition ?? '50'}%`,
          }}
        >
          {/* Dark Overlay aligned perfectly within card borders */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-black/45 to-transparent z-0"></div>

          {/* Default Hero Gradient overlay if no banner exists */}
          {!profile?.bannerUrl && (
            <div className="absolute inset-0 bg-gradient-to-r from-secondary/25 via-primary/15 to-transparent blur-3xl -z-10 hero-gradient"></div>
          )}
          
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 relative z-10 text-center sm:text-left w-full justify-between mt-auto">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary p-1 shadow-[0_0_30px_rgba(194,24,91,0.4)] flex-shrink-0 relative overflow-hidden">
                <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-4xl font-black text-white overflow-hidden">
                  {profile?.iconUrl ? (
                    <img src={profile.iconUrl} className="w-full h-full object-cover" alt="Avatar" />
                  ) : (
                    user?.nome ? user.nome.charAt(0).toUpperCase() : 'O'
                  )}
                </div>
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-white truncate drop-shadow">{user?.nome || 'Otaku Enthusiast'}</h2>
                  <span className="px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Shield className="w-3.5 h-3.5" /> PRO TIER
                  </span>
                </div>
                <p className="text-sm sm:text-base text-gray-300 font-medium drop-shadow">{user?.email || 'enthusiast@otakutime.com'}</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowEditProfileModal(true)}
              className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/10 transition-all flex items-center gap-2 active:scale-95 shadow"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Perfil</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-4 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'}`}
          >
            <Award className="w-4 h-4" />
            <span>Perfil & Conquistas</span>
          </button>
          <button 
            onClick={() => setActiveTab('sync')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${activeTab === 'sync' ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'}`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sincronização</span>
          </button>
          <button 
            onClick={() => setActiveTab('account')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${activeTab === 'account' ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'}`}
          >
            <User className="w-4 h-4" />
            <span>Definições</span>
          </button>
        </div>

        {/* Loading Indicator */}
        {loadingProfile && activeTab === 'dashboard' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs text-gray-500">A carregar detalhes do perfil...</p>
          </div>
        )}

        {/* Tab Content: Dashboard (Podiums, Stats, Achievements) */}
        {!loadingProfile && activeTab === 'dashboard' && profile && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* 1. ANIME PODIUM */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl"></div>
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Heart className="w-5 h-5 text-primary fill-primary animate-pulse" />
                  <span>Destaques de Anime</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">O teu pódio dos 3 melhores Animes de sempre.</p>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-2 max-w-2xl mx-auto items-end">
                {/* Anime 2nd Place */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full aspect-[2/3] rounded-2xl border border-white/5 bg-black/40 overflow-hidden relative group shadow-md flex items-center justify-center text-center">
                    {favoriteDetails['ANIME-2'] ? (
                      <>
                        <img src={favoriteDetails['ANIME-2'].coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="2nd Place" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-2 leading-tight">{favoriteDetails['ANIME-2'].title}</p>
                          <button 
                            onClick={() => handleRemoveFavorite('ANIME', 2)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg self-center mt-2 scale-90 active:scale-75 transition-all shadow"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button 
                        onClick={() => openFavoritesSearch('anime', 2)}
                        className="w-full h-full flex flex-col items-center justify-center p-3 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10"
                      >
                        <Plus className="w-6 h-6 mb-1 text-primary-light" />
                        <span className="text-[9px] sm:text-xs font-bold">2º Lugar</span>
                      </button>
                    )}
                  </div>
                  <div className="h-6 w-full bg-slate-400/20 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-black text-slate-300 border border-slate-400/40">2º SILVER</div>
                </div>

                {/* Anime 1st Place */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full aspect-[2/3] rounded-2xl border border-amber-500/30 bg-black/40 overflow-hidden relative group shadow-lg flex items-center justify-center text-center ring-2 ring-amber-500/20">
                    {favoriteDetails['ANIME-1'] ? (
                      <>
                        <img src={favoriteDetails['ANIME-1'].coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="1st Place" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-2 leading-tight">{favoriteDetails['ANIME-1'].title}</p>
                          <button 
                            onClick={() => handleRemoveFavorite('ANIME', 1)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg self-center mt-2 scale-90 active:scale-75 transition-all shadow"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button 
                        onClick={() => openFavoritesSearch('anime', 1)}
                        className="w-full h-full flex flex-col items-center justify-center p-3 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10"
                      >
                        <Plus className="w-7 h-7 mb-1 text-amber-400" />
                        <span className="text-[10px] sm:text-sm font-bold">1º Lugar</span>
                      </button>
                    )}
                  </div>
                  <div className="h-8 w-full bg-amber-500/20 rounded-lg flex items-center justify-center text-xs font-black text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]">1º GOLD</div>
                </div>

                {/* Anime 3rd Place */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full aspect-[2/3] rounded-2xl border border-white/5 bg-black/40 overflow-hidden relative group shadow-md flex items-center justify-center text-center">
                    {favoriteDetails['ANIME-3'] ? (
                      <>
                        <img src={favoriteDetails['ANIME-3'].coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="3rd Place" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-2 leading-tight">{favoriteDetails['ANIME-3'].title}</p>
                          <button 
                            onClick={() => handleRemoveFavorite('ANIME', 3)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg self-center mt-2 scale-90 active:scale-75 transition-all shadow"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button 
                        onClick={() => openFavoritesSearch('anime', 3)}
                        className="w-full h-full flex flex-col items-center justify-center p-3 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10"
                      >
                        <Plus className="w-6 h-6 mb-1 text-orange-400" />
                        <span className="text-[9px] sm:text-xs font-bold">3º Lugar</span>
                      </button>
                    )}
                  </div>
                  <div className="h-6 w-full bg-amber-700/20 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-black text-amber-500 border border-amber-700/40">3º BRONZE</div>
                </div>
              </div>
            </div>

            {/* 2. MANGA PODIUM */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-secondary/10 to-transparent rounded-full blur-2xl"></div>
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Heart className="w-5 h-5 text-secondary fill-secondary animate-pulse" />
                  <span>Destaques de Mangá</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">O teu pódio dos 3 melhores Mangás de sempre.</p>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-2 max-w-2xl mx-auto items-end">
                {/* Manga 2nd Place */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full aspect-[2/3] rounded-2xl border border-white/5 bg-black/40 overflow-hidden relative group shadow-md flex items-center justify-center text-center">
                    {favoriteDetails['MANGA-2'] ? (
                      <>
                        <img src={favoriteDetails['MANGA-2'].coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="2nd Place" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-2 leading-tight">{favoriteDetails['MANGA-2'].title}</p>
                          <button 
                            onClick={() => handleRemoveFavorite('MANGA', 2)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg self-center mt-2 scale-90 active:scale-75 transition-all shadow"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button 
                        onClick={() => openFavoritesSearch('manga', 2)}
                        className="w-full h-full flex flex-col items-center justify-center p-3 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10"
                      >
                        <Plus className="w-6 h-6 mb-1 text-primary-light" />
                        <span className="text-[9px] sm:text-xs font-bold">2º Lugar</span>
                      </button>
                    )}
                  </div>
                  <div className="h-6 w-full bg-slate-400/20 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-black text-slate-300 border border-slate-400/40">2º SILVER</div>
                </div>

                {/* Manga 1st Place */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full aspect-[2/3] rounded-2xl border border-amber-500/30 bg-black/40 overflow-hidden relative group shadow-lg flex items-center justify-center text-center ring-2 ring-amber-500/20">
                    {favoriteDetails['MANGA-1'] ? (
                      <>
                        <img src={favoriteDetails['MANGA-1'].coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="1st Place" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-2 leading-tight">{favoriteDetails['MANGA-1'].title}</p>
                          <button 
                            onClick={() => handleRemoveFavorite('MANGA', 1)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg self-center mt-2 scale-90 active:scale-75 transition-all shadow"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button 
                        onClick={() => openFavoritesSearch('manga', 1)}
                        className="w-full h-full flex flex-col items-center justify-center p-3 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10"
                      >
                        <Plus className="w-7 h-7 mb-1 text-amber-400" />
                        <span className="text-[10px] sm:text-sm font-bold">1º Lugar</span>
                      </button>
                    )}
                  </div>
                  <div className="h-8 w-full bg-amber-500/20 rounded-lg flex items-center justify-center text-xs font-black text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]">1º GOLD</div>
                </div>

                {/* Manga 3rd Place */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full aspect-[2/3] rounded-2xl border border-white/5 bg-black/40 overflow-hidden relative group shadow-md flex items-center justify-center text-center">
                    {favoriteDetails['MANGA-3'] ? (
                      <>
                        <img src={favoriteDetails['MANGA-3'].coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="3rd Place" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-2 leading-tight">{favoriteDetails['MANGA-3'].title}</p>
                          <button 
                            onClick={() => handleRemoveFavorite('MANGA', 3)}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg self-center mt-2 scale-90 active:scale-75 transition-all shadow"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button 
                        onClick={() => openFavoritesSearch('manga', 3)}
                        className="w-full h-full flex flex-col items-center justify-center p-3 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10"
                      >
                        <Plus className="w-6 h-6 mb-1 text-orange-400" />
                        <span className="text-[9px] sm:text-xs font-bold">3º Lugar</span>
                      </button>
                    )}
                  </div>
                  <div className="h-6 w-full bg-amber-700/20 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-black text-amber-500 border border-amber-700/40">3º BRONZE</div>
                </div>
              </div>
            </div>

            {/* 3. STATISTICS */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-secondary/10 to-transparent rounded-full blur-2xl"></div>
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-secondary" />
                  <span>Estatísticas de Consumo</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Resumo automático do teu progresso global em Anime e Mangá.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                {/* Completed Anime */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 shadow-inner relative group overflow-hidden">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 self-start">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-black text-white mt-2">
                    {profile.statistics?.totalAnimeCompleted || 0}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Animes Completos</span>
                </div>

                {/* Episodes Watched */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 shadow-inner relative group overflow-hidden">
                  <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl text-primary self-start">
                    <Film className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-black text-white mt-2">
                    {profile.statistics?.totalEpisodesWatched || 0}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Episódios Vistos</span>
                </div>

                {/* Manga Read */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 shadow-inner relative group overflow-hidden">
                  <div className="p-2 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary self-start">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-black text-white mt-2">
                    {profile.statistics?.totalMangaRead || 0}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Capítulos Lidos</span>
                </div>

                {/* Anime Time Spent */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 shadow-inner relative group overflow-hidden">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 self-start">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xl font-black text-white mt-2 truncate">
                    {profile.statistics?.animeDaysWasted ? `${profile.statistics.animeDaysWasted}d` : '0d'}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tempo a ver Anime</span>
                </div>

                {/* Manga Time Spent */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 shadow-inner relative group overflow-hidden">
                  <div className="p-2 bg-pink-500/10 border border-pink-500/20 rounded-xl text-pink-400 self-start">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xl font-black text-white mt-2 truncate">
                    {profile.statistics?.mangaDaysWasted ? `${profile.statistics.mangaDaysWasted}d` : '0d'}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tempo a ler Mangá</span>
                </div>
              </div>
            </div>

            {/* 4. ACHIEVEMENTS */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-2xl"></div>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span>Conquistas Otaku ({profile.achievements?.length || 0}/{catalog.length || 5})</span>
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Completa desafios na tua biblioteca para desbloquear medalhas e badges.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                {catalog.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {catalog.map(ach => {
                      const unlocked = isUnlocked(ach.id);
                      return (
                        <div 
                          key={ach.id} 
                          className={`glass-panel p-4 rounded-2xl border flex flex-col items-center text-center gap-2 group relative transition-all ${unlocked ? 'border-primary/20 bg-primary/5 hover:scale-[1.02]' : 'border-white/5 opacity-40 bg-black/40 grayscale'}`}
                        >
                          <div className="w-14 h-14 rounded-full bg-white/5 p-1 relative flex items-center justify-center">
                            {ach.badgeImageUrl ? (
                              <img src={ach.badgeImageUrl} className="w-full h-full object-contain" alt={ach.name} />
                            ) : (
                              <Award className="w-8 h-8 text-primary" />
                            )}
                            {!unlocked && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                                <span className="material-symbols-outlined text-white text-base">lock</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h5 className="font-bold text-xs sm:text-sm text-white">{ach.name}</h5>
                            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-tight">{ach.description}</p>
                          </div>
                          {unlocked && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 mt-1">
                              Ganho {getUnlockDate(ach.id)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                    <p className="text-xs sm:text-sm italic text-gray-400">Nenhuma conquista registada no catálogo.</p>
                    <button 
                      onClick={async () => {
                        const res = await customFetch(`${API_BASE_URL}/user/achievements/seed`, { method: 'POST' });
                        if (res.ok) {
                          showToast('Conquistas semeadas!', 'success');
                          fetchCatalog();
                          fetchProfile();
                        }
                      }}
                      className="px-4 py-2 bg-primary hover:opacity-90 text-on-primary text-xs font-bold rounded-xl transition-all active:scale-95 shadow"
                    >
                      Popular Catálogo de Conquistas
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Tab Content: Database Synchronization */}
        {activeTab === 'sync' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* AutoSync Releases Card */}
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
                      Obtém automaticamente as informações de episódios novos e lançamentos mais recentes de fontes como AniList e MangaDex.
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
                      <span>AUTOSYNC EM CURSO ({syncStatus.current}/{syncStatus.total})</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      <span>INICIAR AUTOSYNC MANUAL</span>
                    </>
                  )}
                </button>

                {syncStatus.isSyncing && (
                  <div className="p-6 rounded-2xl bg-black/40 border border-primary/30 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-secondary uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span> Progresso em Tempo Real
                      </span>
                      <span className="text-white bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/30 font-mono">
                        {syncStatus.current} / {syncStatus.total} Concluídos
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
                        <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">A atualizar</p>
                        <p className="font-black text-white text-base truncate mt-0.5">
                          {syncStatus.currentItemTitle || 'A ligar às APIs externas...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
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
                      Exporta toda a tua biblioteca de Animes e Mangas para um ficheiro JSON portátil, facilitando a migração entre o PC e o Android.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5 relative z-10">
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

                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Upload className="w-4 h-4 text-primary" />
                  <span>RESTAURAR CÓPIA DE SEGURANÇA</span>
                </button>
              </div>

              {/* Danger Zone: Wipe Library */}
              <div className="pt-6 border-t border-red-500/10 space-y-4">
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">Zona de Perigo</h4>
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h5 className="font-bold text-sm text-white">Limpar Biblioteca</h5>
                    <p className="text-xs text-gray-500 mt-0.5">Apaga permanentemente todos os registos de animes, mangás e progresso da tua conta.</p>
                  </div>
                  <button 
                    onClick={() => setShowWipeConfirm(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow"
                  >
                    Apagar Tudo
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab Content: Account Details */}
        {activeTab === 'account' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Account Info Form */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <User className="w-6 h-6 text-primary" />
                <span>Dados da Conta</span>
              </h3>
              <form onSubmit={handleSaveAccountInfo} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Nome de Utilizador</label>
                    <input 
                      type="text" 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)} 
                      className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all"
                      placeholder="Novo nome de utilizador"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Endereço de Email</label>
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
                </div>
                <div className="pt-6 border-t border-white/5 flex flex-wrap gap-3 justify-end">
                  <button 
                    type="button"
                    onClick={logout} 
                    className="px-6 py-3 rounded-2xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white font-bold text-sm transition-all border border-red-500/30 shadow-lg"
                  >
                    Encerrar Sessão
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

            {/* Favorite Genres Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Heart className="w-6 h-6 text-primary" />
                <span>Géneros Favoritos</span>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Seleciona os teus géneros favoritos de anime e mangá para guardar no teu perfil.</p>
              
              <div className="flex flex-wrap gap-2 pt-2">
                {ALL_GENRES.map(genre => {
                  const currentFavs = profile?.preferences?.favoriteGenres || [];
                  const isFav = currentFavs.includes(genre);
                  return (
                    <button
                      key={genre}
                      onClick={() => handleToggleGenre(genre)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 ${isFav ? 'bg-primary/20 border-primary text-primary-light shadow-[0_0_10px_rgba(106,27,154,0.15)]' : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'}`}
                    >
                      <span>{genre}</span>
                      {isFav && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
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

      {/* Edit Profile Modal (Avatar and Banner) */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl"></div>
            
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-primary-light" />
                <span>Editar Informações de Perfil</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Carrega fotos de perfil e banners diretamente do teu computador ou telemóvel.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Nome de Exibição</label>
                <input 
                  type="text" 
                  value={editName}
                  required
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all text-sm"
                  placeholder="O teu nome no perfil"
                />
              </div>

              {/* Hidden file inputs */}
              <input 
                type="file" 
                id="avatar-upload-file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'avatar')}
                className="hidden"
              />
              <input 
                type="file" 
                id="banner-upload-file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'banner')}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider flex items-center gap-1.5">Foto de Perfil</label>
                  <button
                    type="button"
                    onClick={() => document.getElementById('avatar-upload-file')?.click()}
                    className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4 text-primary" />
                    <span>Importar Foto</span>
                  </button>
                  {editIconUrl && (
                    <button
                      type="button"
                      onClick={() => setEditIconUrl('')}
                      className="w-full py-1 text-center text-[10px] text-red-400 font-bold hover:text-red-300 transition-colors"
                    >
                      Remover Foto
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider flex items-center gap-1.5">Banner de Perfil</label>
                  <button
                    type="button"
                    onClick={() => document.getElementById('banner-upload-file')?.click()}
                    className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4 text-secondary" />
                    <span>Importar Banner</span>
                  </button>
                  {editBannerUrl && (
                    <button
                      type="button"
                      onClick={() => setEditBannerUrl('')}
                      className="w-full py-1 text-center text-[10px] text-red-400 font-bold hover:text-red-300 transition-colors"
                    >
                      Remover Banner
                    </button>
                  )}
                </div>
              </div>

              {editBannerUrl && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-on-surface-variant">
                    <span>Posição Vertical do Banner</span>
                    <span className="text-primary-light font-mono">{editBannerPosition}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={editBannerPosition}
                    onChange={(e) => setEditBannerPosition(Number(e.target.value))}
                    className="w-full accent-primary bg-black/40 h-2 rounded-lg cursor-pointer"
                  />
                  <p className="text-[10px] text-gray-500">Desliza para centrar a melhor parte da imagem.</p>
                </div>
              )}

              {/* Instant previews */}
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-4">
                {editBannerUrl && (
                  <div 
                    className="w-full h-24 rounded-xl border border-white/10 overflow-hidden"
                    style={{
                      backgroundImage: `url(${editBannerUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: `center ${editBannerPosition}%`
                    }}
                  />
                )}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface border border-white/10 overflow-hidden flex items-center justify-center text-lg font-bold text-gray-400">
                    {editIconUrl ? <img src={editIconUrl} className="w-full h-full object-cover" alt="Preview" /> : (editName ? editName.charAt(0).toUpperCase() : '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{editName || 'Nome de Perfil'}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Pré-visualização do Perfil</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-surface-variant/30 text-on-surface-variant hover:text-white font-bold text-xs sm:text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:opacity-90 text-on-primary font-bold text-xs sm:text-sm transition-all shadow-lg flex items-center gap-1.5"
                >
                  {isSavingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Perfil</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Favorites Search & Set Modal */}
      {showFavoritesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-xl p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl"></div>
            
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                <span className="capitalize">Definir {selectedRank}º Destaque de {favSearchType}</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Escolhe um título da tua biblioteca abaixo ou pesquisa por outros títulos no motor de busca.
              </p>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex gap-2">
                <input 
                  type="text" 
                  value={favSearchTerm}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFavSearchTerm(val);
                    if (!val.trim()) {
                      setFavSearchResults(favSearchType === 'anime' ? libraryAnimes : libraryMangas);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearchFavMedia(); }}
                  className="flex-1 bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all text-xs sm:text-sm"
                  placeholder={`Pesquisa títulos ou limpa para ver a tua biblioteca...`}
                />
                <button 
                  onClick={handleSearchFavMedia}
                  className="p-3 bg-primary hover:bg-primary/80 text-on-primary rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow flex items-center justify-center"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results Grid Scrollable */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px] max-h-[350px]">
              {loadingFavSearch ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs text-gray-500">A carregar...</p>
                </div>
              ) : favSearchResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {favSearchResults.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => handleSelectFavorite(item.id)}
                      className="p-2 bg-white/5 border border-white/5 hover:border-primary/40 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-all select-none group"
                    >
                      <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-surface">
                        <img src={item.coverImage?.large} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-white truncate group-hover:text-primary-light transition-colors">
                          {item.title?.english || item.title?.romaji || 'Unknown Title'}
                        </p>
                        <p className="text-[10px] text-gray-500 capitalize mt-0.5">{item.status?.toLowerCase().replace('_', ' ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : favSearchTerm ? (
                <p className="text-center py-10 text-xs sm:text-sm italic text-gray-500">Nenhum resultado encontrado.</p>
              ) : (
                <p className="text-center py-10 text-xs sm:text-sm italic text-gray-500">A tua biblioteca de {favSearchType} está vazia. Pesquisa acima para encontrar títulos.</p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
              <button
                onClick={() => setShowFavoritesModal(false)}
                className="px-5 py-2.5 rounded-xl bg-surface-variant/30 text-on-surface-variant hover:text-white font-bold text-xs sm:text-sm transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 block">OU COLE O CÓDIGO JSON DIRETAMENTE</label>
              <textarea
                placeholder='Cole aqui o conteúdo do seu ficheiro de backup (começando com { "version": 1, ... })'
                value={importJsonInput}
                onChange={(e) => setImportJsonInput(e.target.value)}
                className="w-full h-36 font-mono text-xs p-4 rounded-xl bg-black/60 border border-white/5 text-gray-300 focus:border-secondary/50 focus:outline-none resize-none placeholder:text-gray-600"
              />
            </div>

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
                className="px-6 py-3 rounded-2xl bg-primary hover:opacity-90 text-on-primary font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
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
