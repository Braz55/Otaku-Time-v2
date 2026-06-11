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
    this.logger.log('Application Bootstrapped: Checking time since last sync...');
    await this.checkAndRunSyncIfNeeded();
  }

  async checkAndRunSyncIfNeeded() {
    try {
      const lastSync = await this.prisma.syncLog.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { timestamp: 'desc' },
      });

      const now = new Date();
      // 4 hours in milliseconds
      const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

      if (!lastSync) {
        this.logger.log('No previous sync record found. Initializing auto-sync...');
        this.runAutoSync().catch(err => this.logger.error('Error in background auto-sync:', err));
        return;
      }

      const lastSyncTime = new Date(lastSync.timestamp).getTime();
      const timeElapsed = now.getTime() - lastSyncTime;

      if (timeElapsed >= FOUR_HOURS_MS) {
        const hoursElapsed = (timeElapsed / (60 * 60 * 1000)).toFixed(2);
        this.logger.log(`Last sync was ${hoursElapsed} hours ago (more than 4 hours). Triggering auto-sync...`);
        this.runAutoSync().catch(err => this.logger.error('Error in background auto-sync:', err));
      } else {
        const minutesLeft = ((FOUR_HOURS_MS - timeElapsed) / (60 * 1000)).toFixed(0);
        const hoursElapsed = (timeElapsed / (60 * 60 * 1000)).toFixed(2);
        this.logger.log(`Last sync was only ${hoursElapsed} hours ago. Next auto-sync check is scheduled. (Skipping, ${minutesLeft} mins remaining before 4-hour window).`);
      }
    } catch (error) {
      this.logger.error('Error checking sync status on bootstrap:', error);
    }
  }

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
            details: error instanceof Error ? error.stack || error.message : String(error),
          },
        });
      } catch (dbError) {
        this.logger.error('Failed to write FAILED sync log to database:', dbError);
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
      currentItemTitle: this.currentItemTitle
    };
  }
}

