import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { MediaSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TMDBService } from '../anime/tmdb.service';
import { kindOf, mediaKey } from './media-type';

@Injectable()
export class RatingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tmdbService?: TMDBService,
  ) {}

  async getOverallRating(fonte: MediaSource, mediaId: number) {
    const media = await this.prisma.media.findUnique({
      where: mediaKey(fonte, mediaId),
      select: {
        id: true,
        fonte: true,
        avaliacao_geral: true,
        total_votos_users: true,
      },
    });

    if (media) {
      return { ...media, mediaType: kindOf(media.fonte) };
    }

    const baseScore = await this.fetchBaseScore(fonte, mediaId);
    return {
      id: mediaId,
      fonte,
      mediaType: kindOf(fonte),
      avaliacao_geral: Math.round(baseScore * 100) / 100,
      total_votos_users: 0,
    };
  }

  async getUserRating(userId: number, fonte: MediaSource, mediaId: number) {
    const rating = await this.prisma.userRating.findUnique({
      where: {
        userId_fonte_mediaId: {
          userId,
          fonte,
          mediaId,
        },
      },
      select: {
        score: true,
      },
    });

    return {
      mediaId,
      fonte,
      mediaType: kindOf(fonte),
      score: rating?.score ?? null,
    };
  }

  // Nota base (0–10) de uma obra que ainda não tem Media, pedida à fonte certa (L-23).
  // Antes, o ID do TMDB era enviado à AniList e devolvia a nota de outra obra.
  async fetchBaseScore(fonte: MediaSource, mediaId: number): Promise<number> {
    if (fonte === MediaSource.ANILIST) {
      return this.fetchAniListAverageScore(mediaId);
    }
    if (!this.tmdbService) return 0;
    try {
      const details =
        fonte === MediaSource.TMDB_MOVIE
          ? await this.tmdbService.getMovieDetails(mediaId)
          : await this.tmdbService.getTVShowDetails(mediaId);
      const vote = Number(details?.vote_average);
      return Number.isFinite(vote) ? vote : 0;
    } catch {
      return 0;
    }
  }

  // Busca o averageScore da AniList por ID de Media (manga)
  async fetchAniListAverageScore(mediaId: number): Promise<number> {
    const query = `
      query ($id: Int) {
        Media(id: $id) {
          averageScore
        }
      }
    `;
    const variables = { id: mediaId };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      const averageScore = result?.data?.Media?.averageScore;
      if (averageScore !== undefined && averageScore !== null) {
        // A AniList devolve valores de 0 a 100 (ex: 78). Convertemos para escala de 0 a 10 (ex: 7.8).
        return averageScore / 10;
      }
    } catch (error) {
      console.error(
        `Erro ao obter pontuação do AniList para a média ${mediaId}:`,
        error,
      );
    }
    return 0; // Valor padrão se não for encontrado ou se houver erro
  }

  // Regista ou atualiza um voto de utilizador dentro de uma Transaction
  async submitRating(
    userId: number,
    fonte: MediaSource,
    mediaId: number,
    score: number,
  ) {
    if (score < 0 || score > 10) {
      throw new BadRequestException('A nota deve estar entre 0 e 10.');
    }

    // 1. Nota base pedida à fonte ANTES de abrir a transação (L-18): um pedido HTTP lento
    // não pode manter a transação aberta (o Prisma cancela-a ao fim de 5 s).
    const mediaExistente = await this.prisma.media.findUnique({
      where: mediaKey(fonte, mediaId),
      select: { id: true },
    });
    const baseScore = mediaExistente
      ? 0 // não é usada: a Media já existe e o upsert não a altera
      : await this.fetchBaseScore(fonte, mediaId);

    return this.prisma.$transaction(async (tx) => {
      // upsert: se dois primeiros votos chegarem ao mesmo tempo, só um cria a Media
      const media = await tx.media.upsert({
        where: mediaKey(fonte, mediaId),
        update: {},
        create: {
          id: mediaId,
          fonte,
          avaliacao_base: baseScore,
          total_votos_users: 0,
          soma_notas_users: 0,
          avaliacao_geral: baseScore,
        },
      });

      // 2. Verificar se já existe classificação do utilizador para esta Media
      const existingRating = await tx.userRating.findUnique({
        where: {
          userId_fonte_mediaId: {
            userId,
            fonte,
            mediaId,
          },
        },
      });

      let totalVotos = media.total_votos_users;
      let somaNotas = media.soma_notas_users;

      if (!existingRating) {
        // Novo voto: inserir linha em User_Rating e incrementar totais
        await tx.userRating.create({
          data: {
            userId,
            fonte,
            mediaId,
            score,
          },
        });
        totalVotos += 1;
        somaNotas += score;
      } else {
        // Atualização de voto: atualizar a linha e recalcular soma
        await tx.userRating.update({
          where: {
            id: existingRating.id,
          },
          data: {
            score,
          },
        });
        somaNotas = somaNotas - existingRating.score + score;
      }

      // 3. Recalcular avaliacao_geral usando a fórmula da semente fixa
      // avaliacao_geral = ((avaliacao_base * 10) + soma_notas_users) / (10 + total_votos_users)
      const avaliacaoGeralCalculada =
        (media.avaliacao_base * 10 + somaNotas) / (10 + totalVotos);
      const avaliacaoGeralArredondada =
        Math.round(avaliacaoGeralCalculada * 100) / 100;

      // Atualizar a Media com a nova média geral e estatísticas
      const updatedMedia = await tx.media.update({
        where: mediaKey(fonte, mediaId),
        data: {
          total_votos_users: totalVotos,
          soma_notas_users: somaNotas,
          avaliacao_geral: avaliacaoGeralArredondada,
        },
      });

      return {
        userId,
        mediaId,
        fonte,
        mediaType: kindOf(fonte),
        score,
        isNewRating: !existingRating,
        media: updatedMedia,
      };
    });
  }
}
