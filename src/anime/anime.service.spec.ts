import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AnimeService } from './anime.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';
import { TMDBService } from './tmdb.service';
import { AniListService } from './anilist.service';
import { RecommendationService } from './recommendation.service';
import { TVTimeImportService } from './tvtime-import.service';
import { CalendarService } from './calendar.service';
import { NotificationService } from '../notification/notification.service';
import { StatisticsService } from '../statistics/statistics.service';
import { SyncNotFoundError, SyncTransientError } from '../common/sync-errors';
import { CircuitOpenError } from '../common/circuit-breaker';
import { EpisodeStoreService } from './episode-store.service';

describe('AnimeService', () => {
  let service: AnimeService;
  let prisma: PrismaService;
  let tmdbService: TMDBService;

  const mockPrismaService = {
    anime: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userAnime: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      updateManyAndReturn: jest.fn(),
    },
    userManga: {
      findMany: jest.fn(),
    },
    genreTag: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userStatistics: {
      upsert: jest.fn(),
    },
    userTopFavorite: {
      count: jest.fn(),
    },
    media: {
      findUnique: jest.fn(),
    },
  };

  const mockListService = {};

  const mockNotificationService = { createOrReplaceNotification: jest.fn() };

  const mockEpisodeStore = { applyEpisodes: jest.fn(), processAired: jest.fn() };

  const mockTMDBService = {
    findByTVDBId: jest.fn(),
    search: jest.fn(),
    getTVShowDetails: jest.fn(),
    getMovieDetails: jest.fn(),
    getTVSeasonDetails: jest.fn(),
  };

  let originalFetch: any;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnimeService,
        AniListService,
        RecommendationService,
        TVTimeImportService,
        CalendarService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ListService,
          useValue: mockListService,
        },
        {
          provide: TMDBService,
          useValue: mockTMDBService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: EpisodeStoreService,
          useValue: mockEpisodeStore,
        },
        {
          provide: StatisticsService,
          useValue: { recalculateUserStats: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AnimeService>(AnimeService);
    prisma = module.get<PrismaService>(PrismaService);
    tmdbService = module.get<TMDBService>(TMDBService);

    // Global spy to prevent real executions of stats recalculation
    jest.spyOn(service, 'recalculateUserStats').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('importFromTVTime', () => {
    it('should throw error if input is not an array', async () => {
      await expect(service.importFromTVTime(1, {} as any)).rejects.toThrow(
        'Formato inválido. O arquivo JSON deve ser um array.',
      );
      // L-17: erro de validação é 400, não 500
      await expect(service.importFromTVTime(1, {} as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('should throw error if an import is already running for the user', async () => {
      // Simulate active import status directly
      service['tvTimeImportStatus'].set(1, {
        isImporting: true,
        total: 10,
        processed: 0,
        currentShow: 'Processing',
        errors: [],
        importedShows: [],
      });

      // Attempt another one
      await expect(service.importFromTVTime(1, [])).rejects.toThrow(
        'Já existe uma importação de dados em andamento.',
      );
      await expect(service.importFromTVTime(1, [])).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('should initialize status and return success message, spawning import in background', async () => {
      const result = await service.importFromTVTime(2, []);
      expect(result).toEqual({
        message: 'Importação iniciada com sucesso em segundo plano.',
      });
      const status = service.getTvTimeImportStatus(2);
      expect(status.isImporting).toBe(false); // background runner finishes immediately on empty array
    });
  });

  describe('runTVTimeImportBackground', () => {
    const userId = 10;
    const mockAnime = {
      id: 101,
      titulo: 'Test Show',
      capaUrl: 'http://example.com/cover.jpg',
      numEpisodiosTotal: 12,
      statusLancamento: 'FINISHED',
      episodesList: [
        { season: 1, episodeNumber: 1 },
        { season: 1, episodeNumber: 2 },
        { season: 1, episodeNumber: 3 },
      ],
      generos: { Action: 100 },
      paisOrigem: 'JP',
    };

    beforeEach(() => {
      // Initialize the status so the background runner doesn't exit early
      service['tvTimeImportStatus'].set(userId, {
        isImporting: true,
        total: 1,
        processed: 0,
        currentShow: 'A iniciar...',
        errors: [],
        importedShows: [],
      });
    });

    it('should resolve show using TVDB ID and save watcher progress', async () => {
      const tvTimeShows = [
        {
          title: 'Test Show',
          id: { tvdb: '9999' },
          status: 'watching',
          seasons: [
            {
              number: '1',
              episodes: [
                { number: '1', is_watched: true },
                { number: '2', is_watched: true },
              ],
            },
          ],
        },
      ];

      mockTMDBService.findByTVDBId.mockResolvedValue({ id: 101 });
      mockPrismaService.anime.findUnique.mockResolvedValue(mockAnime);
      mockPrismaService.userAnime.findUnique.mockResolvedValue(null);
      mockPrismaService.userAnime.create.mockResolvedValue({
        id: 50,
        userId,
        animeId: 101,
        status: 'WATCHING',
        epAtual: 2,
        seasonAtual: 1,
        anime: mockAnime,
      });

      // Directly invoke background execution to ensure sequential assertions
      await service['runTVTimeImportBackground'](userId, tvTimeShows);

      expect(tmdbService.findByTVDBId).toHaveBeenCalledWith(9999);
      // L-23: o anime é procurado pela chave (fonte, id); o TV Time só tem séries
      expect(mockPrismaService.anime.findUnique).toHaveBeenCalledWith({
        where: { fonte_id: { fonte: 'TMDB_TV', id: 101 } },
      });
      expect(mockPrismaService.userAnime.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          animeFonte: 'TMDB_TV',
          animeId: 101,
          seasonAtual: 1,
          epAtual: 2,
          status: 'WATCHING',
        }),
      });
      expect(service.recalculateUserStats).toHaveBeenCalledWith(userId);
    });

    it('should fall back to title search if TVDB ID lookup fails or is missing', async () => {
      const tvTimeShows = [
        {
          title: 'Fallback Search Show',
          status: 'completed',
          seasons: [
            {
              number: '1',
              episodes: [{ number: '1', is_watched: true }],
            },
          ],
        },
      ];

      mockTMDBService.search.mockResolvedValue([{ id: 102 }]);
      mockPrismaService.anime.findUnique.mockResolvedValue({
        ...mockAnime,
        id: 102,
        numEpisodiosTotal: 1,
      });
      mockPrismaService.userAnime.findUnique.mockResolvedValue(null);
      mockPrismaService.userAnime.create.mockResolvedValue({});

      await service['runTVTimeImportBackground'](userId, tvTimeShows);

      expect(tmdbService.search).toHaveBeenCalledWith('Fallback Search Show');
      expect(mockPrismaService.userAnime.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          animeId: 102,
          seasonAtual: 1,
          epAtual: 1,
          status: 'COMPLETED',
        }),
      });
    });

    it('should log an error in the import status if both TVDB ID and title search fail', async () => {
      const tvTimeShows = [
        {
          title: 'Unresolvable Show',
        },
      ];

      mockTMDBService.search.mockResolvedValue([]);

      await service['runTVTimeImportBackground'](userId, tvTimeShows);

      const status = service.getTvTimeImportStatus(userId);
      expect(status.errors.length).toBeGreaterThan(0);
      expect(status.errors[0]).toContain('Não foi possível mapear a série');
    });
  });

  describe('getRecommendations', () => {
    const userId = 20;

    const mockGenreTags = [
      { name: 'Action', type: 'GENRE' },
      { name: 'Adventure', type: 'GENRE' },
      { name: 'Comedy', type: 'GENRE' },
      { name: 'Mecha', type: 'TAG' },
    ];

    const mockUserAnimeHistory = [
      {
        animeId: 201,
        status: 'COMPLETED',
        anime: {
          generos: 'Action, Adventure',
          paisOrigem: 'JP',
          titulo: 'Action Show',
        },
      },
      {
        animeId: 202,
        status: 'DROPPED',
        anime: {
          generos: 'Comedy',
          paisOrigem: 'KR',
          titulo: 'Comedy Show',
        },
      },
    ];

    beforeEach(() => {
      mockPrismaService.genreTag.findMany.mockResolvedValue(mockGenreTags);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, showAdultContent: true });
    });

    it('should return recommended anime, filtering out items already in the user library', async () => {
      mockPrismaService.userAnime.findMany.mockResolvedValue(mockUserAnimeHistory);

      const mockGraphQLResponse = {
        data: {
          Page: {
            media: [
              {
                id: 201, // Already in library, should be filtered out
                title: { english: 'Action Show', romaji: 'Action Show Romaji' },
                genres: ['Action'],
                tags: [],
              },
              {
                id: 301, // New recommendation
                title: { english: 'New Anime Rec', romaji: 'New Anime Rec Romaji' },
                genres: ['Action', 'Adventure'],
                tags: [],
              },
            ],
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockGraphQLResponse),
      });

      const recommendations = await service.getRecommendations('ANIME', userId, 1);

      expect(mockPrismaService.userAnime.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { anime: true },
      });
      expect(global.fetch).toHaveBeenCalled();
      expect(recommendations.length).toBe(1);
      expect(recommendations[0].id).toBe(301);
    });

    it('should return recommended manga using user manga history and filtering appropriately', async () => {
      const mockUserMangaHistory = [
        {
          mangaId: 501,
          status: 'COMPLETED',
          manga: {
            generos: 'Adventure',
            paisOrigem: 'JP',
          },
        },
      ];

      mockPrismaService.userManga.findMany.mockResolvedValue(mockUserMangaHistory);

      const mockGraphQLResponse = {
        data: {
          Page: {
            media: [
              {
                id: 501, // Already in library
                title: { english: 'Old Manga', romaji: 'Old Manga Romaji' },
                genres: ['Adventure'],
                tags: [],
              },
              {
                id: 601, // New recommendation
                title: { english: 'New Manga Rec', romaji: 'New Manga Rec Romaji' },
                genres: ['Adventure'],
                tags: [],
              },
            ],
          },
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockGraphQLResponse),
      });

      const recommendations = await service.getRecommendations('MANGA', userId, 1);

      expect(mockPrismaService.userManga.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { manga: true },
      });
      expect(recommendations.length).toBe(1);
      expect(recommendations[0].id).toBe(601);
    });
  });

  describe('update', () => {
    const userId = 10;
    const user = { userId, tipoConta: 'USER' };

    // L-14: entrada inexistente devolve 404 em vez de 200 vazio
    it('should throw NotFoundException when the library entry does not exist', async () => {
      mockPrismaService.userAnime.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { epAtual: 1 }, user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.remove(999, user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should auto-complete a finished anime when the user marks the last episode as seen', async () => {
      const mockAnimeFinished = {
        id: 101,
        titulo: 'Finished Show',
        statusLancamento: 'FINISHED',
        episodesList: [
          { season: 1, episodeNumber: 1, airDate: new Date('2020-01-01').toISOString() },
          { season: 1, episodeNumber: 2, airDate: new Date('2020-01-02').toISOString() },
        ],
      };

      const mockUserAnime = {
        id: 50,
        userId,
        animeId: 101,
        status: 'WATCHING',
        epAtual: 1,
        seasonAtual: 1,
        anime: mockAnimeFinished,
      };

      mockPrismaService.userAnime.findUnique.mockResolvedValue(mockUserAnime);
      mockPrismaService.media.findUnique.mockResolvedValue({ id: 101 });
      mockPrismaService.userAnime.update.mockResolvedValue({
        ...mockUserAnime,
        status: 'COMPLETED',
        epAtual: 2,
      });

      const result = await service.update(50, { epAtual: 2, seasonAtual: 1 }, user);

      expect(mockPrismaService.userAnime.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 50 },
          data: expect.objectContaining({
            status: 'COMPLETED',
            epAtual: 2,
          }),
        }),
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('should NOT auto-complete a releasing anime when the user marks the last available episode as seen', async () => {
      const mockAnimeReleasing = {
        id: 102,
        titulo: 'Releasing Show',
        statusLancamento: 'RELEASING',
        episodesList: [
          { season: 1, episodeNumber: 1, airDate: new Date('2020-01-01').toISOString() },
          { season: 1, episodeNumber: 2, airDate: new Date('2020-01-02').toISOString() },
        ],
      };

      const mockUserAnime = {
        id: 51,
        userId,
        animeId: 102,
        status: 'WATCHING',
        epAtual: 1,
        seasonAtual: 1,
        anime: mockAnimeReleasing,
      };

      mockPrismaService.userAnime.findUnique.mockResolvedValue(mockUserAnime);
      mockPrismaService.media.findUnique.mockResolvedValue({ id: 102 });
      mockPrismaService.userAnime.update.mockResolvedValue({
        ...mockUserAnime,
        status: 'WATCHING',
        epAtual: 2,
      });

      const result = await service.update(51, { epAtual: 2, seasonAtual: 1 }, user);

      expect(mockPrismaService.userAnime.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 51 },
          data: expect.objectContaining({
            epAtual: 2,
          }),
        }),
      );
      
      const updateCalls = mockPrismaService.userAnime.update.mock.calls;
      const lastCallArgs = updateCalls[updateCalls.length - 1][0];
      expect(lastCallArgs.data.status).toBeUndefined();
      expect(result.status).toBe('WATCHING');
    });

    it('should correctly calculate proximaSeason and proximoEpLocal for multi-season anime', async () => {
      const mockAnimeMultiSeason = {
        id: 103,
        titulo: 'Multi Season Show',
        statusLancamento: 'FINISHED',
        episodesList: [
          { season: 1, episodeNumber: 1, airDate: new Date('2020-01-01').toISOString() },
          { season: 1, episodeNumber: 2, airDate: new Date('2020-01-02').toISOString() },
          { season: 2, episodeNumber: 1, airDate: new Date('2020-02-01').toISOString() },
          { season: 2, episodeNumber: 2, airDate: new Date('2020-02-02').toISOString() },
        ],
      };

      const mockUserAnime = {
        id: 52,
        userId,
        animeId: 103,
        status: 'WATCHING',
        epAtual: 1,
        seasonAtual: 1,
        anime: mockAnimeMultiSeason,
      };

      mockPrismaService.userAnime.findUnique.mockResolvedValue(mockUserAnime);
      mockPrismaService.media.findUnique.mockResolvedValue({ id: 103 });
      mockPrismaService.userAnime.update.mockResolvedValue({
        ...mockUserAnime,
        epAtual: 2,
        seasonAtual: 1,
      });

      const result = await service.update(52, { epAtual: 2, seasonAtual: 1 }, user);

      // Since the user watched Season 1 Ep 2 (global 2), the next episode to watch is Season 2 Ep 1 (global 3).
      expect(result.proximaSeason).toBe(2);
      expect(result.proximoEpLocal).toBe(1);
    });
  });

  describe('syncLatestEpisode', () => {
    const tmdbId = 123;
    const AIRED = '2023-01-01';
    const FUTURE = '2999-01-01';
    // Linha da tabela Anime em memória: findUnique lê-a e update grava nela
    let row: any;

    const tvDetails = {
      id: tmdbId,
      name: 'Test Anime',
      status: 'Returning Series',
      number_of_episodes: 3,
      seasons: [{ season_number: 1 }, { season_number: 2 }],
    };
    const season1 = {
      episodes: [{ season_number: 1, episode_number: 1, air_date: AIRED }],
    };
    const season2 = {
      episodes: [
        { season_number: 2, episode_number: 1, air_date: AIRED },
        { season_number: 2, episode_number: 2, air_date: FUTURE },
      ],
    };

    beforeEach(() => {
      row = { titulo: 'Test Anime', syncFailures: 0 };
      mockPrismaService.anime.findUnique
        .mockReset()
        .mockImplementation(async () => row);
      mockPrismaService.anime.update
        .mockReset()
        .mockImplementation(async ({ data }: any) => Object.assign(row, data));
      mockEpisodeStore.applyEpisodes
        .mockReset()
        .mockResolvedValue({ total: 3, changed: true, notificationsSent: 1 });
      mockEpisodeStore.processAired
        .mockReset()
        .mockResolvedValue({ notificationsSent: 2 });
      mockTMDBService.getTVShowDetails.mockReset().mockResolvedValue(tvDetails);
      mockTMDBService.getMovieDetails.mockReset();
      mockTMDBService.getTVSeasonDetails
        .mockReset()
        .mockImplementation(async (_id: number, season: number) =>
          season === 1 ? season1 : season2,
        );
    });

    it('applies the complete episode list in one go and records the success', async () => {
      const result = await service.syncLatestEpisode('TMDB_TV', tmdbId);

      expect(mockEpisodeStore.applyEpisodes).toHaveBeenCalledTimes(1);
      const [fonte, id, titulo, episodes] =
        mockEpisodeStore.applyEpisodes.mock.calls[0];
      expect([fonte, id, titulo]).toEqual(['TMDB_TV', tmdbId, 'Test Anime']);
      // A numeração global segue a ordem das temporadas
      expect(
        episodes.map((ep: any) => [
          ep.season,
          ep.episodeNumber,
          ep.globalEpisodeNumber,
        ]),
      ).toEqual([
        [1, 1, 1],
        [2, 1, 2],
        [2, 2, 3],
      ]);
      expect(episodes[0].airDate).toBeInstanceOf(Date);

      expect(result).toEqual({ source: 'TMDB', notificationsSent: 1 });
      expect(row.statusLancamento).toBe('RELEASING');
      expect(row.syncStatus).toBe('OK');
      expect(row.syncFailures).toBe(0);
      expect(row.lastSyncedAt).toBeInstanceOf(Date);
      expect(row.nextSyncAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('does not apply a partial episode list when a season fails, and records the failure', async () => {
      mockTMDBService.getTVSeasonDetails.mockImplementation(
        async (_id: number, season: number) => {
          if (season === 2) throw new Error('TMDB API error: HTTP 503');
          return season1;
        },
      );

      await expect(
        service.syncLatestEpisode('TMDB_TV', tmdbId),
      ).rejects.toBeInstanceOf(SyncTransientError);

      expect(mockEpisodeStore.applyEpisodes).not.toHaveBeenCalled();
      expect(row.syncFailures).toEqual({ increment: 1 });
      expect(row.nextSyncAt.getTime()).toBeGreaterThan(Date.now());
      expect(row.syncStatus).toBeUndefined();
    });

    it('marks the anime as GONE on a 404 without trying the ID as a movie', async () => {
      mockTMDBService.getTVShowDetails.mockRejectedValue(
        Object.assign(new Error('TMDB API error: HTTP 404'), { status: 404 }),
      );

      await expect(
        service.syncLatestEpisode('TMDB_TV', tmdbId),
      ).rejects.toBeInstanceOf(SyncNotFoundError);

      expect(row.syncStatus).toBe('GONE');
      expect(mockTMDBService.getMovieDetails).not.toHaveBeenCalled();
      expect(mockEpisodeStore.applyEpisodes).not.toHaveBeenCalled();
    });

    it('does not blame the anime when the provider circuit is open', async () => {
      mockTMDBService.getTVShowDetails.mockRejectedValue(
        new CircuitOpenError('tmdb', new Date(Date.now() + 60_000)),
      );

      await expect(
        service.syncLatestEpisode('TMDB_TV', tmdbId),
      ).rejects.toBeInstanceOf(CircuitOpenError);

      expect(mockPrismaService.anime.update).not.toHaveBeenCalled();
      expect(row.syncFailures).toBe(0);
    });

    it('shares one run between concurrent calls for the same anime', async () => {
      const [a, b] = await Promise.all([
        service.syncLatestEpisode('TMDB_TV', tmdbId),
        service.syncLatestEpisode('TMDB_TV', tmdbId),
      ]);

      expect(a).toBe(b);
      expect(mockTMDBService.getTVShowDetails).toHaveBeenCalledTimes(1);
    });
  });
});
