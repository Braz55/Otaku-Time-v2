import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MangaService {
  constructor(private readonly prisma: PrismaService) {}

  // PLANO B: Baka-Updates (MangaUpdates) - Versão "Status Parse"
  async getLatestChapterFromBakaUpdates(title: string): Promise<number | null> {
    try {
      console.log(`[Plano B] A pesquisar "${title}" no Baka-Updates...`);
      
      const searchRes = await fetch('https://api.mangaupdates.com/v1/series/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: title, limit: 1 })
      });
      const searchData = await searchRes.json() as any;

      if (!searchData.results || searchData.results.length === 0) return null;
      
      const seriesId = searchData.results[0].record.series_id;
      const detailRes = await fetch(`https://api.mangaupdates.com/v1/series/${seriesId}`);
      const detailData = await detailRes.json() as any;

      if (detailData.status) {
        const match = detailData.status.match(/(\d+)\s+Chapters/i);
        if (match && match[1]) {
          return parseInt(match[1]);
        }
      }
      return null;
    } catch (error) {
      console.error('[Plano B] Erro:', error);
      return null;
    }
  }

  // Função para sincronizar o capítulo mais recente com a DB
  async syncLatestChapter(anilistId: number): Promise<{ latest: number | null, error?: string }> {
    const manga = await this.searchAniListById(anilistId);
    if (!manga) return { latest: null };
    const title = manga.title.english || manga.title.romaji;

    // Tentar Planos
    const mdResult = await this.getLatestChapterFromMangaDex(anilistId, title);
    let latest = mdResult.chapter;
    let errorMsg = mdResult.error;
    
    if (!latest) {
      console.log(`[Sync] MangaDex falhou para "${title}". A tentar Baka-Updates...`);
      latest = await this.getLatestChapterFromBakaUpdates(title);
      if (latest) {
        errorMsg = undefined; // Encontrado no plano B
      }
    }

    if (latest) {
      // Gravar na DB se encontrámos um valor
      await this.prisma.manga.update({
        where: { id: anilistId },
        data: { numCapitulosTotal: latest }
      }).catch(() => {
        console.log(`[Sync] Manga com ID ${anilistId} não existe na DB local para atualizar.`);
      });
    }

    return { latest, error: errorMsg };
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
    return this.prisma.userManga.update({ where: { id }, data: updateDto, include: { manga: true } });
  }

  async remove(id: number) {
    return this.prisma.userManga.delete({ where: { id } });
  }
}