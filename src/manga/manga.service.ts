import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MangaService {
  constructor(private readonly prisma: PrismaService) {}

  // Função "Detetive" para o MangaDex
  async getLatestChapterFromMangaDex(anilistId: number, title: string): Promise<number | null> {
    try {
      // 1. Pesquisa com filtros de adulto para não esconder nada
      const mdUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
      const response = await fetch(mdUrl);
      const data = await response.json() as any;

      if (!data.data || data.data.length === 0) return null;

      // 2. Handshake: Procurar o ID da AniList nos links do MangaDex
      const match = data.data.find(m => m.attributes.links?.al == anilistId.toString());

      if (match) {
        // 3. Se encontrou, pede o feed de capítulos (ordenado pelo mais recente em Inglês)
        const feedRes = await fetch(`https://api.mangadex.org/manga/${match.id}/feed?limit=1&order[chapter]=desc&translatedLanguage[]=en`);
        const feedData = await feedRes.json() as any;
        
        if (feedData.data && feedData.data[0]) {
          return parseFloat(feedData.data[0].attributes.chapter);
        }
      }
      return null;
    } catch (error) {
      console.error('Erro ao consultar MangaDex:', error);
      return null;
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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