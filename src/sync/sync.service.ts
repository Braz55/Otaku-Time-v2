import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MediaSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnimeService } from '../anime/anime.service';
import { EpisodeStoreService } from '../anime/episode-store.service';
import { MangaService } from '../manga/manga.service';
import { KeepAwakeService } from '../keep-awake.service';
import { NotificationService } from '../notification/notification.service';
import { CircuitOpenError } from '../common/circuit-breaker';
import { SyncNotFoundError } from '../common/sync-errors';
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

// Uma obra a sincronizar. O manga vem sempre da AniList.
type WorkRef = { fonte: MediaSource; id: number; titulo: string };

// Um job da fila já reservado por este processo
interface ClaimedJob {
  id: number;
  runId: number;
  fonte: MediaSource;
  mediaId: number;
  titulo: string;
  attempts: number;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
// Uma sincronização concluída não se repete antes de 20 horas
const DONE_GUARD_MS = 20 * HOUR_MS;
// Uma que falhou por inteiro pode ser repetida ao fim de 1 hora
const FAILED_GUARD_MS = 1 * HOUR_MS;
// Uma execução que não acaba em 2 horas é dada como falhada e os jobs que restam são largados
const STALE_RUN_MS = 2 * HOUR_MS;
// Um job reservado há mais tempo do que isto ficou órfão (o processo morreu): volta à fila
const STALE_JOB_MS = 15 * MINUTE_MS;
// Máximo de obras por sincronização completa, para não esgotar o tempo do Render
const FULL_SYNC_BATCH = 100;
// Quantas vezes se tenta uma obra dentro da mesma execução, e a espera antes de cada nova tentativa
const MAX_JOB_ATTEMPTS = 3;
const JOB_RETRY_DELAYS_MS = [2 * MINUTE_MS, 10 * MINUTE_MS];
// Obras em paralelo e pausa entre lotes, por fornecedor. O TMDB aguenta bem pedidos em paralelo;
// as fontes de manga (AniList, Baka-Updates, MangaDex) têm limites apertados.
const ANIME_LANE = { concurrency: 3, pauseMs: 500 };
const MANGA_LANE = { concurrency: 1, pauseMs: 1500 };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function tipoObraFor(label: string): string {
  if (label === '[ANIME_ACTIVE]') return 'active/releasing animes';
  if (label === '[ANIME_FULL]') return 'animes';
  if (label === '[MANGA_FULL]') return 'mangas';
  return 'releasing mangas';
}

@Injectable()
export class SyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  // Estado do worker deste processo (mostrado na app em /sync/status)
  private draining = false;
  private totalItemsToSync = 0;
  private currentSyncedCount = 0;
  private currentItemTitle = '';
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly animeService: AnimeService,
    private readonly episodeStore: EpisodeStoreService,
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

  onModuleDestroy() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
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

    // Uma consulta à tabela Episode diz que obras têm episódios estreados por tratar; já não é
    // preciso carregar a lista de episódios de todas as obras em lançamento.
    const pending = await this.episodeStore.findAnimesWithPendingAired();

    for (const { animeFonte, animeId } of pending) {
      try {
        const { notificationsSent } = await this.animeService.notifyAiredEpisodes(
          animeFonte,
          animeId,
        );
        if (notificationsSent > 0) {
          this.logger.log(
            `[LocalSync] ${notificationsSent} newly aired episode(s) of anime ${animeFonte}:${animeId} notified.`,
          );
        }
      } catch (err) {
        this.logger.error(
          `[LocalSync] Error checking aired episodes of anime ${animeFonte}:${animeId}:`,
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

  // ---------------------------------------------------------------------------------------
  // Agendamento: decide o que precisa de correr e põe as obras na fila (tabela SyncJob)
  // ---------------------------------------------------------------------------------------

  async checkAndRunScheduledSyncs() {
    const timezone = process.env.AWAKE_TIMEZONE || 'Europe/Lisbon';
    const now = new Date();
    const currentHour = this.getLocalHour(now, timezone);

    // active window is 7h to 2h (which means we skip if it is between 2am and 7am)
    if (currentHour >= 2 && currentHour < 7) {
      this.logger.log(`Current hour ${currentHour} is outside active awake hours (2 AM to 7 AM). Skipping sync check.`);
      return;
    }

    await this.cleanupStaleWork();

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
      await this.enqueuePlan(plan);
    }

    // Mesmo sem nada novo pode haver jobs à espera (de antes de um reinício, ou novas tentativas)
    this.kickWorker();
  }

  // Execuções e jobs que ficaram a meio porque o processo morreu ou adormeceu
  private async cleanupStaleWork() {
    try {
      const stuckLogs = await this.prisma.syncLog.findMany({
        where: {
          status: 'RUNNING',
          timestamp: { lt: new Date(Date.now() - STALE_RUN_MS) },
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
        // As obras que ficaram por tratar voltam a ser escolhidas pela próxima execução
        await this.prisma.syncJob.deleteMany({ where: { runId: log.id } });
        this.logger.warn(`Automatically marked stuck sync log ID ${log.id} from ${log.timestamp.toISOString()} as FAILED.`);
      }

      const orphaned = await this.prisma.syncJob.updateMany({
        where: {
          status: 'RUNNING',
          lockedAt: { lt: new Date(Date.now() - STALE_JOB_MS) },
        },
        data: { status: 'PENDING', lockedAt: null },
      });
      if (orphaned.count > 0) {
        this.logger.warn(`Returned ${orphaned.count} orphaned sync job(s) to the queue.`);
      }
    } catch (err) {
      this.logger.error('Error cleaning up stuck sync work:', err);
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

  private async enqueuePlan(plan: SyncPlan) {
    const animeSelect = { fonte: true, id: true, titulo: true } as const;
    const mangaSelect = { id: true, titulo: true } as const;
    const asManga = (rows: { id: number; titulo: string }[]): WorkRef[] =>
      rows.map((m) => ({ ...m, fonte: MediaSource.ANILIST }));
    // As mais atrasadas primeiro; as que nunca tiveram data marcada vão à frente
    const oldestFirst = { nextSyncAt: { sort: 'asc', nulls: 'first' } } as const;

    // 1a. Anime: obras em lançamento (diária)
    if (plan.animeActive) {
      await this.enqueueRun('[ANIME_ACTIVE]', () =>
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
      );
    }

    // 1b. Anime: fila completa. Uma obra que já entrou pela fase anterior não é repetida
    //     (só pode haver um job por tratar por obra).
    if (plan.animeFull) {
      await this.enqueueRun('[ANIME_FULL]', () =>
        this.prisma.anime.findMany({
          where: dueForFullSync(),
          orderBy: oldestFirst,
          take: FULL_SYNC_BATCH,
          select: animeSelect,
        }),
      );
    }

    // 2a. Manga: obras em lançamento (janela atual)
    if (plan.mangaActive) {
      await this.enqueueRun(plan.mangaLabel, async () =>
        asManga(
          await this.prisma.manga.findMany({
            where: {
              statusLancamento: 'RELEASING',
              syncStatus: { not: SYNC_STATUS_GONE },
            },
            select: mangaSelect,
          }),
        ),
      );
    }

    // 2b. Manga: fila completa
    if (plan.mangaFull) {
      await this.enqueueRun('[MANGA_FULL]', async () =>
        asManga(
          await this.prisma.manga.findMany({
            where: dueForFullSync(),
            orderBy: oldestFirst,
            take: FULL_SYNC_BATCH,
            select: mangaSelect,
          }),
        ),
      );
    }
  }

  // Cria uma execução (um registo no SyncLog) e um job por obra. Um erro aqui fica no log e
  // não impede as outras execuções.
  private async enqueueRun(label: string, loadItems: () => Promise<WorkRef[]>) {
    try {
      const items = await loadItems();
      const now = new Date();
      const log = await this.prisma.syncLog.create({
        data: { status: 'RUNNING', details: `${label} Sync started` },
      });

      // skipDuplicates: uma obra que já tem um job por tratar (noutra execução) não entra de novo
      const created =
        items.length > 0
          ? await this.prisma.syncJob.createMany({
              data: items.map((item) => ({
                runId: log.id,
                fonte: item.fonte,
                mediaId: item.id,
                titulo: item.titulo,
                runAfter: now,
              })),
              skipDuplicates: true,
            })
          : { count: 0 };
      this.logger.log(
        `${label} Queued ${created.count} of ${items.length} selected ${tipoObraFor(label)}.`,
      );

      if (created.count === 0) await this.finalizeRun(log.id);
    } catch (error) {
      this.logger.error(`Error queueing scheduled ${label} sync:`, error);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Worker: trata os jobs da fila
  // ---------------------------------------------------------------------------------------

  // Arranca o worker se não estiver já a correr. Não espera por ele.
  private kickWorker() {
    if (this.draining) return;
    this.draining = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);

    this.drainQueue()
      .catch((err) => this.logger.error('Error in sync worker:', err))
      .finally(() => {
        this.draining = false;
        this.currentItemTitle = '';
        this.currentSyncedCount = 0;
        this.totalItemsToSync = 0;
        this.scheduleNextKick().catch((err) =>
          this.logger.error('Error scheduling the next sync worker run:', err),
        );
      });
  }

  private async drainQueue() {
    this.currentSyncedCount = 0;
    this.totalItemsToSync = await this.prisma.syncJob.count({
      where: { status: 'PENDING', runAfter: { lte: new Date() } },
    });
    if (this.totalItemsToSync === 0) return;

    this.currentItemTitle = 'Initializing...';
    // Anime e manga usam fornecedores diferentes, por isso correm lado a lado
    await Promise.all([
      this.runLane(false, ANIME_LANE.concurrency, ANIME_LANE.pauseMs),
      this.runLane(true, MANGA_LANE.concurrency, MANGA_LANE.pauseMs),
    ]);
  }

  private async runLane(manga: boolean, concurrency: number, pauseMs: number) {
    for (;;) {
      const jobs = await this.claimJobs(manga, concurrency);
      if (jobs.length === 0) return;

      await Promise.all(jobs.map((job) => this.processJob(job)));
      await this.finalizeRuns([...new Set(jobs.map((job) => job.runId))]);
      await sleep(pauseMs);
    }
  }

  // Reserva até `limit` jobs prontos a correr. FOR UPDATE SKIP LOCKED: dois workers (duas
  // instâncias do servidor) nunca ficam com o mesmo job, e nenhum espera pelo outro.
  private claimJobs(manga: boolean, limit: number): Promise<ClaimedJob[]> {
    return this.prisma.$queryRaw<ClaimedJob[]>`
      UPDATE "SyncJob"
      SET "status" = 'RUNNING',
          "lockedAt" = (NOW() AT TIME ZONE 'UTC'),
          "attempts" = "attempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "SyncJob"
        WHERE "status" = 'PENDING'
          AND "runAfter" <= (NOW() AT TIME ZONE 'UTC')
          AND ("fonte" = 'ANILIST') = ${manga}
        ORDER BY "runAfter", "id"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "runId", "fonte", "mediaId", "titulo", "attempts"`;
  }

  // Sincroniza a obra de um job e regista o desfecho no próprio job. Nunca lança.
  private async processJob(job: ClaimedJob) {
    this.currentItemTitle = job.titulo;
    this.logger.log(
      `[SyncWorker] Syncing "${job.titulo}" (${job.fonte}:${job.mediaId}), attempt ${job.attempts}`,
    );

    let data: Record<string, unknown>;
    try {
      if (job.fonte === MediaSource.ANILIST) {
        await this.mangaService.syncLatestChapter(job.mediaId, { throwOnFailure: true });
      } else {
        await this.animeService.syncLatestEpisode(job.fonte, job.mediaId);
      }
      data = { status: 'DONE', finishedAt: new Date(), lockedAt: null, lastError: null };
    } catch (err) {
      const erro = (err instanceof Error ? err.message : String(err)).slice(0, 500);

      if (err instanceof CircuitOpenError) {
        // O fornecedor está em pausa: o job espera por ele e esta tentativa não conta
        data = {
          status: 'PENDING',
          runAfter: err.retryAt,
          attempts: { decrement: 1 },
          lockedAt: null,
          lastError: erro,
        };
        this.logger.warn(`[SyncWorker] "${job.titulo}" postponed: ${erro}`);
      } else if (!(err instanceof SyncNotFoundError) && job.attempts < MAX_JOB_ATTEMPTS) {
        const delay =
          JOB_RETRY_DELAYS_MS[Math.min(job.attempts, JOB_RETRY_DELAYS_MS.length) - 1];
        data = {
          status: 'PENDING',
          runAfter: new Date(Date.now() + delay),
          lockedAt: null,
          lastError: erro,
        };
        this.logger.warn(
          `[SyncWorker] "${job.titulo}" failed (attempt ${job.attempts}/${MAX_JOB_ATTEMPTS}), retrying in ${delay / MINUTE_MS} min: ${erro}`,
        );
      } else {
        data = { status: 'FAILED', finishedAt: new Date(), lockedAt: null, lastError: erro };
        this.logger.error(
          `[SyncWorker] Failed: "${job.titulo}" (${job.fonte}:${job.mediaId}): ${erro}`,
        );
      }
    }

    if (data.status !== 'PENDING') {
      this.currentSyncedCount++;
      // Jobs que entraram na fila já com o worker a correr
      this.totalItemsToSync = Math.max(this.totalItemsToSync, this.currentSyncedCount);
    }
    await this.prisma.syncJob
      .update({ where: { id: job.id }, data })
      .catch((e) => this.logger.error(`Error updating sync job ${job.id}:`, e));
  }

  // Fecha as execuções que já não têm jobs por tratar
  private async finalizeRuns(runIds: number[]) {
    for (const runId of runIds) {
      try {
        const open = await this.prisma.syncJob.count({
          where: { runId, status: { in: ['PENDING', 'RUNNING'] } },
        });
        if (open === 0) await this.finalizeRun(runId);
      } catch (err) {
        this.logger.error(`Error finalizing sync run ${runId}:`, err);
      }
    }
  }

  // Escreve o resultado da execução no SyncLog a partir dos seus jobs e apaga-os. Uma obra
  // que falhou fica registada e não impede as outras (L-22).
  private async finalizeRun(runId: number) {
    const log = await this.prisma.syncLog.findUnique({ where: { id: runId } });
    if (!log || log.status !== 'RUNNING') return;

    const jobs = await this.prisma.syncJob.findMany({
      where: { runId },
      select: { mediaId: true, titulo: true, status: true, lastError: true },
    });
    const label = log.details?.match(/^\[[A-Z_]+\]/)?.[0] ?? '[SYNC]';
    const outcome: SyncOutcome = {
      total: jobs.length,
      sincronizadas: jobs.filter((job) => job.status === 'DONE').length,
      falhas: jobs
        .filter((job) => job.status === 'FAILED')
        .map((job) => ({
          id: job.mediaId,
          titulo: job.titulo,
          erro: job.lastError ?? 'unknown error',
        })),
    };
    const status = decidirEstadoSync(outcome);

    // Só fecha se ainda estiver RUNNING: com duas instâncias, só uma escreve o resultado
    const closed = await this.prisma.syncLog.updateMany({
      where: { id: runId, status: 'RUNNING' },
      data: { status, details: descreverSync(label, tipoObraFor(label), outcome) },
    });
    if (closed.count === 0) return;

    await this.prisma.syncJob.deleteMany({ where: { runId } });
    this.logger.log(
      `Scheduled ${label} sync finished with status ${status} (${outcome.sincronizadas}/${outcome.total}, ${outcome.falhas.length} failed).`,
    );
  }

  // Se ficaram jobs à espera (novas tentativas, fornecedor em pausa), volta a arrancar o
  // worker quando o primeiro estiver pronto.
  private async scheduleNextKick() {
    const next = await this.prisma.syncJob.findFirst({
      where: { status: 'PENDING' },
      orderBy: { runAfter: 'asc' },
      select: { runAfter: true },
    });
    if (!next) return;

    const delay = Math.min(
      Math.max(next.runAfter.getTime() - Date.now(), 0) + 5000,
      30 * MINUTE_MS,
    );
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.kickWorker(), delay);
    this.retryTimer.unref?.();
  }

  // Põe na fila a sincronização das obras em lançamento, ignorando o agendamento.
  // Devolve false se já havia uma sincronização a correr.
  async runManualSync(): Promise<boolean> {
    if (this.getStatus().isSyncing) {
      this.logger.warn('Manual sync requested, but a synchronization is already running.');
      return false;
    }
    this.logger.log('Manual sync triggered by administrator. Bypassing schedule.');
    await this.enqueuePlan({
      animeActive: true,
      animeFull: false,
      mangaActive: true,
      mangaFull: false,
      mangaLabel: '[MANGA_MANUAL]',
    });
    this.kickWorker();
    return true;
  }

  getStatus() {
    return {
      isSyncing: this.draining && this.totalItemsToSync > 0,
      total: this.totalItemsToSync,
      current: this.currentSyncedCount,
      currentItemTitle: this.currentItemTitle,
    };
  }
}
