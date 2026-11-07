// Resultado de uma sincronização obra a obra (L-22): uma obra que falha não interrompe as outras.

export type SyncStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface SyncFailure {
  id: number;
  titulo: string;
  erro: string;
}

export interface SyncOutcome {
  total: number;
  sincronizadas: number;
  falhas: SyncFailure[];
}

// Quantas falhas se descrevem nos detalhes do log (o resto só conta para o número)
const MAX_FALHAS_DESCRITAS = 10;

/** SUCCESS sem falhas; FAILED se todas falharam; PARTIAL no meio. */
export function decidirEstadoSync(outcome: SyncOutcome): SyncStatus {
  if (outcome.falhas.length === 0) return 'SUCCESS';
  if (outcome.sincronizadas === 0) return 'FAILED';
  return 'PARTIAL';
}

/** Texto para o campo `details` do SyncLog. */
export function descreverSync(
  label: string,
  tipoObra: string,
  outcome: SyncOutcome,
): string {
  const { total, sincronizadas, falhas } = outcome;
  let msg = `${label} Synced ${sincronizadas}/${total} ${tipoObra}.`;
  if (falhas.length > 0) {
    const descritas = falhas
      .slice(0, MAX_FALHAS_DESCRITAS)
      .map((f) => `"${f.titulo}" (${f.id}): ${f.erro}`)
      .join('; ');
    const resto =
      falhas.length > MAX_FALHAS_DESCRITAS
        ? ` (+${falhas.length - MAX_FALHAS_DESCRITAS} more)`
        : '';
    msg += ` ${falhas.length} failed: ${descritas}${resto}`;
  }
  return msg;
}

/** Estados que contam como "esta janela de sincronização já correu". */
export const SYNC_DONE_STATUSES: SyncStatus[] = ['SUCCESS', 'PARTIAL'];
