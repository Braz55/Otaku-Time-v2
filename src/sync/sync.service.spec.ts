import { SyncService } from './sync.service';
import { CircuitOpenError } from '../common/circuit-breaker';
import {
  SyncNotFoundError,
  SyncTransientError,
} from '../common/sync-errors';

describe('SyncService (job queue)', () => {
  let prisma: any;
  let animeService: { syncLatestEpisode: jest.Mock };
  let mangaService: { syncLatestChapter: jest.Mock };
  let service: any;

  const job = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    runId: 10,
    fonte: 'TMDB_TV',
    mediaId: 123,
    titulo: 'Test Anime',
    attempts: 1,
    ...overrides,
  });
  // O que ficou gravado no job
  const saved = () => prisma.syncJob.update.mock.calls[0][0].data;

  beforeEach(() => {
    prisma = {
      syncJob: {
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      syncLog: {
        create: jest.fn().mockResolvedValue({ id: 10 }),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    animeService = { syncLatestEpisode: jest.fn().mockResolvedValue({}) };
    mangaService = { syncLatestChapter: jest.fn().mockResolvedValue({}) };
    service = new SyncService(
      prisma,
      animeService as any,
      {} as any,
      mangaService as any,
      {} as any,
      {} as any,
    );
  });

  describe('processJob', () => {
    it('marks the job DONE and routes anime and manga to their own sync', async () => {
      await service.processJob(job());
      expect(animeService.syncLatestEpisode).toHaveBeenCalledWith('TMDB_TV', 123);
      expect(saved()).toMatchObject({ status: 'DONE', lastError: null });

      await service.processJob(job({ fonte: 'ANILIST', mediaId: 55 }));
      expect(mangaService.syncLatestChapter).toHaveBeenCalledWith(55, {
        throwOnFailure: true,
      });
    });

    it('puts a job back in the queue after a transient failure', async () => {
      animeService.syncLatestEpisode.mockRejectedValue(
        new SyncTransientError('HTTP 503'),
      );

      await service.processJob(job({ attempts: 1 }));

      expect(saved()).toMatchObject({ status: 'PENDING', lastError: 'HTTP 503' });
      expect(saved().runAfter.getTime()).toBeGreaterThan(Date.now());
    });

    it('gives up after the last attempt', async () => {
      animeService.syncLatestEpisode.mockRejectedValue(
        new SyncTransientError('HTTP 503'),
      );

      await service.processJob(job({ attempts: 3 }));

      expect(saved()).toMatchObject({ status: 'FAILED', lastError: 'HTTP 503' });
    });

    it('does not retry a work that no longer exists', async () => {
      animeService.syncLatestEpisode.mockRejectedValue(
        new SyncNotFoundError('HTTP 404'),
      );

      await service.processJob(job({ attempts: 1 }));

      expect(saved().status).toBe('FAILED');
    });

    it('waits for a paused provider without spending an attempt', async () => {
      const retryAt = new Date(Date.now() + 5 * 60_000);
      animeService.syncLatestEpisode.mockRejectedValue(
        new CircuitOpenError('tmdb', retryAt),
      );

      await service.processJob(job({ attempts: 3 }));

      expect(saved()).toMatchObject({
        status: 'PENDING',
        runAfter: retryAt,
        attempts: { decrement: 1 },
      });
    });
  });

  describe('finalizeRun', () => {
    it('writes the outcome of the run from its jobs and clears them', async () => {
      prisma.syncLog.findUnique.mockResolvedValue({
        id: 10,
        status: 'RUNNING',
        details: '[ANIME_FULL] Sync started',
      });
      prisma.syncJob.findMany.mockResolvedValue([
        { mediaId: 1, titulo: 'A', status: 'DONE', lastError: null },
        { mediaId: 2, titulo: 'B', status: 'FAILED', lastError: 'HTTP 503' },
      ]);

      await service.finalizeRun(10);

      expect(prisma.syncLog.updateMany).toHaveBeenCalledWith({
        where: { id: 10, status: 'RUNNING' },
        data: {
          status: 'PARTIAL',
          details: expect.stringMatching(
            /^\[ANIME_FULL\] Synced 1\/2 animes\. 1 failed: "B" \(2\): HTTP 503/,
          ),
        },
      });
      expect(prisma.syncJob.deleteMany).toHaveBeenCalledWith({
        where: { runId: 10 },
      });
    });

    it('leaves a run that is already closed alone', async () => {
      prisma.syncLog.findUnique.mockResolvedValue({
        id: 10,
        status: 'SUCCESS',
        details: '[ANIME_FULL] Synced 2/2 animes.',
      });

      await service.finalizeRun(10);

      expect(prisma.syncLog.updateMany).not.toHaveBeenCalled();
      expect(prisma.syncJob.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('enqueueRun', () => {
    it('creates one job per work and skips works already queued', async () => {
      prisma.syncJob.createMany.mockResolvedValue({ count: 2 });

      await service.enqueueRun('[ANIME_ACTIVE]', async () => [
        { fonte: 'TMDB_TV', id: 1, titulo: 'A' },
        { fonte: 'TMDB_MOVIE', id: 2, titulo: 'B' },
      ]);

      expect(prisma.syncJob.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ runId: 10, fonte: 'TMDB_TV', mediaId: 1, titulo: 'A' }),
          expect.objectContaining({ runId: 10, fonte: 'TMDB_MOVIE', mediaId: 2, titulo: 'B' }),
        ],
        skipDuplicates: true,
      });
      // Com jobs por tratar, a execução fica aberta
      expect(prisma.syncLog.updateMany).not.toHaveBeenCalled();
    });

    it('closes the run straight away when there is nothing to sync', async () => {
      prisma.syncLog.findUnique.mockResolvedValue({
        id: 10,
        status: 'RUNNING',
        details: '[MANGA_FULL] Sync started',
      });

      await service.enqueueRun('[MANGA_FULL]', async () => []);

      expect(prisma.syncJob.createMany).not.toHaveBeenCalled();
      expect(prisma.syncLog.updateMany).toHaveBeenCalledWith({
        where: { id: 10, status: 'RUNNING' },
        data: { status: 'SUCCESS', details: '[MANGA_FULL] Synced 0/0 mangas.' },
      });
    });
  });
});
