import { MangaSyncService } from './manga-sync.service';
import {
  SyncNotFoundError,
  SyncTransientError,
} from '../common/sync-errors';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: { get: () => null },
    json: async () => body,
  }) as unknown as Response;

describe('MangaSyncService.syncLatestChapter', () => {
  const originalFetch = global.fetch;
  const mangaId = 55;
  let manga: any; // linha da tabela Manga em memória
  let prisma: any;
  let anilist: { fetchAniListMangaById: jest.Mock };
  let notifications: { replaceMany: jest.Mock };
  let fetchMock: jest.Mock;
  let service: MangaSyncService;

  // Respostas das fontes de capítulos, por URL
  let bakaChapters: number | Error;
  let mangaDexLastChapter: string | null | Error;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    manga = {
      id: mangaId,
      titulo: 'Test Manga',
      numCapitulosTotal: 100,
      mangaUpdatesId: null,
      mangaDexId: null,
      syncFailures: 0,
    };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      manga: {
        findUnique: jest.fn(async () => ({ ...manga })),
        update: jest.fn(async ({ data }: any) => Object.assign(manga, data)),
        // O UPDATE condicional: só avança se o total guardado for menor
        updateMany: jest.fn(async ({ where, data }: any) => {
          const lt = where.OR[1].numCapitulosTotal.lt;
          if (manga.numCapitulosTotal !== null && manga.numCapitulosTotal >= lt) {
            return { count: 0 };
          }
          Object.assign(manga, data);
          return { count: 1 };
        }),
      },
      userManga: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ userId: 7 }, { userId: 8 }]),
      },
    };
    anilist = {
      fetchAniListMangaById: jest.fn().mockResolvedValue({
        id: mangaId,
        title: { english: 'Test Manga', romaji: 'Tesuto Manga' },
        status: 'RELEASING',
        chapters: null,
      }),
    };
    notifications = { replaceMany: jest.fn() };

    bakaChapters = 120;
    mangaDexLastChapter = null;
    fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith('/series/search')) {
        if (bakaChapters instanceof Error) throw bakaChapters;
        return jsonResponse({
          results: [
            { record: { series_id: 777, title: 'Test Manga', type: 'Manga' } },
          ],
        });
      }
      if (url.includes('/series/')) {
        if (bakaChapters instanceof Error) throw bakaChapters;
        return jsonResponse({ status: `${bakaChapters} Chapters (Ongoing)` });
      }
      if (url.includes('mangadex.org/manga?')) {
        if (mangaDexLastChapter instanceof Error) throw mangaDexLastChapter;
        return jsonResponse({
          data: [
            {
              id: 'md-uuid',
              attributes: {
                links: { al: String(mangaId) },
                lastChapter: mangaDexLastChapter,
                title: { en: 'Test Manga' },
              },
            },
          ],
        });
      }
      if (url.includes('/feed')) return jsonResponse({ data: [] });
      throw new Error(`unexpected URL in test: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new MangaSyncService(
      prisma,
      anilist as any,
      notifications as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('advances the total, reopens completed readers and notifies once, in one transaction', async () => {
    const result = await service.syncLatestChapter(mangaId);

    expect(result).toMatchObject({ latest: 120, source: 'Baka-Updates' });
    expect(manga.numCapitulosTotal).toBe(120);
    expect(manga.proximoCapituloNumero).toBe(121);
    expect(manga.statusLancamento).toBe('RELEASING');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.userManga.updateMany).toHaveBeenCalledWith({
      where: { mangaId, status: 'COMPLETED', capAtual: { lt: 120 } },
      data: expect.objectContaining({ status: 'WATCHING' }),
    });
    expect(notifications.replaceMany).toHaveBeenCalledTimes(1);
    const [tx, items, type, media] = notifications.replaceMany.mock.calls[0];
    expect(tx).toBe(prisma);
    expect(items.map((n: any) => n.userId)).toEqual([7, 8]);
    expect(items[0].message).toContain('capítulo 120');
    expect([type, media]).toEqual(['MANGA', { fonte: 'ANILIST', id: mangaId }]);

    // Estado de sincronização e ID da fonte guardados
    expect(manga.mangaUpdatesId).toBe('777');
    expect(manga.syncStatus).toBe('OK');
    expect(manga.nextSyncAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('never lowers the total when a source reports fewer chapters', async () => {
    bakaChapters = 90;

    const result = await service.syncLatestChapter(mangaId);

    expect(result.latest).toBe(90);
    expect(manga.numCapitulosTotal).toBe(100);
    expect(manga.proximoCapituloNumero).toBe(101);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(notifications.replaceMany).not.toHaveBeenCalled();
  });

  it('does not notify again when the same chapter count comes back', async () => {
    await service.syncLatestChapter(mangaId);
    notifications.replaceMany.mockClear();

    await service.syncLatestChapter(mangaId);

    expect(manga.numCapitulosTotal).toBe(120);
    expect(notifications.replaceMany).not.toHaveBeenCalled();
  });

  it('uses the stored Baka-Updates ID instead of searching by title again', async () => {
    manga.mangaUpdatesId = '777';

    await service.syncLatestChapter(mangaId);

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toEqual(['https://api.mangaupdates.com/v1/series/777']);
  });

  it('lets the final AniList count of a finished manga correct the total downwards', async () => {
    manga.numCapitulosTotal = 130;
    bakaChapters = 110;
    anilist.fetchAniListMangaById.mockResolvedValue({
      id: mangaId,
      title: { english: 'Test Manga' },
      status: 'FINISHED',
      chapters: 125,
    });

    await service.syncLatestChapter(mangaId);

    expect(manga.numCapitulosTotal).toBe(125);
    expect(manga.proximoCapituloNumero).toBeNull();
    expect(notifications.replaceMany).not.toHaveBeenCalled();
  });

  it('falls back to MangaDex and stores its ID when Baka-Updates has no answer', async () => {
    bakaChapters = new Error('ECONNRESET');
    mangaDexLastChapter = '140';

    const result = await service.syncLatestChapter(mangaId);

    expect(result).toMatchObject({ latest: 140, source: 'MangaDex' });
    expect(manga.numCapitulosTotal).toBe(140);
    expect(manga.mangaDexId).toBe('md-uuid');
  });

  it('counts as a failure when every chapter source is down', async () => {
    bakaChapters = new Error('ECONNRESET');
    mangaDexLastChapter = new Error('ECONNRESET');

    await expect(
      service.syncLatestChapter(mangaId, { throwOnFailure: true }),
    ).rejects.toBeInstanceOf(SyncTransientError);

    expect(manga.numCapitulosTotal).toBe(100);
    expect(manga.syncFailures).toEqual({ increment: 1 });
    expect(manga.nextSyncAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('reports the failure in the result instead of throwing for app requests', async () => {
    anilist.fetchAniListMangaById.mockRejectedValue(
      new SyncTransientError('AniList manga 55: HTTP 503'),
    );

    await expect(service.syncLatestChapter(mangaId)).resolves.toEqual({
      latest: null,
      error: 'AniList manga 55: HTTP 503',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('takes a manga that no longer exists on AniList out of the automatic queues', async () => {
    anilist.fetchAniListMangaById.mockRejectedValue(
      new SyncNotFoundError('AniList manga 55: não encontrado'),
    );

    await expect(
      service.syncLatestChapter(mangaId, { throwOnFailure: true }),
    ).rejects.toBeInstanceOf(SyncNotFoundError);

    expect(manga.syncStatus).toBe('GONE');
  });
});
