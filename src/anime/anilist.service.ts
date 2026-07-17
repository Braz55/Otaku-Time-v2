import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
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
      const tvGenreMap: Record<string, number> = {
        Action: 10759,
        Adventure: 10759,
        Comedy: 35,
        Drama: 18,
        Fantasy: 10765,
        'Sci-Fi': 10765,
        Mystery: 9648,
      };

      const isMovieFormat = format === 'MOVIE';
      const params: Record<string, string> = {
        page: page.toString(),
        language: 'en-US',
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
        return Promise.all(
          mediaItems.map(async (item: any) => {
            let title = isMovieFormat
              ? item.title || item.original_title
              : item.name || item.original_name;
            title = await resolveLatinTitleForSearchItem(
              this.tmdbService,
              item,
              title,
              isMovieFormat,
            );
            const posterPath = item.poster_path
              ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
              : null;
            const isAnimation = item.genre_ids?.includes(16);
            let detectedType: 'ANIME' | 'SERIE' | 'FILME' = 'ANIME';
            if (!isAnimation) {
              detectedType = isMovieFormat ? 'FILME' : 'SERIE';
            }

            return {
              id: item.id,
              title: { english: title, romaji: title },
              coverImage: { large: posterPath },
              genres: genres || [],
              format: isMovieFormat ? 'MOVIE' : 'TV',
              status: 'FINISHED',
              tipo: detectedType,
            };
          }),
        );
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
