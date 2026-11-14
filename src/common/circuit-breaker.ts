import { SyncTransientError } from './sync-errors';

/** O fornecedor está em pausa: o pedido nem chegou a ser feito. Não conta como falha da obra. */
export class CircuitOpenError extends SyncTransientError {
  constructor(
    readonly provider: string,
    readonly retryAt: Date,
  ) {
    super(
      `${provider} em pausa até ${retryAt.toISOString()} (falhas seguidas do fornecedor)`,
    );
    this.name = 'CircuitOpenError';
  }
}

/**
 * Circuit breaker de um fornecedor externo. Depois de `threshold` falhas seguidas abre durante
 * `cooldownMs`: os pedidos falham logo, sem ir à rede, em vez de gastarem tentativas e timeouts
 * contra um serviço que está em baixo. Passada a pausa deixa passar um pedido de teste: se
 * correr bem fecha, se falhar volta a abrir.
 */
export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    readonly provider: string,
    private readonly threshold = 5,
    private readonly cooldownMs = 5 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Lança CircuitOpenError se o fornecedor estiver em pausa. */
  assertClosed(): void {
    if (this.now() < this.openUntil) {
      throw new CircuitOpenError(this.provider, new Date(this.openUntil));
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure(): void {
    this.failures++;
    // Depois de uma pausa (meio-aberto) basta o pedido de teste falhar para reabrir
    const wasOpen = this.openUntil !== 0;
    if (wasOpen || this.failures >= this.threshold) {
      this.openUntil = this.now() + this.cooldownMs;
    }
  }

  /** Quando volta a aceitar pedidos, ou null se estiver fechado. */
  get retryAt(): Date | null {
    return this.now() < this.openUntil ? new Date(this.openUntil) : null;
  }
}

const breakers = new Map<string, CircuitBreaker>();

/** O breaker partilhado de um fornecedor ('tmdb', 'anilist', 'mangaupdates', 'mangadex'). */
export function circuitBreaker(provider: string): CircuitBreaker {
  let breaker = breakers.get(provider);
  if (!breaker) {
    breaker = new CircuitBreaker(provider);
    breakers.set(provider, breaker);
  }
  return breaker;
}
