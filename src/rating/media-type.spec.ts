import { BadRequestException } from '@nestjs/common';
import { mediaKey, parseMediaType, resolveMediaType } from './media-type';

describe('media-type (L-24)', () => {
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

  describe('resolveMediaType', () => {
    const prismaWith = (anime: boolean, manga: boolean) =>
      ({
        anime: {
          findUnique: jest.fn().mockResolvedValue(anime ? { id: 1 } : null),
        },
        manga: {
          findUnique: jest.fn().mockResolvedValue(manga ? { id: 1 } : null),
        },
      }) as any;

    it('usa o tipo enviado sem consultar o catálogo', async () => {
      const prisma = prismaWith(true, false);
      await expect(resolveMediaType(prisma, 1, 'MANGA')).resolves.toBe('MANGA');
      expect(prisma.anime.findUnique).not.toHaveBeenCalled();
    });

    it('sem tipo: é MANGA só quando o ID existe apenas no catálogo de manga', async () => {
      await expect(resolveMediaType(prismaWith(false, true), 1)).resolves.toBe(
        'MANGA',
      );
      await expect(resolveMediaType(prismaWith(true, true), 1)).resolves.toBe(
        'ANIME',
      );
      await expect(resolveMediaType(prismaWith(true, false), 1)).resolves.toBe(
        'ANIME',
      );
      await expect(resolveMediaType(prismaWith(false, false), 1)).resolves.toBe(
        'ANIME',
      );
    });
  });

  it('mediaKey monta a chave composta da Media', () => {
    expect(mediaKey(42, 'MANGA')).toEqual({
      id_mediaType: { id: 42, mediaType: 'MANGA' },
    });
  });
});
