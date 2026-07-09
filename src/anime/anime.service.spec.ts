import { Test, TestingModule } from '@nestjs/testing';
import { AnimeService } from './anime.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';
import { TMDBService } from './tmdb.service';

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
    userAchievement: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    userTopFavorite: {
      count: jest.fn(),
    },
  };

  const mockListService = {};

  const mockTMDBService = {
    findByTVDBId: jest.fn(),
    search: jest.fn(),
    getTVShowDetails: jest.fn(),
    getMovieDetails: jest.fn(),
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
      expect(mockPrismaService.anime.findUnique).toHaveBeenCalledWith({ where: { id: 101 } });
      expect(mockPrismaService.userAnime.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
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
});
