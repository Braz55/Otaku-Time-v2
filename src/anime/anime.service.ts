import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';
import { TMDBService } from './tmdb.service';
import { AniListService } from './anilist.service';
import { RecommendationService } from './recommendation.service';
import { TVTimeImportService } from './tvtime-import.service';
import { CalendarService } from './calendar.service';
import { detectMediaType, buildGenerosDict, resolveLatinTitleForSearchItem } from './anime.utils';

@Injectable()
export class AnimeService {
  private readonly logger = new Logger(AnimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly listService: ListService,
    private readonly tmdbService: TMDBService,
    @Inject(forwardRef(() => AniListService))
    private readonly anilistService: AniListService,
    private readonly recommendationService: RecommendationService,
    @Inject(forwardRef(() => TVTimeImportService))
    private readonly tvtimeImportService: TVTimeImportService,
    private readonly calendarService: CalendarService,
  ) {}

  // -------------------------------------------------------------
  // DELEGATED METHODS
  // -------------------------------------------------------------

  async getGenreTags() {
    return this.anilistService.getGenreTags();
  }

  async searchAniList(nomeAnime: string, userId?: number) {
    return this.anilistService.searchAniList(nomeAnime, userId);
  }

  async searchAniListById(id: number, userId?: number, format?: string) {
    return this.anilistService.searchAniListById(id, userId, format);
  }

  async getTVSeasonDetails(tvShowId: number, seasonNumber: number) {
    try {
      return await this.tmdbService.getTVSeasonDetails(tvShowId, seasonNumber);
    } catch (e) {
      this.logger.error(`Error fetching season details:`, e);
      return null;
    }
  }

  async importFromAniList(
    nomeAnime: string,
    userId: number,
    anilistId?: number,
    format?: string,
  ) {
    return this.anilistService.importFromAniList(nomeAnime, userId, anilistId, format);
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
    return this.anilistService.explore(
      type,
      genres,
      tags,
      year,
      season,
      format,
      status,
      source,
      country,
      sort,
      page,
      userId,
    );
  }

  async getRecommendations(
    type: 'ANIME' | 'MANGA',
    userId: number,
    page: number = 1,
  ) {
    return this.recommendationService.getRecommendations(type, userId, page);
  }

  async importFromTVTime(userId: number, tvTimeShows: any[]) {
    return this.tvtimeImportService.importFromTVTime(userId, tvTimeShows);
  }

  get tvTimeImportStatus() {
    return this.tvtimeImportService['tvTimeImportStatus'];
  }

  getTvTimeImportStatus(userId: number) {
    return this.tvtimeImportService.getTvTimeImportStatus(userId);
  }

  private async runTVTimeImportBackground(userId: number, tvTimeShows: any[]) {
    return this.tvtimeImportService['runTVTimeImportBackground'](userId, tvTimeShows);
  }

  async getCalendar(userId: number, startDateStr?: string) {
    return this.calendarService.getCalendar(userId, startDateStr);
  }

  async autoTransitionPlannedToWatching(
    animeId: number,
    episodesList: any[],
    animeTitle: string,
  ) {
    return this.calendarService.autoTransitionPlannedToWatching(
      animeId,
      episodesList,
      animeTitle,
    );
  }

  // -------------------------------------------------------------
  // CORE LOCAL CATALOG & USER LIST METHODS (CRUD, SYNC)
  // -------------------------------------------------------------

  async backgroundUpdateAnime(animeId: number, userId: number) {
    try {
      const existingAnime = await this.prisma.anime.findUnique({
        where: { id: animeId },
        select: { formato: true },
      });
      const format = existingAnime?.formato || undefined;
      const tmdbData = await this.searchAniListById(animeId, userId, format);
      if (tmdbData) {
        const generosDict = buildGenerosDict(tmdbData.genres, undefined);

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

        const averageScore = tmdbData.averageScore
          ? tmdbData.averageScore / 10
          : 0;
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
    const results = await this.tmdbService.search(nomeAnime, page, 'en-US');

    return Promise.all(
      results.map(async (item: any) => {
        const isMovie = item.media_type === 'movie';
        let title = isMovie
          ? item.title || item.original_title
          : item.name || item.original_name;
        title = await resolveLatinTitleForSearchItem(
          this.tmdbService,
          item,
          title,
          isMovie,
        );
        const posterPath = item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null;

        const statusMap: Record<string, string> = {
          'Returning Series': 'RELEASING',
          Ended: 'FINISHED',
          Released: 'FINISHED',
        };
        const status = statusMap[item.status] || 'FINISHED';

        const isAnimation = item.genre_ids?.includes(16);
        let detectedType: 'ANIME' | 'SERIE' | 'FILME' = 'ANIME';
        if (!isAnimation) {
          detectedType = isMovie ? 'FILME' : 'SERIE';
        }

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
          tipo: detectedType,
        };
      }),
    );
  }

  async findAll(userId: number, status?: string) {
    const whereClause: any = { userId };
    if (status) {
      const statusArr = status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) =>
          ['WATCHING', 'PLANNED', 'COMPLETED', 'PAUSED', 'DROPPED'].includes(s),
        );
      if (statusArr.length > 0) {
        whereClause.status = { in: statusArr };
      }
    }

    const list = await this.prisma.userAnime.findMany({
      where: whereClause,
      include: { anime: true },
    });
    const animeIds = list.map((item) => item.animeId);
    const ratings = await this.prisma.media.findMany({
      where: { id: { in: animeIds } },
    });
    const ratingMap = new Map(ratings.map((r) => [r.id, r]));

    return list.map((item) => {
      const rating = ratingMap.get(item.animeId);
      const epLocal = this.getLocalEpisodeNumber(
        item.anime,
        item.seasonAtual,
        item.epAtual,
      );
      const totalEpisodes = this.getTotalEpisodes(item.anime);

      let ultimoEpisodioEstreadoData: Date | null = null;
      let numEpisodiosAired = 0;
      if (item.anime.episodesList && Array.isArray(item.anime.episodesList)) {
        const now = new Date();
        const airedEpisodes = (item.anime.episodesList as any[]).filter(
          (ep) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= now,
        );
        numEpisodiosAired = airedEpisodes.length;
        if (airedEpisodes.length > 0) {
          const dates = airedEpisodes.map((ep) =>
            new Date(ep.airDate).getTime(),
          );
          ultimoEpisodioEstreadoData = new Date(Math.max(...dates));
        }
      }
      if (!ultimoEpisodioEstreadoData && item.anime.dataLancamento) {
        ultimoEpisodioEstreadoData = item.anime.dataLancamento;
      }

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
        epAtual: epLocal,
        epAtualGlobal: item.epAtual,
        numEpisodiosTotal: totalEpisodes,
        temporada: item.anime.temporada,
        ano: item.anime.ano,
        prioridade: item.prioridade,
        linksExternos: item.anime.linksExternos,
        linksPersonalizados: item.linksPersonalizados,
        proximoEpisodio: item.anime.proximoEpisodio,
        proximoEpisodioData: item.anime.proximoEpisodioData,
        numEpisodiosAired,
        tipo: detectMediaType(item.anime.generos, item.anime.formato),
        formato: item.anime.formato,
        watchedSpecials: item.watchedSpecials || [],
        updatedAt: item.updatedAt,
        lastProgressUpdate: item.lastProgressUpdate,
        avaliacaoGeral: rating?.avaliacao_geral ?? null,
        totalVotosUsers: rating?.total_votos_users ?? 0,
        ultimoEpisodioEstreadoData,
        mediaUpdatedAt: item.anime.updatedAt,
      };
    });
  }

  async findOne(id: number, user: any) {
    const item = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true },
    });
    if (!item) return null;

    if (item.userId !== user.userId && user.tipoConta !== 'ADMIN') {
      throw new ForbiddenException(
        'Não tem permissão para aceder a este registo.',
      );
    }
    const rating = await this.prisma.media.findUnique({
      where: { id: item.animeId },
    });
    const epLocal = this.getLocalEpisodeNumber(
      item.anime,
      item.seasonAtual,
      item.epAtual,
    );
    const totalEpisodes = this.getTotalEpisodes(item.anime);

    let ultimoEpisodioEstreadoData: Date | null = null;
    if (item.anime.episodesList && Array.isArray(item.anime.episodesList)) {
      const now = new Date();
      const airedEpisodes = (item.anime.episodesList as any[]).filter(
        (ep) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= now,
      );
      if (airedEpisodes.length > 0) {
        const dates = airedEpisodes.map((ep) => new Date(ep.airDate).getTime());
        ultimoEpisodioEstreadoData = new Date(Math.max(...dates));
      }
    }
    if (!ultimoEpisodioEstreadoData && item.anime.dataLancamento) {
      ultimoEpisodioEstreadoData = item.anime.dataLancamento;
    }

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
      epAtual: epLocal,
      epAtualGlobal: item.epAtual,
      numEpisodiosTotal: totalEpisodes,
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
      ultimoEpisodioEstreadoData,
    };
  }

  async update(id: number, updateDto: any, user: any) {
    const atual = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true },
    });
    if (!atual) return null;

    if (atual.userId !== user.userId && user.tipoConta !== 'ADMIN') {
      throw new ForbiddenException(
        'Não tem permissão para aceder a este registo.',
      );
    }

    if (
      (updateDto.numEpisodiosTotal !== undefined ||
        updateDto.tipo !== undefined) &&
      user.tipoConta !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Apenas administradores podem alterar metadados do catálogo global.',
      );
    }

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

    const totalEpisodes = this.getTotalEpisodes(atual.anime);

    if (updateDto.status === 'COMPLETED') {
      const totalDisponivel =
        atual.anime.statusLancamento === 'RELEASING' &&
        atual.anime.proximoEpisodio
          ? atual.anime.proximoEpisodio - 1
          : totalEpisodes || atual.epAtual;
      novosDados.epAtual = totalDisponivel;
      const mapped = this.getSeasonAndEpisodeFromGlobal(
        atual.anime,
        totalDisponivel,
      );
      novosDados.seasonAtual = mapped.season;
    }

    if (updateDto.epAtual !== undefined) {
      const incomingSeason =
        updateDto.seasonAtual !== undefined
          ? updateDto.seasonAtual
          : atual.seasonAtual;
      const incomingEp = updateDto.epAtual;

      const globalEp = this.getGlobalEpisodeNumber(
        atual.anime,
        incomingSeason,
        incomingEp,
      );
      const { season, episode } = this.getSeasonAndEpisodeFromGlobal(
        atual.anime,
        globalEp,
      );

      const totalAired = this.getTotalEpisodes(atual.anime);
      const hasEpisodeList =
        atual.anime.episodesList &&
        Array.isArray(atual.anime.episodesList) &&
        atual.anime.episodesList.length > 0;
      if (
        atual.anime.statusLancamento !== 'FINISHED' &&
        (hasEpisodeList || totalAired > 0) &&
        globalEp > totalAired
      ) {
        throw new BadRequestException(
          'Não é possível marcar episódios que ainda não estrearam.',
        );
      }

      novosDados.seasonAtual = season;
      novosDados.epAtual = globalEp;

      if (atual.status === 'PLANNED' && globalEp > 0)
        novosDados.status = 'WATCHING';
      if (
        atual.status === 'COMPLETED' &&
        totalEpisodes &&
        globalEp < totalEpisodes
      )
        novosDados.status = 'WATCHING';

      if (
        atual.anime.statusLancamento !== 'FINISHED' &&
        totalEpisodes &&
        globalEp >= totalEpisodes
      ) {
        novosDados.status = 'COMPLETED';
        novosDados.epAtual = totalEpisodes;
        const lastState = this.getSeasonAndEpisodeFromGlobal(
          atual.anime,
          totalEpisodes,
        );
        novosDados.seasonAtual = lastState.season;
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
    const epLocal = this.getLocalEpisodeNumber(
      updated.anime,
      updated.seasonAtual,
      updated.epAtual,
    );
    const totalEpisodesUpdated = this.getTotalEpisodes(updated.anime);
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
      epAtual: epLocal,
      epAtualGlobal: updated.epAtual,
      numEpisodiosTotal: totalEpisodesUpdated,
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

  async remove(id: number, user: any) {
    const atual = await this.prisma.userAnime.findUnique({
      where: { id },
    });
    if (!atual) return null;

    if (atual.userId !== user.userId && user.tipoConta !== 'ADMIN') {
      throw new ForbiddenException(
        'Não tem permissão para remover este registo.',
      );
    }

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
      Action: 10759,
      Adventure: 10759,
      Comedy: 35,
      Drama: 18,
      Fantasy: 10765,
      'Sci-Fi': 10765,
      Mystery: 9648,
    };

    const genreId = tvGenreMap[genre] || 16;
    try {
      const results = await this.tmdbService.discoverTV({
        with_genres: genreId.toString(),
        page: page.toString(),
        sort_by: 'popularity.desc',
      });

      const mediaItems = results.results || [];
      return mediaItems.map((item: any) => {
        const title = item.name || item.original_name;
        const posterPath = item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null;
        return {
          id: item.id,
          title: { english: title, romaji: title },
          coverImage: { large: posterPath },
          genres: [genre],
          format: 'TV',
        };
      });
    } catch (error: any) {
      this.logger.error(
        `TMDB genre search error: ${error.message || error}`,
        error.stack,
      );
      return [];
    }
  }

  async syncLatestEpisode(tmdbId: number) {
    const dbAnime = await this.prisma.anime.findUnique({
      where: { id: tmdbId },
    });
    if (!dbAnime) return { latest: null };

    const media = await this.searchAniListById(
      tmdbId,
      undefined,
      dbAnime.formato || undefined,
    );
    if (!media) return { latest: null };

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

    return {
      latest: episodes,
      source: 'TMDB',
      notificationsSent: notificationCount,
    };
  }

  async syncAnimeEpisodes(animeId: number, detailsSeasons: any[]) {
    try {
      const anime = await this.prisma.anime.findUnique({
        where: { id: animeId },
      });
      if (!anime) {
        this.logger.warn(
          `Anime ID ${animeId} not found in DB, skipping episodes sync.`,
        );
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
          this.logger.error(
            `Error parsing existing episodes list for anime ID ${animeId}:`,
            e,
          );
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
          seasonDetails = await this.tmdbService.getTVSeasonDetails(
            animeId,
            season.season_number,
          );
          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (err) {
          this.logger.error(
            `Error fetching season ${season.season_number} details for TV ID ${animeId}:`,
            err,
          );
          continue;
        }

        if (!seasonDetails || !seasonDetails.episodes) continue;

        const sortedEpisodes = [...seasonDetails.episodes].sort(
          (a: any, b: any) => a.episode_number - b.episode_number,
        );

        for (const ep of sortedEpisodes) {
          let globalEpNum: number | null = null;
          if (season.season_number > 0) {
            globalCounter++;
            globalEpNum = globalCounter;
          }
          let airDateVal: string | null = null;
          if (ep.air_date) {
            const parsedDate = new Date(
              ep.air_date.includes('T')
                ? ep.air_date
                : ep.air_date + 'T12:00:00Z',
            );
            if (!isNaN(parsedDate.getTime())) {
              airDateVal = parsedDate.toISOString();
            }
          }
          const key = `${ep.season_number}-${ep.episode_number}`;
          const isNotified = existingNotifiedMap.get(key) || false;

          episodesList.push({
            season: ep.season_number,
            episodeNumber: ep.episode_number,
            globalEpisodeNumber: globalEpNum,
            name: ep.name || null,
            airDate: airDateVal,
            stillPath: ep.still_path
              ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
              : null,
            notified: isNotified,
          });
        }
      }

      await this.prisma.anime.update({
        where: { id: animeId },
        data: { episodesList },
      });

      await this.autoTransitionPlannedToWatching(
        animeId,
        episodesList,
        anime.titulo,
      );

      this.logger.log(
        `Successfully synced ${globalCounter} episodes in JSON for anime ID ${animeId}`,
      );
    } catch (err) {
      this.logger.error(
        `Error in syncAnimeEpisodes for anime ID ${animeId}:`,
        err,
      );
    }
  }

  async clearAnimeCatalog() {
    this.logger.log('A iniciar a limpeza de toda a base de dados de Anime...');
    try {
      const animes = await this.prisma.anime.findMany({ select: { id: true } });
      const animeIds = animes.map((a) => a.id);

      await this.prisma.userAnime.deleteMany({});
      await this.prisma.customListItem.deleteMany({
        where: { mediaType: 'ANIME' },
      });
      await this.prisma.comment.deleteMany({
        where: { mediaId: { in: animeIds } },
      });
      await this.prisma.userRating.deleteMany({
        where: { mediaId: { in: animeIds } },
      });
      await this.prisma.anime.deleteMany({});
      await this.prisma.media.deleteMany({
        where: { id: { in: animeIds } },
      });

      const users = await this.prisma.user.findMany({ select: { id: true } });
      for (const user of users) {
        await this.recalculateUserStats(user.id).catch(() => {});
      }

      return {
        success: true,
        message:
          'Catálogo de animes e progresso de utilizadores limpos com sucesso.',
      };
    } catch (err: any) {
      this.logger.error('Erro ao limpar catálogo de animes:', err);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // HELPER CALCULATIONS
  // -------------------------------------------------------------

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

      await awardAchievement(1);

      if (totalEpisodesWatched >= 100) {
        await awardAchievement(3);
      }

      if (totalMangaRead >= 1) {
        await awardAchievement(4);
      }

      const completedAnimes = animes.filter((ua) => ua.status === 'COMPLETED');
      const isekaiCount = completedAnimes.filter((ua) => {
        if (!ua.anime?.generos) return false;
        if (typeof ua.anime.generos === 'string') {
          return ua.anime.generos.toLowerCase().includes('isekai');
        }
        if (typeof ua.anime.generos === 'object') {
          return Object.keys(ua.anime.generos).some(
            (key) => key.toLowerCase() === 'isekai',
          );
        }
        return false;
      }).length;
      if (isekaiCount >= 5) {
        await awardAchievement(2);
      }

      const favoritesCount = await this.prisma.userTopFavorite.count({
        where: { userId },
      });
      if (favoritesCount >= 3) {
        await awardAchievement(5);
      }

      if (totalMangaRead >= totalEpisodesWatched * 2 && totalMangaRead > 0) {
        await awardAchievement(46);
      }
    } catch (e) {
      console.error('Error recalculating user statistics/achievements:', e);
    }
  }

  getGlobalEpisodeNumber(anime: any, season: number, episode: number): number {
    if (!anime) return episode;
    if (
      anime.episodesList &&
      Array.isArray(anime.episodesList) &&
      anime.episodesList.length > 0
    ) {
      const sorted = (anime.episodesList as any[])
        .filter((ep) => ep.season > 0)
        .sort((a, b) => {
          if (a.season !== b.season) return a.season - b.season;
          return a.episodeNumber - b.episodeNumber;
        });
      const index = sorted.findIndex(
        (ep) => ep.season === season && ep.episodeNumber === episode,
      );
      if (index !== -1) {
        return index + 1;
      }
      let sum = 0;
      const seasons = Array.from(new Set(sorted.map((ep) => ep.season))).sort(
        (a, b) => a - b,
      );
      for (const s of seasons) {
        if (s < season) {
          sum += sorted.filter((ep) => ep.season === s).length;
        }
      }
      return sum + episode;
    }
    return episode;
  }

  getSeasonAndEpisodeFromGlobal(
    anime: any,
    globalEp: number,
  ): { season: number; episode: number } {
    if (!anime) return { season: 1, episode: globalEp };
    if (globalEp <= 0) return { season: 1, episode: 0 };

    if (
      anime.episodesList &&
      Array.isArray(anime.episodesList) &&
      anime.episodesList.length > 0
    ) {
      const sorted = (anime.episodesList as any[])
        .filter((ep) => ep.season > 0)
        .sort((a, b) => {
          if (a.season !== b.season) return a.season - b.season;
          return a.episodeNumber - b.episodeNumber;
        });

      if (sorted.length > 0) {
        if (globalEp <= sorted.length) {
          const targetEp = sorted[globalEp - 1];
          return { season: targetEp.season, episode: targetEp.episodeNumber };
        } else {
          const targetEp = sorted[sorted.length - 1];
          return { season: targetEp.season, episode: targetEp.episodeNumber };
        }
      }
    }
    return { season: 1, episode: globalEp };
  }

  getLocalEpisodeNumber(anime: any, season: number, globalEp: number): number {
    if (!anime) return globalEp;
    if (
      anime.episodesList &&
      Array.isArray(anime.episodesList) &&
      anime.episodesList.length > 0
    ) {
      const sorted = (anime.episodesList as any[])
        .filter((ep) => ep.season > 0)
        .sort((a, b) => {
          if (a.season !== b.season) return a.season - b.season;
          return a.episodeNumber - b.episodeNumber;
        });

      let previousEpisodesSum = 0;
      let currentSeasonCount = 0;
      for (const ep of sorted) {
        if (ep.season < season) {
          previousEpisodesSum++;
        } else if (ep.season === season) {
          currentSeasonCount++;
        }
      }

      const localEp = globalEp - previousEpisodesSum;
      if (localEp < 0) return 0;
      if (currentSeasonCount > 0 && localEp > currentSeasonCount)
        return currentSeasonCount;
      return localEp;
    }
    return globalEp;
  }

  getTotalEpisodes(anime: any): number {
    if (!anime) return 0;
    if (
      anime.episodesList &&
      Array.isArray(anime.episodesList) &&
      anime.episodesList.length > 0
    ) {
      const now = new Date();
      return anime.episodesList.filter(
        (ep: any) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= now,
      ).length;
    }
    return 0;
  }
}
