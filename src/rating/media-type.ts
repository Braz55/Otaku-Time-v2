import { BadRequestException } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// L-24: o anime usa IDs do TMDB e o manga IDs da AniList, e os dois intervalos sobrepõem-se.
// Avaliações e comentários são identificados pelo par (id, tipo).

// Valida o tipo vindo de um pedido (query string ou corpo). Aceita minúsculas.
export function parseMediaType(value: unknown): MediaType | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const upper = String(value).toUpperCase();
  if (upper === MediaType.ANIME || upper === MediaType.MANGA) {
    return upper as MediaType;
  }
  throw new BadRequestException('mediaType deve ser ANIME ou MANGA.');
}

// Versões antigas da app não enviam o tipo. Nesse caso deduz-se do catálogo:
// se o ID só existe no manga é MANGA; em todos os outros casos é ANIME (comportamento anterior).
export async function resolveMediaType(
  prisma: PrismaService,
  id: number,
  type?: MediaType,
): Promise<MediaType> {
  if (type) return type;
  const [anime, manga] = await Promise.all([
    prisma.anime.findUnique({ where: { id }, select: { id: true } }),
    prisma.manga.findUnique({ where: { id }, select: { id: true } }),
  ]);
  return !anime && manga ? MediaType.MANGA : MediaType.ANIME;
}

// Chave da tabela Media para usar em findUnique / upsert / update / delete.
export function mediaKey(id: number, mediaType: MediaType) {
  return { id_mediaType: { id, mediaType } };
}
