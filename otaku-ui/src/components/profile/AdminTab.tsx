import React from 'react';
import { 
  Database, RefreshCw, Award, Search, 
  Film, BookOpen, AlertCircle, User
} from 'lucide-react';

interface AdminTabProps {
  loadingAdminData: boolean;
  adminStats: any;
  adminUsers: any[];
  adminUserSearch: string;
  setAdminUserSearch: (val: string) => void;
  user: any;
  handleUpdateUserRole: (userId: number, role: string) => void;
  adminSyncLogs: any[];
  handleAdminSeedAchievements: () => void;
  isSeedingAchievements: boolean;
  setShowManageAchievementsModal: (show: boolean) => void;
  fetchAdminData: () => void;
  syncStatus: any;
  triggerManualReleaseSync: () => void;
  releaseSyncError: string | null;
  giftDays: number;
  setGiftDays: (val: number) => void;
  giftCustomCode: string;
  setGiftCustomCode: (val: string) => void;
  giftExpiresAt: string;
  setGiftExpiresAt: (val: string) => void;
  isGeneratingGift: boolean;
  handleGenerateGiftCode: (e: React.FormEvent) => void;
  adminGiftSearch: string;
  setAdminGiftSearch: (val: string) => void;
  adminGiftCodes: any[];
  adminSubscriptions: any[];
  adminSubSearch: string;
  setAdminSubSearch: (val: string) => void;
}

export const AdminTab: React.FC<AdminTabProps> = ({
  loadingAdminData,
  adminStats,
  adminUsers,
  adminUserSearch,
  setAdminUserSearch,
  user,
  handleUpdateUserRole,
  adminSyncLogs,
  handleAdminSeedAchievements,
  isSeedingAchievements,
  setShowManageAchievementsModal,
  fetchAdminData,
  syncStatus,
  triggerManualReleaseSync,
  releaseSyncError,
}) => {
  return (
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
                        <td className="p-3.5 font-bold text-white">
                          {u.nome} {u.id === user?.id && <span className="text-[9px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded ml-1">Tu</span>}
                        </td>
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
                            <option value="normal">Normal</option>
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

                  </>
      )}
    </div>
  );
};
