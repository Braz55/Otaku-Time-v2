import {
  SyncNotFoundError,
  SyncTransientError,
  toSyncError,
} from './sync-errors';
import {
  SYNC_INTERVAL_MS,
  failureBackoffMs,
  syncFailureData,
  syncSuccessData,
} from './sync-state';

const HOUR = 60 * 60 * 1000;

describe('sync-state', () => {
  const agora = new Date('2026-11-14T12:00:00Z');

  it('backs off 6h, 12h, 24h... capped at the full sync interval', () => {
    expect(failureBackoffMs(0)).toBe(6 * HOUR);
    expect(failureBackoffMs(1)).toBe(12 * HOUR);
    expect(failureBackoffMs(2)).toBe(24 * HOUR);
    expect(failureBackoffMs(50)).toBe(SYNC_INTERVAL_MS);
  });

  it('schedules the next full sync 7 days after a success and clears the failures', () => {
    expect(syncSuccessData(agora)).toEqual({
      lastSyncedAt: agora,
      nextSyncAt: new Date(agora.getTime() + SYNC_INTERVAL_MS),
      syncFailures: 0,
      syncStatus: 'OK',
    });
  });

  it('postpones a transient failure instead of leaving it at the head of the queue', () => {
    const data = syncFailureData(new SyncTransientError('503'), 1, agora);
    expect(data.nextSyncAt).toEqual(new Date(agora.getTime() + 12 * HOUR));
    expect(data).not.toHaveProperty('syncStatus');
  });

  it('takes a work that no longer exists out of the automatic queues', () => {
    expect(
      syncFailureData(new SyncNotFoundError('404'), 0, agora),
    ).toMatchObject({ nextSyncAt: null, syncStatus: 'GONE' });
  });

  it('only treats a 404 as "not found"', () => {
    const withStatus = (status: number) =>
      Object.assign(new Error('x'), { status });

    expect(toSyncError(withStatus(404))).toBeInstanceOf(SyncNotFoundError);
    expect(toSyncError(withStatus(503))).toBeInstanceOf(SyncTransientError);
    expect(toSyncError(new Error('ECONNRESET'))).toBeInstanceOf(
      SyncTransientError,
    );
  });
});
