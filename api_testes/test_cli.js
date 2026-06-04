const readline = require('readline');

// Interface para leitura do terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Pesquisa para a lista de resultados (AniList Discovery)
async function searchMangaList(nome) {
  const query = `
    query ($s: String) {
      Page(page: 1, perPage: 10) {
        media(search: $s, type: MANGA, sort: POPULARITY_DESC, isAdult: false) {
          id
          title { english romaji }
          genres
          description
          status
          chapters
        }
      }
    }
  `;
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { s: nome } })
    });
    const data = await response.json();
    return data.data?.Page?.media || [];
  } catch (error) {
    console.error('Erro ao pesquisar no AniList:', error);
    return [];
  }
}

// Pesquisa de detalhes na AniList por ID
async function searchAniListById(id) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        id
        title { english romaji }
        status
        chapters
        genres
        description
        coverImage { large }
        externalLinks { url site type language }
      }
    }
  `;
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { id } }),
    });
    const result = await response.json();
    return result?.data?.Media || null;
  } catch (error) {
    console.error(`Erro ao pesquisar detalhes no AniList para ID ${id}:`, error);
    return null;
  }
}

// PLAN A: Baka-Updates (MangaUpdates)
async function getLatestChapterFromBakaUpdates(title, mangaObj) {
  try {
    console.log(`\n[Plan A] Searching "${title}" on Baka-Updates...`);
    
    const searchRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: title, limit: 1 })
    });
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      console.log(`[Plan A] No results found on Baka-Updates.`);
      return { chapter: null, chapterList: [] };
    }
    
    let bestRecord = searchData.results[0].record;

    // Se o primeiro resultado for uma Novel, fazer um segundo pedido para apanhar a versão Manga/Manhwa
    if (bestRecord?.type?.toLowerCase() === 'novel') {
      console.log(`[Plan A] "${bestRecord.title}" is a Novel. Searching for Manhwa/Manga adaptation...`);
      const fallbackRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: title, limit: 5 })
      });
      const fallbackData = await fallbackRes.json();
      if (fallbackData.results) {
        const nonNovel = fallbackData.results.find((r) => r.record?.type?.toLowerCase() !== 'novel');
        if (nonNovel) bestRecord = nonNovel.record;
      }
    }

    // Verificação de segurança
    const clean = (s) => s ? s.toLowerCase().replace(/[^\w\s]/g, '').trim() : '';
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
      console.log(`[Plan A] Ignored result: "${bestRecord.title}" does not match "${title}".`);
      return { chapter: null, chapterList: [] };
    }

    console.log(`[Plan A] Candidate Found: "${bestRecord.title}" (Type: ${bestRecord.type})`);

    const seriesId = bestRecord.series_id;
    const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${seriesId}`);
    const detailData = await detailRes.json();

    if (!detailData?.status) {
      console.log(`[Plan A] Could not retrieve status for series ID ${seriesId}.`);
      return { chapter: null, chapterList: [] };
    }

    console.log(`[Plan A] Raw status: "${detailData.status}"`);

    // Filtrar linhas que mencionem "novel" ou "original"
    const rawLines = detailData.status.split(/\n/);
    const validLines = rawLines.filter((line) => !/(?:novel|original|orig\b)/i.test(line));

    // ESTRATÉGIA: Somar todos os blocos com label explícito
    const breakdown = [];
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
      console.log(`[Plan A] Labeled blocks:`, breakdown, `-> Sum: ${result}`);
    } else {
      const cleanStr = validLines.join(' ');
      const chMatches = [...cleanStr.matchAll(/(\d+)\s+Chapters?/gi)];
      const maxFromCh = chMatches.length > 0 ? Math.max(...chMatches.map(m => parseInt(m[1]))) : 0;
      const rangeMatches = [...cleanStr.matchAll(/[-~]\s*(\d+)\b/g)];
      const maxFromRange = rangeMatches.length > 0 ? Math.max(...rangeMatches.map(m => parseInt(m[1]))) : 0;
      result = Math.max(maxFromCh, maxFromRange);
    }

    if (result > 0) {
      console.log(`[Plan A] Success for "${title}": ${result} chapters.`);
      
      // NOVA LÓGICA: Gerar a lista exata de capítulos [1, 2, 3... result]
      const chapterList = Array.from({ length: result }, (_, i) => i + 1);
      
      return { chapter: result, breakdown, chapterList };
    }

    return { chapter: null, chapterList: [] };
  } catch (error) {
    console.error('[Plan A] Error:', error);
    return { chapter: null, chapterList: [] };
  }
}

// PLAN B: MangaDex
async function getLatestChapterFromMangaDex(anilistId, title, mangaObj) {
  try {
    console.log(`\n[Plan B] Searching "${title}" on MangaDex (AniList ID: ${anilistId})...`);
    const mdUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=10&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
    const response = await fetch(mdUrl, {
      headers: { 'User-Agent': 'OtakuTimeBot/1.0' }
    });
    
    if (!response.ok) {
      console.error(`[Plan B] MangaDex HTTP Error: ${response.status}`);
      if (response.status === 503 || response.status === 502 || response.status === 504) {
        return { chapter: null, error: `MangaDex servers offline (Error ${response.status})` };
      }
      return { chapter: null, error: `MangaDex failed (Error ${response.status})` };
    }
    
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.log(`[Plan B] No results found on MangaDex for "${title}".`);
      return { chapter: null };
    }

    console.log(`[Plan B] MangaDex returned ${data.data.length} candidates. Checking AniList ID (${anilistId}) or Title match...`);

    let match = data.data.find((m) => m.attributes.links?.al == anilistId.toString());

    if (match) {
      console.log(`[Plan B] Found exact AniList ID match on MangaDex: "${match.attributes.title?.en || match.attributes.title?.['ja-ro'] || match.attributes.title?.ja || 'Unknown'}" (ID: ${match.id})`);
    } else {
      console.log(`[Plan B] No direct AniList ID match found in links. Attempting title fallback match...`);
      const clean = (s) => s ? s.toLowerCase().replace(/[^\w\s]/g, '').trim() : '';
      const mainTitles = [title, mangaObj?.title?.english, mangaObj?.title?.romaji].filter(Boolean).map(clean);
      
      match = data.data.find((m) => {
        const mdTitles = [
          m.attributes.title?.en,
          m.attributes.title?.['ja-ro'],
          m.attributes.title?.ja,
          ...(m.attributes.altTitles || []).map((t) => Object.values(t)[0])
        ].filter(Boolean).map(t => clean(t));
        
        return mainTitles.some(mt => mdTitles.some(mdt => mdt === mt || (mdt.includes(mt) && Math.abs(mdt.length - mt.length) <= 5)));
      });

      if (match) {
        console.log(`[Plan B] Found title fallback match on MangaDex: "${match.attributes.title?.en || match.attributes.title?.['ja-ro'] || match.attributes.title?.ja || 'Unknown'}" (ID: ${match.id})`);
      } else {
        console.log(`[Plan B] All candidates rejected: No AniList ID or Title match for "${title}".`);
      }
    }

    if (match) {
      console.log(`[Plan B] Fetching latest chapter feed and metadata for MangaDex ID: ${match.id}...`);
      
      let metaLastChapter = 0;
      if (match.attributes?.lastChapter) {
        const parsed = parseFloat(match.attributes.lastChapter);
        if (!isNaN(parsed) && parsed > 0) {
          metaLastChapter = parsed;
          console.log(`[Plan B] Found official lastChapter attribute in MangaDex metadata: ${metaLastChapter}`);
        }
      }

      const feedRes = await fetch(`https://api.mangadex.org/manga/${match.id}/feed?limit=10&order[chapter]=desc`, {
        headers: { 'User-Agent': 'OtakuTimeBot/1.0' }
      });
      
      if (!feedRes.ok) {
        console.error(`[Plan B] MangaDex feed HTTP Error: ${feedRes.status}`);
        if (feedRes.status === 503 || feedRes.status === 502 || feedRes.status === 504) {
          return { chapter: metaLastChapter > 0 ? metaLastChapter : null, error: `MangaDex servers offline (Error ${feedRes.status})` };
        }
        return { chapter: metaLastChapter > 0 ? metaLastChapter : null, error: `MangaDex failed (Error ${feedRes.status})` };
      }
      
      const feedData = await feedRes.json();
      let feedMaxChapter = 0;

      if (feedData.data && feedData.data.length > 0) {
        const chapters = feedData.data
          .map((item) => parseFloat(item.attributes.chapter))
          .filter((ch) => !isNaN(ch) && ch > 0);
          
        if (chapters.length > 0) {
          feedMaxChapter = Math.max(...chapters);
          console.log(`[Plan B] Found max chapter in MangaDex feed (across all languages): ${feedMaxChapter}`);
        }
      }

      const finalChapter = Math.max(metaLastChapter, feedMaxChapter);

      if (finalChapter > 0) {
        console.log(`[Plan B] Success for "${title}": Chapter ${finalChapter} found on MangaDex.`);
        return { chapter: finalChapter };
      } else {
        console.log(`[Plan B] MangaDex returned no valid chapter number in metadata or feed for "${title}".`);
      }
    }
    return { chapter: null };
  } catch (error) {
    console.error('[Plan B] Error consulting MangaDex:', error);
    return { chapter: null, error: 'Error connecting to MangaDex' };
  }
}

async function runSyncTrace(anilistId) {
  console.log(`\n======================================================`);
  console.log(`[Sync Trace] Starting sync for AniList ID: ${anilistId}`);
  console.log(`======================================================`);
  
  const manga = await searchAniListById(anilistId);
  if (!manga) {
    console.log(`[Sync Trace] Error: Manga not found on AniList.`);
    return;
  }
  
  const title = manga.title.english || manga.title.romaji;
  console.log(`Manga Title: "${title}"`);
  console.log(`Status on AniList: ${manga.status}`);
  console.log(`Chapters on AniList: ${manga.chapters || 'Not specified'}`);

  let latest = null;
  let source = 'AniList';
  let breakdown = [];
  let generatedChapterList = [];
  let errorMsg = null;

  console.log(`\n[Sync Trace] Launching Plan A: Consulting Baka-Updates...`);
  const bakaRes = await getLatestChapterFromBakaUpdates(title, manga);
  if (bakaRes && bakaRes.chapter) {
    latest = bakaRes.chapter;
    breakdown = bakaRes.breakdown || [];
    generatedChapterList = bakaRes.chapterList || [];
    source = 'Baka-Updates';
  }

  // Comparison logic: If finished and AniList has a higher chapter count, use AniList.
  if (manga.status === 'FINISHED' && manga.chapters && manga.chapters > 0) {
    if (!latest || manga.chapters > latest) {
      console.log(`\n[Sync Trace] [Comparison] AniList has more chapters (${manga.chapters}) than external source (${latest || 0}). Using AniList chapters.`);
      latest = manga.chapters;
      generatedChapterList = Array.from({ length: latest }, (_, i) => i + 1);
      source = 'AniList';
      breakdown = []; // Clear breakdown as we are using AniList total chapters
    }
  }

  if (!latest) {
    console.log(`\n[Sync Trace] Baka-Updates did not provide a valid chapter count and not finished on AniList. Launching Plan B: Switching to MangaDex...`);
    const mdResult = await getLatestChapterFromMangaDex(anilistId, title, manga);
    latest = mdResult.chapter;
    errorMsg = mdResult.error;
    if (latest) {
      generatedChapterList = Array.from({ length: latest }, (_, i) => i + 1);
      source = 'MangaDex';
    }
  }

  console.log(`\n======================================================`);
  console.log(`[Sync Trace] FINAL RESULT:`);
  console.log(`  - Target Manga: "${title}" (ID: ${anilistId})`);
  console.log(`  - Chapters Found: ${latest || 'None'}`);
  console.log(`  - Source Used: ${source}`);
  
  if (breakdown.length > 0) {
    console.log(`  - Breakdown:`);
    breakdown.forEach(b => console.log(`    * ${b.label}: ${b.chapters} chapters`));
  }
  
  if (generatedChapterList.length > 0) {
    // Imprime um resumo da lista de capítulos gerada
    const listPreview = generatedChapterList.length > 10 
      ? `[${generatedChapterList.slice(0, 5).join(', ')}, ..., ${generatedChapterList.slice(-5).join(', ')}]`
      : `[${generatedChapterList.join(', ')}]`;
    console.log(`  - Chapter List: ${listPreview} (Total: ${generatedChapterList.length} items)`);
  }

  if (errorMsg) {
    console.log(`  - Error Info: ${errorMsg}`);
  }
  console.log(`======================================================\n`);
}

// Loop principal do terminal
function askForMangaName() {
  rl.question('Introduza o nome do Manga (ou digite "sair" para encerrar): ', async (name) => {
    if (name.trim().toLowerCase() === 'sair') {
      rl.close();
      return;
    }

    if (!name.trim()) {
      console.log('Nome inválido!\n');
      askForMangaName();
      return;
    }

    console.log(`A pesquisar "${name}" no AniList...`);
    const results = await searchMangaList(name);

    if (results.length === 0) {
      console.log('Nenhum resultado encontrado.\n');
      askForMangaName();
      return;
    }

    console.log('\nResultados da pesquisa:');
    results.forEach((manga, index) => {
      const title = manga.title.english || manga.title.romaji;
      console.log(`[${index + 1}] ${title} (ID AniList: ${manga.id})`);
    });

    function askForSelection() {
      rl.question(`\nSelecione um número (1 a ${results.length}) ou 0 para cancelar: `, async (choice) => {
        const num = parseInt(choice);
        if (num === 0) {
          console.log('Operação cancelada.\n');
          askForMangaName();
          return;
        }

        if (isNaN(num) || num < 1 || num > results.length) {
          console.log('Seleção inválida.');
          askForSelection();
          return;
        }

        const selectedManga = results[num - 1];
        await runSyncTrace(selectedManga.id);
        askForMangaName();
      });
    }

    askForSelection();
  });
}

console.log('==================================================');
console.log('   Simulador de Busca de Capítulos - Otaku Time   ');
console.log('==================================================');
askForMangaName();
