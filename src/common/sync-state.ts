import { SyncNotFoundError } from './sync-errors';

// Estado de sincronização guardado em cada obra (Anime e Manga): quando foi a última vez que
// correu bem, quando volta a entrar na fila FULL e quantas vezes seguidas falhou.

/** Intervalo entre sincronizações completas de uma obra. */
export const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
/** Primeira espera depois de uma falha; duplica a cada falha seguida até SYNC_INTERVAL_MS. */
export const SYNC_FAILURE_BASE_MS = 6 * 60 * 60 * 1000;

export const SYNC_STATUS_OK = 'OK';
export const SYNC_STATUS_GONE = 'GONE';

/** Espera até à próxima tentativa: 6h, 12h, 24h, 48h, 96h e depois 7 dias. */
export function failureBackoffMs(falhasAnteriores: number): number {
  const expoente = Math.min(Math.max(falhasAnteriores, 0), 10);
  return Math.min(SYNC_FAILURE_BASE_MS * 2 ** expoente, SYNC_INTERVAL_MS);
}

/** Campos a gravar depois de uma sincronização bem sucedida. */
export function syncSuccessData(agora: Date = new Date()) {
  return {
    lastSyncedAt: agora,
    nextSyncAt: new Date(agora.getTime() + SYNC_INTERVAL_MS),
    syncFailures: 0,
    syncStatus: SYNC_STATUS_OK,
  };
}

/**
 * Campos a gravar depois de uma falha. Um 404 tira a obra das filas automáticas (GONE);
 * qualquer outra falha adia a próxima tentativa, para a obra não bloquear o topo da fila.
 */
export function syncFailureData(
  erro: unknown,
  falhasAnteriores: number,
  agora: Date = new Date(),
) {
  if (erro instanceof SyncNotFoundError) {
    return {
      nextSyncAt: null,
      syncFailures: { increment: 1 },
      syncStatus: SYNC_STATUS_GONE,
    };
  }
  return {
    nextSyncAt: new Date(agora.getTime() + failureBackoffMs(falhasAnteriores)),
    syncFailures: { increment: 1 },
  };
}

/**
 * Filtro Prisma das obras que precisam de sincronização completa. As obras sem nextSyncAt
 * (acabadas de importar) seguem a regra antiga: entram quando o updatedAt passa dos 7 dias.
 */
export function dueForFullSync(agora: Date = new Date()) {
  return {
    syncStatus: { not: SYNC_STATUS_GONE },
    OR: [
      { nextSyncAt: { lte: agora } },
      {
        nextSyncAt: null,
        updatedAt: { lt: new Date(agora.getTime() - SYNC_INTERVAL_MS) },
      },
    ],
  };
}
