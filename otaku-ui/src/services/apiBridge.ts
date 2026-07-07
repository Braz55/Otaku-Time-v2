import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { API_BASE_URL } from '../config';

// Helper para fazer chamadas HTTP nativas retornando um objeto Response padrão
async function nativeFetchResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (Capacitor.isNativePlatform()) {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    const headers: any = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
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

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Função customFetch principal que intercepta todos os pedidos
export async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();

  // Manipular cabeçalhos para o token
  let headers = init?.headers ? new Headers(init.headers as any) : new Headers();
  
  if (headers.get('Authorization') === 'Bearer session-cookie') {
    headers.delete('Authorization');
  }

  if (Capacitor.isNativePlatform() && !headers.has('Authorization')) {
    const savedToken = localStorage.getItem('otaku_token');
    if (savedToken && savedToken !== 'session-cookie') {
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
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshUrl = `${API_BASE_URL}/auth/refresh`;
        const refreshInit: RequestInit = {
          method: 'POST',
        };

        if (Capacitor.isNativePlatform()) {
          const savedRefreshToken = localStorage.getItem('otaku_refresh_token');
          if (savedRefreshToken) {
            refreshInit.body = JSON.stringify({ refresh_token: savedRefreshToken });
            refreshInit.headers = { 'Content-Type': 'application/json' };
          }
        }

        const refreshRes = await nativeFetchResponse(refreshUrl, refreshInit);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (Capacitor.isNativePlatform()) {
            localStorage.setItem('otaku_token', data.access_token);
            localStorage.setItem('otaku_refresh_token', data.refresh_token);
          }
          isRefreshing = false;
          onRefreshed(data.access_token);
        } else {
          isRefreshing = false;
          // Invalida sessão se falhar o refresh
          localStorage.removeItem('otaku_token');
          localStorage.removeItem('otaku_refresh_token');
          localStorage.removeItem('otaku_user');
          window.location.href = '/login';
          return response;
        }
      } catch (err) {
        isRefreshing = false;
        return response;
      }
    }

    // Aguarda o refresh do token terminar e repete o pedido original
    return new Promise((resolve) => {
      subscribeTokenRefresh((newToken) => {
        const retryHeaders = new Headers(newInit.headers as any);
        if (Capacitor.isNativePlatform()) {
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
        }
        newInit.headers = retryHeaders as any;
        resolve(nativeFetchResponse(input, newInit));
      });
    });
  }

  return response;
}
