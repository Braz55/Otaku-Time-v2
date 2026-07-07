import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  // Cria um comentário associado a um mediaId e userId
  async createComment(userId: number, mediaId: number, text: string) {
    if (!text || text.trim() === '') {
      throw new BadRequestException(
        'O texto do comentário não pode estar vazio.',
      );
    }

    return this.prisma.comment.create({
      data: {
        userId,
        mediaId,
        text: text.trim(),
      },
      include: {
        user: {
          select: {
            nome: true,
            iconUrl: true,
          },
        },
      },
    });
  }

  // Lista todos os comentários de um anime/manga (mediaId)
  async getCommentsByMedia(mediaId: number) {
    return this.prisma.comment.findMany({
      where: { mediaId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            nome: true,
            iconUrl: true,
          },
        },
      },
    });
  }

  // Adiciona ou remove o like de um comentário (toggle)
  async likeComment(userId: number, commentId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comentário não encontrado.');
    }

    // Verifica se o utilizador já deu like no comentário
    const existingLike = await this.prisma.commentLike.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    return this.prisma.$transaction(async (tx) => {
      if (existingLike) {
        // Se já deu like, remove o like (unlike)
        await tx.commentLike.delete({
          where: {
            userId_commentId: {
              userId,
              commentId,
            },
          },
        });

        return tx.comment.update({
          where: { id: commentId },
          data: {
            likes: {
              decrement: 1,
            },
          },
        });
      } else {
        // Se não deu like, cria o registo de like
        await tx.commentLike.create({
          data: {
            userId,
            commentId,
          },
        });

        return tx.comment.update({
          where: { id: commentId },
          data: {
            likes: {
              increment: 1,
            },
          },
        });
      }
    });
  }

  // Elimina um comentário se pertencer ao autor
  async deleteComment(userId: number, commentId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comentário não encontrado.');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(
        'Não tem permissão para eliminar este comentário.',
      );
    }

    return this.prisma.comment.delete({
      where: { id: commentId },
    });
  }
}
