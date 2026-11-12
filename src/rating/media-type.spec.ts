import { BadRequestException } from '@nestjs/common';
import {
  animeKey,
  animeSourceFromFormat,
  formatFromSource,
  kindOf,
  mediaKey,
  parseMediaSource,
  parseMediaType,
  resolveMediaSource,
} from './media-type';

describe('media-type (L-23, L-24)', () => {
  describe('parseMediaType', () => {
    it('aceita ANIME e MANGA, em maiúsculas ou minúsculas', () => {
      expect(parseMediaType('ANIME')).toBe('ANIME');
      expect(parseMediaType('manga')).toBe('MANGA');
    });

    it('devolve undefined quando o tipo não é enviado', () => {
      expect(parseMediaType(undefined)).toBeUndefined();
      expect(parseMediaType('')).toBeUndefined();
    });

    it('rejeita outros valores com 400', () => {
      expect(() => parseMediaType('SERIE')).toThrow(BadRequestException);
    });
  });

  describe('parseMediaSource', () => {
    it('aceita as três fontes, em maiúsculas ou minúsculas', () => {
      expect(parseMediaSource('TMDB_TV')).toBe('TMDB_TV');
      expect(parseMediaSource('tmdb_movie')).toBe('TMDB_MOVIE');
      expect(parseMediaSource('ANILIST')).toBe('ANILIST');
    });

    it('rejeita outros valores com 400', () => {
      expect(() => parseMediaSource('ANIME')).toThrow(BadRequestException);
    });
  });

  describe('conversões', () => {
    it('kindOf: ANILIST é manga, as fontes do TMDB são anime', () => {
      expect(kindOf('ANILIST')).toBe('MANGA');
      expect(kindOf('TMDB_TV')).toBe('ANIME');
      expect(kindOf('TMDB_MOVIE')).toBe('ANIME');
    });

    it('formato MOVIE ↔ TMDB_MOVIE; tudo o resto é série', () => {
      expect(animeSourceFromFormat('MOVIE')).toBe('TMDB_MOVIE');
      expect(animeSourceFromFormat('movie')).toBe('TMDB_MOVIE');
      expect(animeSourceFromFormat('TV')).toBe('TMDB_TV');
      expect(animeSourceFromFormat(undefined)).toBe('TMDB_TV');
      expect(formatFromSource('TMDB_MOVIE')).toBe('MOVIE');
      expect(formatFromSource('TMDB_TV')).toBe('TV');
    });
  });

  describe('resolveMediaSource (pedidos sem fonte)', () => {
    const prismaWith = (
      animeSources: ('TMDB_TV' | 'TMDB_MOVIE')[],
      manga: boolean,
    ) =>
      ({
        anime: {
          findMany: jest
            .fn()
            .mockResolvedValue(animeSources.map((fonte) => ({ fonte }))),
        },
        manga: {
          findUnique: jest.fn().mockResolvedValue(manga ? { id: 1 } : null),
        },
      }) as any;

    it('usa a fonte enviada sem consultar o catálogo', async () => {
      const prisma = prismaWith(['TMDB_TV'], false);
      await expect(
        resolveMediaSource(prisma, 1, { fonte: 'TMDB_MOVIE' }),
      ).resolves.toBe('TMDB_MOVIE');
      expect(prisma.anime.findMany).not.toHaveBeenCalled();
    });

    it('MANGA → ANILIST; ANIME com formato → fonte do formato', async () => {
      const prisma = prismaWith([], false);
      await expect(
        resolveMediaSource(prisma, 1, { mediaType: 'MANGA' }),
      ).resolves.toBe('ANILIST');
      await expect(
        resolveMediaSource(prisma, 1, { mediaType: 'ANIME', format: 'MOVIE' }),
      ).resolves.toBe('TMDB_MOVIE');
      expect(prisma.anime.findMany).not.toHaveBeenCalled();
    });

    it('ANIME sem formato: a fonte do catálogo, com a série primeiro', async () => {
      await expect(
        resolveMediaSource(prismaWith(['TMDB_MOVIE'], false), 1, {
          mediaType: 'ANIME',
        }),
      ).resolves.toBe('TMDB_MOVIE');
      await expect(
        resolveMediaSource(prismaWith(['TMDB_MOVIE', 'TMDB_TV'], false), 1, {
          mediaType: 'ANIME',
        }),
      ).resolves.toBe('TMDB_TV');
      await expect(
        resolveMediaSource(prismaWith([], false), 1, { mediaType: 'ANIME' }),
      ).resolves.toBe('TMDB_TV');
    });

    it('sem tipo: ANILIST só quando o ID existe apenas no manga', async () => {
      await expect(
        resolveMediaSource(prismaWith([], true), 1, {}),
      ).resolves.toBe('ANILIST');
      await expect(
        resolveMediaSource(prismaWith(['TMDB_TV'], true), 1, {}),
      ).resolves.toBe('TMDB_TV');
      await expect(
        resolveMediaSource(prismaWith([], false), 1, {}),
      ).resolves.toBe('TMDB_TV');
    });
  });

  it('mediaKey e animeKey montam a chave natural (fonte, id)', () => {
    expect(mediaKey('ANILIST', 42)).toEqual({
      fonte_id: { fonte: 'ANILIST', id: 42 },
    });
    expect(animeKey('TMDB_MOVIE', 1399)).toEqual({
      fonte_id: { fonte: 'TMDB_MOVIE', id: 1399 },
    });
  });
});
