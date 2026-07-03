import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';
import { TMDBService } from './tmdb.service';

function buildGenerosDict(
  genres: string[] | undefined,
  tags: { name: string; rank?: number }[] | undefined,
): Record<string, number> {
  const dict: Record<string, number> = {};
  if (genres) {
    genres.forEach((g) => {
      dict[g.trim()] = 100;
    });
  }
  if (tags) {
    tags.forEach((t) => {
      dict[t.name.trim()] = t.rank !== undefined ? t.rank : 100;
    });
  }
  return dict;
}

function hasGenreOrTag(generos: any, target: string): boolean {
  if (!generos) return false;
  if (typeof generos === 'string') {
    return generos.toLowerCase().includes(target.toLowerCase());
  }
  if (typeof generos === 'object') {
    return Object.keys(generos).some(
      (key) => key.toLowerCase() === target.toLowerCase(),
    );
  }
  return false;
}

function normalizeTMDBToAniList(media: any, mediaTypeForce?: 'tv' | 'movie'): any {
  if (!media) return null;
  const isMovie = mediaTypeForce === 'movie' || media.title !== undefined || media.media_type === 'movie';
  
  const title = isMovie ? (media.title || media.original_title) : (media.name || media.original_name);
  const statusMap: Record<string, string> = {
    'Returning Series': 'RELEASING',
    'Ended': 'FINISHED',
    'Released': 'FINISHED',
    'Post Production': 'RELEASING',
    'In Production': 'RELEASING',
  };
  const status = statusMap[media.status] || (media.status ? media.status.toUpperCase() : 'FINISHED');
  
  const releaseDate = isMovie ? media.release_date : media.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  
  const posterPath = media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null;
  const format = isMovie ? 'MOVIE' : 'TV';

  const genres = media.genres ? media.genres.map((g: any) => g.name) : [];
  
  return {
    id: media.id,
    title: {
      english: title,
      romaji: title,
      native: isMovie ? media.original_title : media.original_name,
    },
    coverImage: {
      large: posterPath,
    },
    averageScore: media.vote_average ? Math.round(media.vote_average * 10) : null,
    status,
    description: media.overview || 'Sem descrição.',
    genres,
    tags: [],
    episodes: isMovie ? 1 : (media.number_of_episodes || null),
    season: isMovie ? 'MOVIE' : (year ? 'YEAR' : null),
    seasonYear: year,
    countryOfOrigin: media.origin_country ? media.origin_country[0] : (media.production_countries ? media.production_countries[0]?.iso_3166_1 : null),
    format,
    source: 'TMDB',
    externalLinks: [],
    nextAiringEpisode: media.next_episode_to_air ? {
      airingAt: Math.round(new Date(media.next_episode_to_air.air_date + "T12:00:00Z").getTime() / 1000),
      episode: media.next_episode_to_air.episode_number,
    } : null,
    number_of_seasons: media.number_of_seasons || 1,
    seasons: media.seasons || [],
  };
}

@Injectable()
export class AnimeService {
  private readonly logger = new Logger(AnimeService.name);
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
    private readonly listService: ListService,
    private readonly tmdbService: TMDBService,
  ) {}

  // Busca dados detalhados do TMDB por Nome
  async searchAniList(nomeAnime: string, userId?: number) {
    const results = await this.tmdbService.search(nomeAnime);
    if (results.length === 0) return null;
    const bestMatch = results[0];
    const isMovie = bestMatch.media_type === 'movie';
    try {
      const details = isMovie 
        ? await this.tmdbService.getMovieDetails(bestMatch.id)
        : await this.tmdbService.getTVShowDetails(bestMatch.id);
      return normalizeTMDBToAniList(details, isMovie ? 'movie' : 'tv');
    } catch {
      return null;
    }
  }

  // Busca dados detalhados do TMDB por ID
  async searchAniListById(id: number, userId?: number) {
    let details: any = null;
    let isMovie = false;
    
    try {
      details = await this.tmdbService.getTVShowDetails(id);
    } catch {
      try {
        details = await this.tmdbService.getMovieDetails(id);
        isMovie = true;
      } catch (error) {
        // Both failed. Let's see if we can perform a lazy migration from AniList ID to TMDB ID.
        const localAnime = await this.prisma.anime.findUnique({
          where: { id },
        });
        if (!localAnime) {
          this.logger.error(`Error fetching TMDB details for ID ${id}:`, error);
          return null;
        }

        this.logger.log(`[Migration] Detected AniList ID ${id} for "${localAnime.titulo}". Migrating to TMDB...`);
        const searchResults = await this.tmdbService.search(localAnime.titulo);
        if (searchResults.length === 0) {
          this.logger.error(`[Migration] Could not find any TMDB match for "${localAnime.titulo}".`);
          return null;
        }

        const bestMatch = searchResults[0];
        const tmdbId = bestMatch.id;
        const isTV = bestMatch.media_type === 'tv';

        try {
          details = isTV 
            ? await this.tmdbService.getTVShowDetails(tmdbId)
            : await this.tmdbService.getMovieDetails(tmdbId);
          isMovie = !isTV;
        } catch (e) {
          this.logger.error(`[Migration] Failed to fetch details for new TMDB ID ${tmdbId}:`, e);
          return null;
        }

        // Perform DB updates
        const normalized = normalizeTMDBToAniList(details, isMovie ? 'movie' : 'tv');
        const generosDict: Record<string, number> = {};
        if (normalized.genres) {
          normalized.genres.forEach((g: string) => {
            generosDict[g.trim()] = 100;
          });
        }

        let proximosEpisodiosJson: any[] = [];
        if (!isMovie && details.number_of_seasons > 0) {
          try {
            const latestSeason = details.seasons.filter((s: any) => s.season_number > 0).sort((a: any, b: any) => b.season_number - a.season_number)[0];
            if (latestSeason) {
              const seasonDetails = await this.tmdbService.getTVSeasonDetails(tmdbId, latestSeason.season_number);
              proximosEpisodiosJson = (seasonDetails.episodes || []).map((ep: any) => ({
                season: ep.season_number,
                episode: ep.episode_number,
                airDate: ep.air_date ? new Date(ep.air_date + "T12:00:00Z").toISOString() : null,
                notified: false
              }));
            }
          } catch {}
        }

        // Create new Anime record
        await this.prisma.anime.upsert({
          where: { id: tmdbId },
          update: {},
          create: {
            id: tmdbId,
            titulo: normalized.title.english || normalized.title.romaji,
            statusLancamento: normalized.status,
            descricao: normalized.description,
            generos: generosDict,
            capaUrl: normalized.coverImage.large,
            numEpisodiosTotal: normalized.episodes,
            temporada: normalized.season,
            ano: normalized.seasonYear,
            paisOrigem: normalized.countryOfOrigin,
            formato: normalized.format,
          },
        });

        // Sync episodes of all seasons to the database
        await this.syncAnimeEpisodes(tmdbId, details.seasons);

        // Ensure Media rating exists
        const averageScore = normalized.averageScore ? normalized.averageScore / 10 : 0;
        const existingMedia = await this.prisma.media.findUnique({ where: { id: tmdbId } });
        if (!existingMedia) {
          await this.prisma.media.create({
            data: {
              id: tmdbId,
              avaliacao_base: averageScore,
              total_votos_users: 0,
              soma_notas_users: 0,
              avaliacao_geral: averageScore,
            },
          });
        }

        // Update relations
        await this.prisma.userAnime.updateMany({
          where: { animeId: id },
          data: { animeId: tmdbId },
        });

        await this.prisma.customListItem.updateMany({
          where: { animeId: id },
          data: { anilistMediaId: tmdbId, animeId: tmdbId },
        });

        await this.prisma.comment.updateMany({
          where: { mediaId: id },
          data: { mediaId: tmdbId },
        });

        await this.prisma.userRating.updateMany({
          where: { mediaId: id },
          data: { mediaId: tmdbId },
        });

        await this.prisma.userTopFavorite.updateMany({
          where: { anilistMediaId: id, mediaType: 'ANIME' },
          data: { anilistMediaId: tmdbId },
        });

        // Delete old Anime record and old Media rating
        try {
          await this.prisma.anime.delete({ where: { id } });
          await this.prisma.media.delete({ where: { id } }).catch(() => {});
        } catch (err) {
          this.logger.error(`[Migration] Error deleting old record:`, err);
        }

        // Update local variable so subsequent blocks use the new ID
        id = tmdbId;
      }
    }
    
    const media = normalizeTMDBToAniList(details, isMovie ? 'movie' : 'tv');
    if (!media) return null;
    
    if (!isMovie && details.number_of_seasons > 0) {
      const latestSeason = details.seasons.filter((s: any) => s.season_number > 0).sort((a: any, b: any) => b.season_number - a.season_number)[0];
      if (latestSeason) {
        try {
          const seasonDetails = await this.tmdbService.getTVSeasonDetails(id, latestSeason.season_number);
          const episodesList = seasonDetails.episodes || [];
                    media.relations = {
            edges: details.seasons
              .filter((s: any) => s.season_number >= 0)
              .map((s: any) => ({
                relationType: 'SEASON',
                node: {
                  id: s.id,
                  tvShowId: id,
                  seasonNumber: s.season_number,
                  type: 'ANIME',
                  title: { english: s.name || `Temporada ${s.season_number}` },
                  coverImage: { large: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : media.coverImage.large },
                  episodes: s.episode_count,
                  season: s.name,
                  seasonYear: s.air_date ? new Date(s.air_date).getFullYear() : null,
                  status: media.status,
                  format: 'TV_SEASON'
                }
              }))
          };
        } catch (e) {
          this.logger.error(`Error fetching season details for TV ID ${id}:`, e);
        }
      }
    }

    if (userId) {
      const userAnimes = await this.prisma.userAnime.findMany({
        where: { userId },
      });
      
      const matched = userAnimes.find((ua) => ua.animeId === id);
      media.libraryInfo = matched
        ? {
            id: matched.id,
            status: matched.status,
            seasonAtual: matched.seasonAtual,
            epAtual: matched.epAtual,
            prioridade: matched.prioridade,
            watchedSpecials: matched.watchedSpecials || [],
          }
        : null;
        
      if (media.relations && media.relations.edges) {
        media.relations.edges = media.relations.edges.map((edge: any) => {
          return {
            ...edge,
            node: {
              ...edge.node,
              libraryInfo: matched
                ? {
                    id: matched.id,
                    status: matched.status,
                    seasonAtual: matched.seasonAtual,
                    epAtual: matched.epAtual,
                    isCurrentSeason: matched.seasonAtual === edge.node.seasonNumber
                  }
                : null
            }
          };
        });
      }
    }
    
    const localAnimeRecord = await this.prisma.anime.findUnique({
      where: { id },
    });
    media.databaseEpisodes = localAnimeRecord?.episodesList || [];
    media.tipo = localAnimeRecord ? localAnimeRecord.tipo : 'ANIME';

    return media;
  }

  async getTVSeasonDetails(tvShowId: number, seasonNumber: number) {
    try {
      return await this.tmdbService.getTVSeasonDetails(tvShowId, seasonNumber);
    } catch (e) {
      this.logger.error(`Error fetching season details:`, e);
      return null;
    }
  }

  // Importa para o Catálogo Global e adiciona à lista do utilizador
  async importFromAniList(
    nomeAnime: string,
    userId: number,
    anilistId?: number,
  ) {
    let anime = anilistId
      ? await this.prisma.anime.findUnique({ where: { id: anilistId } })
      : null;

    if (anime) {
      const userAnime = await this.prisma.userAnime.upsert({
        where: { userId_animeId: { userId, animeId: anime.id } },
        update: {},
        create: { userId, animeId: anime.id, status: 'PLANNED', epAtual: 0, seasonAtual: 1 },
        include: { anime: true },
      });

      const rating = await this.prisma.media.findUnique({
        where: { id: anime.id },
      });
      return {
        ...userAnime,
        avaliacaoGeral: rating?.avaliacao_geral ?? null,
        totalVotosUsers: rating?.total_votos_users ?? 0,
      };
    }

    const tmdbId = anilistId;
    const tmdbData = tmdbId
      ? await this.searchAniListById(tmdbId)
      : await this.searchAniList(nomeAnime);
      
    if (!tmdbData) throw new Error('Conteúdo não encontrado no TMDB');

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

    anime = await this.prisma.anime.upsert({
      where: { id: tmdbData.id },
      update: {
        numEpisodiosTotal: tmdbData.episodes,
        capaUrl: tmdbData.coverImage.large,
        statusLancamento: tmdbData.status,
        linksExternos: null,
        proximoEpisodio: tmdbData.nextAiringEpisode?.episode,
        proximoEpisodioData: tmdbData.nextAiringEpisode
          ? new Date(tmdbData.nextAiringEpisode.airingAt * 1000)
          : null,
        generos: generosDict,
        paisOrigem: tmdbData.countryOfOrigin,
        formato: tmdbData.format,
      },
      create: {
        id: tmdbData.id,
        titulo: tmdbData.title.english || tmdbData.title.romaji,
        statusLancamento: tmdbData.status,
        descricao: tmdbData.description,
        generos: generosDict,
        capaUrl: tmdbData.coverImage.large,
        numEpisodiosTotal: tmdbData.episodes,
        temporada: tmdbData.season,
        ano: tmdbData.seasonYear,
        paisOrigem: tmdbData.countryOfOrigin,
        formato: tmdbData.format,
        linksExternos: null,
        proximoEpisodio: tmdbData.nextAiringEpisode?.episode,
        proximoEpisodioData: tmdbData.nextAiringEpisode
          ? new Date(tmdbData.nextAiringEpisode.airingAt * 1000)
          : null,
      },
    });

    if (details && details.seasons) {
      await this.syncAnimeEpisodes(tmdbData.id, details.seasons);
    }

    const averageScore = tmdbData.averageScore ? tmdbData.averageScore / 10 : 0;
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

    const userAnime = await this.prisma.userAnime.upsert({
      where: { userId_animeId: { userId, animeId: anime.id } },
      update: {},
      create: { userId, animeId: anime.id, status: 'PLANNED', epAtual: 0, seasonAtual: 1 },
      include: { anime: true },
    });

    this.recalculateUserStats(userId).catch((err) => {
      this.logger.error('Error recalculating user stats:', err);
    });

    const rating = await this.prisma.media.findUnique({
      where: { id: anime.id },
    });

    return {
      id: userAnime.id,
      animeId: userAnime.animeId,
      titulo: userAnime.anime.titulo,
      statusLancamento: userAnime.anime.statusLancamento,
      capaUrl: userAnime.anime.capaUrl,
      generos: userAnime.anime.generos,
      descricao: userAnime.anime.descricao,
      status: userAnime.status,
      seasonAtual: userAnime.seasonAtual,
      epAtual: userAnime.epAtual,
      numEpisodiosTotal: userAnime.anime.numEpisodiosTotal,
      temporada: userAnime.anime.temporada,
      ano: userAnime.anime.ano,
      prioridade: userAnime.prioridade,
      linksExternos: userAnime.anime.linksExternos,
      linksPersonalizados: userAnime.linksPersonalizados,
      proximoEpisodio: userAnime.anime.proximoEpisodio,
      proximoEpisodioData: userAnime.anime.proximoEpisodioData,
      episodes: userAnime.anime.episodesList || [],
      watchedSpecials: userAnime.watchedSpecials || [],
      tipo: userAnime.anime.tipo,
      updatedAt: userAnime.updatedAt,
      lastProgressUpdate: userAnime.lastProgressUpdate,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async backgroundUpdateAnime(animeId: number, userId: number) {
    try {
      const tmdbData = await this.searchAniListById(animeId);
      if (tmdbData) {
        const generosDict = buildGenerosDict(
          tmdbData.genres,
          undefined,
        );

        let details: any = null;
        if (tmdbData.format === 'TV') {
          try {
            details = await this.tmdbService.getTVShowDetails(animeId);
          } catch (e) {
            this.logger.error(`Error fetching season details during sync:`, e);
          }
        }

        await this.prisma.anime.update({
          where: { id: animeId },
          data: {
            numEpisodiosTotal: tmdbData.episodes,
            capaUrl: tmdbData.coverImage.large,
            statusLancamento: tmdbData.status,
            proximoEpisodio: tmdbData.nextAiringEpisode?.episode,
            proximoEpisodioData: tmdbData.nextAiringEpisode
              ? new Date(tmdbData.nextAiringEpisode.airingAt * 1000)
              : null,
            generos: generosDict,
          },
        });

        if (details && details.seasons) {
          await this.syncAnimeEpisodes(animeId, details.seasons);
        }

        const averageScore = tmdbData.averageScore ? tmdbData.averageScore / 10 : 0;
        const existingMedia = await this.prisma.media.findUnique({
          where: { id: animeId },
        });
        if (!existingMedia) {
          await this.prisma.media.create({
            data: {
              id: animeId,
              avaliacao_base: averageScore,
              total_votos_users: 0,
              soma_notas_users: 0,
              avaliacao_geral: averageScore,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in backgroundUpdateAnime for ID ${animeId}:`,
        error,
      );
    } finally {
      this.recalculateUserStats(userId).catch((err) => {
        this.logger.error('Error recalculating user stats:', err);
      });
    }
  }

  async searchAnimeList(nomeAnime: string, page: number = 1, userId?: number) {
    const results = await this.tmdbService.search(nomeAnime, page);
    
    return results.map((item: any) => {
      const isMovie = item.media_type === 'movie';
      const title = isMovie ? (item.title || item.original_title) : (item.name || item.original_name);
      const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
      
      const statusMap: Record<string, string> = {
        'Returning Series': 'RELEASING',
        'Ended': 'FINISHED',
        'Released': 'FINISHED',
      };
      const status = statusMap[item.status] || 'FINISHED';

      return {
        id: item.id,
        title: {
          romaji: title,
          english: title,
        },
        coverImage: {
          large: posterPath,
        },
        status,
        format: isMovie ? 'MOVIE' : 'TV',
      };
    });
  }

  async findAll(userId: number) {
    const list = await this.prisma.userAnime.findMany({
      where: { userId },
      include: { anime: true },
    });
    const animeIds = list.map((item) => item.animeId);
    const ratings = await this.prisma.media.findMany({
      where: { id: { in: animeIds } },
    });
    const ratingMap = new Map(ratings.map((r) => [r.id, r]));

    return list.map((item) => {
      const rating = ratingMap.get(item.animeId);
      return {
        id: item.id,
        animeId: item.animeId,
        titulo: item.anime.titulo,
        statusLancamento: item.anime.statusLancamento,
        capaUrl: item.anime.capaUrl,
        generos: item.anime.generos,
        descricao: item.anime.descricao,
        status: item.status,
        seasonAtual: item.seasonAtual,
        epAtual: item.epAtual,
        numEpisodiosTotal: item.anime.numEpisodiosTotal,
        temporada: item.anime.temporada,
        ano: item.anime.ano,
        prioridade: item.prioridade,
        linksExternos: item.anime.linksExternos,
        linksPersonalizados: item.linksPersonalizados,
        proximoEpisodio: item.anime.proximoEpisodio,
        proximoEpisodioData: item.anime.proximoEpisodioData,
        tipo: item.anime.tipo,
        watchedSpecials: item.watchedSpecials || [],
        updatedAt: item.updatedAt,
        lastProgressUpdate: item.lastProgressUpdate,
        avaliacaoGeral: rating?.avaliacao_geral ?? null,
        totalVotosUsers: rating?.total_votos_users ?? 0,
      };
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true },
    });
    if (!item) return null;
    const rating = await this.prisma.media.findUnique({
      where: { id: item.animeId },
    });
    return {
      id: item.id,
      animeId: item.animeId,
      titulo: item.anime.titulo,
      statusLancamento: item.anime.statusLancamento,
      capaUrl: item.anime.capaUrl,
      generos: item.anime.generos,
      descricao: item.anime.descricao,
      status: item.status,
      seasonAtual: item.seasonAtual,
      epAtual: item.epAtual,
      numEpisodiosTotal: item.anime.numEpisodiosTotal,
      temporada: item.anime.temporada,
      ano: item.anime.ano,
      prioridade: item.prioridade,
      linksExternos: item.anime.linksExternos,
      linksPersonalizados: item.linksPersonalizados,
      proximoEpisodio: item.anime.proximoEpisodio,
      proximoEpisodioData: item.anime.proximoEpisodioData,
      episodes: item.anime.episodesList || [],
      watchedSpecials: item.watchedSpecials || [],
      tipo: item.anime.tipo,
      updatedAt: item.updatedAt,
      lastProgressUpdate: item.lastProgressUpdate,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async update(id: number, updateDto: any) {
    const atual = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true },
    });
    if (!atual) return null;

    if (updateDto.numEpisodiosTotal !== undefined) {
      const total = updateDto.numEpisodiosTotal;
      const updateData: any = { numEpisodiosTotal: total };
      if (atual.anime.statusLancamento === 'RELEASING') {
        updateData.proximoEpisodio = total + 1;
        atual.anime.proximoEpisodio = total + 1;
      }
      await this.prisma.anime.update({
        where: { id: atual.animeId },
        data: updateData,
      });
      atual.anime.numEpisodiosTotal = total;
    }

    if (updateDto.tipo !== undefined) {
      await this.prisma.anime.update({
        where: { id: atual.animeId },
        data: { tipo: updateDto.tipo },
      });
      atual.anime.tipo = updateDto.tipo;
    }

    const novosDados = { ...updateDto };
    delete novosDados.numEpisodiosTotal;
    delete novosDados.tipo;

    if (updateDto.status !== undefined && atual.status === 'DROPPED') {
      novosDados.wasDropped = true;
    }

    if (updateDto.status === 'COMPLETED') {
      const totalDisponivel =
        atual.anime.statusLancamento === 'RELEASING' &&
        atual.anime.proximoEpisodio
          ? atual.anime.proximoEpisodio - 1
          : atual.anime.numEpisodiosTotal || atual.epAtual;
      novosDados.epAtual = totalDisponivel;
    }

    if (updateDto.epAtual !== undefined) {
      const ep = updateDto.epAtual;
      const totalDisponivel =
        atual.anime.statusLancamento === 'RELEASING' &&
        atual.anime.proximoEpisodio
          ? atual.anime.proximoEpisodio - 1
          : atual.anime.numEpisodiosTotal;

      if (atual.status === 'PLANNED' && ep > 0) novosDados.status = 'WATCHING';
      if (
        atual.status === 'COMPLETED' &&
        totalDisponivel &&
        ep < totalDisponivel
      )
        novosDados.status = 'WATCHING';

      if (
        atual.anime.statusLancamento !== 'RELEASING' &&
        atual.anime.numEpisodiosTotal &&
        ep >= atual.anime.numEpisodiosTotal
      ) {
        novosDados.status = 'COMPLETED';
        novosDados.epAtual = atual.anime.numEpisodiosTotal;
      }
    }

    if (
      novosDados.epAtual !== undefined &&
      novosDados.epAtual > atual.epAtual
    ) {
      novosDados.lastProgressUpdate = new Date();
    }

    const updated = await this.prisma.userAnime.update({
      where: { id },
      data: novosDados,
      include: { anime: true },
    });
    this.recalculateUserStats(updated.userId).catch((err) => {
      console.error('Error recalculating user stats in background:', err);
    });
    const rating = await this.prisma.media.findUnique({
      where: { id: updated.animeId },
    });
    return {
      id: updated.id,
      animeId: updated.animeId,
      titulo: updated.anime.titulo,
      statusLancamento: updated.anime.statusLancamento,
      capaUrl: updated.anime.capaUrl,
      generos: updated.anime.generos,
      descricao: updated.anime.descricao,
      status: updated.status,
      seasonAtual: updated.seasonAtual,
      epAtual: updated.epAtual,
      numEpisodiosTotal: updated.anime.numEpisodiosTotal,
      temporada: updated.anime.temporada,
      ano: updated.anime.ano,
      prioridade: updated.prioridade,
      linksExternos: updated.anime.linksExternos,
      linksPersonalizados: updated.linksPersonalizados,
      proximoEpisodio: updated.anime.proximoEpisodio,
      proximoEpisodioData: updated.anime.proximoEpisodioData,
      episodes: updated.anime.episodesList || [],
      watchedSpecials: updated.watchedSpecials || [],
      tipo: updated.anime.tipo,
      updatedAt: updated.updatedAt,
      lastProgressUpdate: updated.lastProgressUpdate,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async updateLastModified(id: number, date: Date = new Date()) {
    return this.prisma.anime.update({
      where: { id },
      data: { updatedAt: date },
    });
  }

  async remove(id: number) {
    const item = await this.prisma.userAnime.delete({ where: { id } });
    if (item) {
      this.recalculateUserStats(item.userId).catch((err) => {
        console.error('Error recalculating user stats in background:', err);
      });
    }
    return item;
  }

  async searchByGenre(genre: string, page: number = 1, userId?: number) {
    const tvGenreMap: Record<string, number> = {
      'Action': 10759,
      'Adventure': 10759,
      'Comedy': 35,
      'Drama': 18,
      'Fantasy': 10765,
      'Sci-Fi': 10765,
      'Mystery': 9648,
    };
    
    const genreId = tvGenreMap[genre] || 16; // Fallback to Animation (16)
    try {
      const results = await this.tmdbService.discoverTV({
        with_genres: genreId.toString(),
        page: page.toString(),
        sort_by: 'popularity.desc',
      });
      
      const mediaItems = results.results || [];
      return mediaItems.map((item: any) => {
        const title = item.name || item.original_name;
        const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
        return {
          id: item.id,
          title: { english: title, romaji: title },
          coverImage: { large: posterPath },
          genres: [genre],
          format: 'TV',
        };
      });
    } catch {
      return [];
    }
  }

  async syncLatestEpisode(tmdbId: number) {
    const media = await this.searchAniListById(tmdbId);
    if (!media) return { latest: null };

    const dbAnime = await this.prisma.anime.findUnique({
      where: { id: tmdbId },
    });
    if (!dbAnime) return { latest: null };

    let details: any = null;
    if (media.format === 'TV') {
      try {
        details = await this.tmdbService.getTVShowDetails(tmdbId);
      } catch (e) {
        this.logger.error(`Error fetching season details during sync:`, e);
      }
    }

    await this.prisma.anime.update({
      where: { id: tmdbId },
      data: {
        numEpisodiosTotal: media.episodes,
        capaUrl: media.coverImage.large,
        statusLancamento: media.status,
        proximoEpisodio: media.nextAiringEpisode?.episode,
        proximoEpisodioData: media.nextAiringEpisode
          ? new Date(media.nextAiringEpisode.airingAt * 1000)
          : null,
      },
    });

    if (details && details.seasons) {
      await this.syncAnimeEpisodes(tmdbId, details.seasons);
    }

    const updatedAnime = await this.prisma.anime.findUnique({
      where: { id: tmdbId },
    });
    if (!updatedAnime || !updatedAnime.episodesList) {
      return { latest: null, source: 'TMDB', notificationsSent: 0 };
    }

    const episodes = updatedAnime.episodesList as any[];
    let episodesUpdated = false;
    const now = new Date();
    let notificationCount = 0;
    
    const userAnimes = await this.prisma.userAnime.findMany({
      where: {
        animeId: tmdbId,
        status: 'WATCHING',
      },
    });

    for (const ep of episodes) {
      if (ep.airDate) {
        const epDate = new Date(ep.airDate);
        if (now >= epDate && !ep.notified) {
          for (const ua of userAnimes) {
            await this.prisma.notification.create({
              data: {
                userId: ua.userId,
                title: 'Novo episódio de Série/Anime!',
                message: `O episódio ${ep.episodeNumber} da Temporada ${ep.season} de "${dbAnime.titulo}" estreou!`,
                type: 'ANIME',
                mediaId: tmdbId,
              },
            });
          }
          ep.notified = true;
          episodesUpdated = true;
          notificationCount++;
        }
      }
    }

    if (episodesUpdated) {
      await this.prisma.anime.update({
        where: { id: tmdbId },
        data: { episodesList: episodes },
      });
    }

    return { latest: episodes, source: 'TMDB', notificationsSent: notificationCount };
  }

  async recalculateUserStats(userId: number) {
    try {
      const animes = await this.prisma.userAnime.findMany({
        where: { userId },
        include: { anime: true },
      });
      const mangas = await this.prisma.userManga.findMany({
        where: { userId },
        include: { manga: true },
      });

      const totalAnimeCompleted = animes.filter(
        (a) => a.status === 'COMPLETED',
      ).length;
      const totalEpisodesWatched = animes.reduce(
        (sum, a) => sum + (a.epAtual || 0),
        0,
      );
      const totalMangaRead = mangas.reduce(
        (sum, m) => sum + Math.floor(m.capAtual || 0),
        0,
      );
      const animeDaysWasted = parseFloat(
        ((totalEpisodesWatched * 24) / 1440).toFixed(2),
      );
      const mangaDaysWasted = parseFloat(
        ((totalMangaRead * 10) / 1440).toFixed(2),
      );

      await this.prisma.userStatistics.upsert({
        where: { userId },
        update: {
          totalAnimeCompleted,
          totalEpisodesWatched,
          totalMangaRead,
          animeDaysWasted,
          mangaDaysWasted,
        },
        create: {
          userId,
          totalAnimeCompleted,
          totalEpisodesWatched,
          totalMangaRead,
          animeDaysWasted,
          mangaDaysWasted,
        },
      });

      // --- Obter conquistas já desbloqueadas para evitar chamadas de BD desnecessárias ---
      const unlockedAchievements = await this.prisma.userAchievement.findMany({
        where: { userId },
      });
      const unlockedSet = new Set(
        unlockedAchievements.map((ua) => ua.achievementId),
      );

      const awardAchievement = async (achievementId: number) => {
        if (!unlockedSet.has(achievementId)) {
          try {
            await this.prisma.userAchievement.create({
              data: { userId, achievementId },
            });
            unlockedSet.add(achievementId);
          } catch (e) {
            console.error(`Error creating achievement ${achievementId}:`, e);
          }
        }
      };

      // --- Conquistas automáticas ---
      // 1. Primeiros passos: sempre obtido
      await awardAchievement(1);

      // 2. Maratonista (ex: mais de 100 episódios no total)
      if (totalEpisodesWatched >= 100) {
        await awardAchievement(3);
      }

      // 3. Leitor Voraz (se leu o primeiro capítulo)
      if (totalMangaRead >= 1) {
        await awardAchievement(4);
      }

      // 4. Isekai Trash: Se viu 5+ animes do género "Isekai"
      // Reutiliza o array 'animes' em memória em vez de fazer nova consulta redundante
      const completedAnimes = animes.filter((ua) => ua.status === 'COMPLETED');
      const isekaiCount = completedAnimes.filter((ua) =>
        hasGenreOrTag(ua.anime.generos, 'isekai'),
      ).length;
      if (isekaiCount >= 5) {
        await awardAchievement(2);
      }

      // 5. Crítico de Elite: se definiu 3 destaques no pódio
      const favoritesCount = await this.prisma.userTopFavorite.count({
        where: { userId },
      });
      if (favoritesCount >= 3) {
        await awardAchievement(5);
      }

      // 6-9: A Vítima do Camião-kun (Isekai - Anime)
      const allIsekaiAnimesCount = animes.filter((ua) =>
        hasGenreOrTag(ua.anime.generos, 'isekai'),
      ).length;
      if (allIsekaiAnimesCount >= 3) await awardAchievement(6);
      if (allIsekaiAnimesCount >= 6) await awardAchievement(7);
      if (allIsekaiAnimesCount >= 12) await awardAchievement(8);
      if (allIsekaiAnimesCount >= 18) await awardAchievement(9);

      // 10-13: Isekai de Bolso (Isekai - Mangá)
      const allIsekaiMangasCount = mangas.filter((um) =>
        hasGenreOrTag(um.manga.generos, 'isekai'),
      ).length;
      if (allIsekaiMangasCount >= 3) await awardAchievement(10);
      if (allIsekaiMangasCount >= 6) await awardAchievement(11);
      if (allIsekaiMangasCount >= 12) await awardAchievement(12);
      if (allIsekaiMangasCount >= 18) await awardAchievement(13);

      // 14-17: Resina Esgotada (Binge Watching - Anime)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentAnimes = animes.filter((a) => a.updatedAt >= oneWeekAgo);
      const recentHoursWatched = recentAnimes.reduce(
        (sum, a) => sum + ((a.epAtual || 0) * 24) / 60,
        0,
      );
      if (recentHoursWatched >= 4) await awardAchievement(14);
      if (recentHoursWatched >= 8) await awardAchievement(15);
      if (recentHoursWatched >= 12) await awardAchievement(16);
      if (recentHoursWatched >= 24) await awardAchievement(17);

      // 18-21: Luz Acesa (Binge Reading - Mangá)
      const recentMangas = mangas.filter((m) => m.updatedAt >= oneWeekAgo);
      const recentHoursRead = recentMangas.reduce(
        (sum, m) => sum + ((m.capAtual || 0) * 10) / 60,
        0,
      );
      if (recentHoursRead >= 4) await awardAchievement(18);
      if (recentHoursRead >= 8) await awardAchievement(19);
      if (recentHoursRead >= 12) await awardAchievement(20);
      if (recentHoursRead >= 24) await awardAchievement(21);

      // 22-23: Culto da Madrugada
      const now = new Date();
      const currentHour = now.getHours();
      if (currentHour >= 3 && currentHour < 5) {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const updatedAnimeRecently = animes.some(
          (a) => a.updatedAt >= fiveMinsAgo,
        );
        if (updatedAnimeRecently) {
          await awardAchievement(22);
        }
        const updatedMangaRecently = mangas.some(
          (m) => m.updatedAt >= fiveMinsAgo,
        );
        if (updatedMangaRecently) {
          await awardAchievement(23);
        }
      }

      // 24-27: Protagonista em Bulking (Sports/Action - Anime)
      const completedBulkingAnimes = animes.filter(
        (ua) =>
          ua.status === 'COMPLETED' &&
          (hasGenreOrTag(ua.anime.generos, 'sports') ||
            hasGenreOrTag(ua.anime.generos, 'action') ||
            hasGenreOrTag(ua.anime.generos, 'desporto') ||
            hasGenreOrTag(ua.anime.generos, 'ação')),
      ).length;
      if (completedBulkingAnimes >= 3) await awardAchievement(24);
      if (completedBulkingAnimes >= 6) await awardAchievement(25);
      if (completedBulkingAnimes >= 12) await awardAchievement(26);
      if (completedBulkingAnimes >= 18) await awardAchievement(27);

      // 28-31: Protagonista em Bulking (Sports/Action - Mangá)
      const completedBulkingMangas = mangas.filter(
        (um) =>
          um.status === 'COMPLETED' &&
          (hasGenreOrTag(um.manga.generos, 'sports') ||
            hasGenreOrTag(um.manga.generos, 'action') ||
            hasGenreOrTag(um.manga.generos, 'desporto') ||
            hasGenreOrTag(um.manga.generos, 'ação')),
      ).length;
      if (completedBulkingMangas >= 3) await awardAchievement(28);
      if (completedBulkingMangas >= 6) await awardAchievement(29);
      if (completedBulkingMangas >= 12) await awardAchievement(30);
      if (completedBulkingMangas >= 18) await awardAchievement(31);

      // 32-35: Síndrome de Shoujo (Romance/Drama - Anime)
      const completedRomanceAnimes = animes.filter(
        (ua) =>
          ua.status === 'COMPLETED' &&
          (hasGenreOrTag(ua.anime.generos, 'romance') ||
            hasGenreOrTag(ua.anime.generos, 'drama') ||
            hasGenreOrTag(ua.anime.generos, 'shoujo')),
      ).length;
      if (completedRomanceAnimes >= 3) await awardAchievement(32);
      if (completedRomanceAnimes >= 6) await awardAchievement(33);
      if (completedRomanceAnimes >= 12) await awardAchievement(34);
      if (completedRomanceAnimes >= 18) await awardAchievement(35);

      // 36-39: Síndrome de Shoujo (Romance/Drama - Mangá)
      const completedRomanceMangas = mangas.filter(
        (um) =>
          um.status === 'COMPLETED' &&
          (hasGenreOrTag(um.manga.generos, 'romance') ||
            hasGenreOrTag(um.manga.generos, 'drama') ||
            hasGenreOrTag(um.manga.generos, 'shoujo')),
      ).length;
      if (completedRomanceMangas >= 3) await awardAchievement(36);
      if (completedRomanceMangas >= 6) await awardAchievement(37);
      if (completedRomanceMangas >= 12) await awardAchievement(38);
      if (completedRomanceMangas >= 18) await awardAchievement(39);

      // 40: Nostalgia Pura (Anime)
      const nostalgiaAnimesCount = animes.filter(
        (ua) =>
          ua.status === 'COMPLETED' && ua.anime.ano && ua.anime.ano < 2000,
      ).length;
      if (nostalgiaAnimesCount >= 5) {
        await awardAchievement(40);
      }

      // 41: Nostalgia Pura (Mangá)
      const nostalgiaMangasCount = mangas.filter(
        (um) =>
          um.status === 'COMPLETED' &&
          (/(?:198\d|199\d)\b/.test(um.manga.descricao || '') ||
            um.manga.titulo.toLowerCase().includes('dragon ball') ||
            um.manga.titulo.toLowerCase().includes('berserk') ||
            um.manga.titulo.toLowerCase().includes('evangelion') ||
            um.manga.titulo.toLowerCase().includes('slam dunk')),
      ).length;
      if (nostalgiaMangasCount >= 5) {
        await awardAchievement(41);
      }

      // 42: Tsundere Assumido (Anime)
      const tsundereAnimes = animes.filter(
        (ua) => ua.status === 'COMPLETED' && ua.wasDropped,
      ).length;
      if (tsundereAnimes >= 1) {
        await awardAchievement(42);
      }

      // 43: Tsundere Assumido (Mangá)
      const tsundereMangas = mangas.filter(
        (um) => um.status === 'COMPLETED' && um.wasDropped,
      ).length;
      if (tsundereMangas >= 1) {
        await awardAchievement(43);
      }

      // 46: O Arconte da Leitura
      if (totalMangaRead >= totalEpisodesWatched * 2 && totalMangaRead > 0) {
        await awardAchievement(46);
      }
    } catch (e) {
      console.error('Error recalculating user statistics/achievements:', e);
    }
  }

  async getGenreTags() {
    return this.prisma.genreTag.findMany({
      orderBy: [
        { type: 'asc' },
        { category: 'asc' },
        { subcategory: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async getRecommendations(
    type: 'ANIME' | 'MANGA',
    userId: number,
    page: number = 1,
  ) {
    let userLibraryIds = new Set<number>();
    let userLibraryTitles = new Set<string>();
    let userInteractedItems: {
      generos: any;
      status: string;
      paisOrigem: string | null;
    }[] = [];

    if (type === 'ANIME') {
      const userAnimes = await this.prisma.userAnime.findMany({
        where: { userId },
        include: { anime: true },
      });
      userLibraryIds = new Set<number>(userAnimes.map((ua) => ua.animeId));
      userLibraryTitles = new Set<string>(userAnimes.map((ua) => ua.anime?.titulo?.toLowerCase() || ''));
      userInteractedItems = userAnimes.map((ua) => ({
        generos: ua.anime?.generos,
        status: ua.status,
        paisOrigem: ua.anime?.paisOrigem || null,
      }));
    } else {
      const userMangas = await this.prisma.userManga.findMany({
        where: { userId },
        include: { manga: true },
      });
      userLibraryIds = new Set<number>(userMangas.map((um) => um.mangaId));
      userInteractedItems = userMangas.map((um) => ({
        generos: um.manga?.generos,
        status: um.status,
        paisOrigem: um.manga?.paisOrigem || null,
      }));
    }

    const tasteScores: Record<string, number> = {};
    userInteractedItems.forEach((item) => {
      if (!item.generos) return;

      let genresObj: Record<string, number> = {};
      if (typeof item.generos === 'string') {
        item.generos
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((g) => {
            genresObj[g] = 100;
          });
      } else if (typeof item.generos === 'object') {
        genresObj = item.generos as Record<string, number>;
      }

      let multiplier = 1.0;
      if (item.status === 'COMPLETED') multiplier = 1.5;
      else if (item.status === 'DROPPED') multiplier = 0.3;
      else if (item.status === 'PAUSED') multiplier = 0.5;

      Object.entries(genresObj).forEach(([tag, weight]) => {
        const score = (typeof weight === 'number' ? weight : 100) * multiplier;
        tasteScores[tag] = (tasteScores[tag] || 0) + score;
      });
    });

    const sortedTastes = Object.entries(tasteScores)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    const allDbGenresTags = await this.prisma.genreTag.findMany({
      select: { name: true, type: true },
    });
    const dbGenreNames = allDbGenresTags
      .filter((gt) => gt.type === 'GENRE')
      .map((gt) => gt.name);
    const dbAllNames = allDbGenresTags.map((gt) => gt.name);

    const unexploredTastes = dbAllNames.filter((name) => !tasteScores[name]);

    const discoveryTastes: string[] = [];
    if (unexploredTastes.length > 0) {
      const index1 = Math.floor(Math.random() * unexploredTastes.length);
      discoveryTastes.push(unexploredTastes[index1]);
      if (unexploredTastes.length > 1) {
        const index2 = (index1 + 1) % unexploredTastes.length;
        discoveryTastes.push(unexploredTastes[index2]);
      }
    }

    // Calcular o país de preferência com base nos itens da biblioteca
    const countryCounts: Record<string, number> = {};
    userInteractedItems.forEach((item) => {
      if (item.paisOrigem) {
        countryCounts[item.paisOrigem] =
          (countryCounts[item.paisOrigem] || 0) + 1;
      }
    });

    let preferredCountry: string | undefined = undefined;
    const sortedCountries = Object.entries(countryCounts).sort(
      (a, b) => b[1] - a[1],
    );
    if (sortedCountries.length > 0 && sortedCountries[0][1] > 0) {
      preferredCountry = sortedCountries[0][0];
    }

    // Helper para extrair coocorrências de tags baseadas nos itens que contêm um gosto âncora
    const buildProfileForAnchor = (
      anchor: string,
      excludeTastes: string[] = [],
    ) => {
      if (!anchor) return [];

      const coCounts: Record<string, number> = {};
      userInteractedItems.forEach((item) => {
        if (!item.generos) return;

        let genresObj: Record<string, number> = {};
        if (typeof item.generos === 'string') {
          item.generos
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((g) => {
              genresObj[g] = 100;
            });
        } else if (typeof item.generos === 'object') {
          genresObj = item.generos as Record<string, number>;
        }

        if (genresObj[anchor]) {
          let multiplier = 1.0;
          if (item.status === 'COMPLETED') multiplier = 1.5;
          else if (item.status === 'DROPPED') multiplier = 0.3;
          else if (item.status === 'PAUSED') multiplier = 0.5;

          Object.keys(genresObj).forEach((tag) => {
            if (tag !== anchor) {
              const weight = genresObj[tag];
              const score =
                (typeof weight === 'number' ? weight : 100) * multiplier;
              coCounts[tag] = (coCounts[tag] || 0) + score;
            }
          });
        }
      });

      const sortedCo = Object.entries(coCounts)
        .filter((entry) => !excludeTastes.includes(entry[0]))
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0]);

      return [anchor, ...sortedCo.slice(0, 3)];
    };

    // Construção de Perfis Temáticos Combinados
    const profile1 = sortedTastes[0]
      ? buildProfileForAnchor(sortedTastes[0])
      : [];
    const profile2 = sortedTastes[1]
      ? buildProfileForAnchor(sortedTastes[1], profile1)
      : [];
    const profile3 = sortedTastes[2]
      ? buildProfileForAnchor(sortedTastes[2], [...profile1, ...profile2])
      : [];

    console.log(
      `\x1b[35m[Recomendações - ${type}]\x1b[0m Utilizador ID: ${userId}`,
    );
    console.log(
      `  -> País de preferência (Preferred Country):`,
      preferredCountry || 'Nenhum',
    );
    console.log(`  -> Perfil Temático 1 (Profile 1):`, profile1);
    console.log(`  -> Perfil Temático 2 (Profile 2):`, profile2);
    console.log(`  -> Perfil Temático 3 (Profile 3):`, profile3);
    console.log(`  -> Gostos para Descoberta (Discovery):`, discoveryTastes);

    let isAdult: boolean | undefined = false;
    const userObj = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (userObj && userObj.showAdultContent) {
      isAdult = undefined;
    }

    // Helper para classificar e reordenar localmente de acordo com a quantidade de tags coincidentes
    const rankPoolByProfile = (pool: any[], profile: string[]) => {
      if (profile.length === 0) return pool;
      return pool
        .map((item) => {
          let overlap = 0;
          const itemGenres = item.genres || [];
          const itemTags = (item.tags || []).map((t: any) => t.name);
          const itemAllTastes = [...itemGenres, ...itemTags];

          profile.forEach((taste) => {
            if (itemAllTastes.includes(taste)) {
              overlap++;
            }
          });

          return { item, overlap };
        })
        .sort((a, b) => b.overlap - a.overlap)
        .map((entry) => entry.item);
    };

    const fetchCandidatePoolForProfile = async (
      profile: string[],
      sort: string = 'POPULARITY_DESC',
      country?: string,
    ) => {
      if (!profile || profile.length === 0) return [];

      const genres = profile.filter((t) => dbGenreNames.includes(t));
      const tags = profile.filter((t) => !dbGenreNames.includes(t));

      const rawCandidates = await this.fetchCandidatesFromAniList(
        type,
        genres.length > 0 ? genres : undefined,
        tags.length > 0 ? tags : undefined,
        sort,
        isAdult,
        country,
      );

      return rankPoolByProfile(rawCandidates, profile);
    };

    const fetchCandidatePool = async (
      genres?: string[],
      tags?: string[],
      sort: string = 'POPULARITY_DESC',
      country?: string,
    ) => {
      return this.fetchCandidatesFromAniList(
        type,
        genres,
        tags,
        sort,
        isAdult,
        country,
      );
    };

    const [
      poolPrimary1,
      poolPrimary2,
      poolSecondary1,
      poolDiscovery,
      poolGlobal,
    ] = await Promise.all([
      profile1.length > 0
        ? fetchCandidatePoolForProfile(
            profile1,
            'TRENDING_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      profile2.length > 0
        ? fetchCandidatePoolForProfile(
            profile2,
            'POPULARITY_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      profile3.length > 0
        ? fetchCandidatePoolForProfile(
            profile3,
            'POPULARITY_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      discoveryTastes[0]
        ? fetchCandidatePool(
            dbGenreNames.includes(discoveryTastes[0])
              ? [discoveryTastes[0]]
              : undefined,
            !dbGenreNames.includes(discoveryTastes[0])
              ? [discoveryTastes[0]]
              : undefined,
            'TRENDING_DESC',
          )
        : Promise.resolve([]),
      fetchCandidatePool(
        undefined,
        undefined,
        'TRENDING_DESC',
        preferredCountry,
      ),
    ]);

    const allCandidates: any[] = [];
    const maxLen = Math.max(
      poolPrimary1.length,
      poolPrimary2.length,
      poolSecondary1.length,
      poolDiscovery.length,
      poolGlobal.length,
    );

    const addedIds = new Set<number>();

    for (let i = 0; i < maxLen; i++) {
      const candidatesInRound = [
        poolPrimary1[i],
        poolPrimary2[i],
        poolSecondary1[i],
        poolGlobal[i],
        poolDiscovery[i],
      ].filter(Boolean);

      candidatesInRound.forEach((item) => {
        const titleEn = (item.title?.english || '').toLowerCase();
        const titleRo = (item.title?.romaji || '').toLowerCase();
        const alreadyInLibrary =
          userLibraryIds.has(item.id) ||
          (type === 'ANIME' &&
            (userLibraryTitles.has(titleEn) || userLibraryTitles.has(titleRo)));

        if (!alreadyInLibrary && !addedIds.has(item.id)) {
          allCandidates.push(item);
          addedIds.add(item.id);
        }
      });
    }

    if (allCandidates.length === 0) {
      poolGlobal.forEach((item) => {
        const titleEn = (item.title?.english || '').toLowerCase();
        const titleRo = (item.title?.romaji || '').toLowerCase();
        const alreadyInLibrary =
          userLibraryIds.has(item.id) ||
          (type === 'ANIME' &&
            (userLibraryTitles.has(titleEn) || userLibraryTitles.has(titleRo)));

        if (!alreadyInLibrary && !addedIds.has(item.id)) {
          allCandidates.push(item);
          addedIds.add(item.id);
        }
      });
    }

    const perPage = 24;
    const startIndex = (page - 1) * perPage;
    return allCandidates.slice(startIndex, startIndex + perPage);
  }

  private async fetchCandidatesFromAniList(
    type: 'ANIME' | 'MANGA',
    genres?: string[],
    tags?: string[],
    sort: string = 'POPULARITY_DESC',
    isAdult?: boolean,
    country?: string,
  ): Promise<any[]> {
    const query = `
      query ($genres: [String], $tags: [String], $sort: [MediaSort], $isAdult: Boolean, $type: MediaType, $country: CountryCode) {
        Page(page: 1, perPage: 25) {
          media(genre_in: $genres, tag_in: $tags, type: $type, sort: $sort, isAdult: $isAdult, countryOfOrigin: $country) {
            id
            title { english romaji native }
            coverImage { large }
            genres
            tags { name }
            averageScore
            description
            episodes
            chapters
            status
          }
        }
      }
    `;

    const variables: any = {
      type,
      sort: [sort],
      isAdult,
    };

    if (genres && genres.length > 0) variables.genres = genres;
    if (tags && tags.length > 0) variables.tags = tags;
    if (country) variables.country = country;

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      console.error('Error fetching candidates from AniList:', error);
      return [];
    }
  }

  async explore(
    type: 'ANIME' | 'MANGA' = 'ANIME',
    genres?: string[],
    tags?: string[],
    year?: number,
    season?: string,
    format?: string,
    status?: string,
    source?: string,
    country?: string,
    sort: string = 'TRENDING_DESC',
    page: number = 1,
    userId?: number,
  ) {
    if (sort === 'RECOMMENDED') {
      if (!userId) return [];
      return this.getRecommendations(type, userId, page);
    }

    if (type === 'ANIME') {
      const tvGenreMap: Record<string, number> = {
        'Action': 10759,
        'Adventure': 10759,
        'Comedy': 35,
        'Drama': 18,
        'Fantasy': 10765,
        'Sci-Fi': 10765,
        'Mystery': 9648,
      };
      
      const isMovieFormat = format === 'MOVIE';
      const params: Record<string, string> = {
        page: page.toString(),
      };
      
      if (genres && genres.length > 0) {
        const genreId = tvGenreMap[genres[0]];
        if (genreId) {
          params.with_genres = genreId.toString();
        }
      }
      
      if (year) {
        if (isMovieFormat) {
          params.primary_release_year = year.toString();
        } else {
          params.first_air_date_year = year.toString();
        }
      }
      
      if (sort === 'POPULARITY_DESC' || sort === 'TRENDING_DESC') {
        params.sort_by = 'popularity.desc';
      } else if (sort === 'SCORE_DESC') {
        params.sort_by = 'vote_average.desc';
      }
      
      try {
        const results = isMovieFormat 
          ? await this.tmdbService.discoverMovies(params)
          : await this.tmdbService.discoverTV(params);
        
        const mediaItems = results.results || [];
        return mediaItems.map((item: any) => {
          const title = isMovieFormat ? (item.title || item.original_title) : (item.name || item.original_name);
          const posterPath = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
          return {
            id: item.id,
            title: { english: title, romaji: title },
            coverImage: { large: posterPath },
            genres: genres || [],
            format: isMovieFormat ? 'MOVIE' : 'TV',
            status: 'FINISHED',
          };
        });
      } catch (error) {
        this.logger.error('Error in TMDB explore discover:', error);
        return [];
      }
    }

    let isAdult: boolean | undefined = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.showAdultContent) {
        isAdult = undefined;
      }
    }

    const query = `
      query (
        $genres: [String], 
        $tags: [String], 
        $sort: [MediaSort], 
        $page: Int, 
        $isAdult: Boolean, 
        $type: MediaType, 
        $seasonYear: Int, 
        $season: MediaSeason, 
        $format: MediaFormat, 
        $status: MediaStatus, 
        $source: MediaSource,
        $country: CountryCode
      ) {
        Page(page: $page, perPage: 24) {
          media(
            genre_in: $genres, 
            tag_in: $tags, 
            type: $type, 
            sort: $sort, 
            isAdult: $isAdult, 
            seasonYear: $seasonYear, 
            season: $season, 
            format: $format, 
            status: $status, 
            source: $source,
            countryOfOrigin: $country
          ) {
            id
            title { english romaji native }
            coverImage { large }
            genres
            tags { name }
            averageScore
            description
            episodes
            chapters
            status
          }
        }
      }
    `;

    const variables: any = {
      type,
      sort: [sort],
      page,
      isAdult,
    };

    if (genres && genres.length > 0) {
      variables.genres = genres;
    }
    if (tags && tags.length > 0) {
      variables.tags = tags;
    }
    if (year) {
      variables.seasonYear = year;
    }
    if (season && season !== 'Any') {
      variables.season = season;
    }
    if (format && format !== 'Any') {
      variables.format = format;
    }
    if (status && status !== 'Any') {
      variables.status = status;
    }
    if (source && source !== 'Any') {
      variables.source = source;
    }
    if (country && country !== 'Any') {
      variables.country = country;
    }

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      this.logger.error('Error in explore query:', error);
    }
  }

  async syncAnimeEpisodes(animeId: number, detailsSeasons: any[]) {
    try {
      const anime = await this.prisma.anime.findUnique({
        where: { id: animeId },
      });
      if (!anime) {
        this.logger.warn(`Anime ID ${animeId} not found in DB, skipping episodes sync.`);
        return;
      }

      // Map to keep track of already notified episodes
      const existingNotifiedMap = new Map<string, boolean>();
      if (anime.episodesList) {
        try {
          const list = anime.episodesList as any[];
          list.forEach((ep: any) => {
            const key = `${ep.season}-${ep.episodeNumber}`;
            existingNotifiedMap.set(key, !!ep.notified);
          });
        } catch (e) {
          this.logger.error(`Error parsing existing episodes list for anime ID ${animeId}:`, e);
        }
      }

      const activeSeasons = (detailsSeasons || [])
        .filter((s: any) => s.season_number >= 0)
        .sort((a: any, b: any) => a.season_number - b.season_number);
        
      let globalCounter = 0;
      const episodesList: any[] = [];
      
      for (const season of activeSeasons) {
        let seasonDetails: any = null;
        try {
          seasonDetails = await this.tmdbService.getTVSeasonDetails(animeId, season.season_number);
          // Pequeno delay entre temporadas para evitar sobrecarregar a API
          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (err) {
          this.logger.error(`Error fetching season ${season.season_number} details for TV ID ${animeId}:`, err);
          continue;
        }
        
        if (!seasonDetails || !seasonDetails.episodes) continue;
        
        const sortedEpisodes = [...seasonDetails.episodes].sort((a: any, b: any) => a.episode_number - b.episode_number);
        
        for (const ep of sortedEpisodes) {
          let globalEpNum: number | null = null;
          if (season.season_number > 0) {
            globalCounter++;
            globalEpNum = globalCounter;
          }
          const airDateVal = ep.air_date ? new Date(ep.air_date + "T12:00:00Z").toISOString() : null;
          const key = `${ep.season_number}-${ep.episode_number}`;
          const isNotified = existingNotifiedMap.get(key) || false;

          episodesList.push({
            season: ep.season_number,
            episodeNumber: ep.episode_number,
            globalEpisodeNumber: globalEpNum,
            name: ep.name || null,
            airDate: airDateVal,
            stillPath: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
            notified: isNotified,
          });
        }
      }
      
      await this.prisma.anime.update({
        where: { id: animeId },
        data: { episodesList },
      });

      this.logger.log(`Successfully synced ${globalCounter} episodes in JSON for anime ID ${animeId}`);
    } catch (err) {
      this.logger.error(`Error in syncAnimeEpisodes for anime ID ${animeId}:`, err);
    }
  }

  getTvTimeImportStatus(userId: number) {
    return this.tvTimeImportStatus.get(userId) || { isImporting: false, total: 0, processed: 0, currentShow: '', errors: [], importedShows: [] };
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
      this.logger.error(`Erro grave na importação em background do utilizador ${userId}:`, err);
    });

    return { message: 'Importação iniciada com sucesso em segundo plano.' };
  }

  private async ensureAnimeExists(tmdbId: number): Promise<boolean> {
    try {
      const existing = await this.prisma.anime.findUnique({ where: { id: tmdbId } });
      if (existing) return true;

      const tmdbData = await this.searchAniListById(tmdbId);
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
          proximoEpisodioData: tmdbData.nextAiringEpisode
            ? new Date(tmdbData.nextAiringEpisode.airingAt * 1000)
            : null,
          generos: generosDict,
          paisOrigem: tmdbData.countryOfOrigin,
          formato: tmdbData.format,
        },
        create: {
          id: tmdbData.id,
          titulo: tmdbData.title.english || tmdbData.title.romaji,
          statusLancamento: tmdbData.status,
          descricao: tmdbData.description,
          generos: generosDict,
          capaUrl: tmdbData.coverImage.large,
          numEpisodiosTotal: tmdbData.episodes,
          temporada: tmdbData.season,
          ano: tmdbData.seasonYear,
          paisOrigem: tmdbData.countryOfOrigin,
          formato: tmdbData.format,
          linksExternos: null,
          proximoEpisodio: tmdbData.nextAiringEpisode?.episode,
          proximoEpisodioData: tmdbData.nextAiringEpisode
            ? new Date(tmdbData.nextAiringEpisode.airingAt * 1000)
            : null,
        },
      });

      if (details && details.seasons) {
        await this.syncAnimeEpisodes(tmdbData.id, details.seasons);
      }

      const averageScore = tmdbData.averageScore ? tmdbData.averageScore / 10 : 0;
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
      this.logger.error(`Error in ensureAnimeExists for TMDB ID ${tmdbId}:`, err);
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
            const resolved = await this.tmdbService.findByTVDBId(Number(show.id.tvdb));
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
            status.errors.push(`Não foi possível mapear a série: "${show.title}" (TVDB ID: ${show.id?.tvdb})`);
            processedSuccessfully = true;
            continue;
          }

          // 2. Garantir que a série/anime existe na tabela Anime (e Media)
          const ok = await this.ensureAnimeExists(tmdbId);
          if (!ok) {
            throw new Error(`Falha ao obter dados e registar a série: "${show.title}" (TMDB ID: ${tmdbId})`);
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
                    if (seasonNum > maxSeason) {
                      maxSeason = seasonNum;
                      maxEpisode = epNum;
                    } else if (seasonNum === maxSeason) {
                      if (epNum > maxEpisode) {
                        maxEpisode = epNum;
                      }
                    }
                  }
                }
              }
            }
          }

          // 4. Mapear status
          let trackingStatus: 'WATCHING' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'PLANNED' = 'WATCHING';
          const showStatus = String(show.status || '').toLowerCase();
          const completedAll = totalEpisodes > 0 && watchedCount >= totalEpisodes;

          if (showStatus === 'completed' || completedAll) {
            trackingStatus = 'COMPLETED';
          } else if (showStatus === 'stopped' || showStatus === 'archived') {
            trackingStatus = 'PAUSED';
          } else if (showStatus === 'watching') {
            trackingStatus = 'WATCHING';
          } else {
            trackingStatus = hasWatched ? 'WATCHING' : 'PLANNED';
          }

          // Se estiver COMPLETED, garante que o progresso está no último episódio da última temporada
          if (trackingStatus === 'COMPLETED' && dbAnime && dbAnime.episodesList) {
            const episodesList = dbAnime.episodesList as any[];
            if (episodesList.length > 0) {
              let highestS = 1;
              let highestE = 0;
              for (const ep of episodesList) {
                if (ep.season > highestS) {
                  highestS = ep.season;
                  highestE = ep.episodeNumber;
                } else if (ep.season === highestS && ep.episodeNumber > highestE) {
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

          if (existingUserAnime) {
            // Apenas atualiza se o progresso do TV Time for maior ou se estiver em estado PLANNED
            const isMoreAdvanced = (maxSeason > existingUserAnime.seasonAtual) ||
                                   (maxSeason === existingUserAnime.seasonAtual && maxEpisode > existingUserAnime.epAtual);
            if (isMoreAdvanced || existingUserAnime.status === 'PLANNED') {
              await this.prisma.userAnime.update({
                where: { id: existingUserAnime.id },
                data: {
                  seasonAtual: maxSeason,
                  epAtual: maxEpisode,
                  status: trackingStatus,
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
                epAtual: maxEpisode,
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
            status.importedShows.push({
              id: savedUserAnime.id,
              animeId: savedUserAnime.animeId,
              titulo: savedUserAnime.anime.titulo,
              capaUrl: savedUserAnime.anime.capaUrl,
              status: savedUserAnime.status,
              seasonAtual: savedUserAnime.seasonAtual,
              epAtual: savedUserAnime.epAtual,
              numEpisodiosTotal: savedUserAnime.anime.numEpisodiosTotal,
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
          this.logger.error(`Erro ao processar série "${show.title}" (tentativa ${attempts}/${maxAttempts}):`, err);
          if (attempts >= maxAttempts) {
            status.errors.push(`Erro definitivo na série "${show.title}": ${err.message || err}`);
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
      await this.recalculateUserStats(userId);
    } catch (err) {
      this.logger.error(`Erro ao recalcular estatísticas do utilizador ${userId}:`, err);
    }
  }

  async clearAnimeCatalog() {
    this.logger.log('A iniciar a limpeza de toda a base de dados de Anime...');
    try {
      const animes = await this.prisma.anime.findMany({ select: { id: true } });
      const animeIds = animes.map((a) => a.id);

      await this.prisma.userAnime.deleteMany({});
      await this.prisma.customListItem.deleteMany({
        where: { mediaType: 'ANIME' }
      });
      await this.prisma.comment.deleteMany({
        where: { mediaId: { in: animeIds } }
      });
      await this.prisma.userRating.deleteMany({
        where: { mediaId: { in: animeIds } }
      });
      await this.prisma.anime.deleteMany({});
      await this.prisma.media.deleteMany({
        where: { id: { in: animeIds } }
      });

      const users = await this.prisma.user.findMany({ select: { id: true } });
      for (const user of users) {
        await this.recalculateUserStats(user.id).catch(() => {});
      }

      return { success: true, message: 'Catálogo de animes e progresso de utilizadores limpos com sucesso.' };
    } catch (err: any) {
      this.logger.error('Erro ao limpar catálogo de animes:', err);
      throw err;
    }
  }
}
