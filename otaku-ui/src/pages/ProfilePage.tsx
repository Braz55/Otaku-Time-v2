import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Database, RefreshCw, AlertCircle, User, Shield, 
  Smartphone, Download, Upload, Copy, Check, Award, Heart, 
  Edit3, Trash2, Plus, Search, BookOpen, Clock, Film, BarChart3 
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { Capacitor } from '@capacitor/core';
import { customFetch } from '../services/apiBridge';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { getCurrentPalette, savePalette, PALETTES } from '../services/paletteService';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTranslation } from '../hooks/useTranslation';

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const SubscriptionRow = ({ subscription }: { subscription: any }) => {

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 border border-green-500/20 text-green-400 uppercase tracking-wider">
            Ativo
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 uppercase tracking-wider">
            Cancelado
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 uppercase tracking-wider">
            Expirado
          </span>
        );
      case 'PAST_DUE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 border border-orange-500/20 text-orange-400 uppercase tracking-wider">
            Em Dívida
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 border border-gray-500/20 text-gray-400 uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <tr className="hover:bg-white/[0.01]">
      <td className="p-3">
        <div className="font-bold text-white">
          {subscription.user.nome}
          <span className="block text-[9px] text-gray-500 font-medium font-mono">{subscription.user.email}</span>
        </div>
      </td>
      <td className="p-3 text-center font-bold text-amber-400 uppercase tracking-wider">{subscription.planType}</td>
      <td className="p-3 text-center font-mono text-gray-300 font-semibold">{formatDate(subscription.currentPeriodEnd)}</td>
      <td className="p-3 text-center">{getStatusBadge(subscription.status)}</td>
    </tr>
  );
};

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
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
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
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

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
      
      // Sort by updatedAt descending
      allItems.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.updated_at || 0).getTime();
        const dateB = new Date(b.updatedAt || b.updated_at || 0).getTime();
        return dateB - dateA;
      });
      
      setRecentActivities(allItems.slice(0, 3));
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }
  };

  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Recentemente';
    try {
      const past = new Date(dateStr).getTime();
      const now = new Date().getTime();
      const diffMs = now - past;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Agora mesmo';
      if (diffMins < 60) return `Há ${diffMins} min`;
      if (diffHours < 24) return `Há ${diffHours} h`;
      return `Há ${diffDays} dias`;
    } catch {
      return 'Recentemente';
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

  const renderPodiumPosition = (rank: number) => {
    const key = `${favoritePodiumType}-${rank}` as const;
    const fav = favoriteDetails[key];
    const mediaTypeLower = favoritePodiumType.toLowerCase() as 'anime' | 'manga';

    let rankLabel = '';
    let rankClass = '';
    let ringClass = '';
    let plusColor = '';

    if (rank === 1) {
      rankLabel = '1º GOLD';
      rankClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      ringClass = 'border-amber-500/30 ring-2 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      plusColor = 'text-amber-400';
    } else if (rank === 2) {
      rankLabel = '2º SILVER';
      rankClass = 'bg-slate-400/20 text-slate-300 border-slate-400/40';
      ringClass = 'border-slate-400/30 ring-2 ring-slate-400/10 shadow-md';
      plusColor = 'text-primary-light';
    } else {
      rankLabel = '3º BRONZE';
      rankClass = 'bg-amber-700/20 text-amber-500 border-amber-700/40';
      ringClass = 'border-amber-700/30 ring-2 ring-amber-700/10 shadow-md';
      plusColor = 'text-orange-400';
    }

    return (
      <div className="flex flex-col items-center gap-2">
        <div className={`w-full aspect-[2/3] rounded-2xl border bg-black/40 overflow-hidden relative group flex items-center justify-center text-center ${ringClass}`}>
          {fav ? (
            <>
              <img 
                src={fav.coverUrl} 
                className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-300" 
                alt={`${rankLabel} Place`} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent flex flex-col justify-end p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-[10px] sm:text-xs font-bold text-white line-clamp-2 leading-tight">{fav.title}</p>
                <button 
                  onClick={() => handleRemoveFavorite(favoritePodiumType, rank)}
                  className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg self-center mt-2 scale-90 active:scale-75 transition-all shadow cursor-pointer"
                  title="Remover"
                  type="button"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={() => openFavoritesSearch(mediaTypeLower, rank)}
              className="w-full h-full flex flex-col items-center justify-center p-3 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 cursor-pointer"
              type="button"
            >
              <Plus className={`w-6 h-6 mb-1 ${plusColor}`} />
              <span className="text-[9px] sm:text-xs font-bold">{rank}º Lugar</span>
            </button>
          )}
        </div>
        <div className={`h-6 w-full rounded-lg flex items-center justify-center text-[9px] min-[375px]:text-[10px] sm:text-xs font-black border truncate px-1 ${rankClass}`}>
          {rankLabel}
        </div>
      </div>
    );
  };

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
          <div className="grid grid-cols-12 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Left Column: Stats & Conquistas */}
            <div className="col-span-12 lg:col-span-4 space-y-6 md:space-y-8">
              
              {/* Stats Card */}
              <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-xl pointer-events-none"></div>
                <h3 className="font-headline-lg text-lg md:text-xl text-white flex items-center gap-2.5 mb-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  <span>Estatísticas</span>
                </h3>
                
                <div className="space-y-6">
                  {/* Anime watchtime days */}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-on-surface-variant text-[10px] uppercase tracking-widest mb-1">Tempo de Anime</p>
                      <p className="text-3xl font-display-md text-white font-extrabold">
                        {profile.statistics?.animeDaysWasted ? Number(profile.statistics.animeDaysWasted).toFixed(1) : '0.0'}
                        <span className="text-xs font-body-md text-primary ml-1.5 font-normal">dias</span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar (representing watchtime relative to milestone) */}
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(((profile.statistics?.totalEpisodesWatched || 0) / 1000) * 100, 100)}%` }}></div>
                  </div>

                  {/* Grid of Other stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-border-glass">
                      <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-1 font-bold">Capítulos Lidos</p>
                      <p className="text-xl font-headline-lg text-white font-extrabold">{profile.statistics?.totalMangaRead || 0}</p>
                    </div>
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-border-glass">
                      <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-1 font-bold">Episódios Vistos</p>
                      <p className="text-xl font-headline-lg text-white font-extrabold">{profile.statistics?.totalEpisodesWatched || 0}</p>
                    </div>
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-border-glass">
                      <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-1 font-bold">Animes Completos</p>
                      <p className="text-xl font-headline-lg text-white font-extrabold">{profile.statistics?.totalAnimeCompleted || 0}</p>
                    </div>
                    <div className="p-4 bg-surface-container-low rounded-2xl border border-border-glass">
                      <p className="text-on-surface-variant text-[10px] uppercase tracking-wider mb-1 font-bold">Média Score</p>
                      <p className="text-xl font-headline-lg text-white font-extrabold">
                        {profile.statsSummary?.averageScore ? profile.statsSummary.averageScore.toFixed(1) : '0.0'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDetailedStatsModal(true)}
                    className="w-full mt-2 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span>Ver Estatísticas Detalhadas</span>
                  </button>
                </div>
              </div>

              {/* Achievements Gallery */}
              <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-headline-lg text-lg md:text-xl text-white">Conquistas</h3>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    {profile.achievements?.length || 0}/{catalog.length || 5}
                  </span>
                </div>
                
                {catalog.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide no-scrollbar md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 md:overflow-visible">
                    {catalog.map(ach => {
                      const unlocked = isUnlocked(ach.id);
                      let borderClass = 'border-white/5 bg-black/40 grayscale opacity-45';
                      if (unlocked) {
                        if (ach.rarity === 'RARE') borderClass = 'border-cyan-500/20 bg-cyan-500/5 hover:scale-[1.02] shadow-[0_0_15px_rgba(6,182,212,0.2)]';
                        else if (ach.rarity === 'EPIC') borderClass = 'border-purple-500/20 bg-purple-500/5 hover:scale-[1.02] shadow-[0_0_15px_rgba(139,92,246,0.2)]';
                        else if (ach.rarity === 'LEGENDARY') borderClass = 'border-amber-500/20 bg-amber-500/5 hover:scale-[1.02] shadow-[0_0_15px_rgba(245,158,11,0.2)]';
                        else borderClass = 'border-primary/20 bg-primary/5 hover:scale-[1.02]';
                      }
                      return (
                        <div 
                          key={ach.id} 
                          className={`flex-shrink-0 flex flex-col items-center w-20 md:w-auto md:p-3.5 glass-panel border rounded-2xl transition-all group relative ${borderClass}`}
                          title={`${ach.name}: ${ach.description}${unlocked ? ` (Ganho em: ${getUnlockDate(ach.id)})` : ''}`}
                        >
                          <div className="w-12 h-12 rounded-full bg-white/5 p-1 relative flex items-center justify-center mb-1.5 flex-shrink-0">
                            {ach.badgeImageUrl ? (
                              <img src={ach.badgeImageUrl} className="w-full h-full object-contain rounded-full" alt="" />
                            ) : (
                              <Award className="w-6 h-6 text-primary" />
                            )}
                            {!unlocked && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                                <span className="material-symbols-outlined text-white !text-xs">lock</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-white text-center tracking-tight leading-tight line-clamp-1 w-full uppercase">{ach.name}</span>
                          {unlocked && (
                            <span className="hidden md:inline-block text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 mt-1">
                              Ganho
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                    <p className="text-xs italic text-gray-500">Nenhuma conquista registada.</p>
                    {user?.tipoConta === 'ADMIN' && (
                      <button 
                        type="button"
                        onClick={async () => {
                          const res = await customFetch(`${API_BASE_URL}/user/achievements/seed`, { method: 'POST' });
                          if (res.ok) {
                            showToast('Conquistas semeadas!', 'success');
                            fetchCatalog();
                            fetchProfile();
                          }
                        }}
                        className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl active:scale-95 transition-all shadow"
                      >
                        Popular Conquistas
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Podium Favorites & Activity Log */}
            <div className="col-span-12 lg:col-span-8 space-y-6 md:space-y-8">
              
              {/* Favorites Podium Card */}
              <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 shadow-xl relative overflow-hidden min-h-[300px] sm:min-h-[420px]">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <span className="material-symbols-outlined text-[150px]">stars</span>
                </div>
                
                {/* Header with category selector */}
                <div className="flex justify-between items-center mb-10 flex-wrap gap-3">
                  <div>
                    <span className={`font-label-md text-[10px] uppercase tracking-widest block mb-0.5 ${favoritePodiumType === 'ANIME' ? 'text-secondary' : 'text-primary'}`}>Destaques</span>
                    <h3 className="font-headline-lg text-lg md:text-xl text-white">Favoritos de Ouro</h3>
                  </div>
                  
                  {/* Category switcher */}
                  <div className="flex p-0.5 bg-black/40 border border-white/10 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setFavoritePodiumType('ANIME')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${favoritePodiumType === 'ANIME' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-white'}`}
                    >
                      Anime
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFavoritePodiumType('MANGA')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${favoritePodiumType === 'MANGA' ? 'bg-secondary text-on-secondary shadow' : 'text-on-surface-variant hover:text-white'}`}
                    >
                      Mangá
                    </button>
                  </div>
                </div>

                {/* Podium Grid */}
                <div className="grid grid-cols-3 gap-3 sm:gap-8 items-end h-[200px] min-[400px]:h-[240px] sm:h-[340px] max-w-2xl mx-auto pt-2">
                  {renderPodiumPosition(2)}
                  {renderPodiumPosition(1)}
                  {renderPodiumPosition(3)}
                </div>
                
                <p className="text-center mt-6 text-xs text-on-surface-variant italic leading-relaxed">
                  Títulos em destaque que definiram a minha jornada Otaku. Clica para alterar.
                </p>
              </div>

              {/* Recent Activity Log */}
              <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-4 shadow-xl">
                <h3 className="font-headline-lg text-lg md:text-xl text-white mb-2">Atividade Recente</h3>
                
                <div className="space-y-3.5">
                  {recentActivities.length > 0 ? (
                    recentActivities.map((act: any) => {
                      const cover = act.capaUrl || act.anime?.capaUrl || act.manga?.capaUrl;
                      const title = act.titulo || act.anime?.titulo || act.manga?.titulo;
                      const current = act.mediaType === 'anime' ? act.epAtual : act.capAtual;
                      const isAnime = act.mediaType === 'anime';
                      
                      return (
                        <div key={act.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 border border-white/[0.02] transition-colors group">
                          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative border border-white/5">
                            <img src={cover} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
                          </div>
                          
                          <div className="flex-grow min-w-0">
                            <p className="text-sm text-white font-medium truncate leading-snug">
                              {isAnime ? 'Viu o episódio' : 'Leu o capítulo'}{' '}
                              <span className={isAnime ? 'text-primary font-bold' : 'text-secondary font-bold'}>{current}</span>
                              {' de '}
                              <span className="font-bold text-white hover:underline cursor-pointer" onClick={() => navigate('/')}>{title}</span>
                            </p>
                            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mt-0.5">
                              {getRelativeTime(act.updatedAt || act.updated_at)}
                            </p>
                          </div>
                          
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase ${isAnime ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                            {act.mediaType}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center py-8 text-xs text-on-surface-variant italic">
                      Ainda sem atividade registada. Começa a consumir da tua biblioteca!
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: CONFIGURAÇÕES (Definições) */}
        {activeTab === 'account' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            
            {/* General Preferences Settings Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <h3 className="font-headline-lg text-lg md:text-xl text-white flex items-center gap-2.5 mb-2">
                <Smartphone className="w-5 h-5 text-secondary" />
                 <span>{t("Preferências")}</span>
              </h3>
              
              <div className="space-y-6">
                {/* Language Select */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-sm text-white">{t("Idioma do App")}</p>
                    <p className="text-xs text-on-surface-variant">{t("Escolhe o idioma preferido da tua interface.")}</p>
                  </div>
                  <select 
                    value={user?.preferredLanguage || 'PT'} 
                    disabled={isUpdatingPreferences}
                    onChange={(e) => handleUpdatePreference('preferredLanguage', e.target.value)}
                    className="bg-surface-container-low border border-border-glass rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/50 text-white cursor-pointer"
                  >
                    <option value="PT" className="bg-[#121317]">Português (PT)</option>
                    <option value="EN" className="bg-[#121317]">English (EN)</option>
                  </select>
                </div>

                {/* Notifications Switch */}
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-border-glass">
                  <div>
                    <p className="font-bold text-sm text-white">{t("Notificações Push")}</p>
                    <p className="text-xs text-on-surface-variant">{t("Alertas sobre novos episódios em exibição.")}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={user?.showAdultContent === false} 
                      disabled={isUpdatingPreferences}
                      onChange={(e) => handleUpdatePreference('showAdultContent', !e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Privacy Option */}
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-border-glass">
                  <div>
                    <p className="font-bold text-sm text-white">{t("Filtro de Conteúdo (NSFW)")}</p>
                    <p className="text-xs text-on-surface-variant">{t("Ocultar resultados adultos na pesquisa global.")}</p>
                  </div>
                  <div className="flex p-0.5 bg-surface-container-low border border-border-glass rounded-xl">
                    <button 
                      type="button"
                      onClick={() => handleUpdatePreference('showAdultContent', false)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${user?.showAdultContent === false ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-white'}`}
                    >
                      Ocultar
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleUpdatePreference('showAdultContent', true)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${user?.showAdultContent === true ? 'bg-secondary text-on-secondary shadow' : 'text-on-surface-variant hover:text-white'}`}
                    >
                      Mostrar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Appearance Theme Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden">
              <h3 className="font-headline-lg text-lg md:text-xl text-white flex items-center gap-2.5 mb-2">
                <Heart className="w-5 h-5 text-secondary" />
                <span>Aparência</span>
              </h3>
              
              <div className="space-y-6">
                {/* Theme Mode selector */}
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    onClick={() => handleUpdatePreference('theme', 'dark')}
                    className={`cursor-pointer border-2 p-3.5 rounded-2xl flex flex-col items-center gap-2 group transition-all bg-black/35 ${
                      user?.theme !== 'light' ? 'border-primary shadow-[0_0_15px_rgba(139,92,246,0.15)]' : 'border-border-glass hover:border-primary/50'
                    }`}
                  >
                    <div className="w-full h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-primary shadow-[0_0_10px_rgba(106,27,154,0.6)]"></div>
                    </div>
                    <p className="text-xs font-bold text-white">Cyber Dark</p>
                  </div>
                  
                  <div 
                    onClick={() => handleUpdatePreference('theme', 'light')}
                    className={`cursor-pointer border-2 p-3.5 rounded-2xl flex flex-col items-center gap-2 group transition-all bg-white/5 ${
                      user?.theme === 'light' ? 'border-primary shadow-[0_0_15px_rgba(139,92,246,0.15)] bg-white/15' : 'border-border-glass hover:border-primary/50'
                    }`}
                  >
                    <div className="w-full h-10 rounded-lg bg-white flex items-center justify-center border border-white/10">
                      <div className="w-5 h-5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]"></div>
                    </div>
                    <p className={`text-xs font-bold ${user?.theme === 'light' ? 'text-white' : 'text-gray-400'}`}>Light Mode</p>
                  </div>
                </div>

                {/* Accent Color Palettes */}
                <div>
                  <p className="font-bold text-sm text-white mb-3">Accent Color / Paleta de Cores</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.keys(PALETTES).map((pName) => {
                      const colors = PALETTES[pName];
                      const isActive = selectedPalette === pName;
                      return (
                        <button 
                          key={pName} 
                          type="button"
                          onClick={() => handlePaletteChange(pName)}
                          className="w-8 h-8 rounded-full border-2 border-surface-dim transition-transform duration-200 hover:scale-110 flex items-center justify-center cursor-pointer"
                          style={{ 
                            backgroundColor: colors.primary, 
                            boxShadow: isActive ? `0 0 15px ${colors.primary}` : 'none',
                            transform: isActive ? 'scale(1.15)' : 'none',
                            borderColor: isActive ? '#ffffff' : 'transparent'
                          }}
                          title={`Tema ${pName.toUpperCase()}`}
                        >
                          {isActive && <span className="material-symbols-outlined text-[14px] text-white">done</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => showToast('Visita as configurações do seu terminal para customizações adicionais.', 'info')}
                  className="w-full py-3 rounded-2xl border border-border-glass font-bold text-xs text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Customização Avançada
                </button>
              </div>
            </div>

            {/* Account Settings Form Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl lg:col-span-2">
              <h3 className="font-headline-lg text-lg md:text-xl text-white flex items-center gap-2.5 mb-2">
                <User className="w-5 h-5 text-primary" />
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
                    <p className="text-base font-bold text-gray-500 bg-black/20 p-3 rounded-xl border border-white/5 cursor-not-allowed select-none truncate">
                      {user?.email || 'entusiasta@otakutime.com'}
                    </p>
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
                
                <div className="pt-6 border-t border-white/5 flex flex-wrap gap-4 justify-end">
                  <button 
                    type="button"
                    onClick={logout} 
                    className="px-6 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-300 hover:text-white font-bold text-xs md:text-sm transition-all border border-red-500/20 shadow-lg cursor-pointer"
                  >
                    Encerrar Sessão
                  </button>
                  <button 
                    type="submit"
                    disabled={isSavingAccount}
                    className="px-6 py-3 rounded-2xl bg-primary hover:opacity-90 text-on-primary font-bold text-xs md:text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSavingAccount ? 'A guardar...' : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            </div>

            {/* Favorite Genres Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl lg:col-span-2">
              <h3 className="font-headline-lg text-lg md:text-xl text-white flex items-center gap-2.5 mb-2">
                <Heart className="w-5 h-5 text-primary" />
                <span>Géneros Favoritos</span>
              </h3>
              <p className="text-xs text-on-surface-variant">Seleciona os teus géneros favoritos para recomendação ou badges do teu perfil.</p>
              
              <div className="flex flex-wrap gap-2 pt-2">
                {ALL_GENRES.map(genre => {
                  const currentFavs = profile?.preferences?.favoriteGenres || [];
                  const isFav = currentFavs.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => handleToggleGenre(genre)}
                      disabled={isUpdatingPreferences}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border active:scale-95 cursor-pointer ${
                        isFav 
                          ? 'bg-primary text-on-primary border-primary shadow-md shadow-primary/20' 
                          : 'bg-black/40 text-on-surface-variant border-white/5 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Premium Code Redeem Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl lg:col-span-2">
              <h3 className="font-headline-lg text-lg md:text-xl text-white flex items-center gap-2.5 mb-2">
                <Award className="w-5 h-5 text-amber-500 animate-pulse" />
                <span>Resgatar Código Premium</span>
              </h3>
              <div className="space-y-4">
                <p className="text-xs text-on-surface-variant">Introduz um código promocional ou de Gift Card para ativares ou prolongares o teu Premium tier.</p>
                <form onSubmit={handleRedeemCode} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="space-y-2 flex-1 w-full">
                    <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Código de Resgate</label>
                    <input 
                      type="text" 
                      value={redeemCodeInput} 
                      onChange={(e) => setRedeemCodeInput(e.target.value)} 
                      className="w-full bg-black/40 text-white font-black p-3 rounded-xl border border-white/10 focus:border-primary outline-none transition-all uppercase placeholder-gray-600"
                      placeholder="EX: OTAKU-XXXX-XXXX"
                      disabled={isRedeemingCode}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isRedeemingCode || !redeemCodeInput.trim()}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-primary hover:from-amber-600 hover:to-primary-dark text-white font-bold text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    {isRedeemingCode ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                    <span>Ativar Premium</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Backup & Portability Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-[32px] border border-white/10 space-y-6 shadow-xl relative overflow-hidden lg:col-span-2">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-secondary/10 via-primary/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-2xl text-primary shadow-inner">
                    <Database className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Cópia de Segurança (Backup & Portabilidade)</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 max-w-xl">
                      Exporta toda a tua biblioteca de Animes e Mangas para um ficheiro JSON portátil, facilitando a migração entre o PC e o Android.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5 relative z-10">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl bg-primary hover:opacity-90 text-on-primary shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                  type="button"
                  onClick={() => setShowRestoreModal(true)}
                  className="py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
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
                    type="button"
                    onClick={() => setShowWipeConfirm(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
                  >
                    Apagar Tudo
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: PAINEL ADMIN */}
        {activeTab === 'admin' && user?.tipoConta === 'ADMIN' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Stats Summary cards */}
            {loadingAdminData ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <RefreshCw className="w-10 h-10 animate-spin text-primary" />
                <p className="text-xs text-gray-500">A carregar dados administrativos...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent hover:border-blue-500/20 transition-all flex flex-col justify-between h-28 shadow relative overflow-hidden group animate-in fade-in duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/15 transition-all"></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Utilizadores</span>
                    <span className="text-3xl font-black text-white">{adminStats?.totalUsers ?? 0}</span>
                  </div>
                  <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-green-500/5 to-transparent hover:border-green-500/20 transition-all flex flex-col justify-between h-28 shadow relative overflow-hidden group animate-in fade-in duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-xl group-hover:bg-green-500/15 transition-all"></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Animes Cache</span>
                    <span className="text-3xl font-black text-white">{adminStats?.totalAnimes ?? 0}</span>
                  </div>
                  <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-purple-500/5 to-transparent hover:border-purple-500/20 transition-all flex flex-col justify-between h-28 shadow relative overflow-hidden group animate-in fade-in duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/15 transition-all"></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mangás Cache</span>
                    <span className="text-3xl font-black text-white">{adminStats?.totalMangas ?? 0}</span>
                  </div>
                  <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-primary/5 to-transparent hover:border-primary/20 transition-all flex flex-col justify-between h-28 shadow relative overflow-hidden group animate-in fade-in duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/15 transition-all"></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Acompanhamentos</span>
                    <span className="text-3xl font-black text-white">{adminStats?.totalTrackedItems ?? 0}</span>
                  </div>
                </div>

                {/* System Admin Actions */}
                <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-6 shadow-xl">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <span>Ações do Sistema</span>
                  </h3>
                  
                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={handleAdminSeedAchievements}
                      disabled={isSeedingAchievements}
                      className="px-5 py-3 rounded-xl bg-surface-variant/30 hover:bg-white/10 border border-white/5 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isSeedingAchievements ? <RefreshCw className="w-4 h-4 animate-spin text-primary" /> : <Award className="w-4 h-4 text-primary-light" />}
                      <span>Repovoar Conquistas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManageAchievementsModal(true)}
                      className="px-5 py-3 rounded-xl bg-gradient-to-r from-primary/80 to-primary hover:from-primary hover:to-primary-dark text-on-primary font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-primary/20 cursor-pointer"
                    >
                      <Award className="w-4 h-4 text-white" />
                      <span>Gerir Conquistas</span>
                    </button>
                    <button
                      type="button"
                      onClick={fetchAdminData}
                      className="px-5 py-3 rounded-xl bg-surface-variant/30 hover:bg-white/10 border border-white/5 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Atualizar Painel</span>
                    </button>
                  </div>
                </div>

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
                          Obtém automaticamente as informações de lançamentos de fontes externas.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5 relative z-10">
                    <button
                      type="button"
                      onClick={triggerManualReleaseSync}
                      disabled={syncStatus.isSyncing}
                      className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 shadow-xl cursor-pointer ${syncStatus.isSyncing ? 'bg-primary/20 border border-primary/30 text-primary cursor-not-allowed shadow-[0_0_25px_rgba(106,27,154,0.2)]' : 'bg-primary hover:opacity-90 text-on-primary shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.01] active:scale-[0.99]'}`}
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
                              {syncStatus.currentItemTitle || 'A ligar às APIs...'}
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

                {/* User Management Section */}
                <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      <span>Gestão de Utilizadores</span>
                    </h3>
                    
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Procurar utilizador..."
                        value={adminUserSearch}
                        onChange={(e) => setAdminUserSearch(e.target.value)}
                        className="bg-black/30 border border-white/5 hover:border-white/10 focus:border-primary text-white text-xs p-2.5 pl-9 rounded-xl outline-none w-full sm:w-64 transition-all"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider text-left">
                          <th className="p-3.5 text-center">ID</th>
                          <th className="p-3.5">Nome</th>
                          <th className="p-3.5">Email</th>
                          <th className="p-3.5 text-center">Itens Seguidos</th>
                          <th className="p-3.5">Tipo de Conta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {adminUsers
                          .filter(u => 
                            u.nome.toLowerCase().includes(adminUserSearch.toLowerCase()) || 
                            u.email.toLowerCase().includes(adminUserSearch.toLowerCase())
                          )
                          .map((u) => (
                            <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3.5 text-center font-bold text-gray-400">{u.id}</td>
                              <td className="p-3.5 font-bold text-white">{u.nome} {u.id === user?.id && <span className="text-[9px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded ml-1">Tu</span>}</td>
                              <td className="p-3.5 text-gray-300 font-medium">{u.email}</td>
                              <td className="p-3.5 text-center text-gray-400 font-bold">
                                {u._count ? (
                                  <span className="flex items-center justify-center gap-1.5 text-xs text-primary-light">
                                    <Film className="w-3.5 h-3.5" /> {u._count.animes} 
                                    <span className="text-gray-600">/</span>
                                    <BookOpen className="w-3.5 h-3.5" /> {u._count.mangas}
                                  </span>
                                ) : '0'}
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={u.tipoConta}
                                  disabled={u.id === user?.id}
                                  onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                  className="bg-black/40 border border-white/10 hover:border-white/20 text-white rounded-lg p-1 px-2 text-xs font-bold outline-none focus:border-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  <option value="padrao" disabled={u.tipoConta === 'pro'}>Padrão</option>
                                  <option value="pro">Pro Tier</option>
                                  <option value="ADMIN">ADMIN</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        {adminUsers.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">Nenhum utilizador encontrado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* System Sync Logs */}
                <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-4 shadow-xl font-sans">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    <span>Logs de Sincronização Recentes</span>
                  </h3>
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-white/5 bg-black/35 divide-y divide-white/5">
                    {adminSyncLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-white/[0.01] transition-colors flex items-start gap-3 justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === 'SUCCESS' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                              {log.status}
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold">{new Date(log.timestamp).toLocaleString('pt-PT')}</span>
                          </div>
                          <p className="text-xs text-gray-300 font-medium">{log.details}</p>
                        </div>
                        <span className="text-[10px] font-bold text-gray-600">ID #{log.id}</span>
                      </div>
                    ))}
                    {adminSyncLogs.length === 0 && (
                      <p className="p-6 text-center text-xs text-gray-500 font-medium">Nenhum log de sincronização registado.</p>
                    )}
                  </div>
                </div>

                {/* Gift Cards Section */}
                <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-6 shadow-xl">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500 font-bold" />
                    <span>Gestão de Gift Cards</span>
                  </h3>
                  
                  {/* Generation Form */}
                  <form onSubmit={handleGenerateGiftCode} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Dias de Premium</label>
                      <input
                        type="number"
                        min="1"
                        value={giftDays}
                        onChange={(e) => setGiftDays(+e.target.value)}
                        className="w-full bg-black/40 text-white font-bold p-2 rounded-xl border border-white/10 outline-none text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Código Customizado (Opcional)</label>
                      <input
                        type="text"
                        placeholder="EX: VIP-30D"
                        value={giftCustomCode}
                        onChange={(e) => setGiftCustomCode(e.target.value)}
                        className="w-full bg-black/40 text-white font-bold p-2.5 rounded-xl border border-white/10 outline-none text-xs uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Expiração (Opcional)</label>
                      <input
                        type="date"
                        value={giftExpiresAt}
                        onChange={(e) => setGiftExpiresAt(e.target.value)}
                        className="w-full bg-black/40 text-white font-bold p-2.5 rounded-xl border border-white/10 outline-none text-xs text-gray-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isGeneratingGift}
                      className="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer h-9.5"
                    >
                      {isGeneratingGift ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4 text-white" />}
                      <span>GERAR GIFT CARD</span>
                    </button>
                  </form>

                  {/* Gift Codes Table */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs text-gray-400 font-bold uppercase tracking-wider">Códigos Gerados</h4>
                      <input
                        type="text"
                        placeholder="Pesquisar código..."
                        value={adminGiftSearch}
                        onChange={(e) => setAdminGiftSearch(e.target.value)}
                        className="bg-black/30 border border-white/5 hover:border-white/10 focus:border-primary text-white text-xs p-2 px-3 rounded-lg outline-none w-48 transition-all"
                      />
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            <th className="p-3">Código</th>
                            <th className="p-3 text-center">Dias Premium</th>
                            <th className="p-3 text-center">Data Expiração</th>
                            <th className="p-3 text-center">Resgatado Por</th>
                            <th className="p-3 text-center">Data Resgate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {adminGiftCodes
                            .filter(g => g.code.toLowerCase().includes(adminGiftSearch.toLowerCase()))
                            .map((g) => (
                              <tr key={g.code} className="hover:bg-white/[0.01]">
                                <td className="p-3 font-mono font-bold text-amber-400 uppercase tracking-wider">{g.code}</td>
                                <td className="p-3 text-center font-black text-white">{g.durationDays} dias</td>
                                <td className="p-3 text-center font-mono text-gray-400">
                                  {g.expiresAt ? formatDate(g.expiresAt) : <span className="text-gray-600">Nunca</span>}
                                </td>
                                <td className="p-3 text-center">
                                  {g.redeemedBy ? (
                                    <div className="font-bold text-white">
                                      {g.redeemedBy.nome}
                                      <span className="block text-[8px] text-gray-500 font-mono">{g.redeemedBy.email}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 font-bold">-</span>
                                  )}
                                </td>
                                <td className="p-3 text-center text-gray-400 font-medium">
                                  {g.redeemedAt ? new Date(g.redeemedAt).toLocaleString('pt-PT') : '-'}
                                </td>
                              </tr>
                            ))}
                          {adminGiftCodes.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-gray-500 font-medium">Nenhum Gift Card gerado.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Subscriptions Section */}
                <div className="glass-panel p-6 rounded-[32px] border border-white/10 space-y-6 shadow-xl font-sans">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <span>Gestão de Subscrições</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs text-gray-400 font-bold uppercase tracking-wider">Subscrições de Utilizadores</h4>
                      <input
                        type="text"
                        placeholder="Pesquisar por email/nome..."
                        value={adminSubSearch}
                        onChange={(e) => setAdminSubSearch(e.target.value)}
                        className="bg-black/30 border border-white/5 hover:border-white/10 focus:border-primary text-white text-xs p-2 px-3 rounded-lg outline-none w-48 transition-all"
                      />
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            <th className="p-3">Utilizador</th>
                            <th className="p-3 text-center">Plano</th>
                            <th className="p-3 text-center">Data Fim</th>
                            <th className="p-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {adminSubscriptions
                            .filter(s => 
                              s.user.nome.toLowerCase().includes(adminSubSearch.toLowerCase()) ||
                              s.user.email.toLowerCase().includes(adminSubSearch.toLowerCase())
                            )
                            .map((s) => (
                              <SubscriptionRow 
                                key={s.id} 
                                subscription={s} 
                              />
                            ))}
                          {adminSubscriptions.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-6 text-center text-gray-500 font-medium">Nenhuma subscrição ativa ou expirada encontrada.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
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

      {/* Wipe Confirmation Modal */}
      {showWipeConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
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
