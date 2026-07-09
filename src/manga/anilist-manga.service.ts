import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MangaService } from './manga.service';
import { MangaSyncService } from './manga-sync.service';

@Injectable()
export class AnilistMangaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MangaService))
    private readonly mangaService: MangaService,
    @Inject(forwardRef(() => MangaSyncService))
    private readonly mangaSyncService: MangaSyncService,
  ) {}

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
            averageScore
            status
            chapters
            genres
            tags { name rank }
            countryOfOrigin
            format
            source
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
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables: { s: nomeManga, isAdult } }),
      });
      const result = await response.json();
      return result?.data?.Page?.media[0] || null;
    } catch (error: any) {
      console.error(
        `AniList searchAniListManga error: ${error.message || error}`,
        error.stack,
      );
      return null;
    }
  }

  async searchAniListById(id: number) {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: MANGA) {
          id
          title { english romaji }
          averageScore
          status
          chapters
          genres
          tags { name rank }
          countryOfOrigin
          format
          source
          description
          coverImage { large }
          externalLinks { url site type language }
        }
      }
    `;
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables: { id } }),
      });
      const result = await response.json();
      return result?.data?.Media || null;
    } catch (error: any) {
      console.error(
        `AniList searchAniListById error: ${error.message || error}`,
        error.stack,
      );
      return null;
    }
  }

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
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables: { s: nome, page, isAdult } }),
      });
      const data = await response.json();
      return data.data?.Page?.media || [];
    } catch (error: any) {
      console.error(
        `AniList search error: ${error.message || error}`,
        error.stack,
      );
      return [];
    }
  }

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
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables: { genre, page, isAdult } }),
      });
      const data = await response.json();
      return data.data?.Page?.media || [];
    } catch (error: any) {
      console.error(
        `AniList genre search error: ${error.message || error}`,
        error.stack,
      );
      return [];
    }
  }

  async importFromAniList(
    nomeManga: string,
    userId: number,
    anilistId?: number,
  ) {
    let manga = anilistId
      ? await this.prisma.manga.findUnique({ where: { id: anilistId } })
      : null;

    if (manga) {
      const userManga = await this.prisma.userManga.upsert({
        where: { userId_mangaId: { userId, mangaId: manga.id } },
        update: {},
        create: {
          userId,
          mangaId: manga.id,
          status: 'PLANNED',
          capAtual: 0,
          prioridade: 5,
        },
        include: { manga: true },
      });

      this.mangaService.backgroundUpdateManga(manga.id, userId).catch((err) => {
        console.error('Error in backgroundUpdateManga:', err);
      });

      const rating = await this.prisma.media.findUnique({
        where: { id: manga.id },
      });
      return {
        ...userManga,
        avaliacaoGeral: rating?.avaliacao_geral ?? null,
        totalVotosUsers: rating?.total_votos_users ?? 0,
      };
    }

    const aniListData = anilistId
      ? await this.searchAniListById(anilistId)
      : await this.searchAniListManga(nomeManga, userId);
    if (!aniListData) throw new Error('Manga not found');

    const linksJSON = aniListData.externalLinks
      ? JSON.stringify(aniListData.externalLinks)
      : null;
    const title = aniListData.title.english || aniListData.title.romaji;

    const existingManga = await this.prisma.manga.findUnique({
      where: { id: aniListData.id },
    });
    const initialTotalCaps =
      existingManga?.numCapitulosTotal ?? (aniListData.chapters || null);

    const generosDict = buildGenerosDict(
      aniListData.genres,
      aniListData.tags?.slice(0, 10),
    );

    manga = await this.prisma.manga.upsert({
      where: { id: aniListData.id },
      update: {
        numCapitulosTotal: initialTotalCaps,
        capaUrl: aniListData.coverImage.large,
        linksExternos: linksJSON,
        generos: generosDict,
        paisOrigem: aniListData.countryOfOrigin,
        formato: aniListData.format,
        materialOrigem: aniListData.source,
      },
      create: {
        id: aniListData.id,
        titulo: title,
        statusLancamento: aniListData.status,
        generos: generosDict,
        paisOrigem: aniListData.countryOfOrigin,
        formato: aniListData.format,
        materialOrigem: aniListData.source,
        descricao: aniListData.description?.replace(/<[^>]*>?/gm, ''),
        numCapitulosTotal: initialTotalCaps,
        capaUrl: aniListData.coverImage.large,
        linksExternos: linksJSON,
      },
    });

    const averageScore = aniListData.averageScore
      ? aniListData.averageScore / 10
      : 0;
    const existingMedia = await this.prisma.media.findUnique({
      where: { id: manga.id },
    });
    if (!existingMedia) {
      await this.prisma.media.create({
        data: {
          id: manga.id,
          avaliacao_base: averageScore,
          total_votos_users: 0,
          soma_notas_users: 0,
          avaliacao_geral: averageScore,
        },
      });
    }

    const userManga = await this.prisma.userManga.upsert({
      where: { userId_mangaId: { userId, mangaId: manga.id } },
      update: {},
      create: {
        userId,
        mangaId: manga.id,
        status: 'PLANNED',
        capAtual: 0,
        prioridade: 5,
      },
      include: { manga: true },
    });

    this.mangaService.recalculateUserStats(userId).catch((err) => {
      console.error('Error recalculating user stats in background:', err);
    });

    this.mangaSyncService.syncLatestChapter(manga.id).catch((err) => {
      console.error(
        `[BackgroundSync] Erro ao sincronizar capítulos para manga ID ${manga.id} em background:`,
        err,
      );
    });

    const rating = await this.prisma.media.findUnique({
      where: { id: manga.id },
    });
    return {
      ...userManga,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }
}

function buildGenerosDict(
  genres: string[] | undefined,
  tags: { name: string; rank?: number }[] | undefined,
): Record<string, number> {
  const dict: Record<string, number> = {};
  if (genres) {
    genres.forEach((g) => {
      dict[g.trim()] = 100;
    });
  }
  if (tags) {
    tags.forEach((t) => {
      dict[t.name.trim()] = t.rank !== undefined ? t.rank : 100;
    });
  }
  return dict;
}
