import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { fetchWithRetry } from './http-client';

describe('CircuitBreaker', () => {
  let now = 0;
  const breaker = () => new CircuitBreaker('test', 3, 1000, () => now);

  beforeEach(() => {
    now = 1_000_000;
  });

  it('opens after the threshold of consecutive failures and fails fast', () => {
    const b = breaker();
    b.recordFailure();
    b.recordFailure();
    expect(() => b.assertClosed()).not.toThrow();

    b.recordFailure();
    expect(() => b.assertClosed()).toThrow(CircuitOpenError);
    expect(b.retryAt).toEqual(new Date(now + 1000));
  });

  it('a success resets the count', () => {
    const b = breaker();
    b.recordFailure();
    b.recordFailure();
    b.recordSuccess();
    b.recordFailure();
    b.recordFailure();
    expect(() => b.assertClosed()).not.toThrow();
  });

  it('after the cooldown lets a probe through: success closes, failure reopens', () => {
    const b = breaker();
    for (let i = 0; i < 3; i++) b.recordFailure();

    now += 1001;
    expect(() => b.assertClosed()).not.toThrow();
    b.recordFailure();
    expect(() => b.assertClosed()).toThrow(CircuitOpenError);

    now += 1001;
    b.recordSuccess();
    b.recordFailure();
    expect(() => b.assertClosed()).not.toThrow();
  });
});

describe('fetchWithRetry with a circuit breaker', () => {
  const originalFetch = global.fetch;

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('stops calling a provider that keeps failing', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const options = { retries: 1, baseDelayMs: 0, breaker: 'spec-provider' };
    const call = () =>
      fetchWithRetry('https://example.test/x', {}, options).catch((e) => e);

    // 5 falhas seguidas abrem o circuito (valor por defeito)
    for (let i = 0; i < 5; i++) await call();
    expect(fetchMock).toHaveBeenCalledTimes(5);

    const error = await call();
    expect(error).toBeInstanceOf(CircuitOpenError);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
