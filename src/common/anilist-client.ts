import { fetchJson, FetchRetryOptions } from './http-client';

const ANILIST_URL = 'https://graphql.anilist.co';

/**
 * Pedido GraphQL à AniList, com timeout, repetição em falhas de rede/429/5xx e o circuit
 * breaker da AniList. Lança HttpError quando a resposta não é 2xx (a AniList responde 404
 * quando a obra pedida não existe).
 *
 * Por defeito está afinado para pedidos feitos por um utilizador à espera de resposta: duas
 * tentativas e, no máximo, 5s de espera quando a AniList limita os pedidos. A sincronização
 * em background pode pedir mais paciência nas opções.
 */
export function anilistRequest<T = any>(
  body: { query: string; variables?: unknown },
  options: FetchRetryOptions = {},
): Promise<T> {
  return fetchJson<T>(
    ANILIST_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    },
    { retries: 2, maxRetryAfterMs: 5_000, breaker: 'anilist', ...options },
  );
}
