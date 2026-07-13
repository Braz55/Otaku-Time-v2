import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TMDBService } from './tmdb.service';
import { AnimeService } from './anime.service';
import { detectMediaType } from './anime.utils';

@Injectable()
export class TVTimeImportService {
  private readonly logger = new Logger(TVTimeImportService.name);
  private readonly tvTimeImportStatus = new Map<
    number,
    {
      isImporting: boolean;
      total: number;
      processed: number;
      currentShow: string;
      errors: string[];
      importedShows: any[];
    }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdbService: TMDBService,
    @Inject(forwardRef(() => AnimeService))
    private readonly animeService: AnimeService,
  ) {}

  getTvTimeImportStatus(userId: number) {
    return (
      this.tvTimeImportStatus.get(userId) || {
        isImporting: false,
        total: 0,
        processed: 0,
        currentShow: '',
        errors: [],
        importedShows: [],
      }
    );
  }

  async importFromTVTime(userId: number, tvTimeShows: any[]) {
    if (!Array.isArray(tvTimeShows)) {
      throw new Error('Formato inválido. O arquivo JSON deve ser um array.');
    }

    const currentStatus = this.tvTimeImportStatus.get(userId);
    if (currentStatus && currentStatus.isImporting) {
      throw new Error('Já existe uma importação de dados em andamento.');
    }

    this.tvTimeImportStatus.set(userId, {
      isImporting: true,
      total: tvTimeShows.length,
      processed: 0,
      currentShow: 'A iniciar...',
      errors: [],
      importedShows: [],
    });

    // Inicia o processo em background
    this.runTVTimeImportBackground(userId, tvTimeShows).catch((err) => {
      this.logger.error(
        `Erro grave na importação em background do utilizador ${userId}:`,
        err,
      );
    });

    return { message: 'Importação iniciada com sucesso em segundo plano.' };
  }

  private async ensureAnimeExists(tmdbId: number): Promise<boolean> {
    try {
      const existing = await this.prisma.anime.findUnique({
        where: { id: tmdbId },
      });

      const hasEpisodes =
        existing &&
        existing.episodesList &&
        Array.isArray(existing.episodesList) &&
        existing.episodesList.length > 0;
      if (existing && hasEpisodes) return true;

      const tmdbData = await this.animeService.searchAniListById(
        tmdbId,
        undefined,
        existing?.formato || 'TV',
      );
      if (!tmdbData) return false;

      const generosDict: Record<string, number> = {};
      if (tmdbData.genres) {
        tmdbData.genres.forEach((g: string) => {
          generosDict[g.trim()] = 100;
        });
      }

      let details: any = null;
      if (tmdbData.format === 'TV' && tmdbData.id) {
        try {
          details = await this.tmdbService.getTVShowDetails(tmdbData.id);
        } catch (e) {
          this.logger.error(`Error fetching season details during import:`, e);
        }
      }

      const anime = await this.prisma.anime.upsert({
        where: { id: tmdbData.id },
        update: {
          numEpisodiosTotal: tmdbData.episodes,
          capaUrl: tmdbData.coverImage.large,
          statusLancamento: tmdbData.status,
          linksExternos: null,
          proximoEpisodio: tmdbData.nextAiringEpisode?.episode,
          proximoEpisodioData:
            tmdbData.nextAiringEpisode &&
            tmdbData.nextAiringEpisode.airingAt &&
            !isNaN(tmdbData.nextAiringEpisode.airingAt)
              ? new Date(tmdbData.nextAiringEpisode.airingAt * 1000)
              : null,
          generos: generosDict,
          paisOrigem: tmdbData.countryOfOrigin,
          formato: tmdbData.format,
          tipo: detectMediaType(generosDict, tmdbData.format),
          dataLancamento: tmdbData.dataLancamento,
        },
        create: {
          id: tmdbData.id,
          titulo:
            tmdbData.title.english || tmdbData.title.romaji || 'Sem título',
          statusLancamento: tmdbData.status,
          descricao: tmdbData.description,
          generos: generosDict,
          capaUrl: tmdbData.coverImage.large,
          numEpisodiosTotal: tmdbData.episodes,
          temporada: tmdbData.season,
          ano:
            tmdbData.seasonYear && !isNaN(tmdbData.seasonYear)
              ? tmdbData.seasonYear
              : null,
          paisOrigem: tmdbData.countryOfOrigin,
          formato: tmdbData.format,
          tipo: detectMediaType(generosDict, tmdbData.format),
          linksExternos: null,
          proximoEpisodio: tmdbData.nextAiringEpisode?.episode,
          proximoEpisodioData:
            tmdbData.nextAiringEpisode &&
            tmdbData.nextAiringEpisode.airingAt &&
            !isNaN(tmdbData.nextAiringEpisode.airingAt)
              ? new Date(tmdbData.nextAiringEpisode.airingAt * 1000)
              : null,
          dataLancamento: tmdbData.dataLancamento,
        },
      });

      if (details && details.seasons) {
        await this.animeService.syncAnimeEpisodes(tmdbData.id, details.seasons);
      }

      const averageScore = tmdbData.averageScore
        ? tmdbData.averageScore / 10
        : 0;
      const existingMedia = await this.prisma.media.findUnique({
        where: { id: anime.id },
      });
      if (!existingMedia) {
        await this.prisma.media.create({
          data: {
            id: anime.id,
            avaliacao_base: averageScore,
            total_votos_users: 0,
            soma_notas_users: 0,
            avaliacao_geral: averageScore,
          },
        });
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Error in ensureAnimeExists for TMDB ID ${tmdbId}:`,
        err,
      );
      return false;
    }
  }

  private async runTVTimeImportBackground(userId: number, tvTimeShows: any[]) {
    const status = this.tvTimeImportStatus.get(userId);
    if (!status) return;

    for (const show of tvTimeShows) {
      let attempts = 0;
      const maxAttempts = 5;
      let processedSuccessfully = false;

      while (attempts < maxAttempts && !processedSuccessfully) {
        try {
          status.currentShow = show.title || 'Sem título';
          this.tvTimeImportStatus.set(userId, { ...status });

          let tmdbId: number | null = null;

          // 1. Resolver ID pelo TVDB ID
          if (show.id && show.id.tvdb) {
            const resolved = await this.tmdbService.findByTVDBId(
              Number(show.id.tvdb),
            );
            if (resolved) {
              tmdbId = resolved.id;
            }
          }

          // Se falhar, tenta pesquisar pelo título
          if (!tmdbId && show.title) {
            const searchResults = await this.tmdbService.search(show.title);
            if (searchResults && searchResults.length > 0) {
              tmdbId = searchResults[0].id;
            }
          }

          if (!tmdbId) {
            status.errors.push(
              `Não foi possível mapear a série: "${show.title}" (TVDB ID: ${show.id?.tvdb})`,
            );
            processedSuccessfully = true;
            continue;
          }

          // 2. Garantir que a série/anime existe na tabela Anime (e Media)
          const ok = await this.ensureAnimeExists(tmdbId);
          if (!ok) {
            throw new Error(
              `Falha ao obter dados e registar a série: "${show.title}" (TMDB ID: ${tmdbId})`,
            );
          }

          const dbAnime = await this.prisma.anime.findUnique({
            where: { id: tmdbId },
          });
          const totalEpisodes = dbAnime?.numEpisodiosTotal || 0;

          // 3. Processar progresso de visualização
          let maxSeason = 1;
          let maxEpisode = 0;
          let hasWatched = false;
          let watchedCount = 0;

          let jsonMaxSeason = 1;
          let jsonMaxEpisode = 0;

          if (show.seasons && Array.isArray(show.seasons)) {
            for (const season of show.seasons) {
              if (season.is_specials) continue;
              const seasonNum = Number(season.number);
              if (season.episodes && Array.isArray(season.episodes)) {
                for (const ep of season.episodes) {
                  if (ep.special) continue;
                  if (ep.is_watched) {
                    hasWatched = true;
                    watchedCount++;
                    const epNum = Number(ep.number);
                    if (seasonNum > jsonMaxSeason) {
                      jsonMaxSeason = seasonNum;
                      jsonMaxEpisode = epNum;
                    } else if (seasonNum === jsonMaxSeason) {
                      if (epNum > jsonMaxEpisode) {
                        jsonMaxEpisode = epNum;
                      }
                    }
                  }
                }
              }
            }
          }

          // Tentar mapear a contagem total de episódios assistidos à nossa lista local ordenada
          if (
            dbAnime &&
            dbAnime.episodesList &&
            Array.isArray(dbAnime.episodesList) &&
            dbAnime.episodesList.length > 0
          ) {
            // Filtrar especiais (temporada 0) e ordenar por temporada e número de episódio
            const filteredEpisodes = (dbAnime.episodesList as any[])
              .filter((ep) => ep.season > 0)
              .sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episodeNumber - b.episodeNumber;
              });

            if (watchedCount > 0 && filteredEpisodes.length > 0) {
              if (watchedCount <= filteredEpisodes.length) {
                const targetEp = filteredEpisodes[watchedCount - 1];
                maxSeason = targetEp.season;
                maxEpisode = targetEp.episodeNumber;
              } else {
                // Se assistiu a mais episódios do que temos registados, assume o último disponível
                const targetEp = filteredEpisodes[filteredEpisodes.length - 1];
                maxSeason = targetEp.season;
                maxEpisode = targetEp.episodeNumber;
              }
            } else {
              maxSeason = 1;
              maxEpisode = 0;
            }
          } else {
            // Fallback caso não haja episódios registados localmente: usa a maior temporada/episódio obtido do JSON
            maxSeason = jsonMaxSeason;
            maxEpisode = jsonMaxEpisode;
          }

          // 4. Mapear status
          let trackingStatus:
            | 'WATCHING'
            | 'COMPLETED'
            | 'PAUSED'
            | 'DROPPED'
            | 'PLANNED' = 'WATCHING';
          const showStatus = String(show.status || '').toLowerCase();
          const completedAll =
            totalEpisodes > 0 && watchedCount >= totalEpisodes;
          const isReleasing = dbAnime?.statusLancamento === 'RELEASING';

          if (
            (showStatus === 'completed' ||
              showStatus === 'finished' ||
              completedAll) &&
            !isReleasing
          ) {
            trackingStatus = 'COMPLETED';
          } else if (
            showStatus === 'paused' ||
            showStatus === 'pause' ||
            showStatus === 'archived' ||
            showStatus === 'archive'
          ) {
            trackingStatus = 'PAUSED';
          } else if (showStatus === 'watch_later') {
            trackingStatus = 'PLANNED';
          } else if (
            showStatus === 'stopped' ||
            showStatus === 'dropped' ||
            showStatus === 'abandoned'
          ) {
            trackingStatus = 'DROPPED';
          } else if (
            showStatus === 'watching' ||
            showStatus === 'continuing' ||
            showStatus === 'up_to_date' ||
            ((showStatus === 'completed' ||
              showStatus === 'finished' ||
              completedAll) &&
              isReleasing)
          ) {
            trackingStatus = 'WATCHING';
          } else {
            trackingStatus = hasWatched ? 'WATCHING' : 'PLANNED';
          }

          // Se estiver COMPLETED, garante que o progresso está no último episódio da última temporada
          if (
            trackingStatus === 'COMPLETED' &&
            dbAnime &&
            dbAnime.episodesList
          ) {
            const episodesList = dbAnime.episodesList as any[];
            if (episodesList.length > 0) {
              let highestS = 1;
              let highestE = 0;
              for (const ep of episodesList) {
                if (ep.season > highestS) {
                  highestS = ep.season;
                  highestE = ep.episodeNumber;
                } else if (
                  ep.season === highestS &&
                  ep.episodeNumber > highestE
                ) {
                  highestE = ep.episodeNumber;
                }
              }
              maxSeason = highestS;
              maxEpisode = highestE;
            }
          }

          // 5. Upsert UserAnime
          const existingUserAnime = await this.prisma.userAnime.findUnique({
            where: { userId_animeId: { userId, animeId: tmdbId } },
          });

          const globalEpToSave =
            trackingStatus === 'COMPLETED'
              ? totalEpisodes > 0
                ? totalEpisodes
                : watchedCount
              : watchedCount;

          if (existingUserAnime) {
            const isMoreAdvanced = globalEpToSave > existingUserAnime.epAtual;
            const isSameProgress = globalEpToSave === existingUserAnime.epAtual;
            let statusChanged = existingUserAnime.status !== trackingStatus;

            // Se o progresso for o mesmo, não sobrescrevemos status locais mais restritivos (PAUSED/DROPPED) com WATCHING/PLANNED
            if (isSameProgress && statusChanged) {
              if (
                (existingUserAnime.status === 'PAUSED' ||
                  existingUserAnime.status === 'DROPPED') &&
                (trackingStatus === 'WATCHING' || trackingStatus === 'PLANNED')
              ) {
                statusChanged = false;
              }
            }

            if (
              isMoreAdvanced ||
              (isSameProgress && statusChanged) ||
              existingUserAnime.status === 'PLANNED'
            ) {
              await this.prisma.userAnime.update({
                where: { id: existingUserAnime.id },
                data: {
                  seasonAtual: maxSeason,
                  epAtual: globalEpToSave,
                  ...(statusChanged ? { status: trackingStatus } : {}),
                  lastProgressUpdate: new Date(),
                },
              });
            }
          } else {
            await this.prisma.userAnime.create({
              data: {
                userId,
                animeId: tmdbId,
                seasonAtual: maxSeason,
                epAtual: globalEpToSave,
                status: trackingStatus,
                lastProgressUpdate: new Date(),
              },
            });
          }

          const savedUserAnime = await this.prisma.userAnime.findUnique({
            where: { userId_animeId: { userId, animeId: tmdbId } },
            include: { anime: true },
          });

          if (savedUserAnime) {
            const epLocal = this.animeService.getLocalEpisodeNumber(
              savedUserAnime.anime,
              savedUserAnime.seasonAtual,
              savedUserAnime.epAtual,
            );
            const totalEps = this.animeService.getTotalEpisodes(savedUserAnime.anime);
            status.importedShows.push({
              id: savedUserAnime.id,
              animeId: savedUserAnime.animeId,
              titulo: savedUserAnime.anime.titulo,
              capaUrl: savedUserAnime.anime.capaUrl,
              status: savedUserAnime.status,
              seasonAtual: savedUserAnime.seasonAtual,
              epAtual: epLocal,
              numEpisodiosTotal: totalEps,
            });
          } else {
            status.importedShows.push({
              id: 0,
              animeId: tmdbId,
              titulo: show.title || 'Sem título',
              capaUrl: null,
              status: trackingStatus,
              seasonAtual: maxSeason,
              epAtual: maxEpisode,
              numEpisodiosTotal: totalEpisodes,
            });
          }
          processedSuccessfully = true;

          // Pequeno delay para respeitar taxas da API do TMDB
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (err: any) {
          attempts++;
          this.logger.error(
            `Erro ao processar série "${show.title}" (tentativa ${attempts}/${maxAttempts}):`,
            err,
          );
          if (attempts >= maxAttempts) {
            status.errors.push(
              `Erro definitivo na série "${show.title}": ${err.message || err}`,
            );
            processedSuccessfully = true;
          } else {
            status.currentShow = `Erro em ${show.title}. A tentar novamente em 5s... (Tentativa ${attempts}/${maxAttempts})`;
            this.tvTimeImportStatus.set(userId, { ...status });
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      }

      status.processed++;
      this.tvTimeImportStatus.set(userId, { ...status });
    }

    status.isImporting = false;
    status.currentShow = 'Concluído';
    this.tvTimeImportStatus.set(userId, { ...status });

    // Recalcular as estatísticas no final
    try {
      await this.animeService.recalculateUserStats(userId);
    } catch (err) {
      this.logger.error(
        `Erro ao recalcular estatísticas do utilizador ${userId}:`,
        err,
      );
    }
  }
}
