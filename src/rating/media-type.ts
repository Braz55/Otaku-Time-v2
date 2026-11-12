import { BadRequestException } from '@nestjs/common';
import { MediaSource, MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// L-23 + L-24 + L-25 (opção A): uma obra é identificada pelo par (fonte, id externo).
//   ANILIST    → manga (IDs da AniList)
//   TMDB_TV    → anime/série (IDs de séries do TMDB)
//   TMDB_MOVIE → anime/filme (IDs de filmes do TMDB, numeração separada da das séries)

export type AnimeSource = 'TMDB_TV' | 'TMDB_MOVIE';

// Referência a uma obra pela sua chave natural
export interface MediaRef {
  fonte: MediaSource;
  id: number;
}

export const ANIME_SOURCES: AnimeSource[] = [
  MediaSource.TMDB_TV,
  MediaSource.TMDB_MOVIE,
];

// Tipo de obra (prateleira ANIME/MANGA) a que a fonte corresponde
export function kindOf(fonte: MediaSource): MediaType {
  return fonte === MediaSource.ANILIST ? MediaType.MANGA : MediaType.ANIME;
}

export function isAnimeSource(fonte: MediaSource): fonte is AnimeSource {
  return fonte === MediaSource.TMDB_TV || fonte === MediaSource.TMDB_MOVIE;
}

// Fonte de um anime a partir do formato (como vem do TMDB normalizado ou do campo Anime.formato)
export function animeSourceFromFormat(format?: string | null): AnimeSource {
  return format?.toUpperCase() === 'MOVIE'
    ? MediaSource.TMDB_MOVIE
    : MediaSource.TMDB_TV;
}

// Formato que o TMDBService espera ('MOVIE' | 'TV') para uma fonte de anime
export function formatFromSource(fonte: AnimeSource): 'MOVIE' | 'TV' {
  return fonte === MediaSource.TMDB_MOVIE ? 'MOVIE' : 'TV';
}

// Valida a fonte vinda de um pedido. Aceita minúsculas.
export function parseMediaSource(value: unknown): MediaSource | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const upper = String(value).toUpperCase();
  if ((Object.values(MediaSource) as string[]).includes(upper)) {
    return upper as MediaSource;
  }
  throw new BadRequestException(
    'fonte deve ser ANILIST, TMDB_TV ou TMDB_MOVIE.',
  );
}

// Valida o tipo vindo de um pedido (query string ou corpo). Aceita minúsculas.
export function parseMediaType(value: unknown): MediaType | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const upper = String(value).toUpperCase();
  if (upper === MediaType.ANIME || upper === MediaType.MANGA) {
    return upper as MediaType;
  }
  throw new BadRequestException('mediaType deve ser ANIME ou MANGA.');
}

// Fonte de um anime que já está no catálogo local. Prefere a série quando existem as duas.
export async function findAnimeSource(
  prisma: PrismaService,
  id: number,
): Promise<AnimeSource | undefined> {
  const rows = await prisma.anime.findMany({
    where: { id },
    select: { fonte: true },
  });
  if (rows.some((r) => r.fonte === MediaSource.TMDB_TV)) {
    return MediaSource.TMDB_TV;
  }
  return rows[0]?.fonte as AnimeSource | undefined;
}

// Compatibilidade com pedidos que não trazem a fonte (versões antigas da app):
// - fonte explícita ganha sempre;
// - MANGA → ANILIST;
// - ANIME com formato → TMDB_MOVIE / TMDB_TV;
// - ANIME sem formato → a fonte do anime no catálogo local (série primeiro), senão TMDB_TV;
// - sem tipo nenhum → se o ID só existe no manga é ANILIST, senão trata-se como anime.
export async function resolveMediaSource(
  prisma: PrismaService,
  id: number,
  hints: { fonte?: MediaSource; mediaType?: MediaType; format?: string | null },
): Promise<MediaSource> {
  if (hints.fonte) return hints.fonte;
  if (hints.mediaType === MediaType.MANGA) return MediaSource.ANILIST;
  if (hints.format) return animeSourceFromFormat(hints.format);

  const animeSource = await findAnimeSource(prisma, id);
  if (animeSource) return animeSource;
  if (hints.mediaType === MediaType.ANIME) return MediaSource.TMDB_TV;

  const manga = await prisma.manga.findUnique({
    where: { id },
    select: { id: true },
  });
  return manga ? MediaSource.ANILIST : MediaSource.TMDB_TV;
}

// Chave da tabela Media para usar em findUnique / upsert / update / delete.
export function mediaKey(fonte: MediaSource, id: number) {
  return { fonte_id: { fonte, id } };
}

// Chave da tabela Anime para usar em findUnique / update / delete.
export function animeKey(fonte: MediaSource, id: number) {
  return { fonte_id: { fonte, id } };
}
