import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MangaService {
  constructor(private readonly prisma: PrismaService) {}

  // PLANO A: Baka-Updates (MangaUpdates)
  async getLatestChapterFromBakaUpdates(title: string, mangaObj?: any): Promise<{ chapter: number | null, breakdown?: { label: string, chapters: number }[] }> {
    try {
      console.log(`[Plano B] A pesquisar "${title}" no Baka-Updates...`);
      
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
        console.log(`[Plano B] "${bestRecord.title}" é uma Novel. A procurar a adaptação Manhwa/Manga...`);
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
        console.log(`[Plano B] Resultado ignorado: "${bestRecord.title}" não corresponde a "${title}".`);
        return { chapter: null };
      }

      console.log(`[Plano B] Candidato: "${bestRecord.title}" (Tipo: ${bestRecord.type})`);

      const seriesId = bestRecord.series_id;
      const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${seriesId}`);
      const detailData = await detailRes.json() as any;

      if (!detailData?.status) return { chapter: null };

      console.log(`[Plano B] Status bruto:`, detailData.status);

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
        console.log(`[Plano B] Blocos rotulados:`, breakdown, `-> Soma: ${result}`);
      } else {
        // Fallback: sem blocos rotulados, usar o maior "X Chapters" encontrado
        const cleanStr = validLines.join(' ');
        const chMatches = [...cleanStr.matchAll(/(\d+)\s+Chapters?/gi)];
        const maxFromCh = chMatches.length > 0 ? Math.max(...chMatches.map(m => parseInt(m[1]))) : 0;
        const rangeMatches = [...cleanStr.matchAll(/[-~]\s*(\d+)\b/g)];
        const maxFromRange = rangeMatches.length > 0 ? Math.max(...rangeMatches.map(m => parseInt(m[1]))) : 0;
        result = Math.max(maxFromCh, maxFromRange);
        console.log(`[Plano B] Sem blocos rotulados, fallback numérico: ${result}`);
      }

      if (result > 0) {
        console.log(`[Plano B] Sucesso para "${title}": ${result} capítulos.`);
        return { chapter: result, breakdown };
      }

      return { chapter: null };
    } catch (error) {
      console.error('[Plano B] Erro:', error);
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

    // Se o manga já está finalizado (FINISHED) e a AniList tem o número total de capítulos, usamos diretamente!
    if (manga.status === 'FINISHED' && manga.chapters && manga.chapters > 0) {
      console.log(`[Sync] "${title}" já está finalizado na AniList. Usando o total oficial: ${manga.chapters} capítulos.`);
      latest = manga.chapters;
      
      // Fazer a pesquisa no Baka-Updates para obter a divisória de temporadas/especiais!
      console.log(`[Sync] A consultar Baka-Updates para obter a divisória de temporadas de "${title}"...`);
      const bakaRes = await this.getLatestChapterFromBakaUpdates(title, manga);
      if (bakaRes && bakaRes.breakdown) {
        breakdown = bakaRes.breakdown;
      }
    } else {
      // PLANO A: Baka-Updates (MangaUpdates) - Principal fonte para Manhwas/Webtoons
      console.log(`[Sync] A consultar Baka-Updates (Plano A) para "${title}"...`);
      const bakaRes = await this.getLatestChapterFromBakaUpdates(title, manga);
      if (bakaRes && bakaRes.chapter) {
        latest = bakaRes.chapter;
        breakdown = bakaRes.breakdown || [];
        source = 'Baka-Updates';
      }
      
      if (!latest) {
        // PLANO B: MangaDex - Fallback
        console.log(`[Sync] Baka-Updates falhou para "${title}". A tentar MangaDex (Plano B)...`);
        const mdResult = await this.getLatestChapterFromMangaDex(anilistId, title);
        latest = mdResult.chapter;
        errorMsg = mdResult.error;
        if (latest) {
          source = 'MangaDex';
        }
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
        console.log(`[Sync] Manga "${title}" (ID ${anilistId}) é um item externo não guardado na DB local. Progresso obtido: ${latest} (${source})`);
      }
    }

    return { latest, error: errorMsg, source, breakdown };
  }

  // Função "Detetive" para o MangaDex (Plano A)
  async getLatestChapterFromMangaDex(anilistId: number, title: string): Promise<{ chapter: number | null, error?: string }> {
    try {
      const mdUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
      const response = await fetch(mdUrl, {
        headers: { 'User-Agent': 'OtakuTimeBot/1.0' }
      });
      
      if (!response.ok) {
        console.error(`[MangaDex] HTTP Error: ${response.status}`);
        if (response.status === 503 || response.status === 502 || response.status === 504) {
          return { chapter: null, error: `Servidores do MangaDex Offline (Erro ${response.status})` };
        }
        return { chapter: null, error: `MangaDex falhou (Erro ${response.status})` };
      }
      
      const data = await response.json() as any;

      if (!data.data || data.data.length === 0) return { chapter: null };

      const match = data.data.find((m: any) => m.attributes.links?.al == anilistId.toString());

      if (match) {
        const feedRes = await fetch(`https://api.mangadex.org/manga/${match.id}/feed?limit=1&order[chapter]=desc&translatedLanguage[]=en`, {
          headers: { 'User-Agent': 'OtakuTimeBot/1.0' }
        });
        
        if (!feedRes.ok) {
          if (feedRes.status === 503 || feedRes.status === 502 || feedRes.status === 504) {
            return { chapter: null, error: `Servidores do MangaDex Offline (Erro ${feedRes.status})` };
          }
          return { chapter: null, error: `MangaDex falhou (Erro ${feedRes.status})` };
        }
        
        const feedData = await feedRes.json() as any;
        
        if (feedData.data && feedData.data[0]) {
          return { chapter: parseFloat(feedData.data[0].attributes.chapter) };
        }
      }
      return { chapter: null };
    } catch (error) {
      console.error('Erro ao consultar MangaDex:', error);
      return { chapter: null, error: 'Erro de ligação ao MangaDex' };
    }
  }

  // Pesquisa básica na AniList por Nome (para detalhes)
  async searchAniListManga(nomeManga: string) {
    const query = `
      query ($s: String) {
        Page(perPage: 1) {
          media(search: $s, type: MANGA, sort: SEARCH_MATCH) {
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
        body: JSON.stringify({ query, variables: { s: nomeManga } }),
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
  async searchMangaList(nome: string, page: number = 1) {
    const query = `
      query ($s: String, $page: Int) {
        Page(page: $page, perPage: 24) {
          media(search: $s, type: MANGA, sort: POPULARITY_DESC) {
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
        body: JSON.stringify({ query, variables: { s: nome, page } })
      });
      const data = await response.json() as any;
      return data.data?.Page?.media || [];
    } catch { return []; }
  }

  // Pesquisa por Género
  async searchByGenre(genre: string, page: number = 1) {
    const query = `
      query ($genre: String, $page: Int) {
        Page(page: $page, perPage: 24) {
          media(genre: $genre, type: MANGA, sort: POPULARITY_DESC) {
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
        body: JSON.stringify({ query, variables: { genre, page } })
      });
      const data = await response.json() as any;
      return data.data?.Page?.media || [];
    } catch { return []; }
  }

  // Importação simplificada
  async importFromAniList(nomeManga: string, userId: number, anilistId?: number) {
    const aniListData = anilistId ? await this.searchAniListById(anilistId) : await this.searchAniListManga(nomeManga);
    if (!aniListData) throw new Error('Manga não encontrado');

    const linksJSON = aniListData.externalLinks ? JSON.stringify(aniListData.externalLinks) : null;
    
    const manga = await this.prisma.manga.upsert({
      where: { id: aniListData.id },
      update: { 
        numCapitulosTotal: aniListData.chapters, 
        capaUrl: aniListData.coverImage.large, 
        linksExternos: linksJSON 
      },
      create: { 
        id: aniListData.id, 
        titulo: aniListData.title.english || aniListData.title.romaji, 
        statusLancamento: aniListData.status, 
        generos: aniListData.genres.join(', '), 
        descricao: aniListData.description?.replace(/<[^>]*>?/gm, ''), 
        numCapitulosTotal: aniListData.chapters, 
        capaUrl: aniListData.coverImage.large,
        linksExternos: linksJSON
      },
    });

    return this.prisma.userManga.upsert({
      where: { userId_mangaId: { userId, mangaId: manga.id } },
      update: {},
      create: { userId, mangaId: manga.id, status: 'PLANNED', capAtual: 0, prioridade: 5 },
      include: { manga: true }
    });
  }

  // CRUD básico
  async findAll(userId: number) {
    return this.prisma.userManga.findMany({ where: { userId }, include: { manga: true } });
  }

  async findOne(id: number) {
    return this.prisma.userManga.findUnique({ where: { id }, include: { manga: true } });
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

    if (updateDto.capAtual !== undefined) {
      const cap = updateDto.capAtual;
      if (atual.status === 'PLANNED' && cap > 0) novosDados.status = 'WATCHING';
      if (atual.manga.statusLancamento !== 'RELEASING' && atual.manga.numCapitulosTotal && cap >= atual.manga.numCapitulosTotal) {
        novosDados.status = 'COMPLETED';
        novosDados.capAtual = atual.manga.numCapitulosTotal;
      }
    }
    const updated = await this.prisma.userManga.update({ where: { id }, data: novosDados, include: { manga: true } });
    return { ...updated, titulo: updated.manga.titulo, capaUrl: updated.manga.capaUrl, linksExternos: updated.manga.linksExternos, numCapitulosTotal: updated.manga.numCapitulosTotal, proximoCapituloNumero: updated.manga.proximoCapituloNumero };
  }

  async remove(id: number) {
    return this.prisma.userManga.delete({ where: { id } });
  }
}