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
    this.logger.log(
      'Application Bootstrapped: Checking time since last sync...',
    );
    this.runAutoSync(false, 30 * 60 * 1000).catch((err) =>
      this.logger.error('Error in startup auto-sync:', err),
    );
  }

  @Cron(CronExpression.EVERY_4_HOURS)
  async handleCron() {
    this.logger.log(
      'CRON Triggered: Starting background auto-sync for RELEASING media...',
    );
    await this.runAutoSync(true);
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

  async runAutoSync(bypassCooldown = false, cooldownMs = 4 * 60 * 60 * 1000) {
    if (this.isSyncingActive) {
      this.logger.warn('Sync is already running. Skipping new trigger.');
      return { status: 'already_running' };
    }

    try {
      const lastSync = await this.prisma.syncLog.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { timestamp: 'desc' },
      });

      const now = new Date();

      if (!bypassCooldown && lastSync) {
        const lastSyncTime = new Date(lastSync.timestamp).getTime();
        const timeElapsed = now.getTime() - lastSyncTime;

        if (timeElapsed < cooldownMs) {
          const minutesLeft = (
            (cooldownMs - timeElapsed) /
            (60 * 1000)
          ).toFixed(0);
          const hoursElapsed = (timeElapsed / (60 * 60 * 1000)).toFixed(2);
          this.logger.log(
            `Sync requested, but skipped due to cooldown. Last sync was ${hoursElapsed} hours ago. (${minutesLeft} mins remaining).`,
          );
          return { status: 'cooldown_active' };
        }
      }
    } catch (error) {
      this.logger.error('Error checking sync cooldown:', error);
    }

    this.isSyncingActive = true;
    this.currentSyncedCount = 0;
    this.currentItemTitle = 'Initializing...';

    try {
      const animes = await this.prisma.anime.findMany({
        where: {
          OR: [
            { statusLancamento: 'RELEASING' },
            {
              statusLancamento: {
                notIn: ['FINISHED', 'CANCELLED', 'ENDED', 'CANCELED'],
              },
              utilizadores: {
                some: {
                  status: 'PLANNED',
                },
              },
            },
            {
              statusLancamento: null,
              utilizadores: {
                some: {
                  status: 'PLANNED',
                },
              },
            },
          ],
        },
      });
      const mangas = await this.prisma.manga.findMany({
        where: { statusLancamento: 'RELEASING' },
      });

      this.totalItemsToSync = animes.length + mangas.length;
      this.logger.log(
        `Found ${animes.length} Animes and ${mangas.length} Mangas to sync.`,
      );

      // Processar Animes em lotes de 3
      for (let i = 0; i < animes.length; i += 3) {
        const batch = animes.slice(i, i + 3);
        for (const anime of batch) {
          this.currentItemTitle = anime.titulo;
          this.logger.log(
            `[AutoSync] Syncing Anime: "${anime.titulo}" (ID: ${anime.id})...`,
          );
          await this.animeService.syncLatestEpisode(anime.id);
          this.currentSyncedCount++;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Processar Mangas em lotes de 3
      for (let i = 0; i < mangas.length; i += 3) {
        const batch = mangas.slice(i, i + 3);
        for (const manga of batch) {
          this.currentItemTitle = manga.titulo;
          this.logger.log(
            `[AutoSync] Syncing Manga: "${manga.titulo}" (ID: ${manga.id})...`,
          );
          await this.mangaService.syncLatestChapter(manga.id);
          this.currentSyncedCount++;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      this.logger.log('Background AutoSync completed successfully!');

      // Salvar log de sucesso na base de dados
      await this.prisma.syncLog.create({
        data: {
          status: 'SUCCESS',
          details: `Successfully synced ${animes.length} Animes and ${mangas.length} Mangas (Total: ${this.currentSyncedCount}).`,
        },
      });
    } catch (error) {
      this.logger.error('Error during Background AutoSync:', error);
      // Salvar log de erro na base de dados
      try {
        await this.prisma.syncLog.create({
          data: {
            status: 'FAILED',
            details:
              error instanceof Error
                ? error.stack || error.message
                : String(error),
          },
        });
      } catch (dbError) {
        this.logger.error(
          'Failed to write FAILED sync log to database:',
          dbError,
        );
      }
    } finally {
      this.isSyncingActive = false;
      this.currentItemTitle = '';
      this.currentSyncedCount = 0;
      this.totalItemsToSync = 0;
    }

    return { status: 'completed' };
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
