import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TMDBService } from './tmdb.service';
import { RecommendationService } from './recommendation.service';
import { AnimeService } from './anime.service';
import {
  normalizeTMDBToAniList,
  detectMediaType,
  capitalizeKeyword,
  resolveLatinTitleForSearchItem,
  TMDB_GENRE_MAP,
  STANDARD_GENRES,
  TMDB_GENRE_ID_TO_NAME,
  TMDB_GENRE_NAME_TO_TV_ID,
  TMDB_GENRE_NAME_TO_MOVIE_ID,
  TMDB_STATIC_KEYWORDS,
} from './anime.utils';

@Injectable()
export class AniListService {
  private readonly logger = new Logger(AniListService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdbService: TMDBService,
    private readonly recommendationService: RecommendationService,
    @Inject(forwardRef(() => AnimeService))
    private readonly animeService: AnimeService,
  ) {}

  async getGenreTags(type?: 'ANIME' | 'MANGA') {
    if (type === 'ANIME') {
      return this.prisma.genreTag.findMany({
        where: {
          name: {
            endsWith: '\u200b',
          },
        },
        orderBy: [
          { type: 'asc' },
          { category: 'asc' },
          { subcategory: 'asc' },
          { name: 'asc' },
        ],
      });
    }

    return this.prisma.genreTag.findMany({
      where: {
        NOT: {
          name: {
            endsWith: '\u200b',
          },
        },
      },
      orderBy: [
        { type: 'asc' },
        { category: 'asc' },
        { subcategory: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async registerGenreTags(generosDict: Record<string, number> | null | undefined) {
    if (!generosDict) return;
    const keys = Object.keys(generosDict);
    for (const key of keys) {
      const isGenre = STANDARD_GENRES.has(key);
      try {
        await this.prisma.genreTag.upsert({
          where: { name: key },
          update: {},
          create: {
            name: key,
            type: isGenre ? 'GENRE' : 'TAG',
            category: isGenre ? 'Géneros Principais' : 'Outros Temas',
            subcategory: isGenre ? 'Género' : 'Tópicos Diversos',
            isAdult: false,
            isExposed: true,
          },
        });
      } catch (e) {
        this.logger.error(`Error registering genre/tag "${key}":`, e);
      }
    }
  }

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
    } catch (error: any) {
      this.logger.error(
        `TMDB detail fetch error in searchAniList: ${error.message || error}`,
        error.stack,
      );
      return null;
    }
  }

  async searchAniListById(id: number, userId?: number, format?: string) {
    let details: any = null;
    let isMovie = false;

    const tryTV = async () => {
      details = await this.tmdbService.getTVShowDetails(id);
      isMovie = false;
    };

    const tryMovie = async () => {
      details = await this.tmdbService.getMovieDetails(id);
      isMovie = true;
    };

    try {
      if (format) {
        if (format.toUpperCase() === 'MOVIE') {
          await tryMovie();
        } else {
          await tryTV();
        }
      } else {
        try {
          await tryTV();
        } catch {
          await tryMovie();
        }
      }
    } catch (error) {
      try {
        if (format && format.toUpperCase() === 'MOVIE') {
          await tryTV();
        } else if (format) {
          await tryMovie();
        } else {
          throw error;
        }
      } catch (error2) {
        // Both failed. Let's see if we can perform a lazy migration from AniList ID to TMDB ID.
        const localAnime = await this.prisma.anime.findUnique({
          where: { id },
        });
        if (!localAnime) {
          if ((error2 as any).status === 404) {
            this.logger.warn(`TMDB details not found (404) for ID ${id}`);
          } else {
            this.logger.error(`Error fetching TMDB details for ID ${id}:`, error2);
          }
          return null;
        }

        this.logger.log(
          `[Migration] Detected AniList ID ${id} for "${localAnime.titulo}". Migrating to TMDB...`,
        );
        const searchResults = await this.tmdbService.search(localAnime.titulo);
        if (searchResults.length === 0) {
          this.logger.error(
            `[Migration] Could not find any TMDB match for "${localAnime.titulo}".`,
          );
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
          this.logger.error(
            `[Migration] Failed to fetch details for new TMDB ID ${tmdbId}:`,
            e,
          );
          return null;
        }

        // Perform DB updates
        const normalized = normalizeTMDBToAniList(
          details,
          isMovie ? 'movie' : 'tv',
        );
        const generosDict: Record<string, number> = {};
        if (normalized.genres) {
          normalized.genres.forEach((g: string) => {
            const trimmed = g.trim();
            generosDict[trimmed] = 100;

            const mapped = TMDB_GENRE_MAP[trimmed];
            if (mapped) {
              mapped.forEach((m) => {
                generosDict[m] = 100;
              });
            }
          });
        }

        const formatValue = normalized.format;
        if (formatValue === 'MOVIE') {
          generosDict['Movie'] = 100;
          generosDict['Filme'] = 100;
        } else if (formatValue === 'TV') {
          generosDict['TV Show'] = 100;
          generosDict['Série'] = 100;
        }

        const isAnimation = normalized.genres?.some(
          (g: string) =>
            g.trim().toLowerCase() === 'animação' ||
            g.trim().toLowerCase() === 'animation',
        );
        if (isAnimation) {
          generosDict['Animation'] = 100;
          generosDict['Animação'] = 100;
        }

        try {
          const tmdbKeywords = await this.tmdbService.getKeywords(
            tmdbId,
            isMovie ? 'movie' : 'tv',
          );
          if (tmdbKeywords && tmdbKeywords.length > 0) {
            tmdbKeywords.forEach((k: string) => {
              const capitalized = capitalizeKeyword(k.trim());
              if (capitalized) {
                generosDict[capitalized] = 100;
              }
            });
          }
        } catch (e) {
          this.logger.error(
            `[Migration] Error fetching TMDB keywords for ID ${tmdbId}:`,
            e,
          );
        }

        let proximosEpisodiosJson: any[] = [];
        if (!isMovie && details.number_of_seasons > 0) {
          try {
            const latestSeason = details.seasons
              .filter((s: any) => s.season_number > 0)
              .sort((a: any, b: any) => b.season_number - a.season_number)[0];
            if (latestSeason) {
              const seasonDetails = await this.tmdbService.getTVSeasonDetails(
                tmdbId,
                latestSeason.season_number,
              );
              proximosEpisodiosJson = (seasonDetails.episodes || []).map(
                (ep: any) => {
                  let epAirDate: string | null = null;
                  if (ep.air_date) {
                    const parsedDate = new Date(
                      ep.air_date.includes('T')
                        ? ep.air_date
                        : ep.air_date + 'T12:00:00Z',
                    );
                    if (!isNaN(parsedDate.getTime())) {
                      epAirDate = parsedDate.toISOString();
                    }
                  }
                  return {
                    season: ep.season_number,
                    episode: ep.episode_number,
                    airDate: epAirDate,
                    notified: false,
                  };
                },
              );
            }
          } catch {}
        }

        // Create new Anime record
        await this.prisma.anime.upsert({
          where: { id: tmdbId },
          update: {
            tipo: detectMediaType(generosDict, normalized.format),
            dataLancamento: normalized.dataLancamento,
          },
          create: {
            id: tmdbId,
            titulo:
              normalized.title.english ||
              normalized.title.romaji ||
              'Sem título',
            statusLancamento: normalized.status,
            descricao: normalized.description,
            generos: generosDict,
            capaUrl: normalized.coverImage.large,
            numEpisodiosTotal: normalized.episodes,
            temporada: normalized.season,
            ano:
              normalized.seasonYear && !isNaN(normalized.seasonYear)
                ? normalized.seasonYear
                : null,
            paisOrigem: normalized.countryOfOrigin,
            formato: normalized.format,
            tipo: detectMediaType(generosDict, normalized.format),
            dataLancamento: normalized.dataLancamento,
          },
        });

        // Sync episodes of all seasons to the database
        await this.animeService.syncAnimeEpisodes(tmdbId, details.seasons);

        // Ensure Media rating exists
        const averageScore = normalized.averageScore
          ? normalized.averageScore / 10
          : 0;
        const existingMedia = await this.prisma.media.findUnique({
          where: { id: tmdbId },
        });
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
      const latestSeason = details.seasons
        .filter((s: any) => s.season_number > 0)
        .sort((a: any, b: any) => b.season_number - a.season_number)[0];
      if (latestSeason) {
        try {
          const seasonDetails = await this.tmdbService.getTVSeasonDetails(
            id,
            latestSeason.season_number,
          );
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
                  coverImage: {
                    large: s.poster_path
                      ? `https://image.tmdb.org/t/p/w500${s.poster_path}`
                      : media.coverImage.large,
                  },
                  episodes: s.episode_count,
                  season: s.name,
                  seasonYear: s.air_date
                     ? new Date(s.air_date).getFullYear()
                     : null,
                  status: media.status,
                  format: 'TV_SEASON',
                },
              })),
          };
        } catch (e) {
          this.logger.error(
            `Error fetching season details for TV ID ${id}:`,
            e,
          );
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
                    isCurrentSeason:
                      matched.seasonAtual === edge.node.seasonNumber,
                  }
                : null,
            },
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

  async importFromAniList(
    nomeAnime: string,
    userId: number,
    anilistId?: number,
    format?: string,
  ) {
    let anime = anilistId
      ? await this.prisma.anime.findUnique({ where: { id: anilistId } })
      : null;

    if (anime) {
      const userAnime = await this.prisma.userAnime.findUnique({
        where: {
          userId_animeId: { userId, animeId: anime.id },
        },
      });

      if (userAnime) {
        throw new Error('Este anime já se encontra na sua biblioteca.');
      }

      const createdUserAnime = await this.prisma.userAnime.create({
        data: {
          userId,
          animeId: anime.id,
          status: anime.formato === 'MOVIE' || anime.tipo === 'FILME' ? 'PLANNED' : 'WATCHING',
          seasonAtual: 1,
          epAtual: 0,
        },
      });

      await this.animeService.recalculateUserStats(userId);

      return {
        id: createdUserAnime.id,
        animeId: anime.id,
        titulo: anime.titulo,
        capaUrl: anime.capaUrl,
        status: createdUserAnime.status,
        epAtual: createdUserAnime.epAtual,
        numEpisodiosTotal: anime.numEpisodiosTotal,
        temporada: anime.temporada,
        ano: anime.ano,
        formato: anime.formato,
        tipo: anime.tipo,
        statusLancamento: anime.statusLancamento,
        dataLancamento: anime.dataLancamento,
      };
    }

    const tmdbData = anilistId
      ? await this.searchAniListById(anilistId, undefined, format || 'TV')
      : await this.searchAniList(nomeAnime);

    if (!tmdbData) {
      throw new Error(
        'Não foi possível encontrar a série no TMDB ou importar os dados.',
      );
    }

    const matchedInDb = await this.prisma.anime.findUnique({
      where: { id: tmdbData.id },
    });

    if (matchedInDb) {
      const userAnime = await this.prisma.userAnime.findUnique({
        where: {
          userId_animeId: { userId, animeId: matchedInDb.id },
        },
      });

      if (userAnime) {
        throw new Error('Este anime já se encontra na sua biblioteca.');
      }

      const createdUserAnime = await this.prisma.userAnime.create({
        data: {
          userId,
          animeId: matchedInDb.id,
          status: matchedInDb.formato === 'MOVIE' || matchedInDb.tipo === 'FILME' ? 'PLANNED' : 'WATCHING',
          seasonAtual: 1,
          epAtual: 0,
        },
      });

      await this.animeService.recalculateUserStats(userId);

      return {
        id: createdUserAnime.id,
        animeId: matchedInDb.id,
        titulo: matchedInDb.titulo,
        capaUrl: matchedInDb.capaUrl,
        status: createdUserAnime.status,
        epAtual: createdUserAnime.epAtual,
        numEpisodiosTotal: matchedInDb.numEpisodiosTotal,
        temporada: matchedInDb.temporada,
        ano: matchedInDb.ano,
        formato: matchedInDb.formato,
        tipo: matchedInDb.tipo,
        statusLancamento: matchedInDb.statusLancamento,
        dataLancamento: matchedInDb.dataLancamento,
      };
    }

    const generosDict = buildGenerosDict(tmdbData.genres, tmdbData.tags);
    await this.registerGenreTags(generosDict);

    let details: any = null;
    if (tmdbData.format === 'TV' && tmdbData.id) {
      try {
        details = await this.tmdbService.getTVShowDetails(tmdbData.id);
      } catch (e: any) {
        if (e.status === 404) {
          this.logger.warn(`TV Show details not found (404) during import for ID ${tmdbData.id}`);
        } else {
          this.logger.error(`Error fetching season details during import:`, e);
        }
      }
    }

    const createdAnime = await this.prisma.anime.create({
      data: {
        id: tmdbData.id,
        titulo: tmdbData.title.english || tmdbData.title.romaji || 'Sem título',
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
      where: { id: createdAnime.id },
    });
    if (!existingMedia) {
      await this.prisma.media.create({
        data: {
          id: createdAnime.id,
          avaliacao_base: averageScore,
          total_votos_users: 0,
          soma_notas_users: 0,
          avaliacao_geral: averageScore,
        },
      });
    }

    const createdUserAnime = await this.prisma.userAnime.create({
      data: {
        userId,
        animeId: createdAnime.id,
        status: createdAnime.formato === 'MOVIE' || createdAnime.tipo === 'FILME' ? 'PLANNED' : 'WATCHING',
        seasonAtual: 1,
        epAtual: 0,
      },
    });

    await this.animeService.recalculateUserStats(userId);

    const updatedAnime = await this.prisma.anime.findUnique({
      where: { id: createdAnime.id },
    });

    return {
      id: createdUserAnime.id,
      animeId: createdAnime.id,
      titulo: createdAnime.titulo,
      capaUrl: createdAnime.capaUrl,
      status: createdUserAnime.status,
      epAtual: createdUserAnime.epAtual,
      numEpisodiosTotal: createdAnime.numEpisodiosTotal,
      temporada: createdAnime.temporada,
      ano: createdAnime.ano,
      formato: createdAnime.formato,
      tipo: updatedAnime ? updatedAnime.tipo : createdAnime.tipo,
      statusLancamento: createdAnime.statusLancamento,
      dataLancamento: createdAnime.dataLancamento,
    };
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
      this.logger.error('Error fetching candidates from AniList:', error);
      return [];
    }
  }

  private async resolveKeywordIds(tags?: string[]): Promise<number[]> {
    if (!tags || tags.length === 0) return [];
    const ids: number[] = [];
    for (const tag of tags) {
      const lowerTag = tag.trim().replace(/\u200b/g, '').toLowerCase();
      if (TMDB_STATIC_KEYWORDS[lowerTag] !== undefined) {
        ids.push(TMDB_STATIC_KEYWORDS[lowerTag]);
        continue;
      }
      try {
        const searchRes = await this.tmdbService.searchKeywords(lowerTag);
        if (searchRes && searchRes.results && searchRes.results.length > 0) {
          const exact = searchRes.results.find(
            (r: any) => r.name.toLowerCase() === lowerTag,
          );
          const selected = exact || searchRes.results[0];
          ids.push(selected.id);
        }
      } catch (err) {
        this.logger.error(`Error resolving keyword "${tag}":`, err);
      }
    }
    return ids;
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
      return this.recommendationService.getRecommendations(type, userId, page);
    }
    if (type === 'ANIME') {
      // 1. Resolve keywords/tags to TMDB IDs
      const keywordIds = await this.resolveKeywordIds(tags);

      // 2. Fetch User Adult Content Preference
      let includeAdult = false;
      if (userId) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
          });
          if (user && user.showAdultContent) {
            includeAdult = true;
          }
        } catch (err) {
          this.logger.error('Error fetching user adult preference:', err);
        }
      }

      // 3. Helper functions for genre mapping
      const getTvGenreIds = (gList?: string[]): number[] => {
        const ids = [16]; // Always include Animation (16)
        if (gList) {
          gList.forEach((g) => {
            const cleanG = g.replace(/\u200b/g, '').trim().toLowerCase();
            const id = TMDB_GENRE_NAME_TO_TV_ID[cleanG];
            if (id) ids.push(id);
          });
        }
        return ids;
      };

      const getMovieGenreIds = (gList?: string[]): number[] => {
        const ids = [16]; // Always include Animation (16)
        if (gList) {
          gList.forEach((g) => {
            const cleanG = g.replace(/\u200b/g, '').trim().toLowerCase();
            const id = TMDB_GENRE_NAME_TO_MOVIE_ID[cleanG];
            if (id) ids.push(id);
          });
        }
        return ids;
      };

      // 4. Setup base parameters
      const tvParams: Record<string, string> = {
        with_genres: getTvGenreIds(genres).join(','),
        with_original_language: 'ja',
        sort_by: sort === 'SCORE_DESC' ? 'vote_average.desc' : 'popularity.desc',
        page: String(page),
        include_adult: String(includeAdult),
      };

      const movieParams: Record<string, string> = {
        with_genres: getMovieGenreIds(genres).join(','),
        with_original_language: 'ja',
        sort_by: sort === 'SCORE_DESC' ? 'vote_average.desc' : 'popularity.desc',
        page: String(page),
        include_adult: String(includeAdult),
      };

      if (sort === 'SCORE_DESC') {
        tvParams['vote_count.gte'] = '50';
        movieParams['vote_count.gte'] = '50';
      }

      if (keywordIds.length > 0) {
        tvParams['with_keywords'] = keywordIds.join(',');
        movieParams['with_keywords'] = keywordIds.join(',');
      }

      // 5. Year and Season parameters
      if (year && !isNaN(year)) {
        if (season && season !== 'Any') {
          let start = '';
          let end = '';
          switch (season.toUpperCase()) {
            case 'WINTER':
              start = `${year}-01-01`;
              end = `${year}-03-31`;
              break;
            case 'SPRING':
              start = `${year}-04-01`;
              end = `${year}-06-30`;
              break;
            case 'SUMMER':
              start = `${year}-07-01`;
              end = `${year}-09-30`;
              break;
            case 'FALL':
              start = `${year}-10-01`;
              end = `${year}-12-31`;
              break;
          }
          if (start && end) {
            tvParams['first_air_date.gte'] = start;
            tvParams['first_air_date.lte'] = end;
            movieParams['primary_release_date.gte'] = start;
            movieParams['primary_release_date.lte'] = end;
          }
        } else {
          tvParams['first_air_date_year'] = String(year);
          movieParams['primary_release_year'] = String(year);
        }
      }

      // 6. Status parameters
      if (status && status !== 'Any') {
        const todayStr = new Date().toISOString().split('T')[0];
        switch (status.toUpperCase()) {
          case 'FINISHED':
            tvParams['with_status'] = '3';
            movieParams['primary_release_date.lte'] = todayStr;
            break;
          case 'RELEASING':
            tvParams['with_status'] = '0,2,5';
            break;
          case 'NOT_YET_RELEASED':
            tvParams['with_status'] = '1';
            movieParams['primary_release_date.gte'] = todayStr;
            break;
          case 'CANCELLED':
            tvParams['with_status'] = '4';
            break;
        }
      }

      // 7. Execute TMDB API calls depending on requested Format
      let results: any[] = [];
      const isMovieOnly = format?.toUpperCase() === 'MOVIE';
      const isTvOnly =
        format &&
        format !== 'Any' &&
        format.toUpperCase() !== 'MOVIE';

      try {
        if (isMovieOnly) {
          const data = await this.tmdbService.discoverMovies(movieParams);
          results = (data.results || []).map((item: any) => ({
            ...item,
            media_type: 'movie',
          }));
        } else if (isTvOnly) {
          const data = await this.tmdbService.discoverTV(tvParams);
          results = (data.results || []).map((item: any) => ({
            ...item,
            media_type: 'tv',
          }));
        } else {
          // Fetch both and merge
          const [tvData, movieData] = await Promise.all([
            this.tmdbService.discoverTV(tvParams),
            this.tmdbService.discoverMovies(movieParams),
          ]);
          const tvItems = (tvData.results || []).map((item: any) => ({
            ...item,
            media_type: 'tv',
          }));
          const movieItems = (movieData.results || []).map((item: any) => ({
            ...item,
            media_type: 'movie',
          }));

          const merged = [...tvItems, ...movieItems];
          if (sort === 'SCORE_DESC') {
            merged.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
          } else {
            merged.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          }
          results = merged.slice(0, 24);
        }

        // 8. Map to standardized return format
        return results.map((item) => {
          const isMovieItem =
            item.media_type === 'movie' || item.title !== undefined;
          const title = isMovieItem
            ? item.title || item.original_title
            : item.name || item.original_name;

          const genresList: string[] = item.genre_ids
            ? item.genre_ids
                .map((id: number) => TMDB_GENRE_ID_TO_NAME[id])
                .filter(Boolean)
            : [];

          const statusMap: Record<string, string> = {
            'Returning Series': 'RELEASING',
            Ended: 'FINISHED',
            Released: 'FINISHED',
            'Post Production': 'RELEASING',
            'In Production': 'RELEASING',
          };

          const statusStr = item.status
            ? statusMap[item.status] || item.status.toUpperCase()
            : isMovieItem
              ? 'FINISHED'
              : 'FINISHED';

          const posterPath = item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : null;

          return {
            id: item.id,
            title: {
              english: title,
              romaji: title,
              native: isMovieItem ? item.original_title : item.original_name,
            },
            coverImage: { large: posterPath },
            genres: genresList,
            format: isMovieItem ? 'MOVIE' : 'TV',
            status: statusStr,
            tipo: isMovieItem ? 'FILME' : 'SERIE',
          };
        });
      } catch (error) {
        this.logger.error('Error executing TMDB explore discover:', error);
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
}

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
