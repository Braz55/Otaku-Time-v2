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

  async handleTwoWaySync(body: any, userId: number) {
    this.logger.log(`Received Two-Way Sync request for user ID ${userId}. Merging databases...`);
    const { mangasAlterados } = body;

    try {
      // 1. Process Mangas from Mobile -> PC
      if (mangasAlterados && mangasAlterados.length > 0) {
        for (const mobileManga of mangasAlterados) {
          const mangaId = mobileManga.id;

          // Find if user already tracks this manga on the PC
          const userMangaPC = await this.prisma.userManga.findUnique({
            where: { userId_mangaId: { userId, mangaId } },
            include: { manga: true }
          });

          // 1º CADASTRAR SE NÃO EXISTE
          if (!userMangaPC) {
            // Check if the manga exists globally on PC
            let mangaGlobal = await this.prisma.manga.findUnique({
              where: { id: mangaId }
            });

            if (!mangaGlobal) {
              // Fetch manga details from AniList to hydrate the database
              try {
                this.logger.log(`[Sync] Hydrating manga metadata for AniList ID ${mangaId} from AniList API...`);
                const aniListData = await this.mangaService.searchAniListById(mangaId);
                if (aniListData) {
                  const linksJSON = aniListData.externalLinks ? JSON.stringify(aniListData.externalLinks) : null;
                  let totalCaps = aniListData.chapters;
                  const title = aniListData.title.english || aniListData.title.romaji || aniListData.title.native;

                  const bakaRes = await this.mangaService.getLatestChapterFromBakaUpdates(title, aniListData);
                  if (bakaRes && bakaRes.chapter) {
                    totalCaps = bakaRes.chapter;
                  } else if (aniListData.status === 'FINISHED' && aniListData.chapters && aniListData.chapters > 0) {
                    totalCaps = aniListData.chapters;
                  } else {
                    const mdRes = await this.mangaService.getLatestChapterFromMangaDex(aniListData.id, title, aniListData);
                    if (mdRes && mdRes.chapter) {
                      totalCaps = mdRes.chapter;
                    }
                  }

                  if (!totalCaps && aniListData.chapters) {
                    totalCaps = aniListData.chapters;
                  }

                  mangaGlobal = await this.prisma.manga.create({
                    data: {
                      id: aniListData.id,
                      titulo: title,
                      statusLancamento: aniListData.status,
                      generos: aniListData.genres ? aniListData.genres.join(', ') : '',
                      descricao: aniListData.description ? aniListData.description.replace(/<[^>]*>?/gm, '') : '',
                      numCapitulosTotal: totalCaps,
                      capaUrl: aniListData.coverImage?.large,
                      linksExternos: linksJSON
                    }
                  });
                }
              } catch (hydrateError) {
                this.logger.error(`Failed to hydrate manga ${mangaId}:`, hydrateError);
              }
            }

            // Create global entry fallback if still null
            if (!mangaGlobal) {
              mangaGlobal = await this.prisma.manga.upsert({
                where: { id: mangaId },
                update: {},
                create: {
                  id: mangaId,
                  titulo: `Manga #${mangaId}`,
                  statusLancamento: 'UNKNOWN'
                }
              });
            }

            // Create UserManga tracking entry on PC
            await this.prisma.userManga.create({
              data: {
                userId,
                mangaId,
                capAtual: mobileManga.capAtual,
                status: mobileManga.status,
                prioridade: mobileManga.prioridade || 5
              }
            });
          }
          // 2º COMPARAR O PROGRESSO (Maior Capítulo Ganha Sempre)
          else if (mobileManga.capAtual > userMangaPC.capAtual) {
            await this.prisma.userManga.update({
              where: { userId_mangaId: { userId, mangaId } },
              data: {
                capAtual: mobileManga.capAtual,
                status: mobileManga.status,
                prioridade: mobileManga.prioridade || 5
              }
            });
          }
          else if (mobileManga.capAtual < userMangaPC.capAtual) {
            // O PC leu mais longe. Não fazemos nada (o telemóvel vai atualizar-se depois).
          }
          // 3º SE OS CAPÍTULOS FOREM IGUAIS, RESOLVER PELA TUA HIERARQUIA
          else {
            const pc = userMangaPC.status;      // O "1" da tua lógica
            const mob = mobileManga.status; // O "2" da tua lógica

            // Se forem iguais, não faz nada
            if (pc === mob) {
              // Já estão sincronizados, but let's update priority just in case
              if (userMangaPC.prioridade !== mobileManga.prioridade) {
                await this.prisma.userManga.update({
                  where: { userId_mangaId: { userId, mangaId } },
                  data: { prioridade: mobileManga.prioridade }
                });
              }
            }
            // Regra 5: 1 planeado; 2 qualquer estado -> 2 ganha
            else if (pc === 'PLANNED') {
              await this.prisma.userManga.update({
                where: { userId_mangaId: { userId, mangaId } },
                data: {
                  status: mob,
                  prioridade: mobileManga.prioridade || 5
                }
              });
            }
            // Regra 1, 2 e 3: 1 a ver; 2 concluído/dropado/pausado -> 2 ganha
            else if (pc === 'WATCHING' && (mob === 'COMPLETED' || mob === 'DROPPED' || mob === 'PAUSED')) {
              await this.prisma.userManga.update({
                where: { userId_mangaId: { userId, mangaId } },
                data: {
                  status: mob,
                  prioridade: mobileManga.prioridade || 5
                }
              });
            }
            // Regra 4: 1 pausado; 2 a ver -> 2 ganha (O telemóvel despausou a obra!)
            else if (pc === 'PAUSED' && mob === 'WATCHING') {
              await this.prisma.userManga.update({
                where: { userId_mangaId: { userId, mangaId } },
                data: {
                  status: mob,
                  prioridade: mobileManga.prioridade || 5
                }
              });
            }
            // Qualquer outra combinação (ex: PC está Completed e Telemóvel envia Watching)
            else {
              // O PC mantém-se porque o estado atual do PC tem mais "força" na hierarquia
            }
          }
        }
      }

      // Fetch combined database from PC to send back to Mobile
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

