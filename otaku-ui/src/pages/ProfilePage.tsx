import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Database, RefreshCw, AlertCircle, User, Shield, 
  Upload, Copy, Check, Award, Heart, 
  Edit3, Search, Clock, Film, BarChart3
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { Capacitor } from '@capacitor/core';
import { customFetch } from '../services/apiBridge';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { getCurrentPalette, savePalette, PALETTES } from '../services/paletteService';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTranslation } from '../hooks/useTranslation';
import { DashboardTab } from '../components/profile/DashboardTab';
import { AccountTab } from '../components/profile/AccountTab';
import { AdminTab } from '../components/profile/AdminTab';





const getRarityBadge = (rarity?: string) => {
  switch (rarity) {
    case 'RARE':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 uppercase tracking-wider">Raro</span>;
    case 'EPIC':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-purple-500/10 border border-purple-500/20 text-purple-400 uppercase tracking-wider">Épico</span>;
    case 'LEGENDARY':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wider">Lendário</span>;
    default:
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-gray-500/10 border border-gray-500/20 text-gray-400 uppercase tracking-wider">Comum</span>;
  }
};

const ProfilePage = () => {
  const { user, logout, token, updateUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'account' | 'admin'>('dashboard');

  useEffect(() => {
    let stateChanged = false;
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      stateChanged = true;
    }
    if (location.state?.openTvTime) {
      setShowTvTimeModal(true);
      stateChanged = true;
    }
    if (stateChanged) {
      window.history.replaceState(null, '');
    }
  }, [location]);
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
  const [editBio, setEditBio] = useState('');
  const [editIconUrl, setEditIconUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editBannerPosition, setEditBannerPosition] = useState<number>(50);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Estados para Recorte de Imagem das Conquistas
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');

  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropImageDimensions, setCropImageDimensions] = useState({ width: 0, height: 0 });
  const [cropBaseScale, setCropBaseScale] = useState(1);

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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
        const compressed = await compressImage(file, 300, 300);
        setEditIconUrl(compressed);
        showToast('Foto de perfil carregada e comprimida!', 'success');
      } else {
        const compressed = await compressImage(file, 1200, 450);
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
  const [showDetailedStatsModal, setShowDetailedStatsModal] = useState(false);
  const [activeStatsTab, setActiveStatsTab] = useState<'anime' | 'manga'>('anime');
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
  const [showWipeAnimeConfirm, setShowWipeAnimeConfirm] = useState(false);
  const [showWipeMangaConfirm, setShowWipeMangaConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // TV Time Import State
  const [showTvTimeModal, setShowTvTimeModal] = useState(false);
  const [isImportingTvTime, setIsImportingTvTime] = useState(false);
  const [tvTimeImportStatus, setTvTimeImportStatus] = useState<{ isImporting: boolean; total: number; processed: number; currentShow: string; errors: string[]; importedShows: any[] } | null>(null);
  const [tvTimeError, setTvTimeError] = useState<string | null>(null);
  const [tvTimeSuccess, setTvTimeSuccess] = useState<string | null>(null);
  const [savingShowId, setSavingShowId] = useState<Record<number, boolean>>({});
  const [tvTimeSearchQuery, setTvTimeSearchQuery] = useState('');

  // TV Time Import status polling
  useEffect(() => {
    let intervalId: any;
    if (isImportingTvTime) {
      const checkStatus = async () => {
        try {
          const res = await customFetch(`${API_BASE_URL}/anime/import-tvtime/status`, {
            headers: getHeaders()
          });
          if (res.ok) {
            const data = await res.json();
            setTvTimeImportStatus(data);
            if (!data.isImporting) {
              setIsImportingTvTime(false);
              if (data.errors && data.errors.length > 0) {
                setTvTimeError(`Importação concluída com ${data.errors.length} erro(s).`);
              } else {
                setTvTimeSuccess('Todos os dados do TV Time foram importados com sucesso!');
              }
              fetchProfile();
            }
          }
        } catch (err) {
          console.error("Erro ao verificar progresso da importação:", err);
        }
      };

      checkStatus();
      intervalId = setInterval(checkStatus, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isImportingTvTime]);

  // Restore TV Time import status on mount if running
  useEffect(() => {
    if (!token) return;
    const checkActiveImport = async () => {
      try {
        const res = await customFetch(`${API_BASE_URL}/anime/import-tvtime/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isImporting) {
            setTvTimeImportStatus(data);
            setIsImportingTvTime(true);
            setShowTvTimeModal(true);
          }
        }
      } catch (err) {
        console.error("Erro ao restabelecer importacao no mount:", err);
      }
    };
    checkActiveImport();
  }, [token]);

  // AutoSync Releases State
  const [syncStatus, setSyncStatus] = useState<{ isSyncing: boolean; total: number; current: number; currentItemTitle: string }>({
    isSyncing: false,
    total: 0,
    current: 0,
    currentItemTitle: ''
  });

  // Admin State
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminSyncLogs, setAdminSyncLogs] = useState<any[]>([]);
  const [adminGiftCodes, setAdminGiftCodes] = useState<any[]>([]);
  const [adminSubscriptions, setAdminSubscriptions] = useState<any[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminGiftSearch, setAdminGiftSearch] = useState('');
  const [adminSubSearch, setAdminSubSearch] = useState('');
  const [isSeedingAchievements, setIsSeedingAchievements] = useState(false);

  // Gift Code Generation State
  const [giftDays, setGiftDays] = useState(30);
  const [giftCustomCode, setGiftCustomCode] = useState('');
  const [giftExpiresAt, setGiftExpiresAt] = useState('');
  const [isGeneratingGift, setIsGeneratingGift] = useState(false);

  // Manage Achievements State
  const [showManageAchievementsModal, setShowManageAchievementsModal] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<any>(null);
  const [editAchievementName, setEditAchievementName] = useState('');
  const [editAchievementDescription, setEditAchievementDescription] = useState('');
  const [editAchievementBadgeUrl, setEditAchievementBadgeUrl] = useState('');
  const [editAchievementRarity, setEditAchievementRarity] = useState('COMMON');
  const [isSavingAchievement, setIsSavingAchievement] = useState(false);

  // User redemption state
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);

  // New Profile Redesign States
  const [favoritePodiumType, setFavoritePodiumType] = useState<'ANIME' | 'MANGA'>('ANIME');
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [visibleActivitiesCount, setVisibleActivitiesCount] = useState(3);

  const fetchRecentActivity = async () => {
    if (!token) return;
    try {
      const [animeRes, mangaRes] = await Promise.all([
        customFetch(`${API_BASE_URL}/anime`, { headers: getHeaders() }),
        customFetch(`${API_BASE_URL}/manga`, { headers: getHeaders() })
      ]);
      
      let allItems: any[] = [];
      if (animeRes.ok) {
        const animes = await animeRes.json();
        allItems = [...allItems, ...animes.map((item: any) => ({ ...item, mediaType: 'anime' }))];
      }
      if (mangaRes.ok) {
        const mangas = await mangaRes.json();
        allItems = [...allItems, ...mangas.map((item: any) => ({ ...item, mediaType: 'manga' }))];
      }
      
      // Filter out items that have no progress updates (lastProgressUpdate is null/undefined)
      const progressUpdatedItems = allItems.filter(item => item.lastProgressUpdate);
      
      // Sort by lastProgressUpdate descending
      progressUpdatedItems.sort((a, b) => {
        const dateA = new Date(a.lastProgressUpdate).getTime();
        const dateB = new Date(b.lastProgressUpdate).getTime();
        return dateB - dateA;
      });
      
      setRecentActivities(progressUpdatedItems);
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }
  };



  const fetchAdminData = async () => {
    if (!token) return;
    setLoadingAdminData(true);
    try {
      const [statsRes, usersRes, logsRes, giftCodesRes, subscriptionsRes] = await Promise.all([
        customFetch(`${API_BASE_URL}/user/admin/stats`, { headers: getHeaders() }),
        customFetch(`${API_BASE_URL}/user/admin/users`, { headers: getHeaders() }),
        customFetch(`${API_BASE_URL}/user/admin/sync-logs`, { headers: getHeaders() }),
        customFetch(`${API_BASE_URL}/user/admin/gift-codes`, { headers: getHeaders() }),
        customFetch(`${API_BASE_URL}/user/admin/subscriptions`, { headers: getHeaders() })
      ]);

      if (statsRes.ok) setAdminStats(await statsRes.json());
      if (usersRes.ok) setAdminUsers(await usersRes.json());
      if (logsRes.ok) setAdminSyncLogs(await logsRes.json());
      if (giftCodesRes.ok) setAdminGiftCodes(await giftCodesRes.json());
      if (subscriptionsRes.ok) setAdminSubscriptions(await subscriptionsRes.json());
    } catch (err) {
      console.error('Error fetching admin data:', err);
      showToast('Erro ao carregar dados do painel admin.', 'error');
    } finally {
      setLoadingAdminData(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin') {
      fetchAdminData();
    }
  }, [activeTab, token]);

  const handleUpdateUserRole = async (targetUserId: number, newRole: string) => {
    if (!token) return;
    try {
      const res = await customFetch(`${API_BASE_URL}/user/admin/users/${targetUserId}/role`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ tipoConta: newRole })
      });
      if (res.ok) {
        showToast('Função do utilizador atualizada com sucesso!', 'success');
        setAdminUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, tipoConta: newRole } : u));
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Falha ao atualizar função do utilizador.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    }
  };

  const handleAdminSeedAchievements = async () => {
    if (!token) return;
    setIsSeedingAchievements(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/achievements/seed`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Conquistas repovoadas com sucesso no sistema!', 'success');
        fetchCatalog();
      } else {
        showToast('Falha ao repovoar conquistas.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    } finally {
      setIsSeedingAchievements(false);
    }
  };



  const handleGenerateGiftCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsGeneratingGift(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/admin/gift-codes/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          durationDays: giftDays,
          customCode: giftCustomCode || undefined,
          expiresAt: giftExpiresAt || undefined
        })
      });
      if (res.ok) {
        showToast('Gift Card gerado com sucesso!', 'success');
        setGiftCustomCode('');
        setGiftExpiresAt('');
        // Refresh codes list
        const refreshedCodes = await customFetch(`${API_BASE_URL}/user/admin/gift-codes`, { headers: getHeaders() });
        if (refreshedCodes.ok) setAdminGiftCodes(await refreshedCodes.json());
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Falha ao gerar Gift Card.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    } finally {
      setIsGeneratingGift(false);
    }
  };


  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !redeemCodeInput.trim()) return;
    setIsRedeemingCode(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/subscription/redeem`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code: redeemCodeInput })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Premium resgatado com sucesso!', 'success');
        setRedeemCodeInput('');
        fetchProfile();
        updateUser({ tipoConta: 'pro' });
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Falha ao resgatar código.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    } finally {
      setIsRedeemingCode(false);
    }
  };

  const handleAchievementIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor, seleciona um ficheiro de imagem válido.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCropImageSrc(event.target?.result as string);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    setCropImageDimensions({ width: naturalWidth, height: naturalHeight });

    const M = 200; // crop size
    const scale = Math.max(M / naturalWidth, M / naturalHeight);
    setCropBaseScale(scale);

    img.style.width = `${naturalWidth * scale}px`;
    img.style.height = `${naturalHeight * scale}px`;
  };

  const clampOffsets = (newOffsetX: number, newOffsetY: number, currentZoom: number) => {
    const M = 200;
    const C = 280;
    const cropLeft = (C - M) / 2; // 40
    const cropTop = (C - M) / 2; // 40

    const w = cropImageDimensions.width * cropBaseScale * currentZoom;
    const h = cropImageDimensions.height * cropBaseScale * currentZoom;

    const x0 = (C - w) / 2;
    const y0 = (C - h) / 2;

    const minX = cropLeft + M - w - x0;
    const maxX = cropLeft - x0;
    const minY = cropTop + M - h - y0;
    const maxY = cropTop - y0;

    const clampedX = Math.min(Math.max(newOffsetX, minX), maxX);
    const clampedY = Math.min(Math.max(newOffsetY, minY), maxY);

    return { x: clampedX, y: clampedY };
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    const clamped = clampOffsets(offsetX, offsetY, newZoom);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newOffsetX = e.clientX - dragStart.x;
    const newOffsetY = e.clientY - dragStart.y;
    const clamped = clampOffsets(newOffsetX, newOffsetY, zoom);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
  };

  const handleCropTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offsetX,
        y: e.touches[0].clientY - offsetY,
      });
    }
  };

  const handleCropTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const newOffsetX = e.touches[0].clientX - dragStart.x;
    const newOffsetY = e.touches[0].clientY - dragStart.y;
    const clamped = clampOffsets(newOffsetX, newOffsetY, zoom);
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
  };

  const handleCropTouchEnd = () => {
    setIsDragging(false);
  };

  const handleConfirmCrop = () => {
    if (!cropImageSrc) return;

    const img = new Image();
    img.src = cropImageSrc;
    img.onload = () => {
      const M = 200; // crop size
      const C = 280;
      const cropLeft = 40;
      const cropTop = 40;

      const w = cropImageDimensions.width * cropBaseScale * zoom;
      const h = cropImageDimensions.height * cropBaseScale * zoom;

      const x0 = (C - w) / 2;
      const y0 = (C - h) / 2;

      const actualX = x0 + offsetX;
      const actualY = y0 + offsetY;

      const relativeX = cropLeft - actualX;
      const relativeY = cropTop - actualY;

      const scaleFactor = cropBaseScale * zoom;
      const sourceX = relativeX / scaleFactor;
      const sourceY = relativeY / scaleFactor;
      const sourceWidth = M / scaleFactor;
      const sourceHeight = M / scaleFactor;

      const canvas = document.createElement('canvas');
      canvas.width = 150;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, 150, 150
        );
        const croppedBase64 = canvas.toDataURL('image/png');
        setEditAchievementBadgeUrl(croppedBase64);
        showToast('Ícone da conquista recortado e ajustado!', 'success');
      }

      setShowCropModal(false);
      setCropImageSrc('');
    };
  };

  const selectAchievementForEdit = (ach: any) => {
    setEditingAchievement(ach);
    setEditAchievementName(ach.name);
    setEditAchievementDescription(ach.description);
    setEditAchievementBadgeUrl(ach.badgeImageUrl || '');
    setEditAchievementRarity(ach.rarity || 'COMMON');
  };

  const handleSaveAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAchievement) return;
    if (!editAchievementName.trim() || !editAchievementDescription.trim()) {
      showToast('Nome e descrição são obrigatórios.', 'warning');
      return;
    }
    setIsSavingAchievement(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/admin/achievements/${editingAchievement.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editAchievementName,
          description: editAchievementDescription,
          badgeImageUrl: editAchievementBadgeUrl || null,
          rarity: editAchievementRarity
        })
      });
      if (res.ok) {
        showToast('Conquista atualizada com sucesso!', 'success');
        setEditingAchievement(null);
        setEditAchievementName('');
        setEditAchievementDescription('');
        setEditAchievementBadgeUrl('');
        setEditAchievementRarity('COMMON');
        fetchCatalog();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Falha ao atualizar conquista.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro: ${err.message || err}`, 'error');
    } finally {
      setIsSavingAchievement(false);
    }
  };

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

  // Fetch details of top favorites from AniList/cache (Now pre-populated locally by backend)
  const fetchFavoriteDetails = () => {
    if (!profile?.topFavorites) return;
    
    const details: Record<string, { title: string; coverUrl: string }> = {};
    profile.topFavorites.forEach((fav: any) => {
      details[`${fav.mediaType}-${fav.rankPosition}`] = {
        title: fav.titulo || fav.title || 'Título Desconhecido',
        coverUrl: fav.capaUrl || fav.coverUrl || ''
      };
    });
    setFavoriteDetails(details);
  };

  useEffect(() => {
    fetchProfile();
    fetchCatalog();
    fetchRecentActivity();
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
      setEditBio(profile.preferences?.bio || '');
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
      bannerPosition: editBannerPosition,
      bio: editBio
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
          iconUrl: editIconUrl || null,
          bannerUrl: editBannerUrl || null,
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
            return {
              id: type === 'anime' ? item.animeId : item.mangaId,
              coverImage: {
                large: item.capaUrl
              },
              title: {
                english: item.titulo,
                romaji: item.titulo
              },
              status: item.statusLancamento
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
  const handleWipeAnimeLibrary = async () => {
    setIsWiping(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/library/anime`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Falha ao apagar animes no servidor.');
      showToast('Biblioteca de animes apagada com sucesso!', 'success');
      setShowWipeAnimeConfirm(false);
      fetchProfile();
    } catch (err: any) {
      showToast(`Erro ao apagar animes: ${err.message || err}`, 'error');
    } finally {
      setIsWiping(false);
    }
  };

  const handleWipeMangaLibrary = async () => {
    setIsWiping(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/user/library/manga`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Falha ao apagar mangás no servidor.');
      showToast('Biblioteca de mangás apagada com sucesso!', 'success');
      setShowWipeMangaConfirm(false);
      fetchProfile();
    } catch (err: any) {
      showToast(`Erro ao apagar mangás: ${err.message || err}`, 'error');
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

  const handleTvTimeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          setTvTimeError('O ficheiro selecionado não é um JSON válido.');
          return;
        }

        if (!Array.isArray(parsed)) {
          setTvTimeError('Formato inválido. O ficheiro do TV Time deve ser uma lista (array) de séries.');
          return;
        }

        setTvTimeError(null);
        setTvTimeSuccess(null);
        setTvTimeImportStatus({
          isImporting: true,
          total: parsed.length,
          processed: 0,
          currentShow: 'A enviar...',
          errors: [],
          importedShows: []
        });
        setIsImportingTvTime(true);

        const res = await customFetch(`${API_BASE_URL}/anime/import-tvtime`, {
          method: 'POST',
          headers: {
            ...getHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(parsed)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Falha ao iniciar importação.');
        }

      } catch (err: any) {
        setTvTimeError(err.message || 'Erro ao iniciar importação.');
        setIsImportingTvTime(false);
        setTvTimeImportStatus(null);
      }
    };
    reader.readAsText(file);
  };
  
  const handleQuickUpdateShow = async (userAnimeId: number, updatedFields: any) => {
    if (!userAnimeId) return;
    setSavingShowId(prev => ({ ...prev, [userAnimeId]: true }));
    try {
      const res = await customFetch(`${API_BASE_URL}/anime/${userAnimeId}`, {
        method: 'PATCH',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedFields)
      });
      if (!res.ok) {
        throw new Error('Falha ao atualizar.');
      }
      
      setTvTimeImportStatus(prev => {
        if (!prev) return null;
        return {
          ...prev,
          importedShows: prev.importedShows.map(show => {
            if (show.id === userAnimeId) {
              return { ...show, ...updatedFields };
            }
            return show;
          })
        };
      });
    } catch (err) {
      showToast('Falha ao atualizar progresso.', 'error');
    } finally {
      setSavingShowId(prev => ({ ...prev, [userAnimeId]: false }));
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
      const res = await customFetch(`${API_BASE_URL}/sync/start?bypass=true`, { method: 'POST' });
      if (!res.ok) {
        setReleaseSyncError('Falha ao ligar ao servidor. Verifique se o backend está a correr.');
        return;
      }
      checkSyncStatus();
    } catch (err: any) {
      setReleaseSyncError(`Erro de conexão: ${err.message || 'Servidor indisponível'}`);
    }
  };



  const ALL_GENRES = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
    "Horror", "Mecha", "Mystery", "Psychological", "Romance", 
    "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
  ];



  return (
    <div className="min-h-screen bg-surface-dim text-on-background font-body-md pb-24">
      {/* 1. Immersive Hero Banner */}
      <section className="relative h-[360px] md:h-[460px] w-full overflow-hidden">
        <div className="absolute inset-0">
          {profile?.bannerUrl ? (
            <img 
              src={profile.bannerUrl} 
              alt="Banner" 
              className="w-full h-full object-cover pointer-events-none opacity-60"
              style={{ objectPosition: `center ${profile?.preferences?.bannerPosition ?? '50'}%` }}
            />
          ) : (
            <div className="absolute inset-0 bg-surface-container-highest opacity-40 blur-3xl" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-dim via-surface-dim/40 to-transparent"></div>
          {isMobile && (
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1014] via-transparent to-transparent"></div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 w-full px-margin-mobile md:px-margin-desktop pb-8 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 text-center md:text-left">
          {/* Profile Picture */}
          <div className="relative group">
            <div className="w-32 h-32 md:w-44 md:h-44 rounded-3xl overflow-hidden border-4 border-surface-dim shadow-2xl z-10 relative bg-surface-variant flex items-center justify-center text-4xl font-black text-white">
              {profile?.iconUrl ? (
                <img src={profile.iconUrl} className="w-full h-full object-cover" alt="Avatar" />
              ) : (
                user?.nome ? user.nome.charAt(0).toUpperCase() : 'O'
              )}
            </div>
          </div>

          {/* User Details */}
          <div className="flex-grow min-w-0 space-y-1.5 md:mb-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <h2 className="font-display-md text-2xl md:text-display-md font-extrabold text-white leading-tight truncate max-w-full drop-shadow">
                {user?.nome || 'Otaku Time Member'}
              </h2>
              {user?.tipoConta === 'ADMIN' ? (
                <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-label-sm font-bold border border-red-500/30 shadow-sm animate-pulse flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> ADMIN
                </span>
              ) : user?.tipoConta === 'pro' ? (
                <span className="bg-secondary/20 text-secondary px-3 py-1 rounded-full text-label-sm font-bold border border-secondary/30 shadow-sm flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> PRO TIER
                </span>
              ) : (
                <span className="bg-gray-500/20 text-gray-400 px-3 py-1 rounded-full text-label-sm font-bold border border-gray-500/40 shadow-sm flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> MEMBRO
                </span>
              )}
            </div>
            {profile?.preferences?.bio && (
              <p className="font-body-md text-on-surface-variant max-w-2xl text-xs md:text-sm leading-relaxed">
                {profile.preferences.bio}
              </p>
            )}
            {profile?.subscription?.status === 'ACTIVE' && (
              <p className="text-xs text-amber-400 font-bold flex items-center justify-center md:justify-start gap-1 drop-shadow mt-1">
                <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Premium válido até {new Date(profile.subscription.currentPeriodEnd).toLocaleDateString('pt-PT')}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3 md:mb-2 shrink-0 w-full sm:w-auto justify-center">
            <button 
              onClick={() => setShowEditProfileModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 cursor-pointer text-xs"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Perfil</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Navigation Tabs under Banner */}
      <div className="max-w-container-max mx-auto mt-8">
        <div className="flex gap-2.5 border-b border-white/10 pb-4 overflow-x-auto w-full no-scrollbar px-margin-mobile md:px-margin-desktop">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' 
                : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Perfil & Conquistas</span>
          </button>

          <button 
            onClick={() => setActiveTab('account')} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'account' 
                ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' 
                : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Configurações</span>
          </button>

          {user?.tipoConta === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('admin')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'admin' 
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/30 scale-105' 
                  : 'bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Painel Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Loading Indicator */}
      {loadingProfile && activeTab === 'dashboard' && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <RefreshCw className="w-10 h-10 animate-spin text-primary" />
          <p className="text-xs text-gray-500">A carregar detalhes do perfil...</p>
        </div>
      )}

      {/* 4. Tab Contents */}
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mt-8">
        
        {/* TAB 1: DASHBOARD (Perfil & Conquistas) */}
        {!loadingProfile && activeTab === 'dashboard' && profile && (
          <DashboardTab
            profile={profile}
            catalog={catalog}
            favoritePodiumType={favoritePodiumType}
            setFavoritePodiumType={setFavoritePodiumType}
            favoriteDetails={favoriteDetails}
            recentActivities={recentActivities}
            visibleActivitiesCount={visibleActivitiesCount}
            setVisibleActivitiesCount={setVisibleActivitiesCount}
            setShowDetailedStatsModal={setShowDetailedStatsModal}
            openFavoritesSearch={openFavoritesSearch}
            handleRemoveFavorite={handleRemoveFavorite}
            user={user}
            customFetch={customFetch}
            API_BASE_URL={API_BASE_URL}
            showToast={showToast}
            fetchCatalog={fetchCatalog}
            fetchProfile={fetchProfile}
            navigate={navigate}
          />
        )}

        {/* TAB 2: CONFIGURAÇÕES (Definições) */}
        {activeTab === 'account' && (
          <AccountTab
            user={user}
            profile={profile}
            t={t}
            isUpdatingPreferences={isUpdatingPreferences}
            handleUpdatePreference={handleUpdatePreference}
            selectedPalette={selectedPalette}
            PALETTES={PALETTES}
            handlePaletteChange={handlePaletteChange}
            showToast={showToast}
            newName={newName}
            setNewName={setNewName}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            isSavingAccount={isSavingAccount}
            handleSaveAccountInfo={handleSaveAccountInfo}
            logout={logout}
            ALL_GENRES={ALL_GENRES}
            handleToggleGenre={handleToggleGenre}
            redeemCodeInput={redeemCodeInput}
            setRedeemCodeInput={setRedeemCodeInput}
            handleRedeemCode={handleRedeemCode}
            isRedeemingCode={isRedeemingCode}
            isExporting={isExporting}
            handleExportBackup={handleExportBackup}
            setShowRestoreModal={setShowRestoreModal}
            setShowTvTimeModal={setShowTvTimeModal}
            setShowWipeAnimeConfirm={setShowWipeAnimeConfirm}
            setShowWipeMangaConfirm={setShowWipeMangaConfirm}
          />
        )}

        {/* TAB 3: PAINEL ADMIN */}
        {activeTab === 'admin' && user?.tipoConta === 'ADMIN' && (
          <AdminTab
            loadingAdminData={loadingAdminData}
            adminStats={adminStats}
            adminUsers={adminUsers}
            adminUserSearch={adminUserSearch}
            setAdminUserSearch={setAdminUserSearch}
            user={user}
            handleUpdateUserRole={handleUpdateUserRole}
            adminSyncLogs={adminSyncLogs}
            handleAdminSeedAchievements={handleAdminSeedAchievements}
            isSeedingAchievements={isSeedingAchievements}
            setShowManageAchievementsModal={setShowManageAchievementsModal}
            fetchAdminData={fetchAdminData}
            syncStatus={syncStatus}
            triggerManualReleaseSync={triggerManualReleaseSync}
            releaseSyncError={releaseSyncError}
            giftDays={giftDays}
            setGiftDays={setGiftDays}
            giftCustomCode={giftCustomCode}
            setGiftCustomCode={setGiftCustomCode}
            giftExpiresAt={giftExpiresAt}
            setGiftExpiresAt={setGiftExpiresAt}
            isGeneratingGift={isGeneratingGift}
            handleGenerateGiftCode={handleGenerateGiftCode}
            adminGiftSearch={adminGiftSearch}
            setAdminGiftSearch={setAdminGiftSearch}
            adminGiftCodes={adminGiftCodes}
            adminSubscriptions={adminSubscriptions}
            adminSubSearch={adminSubSearch}
            setAdminSubSearch={setAdminSubSearch}
          />
        )}
      </div>
      {/* Edit Profile Modal (Avatar and Banner) */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 pb-32 sm:pb-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 flex justify-center items-start sm:items-center">
          <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="space-y-2 mb-6">
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

              <div className="space-y-2">
                <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Frase do Perfil (Biografia)</label>
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-black/40 text-white font-bold p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all text-sm resize-none h-20"
                  placeholder="Escreve uma frase ou biografia curta..."
                  maxLength={150}
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
                  <div className="w-full h-24 rounded-xl border border-white/10 overflow-hidden relative">
                    <img 
                      src={editBannerUrl} 
                      alt="Banner Preview" 
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ objectPosition: `center ${editBannerPosition}%` }}
                    />
                  </div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
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

      {/* TV Time Import Modal */}
      {showTvTimeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-2xl p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/15 to-transparent rounded-full blur-2xl"></div>
            
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <Database className="w-6 h-6 text-primary" />
                <span>Importar Dados do TV Time</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Selecione o ficheiro JSON que exportou do TV Time. Vamos pesquisar e mapear cada série automaticamente para a nossa base de dados.
              </p>
            </div>

            {!isImportingTvTime && !tvTimeImportStatus && (
              <div className="p-8 rounded-2xl border border-dashed border-white/10 hover:border-white/20 transition-all bg-white/5 flex flex-col items-center justify-center text-center gap-4">
                <span className="material-symbols-outlined text-gray-400 text-4xl">upload_file</span>
                <div>
                  <label htmlFor="tvtime-file" className="cursor-pointer px-6 py-3 rounded-xl bg-primary hover:opacity-90 text-on-primary font-bold text-sm transition-all shadow-md inline-block">
                    Selecionar Ficheiro JSON
                  </label>
                  <input 
                    type="file" 
                    id="tvtime-file" 
                    accept=".json"
                    onChange={handleTvTimeFile}
                    className="hidden" 
                  />
                  <p className="text-[10px] text-gray-500 mt-2">Geralmente nomeado como "seen_shows.json" ou "shows_to_watch.json"</p>
                </div>
              </div>
            )}

            {isImportingTvTime && (
              <div className="space-y-4 p-6 rounded-2xl bg-white/5 border border-white/5 relative z-10 animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-white">Progresso de Importação</span>
                  <span className="text-primary font-bold">
                    {tvTimeImportStatus?.processed || 0} / {tvTimeImportStatus?.total || 0}
                  </span>
                </div>

                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300 rounded-full"
                    style={{ 
                      width: `${
                        tvTimeImportStatus?.total 
                          ? ((tvTimeImportStatus.processed / tvTimeImportStatus.total) * 100).toFixed(0)
                          : '0'
                      }%` 
                    }}
                  />
                </div>

                <div className="text-xs space-y-1">
                  <p className="text-gray-400">
                    Série atual: <span className="text-white font-semibold">{tvTimeImportStatus?.currentShow || 'A processar...'}</span>
                  </p>
                  <p className="text-gray-500 animate-pulse">Por favor, não feche esta janela enquanto a importação decorre.</p>
                </div>

                {tvTimeImportStatus?.errors && tvTimeImportStatus.errors.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <span className="text-xs font-bold text-red-400">Avisos / Erros ({tvTimeImportStatus.errors.length}):</span>
                    <div className="max-h-24 overflow-y-auto text-[10px] font-mono p-3 rounded-xl bg-black/40 border border-white/5 text-red-300 space-y-1">
                      {tvTimeImportStatus.errors.slice(-5).map((err, idx) => (
                        <p key={idx}>{err}</p>
                      ))}
                      {tvTimeImportStatus.errors.length > 5 && (
                        <p className="text-gray-500">... e mais {tvTimeImportStatus.errors.length - 5} erros.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isImportingTvTime && tvTimeImportStatus && (
              <div className="space-y-4 relative z-10 animate-in fade-in duration-300">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    Importação concluída com sucesso!
                  </span>
                  
                  {/* Search box to filter shows */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="text"
                      placeholder="Pesquisar série..."
                      value={tvTimeSearchQuery}
                      onChange={(e) => setTvTimeSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary focus:outline-none placeholder:text-gray-600"
                    />
                  </div>
                </div>

                {/* Grid List of imported shows for quick edit */}
                <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                  {tvTimeImportStatus.importedShows
                    .filter(show => !tvTimeSearchQuery || show.titulo.toLowerCase().includes(tvTimeSearchQuery.toLowerCase()))
                    .map((item) => (
                      <div key={item.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4 hover:bg-white/10 hover:border-white/10 transition-all">
                        {/* Cover Image */}
                        <div className="w-10 h-14 bg-white/10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/5">
                          {item.capaUrl ? (
                            <img src={item.capaUrl} alt={item.titulo} className="w-full h-full object-cover" />
                          ) : (
                            <Film className="w-5 h-5 text-gray-600" />
                          )}
                        </div>

                        {/* Title and Edit Controls */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm text-white truncate">{item.titulo}</h4>
                            {savingShowId[item.id] && (
                              <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                            )}
                          </div>

                          <div className="flex items-center gap-3 flex-wrap text-xs">
                            {/* Tracking Status Dropdown */}
                            <select
                              value={item.status}
                              onChange={(e) => handleQuickUpdateShow(item.id, { status: e.target.value })}
                              className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/15 text-gray-300 focus:outline-none focus:border-primary text-xs cursor-pointer font-medium"
                            >
                              <option value="WATCHING">A Assistir</option>
                              <option value="COMPLETED">Completado</option>
                              <option value="PAUSED">Em Pausa</option>
                              <option value="DROPPED">Abandonado</option>
                              <option value="PLANNED">Planear</option>
                            </select>

                            {/* Season Control */}
                            <div className="flex items-center bg-black/40 border border-white/15 rounded-lg overflow-hidden">
                              <span className="px-2 py-1 text-gray-500 font-mono text-[10px]">Temp.</span>
                              <input 
                                type="number"
                                min={1}
                                value={item.seasonAtual}
                                onChange={(e) => handleQuickUpdateShow(item.id, { seasonAtual: parseInt(e.target.value) || 1 })}
                                className="w-10 text-center bg-transparent border-none text-white focus:outline-none text-xs py-1"
                              />
                            </div>

                            {/* Episode Control */}
                            <div className="flex items-center bg-black/40 border border-white/15 rounded-lg overflow-hidden">
                              <span className="px-2 py-1 text-gray-500 font-mono text-[10px]">Ep.</span>
                              <input 
                                type="number"
                                min={0}
                                value={item.epAtual}
                                onChange={(e) => handleQuickUpdateShow(item.id, { epAtual: parseInt(e.target.value) || 0 })}
                                className="w-12 text-center bg-transparent border-none text-white focus:outline-none text-xs py-1"
                              />
                              {item.numEpisodiosTotal && (
                                <span className="pr-2 text-[10px] text-gray-600">/ {item.numEpisodiosTotal}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {tvTimeImportStatus.importedShows.filter(show => !tvTimeSearchQuery || show.titulo.toLowerCase().includes(tvTimeSearchQuery.toLowerCase())).length === 0 && (
                    <p className="text-center text-xs text-gray-500 py-6">Nenhuma série importada corresponde à pesquisa.</p>
                  )}
                </div>

                {/* Errors list if any */}
                {tvTimeImportStatus.errors && tvTimeImportStatus.errors.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                    <span className="text-xs font-bold text-red-400">Avisos / Erros na Importação ({tvTimeImportStatus.errors.length}):</span>
                    <div className="max-h-24 overflow-y-auto text-[10px] font-mono p-3 rounded-xl bg-black/40 border border-white/5 text-red-300 space-y-1">
                      {tvTimeImportStatus.errors.map((err: string, idx: number) => (
                        <p key={idx}>{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tvTimeError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 animate-in fade-in duration-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs font-bold">{tvTimeError}</p>
              </div>
            )}

            {tvTimeSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 animate-in fade-in duration-300">
                <Check className="w-5 h-5 flex-shrink-0 animate-bounce" />
                <p className="text-xs font-bold">{tvTimeSuccess}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
              {!isImportingTvTime ? (
                <button
                  onClick={() => {
                    setShowTvTimeModal(false);
                    setTvTimeError(null);
                    setTvTimeSuccess(null);
                    setTvTimeImportStatus(null);
                    setIsImportingTvTime(false);
                  }}
                  className="px-6 py-3 rounded-2xl bg-surface-variant/30 text-on-surface-variant hover:text-white font-bold text-sm transition-all cursor-pointer"
                >
                  Fechar
                </button>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 text-xs text-primary font-bold animate-pulse py-3 select-none">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A IMPORTAR...</span>
                  </div>
                  <button
                    onClick={() => setShowTvTimeModal(false)}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-light text-on-primary font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-md"
                  >
                    Minimizar Janela
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wipe Anime Confirmation Modal */}
      {showWipeAnimeConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-[32px] border border-red-500/30 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/15 to-transparent rounded-full blur-2xl"></div>
            
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center justify-center sm:justify-start gap-2">
                <AlertCircle className="w-6 h-6 text-red-500 animate-bounce" />
                <span>Apagar Biblioteca de Animes?</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Esta ação é <span className="text-red-500 font-bold">destrutiva e irreversível</span>. Todos os animes, episódios atuais e prioridades serão removidos da sua biblioteca pessoal. O catálogo global de animes não será afetado.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <button
                onClick={() => setShowWipeAnimeConfirm(false)}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-surface-variant/30 text-on-surface-variant hover:text-white font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleWipeAnimeLibrary}
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
                    <span>SIM, APAGAR ANIMES</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wipe Manga Confirmation Modal */}
      {showWipeMangaConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-[32px] border border-red-500/30 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/15 to-transparent rounded-full blur-2xl"></div>
            
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center justify-center sm:justify-start gap-2">
                <AlertCircle className="w-6 h-6 text-red-500 animate-bounce" />
                <span>Apagar Biblioteca de Mangás?</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Esta ação é <span className="text-red-500 font-bold">destrutiva e irreversível</span>. Todos os mangás, capítulos atuais e prioridades serão removidos da sua biblioteca pessoal. O catálogo global de mangás não será afetado.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <button
                onClick={() => setShowWipeMangaConfirm(false)}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-surface-variant/30 text-on-surface-variant hover:text-white font-bold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleWipeMangaLibrary}
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
                    <span>SIM, APAGAR MANGÁS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Achievements Modal */}
      {showManageAchievementsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-4xl p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <Award className="w-6 h-6 text-amber-400" />
                  <span>Gerir Conquistas</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Visualiza e edita os detalhes das conquistas registadas no sistema.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowManageAchievementsModal(false);
                  setEditingAchievement(null);
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Achievement List */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lista de Conquistas ({catalog.length})</h4>
                <div className="max-h-[380px] overflow-y-auto space-y-3 pr-2 rounded-xl border border-white/5 bg-black/30 p-3">
                  {catalog.map((ach) => {
                    const isEditingThis = editingAchievement?.id === ach.id;
                    return (
                      <div
                        key={ach.id}
                        onClick={() => selectAchievementForEdit(ach)}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isEditingThis
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-white/5 p-1 flex items-center justify-center flex-shrink-0">
                            {ach.badgeImageUrl ? (
                              <img src={ach.badgeImageUrl} className="w-full h-full object-contain" alt={ach.name} />
                            ) : (
                              <Award className="w-6 h-6 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-bold text-sm text-white">{ach.name}</h5>
                              {getRarityBadge(ach.rarity)}
                            </div>
                            <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{ach.description}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-primary hover:text-on-primary hover:border-primary text-[10px] font-bold text-white transition-all"
                        >
                          Editar
                        </button>
                      </div>
                    );
                  })}
                  {catalog.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-xs font-medium">
                      Nenhuma conquista encontrada. Clica em "Repovoar Conquistas" para semear.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Edit Form */}
              <div className="lg:col-span-5 space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {editingAchievement ? 'Editar Detalhes' : 'Selecione para Editar'}
                </h4>
                {editingAchievement ? (
                  <form onSubmit={handleSaveAchievement} className="space-y-4 bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Nome da Conquista</label>
                      <input
                        type="text"
                        value={editAchievementName}
                        onChange={(e) => setEditAchievementName(e.target.value)}
                        className="w-full bg-black/40 text-white font-bold p-2.5 rounded-lg border border-white/10 outline-none text-xs focus:border-primary"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Descrição</label>
                      <textarea
                        value={editAchievementDescription}
                        onChange={(e) => setEditAchievementDescription(e.target.value)}
                        rows={2}
                        className="w-full bg-black/40 text-white font-medium p-2.5 rounded-lg border border-white/10 outline-none text-xs focus:border-primary resize-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Raridade</label>
                        <select
                          value={editAchievementRarity}
                          onChange={(e) => setEditAchievementRarity(e.target.value)}
                          className="w-full bg-black/40 text-white font-bold p-2.5 rounded-lg border border-white/10 outline-none text-xs cursor-pointer focus:border-primary"
                        >
                          <option value="COMMON">Comum</option>
                          <option value="RARE">Raro</option>
                          <option value="EPIC">Épico</option>
                          <option value="LEGENDARY">Lendário</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Carregar Ícone</label>
                        <input
                          type="file"
                          id="achievement-icon-file"
                          accept="image/*"
                          onChange={handleAchievementIconChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('achievement-icon-file')?.click()}
                          className="w-full py-2.5 px-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          <span>Upload Icon</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">URL do Ícone (Alternativo)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={editAchievementBadgeUrl}
                          onChange={(e) => setEditAchievementBadgeUrl(e.target.value)}
                          className="flex-1 bg-black/40 text-white font-mono p-2 rounded-lg border border-white/10 outline-none text-[10px] focus:border-primary"
                          placeholder="EX: https://..."
                        />
                        {editAchievementBadgeUrl && (
                          <div className="w-8 h-8 rounded-full bg-white/5 p-0.5 flex items-center justify-center flex-shrink-0 border border-white/10">
                            <img src={editAchievementBadgeUrl} className="w-full h-full object-contain rounded-full" alt="Preview" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setEditingAchievement(null)}
                        className="flex-1 py-2 rounded-lg bg-surface-variant/30 text-on-surface-variant hover:text-white text-xs font-bold transition-all border border-white/5"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingAchievement}
                        className="flex-1 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow"
                      >
                        {isSavingAchievement ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Salvar</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="border border-dashed border-white/10 rounded-xl p-8 text-center text-gray-500 text-xs flex flex-col items-center justify-center gap-2 bg-black/10 min-h-[220px]">
                    <Award className="w-8 h-8 text-gray-600" />
                    <span>Seleciona uma conquista na lista para editar os seus detalhes.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-md p-6 rounded-[32px] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col items-center">
            <div className="space-y-1 text-center w-full">
              <h3 className="text-lg font-black text-white flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-amber-400">crop</span>
                <span>Ajustar Ícone da Conquista</span>
              </h3>
              <p className="text-xs text-gray-400">Arraste a imagem para reposicionar e use a barra para fazer zoom.</p>
            </div>

            {/* Crop Interactive Area */}
            <div 
              className="w-[280px] h-[280px] bg-black/40 border border-white/15 rounded-2xl overflow-hidden relative flex items-center justify-center cursor-move select-none"
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
              onTouchStart={handleCropTouchStart}
              onTouchMove={handleCropTouchMove}
              onTouchEnd={handleCropTouchEnd}
            >
              {/* Scaled/Positioned Image */}
              {cropImageSrc && (
                <img
                  src={cropImageSrc}
                  alt="Crop Target"
                  id="crop-image-element"
                  className="absolute max-w-none origin-center pointer-events-none"
                  style={{
                    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                  }}
                  onLoad={handleCropImageLoad}
                />
              )}

              {/* Circular overlay mask */}
              <div className="w-[200px] h-[200px] rounded-full border-2 border-amber-500 border-dashed absolute pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"></div>
            </div>

            {/* Zoom Slider */}
            <div className="w-full flex items-center gap-3 px-4">
              <span className="material-symbols-outlined text-gray-400 text-sm">zoom_out</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={handleZoomChange}
                className="flex-1 accent-amber-500 bg-black/40 h-2 rounded-lg cursor-pointer"
              />
              <span className="material-symbols-outlined text-gray-400 text-sm">zoom_in</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setCropImageSrc('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-surface-variant/30 text-on-surface-variant hover:text-white text-xs font-bold transition-all border border-white/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow"
              >
                <span className="material-symbols-outlined text-xs">check</span>
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Statistics Modal */}
      {showDetailedStatsModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 pb-32 sm:pb-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 flex justify-center items-start sm:items-center">
          <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 my-auto text-left">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-primary-light" />
                <span>Estatísticas Detalhadas</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowDetailedStatsModal(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer text-sm font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/5"
              >
                Fechar
              </button>
            </div>

            {/* Tab selector */}
            <div className="flex p-1 bg-black/40 border border-white/10 rounded-2xl mb-6">
              <button 
                type="button"
                onClick={() => setActiveStatsTab('anime')}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeStatsTab === 'anime' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-white'}`}
              >
                Estatísticas de Anime
              </button>
              <button 
                type="button"
                onClick={() => setActiveStatsTab('manga')}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeStatsTab === 'manga' ? 'bg-secondary text-on-secondary shadow' : 'text-on-surface-variant hover:text-white'}`}
              >
                Estatísticas de Mangá
              </button>
            </div>

            {/* Content area */}
            <div className="space-y-6">
              {activeStatsTab === 'anime' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Time and count breakdown */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Tempo Assistido</p>
                      <p className="text-lg sm:text-xl font-extrabold text-white mt-1">
                        {profile.statistics?.animeDaysWasted ? Number(profile.statistics.animeDaysWasted).toFixed(1) : '0.0'} dias
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        ~{profile.statistics?.animeDaysWasted ? (Number(profile.statistics.animeDaysWasted) * 24).toFixed(0) : '0'} horas
                      </p>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Episódios Vistos</p>
                      <p className="text-lg sm:text-xl font-extrabold text-white mt-1">
                        {profile.statistics?.totalEpisodesWatched || 0} eps
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Total de episódios</p>
                    </div>
                  </div>

                  {/* Status counts progress bars */}
                  <div className="space-y-3 bg-black/30 p-4 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Divisão por Estado</p>
                    
                    {/* Watching */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-primary">A Assistir</span>
                        <span className="text-white">{profile.statsSummary?.anime?.watching || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(((profile.statsSummary?.anime?.watching || 0) / Math.max(profile.statistics?.totalAnimeCompleted || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Completed */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-green-400">Completados</span>
                        <span className="text-white">{profile.statsSummary?.anime?.completed || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400" style={{ width: `${Math.min(((profile.statsSummary?.anime?.completed || 0) / Math.max(profile.statistics?.totalAnimeCompleted || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Planned */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-yellow-400">Planeados</span>
                        <span className="text-white">{profile.statsSummary?.anime?.planned || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400" style={{ width: `${Math.min(((profile.statsSummary?.anime?.planned || 0) / Math.max(profile.statistics?.totalAnimeCompleted || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Paused */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-cyan-400">Em Pausa</span>
                        <span className="text-white">{profile.statsSummary?.anime?.paused || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400" style={{ width: `${Math.min(((profile.statsSummary?.anime?.paused || 0) / Math.max(profile.statistics?.totalAnimeCompleted || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Dropped */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-red-400">Desistidos</span>
                        <span className="text-white">{profile.statsSummary?.anime?.dropped || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400" style={{ width: `${Math.min(((profile.statsSummary?.anime?.dropped || 0) / Math.max(profile.statistics?.totalAnimeCompleted || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {/* Time and count breakdown */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Tempo Lido</p>
                      <p className="text-lg sm:text-xl font-extrabold text-white mt-1">
                        {profile.statistics?.mangaDaysWasted ? Number(profile.statistics.mangaDaysWasted).toFixed(1) : '0.0'} dias
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        ~{profile.statistics?.mangaDaysWasted ? (Number(profile.statistics.mangaDaysWasted) * 24).toFixed(0) : '0'} horas
                      </p>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Capítulos Lidos</p>
                      <p className="text-lg sm:text-xl font-extrabold text-white mt-1">
                        {profile.statistics?.totalMangaRead || 0} caps
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Total de capítulos</p>
                    </div>
                  </div>

                  {/* Status counts progress bars */}
                  <div className="space-y-3 bg-black/30 p-4 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Divisão por Estado</p>
                    
                    {/* Reading */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-secondary">A Ler</span>
                        <span className="text-white">{profile.statsSummary?.manga?.reading || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-secondary" style={{ width: `${Math.min(((profile.statsSummary?.manga?.reading || 0) / Math.max(profile.statistics?.totalMangaRead || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Completed */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-green-400">Completados</span>
                        <span className="text-white">{profile.statsSummary?.manga?.completed || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400" style={{ width: `${Math.min(((profile.statsSummary?.manga?.completed || 0) / Math.max(profile.statistics?.totalMangaRead || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Planned */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-yellow-400">Planeados</span>
                        <span className="text-white">{profile.statsSummary?.manga?.planned || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400" style={{ width: `${Math.min(((profile.statsSummary?.manga?.planned || 0) / Math.max(profile.statistics?.totalMangaRead || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Paused */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-cyan-400">Em Pausa</span>
                        <span className="text-white">{profile.statsSummary?.manga?.paused || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400" style={{ width: `${Math.min(((profile.statsSummary?.manga?.paused || 0) / Math.max(profile.statistics?.totalMangaRead || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Dropped */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-red-400">Desistidos</span>
                        <span className="text-white">{profile.statsSummary?.manga?.dropped || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400" style={{ width: `${Math.min(((profile.statsSummary?.manga?.dropped || 0) / Math.max(profile.statistics?.totalMangaRead || 1, 1)) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* General Ratings metrics */}
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Classificação Média</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {profile.statsSummary?.averageScore ? profile.statsSummary.averageScore.toFixed(1) : '0.0'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Títulos Avaliados</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {profile.statsSummary?.totalRated || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
