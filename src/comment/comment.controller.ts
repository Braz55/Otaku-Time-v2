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
import {
  parseMediaSource,
  parseMediaType,
  resolveMediaSource,
} from '../rating/media-type';

function parseId(mediaId: string): number {
  if (isNaN(+mediaId)) {
    throw new BadRequestException('mediaId deve ser um número válido.');
  }
  return +mediaId;
}

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
    const fonte = await resolveMediaSource(this.prisma, mediaId, {
      fonte: body.fonte,
      mediaType: parseMediaType(body.mediaType),
    });
    return this.commentService.createComment(userId, fonte, mediaId, text);
  }

  // Rota antiga: ?type=ANIME|MANGA e ?format=MOVIE|TV; a fonte é deduzida.
  @Get('media/:mediaId')
  async getCommentsByMediaLegacy(
    @Param('mediaId') mediaId: string,
    @Query('type') type?: string,
    @Query('format') format?: string,
  ) {
    const id = parseId(mediaId);
    const fonte = await resolveMediaSource(this.prisma, id, {
      mediaType: parseMediaType(type),
      format,
    });
    return this.commentService.getCommentsByMedia(fonte, id);
  }

  // L-23: /comment/media/TMDB_TV/1399
  @Get('media/:fonte/:mediaId')
  async getCommentsByMedia(
    @Param('fonte') fonte: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.commentService.getCommentsByMedia(
      parseMediaSource(fonte)!,
      parseId(mediaId),
    );
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
