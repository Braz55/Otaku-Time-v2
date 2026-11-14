import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MediaSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnimeService } from '../anime/anime.service';
import { MangaService } from '../manga/manga.service';
import { KeepAwakeService } from '../keep-awake.service';
import { NotificationService } from '../notification/notification.service';
import { SYNC_STATUS_GONE, dueForFullSync } from '../common/sync-state';
import {
  SYNC_DONE_STATUSES,
  SyncOutcome,
  decidirEstadoSync,
  descreverSync,
} from './sync-result';

// O que uma verificação decidiu correr
interface SyncPlan {
  animeActive: boolean;
  animeFull: boolean;
  mangaActive: boolean;
  mangaFull: boolean;
  mangaLabel: string; // janela do manga ativo: [MANGA_MIDDAY], [MANGA_NIGHT] ou [MANGA_MANUAL]
}

type AnimeRef = { fonte: MediaSource; id: number; titulo: string };
type MangaRef = { id: number; titulo: string };

const HOUR_MS = 60 * 60 * 1000;
// Uma sincronização concluída não se repete antes de 20 horas
const DONE_GUARD_MS = 20 * HOUR_MS;
// Uma que falhou por inteiro pode ser repetida ao fim de 1 hora
const FAILED_GUARD_MS = 1 * HOUR_MS;
// Máximo de obras por sincronização completa, para não esgotar o tempo do Render
const FULL_SYNC_BATCH = 100;

@Injectable()
export class SyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncService.name);
  private isSyncingActive = false;
  private totalItemsToSync = 0;
  private currentSyncedCount = 0;
  private currentItemTitle = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly animeService: AnimeService,
    private readonly mangaService: MangaService,
    private readonly keepAwakeService: KeepAwakeService,
    private readonly notificationService: NotificationService,
  ) {}

  async onApplicationBootstrap() {
    // O servidor é acordado pelos pings do GitHub Actions (que não contam como atividade),
    // por isso verificamos logo os syncs pendentes quando o utilizador volta à app
    this.keepAwakeService.onUserReturn(() => {
      this.logger.log('User returned after inactivity: Checking scheduled syncs...');
      this.checkAndRunScheduledSyncs().catch((err) =>
        this.logger.error('Error in user-return scheduled sync check:', err),
      );
    });

    this.logger.log('Application Bootstrapped: Checking scheduled syncs...');
    this.checkAndRunScheduledSyncs().catch((err) =>
      this.logger.error('Error in startup scheduled sync check:', err),
    );
  }

  @Cron('0 */30 * * * *')
  async handleCron() {
    if (!this.keepAwakeService.isUserActiveRecently()) {
      this.logger.log('CRON Skipped: No user activity recently. Skipping scheduled syncs to save database resources.');
      return;
    }
    this.logger.log('CRON Triggered: Checking scheduled syncs...');
    await this.checkAndRunScheduledSyncs();
  }

  // Ao minuto 15, para não arrancar no mesmo instante que a verificação das sincronizações
  @Cron('0 15 * * * *')
  async handleLocalNotificationsCron() {
    if (!this.keepAwakeService.isUserActiveRecently()) {
      this.logger.log('CRON Skipped: No user activity recently. Skipping local episode check to save database resources.');
      return;
    }
    this.logger.log('CRON Triggered: Checking local episode schedules...');

    // Auto-mark notifications older than 48 hours as read
    try {
      const readResult = await this.notificationService.autoMarkOldAsRead(48);
      if (readResult.count > 0) {
        this.logger.log(
          `[Cleanup] Auto-marked ${readResult.count} notifications older than 48 hours as read.`,
        );
      }
    } catch (err) {
      this.logger.error('Error auto-marking old notifications as read:', err);
    }

    // Cleanup old notifications (older than 30 days)
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const deleteResult = await this.prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });
      if (deleteResult.count > 0) {
        this.logger.log(
          `[Cleanup] Deleted ${deleteResult.count} notifications older than 30 days.`,
        );
      }
    } catch (err) {
      this.logger.error('Error cleaning up old notifications:', err);
    }

    // Só as chaves: cada obra é lida e gravada dentro do seu lock (o mesmo da sincronização),
    // para nenhum dos dois escrever uma lista de episódios desatualizada por cima do outro.
    const releasingAnimes = await this.prisma.anime.findMany({
      where: { statusLancamento: 'RELEASING' },
      select: { fonte: true, id: true, titulo: true },
    });

    for (const anime of releasingAnimes) {
      try {
        const { notificationsSent } = await this.animeService.notifyAiredEpisodes(
          anime.fonte,
          anime.id,
        );
        if (notificationsSent > 0) {
          this.logger.log(
            `[LocalSync] ${notificationsSent} newly aired episode(s) of "${anime.titulo}" notified.`,
          );
        }
      } catch (err) {
        this.logger.error(
          `[LocalSync] Error checking aired episodes of "${anime.titulo}" (${anime.fonte}:${anime.id}):`,
          err,
        );
      }
    }
  }

  private getLocalHour(date: Date, timezone: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(date), 10);
  }

  private getWindowStartDate(hour: number, isYesterday: boolean, timezone: string): Date {
    const now = new Date();
    if (isYesterday) {
      now.setDate(now.getDate() - 1);
    }

    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const getVal = (type: string) => parseInt(parts.find((p) => p.type === type)!.value, 10);

    const localHour = getVal('hour');
    const localMinute = getVal('minute');
    const localSecond = getVal('second');

    const localUtc = Date.UTC(
      getVal('year'),
      getVal('month') - 1,
      getVal('day'),
      localHour,
      localMinute,
      localSecond,
    );
    const offsetMs = now.getTime() - localUtc;

    const targetLocalUtc = Date.UTC(
      getVal('year'),
      getVal('month') - 1,
      getVal('day'),
      hour,
      0,
      0,
    );
    return new Date(targetLocalUtc + offsetMs);
  }

  async checkAndRunScheduledSyncs() {
    const timezone = process.env.AWAKE_TIMEZONE || 'Europe/Lisbon';
    const now = new Date();
    const currentHour = this.getLocalHour(now, timezone);

    // active window is 7h to 2h (which means we skip if it is between 2am and 7am)
    if (currentHour >= 2 && currentHour < 7) {
      this.logger.log(`Current hour ${currentHour} is outside active awake hours (2 AM to 7 AM). Skipping sync check.`);
      return;
    }

    // Cleanup stuck sync logs first (running for more than 2 hours)
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const stuckLogs = await this.prisma.syncLog.findMany({
        where: {
          status: 'RUNNING',
          timestamp: { lt: twoHoursAgo },
        },
      });

      for (const log of stuckLogs) {
        await this.prisma.syncLog.update({
          where: { id: log.id },
          data: {
            status: 'FAILED',
            details: `${log.details} | Automatically marked as failed after 2 hours of inactivity (process termination/timeout).`,
          },
        });
        this.logger.warn(`Automatically marked stuck sync log ID ${log.id} from ${log.timestamp.toISOString()} as FAILED.`);
      }
    } catch (err) {
      this.logger.error('Error cleaning up stuck sync logs:', err);
    }

    const plan: SyncPlan = {
      animeActive: false,
      animeFull: false,
      mangaActive: false,
      mangaFull: false,
      mangaLabel: '',
    };

    // 1. Anime. A sincronização diária (obras em lançamento) e a completa (fila das mais
    //    desatualizadas) são decididas em separado: uma não impede a outra.
    try {
      const animeWindowStart = this.getWindowStartDate(7, currentHour < 2, timezone);
      plan.animeActive = await this.windowNeedsSync('[ANIME_ACTIVE]', animeWindowStart);

      const dueAnimes = await this.prisma.anime.count({ where: dueForFullSync(now) });
      plan.animeFull = dueAnimes > 0 && !(await this.hasRecentAttempt('[ANIME_FULL]'));
    } catch (e) {
      this.logger.error('Error checking anime sync status:', e);
    }

    // 2. Manga: duas janelas por dia para as obras em lançamento, mais a fila completa
    try {
      let window: { label: string; startHour: number; isYesterday: boolean };
      if (currentHour >= 22) {
        window = { label: '[MANGA_NIGHT]', startHour: 22, isYesterday: false };
      } else if (currentHour < 12) {
        window = { label: '[MANGA_NIGHT]', startHour: 22, isYesterday: true };
      } else {
        window = { label: '[MANGA_MIDDAY]', startHour: 12, isYesterday: false };
      }
      plan.mangaLabel = window.label;
      plan.mangaActive = await this.windowNeedsSync(
        window.label,
        this.getWindowStartDate(window.startHour, window.isYesterday, timezone),
      );

      const dueMangas = await this.prisma.manga.count({ where: dueForFullSync(now) });
      plan.mangaFull = dueMangas > 0 && !(await this.hasRecentAttempt('[MANGA_FULL]'));
    } catch (e) {
      this.logger.error('Error checking manga sync status:', e);
    }

    if (plan.animeActive || plan.animeFull || plan.mangaActive || plan.mangaFull) {
      this.logger.log(
        `Scheduled sync check: anime active: ${plan.animeActive}, anime full: ${plan.animeFull}, manga active: ${plan.mangaActive} (${plan.mangaLabel}), manga full: ${plan.mangaFull}`,
      );
      this.runScheduledSyncs(plan).catch((err) =>
        this.logger.error('Error running scheduled syncs:', err),
      );
    }
  }

  // A janela precisa de correr se ainda não tem uma sincronização concluída e não houve
  // uma tentativa recente.
  private async windowNeedsSync(label: string, windowStart: Date): Promise<boolean> {
    const doneInWindow = await this.prisma.syncLog.findFirst({
      where: {
        status: { in: SYNC_DONE_STATUSES },
        details: { startsWith: label },
        timestamp: { gte: windowStart },
      },
      select: { id: true },
    });
    if (doneInWindow) return false;
    return !(await this.hasRecentAttempt(label));
  }

  // Há uma tentativa recente deste tipo? Conta uma que esteja a correr, uma concluída nas
  // últimas 20 horas ou uma falhada na última hora. Uma falha já não bloqueia quase um dia:
  // as obras que falharam têm o seu próprio adiamento (nextSyncAt).
  private async hasRecentAttempt(label: string): Promise<boolean> {
    const now = Date.now();
    const recent = await this.prisma.syncLog.findFirst({
      where: {
        details: { contains: label },
        OR: [
          { status: 'RUNNING' },
          {
            status: { in: SYNC_DONE_STATUSES },
            timestamp: { gte: new Date(now - DONE_GUARD_MS) },
          },
          {
            status: 'FAILED',
            timestamp: { gte: new Date(now - FAILED_GUARD_MS) },
          },
        ],
      },
      orderBy: { timestamp: 'desc' },
      select: { status: true, timestamp: true },
    });
    if (recent) {
      this.logger.log(
        `${label} sync skipped: recent attempt (${recent.status}) at ${recent.timestamp.toISOString()}.`,
      );
    }
    return !!recent;
  }

  // Devolve false se já havia uma sincronização a correr (e não fez nada).
  private async runScheduledSyncs(plan: SyncPlan): Promise<boolean> {
    if (this.isSyncingActive) {
      this.logger.warn('A synchronization is already running. Skipping scheduled trigger.');
      return false;
    }

    this.isSyncingActive = true;
    this.currentSyncedCount = 0;
    this.currentItemTitle = 'Initializing...';

    try {
      const animeSelect = { fonte: true, id: true, titulo: true } as const;
      const mangaSelect = { id: true, titulo: true } as const;
      const syncAnime = (a: AnimeRef) =>
        this.animeService.syncLatestEpisode(a.fonte, a.id);
      const syncManga = (m: MangaRef) =>
        this.mangaService.syncLatestChapter(m.id, { throwOnFailure: true });
      // As mais atrasadas primeiro; as que nunca tiveram data marcada vão à frente
      const oldestFirst = { nextSyncAt: { sort: 'asc', nulls: 'first' } } as const;

      // 1a. Anime: obras em lançamento (diária)
      if (plan.animeActive) {
        await this.runPhase<AnimeRef>(
          '[ANIME_ACTIVE]',
          'active/releasing animes',
          () =>
            this.prisma.anime.findMany({
              where: {
                syncStatus: { not: SYNC_STATUS_GONE },
                OR: [
                  { statusLancamento: { notIn: ['FINISHED', 'CANCELED', 'CANCELLED'] } },
                  { statusLancamento: null },
                ],
              },
              select: animeSelect,
            }),
          syncAnime,
        );
      }

      // 1b. Anime: fila completa. As obras que a fase anterior acabou de sincronizar já
      //     saíram da fila (o nextSyncAt avançou).
      if (plan.animeFull) {
        await this.runPhase<AnimeRef>(
          '[ANIME_FULL]',
          'animes',
          () =>
            this.prisma.anime.findMany({
              where: dueForFullSync(),
              orderBy: oldestFirst,
              take: FULL_SYNC_BATCH,
              select: animeSelect,
            }),
          syncAnime,
        );
      }

      // 2a. Manga: obras em lançamento (janela atual)
      if (plan.mangaActive) {
        await this.runPhase<MangaRef>(
          plan.mangaLabel,
          'releasing mangas',
          () =>
            this.prisma.manga.findMany({
              where: {
                statusLancamento: 'RELEASING',
                syncStatus: { not: SYNC_STATUS_GONE },
              },
              select: mangaSelect,
            }),
          syncManga,
        );
      }

      // 2b. Manga: fila completa
      if (plan.mangaFull) {
        await this.runPhase<MangaRef>(
          '[MANGA_FULL]',
          'mangas',
          () =>
            this.prisma.manga.findMany({
              where: dueForFullSync(),
              orderBy: oldestFirst,
              take: FULL_SYNC_BATCH,
              select: mangaSelect,
            }),
          syncManga,
        );
      }
    } finally {
      this.isSyncingActive = false;
      this.currentItemTitle = '';
      this.currentSyncedCount = 0;
      this.totalItemsToSync = 0;
    }
    return true;
  }

  // Corre uma fase com o seu próprio registo no SyncLog. Um erro numa fase fica no registo
  // dessa fase e não impede as seguintes nem altera o resultado das que já terminaram.
  private async runPhase<T extends { id: number; titulo: string }>(
    label: string,
    tipoObra: string,
    loadItems: () => Promise<T[]>,
    syncOne: (item: T) => Promise<unknown>,
  ) {
    this.logger.log(`Starting scheduled ${label} sync...`);
    this.currentSyncedCount = 0;
    this.totalItemsToSync = 0;
    this.currentItemTitle = 'Initializing...';

    let logId: number | null = null;
    try {
      const log = await this.prisma.syncLog.create({
        data: { status: 'RUNNING', details: `${label} Sync started` },
      });
      logId = log.id;

      const items = await loadItems();
      this.logger.log(`${label} Selected ${items.length} ${tipoObra} to sync.`);

      const outcome = await this.syncItems(label, items, syncOne);
      await this.finishSyncLog(log.id, label, tipoObra, outcome);
    } catch (error) {
      this.logger.error(`Error during scheduled ${label} sync:`, error);
      if (logId !== null) {
        const msg = error instanceof Error ? error.stack || error.message : String(error);
        await this.prisma.syncLog
          .update({
            where: { id: logId },
            data: { status: 'FAILED', details: `${label} Failed: ${msg}` },
          })
          .catch((e) => this.logger.error(`Failed to update ${label} log status:`, e));
      }
    }
  }

  // Sincroniza as obras uma a uma, com uma pausa a cada 3 para respeitar os limites das
  // fontes. Um erro numa obra fica registado e o ciclo continua com as seguintes (L-22).
  private async syncItems<T extends { id: number; titulo: string }>(
    label: string,
    items: T[],
    syncOne: (item: T) => Promise<unknown>,
  ): Promise<SyncOutcome> {
    const outcome: SyncOutcome = { total: items.length, sincronizadas: 0, falhas: [] };
    this.totalItemsToSync = items.length;

    for (let i = 0; i < items.length; i += 3) {
      if (!this.isSyncingActive) break;

      const batch = items.slice(i, i + 3);
      for (const item of batch) {
        this.currentItemTitle = item.titulo;
        this.logger.log(
          `[ScheduledSync] ${label} Syncing: "${item.titulo}" (${this.currentSyncedCount + 1}/${this.totalItemsToSync})`,
        );
        try {
          await syncOne(item);
          outcome.sincronizadas++;
        } catch (err) {
          const erro = err instanceof Error ? err.message : String(err);
          outcome.falhas.push({ id: item.id, titulo: item.titulo, erro });
          this.logger.error(`[ScheduledSync] ${label} Failed: "${item.titulo}" (${item.id}): ${erro}`);
        }
        this.currentSyncedCount++;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return outcome;
  }

  private async finishSyncLog(
    logId: number,
    label: string,
    tipoObra: string,
    outcome: SyncOutcome,
  ) {
    const status = decidirEstadoSync(outcome);
    await this.prisma.syncLog.update({
      where: { id: logId },
      data: { status, details: descreverSync(label, tipoObra, outcome) },
    });
    this.logger.log(
      `Scheduled ${label} sync finished with status ${status} (${outcome.sincronizadas}/${outcome.total}, ${outcome.falhas.length} failed).`,
    );
  }

  // Arranca a sincronização das obras em lançamento em background, ignorando o agendamento.
  // Devolve false se já havia uma sincronização a correr.
  runManualSync(): boolean {
    if (this.isSyncingActive) {
      this.logger.warn('Manual sync requested, but a synchronization is already running.');
      return false;
    }
    this.logger.log('Manual sync triggered by administrator. Bypassing schedule.');
    this.runScheduledSyncs({
      animeActive: true,
      animeFull: false,
      mangaActive: true,
      mangaFull: false,
      mangaLabel: '[MANGA_MANUAL]',
    }).catch((err) => this.logger.error('Error running manual sync:', err));
    return true;
  }

  getStatus() {
    return {
      isSyncing: this.isSyncingActive,
      total: this.totalItemsToSync,
      current: this.currentSyncedCount,
      currentItemTitle: this.currentItemTitle,
    };
  }
}
