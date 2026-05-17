import { Capacitor } from '@capacitor/core';
import { localDb } from './localDb';
import { API_BASE_URL } from '../config';

// Helper para chamadas GraphQL à AniList direto do frontend
async function fetchAniListGraphQL(query: string, variables: any) {
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('AniList GraphQL Error:', err);
    return null;
  }
}

// Helper para buscar detalhes da AniList por ID
async function getAniListMediaById(id: number, type: 'ANIME' | 'MANGA') {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ${type}) {
        id
        title { english romaji native }
        coverImage { large }
        status
        description
        genres
        tags { name }
        episodes
        chapters
        season
        seasonYear
        externalLinks { url site type language }
        nextAiringEpisode { airingAt episode }
      }
    }
  `;
  const res = await fetchAniListGraphQL(query, { id });
  return res?.data?.Media || null;
}

// Helper para buscar detalhes da AniList por Nome
async function getAniListMediaByName(search: string, type: 'ANIME' | 'MANGA') {
  const query = `
    query ($s: String) {
      Page(perPage: 1) {
        media(search: $s, type: ${type}, sort: SEARCH_MATCH) {
          id
          title { english romaji native }
          coverImage { large }
          status
          description
          genres
          tags { name }
          episodes
          chapters
          season
          seasonYear
          externalLinks { url site type language }
          nextAiringEpisode { airingAt episode }
        }
      }
    }
  `;
  const res = await fetchAniListGraphQL(query, { s: search });
  return res?.data?.Page?.media?.[0] || null;
}

// Helper para criar uma resposta Response mockada
function createJsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Função customFetch principal que interceta todos os pedidos quando no Android
export async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input.toString();

  // Se não for um pedido para a nossa API, se não estiver no Android, ou se for rota de sincronização bidirecional, faz o fetch normal
  if (!urlStr.startsWith(API_BASE_URL) || !Capacitor.isNativePlatform() || urlStr.includes('/sync/twoway')) {
    return fetch(input, init);
  }

  const method = (init?.method || 'GET').toUpperCase();
  const path = urlStr.replace(API_BASE_URL, '').split('?')[0];
  const queryParams = new URLSearchParams(urlStr.split('?')[1] || '');

  // Obter utilizador atual da localStorage (simulado)
  const currentUserStr = localStorage.getItem('otaku_user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : { id: 1, email: 'android@otakutime.com', nome: 'Otaku Android' };
  const userId = currentUser.id;

  try {
    // ==========================================
    // AUTH ROUTES
    // ==========================================
    if (path === '/auth/login' && method === 'POST') {
      const body = JSON.parse(init?.body as string);
      let user = await localDb.users.where('email').equals(body.email).first();
      if (!user) {
        // Se não existir, cria um utilizador local automaticamente para facilitar
        const newId = await localDb.users.add({ email: body.email, nome: body.email.split('@')[0], password: body.password });
        user = { id: newId, email: body.email, nome: body.email.split('@')[0] };
      }
      return createJsonResponse({ access_token: `mock_token_${Date.now()}`, user });
    }

    if (path === '/auth/register' && method === 'POST') {
      const body = JSON.parse(init?.body as string);
      let user = await localDb.users.where('email').equals(body.email).first();
      if (!user) {
        const newId = await localDb.users.add({ email: body.email, nome: body.nome, password: body.password });
        user = { id: newId, email: body.email, nome: body.nome };
      }
      return createJsonResponse({ access_token: `mock_token_${Date.now()}`, user });
    }

    // ==========================================
    // ANIME / MANGA LIST (GET)
    // ==========================================
    if ((path === '/anime' || path === '/manga') && method === 'GET') {
      const table = path === '/anime' ? localDb.animes : localDb.mangas;
      const items = await table.where('userId').equals(userId).toArray();
      // Formatar de acordo com o que o frontend espera (incluindo o objeto aninhado anime/manga)
      const formatted = items.map((item: any) => ({
        ...item,
        [path === '/anime' ? 'anime' : 'manga']: item
      }));
      return createJsonResponse(formatted);
    }

    // ==========================================
    // IMPORT ROUTES (POST)
    // ==========================================
    if ((path === '/anime/import' || path === '/manga/import') && method === 'POST') {
      const body = JSON.parse(init?.body as string);
      const isAnime = path === '/anime/import';
      const type = isAnime ? 'ANIME' : 'MANGA';
      
      const aniListData = body.anilistId 
        ? await getAniListMediaById(body.anilistId, type) 
        : await getAniListMediaByName(body.nome, type);

      if (!aniListData) {
        return createJsonResponse({ message: 'Media not found on AniList' }, 404);
      }

      const table = isAnime ? localDb.animes : localDb.mangas;
      const mediaId = aniListData.id;
      
      // Verificar se já existe na lista local
      const existing = await table.where(isAnime ? 'animeId' : 'mangaId').equals(mediaId).first();
      if (existing) {
        return createJsonResponse({ ...existing, [isAnime ? 'anime' : 'manga']: existing });
      }

      const topTags = aniListData.tags ? aniListData.tags.slice(0, 5).map((t: any) => t.name).join(', ') : '';
      const generosComTags = `${aniListData.genres ? aniListData.genres.join(', ') : ''}, ${topTags}`;
      const descricaoLimpa = aniListData.description ? aniListData.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.";
      const linksJSON = aniListData.externalLinks ? JSON.stringify(aniListData.externalLinks) : null;

      const newItem: any = {
        userId,
        [isAnime ? 'animeId' : 'mangaId']: mediaId,
        titulo: aniListData.title.english || aniListData.title.romaji || aniListData.title.native,
        statusLancamento: aniListData.status,
        capaUrl: aniListData.coverImage?.large,
        generos: generosComTags,
        descricao: descricaoLimpa,
        status: 'PLANNED',
        [isAnime ? 'epAtual' : 'capAtual']: 0,
        prioridade: 5,
        linksExternos: linksJSON
      };

      if (isAnime) {
        newItem.numEpisodiosTotal = aniListData.episodes;
        newItem.temporada = aniListData.season;
        newItem.ano = aniListData.seasonYear;
        newItem.proximoEpisodio = aniListData.nextAiringEpisode?.episode;
        newItem.proximoEpisodioData = aniListData.nextAiringEpisode ? new Date(aniListData.nextAiringEpisode.airingAt * 1000).toISOString() : null;
      } else {
        newItem.numCapitulosTotal = aniListData.chapters;
      }

      const newId = await table.add(newItem);
      const created = { ...newItem, id: newId, [isAnime ? 'anime' : 'manga']: newItem };
      return createJsonResponse(created);
    }

    // ==========================================
    // SEARCH & GENRE ROUTES (GET)
    // ==========================================
    if ((path.startsWith('/anime/search/') || path.startsWith('/manga/search/')) && method === 'GET') {
      const isAnime = path.startsWith('/anime/');
      const termo = decodeURIComponent(path.split('/search/')[1]);
      const page = parseInt(queryParams.get('page') || '1');
      
      const query = `
        query ($s: String, $page: Int) {
          Page(page: $page, perPage: 24) {
            media(search: $s, type: ${isAnime ? 'ANIME' : 'MANGA'}, sort: SEARCH_MATCH) {
              id title { romaji english } coverImage { large } status chapters episodes genres description
            }
          }
        }
      `;
      const res = await fetchAniListGraphQL(query, { s: termo, page });
      return createJsonResponse(res?.data?.Page?.media || []);
    }

    if ((path.startsWith('/anime/genre/') || path.startsWith('/manga/genre/')) && method === 'GET') {
      const isAnime = path.startsWith('/anime/');
      const genre = decodeURIComponent(path.split('/genre/')[1]);
      const page = parseInt(queryParams.get('page') || '1');
      
      const query = `
        query ($g: String, $page: Int) {
          Page(page: $page, perPage: 24) {
            media(genre: $g, type: ${isAnime ? 'ANIME' : 'MANGA'}, sort: POPULARITY_DESC) {
              id title { romaji english } coverImage { large } status chapters episodes genres description
            }
          }
        }
      `;
      const res = await fetchAniListGraphQL(query, { g: genre, page });
      return createJsonResponse(res?.data?.Page?.media || []);
    }

    // ==========================================
    // ANILIST DETAILS (GET)
    // ==========================================
    if ((path.startsWith('/anime/anilist/') || path.startsWith('/manga/anilist/')) && method === 'GET') {
      const isAnime = path.startsWith('/anime/');
      const id = parseInt(path.split('/anilist/')[1]);
      const media = await getAniListMediaById(id, isAnime ? 'ANIME' : 'MANGA');
      return createJsonResponse(media || {});
    }

    // ==========================================
    // CRUD ITEM (GET, PATCH, DELETE)
    // ==========================================
    if ((path.startsWith('/anime/') || path.startsWith('/manga/')) && !path.includes('/search/') && !path.includes('/genre/') && !path.includes('/anilist/') && !path.includes('/latest-chapter/')) {
      const isAnime = path.startsWith('/anime/');
      const id = parseInt(path.split('/')[2]);
      const table = isAnime ? localDb.animes : localDb.mangas;

      if (method === 'GET') {
        const item = await table.get(id);
        if (!item) return createJsonResponse({ message: 'Not found' }, 404);
        return createJsonResponse({ ...item, [isAnime ? 'anime' : 'manga']: item });
      }

      if (method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        await table.update(id, body);
        const updated = await table.get(id);
        return createJsonResponse({ ...updated, [isAnime ? 'anime' : 'manga']: updated });
      }

      if (method === 'DELETE') {
        await table.delete(id);
        return createJsonResponse({ success: true });
      }
    }

    // ==========================================
    // MANGADEX LATEST CHAPTER (GET)
    // ==========================================
    if (path.startsWith('/manga/latest-chapter/') && method === 'GET') {
      const anilistId = parseInt(path.split('/latest-chapter/')[1]);
      const media = await getAniListMediaById(anilistId, 'MANGA');
      let latest = media?.chapters || null;
      
      // Tentar buscar do MangaDex diretamente via fetch no frontend
      try {
        const title = media?.title?.english || media?.title?.romaji || '';
        if (title) {
          const mdRes = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5`);
          const mdData = await mdRes.json();
          const match = mdData?.data?.[0];
          if (match?.attributes?.lastChapter) {
            const ch = parseFloat(match.attributes.lastChapter);
            if (!isNaN(ch) && ch > (latest || 0)) latest = ch;
          }
        }
      } catch {
        // ignore
      }
      return createJsonResponse({ latest, source: latest === media?.chapters ? 'AniList' : 'MangaDex' });
    }

    // ==========================================
    // CHAT ROUTES
    // ==========================================
    if (path === '/chat/sessions' && method === 'GET') {
      const sessions = await localDb.chatSessions.where('userId').equals(userId).toArray();
      return createJsonResponse(sessions);
    }

    if (path === '/chat/sessions' && method === 'POST') {
      const body = JSON.parse(init?.body as string);
      const newSession = {
        userId,
        titulo: body.titulo || 'New Chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const newId = await localDb.chatSessions.add(newSession);
      return createJsonResponse({ ...newSession, id: newId });
    }

    if (path.startsWith('/chat/sessions/') && method === 'DELETE') {
      const id = parseInt(path.split('/')[3]);
      await localDb.chatSessions.delete(id);
      await localDb.chatMessages.where('sessionId').equals(id).delete();
      return createJsonResponse({ success: true });
    }

    if (path.startsWith('/chat/sessions/') && path.endsWith('/messages') && method === 'GET') {
      const sessionId = parseInt(path.split('/')[3]);
      const messages = await localDb.chatMessages.where('sessionId').equals(sessionId).toArray();
      return createJsonResponse(messages);
    }

    if (path.startsWith('/chat/sessions/') && path.endsWith('/messages') && method === 'POST') {
      const sessionId = parseInt(path.split('/')[3]);
      const body = JSON.parse(init?.body as string);

      // Guarda mensagem do utilizador
      const userMsg = {
        sessionId,
        role: 'user' as const,
        content: body.message,
        createdAt: new Date().toISOString()
      };
      await localDb.chatMessages.add(userMsg);

      // Gera resposta mockada rica do assistente
      const aiContent = `Aqui tens algumas recomendações baseadas no teu pedido "${body.message}":\n\n- **Demon Slayer**: Ação espetacular com animação de topo.\n- **Chainsaw Man**: Ousado, frenético e visualmente incrível.\n- **Solo Leveling**: O melhor webtoon de caçadores e monstros!`;
      const aiMsg = {
        sessionId,
        role: 'assistant' as const,
        content: aiContent,
        createdAt: new Date().toISOString()
      };
      await localDb.chatMessages.add(aiMsg);

      // Simular stream ou retorno direto
      return createJsonResponse({ content: aiContent });
    }

    // ==========================================
    // SYNC ROUTES
    // ==========================================
    if (path === '/sync/status' && method === 'GET') {
      return createJsonResponse({ isSyncing: false, total: 0, current: 0, currentItemTitle: '' });
    }

    if (path === '/sync/start' && method === 'POST') {
      return createJsonResponse({ success: true });
    }

    // Fallback
    return fetch(input, init);
  } catch (err) {
    console.error('CustomFetch Interceptor Error:', err);
    return new Response(JSON.stringify({ message: 'Local DB Error' }), { status: 500 });
  }
}
