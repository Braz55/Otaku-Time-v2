import { Capacitor, CapacitorHttp } from '@capacitor/core';

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
    return fetch(input, init);
  }
}

// Função customFetch principal que interceta todos os pedidos quando no Android
export async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return nativeFetchResponse(input, init);
}
