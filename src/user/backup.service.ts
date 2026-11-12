import { Injectable, Optional } from '@nestjs/common';
import { MediaSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { TMDBService } from '../anime/tmdb.service';
import { normalizeTMDBToAniList } from '../anime/anime.utils';
import {
  AnimeSource,
  animeKey,
  animeSourceFromFormat,
  findAnimeSource,
} from '../rating/media-type';

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tmdbService?: TMDBService,
  ) {}

  async generateBackup(userId: number) {
    const animes = await this.prisma.userAnime.findMany({
      where: { userId },
      select: {
        animeFonte: true,
        animeId: true,
        status: true,
        epAtual: true,
        prioridade: true,
        anime: {
          select: {
            titulo: true,
            numEpisodiosTotal: true,
          },
        },
      },
    });
    const mangas = await this.prisma.userManga.findMany({
      where: { userId },
      select: {
        mangaId: true,
        status: true,
        capAtual: true,
        prioridade: true,
        manga: {
          select: {
            titulo: true,
            numCapitulosTotal: true,
          },
        },
      },
    });

    const backupAnimes = animes.map((item) => ({
      fonte: item.animeFonte,
      animeId: item.animeId,
      titulo: item.anime.titulo,
      status: item.status,
      epAtual: item.epAtual,
      prioridade: item.prioridade,
      numEpisodiosTotal: item.anime.numEpisodiosTotal,
      tipo: 'anime',
    }));

    const backupMangas = mangas.map((item) => ({
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      status: item.status,
      capAtual: item.capAtual,
      prioridade: item.prioridade,
      numCapitulosTotal: item.manga.numCapitulosTotal,
      tipo: 'manga',
    }));

    return {
      version: 1,
      backupDate: new Date().toISOString(),
      exporter: 'Otaku-Time',
      userId,
      data: {
        animes: backupAnimes,
        mangas: backupMangas,
      },
    };
  }

  async fetchAniListGraphQL(
    query: string,
    variables: any,
    retries = 3,
    delayMs = 1500,
  ): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
          console.warn(
            `[Backend Restore] AniList Rate Limited (429). Waiting ${waitTime}ms before retry (attempt ${attempt}/${retries})...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }

        const result = await response.json();
        return result?.data?.Media || null;
      } catch (error) {
        console.warn(
          `[Backend Restore] Error querying AniList (attempt ${attempt}/${retries}):`,
          error,
        );
        if (attempt === retries) return null;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  // Metadados de um anime pedidos ao TMDB, no formato AniList usado pelo restauro.
  // Antes eram pedidos à AniList com o ID do TMDB, o que devolvia outra obra (L-23).
  async getTmdbAnimeById(fonte: AnimeSource, id: number) {
    if (!this.tmdbService) return null;
    try {
      const details =
        fonte === MediaSource.TMDB_MOVIE
          ? await this.tmdbService.getMovieDetails(id)
          : await this.tmdbService.getTVShowDetails(id);
      return normalizeTMDBToAniList(
        details,
        fonte === MediaSource.TMDB_MOVIE ? 'movie' : 'tv',
      );
    } catch {
      return null;
    }
  }

  async getAniListMangaById(id: number) {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: MANGA) {
          id
          title { english romaji native }
          coverImage { large }
          status
          description
          genres
          tags { name rank }
          chapters
          countryOfOrigin
          format
          source
        }
      }
    `;
    return this.fetchAniListGraphQL(query, { id });
  }

  async restoreBackup(userId: number, backup: RestoreBackupDto) {
    if (!backup || !backup.data) {
      throw new Error('Backup inválido ou sem dados');
    }

    const { animes, mangas } = backup.data;

    // Restaurar Animes
    if (Array.isArray(animes)) {
      for (const item of animes) {
        // Backups antigos não têm a fonte: usa a do catálogo local, senão deduz do formato
        const fonte: AnimeSource =
          item.fonte ??
          (await findAnimeSource(this.prisma, item.animeId)) ??
          animeSourceFromFormat(item.formato);
        const metadata = await this.getTmdbAnimeById(fonte, item.animeId);

        const generosDict = metadata
          ? buildGenerosDict(metadata.genres, metadata.tags?.slice(0, 5))
          : {};
        const descricaoLimpa = metadata?.description
          ? metadata.description.replace(/<[^>]*>?/gm, '')
          : 'Sem descrição.';

        const numEpisodiosFallback = item.numEpisodiosTotal ?? null;
        await this.prisma.anime.upsert({
          where: animeKey(fonte, item.animeId),
          update: {
            titulo: metadata
              ? metadata.title.english || metadata.title.romaji
              : item.titulo,
            statusLancamento: metadata ? metadata.status : undefined,
            capaUrl: metadata ? metadata.coverImage?.large : undefined,
            generos: metadata ? generosDict : undefined,
            descricao: metadata ? descricaoLimpa : undefined,
            numEpisodiosTotal: metadata
              ? metadata.episodes
              : numEpisodiosFallback,
            paisOrigem: metadata ? metadata.countryOfOrigin : undefined,
            formato: metadata ? metadata.format : undefined,
            materialOrigem: metadata ? metadata.source : undefined,
          },
          create: {
            id: item.animeId,
            fonte,
            titulo: metadata
              ? metadata.title.english || metadata.title.romaji
              : item.titulo,
            statusLancamento: metadata ? metadata.status : 'UNKNOWN',
            capaUrl: metadata ? metadata.coverImage?.large : '',
            generos: generosDict,
            descricao: descricaoLimpa,
            numEpisodiosTotal: metadata
              ? metadata.episodes
              : numEpisodiosFallback,
            paisOrigem: metadata ? metadata.countryOfOrigin : null,
            formato: metadata ? metadata.format : null,
            materialOrigem: metadata ? metadata.source : null,
          },
        });

        // Upsert UserAnime
        await this.prisma.userAnime.upsert({
          where: {
            userId_animeFonte_animeId: {
              userId,
              animeFonte: fonte,
              animeId: item.animeId,
            },
          },
          update: {
            epAtual: item.epAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5,
          },
          create: {
            userId,
            animeFonte: fonte,
            animeId: item.animeId,
            epAtual: item.epAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Restaurar Mangas
    if (Array.isArray(mangas)) {
      for (const item of mangas) {
        const metadata = await this.getAniListMangaById(item.mangaId);

        const generosDict = metadata
          ? buildGenerosDict(metadata.genres, metadata.tags?.slice(0, 5))
          : {};
        const descricaoLimpa = metadata?.description
          ? metadata.description.replace(/<[^>]*>?/gm, '')
          : 'Sem descrição.';

        const numCapitulosFallback = item.numCapitulosTotal ?? null;
        await this.prisma.manga.upsert({
          where: { id: item.mangaId },
          update: {
            titulo: metadata
              ? metadata.title.english || metadata.title.romaji
              : item.titulo,
            statusLancamento: metadata ? metadata.status : undefined,
            capaUrl: metadata ? metadata.coverImage?.large : undefined,
            generos: metadata ? generosDict : undefined,
            descricao: metadata ? descricaoLimpa : undefined,
            numCapitulosTotal: metadata
              ? metadata.chapters
              : numCapitulosFallback,
            paisOrigem: metadata ? metadata.countryOfOrigin : undefined,
            formato: metadata ? metadata.format : undefined,
            materialOrigem: metadata ? metadata.source : undefined,
          },
          create: {
            id: item.mangaId,
            titulo: metadata
              ? metadata.title.english || metadata.title.romaji
              : item.titulo,
            statusLancamento: metadata ? metadata.status : 'UNKNOWN',
            capaUrl: metadata ? metadata.coverImage?.large : '',
            generos: generosDict,
            descricao: descricaoLimpa,
            numCapitulosTotal: metadata
              ? metadata.chapters
              : numCapitulosFallback,
            paisOrigem: metadata ? metadata.countryOfOrigin : null,
            formato: metadata ? metadata.format : null,
            materialOrigem: metadata ? metadata.source : null,
          },
        });

        // Upsert UserManga
        await this.prisma.userManga.upsert({
          where: { userId_mangaId: { userId, mangaId: item.mangaId } },
          update: {
            capAtual: item.capAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5,
          },
          create: {
            userId,
            mangaId: item.mangaId,
            capAtual: item.capAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return { success: true, message: 'Restore completed successfully' };
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
