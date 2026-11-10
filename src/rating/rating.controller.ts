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
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/rating.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { parseMediaType, resolveMediaType } from './media-type';

@Controller('rating')
export class RatingController {
  constructor(
    private readonly ratingService: RatingService,
    private readonly prisma: PrismaService,
  ) {}

  // ?type=ANIME|MANGA (L-24). Sem tipo, é deduzido do catálogo (versões antigas da app).
  @Get('media/:mediaId')
  async getOverallRating(
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
    return this.ratingService.getOverallRating(+mediaId, mediaType);
  }

  @UseGuards(JwtAuthGuard)
  @Get('media/:mediaId/user')
  async getUserRating(
    @Request() req,
    @Param('mediaId') mediaId: string,
    @Query('type') type?: string,
  ) {
    if (isNaN(+mediaId)) {
      throw new BadRequestException('mediaId deve ser um número válido.');
    }
    const userId = req.user.userId;
    const mediaType = await resolveMediaType(
      this.prisma,
      +mediaId,
      parseMediaType(type),
    );
    return this.ratingService.getUserRating(userId, +mediaId, mediaType);
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
    const mediaType = await resolveMediaType(
      this.prisma,
      mediaId,
      parseMediaType(body.mediaType),
    );
    return this.ratingService.submitRating(userId, mediaId, mediaType, score);
  }
}
