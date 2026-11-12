import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';
import { TMDBService } from './tmdb.service';
import { AniListService } from './anilist.service';
import { RecommendationService } from './recommendation.service';
import { StatisticsService } from '../statistics/statistics.service';
import { TVTimeImportService } from './tvtime-import.service';
import { CalendarService } from './calendar.service';
import { NotificationService } from '../notification/notification.service';
import { aplicarRegrasDeProgresso } from '../library/progress-rules';
import { artworkUpdateData, resolveArtwork } from '../library/artwork';
import { detectMediaType, buildGenerosDict, resolveLatinTitleForSearchItem } from './anime.utils';
import { MediaSource } from '@prisma/client';
import {
  ANIME_SOURCES,
  animeKey,
  animeSourceFromFormat,
  formatFromSource,
  mediaKey,
} from '../rating/media-type';

@Injectable()
export class AnimeService {
  private readonly logger = new Logger(AnimeService.name);
  private readonly REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos por anime
  // Chave fonte:id (L-23)
  private readonly lastManualRefresh = new Map<string, number>();

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
    private readonly notificationService: NotificationService,
    private readonly statisticsService: StatisticsService,
  ) {}

  // -------------------------------------------------------------
  // DELEGATED METHODS
  // -------------------------------------------------------------

  async getGenreTags(type?: 'ANIME' | 'MANGA') {
    return this.anilistService.getGenreTags(type);
  }

  async searchTmdbAnime(nomeAnime: string, userId?: number) {
    return this.anilistService.searchTmdbAnime(nomeAnime, userId);
  }

  async searchAniList(nomeAnime: string, userId?: number) {
    return this.searchTmdbAnime(nomeAnime, userId);
  }

  async getTmdbDetailsById(id: number, userId?: number, format?: string) {
    return this.anilistService.getTmdbDetailsById(id, userId, format);
  }

  async searchAniListById(id: number, userId?: number, format?: string) {
    return this.getTmdbDetailsById(id, userId, format);
  }

  async importFromTmdb(
    nomeAnime: string,
    userId: number,
    anilistId?: number,
    format?: string,
  ) {
    return this.anilistService.importFromTmdb(nomeAnime, userId, anilistId, format);
  }

  async importFromAniList(
    nomeAnime: string,
    userId: number,
    anilistId?: number,
    format?: string,
  ) {
    return this.importFromTmdb(nomeAnime, userId, anilistId, format);
  }

  async getTVSeasonDetails(tvShowId: number, seasonNumber: number) {
    try {
      return await this.tmdbService.getTVSeasonDetails(tvShowId, seasonNumber);
    } catch (e: any) {
      if (e.status === 404) {
        this.logger.warn(`Season details not found (404) for TV Show ID ${tvShowId}, Season ${seasonNumber}`);
      } else {
        this.logger.error(`Error fetching season details:`, e);
      }
      return null;
    }
  }

  async getTmdbImages(id: number, format?: string, title?: string) {
    try {
      // 1. Try direct TMDB ID lookup
      const res = await this.tmdbService.getImages(id, format);
      if (res.posters?.length || res.backdrops?.length) {
        return res;
      }

      // 2. Direct lookup failed (likely AniList ID or UserAnime DB ID).
      let animeTitle = title;
      let targetFormat = format;

      // Check DB for Anime record (com o formato, a fonte fica determinada: L-23)
      const anime = await this.prisma.anime.findFirst({
        where: format ? { id, fonte: animeSourceFromFormat(format) } : { id },
        select: { titulo: true, formato: true },
      });
      if (anime) {
        animeTitle = animeTitle || anime.titulo;
        targetFormat = targetFormat || anime.formato || undefined;
      }

      // Check DB for UserAnime record if ID was UserAnime table ID
      const userAnime = await this.prisma.userAnime.findUnique({
        where: { id },
        include: { anime: true },
      });
      if (userAnime?.anime) {
        animeTitle = animeTitle || userAnime.anime.titulo;
        targetFormat = targetFormat || userAnime.anime.formato || undefined;
        // Try direct lookup with actual animeId from UserAnime
        const userAnimeRes = await this.tmdbService.getImages(userAnime.animeId, targetFormat);
        if (userAnimeRes.posters?.length || userAnimeRes.backdrops?.length) {
          return userAnimeRes;
        }
      }

      // 3. Fallback: Search TMDB by anime title to find real TMDB ID
      if (animeTitle) {
        this.logger.log(`Direct TMDB ID lookup failed for ID ${id}. Fallback TMDB search by title: "${animeTitle}"`);
        const searchResults = await this.tmdbService.search(animeTitle);
        if (searchResults && searchResults.length > 0) {
          const matchedItem = searchResults[0];
          const realTmdbId = matchedItem.id;
          const searchFormat = matchedItem.media_type === 'movie' ? 'MOVIE' : 'TV';
          const searchRes = await this.tmdbService.getImages(realTmdbId, targetFormat || searchFormat);
          if (searchRes.posters?.length || searchRes.backdrops?.length) {
            return searchRes;
          }
        }
      }

      return { posters: [], backdrops: [] };
    } catch (error) {
      this.logger.error(`Error in getTmdbImages fallback for ID ${id}:`, error);
      return { posters: [], backdrops: [] };
    }
  }

  async getTVEpisodeDetails(
    tvShowId: number,
    seasonNumber: number,
    episodeNumber: number,
    language?: string,
  ) {
    try {
      const data = await this.tmdbService.getTVEpisodeDetails(
        tvShowId,
        seasonNumber,
        episodeNumber,
        language || 'pt-PT',
      );

      // Fallback to English if synopsis is empty
      if (!data?.overview && (!language || language.startsWith('pt'))) {
        try {
          const dataEn = await this.tmdbService.getTVEpisodeDetails(
            tvShowId,
            seasonNumber,
            episodeNumber,
            'en-US',
          );
          if (dataEn?.overview) {
            data.overview = dataEn.overview;
          }
        } catch (errEn) {
          this.logger.warn(
            `Could not fetch English fallback overview for TV Show ID ${tvShowId}, Season ${seasonNumber}, Episode ${episodeNumber}:`,
            errEn,
          );
        }
      }

      // Fetch main cast credits as character fallback/addition
      try {
        const credits = await this.tmdbService.getTVCredits(tvShowId);
        if (credits && credits.cast) {
          data.main_cast = credits.cast.slice(0, 6);
        }
      } catch (errCredits) {
        this.logger.warn(
          `Could not fetch credits for TV Show ID ${tvShowId}:`,
          errCredits,
        );
      }

      return data;
    } catch (e: any) {
      if (e.status === 404) {
        this.logger.warn(
          `Episode details not found (404) for TV Show ID ${tvShowId}, Season ${seasonNumber}, Episode ${episodeNumber}`,
        );
      } else {
        this.logger.error(`Error fetching episode details:`, e);
      }
      return null;
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
    fonte: MediaSource,
    animeId: number,
    episodesList: any[],
    animeTitle: string,
  ) {
    return this.calendarService.autoTransitionPlannedToWatching(
      fonte,
      animeId,
      episodesList,
      animeTitle,
    );
  }

  // -------------------------------------------------------------
  // CORE LOCAL CATALOG & USER LIST METHODS (CRUD, SYNC)
  // -------------------------------------------------------------

  async backgroundUpdateAnime(
    fonte: MediaSource,
    animeId: number,
    userId: number,
  ) {
    try {
      const format = formatFromSource(fonte as 'TMDB_TV' | 'TMDB_MOVIE');
      const tmdbData = await this.getTmdbDetailsById(animeId, userId, format);
      if (tmdbData) {
        const generosDict = buildGenerosDict(tmdbData.genres, undefined);
        await this.anilistService.registerGenreTags(generosDict);

        let details: any = null;
        if (tmdbData.format === 'TV') {
          try {
            details = await this.tmdbService.getTVShowDetails(animeId);
          } catch (e) {
            this.logger.error(`Error fetching season details during sync:`, e);
          }
        }

        await this.prisma.anime.update({
          where: animeKey(fonte, animeId),
          data: {
            numEpisodiosTotal: tmdbData.episodes,
            capaUrl: tmdbData.coverImage.large,
            bannerUrl: tmdbData.bannerUrl ?? undefined,
            statusLancamento: tmdbData.status,
            proximoEpisodio: tmdbData.nextAiringEpisode?.episode,
            proximoEpisodioData: tmdbData.nextAiringEpisode
              ? new Date(tmdbData.nextAiringEpisode.airingAt * 1000)
              : null,
            generos: generosDict,
            dataLancamento: tmdbData.dataLancamento,
          },
        });

        if (details && details.seasons) {
          await this.syncAnimeEpisodes(fonte, animeId, details.seasons);
        }

        const averageScore = tmdbData.averageScore
          ? tmdbData.averageScore / 10
          : 0;
        const existingMedia = await this.prisma.media.findUnique({
          where: mediaKey(fonte, animeId),
        });
        if (!existingMedia) {
          await this.prisma.media.create({
            data: {
              id: animeId,
              fonte,
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
      select: {
        id: true,
        seasonAtual: true,
        epAtual: true,
        status: true,
        prioridade: true,
        linksPersonalizados: true,
        notas: true,
        userId: true,
        animeFonte: true,
        animeId: true,
        watchedSpecials: true,
        updatedAt: true,
        lastProgressUpdate: true,
        capaPersonalizada: true,
        bannerPersonalizado: true,
        anime: {
          select: {
            id: true,
            titulo: true,
            statusLancamento: true,
            capaUrl: true,
            bannerUrl: true,
            generos: true,
            descricao: true,
            numEpisodiosTotal: true,
            proximoEpisodio: true,
            proximoEpisodioData: true,
            dataLancamento: true,
            temporada: true,
            ano: true,
            paisOrigem: true,
            formato: true,
            tipo: true,
            materialOrigem: true,
            linksExternos: true,
            updatedAt: true,
            numEpisodiosAired: true,
            ultimoEpisodioEstreadoData: true,
            episodesList: true,
          }
        }
      }
    });
    // Avaliações pela chave (fonte, id) de cada anime (L-23); OR vazio não devolve nada
    const ratings = await this.prisma.media.findMany({
      where: {
        OR: list.map((item) => ({ fonte: item.animeFonte, id: item.animeId })),
      },
    });
    const ratingMap = new Map(ratings.map((r) => [`${r.fonte}:${r.id}`, r]));

    return list.map((item) => {
      const rating = ratingMap.get(`${item.animeFonte}:${item.animeId}`);
      const epLocal = this.getLocalEpisodeNumber(
        item.anime,
        item.seasonAtual,
        item.epAtual,
      );
      const numEpisodiosAired = this.getAiredEpisodesCount(item.anime);
      const totalEpisodes = numEpisodiosAired;
      const ultimoEpisodioEstreadoData = item.anime.ultimoEpisodioEstreadoData ?? item.anime.dataLancamento;

      const nextGlobal = item.epAtual + 1;
      const nextSeasonAndEp = this.getSeasonAndEpisodeFromGlobal(
        item.anime,
        nextGlobal,
      );

      return {
        id: item.id,
        fonte: item.animeFonte,
        animeId: item.animeId,
        titulo: item.anime.titulo,
        statusLancamento: item.anime.statusLancamento,
        ...resolveArtwork(item, item.anime),
        generos: item.anime.generos,
        descricao: item.anime.descricao,
        status: item.status,
        seasonAtual: item.seasonAtual,
        epAtual: epLocal,
        epAtualGlobal: item.epAtual,
        proximaSeason: nextSeasonAndEp.season,
        proximoEpLocal: nextSeasonAndEp.episode,
        numEpisodiosTotal: totalEpisodes,
        temporada: item.anime.temporada,
        ano: item.anime.ano,
        prioridade: item.prioridade,
        linksExternos: item.anime.linksExternos,
        linksPersonalizados: item.linksPersonalizados,
        notas: item.notas,
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
        dataLancamento: item.anime.dataLancamento,
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

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const lastSync = item.anime.updatedAt
      ? new Date(item.anime.updatedAt)
      : new Date(0);
    const needsSync = lastSync < twoDaysAgo;

    if (
      needsSync &&
      (item.anime.statusLancamento === 'RELEASING' ||
        (item.anime.proximoEpisodioData &&
          new Date() >= new Date(item.anime.proximoEpisodioData)))
    ) {
      // Sincronização em segundo plano (não bloqueante)
      this.syncLatestEpisode(item.animeFonte, item.animeId).catch((err) => {
        this.logger.error(
          `Error auto-syncing releasing anime ${item.animeId} during findOne:`,
          err,
        );
      });
    }
    const rating = await this.prisma.media.findUnique({
      where: mediaKey(item.animeFonte, item.animeId),
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

    const nextGlobal = item.epAtual + 1;
    const nextSeasonAndEp = this.getSeasonAndEpisodeFromGlobal(
      item.anime,
      nextGlobal,
    );

    return {
      id: item.id,
      fonte: item.animeFonte,
      animeId: item.animeId,
      titulo: item.anime.titulo,
      statusLancamento: item.anime.statusLancamento,
      ...resolveArtwork(item, item.anime),
      generos: item.anime.generos,
      descricao: item.anime.descricao,
      status: item.status,
      seasonAtual: item.seasonAtual,
      epAtual: epLocal,
      epAtualGlobal: item.epAtual,
      proximaSeason: nextSeasonAndEp.season,
      proximoEpLocal: nextSeasonAndEp.episode,
      numEpisodiosTotal: totalEpisodes,
      temporada: item.anime.temporada,
      ano: item.anime.ano,
      prioridade: item.prioridade,
      linksExternos: item.anime.linksExternos,
      linksPersonalizados: item.linksPersonalizados,
      notas: item.notas,
      proximoEpisodio: item.anime.proximoEpisodio,
      proximoEpisodioData: item.anime.proximoEpisodioData,
      episodes: item.anime.episodesList || [],
      watchedSpecials: item.watchedSpecials || [],
      tipo: item.anime.tipo,
      formato: item.anime.formato,
      updatedAt: item.updatedAt,
      lastProgressUpdate: item.lastProgressUpdate,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
      ultimoEpisodioEstreadoData,
      dataLancamento: item.anime.dataLancamento,
    };
  }

  // Atualização manual (botão na página de detalhes): pede ao TMDB as datas mais recentes dos episódios
  async refreshAnime(id: number, user: any) {
    const item = await this.prisma.userAnime.findUnique({
      where: { id },
      select: { userId: true, animeFonte: true, animeId: true },
    });
    if (!item) {
      throw new NotFoundException('Anime não encontrado na biblioteca.');
    }
    if (item.userId !== user.userId && user.tipoConta !== 'ADMIN') {
      throw new ForbiddenException(
        'Não tem permissão para aceder a este registo.',
      );
    }

    const refreshKey = `${item.animeFonte}:${item.animeId}`;
    const lastRefresh = this.lastManualRefresh.get(refreshKey) || 0;
    const skipped = Date.now() - lastRefresh < this.REFRESH_COOLDOWN_MS;

    if (!skipped) {
      this.lastManualRefresh.set(refreshKey, Date.now());
      await this.syncLatestEpisode(item.animeFonte, item.animeId);
    }

    const anime = await this.findOne(id, user);
    return { refreshed: !skipped, anime };
  }

  async update(
    id: number,
    updateDto: any,
    user: any,
    options: { lite?: boolean } = {},
  ) {
    const atual = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true },
    });
    if (!atual) {
      throw new NotFoundException('Anime não encontrado na biblioteca.');
    }

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
        where: animeKey(atual.animeFonte, atual.animeId),
        data: updateData,
      });
      atual.anime.numEpisodiosTotal = total;
    }

    if (updateDto.tipo !== undefined) {
      await this.prisma.anime.update({
        where: animeKey(atual.animeFonte, atual.animeId),
        data: { tipo: updateDto.tipo },
      });
      atual.anime.tipo = updateDto.tipo;
    }

    const novosDados = { ...updateDto };
    delete novosDados.numEpisodiosTotal;
    delete novosDados.tipo;
    delete novosDados.capaUrl;
    delete novosDados.bannerUrl;
    delete novosDados.epAtualGlobal;
    // Capa/banner escolhidos ficam na entrada do utilizador, não no catálogo global (L-15)
    Object.assign(novosDados, artworkUpdateData(updateDto));

    let globalEp: number | undefined;
    if (updateDto.epAtualGlobal !== undefined) {
      globalEp = updateDto.epAtualGlobal;
    } else if (updateDto.epAtual !== undefined) {
      const incomingSeason =
        updateDto.seasonAtual !== undefined
          ? updateDto.seasonAtual
          : atual.seasonAtual;
      globalEp = this.getGlobalEpisodeNumber(
        atual.anime,
        incomingSeason,
        updateDto.epAtual,
      );
    }

    const totalEpisodes = this.getTotalEpisodes(atual.anime);
    const hasEpisodeList =
      Array.isArray(atual.anime.episodesList) &&
      atual.anime.episodesList.length > 0;
    const regras = aplicarRegrasDeProgresso(
      { status: atual.status, progresso: atual.epAtual },
      {
        terminada: atual.anime.statusLancamento === 'FINISHED',
        total: totalEpisodes,
        ultimoDisponivel:
          atual.anime.statusLancamento === 'RELEASING' &&
          atual.anime.proximoEpisodio
            ? atual.anime.proximoEpisodio - 1
            : totalEpisodes,
        limiteLancado: hasEpisodeList || totalEpisodes > 0 ? totalEpisodes : null,
        limitarAoTotal: true,
      },
      { status: updateDto.status, progresso: globalEp },
    );

    if (regras.status !== undefined) novosDados.status = regras.status;
    if (regras.wasDropped) novosDados.wasDropped = true;
    if (regras.lastProgressUpdate) {
      novosDados.lastProgressUpdate = regras.lastProgressUpdate;
    }
    if (regras.progresso !== undefined) {
      // O progresso é guardado como episódio global (RN-17); a temporada deriva dele
      novosDados.epAtual = regras.progresso;
      novosDados.seasonAtual = this.getSeasonAndEpisodeFromGlobal(
        atual.anime,
        regras.progresso,
      ).season;
    }

    // O anime já foi carregado (e mantido atualizado em memória) acima: não voltar a ler o episodesList
    const [updatedRow, rating] = await Promise.all([
      this.prisma.userAnime.update({
        where: { id },
        data: novosDados,
      }),
      this.prisma.media.findUnique({
        where: mediaKey(atual.animeFonte, atual.animeId),
      }),
    ]);
    const updated = { ...updatedRow, anime: atual.anime };
    this.recalculateUserStats(updated.userId).catch((err) => {
      console.error('Error recalculating user stats in background:', err);
    });
    const epLocal = this.getLocalEpisodeNumber(
      updated.anime,
      updated.seasonAtual,
      updated.epAtual,
    );
    const totalEpisodesUpdated = this.getTotalEpisodes(updated.anime);

    const nextGlobal = updated.epAtual + 1;
    const nextSeasonAndEp = this.getSeasonAndEpisodeFromGlobal(
      updated.anime,
      nextGlobal,
    );

    return {
      id: updated.id,
      fonte: updated.animeFonte,
      animeId: updated.animeId,
      titulo: updated.anime.titulo,
      statusLancamento: updated.anime.statusLancamento,
      ...resolveArtwork(updated, updated.anime),
      generos: updated.anime.generos,
      descricao: updated.anime.descricao,
      status: updated.status,
      seasonAtual: updated.seasonAtual,
      epAtual: epLocal,
      epAtualGlobal: updated.epAtual,
      proximaSeason: nextSeasonAndEp.season,
      proximoEpLocal: nextSeasonAndEp.episode,
      numEpisodiosTotal: totalEpisodesUpdated,
      numEpisodiosAired: this.getAiredEpisodesCount(updated.anime),
      temporada: updated.anime.temporada,
      ano: updated.anime.ano,
      prioridade: updated.prioridade,
      linksExternos: updated.anime.linksExternos,
      linksPersonalizados: updated.linksPersonalizados,
      notas: updated.notas,
      dataLancamento: updated.anime.dataLancamento,
      proximoEpisodio: updated.anime.proximoEpisodio,
      proximoEpisodioData: updated.anime.proximoEpisodioData,
      ...(options.lite ? {} : { episodes: updated.anime.episodesList || [] }),
      watchedSpecials: updated.watchedSpecials || [],
      tipo: updated.anime.tipo,
      updatedAt: updated.updatedAt,
      lastProgressUpdate: updated.lastProgressUpdate,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async updateLastModified(
    fonte: MediaSource,
    id: number,
    date: Date = new Date(),
  ) {
    return this.prisma.anime.update({
      where: animeKey(fonte, id),
      data: { updatedAt: date },
    });
  }

  async remove(id: number, user: any) {
    const atual = await this.prisma.userAnime.findUnique({
      where: { id },
    });
    if (!atual) {
      throw new NotFoundException('Anime não encontrado na biblioteca.');
    }

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

  async syncLatestEpisode(fonte: MediaSource, tmdbId: number) {
    const dbAnime = await this.prisma.anime.findUnique({
      where: animeKey(fonte, tmdbId),
    });
    if (!dbAnime) return { latest: null };

    // O formato vem da fonte: o TMDB não é consultado como série e depois como filme (L-23)
    const media = await this.getTmdbDetailsById(
      tmdbId,
      undefined,
      formatFromSource(fonte as 'TMDB_TV' | 'TMDB_MOVIE'),
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
      where: animeKey(fonte, tmdbId),
      data: {
        numEpisodiosTotal: media.episodes,
        capaUrl: media.coverImage.large,
        bannerUrl: media.bannerUrl ?? undefined,
        statusLancamento: media.status,
        proximoEpisodio: media.nextAiringEpisode?.episode,
        proximoEpisodioData: media.nextAiringEpisode
          ? new Date(media.nextAiringEpisode.airingAt * 1000)
          : null,
        dataLancamento: media.dataLancamento,
      },
    });

    if (details && details.seasons) {
      await this.syncAnimeEpisodes(fonte, tmdbId, details.seasons);
    }

    const updatedAnime = await this.prisma.anime.findUnique({
      where: animeKey(fonte, tmdbId),
    });
    if (!updatedAnime || !updatedAnime.episodesList) {
      return { latest: null, source: 'TMDB', notificationsSent: 0 };
    }

    const episodes = updatedAnime.episodesList as any[];

    // Auto-transition completed trackers to WATCHING if new episodes are detected
    const totalListEpisodes = episodes.filter((ep: any) => ep.season > 0).length;
    const completedUserAnimes = await this.prisma.userAnime.findMany({
      where: {
        animeFonte: fonte,
        animeId: tmdbId,
        status: 'COMPLETED',
      },
    });

    for (const ua of completedUserAnimes) {
      if (ua.epAtual < totalListEpisodes) {
        await this.prisma.userAnime.update({
          where: { id: ua.id },
          data: {
            status: 'WATCHING',
            lastProgressUpdate: new Date(),
          },
        });
        this.logger.log(
          `[AutoTransition] Moved user ${ua.userId} tracking of anime "${dbAnime.titulo}" (${tmdbId}) from COMPLETED to WATCHING because new episodes/seasons were detected (${ua.epAtual} < ${totalListEpisodes}).`,
        );
      }
    }
    let episodesUpdated = false;
    const now = new Date();
    let notificationCount = 0;

    const userAnimes = await this.prisma.userAnime.findMany({
      where: {
        animeFonte: fonte,
        animeId: tmdbId,
        status: 'WATCHING',
      },
      include: {
        user: {
          select: {
            id: true,
            preferences: true,
          },
        },
      },
    });

    for (const ep of episodes) {
      if (ep.airDate) {
        const epDate = new Date(ep.airDate);
        if (now >= epDate && !ep.notified) {
          if (Number(ep.season) > 0) {
            for (const ua of userAnimes) {
              const userPrefs = ua.user?.preferences as any;
              const notifyWeeklyEpisodes = userPrefs?.notifyWeeklyEpisodes !== false;
              const isPremiere = Number(ep.episodeNumber) === 1;

              if (!isPremiere && !notifyWeeklyEpisodes) {
                continue;
              }

              const title = isPremiere
                ? 'Estreia de Nova Temporada / Série!'
                : 'Novo episódio de Série/Anime!';
              const message = isPremiere
                ? `O 1º episódio da Temporada ${ep.season} de "${dbAnime.titulo}" estreou!`
                : `O episódio ${ep.episodeNumber} da Temporada ${ep.season} de "${dbAnime.titulo}" estreou!`;

              await this.notificationService.createOrReplaceNotification(
                ua.userId,
                title,
                message,
                'ANIME',
                { fonte, id: tmdbId },
              );
            }
            notificationCount++;
          }
          ep.notified = true;
          episodesUpdated = true;
        }
      }
    }

    if (episodesUpdated) {
      const { numEpisodiosAired, ultimoEpisodioEstreadoData } =
        this.calculateAiredEpisodesInfo(episodes);

      await this.prisma.anime.update({
        where: animeKey(fonte, tmdbId),
        data: {
          episodesList: episodes,
          numEpisodiosAired,
          ultimoEpisodioEstreadoData,
        },
      });
    }

    return {
      latest: episodes,
      source: 'TMDB',
      notificationsSent: notificationCount,
    };
  }

  async syncAnimeEpisodes(
    fonte: MediaSource,
    animeId: number,
    detailsSeasons: any[],
  ) {
    try {
      const anime = await this.prisma.anime.findUnique({
        where: animeKey(fonte, animeId),
      });
      if (!anime) {
        this.logger.warn(
          `Anime ID ${animeId} not found in DB, skipping episodes sync.`,
        );
        return;
      }

      // Map to keep track of already notified episodes
      const existingNotifiedMap = new Map<string, boolean>();
      let isFirstTimeSync = true;
      if (anime.episodesList) {
        try {
          const list = anime.episodesList as any[];
          if (list.length > 0) {
            isFirstTimeSync = false;
          }
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
          let isNotified = existingNotifiedMap.get(key);

          if (isNotified === undefined) {
            if (isFirstTimeSync && airDateVal) {
              const epDate = new Date(airDateVal);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (epDate < today) {
                isNotified = true;
              } else {
                isNotified = false;
              }
            } else {
              isNotified = false;
            }
          }

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

      const { numEpisodiosAired, ultimoEpisodioEstreadoData } =
        this.calculateAiredEpisodesInfo(episodesList);

      await this.prisma.anime.update({
        where: animeKey(fonte, animeId),
        data: {
          episodesList,
          numEpisodiosAired,
          ultimoEpisodioEstreadoData,
        },
      });

      await this.autoTransitionPlannedToWatching(
        fonte,
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
      // Só obras de fontes de anime (TMDB_TV / TMDB_MOVIE): mangas com o mesmo id ficam intactos
      const animes = await this.prisma.anime.findMany({
        select: { fonte: true, id: true },
      });
      const animeRefs = animes.map((a) => ({ fonte: a.fonte, mediaId: a.id }));

      await this.prisma.userAnime.deleteMany({});
      await this.prisma.customListItem.deleteMany({
        where: { fonte: { in: ANIME_SOURCES } },
      });
      await this.prisma.comment.deleteMany({
        where: { OR: animeRefs },
      });
      await this.prisma.userRating.deleteMany({
        where: { OR: animeRefs },
      });
      await this.prisma.anime.deleteMany({});
      await this.prisma.media.deleteMany({
        where: { OR: animes.map((a) => ({ fonte: a.fonte, id: a.id })) },
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
    return this.statisticsService.recalculateUserStats(userId);
  }

  calculateAiredEpisodesInfo(episodesList: any[]) {
    let numEpisodiosAired = 0;
    let ultimoEpisodioEstreadoData: Date | null = null;

    if (episodesList && Array.isArray(episodesList)) {
      const now = new Date();
      const airedEpisodes = episodesList.filter(
        (ep) => ep.season > 0 && ep.airDate && new Date(ep.airDate) <= now,
      );
      numEpisodiosAired = airedEpisodes.length;
      if (airedEpisodes.length > 0) {
        const dates = airedEpisodes.map((ep) => new Date(ep.airDate).getTime());
        ultimoEpisodioEstreadoData = new Date(Math.max(...dates));
      }
    }
    return { numEpisodiosAired, ultimoEpisodioEstreadoData };
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

  // Episódios já estreados, com a mesma regra usada pela validação do update:
  // lista de episódios (contagem ao vivo) > valor guardado no sync > fallback pelo AniList
  getAiredEpisodesCount(anime: any): number {
    if (!anime) return 0;
    if (
      anime.episodesList &&
      Array.isArray(anime.episodesList) &&
      anime.episodesList.length > 0
    ) {
      return this.getTotalEpisodes(anime);
    }
    if (anime.numEpisodiosAired !== null && anime.numEpisodiosAired !== undefined) {
      return anime.numEpisodiosAired;
    }
    if (anime.statusLancamento === 'RELEASING' && anime.proximoEpisodio) {
      return anime.proximoEpisodio - 1;
    }
    if (
      anime.statusLancamento === 'FINISHED' ||
      anime.statusLancamento === 'COMPLETED' ||
      anime.statusLancamento === 'CANCELED'
    ) {
      return anime.numEpisodiosTotal || 0;
    }
    return 0;
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
