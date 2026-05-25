import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { localDb } from './localDb';
import { API_BASE_URL } from '../config';

// Helper para fazer chamadas HTTP nativas no Android contornando CORS e bloqueios de WebView
async function nativeFetchJson(url: string, method = 'GET', body: any = null) {
  if (Capacitor.isNativePlatform()) {
    const options: any = {
      url,
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.data = body;
    }
    
    let res: any;
    if (method === 'POST') {
      res = await CapacitorHttp.post(options);
    } else if (method === 'GET') {
      res = await CapacitorHttp.get(options);
    } else {
      res = await CapacitorHttp.request({ ...options, method });
    }

    if (res.status >= 400) {
      throw new Error(`HTTP Error ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
    }

    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  } else {
    const init: RequestInit = {
      method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  }
}

// Helper para chamadas GraphQL à AniList direto do frontend
async function fetchAniListGraphQL(query: string, variables: any) {
  try {
    const data = await nativeFetchJson('https://graphql.anilist.co', 'POST', { query, variables });
    return data;
  } catch (err) {
    console.error('AniList GraphQL Error:', err);
    return null;
  }
}

// Helper para buscar detalhes da AniList por ID
async function getAniListMediaById(id: number, type: 'ANIME' | 'MANGA') {
  const animeFields = `
    episodes
    season
    seasonYear
    nextAiringEpisode { airingAt episode }
  `;
  const mangaFields = `
    chapters
  `;
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
        externalLinks { url site type language }
        ${type === 'ANIME' ? animeFields : mangaFields}
      }
    }
  `;
  const res = await fetchAniListGraphQL(query, { id });
  return res?.data?.Media || null;
}

// Helper para buscar detalhes da AniList por Nome
async function getAniListMediaByName(search: string, type: 'ANIME' | 'MANGA') {
  const animeFields = `
    episodes
    season
    seasonYear
    nextAiringEpisode { airingAt episode }
  `;
  const mangaFields = `
    chapters
  `;
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
          externalLinks { url site type language }
          ${type === 'ANIME' ? animeFields : mangaFields}
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

// Helper para buscar capítulos no Baka-Updates (Plan A) no Android
async function getLatestChapterFromBakaUpdates_Android(title: string, mangaObj?: any): Promise<{ chapter: number | null, breakdown?: { label: string, chapters: number }[] }> {
  try {
    console.log(`[Android Plan A] Searching "${title}" on Baka-Updates...`);
    const searchData = await nativeFetchJson('https://api.mangaupdates.com/v1/series/search', 'POST', { search: title, limit: 1 });

    if (!searchData.results || searchData.results.length === 0) return { chapter: null };
    
    let bestRecord = searchData.results[0].record;

    if (bestRecord?.type?.toLowerCase() === 'novel') {
      console.log(`[Android Plan A] "${bestRecord.title}" is a Novel. Searching for Manhwa/Manga adaptation...`);
      const fallbackData = await nativeFetchJson('https://api.mangaupdates.com/v1/series/search', 'POST', { search: title, limit: 5 });
      if (fallbackData.results) {
        const nonNovel = fallbackData.results.find((r: any) => r.record?.type?.toLowerCase() !== 'novel');
        if (nonNovel) bestRecord = nonNovel.record;
      }
    }

    const clean = (s: string) => s ? s.toLowerCase().replace(/[^\w\s]/g, '').trim() : '';
    const mainTitles = [title, mangaObj?.title?.english, mangaObj?.title?.romaji].filter(Boolean).map(clean);
    const recTitle = clean(bestRecord.title);

    const isValid = mainTitles.some(t => {
      if (recTitle === t) return true;
      if (recTitle.includes(t) || t.includes(recTitle)) {
        return Math.abs(recTitle.length - t.length) <= 5;
      }
      return false;
    });

    if (!isValid) {
      console.log(`[Android Plan A] Ignored result: "${bestRecord.title}" does not match "${title}".`);
      return { chapter: null };
    }

    console.log(`[Android Plan A] Candidate: "${bestRecord.title}" (Type: ${bestRecord.type})`);

    const seriesId = bestRecord.series_id;
    const detailData = await nativeFetchJson(`https://api.mangaupdates.com/v1/series/${seriesId}`, 'GET');

    if (!detailData?.status) return { chapter: null };

    console.log(`[Android Plan A] Raw status:`, detailData.status);

    const rawLines = detailData.status.split(/\n/);
    const validLines = rawLines.filter((line: string) => !/(?:novel|original|orig\b)/i.test(line));

    const breakdown: { label: string, chapters: number }[] = [];
    for (const line of validLines) {
      const m = line.match(/\*\*(.+?)\*\*\s*:?\s*(\d+)\s+Chapters?|^([^:]+):\s*(\d+)\s+Chapters?/i);
      if (m) {
        const rawLabel = (m[1] || m[3]).trim();
        const label = rawLabel.replace(/\*/g, '').replace(/:$/, '').trim();
        const ch = parseInt(m[2] || m[4]);
        breakdown.push({ label, chapters: ch });
      }
    }

    let result = 0;
    if (breakdown.length > 0) {
      result = breakdown.reduce((acc, item) => acc + item.chapters, 0);
      console.log(`[Android Plan A] Labeled blocks:`, breakdown, `-> Sum: ${result}`);
    } else {
      const cleanStr = validLines.join(' ');
      const chMatches = [...cleanStr.matchAll(/(\d+)\s+Chapters?/gi)];
      const maxFromCh = chMatches.length > 0 ? Math.max(...chMatches.map(m => parseInt(m[1]))) : 0;
      const rangeMatches = [...cleanStr.matchAll(/[-~]\s*(\d+)\b/g)];
      const maxFromRange = rangeMatches.length > 0 ? Math.max(...rangeMatches.map(m => parseInt(m[1]))) : 0;
      result = Math.max(maxFromCh, maxFromRange);
      if (result === 0) {
        console.log(`[Android Plan A] Status text mentions Volumes or is inconclusive (returned 0).`);
      } else {
        console.log(`[Android Plan A] No labeled blocks, numeric fallback: ${result}`);
      }
    }

    if (result > 0) {
      console.log(`[Android Plan A] Success for "${title}": ${result} chapters.`);
      return { chapter: result, breakdown };
    }

    return { chapter: null };
  } catch (error) {
    console.error('[Android Plan A] Error:', error);
    return { chapter: null };
  }
}

// Helper para buscar capítulos no MangaDex (Plan B) no Android
async function getLatestChapterFromMangaDex_Android(anilistId: number, title: string, mangaObj?: any): Promise<{ chapter: number | null, error?: string }> {
  try {
    console.log(`[Android Plan B] Searching "${title}" on MangaDex (AniList ID: ${anilistId})...`);
    const mdUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=10&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
    const data = await nativeFetchJson(mdUrl, 'GET');

    if (!data.data || data.data.length === 0) {
      console.log(`[Android Plan B] No results found on MangaDex for "${title}".`);
      return { chapter: null };
    }

    console.log(`[Android Plan B] MangaDex returned ${data.data.length} candidates. Checking AniList ID (${anilistId}) or Title match...`);

    let match = data.data.find((m: any) => m.attributes.links?.al == anilistId.toString());

    if (match) {
      console.log(`[Android Plan B] Found exact AniList ID match on MangaDex: "${match.attributes.title?.en || match.attributes.title?.['ja-ro'] || match.attributes.title?.ja || 'Unknown'}" (ID: ${match.id})`);
    } else {
      console.log(`[Android Plan B] No direct AniList ID match found in links. Attempting title fallback match...`);
      const clean = (s: string) => s ? s.toLowerCase().replace(/[^\w\s]/g, '').trim() : '';
      const mainTitles = [title, mangaObj?.title?.english, mangaObj?.title?.romaji].filter(Boolean).map(clean);
      
      match = data.data.find((m: any) => {
        const mdTitles = [
          m.attributes.title?.en,
          m.attributes.title?.['ja-ro'],
          m.attributes.title?.ja,
          ...(m.attributes.altTitles || []).map((t: any) => Object.values(t)[0])
        ].filter(Boolean).map(t => clean(t as string));
        
        return mainTitles.some(mt => mdTitles.some(mdt => mdt === mt || (mdt.includes(mt) && Math.abs(mdt.length - mt.length) <= 5)));
      });

      if (match) {
        console.log(`[Android Plan B] Found title fallback match on MangaDex: "${match.attributes.title?.en || match.attributes.title?.['ja-ro'] || match.attributes.title?.ja || 'Unknown'}" (ID: ${match.id})`);
      } else {
        console.log(`[Android Plan B] All candidates rejected: No AniList ID or Title match for "${title}".`);
      }
    }

    if (match) {
      console.log(`[Android Plan B] Fetching latest chapter feed and metadata for MangaDex ID: ${match.id}...`);
      
      let metaLastChapter = 0;
      if (match.attributes?.lastChapter) {
        const parsed = parseFloat(match.attributes.lastChapter);
        if (!isNaN(parsed) && parsed > 0) {
          metaLastChapter = parsed;
          console.log(`[Android Plan B] Found official lastChapter attribute in MangaDex metadata: ${metaLastChapter}`);
        }
      }

      const feedData = await nativeFetchJson(`https://api.mangadex.org/manga/${match.id}/feed?limit=10&order[chapter]=desc`, 'GET');
      let feedMaxChapter = 0;

      if (feedData.data && feedData.data.length > 0) {
        const chapters = feedData.data
          .map((item: any) => parseFloat(item.attributes.chapter))
          .filter((ch: any) => !isNaN(ch) && ch > 0);
          
        if (chapters.length > 0) {
          feedMaxChapter = Math.max(...chapters);
          console.log(`[Android Plan B] Found max chapter in MangaDex feed (across all languages): ${feedMaxChapter}`);
        }
      }

      const finalChapter = Math.max(metaLastChapter, feedMaxChapter);

      if (finalChapter > 0) {
        console.log(`[Android Plan B] Success for "${title}": Chapter ${finalChapter} found on MangaDex.`);
        return { chapter: finalChapter };
      } else {
        console.log(`[Android Plan B] MangaDex returned no valid chapter number in metadata or feed for "${title}".`);
      }
    }
    return { chapter: null };
  } catch (error) {
    console.error('[Android Plan B] Error consulting MangaDex:', error);
    return { chapter: null, error: 'Error connecting to MangaDex' };
  }
}

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

// ==========================================
// STANDALONE ANDROID AUTOSYNC RELEASES WORKER
// ==========================================
let standaloneSyncState = {
  isSyncing: false,
  total: 0,
  current: 0,
  currentItemTitle: ''
};

async function runStandaloneAndroidSync() {
  if (standaloneSyncState.isSyncing) return;
  
  try {
    standaloneSyncState.isSyncing = true;
    standaloneSyncState.current = 0;
    standaloneSyncState.currentItemTitle = 'Carregando itens locais em lançamento...';

    const animes = await localDb.animes.filter(a => a.statusLancamento === 'RELEASING').toArray();
    const mangas = await localDb.mangas.filter(m => m.statusLancamento === 'RELEASING').toArray();

    standaloneSyncState.total = animes.length + mangas.length;
    console.log(`[Android Standalone AutoSync] Found ${animes.length} Animes and ${mangas.length} Mangas in RELEASING status.`);

    // 1. Processar Animes
    for (const anime of animes) {
      standaloneSyncState.currentItemTitle = anime.titulo;
      console.log(`[Android Standalone AutoSync] Checking Anime: "${anime.titulo}"...`);
      try {
        const aniData = await getAniListMediaById(anime.animeId, 'ANIME');
        if (aniData) {
          let nextEp = aniData.nextAiringEpisode?.episode;
          let totalEps = aniData.episodes;
          let epDisponivel = nextEp ? nextEp - 1 : totalEps;
          if (epDisponivel && epDisponivel > (anime.numEpisodiosTotal || 0) && anime.id !== undefined) {
            await localDb.animes.update(anime.id, { numEpisodiosTotal: epDisponivel });
            console.log(`[Android Standalone AutoSync] Updated Anime "${anime.titulo}" to ${epDisponivel} episodes.`);
          }
        }
      } catch (e) {
        console.error(`Error syncing anime ${anime.titulo}:`, e);
      }
      standaloneSyncState.current++;
      await new Promise(r => setTimeout(r, 1000));
    }

    // 2. Processar Mangas
    for (const manga of mangas) {
      standaloneSyncState.currentItemTitle = manga.titulo;
      console.log(`[Android Standalone AutoSync] Checking Manga: "${manga.titulo}"...`);
      try {
        // Verificar AniList
        let capAtualizado = 0;
        const aniData = await getAniListMediaById(manga.mangaId, 'MANGA');
        if (aniData && aniData.chapters) {
          capAtualizado = aniData.chapters;
        }
        // Verificar MangaDex como fallback/complemento
        if (!capAtualizado) {
          const dexData = await getLatestChapterFromMangaDex_Android(manga.mangaId, manga.titulo, manga);
          if (dexData && dexData.chapter) {
            capAtualizado = dexData.chapter;
          }
        }

        if (capAtualizado && capAtualizado > (manga.proximoCapituloNumero || manga.numCapitulosTotal || 0) && manga.id !== undefined) {
          await localDb.mangas.update(manga.id, { 
            proximoCapituloNumero: capAtualizado,
            numCapitulosTotal: capAtualizado 
          });
          console.log(`[Android Standalone AutoSync] Updated Manga "${manga.titulo}" to ${capAtualizado} chapters.`);
        }
      } catch (e) {
        console.error(`Error syncing manga ${manga.titulo}:`, e);
      }
      standaloneSyncState.current++;
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('[Android Standalone AutoSync] Completed successfully!');
  } catch (err) {
    console.error('[Android Standalone AutoSync] Fatal Error:', err);
  } finally {
    standaloneSyncState.isSyncing = false;
    standaloneSyncState.currentItemTitle = '';
    standaloneSyncState.current = 0;
    standaloneSyncState.total = 0;
  }
}

// Função customFetch principal que interceta todos os pedidos quando no Android
export async function customFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input.toString();

  // Se não for um pedido para a nossa API, se não estiver no Android, ou se for rota de sincronização bidirecional, faz o fetch nativo
  if (!urlStr.startsWith(API_BASE_URL) || !Capacitor.isNativePlatform() || urlStr.includes('/sync/twoway')) {
    return nativeFetchResponse(input, init);
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
    // SYNC ROUTES (STANDALONE ANDROID AUTOSYNC)
    // ==========================================
    if (path === '/sync/status' && method === 'GET') {
      return createJsonResponse(standaloneSyncState);
    }

    if (path === '/sync/start' && method === 'POST') {
      runStandaloneAndroidSync();
      return createJsonResponse({ success: true, message: 'Standalone Android AutoSync started' });
    }

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
        let totalCaps = aniListData.chapters;
        if (!totalCaps) {
          const titleToSearch = aniListData.title.english || aniListData.title.romaji || aniListData.title.native;
          const bakaRes = await getLatestChapterFromBakaUpdates_Android(titleToSearch, aniListData);
          if (bakaRes && bakaRes.chapter) {
            totalCaps = bakaRes.chapter;
          } else {
            const mdRes = await getLatestChapterFromMangaDex_Android(mediaId, titleToSearch, aniListData);
            if (mdRes && mdRes.chapter) {
              totalCaps = mdRes.chapter;
            }
          }
        }
        newItem.numCapitulosTotal = totalCaps;
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
    // MANGADEX / BAKA-UPDATES LATEST CHAPTER (GET)
    // ==========================================
    if (path.startsWith('/manga/latest-chapter/') && method === 'GET') {
      const anilistId = parseInt(path.split('/latest-chapter/')[1]);
      console.log(`[Android API Bridge] Intercepting /manga/latest-chapter/${anilistId}`);
      
      const media = await getAniListMediaById(anilistId, 'MANGA');
      if (!media) {
        console.log(`[Android API Bridge] Media not found on AniList for ID ${anilistId}`);
        return createJsonResponse({ latest: null, error: 'Manga not found on AniList' }, 404);
      }

      const title = media.title?.english || media.title?.romaji || media.title?.native || '';
      console.log(`[Android API Bridge] Target Title: "${title}", Status: ${media.status}, AniList Chapters: ${media.chapters}`);

      let latest: number | null = null;
      let errorMsg: string | undefined;
      let source = 'AniList';
      let breakdown: { label: string, chapters: number }[] = [];

      if (media.status === 'FINISHED' && media.chapters && media.chapters > 0) {
        console.log(`[Android API Bridge] "${title}" is already FINISHED on AniList. Using official total: ${media.chapters} chapters.`);
        latest = media.chapters;
        
        console.log(`[Android API Bridge] Consulting Baka-Updates for season breakdown of "${title}"...`);
        const bakaRes = await getLatestChapterFromBakaUpdates_Android(title, media);
        if (bakaRes && bakaRes.breakdown) {
          breakdown = bakaRes.breakdown;
        }
      } else {
        console.log(`[Android API Bridge] Consulting Baka-Updates (Plan A) for "${title}"...`);
        const bakaRes = await getLatestChapterFromBakaUpdates_Android(title, media);
        if (bakaRes && bakaRes.chapter) {
          latest = bakaRes.chapter;
          breakdown = bakaRes.breakdown || [];
          source = 'Baka-Updates';
        }
        
        if (!latest) {
          console.log(`[Android API Bridge] Baka-Updates did not provide a valid chapter count for "${title}". Switching to MangaDex (Plan B)...`);
          const mdResult = await getLatestChapterFromMangaDex_Android(anilistId, title, media);
          latest = mdResult.chapter;
          errorMsg = mdResult.error;
          if (latest) {
            source = 'MangaDex';
          }
        }
      }

      if (latest) {
        // Atualizar na base de dados local do Dexie se existir
        try {
          const existe = await localDb.mangas.where('mangaId').equals(anilistId).first();
          if (existe && existe.id !== undefined) {
            await localDb.mangas.update(existe.id, { numCapitulosTotal: latest });
            console.log(`[Android API Bridge] Updated localDb manga ${existe.id} with numCapitulosTotal: ${latest}`);
          } else {
            console.log(`[Android API Bridge] Manga "${title}" (ID ${anilistId}) is an external item not saved in localDb. Progress obtained: ${latest} (${source})`);
          }
        } catch (dbErr) {
          console.error('[Android API Bridge] Error updating localDb:', dbErr);
        }
      }

      console.log(`[Android API Bridge] Returning result for "${title}": latest=${latest}, source=${source}, error=${errorMsg || 'none'}, breakdown=${breakdown.length} items`);
      return createJsonResponse({ latest, error: errorMsg, source, breakdown });
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
    // As rotas de sincronização (/sync/status, /sync/start, /sync/twoway) não são intercetadas
    // para permitir a comunicação real com o backend NestJS.

    // Fallback
    return nativeFetchResponse(input, init);
  } catch (err) {
    console.error('CustomFetch Interceptor Error:', err);
    return new Response(JSON.stringify({ message: 'Local DB Error' }), { status: 500 });
  }
}
