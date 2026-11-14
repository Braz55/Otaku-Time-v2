import { HttpError } from './sync-errors';

export interface FetchRetryOptions {
  /** Tempo máximo de cada tentativa. */
  timeoutMs?: number;
  /** Número total de tentativas (1 = sem repetição). */
  retries?: number;
  /** Base do backoff exponencial (base * 2^tentativa, com jitter). */
  baseDelayMs?: number;
  /** Teto para o Retry-After pedido pelo servidor. */
  maxRetryAfterMs?: number;
  /** Chamado antes de cada nova tentativa (para logs). */
  onRetry?: (info: { attempt: number; waitMs: number; reason: string }) => void;
}

const sleep = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : null;

function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!isNaN(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return isNaN(date) ? null : Math.max(0, date - Date.now());
}

/**
 * fetch com timeout e repetição. Repete só o que pode melhorar à segunda: erros de rede,
 * timeouts, 429 e 5xx. Os outros 4xx falham logo. Devolve a resposta quando é 2xx; caso
 * contrário lança HttpError (com `status` quando houve resposta).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchRetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 10_000,
    retries = 3,
    baseDelayMs = 500,
    maxRetryAfterMs = 30_000,
    onRetry,
  } = options;

  let lastError: HttpError = new HttpError(`Sem tentativas para ${url}`);

  for (let attempt = 0; attempt < retries; attempt++) {
    let waitMs = baseDelayMs * 2 ** attempt * (0.5 + Math.random() / 2);

    let response: Response | undefined;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Falha de rede ou timeout: sem resposta, repete-se
      const e = err as Error;
      lastError = new HttpError(
        e?.name === 'TimeoutError'
          ? `timeout após ${timeoutMs}ms`
          : e?.message || String(err),
      );
    }

    if (response) {
      if (response.ok) return response;

      // Liberta a ligação: o corpo de uma resposta de erro não é lido
      await response.body?.cancel().catch(() => undefined);

      lastError = new HttpError(
        `HTTP ${response.status} ${response.statusText || ''}`.trim(),
        response.status,
      );
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) throw lastError;

      const retryAfter = parseRetryAfter(response.headers?.get('Retry-After'));
      if (retryAfter !== null) waitMs = Math.min(retryAfter, maxRetryAfterMs);
    }

    if (attempt < retries - 1) {
      onRetry?.({ attempt: attempt + 1, waitMs, reason: lastError.message });
      await sleep(waitMs);
    }
  }

  throw lastError;
}

/** fetchWithRetry + JSON. Um corpo que não é JSON conta como falha temporária. */
export async function fetchJson<T = any>(
  url: string,
  init: RequestInit = {},
  options: FetchRetryOptions = {},
): Promise<T> {
  const response = await fetchWithRetry(url, init, options);
  try {
    return (await response.json()) as T;
  } catch (err) {
    throw new HttpError(
      `Resposta inválida de ${new URL(url).host}: ${(err as Error).message}`,
    );
  }
}
