import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { MediaSource } from '@prisma/client';
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/rating.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseMediaSource,
  parseMediaType,
  resolveMediaSource,
} from './media-type';

function parseId(mediaId: string): number {
  if (isNaN(+mediaId)) {
    throw new BadRequestException('mediaId deve ser um número válido.');
  }
  return +mediaId;
}

function requireSource(fonte: string): MediaSource {
  return parseMediaSource(fonte)!;
}

@Controller('rating')
export class RatingController {
  constructor(
    private readonly ratingService: RatingService,
    private readonly prisma: PrismaService,
  ) {}

  // Rotas antigas (sem fonte): ?type=ANIME|MANGA e ?format=MOVIE|TV; a fonte é deduzida.
  // Declaradas antes das novas para /media/:id/user não ser lido como /media/:fonte/:id.
  @Get('media/:mediaId')
  async getOverallRatingLegacy(
    @Param('mediaId') mediaId: string,
    @Query('type') type?: string,
    @Query('format') format?: string,
  ) {
    const id = parseId(mediaId);
    const fonte = await resolveMediaSource(this.prisma, id, {
      mediaType: parseMediaType(type),
      format,
    });
    return this.ratingService.getOverallRating(fonte, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('media/:mediaId/user')
  async getUserRatingLegacy(
    @Request() req,
    @Param('mediaId') mediaId: string,
    @Query('type') type?: string,
    @Query('format') format?: string,
  ) {
    const id = parseId(mediaId);
    const fonte = await resolveMediaSource(this.prisma, id, {
      mediaType: parseMediaType(type),
      format,
    });
    return this.ratingService.getUserRating(req.user.userId, fonte, id);
  }

  // L-23: /rating/media/TMDB_TV/1399
  @Get('media/:fonte/:mediaId')
  async getOverallRating(
    @Param('fonte') fonte: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.ratingService.getOverallRating(
      requireSource(fonte),
      parseId(mediaId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('media/:fonte/:mediaId/user')
  async getUserRating(
    @Request() req,
    @Param('fonte') fonte: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.ratingService.getUserRating(
      req.user.userId,
      requireSource(fonte),
      parseId(mediaId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async submitRating(@Request() req, @Body() body: CreateRatingDto) {
    const { mediaId, score } = body;

    if (
      mediaId === undefined ||
      mediaId === null ||
      typeof mediaId !== 'number'
    ) {
      throw new BadRequestException(
        'O campo mediaId é obrigatório e deve ser um número.',
      );
    }

    if (score === undefined || score === null || typeof score !== 'number') {
      throw new BadRequestException(
        'O campo score é obrigatório e deve ser um número.',
      );
    }

    const userId = req.user.userId;
    const fonte = await resolveMediaSource(this.prisma, mediaId, {
      fonte: body.fonte,
      mediaType: parseMediaType(body.mediaType),
    });
    return this.ratingService.submitRating(userId, fonte, mediaId, score);
  }
}
