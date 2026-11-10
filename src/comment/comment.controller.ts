import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { parseMediaType, resolveMediaType } from '../rating/media-type';

@Controller('comment')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createComment(
    @Request() req: { user: { userId: number } },
    @Body() body: CreateCommentDto,
  ) {
    const { mediaId, text } = body;

    if (
      mediaId === undefined ||
      mediaId === null ||
      typeof mediaId !== 'number'
    ) {
      throw new BadRequestException(
        'O campo mediaId é obrigatório e deve ser um número.',
      );
    }

    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new BadRequestException(
        'O campo text é obrigatório e deve ser uma string preenchida.',
      );
    }

    const userId = req.user.userId;
    const mediaType = await resolveMediaType(
      this.prisma,
      mediaId,
      parseMediaType(body.mediaType),
    );
    return this.commentService.createComment(userId, mediaId, mediaType, text);
  }

  // ?type=ANIME|MANGA (L-24). Sem tipo, é deduzido do catálogo (versões antigas da app).
  @Get('media/:mediaId')
  async getCommentsByMedia(
    @Param('mediaId') mediaId: string,
    @Query('type') type?: string,
  ) {
    if (isNaN(+mediaId)) {
      throw new BadRequestException('mediaId deve ser um número válido.');
    }
    const mediaType = await resolveMediaType(
      this.prisma,
      +mediaId,
      parseMediaType(type),
    );
    return this.commentService.getCommentsByMedia(+mediaId, mediaType);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  async likeComment(
    @Request() req: { user: { userId: number } },
    @Param('id') id: string,
  ) {
    if (isNaN(+id)) {
      throw new BadRequestException(
        'id do comentário deve ser um número válido.',
      );
    }
    const userId = req.user.userId;
    return this.commentService.likeComment(userId, +id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteComment(
    @Request() req: { user: { userId: number } },
    @Param('id') id: string,
  ) {
    if (isNaN(+id)) {
      throw new BadRequestException(
        'id do comentário deve ser um número válido.',
      );
    }
    const userId = req.user.userId;
    return this.commentService.deleteComment(userId, +id);
  }
}
