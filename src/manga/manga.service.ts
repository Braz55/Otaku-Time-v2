import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MangaService {
  constructor(private readonly prisma: PrismaService) {}

  // PLAN A: Baka-Updates (MangaUpdates)
  async getLatestChapterFromBakaUpdates(title: string, mangaObj?: any): Promise<{ chapter: number | null, breakdown?: { label: string, chapters: number }[] }> {
    try {
      console.log(`[Plan A] Searching "${title}" on Baka-Updates...`);
      
      const searchRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: title, limit: 1 })
      });
      const searchData = await searchRes.json() as any;

      if (!searchData.results || searchData.results.length === 0) return { chapter: null };
      
      let bestRecord = searchData.results[0].record;

      // Se o primeiro resultado for uma Novel, fazer um segundo pedido para apanhar a versão Manga/Manhwa
      if (bestRecord?.type?.toLowerCase() === 'novel') {
        console.log(`[Plan A] "${bestRecord.title}" is a Novel. Searching for Manhwa/Manga adaptation...`);
        const fallbackRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ search: title, limit: 5 })
        });
        const fallbackData = await fallbackRes.json() as any;
        if (fallbackData.results) {
          const nonNovel = fallbackData.results.find((r: any) => r.record?.type?.toLowerCase() !== 'novel');
          if (nonNovel) bestRecord = nonNovel.record;
        }
      }

      // Verificação de segurança: o título encontrado deve corresponder ao que foi pedido
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
        console.log(`[Plan A] Ignored result: "${bestRecord.title}" does not match "${title}".`);
        return { chapter: null };
      }

      console.log(`[Plan A] Candidate: "${bestRecord.title}" (Type: ${bestRecord.type})`);

      const seriesId = bestRecord.series_id;
      const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${seriesId}`);
      const detailData = await detailRes.json() as any;

      if (!detailData?.status) return { chapter: null };

      console.log(`[Plan A] Raw status:`, detailData.status);

      // Filtrar linhas que mencionem "novel" ou "original"
      const rawLines = detailData.status.split(/\n/);
      const validLines = rawLines.filter((line: string) => !/(?:novel|original|orig\b)/i.test(line));

      // ESTRATÉGIA: Somar todos os blocos com label explícito (ex: **S1:** 29 Chapters, **Side Story: *Tak x Sanho*:** 8 Chapters)
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
        console.log(`[Plan A] Labeled blocks:`, breakdown, `-> Sum: ${result}`);
      } else {
        // Fallback: sem blocos rotulados, usar o maior "X Chapters" encontrado
        const cleanStr = validLines.join(' ');
        const chMatches = [...cleanStr.matchAll(/(\d+)\s+Chapters?/gi)];
        const maxFromCh = chMatches.length > 0 ? Math.max(...chMatches.map(m => parseInt(m[1]))) : 0;
        const rangeMatches = [...cleanStr.matchAll(/[-~]\s*(\d+)\b/g)];
        const maxFromRange = rangeMatches.length > 0 ? Math.max(...rangeMatches.map(m => parseInt(m[1]))) : 0;
        result = Math.max(maxFromCh, maxFromRange);
        if (result === 0) {
          console.log(`[Plan A] Status text mentions Volumes or is inconclusive (returned 0).`);
        } else {
          console.log(`[Plan A] No labeled blocks, numeric fallback: ${result}`);
        }
      }

      if (result > 0) {
        console.log(`[Plan A] Success for "${title}": ${result} chapters.`);
        return { chapter: result, breakdown };
      }

      return { chapter: null };
    } catch (error) {
      console.error('[Plan A] Error:', error);
      return { chapter: null };
    }
  }

  // Função para sincronizar o capítulo mais recente com a DB
  async syncLatestChapter(anilistId: number): Promise<{ latest: number | null, error?: string, source?: string, breakdown?: { label: string, chapters: number }[] }> {
    const manga = await this.searchAniListById(anilistId);
    if (!manga) return { latest: null };
    const title = manga.title.english || manga.title.romaji;

    let latest: number | null = null;
    let errorMsg: string | undefined;
    let source = 'AniList';
    let breakdown: { label: string, chapters: number }[] = [];

    // PLAN A: Baka-Updates (MangaUpdates) - Priority source (regardless of status)
    console.log(`[Sync] Consulting Baka-Updates (Plan A) for "${title}"...`);
    const bakaRes = await this.getLatestChapterFromBakaUpdates(title, manga);
    if (bakaRes && bakaRes.chapter) {
      latest = bakaRes.chapter;
      breakdown = bakaRes.breakdown || [];
      source = 'Baka-Updates';
    }

    // Comparison logic: If finished and AniList has a higher chapter count, use AniList.
    if (manga.status === 'FINISHED' && manga.chapters && manga.chapters > 0) {
      if (!latest || manga.chapters > latest) {
        console.log(`[Sync] AniList has more chapters (${manga.chapters}) than external source (${latest || 0}). Using AniList chapters.`);
        latest = manga.chapters;
        source = 'AniList';
        breakdown = []; // Clear breakdown as we are using AniList total chapters
      }
    }

    if (!latest) {
      // PLAN B: MangaDex - Fallback
      console.log(`[Sync] Baka-Updates did not provide a valid chapter count for "${title}" (returned 0) and not finished on AniList. Switching to MangaDex (Plan B)...`);
      const mdResult = await this.getLatestChapterFromMangaDex(anilistId, title, manga);
      latest = mdResult.chapter;
      errorMsg = mdResult.error;
      if (latest) {
        source = 'MangaDex';
      }
    }

    if (latest) {
      // Verificar se existe na DB local antes de atualizar
      const existe = await this.prisma.manga.findUnique({ where: { id: anilistId } });
      if (existe) {
        await this.prisma.manga.update({
          where: { id: anilistId },
          data: { numCapitulosTotal: latest }
        });
      } else {
        console.log(`[Sync] Manga "${title}" (ID ${anilistId}) is an external item not saved in local DB. Progress obtained: ${latest} (${source})`);
      }
    }

    return { latest, error: errorMsg, source, breakdown };
  }

  // Detective function for MangaDex (Plan B)
  async getLatestChapterFromMangaDex(anilistId: number, title: string, mangaObj?: any): Promise<{ chapter: number | null, error?: string }> {
    try {
      console.log(`[Plan B] Searching "${title}" on MangaDex (AniList ID: ${anilistId})...`);
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
      
      const data = await response.json() as any;

      if (!data.data || data.data.length === 0) {
        console.log(`[Plan B] No results found on MangaDex for "${title}".`);
        return { chapter: null };
      }

      console.log(`[Plan B] MangaDex returned ${data.data.length} candidates. Checking AniList ID (${anilistId}) or Title match...`);

      let match = data.data.find((m: any) => m.attributes.links?.al == anilistId.toString());

      if (match) {
        console.log(`[Plan B] Found exact AniList ID match on MangaDex: "${match.attributes.title?.en || match.attributes.title?.['ja-ro'] || match.attributes.title?.ja || 'Unknown'}" (ID: ${match.id})`);
      } else {
        console.log(`[Plan B] No direct AniList ID match found in links. Attempting title fallback match...`);
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
        
        const feedData = await feedRes.json() as any;
        let feedMaxChapter = 0;

        if (feedData.data && feedData.data.length > 0) {
          const chapters = feedData.data
            .map((item: any) => parseFloat(item.attributes.chapter))
            .filter((ch: any) => !isNaN(ch) && ch > 0);
            
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

  // Pesquisa básica na AniList por Nome (para detalhes)
  async searchAniListManga(nomeManga: string, userId?: number) {
    let isAdult: boolean | undefined = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.showAdultContent) {
        isAdult = undefined;
      }
    }

    const query = `
      query ($s: String, $isAdult: Boolean) {
        Page(perPage: 1) {
          media(search: $s, type: MANGA, sort: SEARCH_MATCH, isAdult: $isAdult) {
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
      }
    `;
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { s: nomeManga, isAdult } }),
      });
      const result = await response.json() as any;
      return result?.data?.Page?.media[0] || null;
    } catch { return null; }
  }

  // Pesquisa básica na AniList por ID (para detalhes)
  async searchAniListById(id: number) {
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
      const result = await response.json() as any;
      return result?.data?.Media || null;
    } catch { return null; }
  }

  // Pesquisa para a lista de resultados (Discovery)
  async searchMangaList(nome: string, page: number = 1, userId?: number) {
    let isAdult: boolean | undefined = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.showAdultContent) {
        isAdult = undefined;
      }
    }

    const query = `
      query ($s: String, $page: Int, $isAdult: Boolean) {
        Page(page: $page, perPage: 24) {
          media(search: $s, type: MANGA, sort: POPULARITY_DESC, isAdult: $isAdult) {
            id
            title { english romaji }
            genres
            description
            status
            chapters
            coverImage { large }
          }
        }
      }
    `;
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { s: nome, page, isAdult } })
      });
      const data = await response.json() as any;
      return data.data?.Page?.media || [];
    } catch { return []; }
  }

  // Pesquisa por Género
  async searchByGenre(genre: string, page: number = 1, userId?: number) {
    let isAdult: boolean | undefined = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.showAdultContent) {
        isAdult = undefined;
      }
    }

    const query = `
      query ($genre: String, $page: Int, $isAdult: Boolean) {
        Page(page: $page, perPage: 24) {
          media(genre: $genre, type: MANGA, sort: POPULARITY_DESC, isAdult: $isAdult) {
            id
            title { english romaji }
            genres
            description
            status
            chapters
            coverImage { large }
          }
        }
      }
    `;
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { genre, page, isAdult } })
      });
      const data = await response.json() as any;
      return data.data?.Page?.media || [];
    } catch { return []; }
  }

  // Importação simplificada
  async importFromAniList(nomeManga: string, userId: number, anilistId?: number) {
    const aniListData = anilistId ? await this.searchAniListById(anilistId) : await this.searchAniListManga(nomeManga, userId);
    if (!aniListData) throw new Error('Manga not found');

    const linksJSON = aniListData.externalLinks ? JSON.stringify(aniListData.externalLinks) : null;
    
    let totalCaps: number | null = null;
    const title = aniListData.title.english || aniListData.title.romaji;
    console.log(`[Import] Consulting Baka-Updates (Plan A) for "${title}"...`);
    const bakaRes = await this.getLatestChapterFromBakaUpdates(title, aniListData);
    if (bakaRes && bakaRes.chapter) {
      totalCaps = bakaRes.chapter;
    }

    // Comparison logic: If finished and AniList has higher chapters, choose AniList
    if (aniListData.status === 'FINISHED' && aniListData.chapters && aniListData.chapters > 0) {
      if (!totalCaps || aniListData.chapters > totalCaps) {
        console.log(`[Import] AniList has more chapters (${aniListData.chapters}) than external source (${totalCaps || 0}). Using AniList chapters.`);
        totalCaps = aniListData.chapters;
      }
    }

    if (!totalCaps) {
      console.log(`[Import] Consulting MangaDex (Plan B) for "${title}"...`);
      const mdRes = await this.getLatestChapterFromMangaDex(aniListData.id, title, aniListData);
      if (mdRes && mdRes.chapter) {
        totalCaps = mdRes.chapter;
      }
    }

    if (!totalCaps && aniListData.chapters) {
      totalCaps = aniListData.chapters;
    }

    const manga = await this.prisma.manga.upsert({
      where: { id: aniListData.id },
      update: { 
        numCapitulosTotal: totalCaps, 
        capaUrl: aniListData.coverImage.large, 
        linksExternos: linksJSON 
      },
      create: { 
        id: aniListData.id, 
        titulo: title, 
        statusLancamento: aniListData.status, 
        generos: aniListData.genres.join(', '), 
        descricao: aniListData.description?.replace(/<[^>]*>?/gm, ''), 
        numCapitulosTotal: totalCaps, 
        capaUrl: aniListData.coverImage.large,
        linksExternos: linksJSON
      },
    });

    const userManga = await this.prisma.userManga.upsert({
      where: { userId_mangaId: { userId, mangaId: manga.id } },
      update: {},
      create: { userId, mangaId: manga.id, status: 'PLANNED', capAtual: 0, prioridade: 5 },
      include: { manga: true }
    });
    await this.recalculateUserStats(userId);
    return userManga;
  }

  // CRUD básico
  async findAll(userId: number) {
    const list = await this.prisma.userManga.findMany({ where: { userId }, include: { manga: true } });
    return list.map(item => ({
      id: item.id,
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      statusLancamento: item.manga.statusLancamento,
      capaUrl: item.manga.capaUrl,
      generos: item.manga.generos,
      descricao: item.manga.descricao,
      status: item.status,
      capAtual: item.capAtual,
      numCapitulosTotal: item.manga.numCapitulosTotal,
      prioridade: item.prioridade,
      linksExternos: item.manga.linksExternos,
      linksPersonalizados: item.linksPersonalizados,
      proximoCapituloNumero: item.manga.proximoCapituloNumero,
      proximoCapituloData: item.manga.proximoCapituloData,
      updatedAt: item.updatedAt
    }));
  }

  async findOne(id: number) {
    const item = await this.prisma.userManga.findUnique({ where: { id }, include: { manga: true } });
    if (!item) return null;
    return {
      id: item.id,
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      statusLancamento: item.manga.statusLancamento,
      capaUrl: item.manga.capaUrl,
      generos: item.manga.generos,
      descricao: item.manga.descricao,
      status: item.status,
      capAtual: item.capAtual,
      numCapitulosTotal: item.manga.numCapitulosTotal,
      prioridade: item.prioridade,
      linksExternos: item.manga.linksExternos,
      linksPersonalizados: item.linksPersonalizados,
      proximoCapituloNumero: item.manga.proximoCapituloNumero,
      proximoCapituloData: item.manga.proximoCapituloData,
      updatedAt: item.updatedAt
    };
  }

  async update(id: number, updateDto: any) {
    const atual = await this.prisma.userManga.findUnique({ where: { id }, include: { manga: true } });
    if (!atual) return null;

    if (updateDto.numCapitulosTotal !== undefined) {
      const total = updateDto.numCapitulosTotal;
      const updateData: any = { numCapitulosTotal: total };
      if (atual.manga.statusLancamento === 'RELEASING') {
        updateData.proximoCapituloNumero = total + 1;
        atual.manga.proximoCapituloNumero = total + 1;
      }
      await this.prisma.manga.update({
        where: { id: atual.mangaId },
        data: updateData
      });
      atual.manga.numCapitulosTotal = total;
    }

    let novosDados = { ...updateDto };
    delete novosDados.numCapitulosTotal;

    if (updateDto.status === 'COMPLETED') {
      const totalDisponivel = (atual.manga.statusLancamento === 'RELEASING' && atual.manga.proximoCapituloNumero) 
        ? atual.manga.proximoCapituloNumero - 1 
        : (atual.manga.numCapitulosTotal || atual.capAtual);
      novosDados.capAtual = totalDisponivel;
    }

    if (updateDto.capAtual !== undefined) {
      const cap = updateDto.capAtual;
      const totalDisponivel = (atual.manga.statusLancamento === 'RELEASING' && atual.manga.proximoCapituloNumero) 
        ? atual.manga.proximoCapituloNumero - 1 
        : atual.manga.numCapitulosTotal;

      if (atual.status === 'PLANNED' && cap > 0) novosDados.status = 'WATCHING';
      if (atual.status === 'COMPLETED' && totalDisponivel && cap < totalDisponivel) novosDados.status = 'WATCHING';

      if (atual.manga.statusLancamento !== 'RELEASING' && atual.manga.numCapitulosTotal && cap >= atual.manga.numCapitulosTotal) {
        novosDados.status = 'COMPLETED';
        novosDados.capAtual = atual.manga.numCapitulosTotal;
      }
    }
    const updated = await this.prisma.userManga.update({ where: { id }, data: novosDados, include: { manga: true } });
    await this.recalculateUserStats(updated.userId);
    return { ...updated, titulo: updated.manga.titulo, capaUrl: updated.manga.capaUrl, linksExternos: updated.manga.linksExternos, numCapitulosTotal: updated.manga.numCapitulosTotal, proximoCapituloNumero: updated.manga.proximoCapituloNumero };
  }

  async updateLastModified(id: number, date: Date = new Date()) {
    return this.prisma.manga.update({
      where: { id },
      data: { updatedAt: date }
    });
  }

  async remove(id: number) {
    const item = await this.prisma.userManga.delete({ where: { id } });
    if (item) {
      await this.recalculateUserStats(item.userId);
    }
    return item;
  }

  async recalculateUserStats(userId: number) {
    try {
      const animes = await this.prisma.userAnime.findMany({ where: { userId } });
      const mangas = await this.prisma.userManga.findMany({ where: { userId } });

      const totalAnimeCompleted = animes.filter(a => a.status === 'COMPLETED').length;
      const totalEpisodesWatched = animes.reduce((sum, a) => sum + (a.epAtual || 0), 0);
      const totalMangaRead = mangas.reduce((sum, m) => sum + Math.floor(m.capAtual || 0), 0);
      const animeDaysWasted = parseFloat(((totalEpisodesWatched * 24) / 1440).toFixed(2));
      const mangaDaysWasted = parseFloat(((totalMangaRead * 10) / 1440).toFixed(2));

      await this.prisma.userStatistics.upsert({
        where: { userId },
        update: {
          totalAnimeCompleted,
          totalEpisodesWatched,
          totalMangaRead,
          animeDaysWasted,
          mangaDaysWasted,
        },
        create: {
          userId,
          totalAnimeCompleted,
          totalEpisodesWatched,
          totalMangaRead,
          animeDaysWasted,
          mangaDaysWasted,
        },
      });

      // --- Conquistas automáticas ---
      // 1. Primeiros passos
      await this.prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: 1 } },
        update: {},
        create: { userId, achievementId: 1 }
      });

      // 2. Maratonista (ex: mais de 100 episódios no total)
      if (totalEpisodesWatched >= 100) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: 3 } },
          update: {},
          create: { userId, achievementId: 3 }
        });
      }

      // 3. Leitor Voraz (se leu o primeiro capítulo)
      if (totalMangaRead >= 1) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: 4 } },
          update: {},
          create: { userId, achievementId: 4 }
        });
      }

      // 4. Isekai Trash: Se viu 5+ animes do género "Isekai"
      const animesDetalhes = await this.prisma.userAnime.findMany({
        where: { userId, status: 'COMPLETED' },
        include: { anime: true }
      });
      const isekaiCount = animesDetalhes.filter(ua => ua.anime.generos?.toLowerCase().includes('isekai')).length;
      if (isekaiCount >= 5) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: 2 } },
          update: {},
          create: { userId, achievementId: 2 }
        });
      }

      // 5. Crítico de Elite: se definiu 3 destaques no pódio
      const favoritesCount = await this.prisma.userTopFavorite.count({ where: { userId } });
      if (favoritesCount >= 3) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: 5 } },
          update: {},
          create: { userId, achievementId: 5 }
        });
      }
    } catch (e) {
      console.error('Error recalculating user statistics/achievements:', e);
    }
  }
}