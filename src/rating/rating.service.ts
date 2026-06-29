import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverallRating(mediaId: number) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        avaliacao_geral: true,
        total_votos_users: true,
      },
    });

    if (media) {
      return media;
    }

    const baseScore = await this.fetchAniListAverageScore(mediaId);
    return {
      id: mediaId,
      avaliacao_geral: Math.round(baseScore * 100) / 100,
      total_votos_users: 0,
    };
  }

  async getUserRating(userId: number, mediaId: number) {
    const rating = await this.prisma.userRating.findUnique({
      where: {
        userId_mediaId: {
          userId,
          mediaId,
        },
      },
      select: {
        score: true,
      },
    });

    return {
      mediaId,
      score: rating?.score ?? null,
    };
  }

  // Busca o averageScore da AniList por ID de Media (Anime ou Manga)
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
  async submitRating(userId: number, mediaId: number, score: number) {
    if (score < 0 || score > 10) {
      throw new BadRequestException('A nota deve estar entre 0 e 10.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verificar se a Media existe, se não, criar obtendo a nota base do AniList
      let media = await tx.media.findUnique({
        where: { id: mediaId },
      });

      if (!media) {
        const baseScore = await this.fetchAniListAverageScore(mediaId);
        media = await tx.media.create({
          data: {
            id: mediaId,
            avaliacao_base: baseScore,
            total_votos_users: 0,
            soma_notas_users: 0,
            avaliacao_geral: baseScore,
          },
        });
      }

      // 2. Verificar se já existe classificação do utilizador para esta Media
      const existingRating = await tx.userRating.findUnique({
        where: {
          userId_mediaId: {
            userId,
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
        where: { id: mediaId },
        data: {
          total_votos_users: totalVotos,
          soma_notas_users: somaNotas,
          avaliacao_geral: avaliacaoGeralArredondada,
        },
      });

      return {
        userId,
        mediaId,
        score,
        isNewRating: !existingRating,
        media: updatedMedia,
      };
    });
  }
}
