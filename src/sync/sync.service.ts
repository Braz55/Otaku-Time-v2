import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnimeService } from '../anime/anime.service';
import { MangaService } from '../manga/manga.service';

@Injectable()
export class SyncService {
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

  @Cron(CronExpression.EVERY_4_HOURS)
  async handleCron() {
    this.logger.log('CRON Triggered: Starting background auto-sync for RELEASING media...');
    await this.runAutoSync();
  }

  async runAutoSync() {
    if (this.isSyncingActive) {
      this.logger.warn('Sync is already running. Skipping new trigger.');
      return { status: 'already_running' };
    }

    this.isSyncingActive = true;
    this.currentSyncedCount = 0;
    this.currentItemTitle = 'Initializing...';

    try {
      const animes = await this.prisma.anime.findMany({
        where: { statusLancamento: 'RELEASING' }
      });
      const mangas = await this.prisma.manga.findMany({
        where: { statusLancamento: 'RELEASING' }
      });

      this.totalItemsToSync = animes.length + mangas.length;
      this.logger.log(`Found ${animes.length} Animes and ${mangas.length} Mangas in RELEASING status to sync.`);

      // Processar Animes em lotes de 3
      for (let i = 0; i < animes.length; i += 3) {
        const batch = animes.slice(i, i + 3);
        for (const anime of batch) {
          this.currentItemTitle = anime.titulo;
          this.logger.log(`[AutoSync] Syncing Anime: "${anime.titulo}" (ID: ${anime.id})...`);
          await this.animeService.syncLatestEpisode(anime.id);
          this.currentSyncedCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Processar Mangas em lotes de 3
      for (let i = 0; i < mangas.length; i += 3) {
        const batch = mangas.slice(i, i + 3);
        for (const manga of batch) {
          this.currentItemTitle = manga.titulo;
          this.logger.log(`[AutoSync] Syncing Manga: "${manga.titulo}" (ID: ${manga.id})...`);
          await this.mangaService.syncLatestChapter(manga.id);
          this.currentSyncedCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      this.logger.log('Background AutoSync completed successfully!');
    } catch (error) {
      this.logger.error('Error during Background AutoSync:', error);
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
      currentItemTitle: this.currentItemTitle
    };
  }
}
