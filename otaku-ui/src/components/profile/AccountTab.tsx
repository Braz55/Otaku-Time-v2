import React from 'react';
import { 
  Smartphone, Heart, User, Award, Database, 
  Download, Upload, RefreshCw 
} from 'lucide-react';

interface AccountTabProps {
  user: any;
  profile: any;
  t: (key: string) => string;
  isUpdatingPreferences: boolean;
  handleUpdatePreference: (key: string, value: any) => void;
  selectedPalette: string;
  PALETTES: any;
  handlePaletteChange: (paletteName: string) => void;
  showToast: any;
  newName: string;
  setNewName: (val: string) => void;
  currentPassword: string;
  setCurrentPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  isSavingAccount: boolean;
  handleSaveAccountInfo: (e: React.FormEvent) => void;
  logout: () => void;
  ALL_GENRES: string[];
  handleToggleGenre: (genre: string) => void;
  redeemCodeInput: string;
  setRedeemCodeInput: (val: string) => void;
  handleRedeemCode: (e: React.FormEvent) => void;
  isRedeemingCode: boolean;
  isExporting: boolean;
  handleExportBackup: () => void;
  setShowRestoreModal: (show: boolean) => void;
  setShowTvTimeModal: (show: boolean) => void;
  setShowWipeAnimeConfirm: (show: boolean) => void;
  setShowWipeMangaConfirm: (show: boolean) => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({
  user,
  profile,
  t,
  isUpdatingPreferences,
  handleUpdatePreference,
  selectedPalette,
  PALETTES,
  handlePaletteChange,
  showToast,
  newName,
  setNewName,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  isSavingAccount,
  handleSaveAccountInfo,
  logout,
  ALL_GENRES,
  handleToggleGenre,
  redeemCodeInput,
  setRedeemCodeInput,
  handleRedeemCode,
  isRedeemingCode,
  isExporting,
  handleExportBackup,
  setShowRestoreModal,
  setShowTvTimeModal,
  setShowWipeAnimeConfirm,
  setShowWipeMangaConfirm,
}) => {
  return (
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/5 relative z-10">
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

          <button
            type="button"
            onClick={() => setShowTvTimeModal(true)}
            className="py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 shadow-xl bg-surface-variant/30 text-on-surface-variant hover:text-white hover:bg-white/5 border border-white/5 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <Database className="w-4 h-4 text-secondary" />
            <span>IMPORTAR DADOS DO TV TIME</span>
          </button>
        </div>

        {/* Danger Zone: Wipe Library */}
        <div className="pt-6 border-t border-red-500/10 space-y-4">
          <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">Zona de Perigo</h4>
          
          {/* Limpar Animes da Biblioteca */}
          <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h5 className="font-bold text-sm text-white">Limpar Animes da Biblioteca</h5>
              <p className="text-xs text-gray-500 mt-0.5">Apaga permanentemente todos os registos de animes e progresso da tua biblioteca pessoal.</p>
            </div>
            <button 
              type="button"
              onClick={() => setShowWipeAnimeConfirm(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
            >
              Apagar Animes
            </button>
          </div>

          {/* Limpar Mangas da Biblioteca */}
          <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h5 className="font-bold text-sm text-white">Limpar Mangás da Biblioteca</h5>
              <p className="text-xs text-gray-500 mt-0.5">Apaga permanentemente todos os registos de mangás e progresso da tua biblioteca pessoal.</p>
            </div>
            <button 
              type="button"
              onClick={() => setShowWipeMangaConfirm(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
            >
              Apagar Mangás
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
