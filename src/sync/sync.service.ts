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

  async handleTwoWaySync(body: any) {
    this.logger.log(`Received Two-Way Sync request from ${body.deviceInfo}. Merging databases...`);
    const { clientAnimes, clientMangas } = body;
    
    const userId = 1;

    try {
      // 1. Process Animes from Mobile -> PC
      if (clientAnimes && clientAnimes.length > 0) {
        for (const localAnime of clientAnimes) {
          await this.prisma.anime.upsert({
            where: { id: localAnime.animeId },
            update: {
              titulo: localAnime.titulo,
              statusLancamento: localAnime.statusLancamento,
              capaUrl: localAnime.capaUrl,
              generos: localAnime.generos,
              descricao: localAnime.descricao,
              numEpisodiosTotal: localAnime.numEpisodiosTotal,
              temporada: localAnime.temporada,
              ano: localAnime.ano,
              linksExternos: localAnime.linksExternos,
              proximoEpisodio: localAnime.proximoEpisodio,
              proximoEpisodioData: localAnime.proximoEpisodioData ? new Date(localAnime.proximoEpisodioData) : null
            },
            create: {
              id: localAnime.animeId,
              titulo: localAnime.titulo,
              statusLancamento: localAnime.statusLancamento,
              capaUrl: localAnime.capaUrl,
              generos: localAnime.generos,
              descricao: localAnime.descricao,
              numEpisodiosTotal: localAnime.numEpisodiosTotal,
              temporada: localAnime.temporada,
              ano: localAnime.ano,
              linksExternos: localAnime.linksExternos,
              proximoEpisodio: localAnime.proximoEpisodio,
              proximoEpisodioData: localAnime.proximoEpisodioData ? new Date(localAnime.proximoEpisodioData) : null
            }
          });

          const existingUserAnime = await this.prisma.userAnime.findUnique({
            where: { userId_animeId: { userId, animeId: localAnime.animeId } }
          });

          const newEpAtual = existingUserAnime ? Math.max(existingUserAnime.epAtual, localAnime.epAtual) : localAnime.epAtual;

          await this.prisma.userAnime.upsert({
            where: { userId_animeId: { userId, animeId: localAnime.animeId } },
            update: {
              epAtual: newEpAtual,
              status: localAnime.status,
              prioridade: localAnime.prioridade || 5,
              linksPersonalizados: localAnime.linksPersonalizados
            },
            create: {
              userId,
              animeId: localAnime.animeId,
              epAtual: localAnime.epAtual,
              status: localAnime.status,
              prioridade: localAnime.prioridade || 5,
              linksPersonalizados: localAnime.linksPersonalizados
            }
          });
        }
      }

      // 2. Process Mangas from Mobile -> PC
      if (clientMangas && clientMangas.length > 0) {
        for (const localManga of clientMangas) {
          await this.prisma.manga.upsert({
            where: { id: localManga.mangaId },
            update: {
              titulo: localManga.titulo,
              statusLancamento: localManga.statusLancamento,
              capaUrl: localManga.capaUrl,
              generos: localManga.generos,
              descricao: localManga.descricao,
              numCapitulosTotal: localManga.numCapitulosTotal,
              linksExternos: localManga.linksExternos,
              proximoCapituloNumero: localManga.proximoCapituloNumero,
              proximoCapituloData: localManga.proximoCapituloData ? new Date(localManga.proximoCapituloData) : null
            },
            create: {
              id: localManga.mangaId,
              titulo: localManga.titulo,
              statusLancamento: localManga.statusLancamento,
              capaUrl: localManga.capaUrl,
              generos: localManga.generos,
              descricao: localManga.descricao,
              numCapitulosTotal: localManga.numCapitulosTotal,
              linksExternos: localManga.linksExternos,
              proximoCapituloNumero: localManga.proximoCapituloNumero,
              proximoCapituloData: localManga.proximoCapituloData ? new Date(localManga.proximoCapituloData) : null
            }
          });

          const existingUserManga = await this.prisma.userManga.findUnique({
            where: { userId_mangaId: { userId, mangaId: localManga.mangaId } }
          });

          const newCapAtual = existingUserManga ? Math.max(existingUserManga.capAtual, localManga.capAtual) : localManga.capAtual;

          await this.prisma.userManga.upsert({
            where: { userId_mangaId: { userId, mangaId: localManga.mangaId } },
            update: {
              capAtual: newCapAtual,
              status: localManga.status,
              prioridade: localManga.prioridade || 5,
              linksPersonalizados: localManga.linksPersonalizados
            },
            create: {
              userId,
              mangaId: localManga.mangaId,
              capAtual: localManga.capAtual,
              status: localManga.status,
              prioridade: localManga.prioridade || 5,
              linksPersonalizados: localManga.linksPersonalizados
            }
          });
        }
      }

      // 3. Fetch combined database from PC to send back to Mobile
      const serverUserAnimes = await this.prisma.userAnime.findMany({
        where: { userId },
        include: { anime: true }
      });
      const serverUserMangas = await this.prisma.userManga.findMany({
        where: { userId },
        include: { manga: true }
      });

      const mergedAnimes = serverUserAnimes.map(ua => ({
        id: ua.animeId,
        userId: ua.userId,
        animeId: ua.animeId,
        titulo: ua.anime.titulo,
        statusLancamento: ua.anime.statusLancamento || '',
        capaUrl: ua.anime.capaUrl || '',
        generos: ua.anime.generos || '',
        descricao: ua.anime.descricao || '',
        status: ua.status,
        epAtual: ua.epAtual,
        numEpisodiosTotal: ua.anime.numEpisodiosTotal,
        temporada: ua.anime.temporada,
        ano: ua.anime.ano,
        prioridade: ua.prioridade,
        linksExternos: ua.anime.linksExternos,
        linksPersonalizados: ua.linksPersonalizados,
        proximoEpisodio: ua.anime.proximoEpisodio,
        proximoEpisodioData: ua.anime.proximoEpisodioData ? ua.anime.proximoEpisodioData.toISOString() : null,
      }));

      const mergedMangas = serverUserMangas.map(um => ({
        id: um.mangaId,
        userId: um.userId,
        mangaId: um.mangaId,
        titulo: um.manga.titulo,
        statusLancamento: um.manga.statusLancamento || '',
        capaUrl: um.manga.capaUrl || '',
        generos: um.manga.generos || '',
        descricao: um.manga.descricao || '',
        status: um.status,
        capAtual: um.capAtual,
        numCapitulosTotal: um.manga.numCapitulosTotal,
        prioridade: um.prioridade,
        linksExternos: um.manga.linksExternos,
        linksPersonalizados: um.linksPersonalizados,
        proximoCapituloNumero: um.manga.proximoCapituloNumero,
        proximoCapituloData: um.manga.proximoCapituloData ? um.manga.proximoCapituloData.toISOString() : null,
      }));

      this.logger.log(`Two-Way Sync complete! Returning ${mergedAnimes.length} Animes and ${mergedMangas.length} Mangas.`);

      return {
        success: true,
        animes: mergedAnimes,
        mangas: mergedMangas
      };
    } catch (err) {
      this.logger.error('Error during two-way sync:', err);
      return { success: false, error: err.message };
    }
  }
}
