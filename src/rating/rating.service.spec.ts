import { BadRequestException } from '@nestjs/common';
import { RatingService } from './rating.service';
import { PrismaService } from '../prisma/prisma.service';

// Testes das regras RN-11 (média bayesiana) e RN-12 (um voto por utilizador)
describe('RatingService', () => {
  let service: RatingService;

  const prisma = {
    media: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    userRating: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    // A transação corre o callback com o próprio mock como cliente
    $transaction: jest.fn((cb: (tx: any) => Promise<unknown>) => cb(prisma)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RatingService(prisma as unknown as PrismaService);
    prisma.media.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data }),
    );
  });

  it('rejeita notas fora do intervalo 0–10', async () => {
    await expect(service.submitRating(1, 'TMDB_TV', 1, 11)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.submitRating(1, 'TMDB_TV', 1, -1)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('no primeiro voto de um manga, obtém a nota base da AniList e aplica a fórmula', async () => {
    const fetchBase = jest
      .spyOn(service, 'fetchAniListAverageScore')
      .mockResolvedValue(8);
    prisma.media.findUnique.mockResolvedValue(null);
    prisma.media.upsert.mockImplementation(({ create }) =>
      Promise.resolve(create),
    );
    prisma.userRating.findUnique.mockResolvedValue(null);
    // L-18: o pedido à AniList tem de acontecer antes de a transação abrir
    prisma.$transaction.mockImplementationOnce(
      (cb: (tx: any) => Promise<unknown>) => {
        expect(fetchBase).toHaveBeenCalled();
        return cb(prisma);
      },
    );

    const result = await service.submitRating(1, 'ANILIST', 42, 10);

    expect(fetchBase).toHaveBeenCalledWith(42);
    // (8 × 10 + 10) / (10 + 1) = 8.1818… → 8.18
    expect(result.media.avaliacao_geral).toBe(8.18);
    expect(result.media.total_votos_users).toBe(1);
    expect(result.isNewRating).toBe(true);
  });

  it('não volta a pedir a nota base quando a obra já tem avaliações', async () => {
    const fetchBase = jest.spyOn(service, 'fetchAniListAverageScore');
    prisma.media.findUnique.mockResolvedValue({
      id: 42,
      avaliacao_base: 8,
      total_votos_users: 1,
      soma_notas_users: 10,
      avaliacao_geral: 8.18,
    });
    prisma.media.upsert.mockResolvedValue({
      id: 42,
      avaliacao_base: 8,
      total_votos_users: 1,
      soma_notas_users: 10,
      avaliacao_geral: 8.18,
    });
    prisma.userRating.findUnique.mockResolvedValue(null);

    const result = await service.submitRating(2, 'TMDB_TV', 42, 6);

    expect(fetchBase).not.toHaveBeenCalled();
    // (8 × 10 + 10 + 6) / (10 + 2) = 8
    expect(result.media.avaliacao_geral).toBe(8);
    expect(result.media.total_votos_users).toBe(2);
  });

  it('votar de novo substitui o voto anterior sem contar um voto extra', async () => {
    prisma.media.findUnique.mockResolvedValue({
      id: 42,
      avaliacao_base: 8,
      total_votos_users: 1,
      soma_notas_users: 10,
      avaliacao_geral: 8.18,
    });
    prisma.media.upsert.mockResolvedValue({
      id: 42,
      avaliacao_base: 8,
      total_votos_users: 1,
      soma_notas_users: 10,
      avaliacao_geral: 8.18,
    });
    prisma.userRating.findUnique.mockResolvedValue({ id: 7, score: 10 });

    const result = await service.submitRating(1, 'TMDB_TV', 42, 4);

    expect(prisma.userRating.create).not.toHaveBeenCalled();
    expect(prisma.userRating.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { score: 4 },
    });
    // soma passa de 10 para 4; votos continuam 1 → (80 + 4) / 11 = 7.6363… → 7.64
    expect(result.media.soma_notas_users).toBe(4);
    expect(result.media.total_votos_users).toBe(1);
    expect(result.media.avaliacao_geral).toBe(7.64);
    expect(result.isNewRating).toBe(false);
  });

  it('L-23: a nota base de um anime vem do TMDB (série ou filme), nunca da AniList', async () => {
    const tmdb = {
      getTVShowDetails: jest.fn().mockResolvedValue({ vote_average: 7.5 }),
      getMovieDetails: jest.fn().mockResolvedValue({ vote_average: 6 }),
    };
    const svc = new RatingService(
      prisma as unknown as PrismaService,
      tmdb as any,
    );
    const anilist = jest.spyOn(svc, 'fetchAniListAverageScore');

    await expect(svc.fetchBaseScore('TMDB_TV', 1399)).resolves.toBe(7.5);
    await expect(svc.fetchBaseScore('TMDB_MOVIE', 1399)).resolves.toBe(6);
    expect(tmdb.getTVShowDetails).toHaveBeenCalledWith(1399);
    expect(tmdb.getMovieDetails).toHaveBeenCalledWith(1399);
    expect(anilist).not.toHaveBeenCalled();
  });

  it('L-23/L-24: o voto usa a chave (fonte, id) e não toca noutra obra com o mesmo ID', async () => {
    jest.spyOn(service, 'fetchAniListAverageScore').mockResolvedValue(7);
    prisma.media.findUnique.mockResolvedValue(null);
    prisma.media.upsert.mockImplementation(({ create }) =>
      Promise.resolve(create),
    );
    prisma.userRating.findUnique.mockResolvedValue(null);

    const result = await service.submitRating(1, 'ANILIST', 42, 9);

    const key = { fonte_id: { fonte: 'ANILIST', id: 42 } };
    expect(prisma.media.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: key }),
    );
    expect(prisma.media.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: key,
        create: expect.objectContaining({ id: 42, fonte: 'ANILIST' }),
      }),
    );
    expect(prisma.userRating.findUnique).toHaveBeenCalledWith({
      where: {
        userId_fonte_mediaId: {
          userId: 1,
          fonte: 'ANILIST',
          mediaId: 42,
        },
      },
    });
    expect(prisma.userRating.create).toHaveBeenCalledWith({
      data: { userId: 1, fonte: 'ANILIST', mediaId: 42, score: 9 },
    });
    expect(result.fonte).toBe('ANILIST');
    expect(result.mediaType).toBe('MANGA');
  });
});
