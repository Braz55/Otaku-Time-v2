import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MangaService {
  constructor(private readonly prisma: PrismaService) {}

  // PLANO B: Baka-Updates (MangaUpdates) - Versão Ultra Otimizada (1 Pedido Base + Fallback de Novel)
  async getLatestChapterFromBakaUpdates(title: string, mangaObj?: any): Promise<number | null> {
    try {
      console.log(`[Plano B] A pesquisar "${title}" no Baka-Updates (limit: 1)...`);
      
      const searchRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: title, limit: 1 })
      });
      const searchData = await searchRes.json() as any;

      if (!searchData.results || searchData.results.length === 0) return null;
      
      // Limpeza de strings para comparação justa
      const clean = (s: string) => s ? s.toLowerCase().replace(/[^\w\s]/g, '').trim() : '';
      const mainTitles = [title, mangaObj?.title?.english, mangaObj?.title?.romaji].filter(Boolean).map(clean);

      // 1. Filtrar para excluir adaptações de Novel
      const nonNovels = searchData.results.filter((r: any) => r.record?.type?.toLowerCase() !== 'novel');

      // 2. Filtrar candidatos legítimos (Correspondência exata, Side Stories/Especiais oficiais, ou pequenas variações de título)
      const sequelKeywords = ['side story', 'special', 'sequel', 'part', 'season', 'gaiden', 'spinoff', 'spin off', 'extra', 'stories'];
      
      const validCandidates = nonNovels.filter((r: any) => {
        const recTitle = clean(r.record?.title);
        
        return mainTitles.some(t => {
          // Correspondência Exata (ex: "Codename Anastasia")
          if (recTitle === t) return true;
          
          // Suporte a Side Stories / Sequências Oficiais (ex: "Semantic Error Side Story")
          if (recTitle.startsWith(t)) {
            const remainder = recTitle.replace(t, '').trim();
            if (sequelKeywords.some(kw => remainder.includes(kw))) {
              return true;
            }
          }

          // Variações pequenas de título (ex: "Code Name Anastasia" vs "Codename Anastasia")
          if (recTitle.includes(t) || t.includes(recTitle)) {
            return Math.abs(recTitle.length - t.length) <= 5;
          }

          return false;
        });
      });

      if (validCandidates.length === 0) {
        console.log(`[Plano B] Nenhuma correspondência de Manhwa/Manga válida encontrada para "${title}".`);
        return null;
      }

      console.log(`[Plano B] Candidatos válidos encontrados (${validCandidates.length}):`, validCandidates.map((c: any) => c.record?.title).join(', '));

      let overallMax = 0;

      // Inspecionar os detalhes de todos os candidatos válidos (top 5) para encontrar o maior progresso (incluindo Side Stories)
      const topCandidates = validCandidates.slice(0, 5);
      for (const cand of topCandidates) {
        const seriesId = cand.record.series_id;
        const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${seriesId}`);
        const detailData = await detailRes.json() as any;

        if (detailData?.status) {
          console.log(`[Plano B] Status bruto para "${cand.record?.title}":`, detailData.status);
          
          // Filtramos para excluir qualquer parte que mencione "novel" ou "original work"
          const rawLines = detailData.status.split(/\n/);
          const validLines = rawLines.filter((line: string) => !/(?:novel|original|orig\b)/i.test(line));

          // ESTRATÉGIA: Procurar blocos com label explícito (ex: **S1:** 29 Chapters, **Side Story:** 9 Chapters)
          // Estes blocos são identificados por um label em negrito (**...**) ou texto seguido de ":" antes do número de capítulos.
          // Regex que captura: qualquer coisa antes de ":" (incluindo labels em negrito) + "X Chapters"
          const labeledBlockRegex = /\*\*[^*]+\*\*\s*:?\s*(\d+)\s+Chapters|^[^:]+:\s*(\d+)\s+Chapters/im;
          const allLabeledMatches = [...validLines.flatMap((line: string) => {
            const m = line.match(/\*\*[^*]+\*\*\s*:?\s*(\d+)\s+Chapters|^[^:]+:\s*(\d+)\s+Chapters/i);
            if (m) return [parseInt(m[1] || m[2])];
            return [];
          })];

          let candidateMax = 0;

          if (allLabeledMatches.length > 0) {
            // Temos blocos com label explícito -> somar todos (S1 + S2 + S3 + Side Story + Special, etc.)
            const sumLabeled = allLabeledMatches.reduce((acc, n) => acc + n, 0);
            console.log(`[Plano B] Blocos rotulados encontrados: [${allLabeledMatches.join(', ')}] -> Soma: ${sumLabeled}`);
            candidateMax = sumLabeled;
          } else {
            // Fallback: não há blocos com label -> procurar o maior número de "X Chapters" simples
            const cleanStr = validLines.join(' ');
            const chMatches = [...cleanStr.matchAll(/(\d+)\s+Chapters/gi)];
            candidateMax = chMatches.length > 0
              ? Math.max(...chMatches.map(m => parseInt(m[1])))
              : 0;

            // Também verificar intervalos finais (53~93)
            const rangeMatches = [...cleanStr.matchAll(/[-~]\s*(\d+)\b/g)];
            const maxFromRange = rangeMatches.length > 0
              ? Math.max(...rangeMatches.map(m => parseInt(m[1])))
              : 0;

            candidateMax = Math.max(candidateMax, maxFromRange);
            console.log(`[Plano B] Sem blocos rotulados, usando fallback numérico: ${candidateMax}`);
          }

          console.log(`[Plano B] Max para "${cand.record?.title}": ${candidateMax}`);
          
          if (candidateMax > overallMax) {
            overallMax = candidateMax;
          }
        }
      }

      if (overallMax > 0) {
        console.log(`[Plano B] Sucesso para "${title}": Encontrados ${overallMax} capítulos no total.`);
        return overallMax;
      }

      return null;
    } catch (error) {
      console.error('[Plano B] Erro:', error);
      return null;
    }
  }

  // Função para sincronizar o capítulo mais recente com a DB
  async syncLatestChapter(anilistId: number): Promise<{ latest: number | null, error?: string, source?: string }> {
    const manga = await this.searchAniListById(anilistId);
    if (!manga) return { latest: null };
    const title = manga.title.english || manga.title.romaji;

    // Tentar Planos
    const mdResult = await this.getLatestChapterFromMangaDex(anilistId, title);
    let latest = mdResult.chapter;
    let errorMsg = mdResult.error;
    let source = 'MangaDex';
    
    if (!latest) {
      console.log(`[Sync] MangaDex falhou para "${title}". A tentar Baka-Updates...`);
      latest = await this.getLatestChapterFromBakaUpdates(title, manga);
      if (latest) {
        errorMsg = undefined; // Encontrado no plano B
        source = 'Baka-Updates';
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

    return { latest, error: errorMsg, source };
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
  async searchMangaList(nome: string) {
    const query = `
      query ($s: String) {
        Page(perPage: 15) {
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
        body: JSON.stringify({ query, variables: { s: nome } })
      });
      const data = await response.json() as any;
      return data.data?.Page?.media || [];
    } catch { return []; }
  }

  // Pesquisa por Género
  async searchByGenre(genre: string) {
    const query = `
      query ($genre: String) {
        Page(perPage: 20) {
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
        body: JSON.stringify({ query, variables: { genre } })
      });
      const data = await response.json() as any;
      return data.data?.Page?.media || [];
    } catch { return []; }
  }

  // Importação simplificada
  async importFromAniList(nomeManga: string, userId: number) {
    const aniListData = await this.searchAniListManga(nomeManga);
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
    let novosDados = { ...updateDto };
    if (updateDto.capAtual !== undefined) {
      const cap = updateDto.capAtual;
      if (atual.status === 'PLANNED' && cap > 0) novosDados.status = 'WATCHING';
      if (atual.manga.statusLancamento !== 'RELEASING' && atual.manga.numCapitulosTotal && cap >= atual.manga.numCapitulosTotal) {
        novosDados.status = 'COMPLETED';
        novosDados.capAtual = atual.manga.numCapitulosTotal;
      }
    }
    return this.prisma.userManga.update({ where: { id }, data: novosDados, include: { manga: true } });
  }

  async remove(id: number) {
    return this.prisma.userManga.delete({ where: { id } });
  }
}