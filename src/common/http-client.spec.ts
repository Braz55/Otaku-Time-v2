import { fetchJson, fetchWithRetry } from './http-client';
import { HttpError } from './sync-errors';

const response = (
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
  }) as unknown as Response;

describe('fetchWithRetry', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  // Sem esperas entre tentativas, para os testes não demorarem
  const fast = { baseDelayMs: 0, maxRetryAfterMs: 0 };
  const url = 'https://example.test/x';

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns the body on success and sends a timeout signal', async () => {
    fetchMock.mockResolvedValue(response(200, { ok: true }));

    await expect(fetchJson(url, {}, fast)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('retries network errors, 429 and 5xx', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(response(429, {}, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));

    const res = await fetchWithRetry(url, {}, { ...fast, retries: 4 });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws HttpError with the status when a 429 persists until the last attempt', async () => {
    fetchMock.mockResolvedValue(response(429));

    const error = await fetchWithRetry(url, {}, { ...fast, retries: 3 }).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry other 4xx responses', async () => {
    fetchMock.mockResolvedValue(response(404));

    await expect(fetchWithRetry(url, {}, fast)).rejects.toMatchObject({
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws HttpError without status when the network keeps failing', async () => {
    fetchMock.mockRejectedValue(new Error('ENOTFOUND'));

    const error = await fetchWithRetry(url, {}, { ...fast, retries: 2 }).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
