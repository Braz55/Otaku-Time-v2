// Erros da sincronização com fontes externas. Distinguir "a obra já não existe" de "a fonte
// falhou agora" evita que uma falha de rede seja lida como "obra não encontrada".

/** Resposta HTTP sem sucesso (ou falha de rede/timeout, quando `status` é undefined). */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** A fonte respondeu que a obra não existe (404). Não vale a pena repetir. */
export class SyncNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncNotFoundError';
  }
}

/** Falha temporária (rede, timeout, 429, 5xx, resposta incompleta). Repete-se mais tarde. */
export class SyncTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncTransientError';
  }
}

export type SyncError = SyncNotFoundError | SyncTransientError;

/** Converte qualquer erro num erro de sincronização. Só um 404 conta como "não existe". */
export function toSyncError(err: unknown, contexto?: string): SyncError {
  if (err instanceof SyncNotFoundError || err instanceof SyncTransientError) {
    return err;
  }
  const base = err instanceof Error ? err.message : String(err);
  const msg = contexto ? `${contexto}: ${base}` : base;
  if ((err as { status?: number } | null)?.status === 404) {
    return new SyncNotFoundError(msg);
  }
  return new SyncTransientError(msg);
}
