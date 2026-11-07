import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnimeService } from '../anime/anime.service';
import { MangaService } from '../manga/manga.service';
import { KeepAwakeService } from '../keep-awake.service';
import { NotificationService } from '../notification/notification.service';
import {
  SYNC_DONE_STATUSES,
  SyncOutcome,
  decidirEstadoSync,
  descreverSync,
} from './sync-result';

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

  @Cron(CronExpression.EVERY_HOUR)
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

    const now = new Date();

    const releasingAnimes = await this.prisma.anime.findMany({
      where: {
        statusLancamento: 'RELEASING',
      },
    });

    const animeUserCache = new Map<number, any[]>();

    for (const anime of releasingAnimes) {
      if (!anime.episodesList) continue;

      const episodes = anime.episodesList as any[];
      let updated = false;

      for (const ep of episodes) {
        if (ep.airDate) {
          const epDate = new Date(ep.airDate);
          if (now >= epDate && !ep.notified) {
            if (Number(ep.season) > 0) {
              let userAnimes = animeUserCache.get(anime.id);
              if (!userAnimes) {
                userAnimes = await this.prisma.userAnime.findMany({
                  where: {
                    animeId: anime.id,
                    status: 'WATCHING',
                  },
                  include: {
                    user: {
                      select: {
                        id: true,
                        preferences: true,
                      },
                    },
                  },
                });
                animeUserCache.set(anime.id, userAnimes);
              }

              for (const ua of userAnimes) {
                const userPrefs = ua.user?.preferences as any;
                const notifyWeeklyEpisodes = userPrefs?.notifyWeeklyEpisodes !== false;
                const isPremiere = Number(ep.episodeNumber) === 1;

                if (!isPremiere && !notifyWeeklyEpisodes) {
                  continue;
                }

                const title = isPremiere
                  ? 'Estreia de Nova Temporada / Série!'
                  : 'Novo episódio de Série/Anime!';
                const message = isPremiere
                  ? `O 1º episódio da Temporada ${ep.season} de "${anime.titulo}" estreou!`
                  : `O episódio ${ep.episodeNumber} da Temporada ${ep.season} de "${anime.titulo}" estreou!`;

                await this.notificationService.createOrReplaceNotification(
                  ua.userId,
                  title,
                  message,
                  'ANIME',
                  anime.id,
                );
              }
            }

            ep.notified = true;
            updated = true;
            this.logger.log(
              `[LocalSync] Sent local notification or marked special for ${anime.titulo} Season ${ep.season} Ep ${ep.episodeNumber}`,
            );
          }
        }
      }

      if (updated) {
        const { numEpisodiosAired, ultimoEpisodioEstreadoData } =
          this.animeService.calculateAiredEpisodesInfo(episodes);

        await this.prisma.anime.update({
          where: { id: anime.id },
          data: {
            episodesList: episodes,
            numEpisodiosAired,
            ultimoEpisodioEstreadoData,
          },
        });
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

    let runAnimeActive = false;
    let runAnimeFull = false;
    let runManga = false;
    let runMangaFull = false;
    let activeMangaLabel = '';

    // 1. Anime Sync check (Active daily vs Full weekly)
    const isAnimeYesterday = currentHour < 2;
    const animeWindowStartDate = this.getWindowStartDate(7, isAnimeYesterday, timezone);

    try {
      // Check if we need Weekly Full Sync (if we have any anime updated > 7 days ago)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const outdatedAnimesCount = await this.prisma.anime.count({
        where: {
          updatedAt: { lt: sevenDaysAgo },
        },
      });

      if (outdatedAnimesCount > 0) {
        // We need a weekly full sync!
        // But first, apply the 20-hour guard for ANIME_FULL attempts (including RUNNING/FAILED/SUCCESS)
        const recentAnimeFullAttempt = await this.prisma.syncLog.findFirst({
          where: {
            timestamp: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
            details: { contains: 'ANIME_FULL' },
          },
        });
        if (!recentAnimeFullAttempt) {
          runAnimeFull = true;
        } else {
          this.logger.log(
            `ANIME_FULL sync needed (${outdatedAnimesCount} outdated), but skipped due to a recent attempt in the last 20 hours (at ${recentAnimeFullAttempt.timestamp.toISOString()}).`,
          );
        }
      }

      // If we are NOT running the full sync today, check if we need the daily active sync
      if (!runAnimeFull) {
        // Daily active sync needs to run if there is no successful ANIME_ACTIVE or ANIME_FULL sync since 7 AM today
        const lastActiveSync = await this.prisma.syncLog.findFirst({
          where: {
            status: { in: SYNC_DONE_STATUSES },
            details: { startsWith: '[ANIME_ACTIVE]' },
            timestamp: { gte: animeWindowStartDate },
          },
        });
        const lastFullSyncToday = await this.prisma.syncLog.findFirst({
          where: {
            status: { in: SYNC_DONE_STATUSES },
            details: { startsWith: '[ANIME_FULL]' },
            timestamp: { gte: animeWindowStartDate },
          },
        });

        if (!lastActiveSync && !lastFullSyncToday) {
          // We need a daily active sync!
          // Apply the 20-hour guard for active sync: skip only if there was a recent ANIME_ACTIVE attempt
          // OR a successful ANIME_FULL sync in the last 20 hours.
          const recentAnimeAttempt = await this.prisma.syncLog.findFirst({
            where: {
              timestamp: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
              OR: [
                { details: { contains: 'ANIME_ACTIVE' } },
                { details: { contains: 'ANIME_FULL' }, status: { in: SYNC_DONE_STATUSES } },
              ],
            },
          });
          if (!recentAnimeAttempt) {
            runAnimeActive = true;
          } else {
            this.logger.log(
              `ANIME_ACTIVE sync needed, but skipped due to a recent anime sync attempt or successful full sync in the last 20 hours (at ${recentAnimeAttempt.timestamp.toISOString()}).`,
            );
          }
        }
      }
    } catch (e) {
      this.logger.error('Error checking last anime sync status:', e);
    }

    // 2. MANGA SYNC check (Weekly Full Sync vs Daily Active Sync)
    try {
      // Check if we need Weekly Full Sync for Manga (if we have any manga updated > 7 days ago)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const outdatedMangasCount = await this.prisma.manga.count({
        where: {
          updatedAt: { lt: sevenDaysAgo },
        },
      });

      if (outdatedMangasCount > 0) {
        const recentMangaFullAttempt = await this.prisma.syncLog.findFirst({
          where: {
            timestamp: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
            details: { contains: 'MANGA_FULL' },
          },
        });
        if (!recentMangaFullAttempt) {
          runMangaFull = true;
          activeMangaLabel = '[MANGA_FULL]';
        } else {
          this.logger.log(
            `MANGA_FULL sync needed (${outdatedMangasCount} outdated), but skipped due to a recent attempt in the last 20 hours (at ${recentMangaFullAttempt.timestamp.toISOString()}).`,
          );
        }
      }

      if (!runMangaFull) {
        let activeMangaWindow: { label: string; startHour: number; isYesterday: boolean };

        if (currentHour >= 22) {
          activeMangaWindow = { label: '[MANGA_NIGHT]', startHour: 22, isYesterday: false };
        } else if (currentHour < 12) {
          activeMangaWindow = { label: '[MANGA_NIGHT]', startHour: 22, isYesterday: true };
        } else { // 12 <= currentHour < 22
          activeMangaWindow = { label: '[MANGA_MIDDAY]', startHour: 12, isYesterday: false };
        }

        activeMangaLabel = activeMangaWindow.label;
        const mangaWindowStartDate = this.getWindowStartDate(
          activeMangaWindow.startHour,
          activeMangaWindow.isYesterday,
          timezone,
        );

        const lastMangaSync = await this.prisma.syncLog.findFirst({
          where: {
            status: { in: SYNC_DONE_STATUSES },
            details: { startsWith: activeMangaWindow.label },
            timestamp: { gte: mangaWindowStartDate },
          },
        });

        if (!lastMangaSync) {
          // Apply the 20-hour guard for this specific manga window
          const recentMangaAttempt = await this.prisma.syncLog.findFirst({
            where: {
              timestamp: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
              details: { contains: activeMangaWindow.label },
            },
          });
          if (!recentMangaAttempt) {
            runManga = true;
          } else {
            this.logger.log(
              `MANGA sync for ${activeMangaWindow.label} needed, but skipped due to an attempt in the last 20 hours (at ${recentMangaAttempt.timestamp.toISOString()}).`,
            );
          }
        }
      }
    } catch (e) {
      this.logger.error('Error checking manga sync status:', e);
    }

    if (runAnimeActive || runAnimeFull || runManga || runMangaFull) {
      this.logger.log(
        `Scheduled sync check: Anime active sync needed: ${runAnimeActive}, Anime full sync needed: ${runAnimeFull}, Manga active sync needed: ${runManga}, Manga full sync needed: ${runMangaFull} (${activeMangaLabel})`,
      );
      this.runScheduledSyncs(runAnimeActive, runAnimeFull, runManga, runMangaFull, activeMangaLabel).catch((err) =>
        this.logger.error('Error running scheduled syncs:', err),
      );
    }
  }

  private async runScheduledSyncs(
    runAnimeActive: boolean,
    runAnimeFull: boolean,
    runMangaActive: boolean,
    runMangaFull: boolean,
    mangaLabel: string,
  ) {
    if (this.isSyncingActive) {
      this.logger.warn('A synchronization is already running. Skipping scheduled trigger.');
      return;
    }

    this.isSyncingActive = true;
    this.currentSyncedCount = 0;
    this.currentItemTitle = 'Initializing...';

    let activeLog: any = null;
    let fullLog: any = null;
    let mangaLog: any = null;

    try {
      // 1a. Anime Active Sync
      if (runAnimeActive) {
        this.logger.log('Starting scheduled ANIME ACTIVE sync...');
        activeLog = await this.prisma.syncLog.create({
          data: {
            status: 'RUNNING',
            details: '[ANIME_ACTIVE] Sync started',
          },
        });

        const animes = await this.prisma.anime.findMany({
          where: {
            OR: [
              {
                statusLancamento: {
                  notIn: ['FINISHED', 'CANCELED', 'CANCELLED'],
                },
              },
              { statusLancamento: null },
            ],
          },
          select: { id: true, titulo: true },
        });

        const outcome = await this.syncItems('[ANIME_ACTIVE]', animes, (id) =>
          this.animeService.syncLatestEpisode(id),
        );
        await this.finishSyncLog(activeLog.id, '[ANIME_ACTIVE]', 'active/releasing animes', outcome);
      }

      // 1b. Anime Full Sync
      if (runAnimeFull) {
        this.logger.log('Starting scheduled ANIME FULL sync...');
        fullLog = await this.prisma.syncLog.create({
          data: {
            status: 'RUNNING',
            details: '[ANIME_FULL] Sync started',
          },
        });

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const animes = await this.prisma.anime.findMany({
          where: {
            updatedAt: { lt: sevenDaysAgo },
          },
          orderBy: { updatedAt: 'asc' },
          take: 100, // Limit full sync to 100 oldest outdated items to avoid Render timeouts/crashes
          select: { id: true, titulo: true },
        });
        this.logger.log(`Selected ${animes.length} outdated animes (updated > 7 days ago) to sync.`);

        const outcome = await this.syncItems('[ANIME_FULL]', animes, (id) =>
          this.animeService.syncLatestEpisode(id),
        );
        await this.finishSyncLog(fullLog.id, '[ANIME_FULL]', 'animes', outcome);
      }

      // Reset counters for Manga if both ran
      if ((runAnimeActive || runAnimeFull) && (runMangaActive || runMangaFull)) {
        this.currentSyncedCount = 0;
        this.totalItemsToSync = 0;
        this.currentItemTitle = 'Initializing Manga...';
      }

      // 2a. Manga Active Sync
      if (runMangaActive) {
        this.logger.log(`Starting scheduled MANGA ACTIVE sync for window ${mangaLabel}...`);
        mangaLog = await this.prisma.syncLog.create({
          data: {
            status: 'RUNNING',
            details: `${mangaLabel} Sync started`,
          },
        });

        const mangas = await this.prisma.manga.findMany({
          where: { statusLancamento: 'RELEASING' },
          select: { id: true, titulo: true },
        });

        const outcome = await this.syncItems(mangaLabel, mangas, (id) =>
          this.mangaService.syncLatestChapter(id),
        );
        await this.finishSyncLog(mangaLog.id, mangaLabel, 'releasing mangas', outcome);
      }

      // 2b. Manga Full Sync (Weekly)
      if (runMangaFull) {
        this.logger.log('Starting scheduled MANGA FULL sync...');
        mangaLog = await this.prisma.syncLog.create({
          data: {
            status: 'RUNNING',
            details: '[MANGA_FULL] Sync started',
          },
        });

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const mangas = await this.prisma.manga.findMany({
          where: {
            updatedAt: { lt: sevenDaysAgo },
          },
          orderBy: { updatedAt: 'asc' },
          take: 100, // Limit full sync to 100 oldest outdated items to avoid Render timeouts/crashes
          select: { id: true, titulo: true },
        });
        this.logger.log(`Selected ${mangas.length} outdated mangas (updated > 7 days ago) to sync.`);

        const outcome = await this.syncItems('[MANGA_FULL]', mangas, (id) =>
          this.mangaService.syncLatestChapter(id),
        );
        await this.finishSyncLog(mangaLog.id, '[MANGA_FULL]', 'mangas', outcome);
      }
    } catch (error) {
      this.logger.error('Error during scheduled synchronization:', error);
      const typeStr = [
        runAnimeActive && 'ANIME_ACTIVE',
        runAnimeFull && 'ANIME_FULL',
        runMangaActive && mangaLabel,
        runMangaFull && 'MANGA_FULL',
      ].filter(Boolean).join(' + ');
      const errorMsg = `[SCHEDULED_SYNC] Failed during ${typeStr}: ${error instanceof Error ? error.stack || error.message : String(error)}`;

      if (runAnimeActive && activeLog) {
        await this.prisma.syncLog.update({
          where: { id: activeLog.id },
          data: { status: 'FAILED', details: errorMsg },
        }).catch((e) => this.logger.error('Failed to update active log status:', e));
      }
      if (runAnimeFull && fullLog) {
        await this.prisma.syncLog.update({
          where: { id: fullLog.id },
          data: { status: 'FAILED', details: errorMsg },
        }).catch((e) => this.logger.error('Failed to update full log status:', e));
      }
      if ((runMangaActive || runMangaFull) && mangaLog) {
        await this.prisma.syncLog.update({
          where: { id: mangaLog.id },
          data: { status: 'FAILED', details: errorMsg },
        }).catch((e) => this.logger.error('Failed to update manga log status:', e));
      }
    } finally {
      this.isSyncingActive = false;
      this.currentItemTitle = '';
      this.currentSyncedCount = 0;
      this.totalItemsToSync = 0;
    }
  }

  // Sincroniza as obras em lotes de 3. Um erro numa obra fica registado e o ciclo
  // continua com as seguintes, em vez de abortar a sincronização toda (L-22).
  private async syncItems(
    label: string,
    items: { id: number; titulo: string }[],
    syncOne: (id: number) => Promise<unknown>,
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
          await syncOne(item.id);
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

  async runManualSync() {
    this.logger.log('Manual sync triggered by administrator. Bypassing schedule.');
    this.runScheduledSyncs(true, false, true, false, '[MANGA_MANUAL]').catch((err) =>
      this.logger.error('Error running manual sync:', err),
    );
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
