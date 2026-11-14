import {
  EpisodeStoreService,
  FetchedEpisode,
  parseLegacyEpisodes,
} from './episode-store.service';
import { SyncTransientError } from '../common/sync-errors';

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

// Compara uma linha com um filtro `where` do Prisma (só as formas usadas pelo serviço)
function matches(row: any, where: any = {}): boolean {
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === 'OR') return cond.some((c: any) => matches(row, c));
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return value?.getTime() === cond.getTime();
    if (typeof cond === 'object') {
      if ('lte' in cond && !(value != null && value <= cond.lte)) return false;
      if ('lt' in cond && !(value != null && value < cond.lt)) return false;
      if ('gt' in cond && !(value != null && value > cond.gt)) return false;
      return true;
    }
    return value === cond;
  });
}

// Tabelas Episode e Anime em memória, com as operações que o serviço usa
function createFakePrisma(anime: any) {
  const episodes: any[] = [];
  const prisma: any = {
    episodes,
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
    episode: {
      findMany: jest.fn(async ({ where, orderBy }: any = {}) => {
        const rows = episodes.filter((ep) => matches(ep, where));
        if (orderBy) {
          rows.sort(
            (a, b) => a.season - b.season || a.episodeNumber - b.episodeNumber,
          );
        }
        return rows.map((ep) => ({ ...ep }));
      }),
      count: jest.fn(
        async ({ where }: any = {}) =>
          episodes.filter((ep) => matches(ep, where)).length,
      ),
      aggregate: jest.fn(async ({ where }: any) => {
        const rows = episodes.filter((ep) => matches(ep, where));
        return {
          _count: { _all: rows.length },
          _max: {
            airDate: rows.length
              ? new Date(Math.max(...rows.map((ep) => ep.airDate.getTime())))
              : null,
          },
        };
      }),
      createMany: jest.fn(async ({ data }: any) => {
        episodes.push(...data.map((ep: any) => ({ ...ep })));
        return { count: data.length };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const key = where.animeFonte_animeId_season_episodeNumber;
        Object.assign(episodes.find((ep) => matches(ep, key)), data);
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = episodes.filter((ep) => matches(ep, where));
        rows.forEach((ep) => Object.assign(ep, data));
        return { count: rows.length };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        for (let i = episodes.length - 1; i >= 0; i--) {
          if (matches(episodes[i], where)) episodes.splice(i, 1);
        }
      }),
    },
    anime: {
      findUnique: jest.fn(async () => anime),
      findMany: jest.fn(async () => [{ fonte: 'TMDB_TV', id: 1 }]),
      update: jest.fn(async ({ data }: any) => Object.assign(anime, data)),
    },
    userAnime: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return prisma;
}

describe('EpisodeStoreService', () => {
  let anime: any;
  let prisma: any;
  let notifications: { replaceMany: jest.Mock };
  let calendar: { autoTransitionPlannedToWatching: jest.Mock };
  let service: EpisodeStoreService;

  const ep = (
    season: number,
    episodeNumber: number,
    airDate: Date | null,
    globalEpisodeNumber: number | null = null,
  ): FetchedEpisode => ({
    season,
    episodeNumber,
    globalEpisodeNumber,
    name: `S${season}E${episodeNumber}`,
    airDate,
    stillPath: null,
  });

  const apply = (episodes: FetchedEpisode[]) =>
    service.applyEpisodes('TMDB_TV', 1, 'Test Anime', episodes);

  beforeEach(() => {
    anime = { titulo: 'Test Anime', episodesList: null };
    prisma = createFakePrisma(anime);
    notifications = { replaceMany: jest.fn() };
    calendar = { autoTransitionPlannedToWatching: jest.fn() };
    service = new EpisodeStoreService(
      prisma,
      notifications as any,
      calendar as any,
    );
  });

  it('on the first sync treats past episodes as already notified and writes the read copy', async () => {
    const result = await apply([
      ep(1, 1, daysFromNow(-30), 1),
      ep(1, 2, daysFromNow(-10), 2),
      ep(1, 3, daysFromNow(10), 3),
    ]);

    expect(result).toMatchObject({ total: 3, changed: true, notificationsSent: 0 });
    expect(prisma.episodes.map((e: any) => !!e.notifiedAt)).toEqual([
      true,
      true,
      false,
    ]);
    expect(anime.episodesList).toHaveLength(3);
    expect(anime.episodesList[0]).not.toHaveProperty('notified');
    expect(anime.numEpisodiosAired).toBe(2);
    expect(notifications.replaceMany).not.toHaveBeenCalled();
    // Tudo dentro da transação, com o lock da obra pedido primeiro
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps the notified marks of the old JSON list the first time an anime reaches the table', async () => {
    anime.episodesList = [
      { season: 1, episodeNumber: 1, notified: true },
      { season: 1, episodeNumber: 2, notified: false },
    ];

    await apply([ep(1, 1, daysFromNow(-30), 1), ep(1, 2, daysFromNow(-20), 2)]);

    // O episódio 2 estava por notificar na lista antiga: é tratado agora, uma vez
    expect(prisma.userAnime.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.episodes.every((e: any) => e.notifiedAt)).toBe(true);
  });

  it('notifies each watcher once with the latest newly aired episode, and never again', async () => {
    await apply([ep(1, 1, daysFromNow(-30), 1)]);
    prisma.userAnime.findMany.mockResolvedValue([
      { userId: 7, user: { preferences: {} } },
      { userId: 8, user: { preferences: { notifyWeeklyEpisodes: false } } },
    ]);

    // Dois episódios novos já estreados e um por estrear
    const list = [
      ep(1, 1, daysFromNow(-30), 1),
      ep(1, 2, daysFromNow(-2), 2),
      ep(1, 3, daysFromNow(-1), 3),
      ep(1, 4, daysFromNow(5), 4),
    ];
    const result = await apply(list);

    expect(result.notificationsSent).toBe(2);
    expect(notifications.replaceMany).toHaveBeenCalledTimes(1);
    const [tx, items, type, media] = notifications.replaceMany.mock.calls[0];
    expect(tx).toBe(prisma);
    // O utilizador 8 não quer episódios semanais e nenhum destes é uma estreia
    expect(items).toEqual([
      expect.objectContaining({
        userId: 7,
        message: expect.stringContaining('episódio 3'),
      }),
    ]);
    expect([type, media]).toEqual(['ANIME', { fonte: 'TMDB_TV', id: 1 }]);

    // Só contam os já estreados (3 de 4) para reabrir quem tinha a obra como COMPLETED
    expect(prisma.userAnime.updateMany).toHaveBeenLastCalledWith({
      where: {
        animeFonte: 'TMDB_TV',
        animeId: 1,
        status: 'COMPLETED',
        epAtual: { lt: 3 },
      },
      data: expect.objectContaining({ status: 'WATCHING' }),
    });
    expect(anime.numEpisodiosAired).toBe(3);

    // Repetir a mesma sincronização não muda nada nem volta a notificar
    notifications.replaceMany.mockClear();
    prisma.anime.update.mockClear();
    const again = await apply(list);

    expect(again).toMatchObject({ changed: false, notificationsSent: 0 });
    expect(notifications.replaceMany).not.toHaveBeenCalled();
    expect(prisma.anime.update).not.toHaveBeenCalled();
  });

  it('updates changed episodes and removes the ones the source dropped', async () => {
    await apply([ep(1, 1, daysFromNow(-30), 1), ep(1, 2, daysFromNow(10), 2)]);
    const notifiedAt = prisma.episodes[0].notifiedAt;

    const newDate = daysFromNow(20);
    const result = await apply([
      { ...ep(1, 1, daysFromNow(-30), 1), name: 'New name' },
      ep(1, 3, newDate, 2),
    ]);

    expect(result.changed).toBe(true);
    expect(prisma.episodes.map((e: any) => e.episodeNumber).sort()).toEqual([1, 3]);
    const first = prisma.episodes.find((e: any) => e.episodeNumber === 1);
    expect(first.name).toBe('New name');
    expect(first.notifiedAt).toBe(notifiedAt);
    expect(anime.episodesList.map((e: any) => e.episodeNumber)).toEqual([1, 3]);
  });

  it('refuses to wipe an existing list when the source returns no episodes', async () => {
    await apply([ep(1, 1, daysFromNow(-30), 1)]);

    await expect(apply([])).rejects.toBeInstanceOf(SyncTransientError);
    expect(prisma.episodes).toHaveLength(1);
  });

  it('processAired handles episodes that aired since the last sync', async () => {
    await apply([ep(1, 1, daysFromNow(-30), 1), ep(1, 2, daysFromNow(5), 2)]);
    // O episódio 2 estreou entretanto
    prisma.episodes[1].airDate = daysFromNow(-0.01);
    prisma.userAnime.findMany.mockResolvedValue([
      { userId: 7, user: { preferences: {} } },
    ]);

    expect(await service.findAnimesWithPendingAired()).toHaveLength(1);
    await expect(service.processAired('TMDB_TV', 1)).resolves.toEqual({
      notificationsSent: 1,
    });
    expect(await service.findAnimesWithPendingAired()).toHaveLength(0);
    await expect(service.processAired('TMDB_TV', 1)).resolves.toEqual({
      notificationsSent: 0,
    });
    expect(notifications.replaceMany).toHaveBeenCalledTimes(1);
  });

  it('backfills the table from the old JSON list without notifying stale episodes', async () => {
    anime.episodesList = [
      { season: 1, episodeNumber: 1, airDate: daysFromNow(-60).toISOString(), notified: false },
      { season: 1, episode: 2, airDate: daysFromNow(-1).toISOString(), notified: false },
      { season: 1, episodeNumber: 3, airDate: 'not a date' },
      { season: 'x', episodeNumber: 4 },
      null,
    ];

    await expect(service.backfillFromJson()).resolves.toBe(1);

    expect(prisma.episodes.map((e: any) => [e.episodeNumber, !!e.notifiedAt])).toEqual([
      [1, true], // estreou há mais de 7 dias: não gera notificação atrasada
      [2, false],
      [3, false],
    ]);
    expect(prisma.episodes[2].airDate).toBeNull();
    // Com linhas na tabela, já não há nada para preencher
    await expect(service.backfillFromJson()).resolves.toBe(0);
  });

  it('parseLegacyEpisodes ignores malformed entries and duplicates', () => {
    expect(parseLegacyEpisodes('nope')).toEqual([]);
    expect(
      parseLegacyEpisodes([
        { season: 1, episodeNumber: 1, notified: true },
        { season: 1, episodeNumber: 1 },
        { season_number: 2, episode_number: 5 },
        {},
      ]).map((e) => [e.season, e.episodeNumber, e.notified]),
    ).toEqual([
      [1, 1, true],
      [2, 5, false],
    ]);
  });
});
