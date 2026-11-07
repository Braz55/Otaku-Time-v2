import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { API_BASE_URL } from '../config';
import { getStorageItem, setStorageItem, removeStorageItem } from './storage';

// Na web os tokens vivem só em cookies HttpOnly (L-08): o JavaScript nunca os vê.
// Em vez do token guarda-se este marcador, que indica "há sessão" e que o backend ignora.
export const SESSION_COOKIE = 'session-cookie';

// Helper para fazer chamadas HTTP nativas retornando um objeto Response padrão
async function nativeFetchResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (Capacitor.isNativePlatform()) {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    const headers: any = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      // Só a app nativa recebe os tokens no corpo da resposta (cookies entre domínios não são fiáveis)
      'X-Client': Capacitor.getPlatform(),
      ...init?.headers
    };
    const options: any = { url, method, headers };
    if (init?.body) {
      options.data = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    }
    try {
      let res: any;
      if (method === 'POST') {
        res = await CapacitorHttp.post(options);
      } else if (method === 'GET') {
        res = await CapacitorHttp.get(options);
      } else {
        res = await CapacitorHttp.request({ ...options, method });
      }

      const resStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return new Response(resStr, {
        status: res.status,
        headers: new Headers(res.headers as any)
      });
    } catch (err: any) {
      console.error('CapacitorHttp Request Error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  } else {
    const newInit = {
      ...init,
      credentials: init?.credentials || 'include',
    };
    return fetch(input, newInit);
  }
}

// Refresh em curso, partilhado por todos os pedidos que receberem 401 ao mesmo tempo.
// Resolve com o novo token, ou null se o refresh falhar (todos os pedidos à espera são libertados).
let refreshPromise: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshInit: RequestInit = {
          method: 'POST',
        };

        const isNative = Capacitor.isNativePlatform();

        // Na web o refresh token segue no cookie HttpOnly; só a app nativa o envia no corpo
        if (isNative) {
          const savedRefreshToken = await getStorageItem('otaku_refresh_token');
          if (savedRefreshToken) {
            refreshInit.body = JSON.stringify({ refresh_token: savedRefreshToken });
            refreshInit.headers = { 'Content-Type': 'application/json' };
          }
        }

        const refreshRes = await nativeFetchResponse(`${API_BASE_URL}/auth/refresh`, refreshInit);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (isNative && data.access_token) {
            await setStorageItem('otaku_token', data.access_token);
            await setStorageItem('otaku_refresh_token', data.refresh_token);
            return data.access_token as string;
          }
          // Web: os cookies novos já foram gravados pelo browser
          await setStorageItem('otaku_token', SESSION_COOKIE);
          return SESSION_COOKIE;
        }

        // Invalida sessão se o servidor recusar o refresh
        await removeStorageItem('otaku_token');
        await removeStorageItem('otaku_refresh_token');
        await removeStorageItem('otaku_user');
        window.location.href = '/login';
        return null;
      } catch (err) {
        // Erro de rede (ex: servidor a acordar): manter a sessão, o pedido original falha normalmente
        console.error('Erro ao renovar o token:', err);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

// Função customFetch principal que intercepta todos os pedidos
export async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();

  // Manipular cabeçalhos para o token
  let headers = init?.headers ? new Headers(init.headers as any) : new Headers();
  
  if (headers.get('Authorization') === `Bearer ${SESSION_COOKIE}`) {
    headers.delete('Authorization');
  }

  if (!headers.has('Authorization')) {
    const savedToken = await getStorageItem('otaku_token');
    if (savedToken && savedToken !== SESSION_COOKIE) {
      headers.set('Authorization', `Bearer ${savedToken}`);
    }
  }

  const newInit: RequestInit = {
    ...init,
    headers: headers as any,
  };

  let response = await nativeFetchResponse(input, newInit);

  // Se retornar 401 e não for rota de login/refresh/register, tenta refresh automático
  if (
    response.status === 401 &&
    !url.includes('/auth/login') &&
    !url.includes('/auth/refresh') &&
    !url.includes('/auth/register')
  ) {
    const newToken = await refreshAccessToken();
    if (!newToken) return response;

    // Repete o pedido original com o token novo (na web o cookie novo basta)
    const retryHeaders = new Headers(newInit.headers as any);
    if (newToken === SESSION_COOKIE) {
      retryHeaders.delete('Authorization');
    } else {
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
    }
    newInit.headers = retryHeaders as any;
    return nativeFetchResponse(input, newInit);
  }

  return response;
}
