import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnimeService } from '../anime/anime.service';
import { MangaService } from '../manga/manga.service';

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
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Application Bootstrapped: Checking scheduled syncs...');
    this.checkAndRunScheduledSyncs().catch((err) =>
      this.logger.error('Error in startup scheduled sync check:', err),
    );
  }

  @Cron('0 */30 * * * *')
  async handleCron() {
    this.logger.log('CRON Triggered: Checking scheduled syncs...');
    await this.checkAndRunScheduledSyncs();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleLocalNotificationsCron() {
    this.logger.log('CRON Triggered: Checking local episode schedules...');
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
            let userAnimes = animeUserCache.get(anime.id);
            if (!userAnimes) {
              userAnimes = await this.prisma.userAnime.findMany({
                where: {
                  animeId: anime.id,
                  status: 'WATCHING',
                },
              });
              animeUserCache.set(anime.id, userAnimes);
            }

            for (const ua of userAnimes) {
              await this.prisma.notification.create({
                data: {
                  userId: ua.userId,
                  title: 'Novo episódio de Série/Anime!',
                  message: `O episódio ${ep.episodeNumber} da Temporada ${ep.season} de "${anime.titulo}" estreou!`,
                  type: 'ANIME',
                  mediaId: anime.id,
                },
              });
            }

            ep.notified = true;
            updated = true;
            this.logger.log(
              `[LocalSync] Sent local notification for ${anime.titulo} Season ${ep.season} Ep ${ep.episodeNumber}`,
            );
          }
        }
      }

      if (updated) {
        await this.prisma.anime.update({
          where: { id: anime.id },
          data: { episodesList: episodes },
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

    let runAnime = false;
    let runManga = false;
    let activeMangaLabel = '';

    // 1. ANIME FULL SYNC check
    const isAnimeYesterday = currentHour < 2;
    const animeWindowStartDate = this.getWindowStartDate(7, isAnimeYesterday, timezone);

    try {
      const lastAnimeSync = await this.prisma.syncLog.findFirst({
        where: {
          status: 'SUCCESS',
          details: { startsWith: '[ANIME_FULL]' },
          timestamp: { gte: animeWindowStartDate },
        },
      });

      if (!lastAnimeSync) {
        runAnime = true;
      }
    } catch (e) {
      this.logger.error('Error checking last anime full sync:', e);
    }

    // 2. MANGA SYNC check
    let activeMangaWindow: { label: string; startHour: number; isYesterday: boolean };

    if (currentHour >= 22) {
      activeMangaWindow = { label: '[MANGA_NIGHT]', startHour: 22, isYesterday: false };
    } else if (currentHour < 2) {
      activeMangaWindow = { label: '[MANGA_NIGHT]', startHour: 22, isYesterday: true };
    } else if (currentHour >= 17) {
      activeMangaWindow = { label: '[MANGA_AFTERNOON]', startHour: 17, isYesterday: false };
    } else if (currentHour >= 12) {
      activeMangaWindow = { label: '[MANGA_MIDDAY]', startHour: 12, isYesterday: false };
    } else { // 7 <= currentHour < 12
      activeMangaWindow = { label: '[MANGA_START]', startHour: 7, isYesterday: false };
    }

    activeMangaLabel = activeMangaWindow.label;
    const mangaWindowStartDate = this.getWindowStartDate(
      activeMangaWindow.startHour,
      activeMangaWindow.isYesterday,
      timezone,
    );

    try {
      const lastMangaSync = await this.prisma.syncLog.findFirst({
        where: {
          status: 'SUCCESS',
          details: { startsWith: activeMangaWindow.label },
          timestamp: { gte: mangaWindowStartDate },
        },
      });

      if (!lastMangaSync) {
        runManga = true;
      }
    } catch (e) {
      this.logger.error(`Error checking last manga sync for window ${activeMangaWindow.label}:`, e);
    }

    if (runAnime || runManga) {
      this.logger.log(
        `Scheduled sync check: Anime full sync needed: ${runAnime}, Manga sync needed: ${runManga} (${activeMangaLabel})`,
      );
      this.runScheduledSyncs(runAnime, runManga, activeMangaLabel).catch((err) =>
        this.logger.error('Error running scheduled syncs:', err),
      );
    }
  }

  private async runScheduledSyncs(runAnime: boolean, runManga: boolean, mangaLabel: string) {
    if (this.isSyncingActive) {
      this.logger.warn('A synchronization is already running. Skipping scheduled trigger.');
      return;
    }

    this.isSyncingActive = true;
    this.currentSyncedCount = 0;
    this.currentItemTitle = 'Initializing...';

    try {
      let syncedAnimesCount = 0;
      let syncedMangasCount = 0;

      // 1. Anime Full Sync
      if (runAnime) {
        this.logger.log('Starting scheduled ANIME FULL sync...');
        const animes = await this.prisma.anime.findMany();
        this.totalItemsToSync = animes.length;

        for (let i = 0; i < animes.length; i += 3) {
          if (!this.isSyncingActive) break;

          const batch = animes.slice(i, i + 3);
          for (const anime of batch) {
            this.currentItemTitle = anime.titulo;
            this.logger.log(
              `[ScheduledSync] [ANIME_FULL] Syncing: "${anime.titulo}" (${this.currentSyncedCount + 1}/${this.totalItemsToSync})`,
            );
            await this.animeService.syncLatestEpisode(anime.id);
            this.currentSyncedCount++;
            syncedAnimesCount++;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        await this.prisma.syncLog.create({
          data: {
            status: 'SUCCESS',
            details: `[ANIME_FULL] Successfully synced all ${syncedAnimesCount} animes.`,
          },
        });
        this.logger.log('Scheduled ANIME FULL sync completed successfully.');
      }

      // Reset counters for Manga if both ran
      if (runAnime && runManga) {
        this.currentSyncedCount = 0;
        this.totalItemsToSync = 0;
        this.currentItemTitle = 'Initializing Manga...';
      }

      // 2. Manga Sync
      if (runManga) {
        this.logger.log(`Starting scheduled MANGA sync for window ${mangaLabel}...`);
        const mangas = await this.prisma.manga.findMany({
          where: { statusLancamento: 'RELEASING' },
        });
        this.totalItemsToSync = mangas.length;

        for (let i = 0; i < mangas.length; i += 3) {
          if (!this.isSyncingActive) break;

          const batch = mangas.slice(i, i + 3);
          for (const manga of batch) {
            this.currentItemTitle = manga.titulo;
            this.logger.log(
              `[ScheduledSync] ${mangaLabel} Syncing: "${manga.titulo}" (${this.currentSyncedCount + 1}/${this.totalItemsToSync})`,
            );
            await this.mangaService.syncLatestChapter(manga.id);
            this.currentSyncedCount++;
            syncedMangasCount++;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        await this.prisma.syncLog.create({
          data: {
            status: 'SUCCESS',
            details: `${mangaLabel} Successfully synced ${syncedMangasCount} releasing mangas.`,
          },
        });
        this.logger.log(`Scheduled MANGA sync for ${mangaLabel} completed successfully.`);
      }
    } catch (error) {
      this.logger.error('Error during scheduled synchronization:', error);
      try {
        const typeStr = [runAnime && 'ANIME', runManga && mangaLabel].filter(Boolean).join(' + ');
        await this.prisma.syncLog.create({
          data: {
            status: 'FAILED',
            details: `[SCHEDULED_SYNC] Failed during ${typeStr}: ${error instanceof Error ? error.stack || error.message : String(error)}`,
          },
        });
      } catch (dbError) {
        this.logger.error('Failed to write FAILED scheduled sync log:', dbError);
      }
    } finally {
      this.isSyncingActive = false;
      this.currentItemTitle = '';
      this.currentSyncedCount = 0;
      this.totalItemsToSync = 0;
    }
  }

  async runManualSync() {
    this.logger.log('Manual sync triggered by administrator. Bypassing schedule.');
    this.runScheduledSyncs(true, true, '[MANGA_MANUAL]').catch((err) =>
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
