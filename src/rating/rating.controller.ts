import { Controller, Post, Get, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/rating.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get('media/:mediaId')
  async getOverallRating(@Param('mediaId') mediaId: string) {
    if (isNaN(+mediaId)) {
      throw new BadRequestException('mediaId deve ser um número válido.');
    }
    return this.ratingService.getOverallRating(+mediaId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('media/:mediaId/user')
  async getUserRating(@Request() req, @Param('mediaId') mediaId: string) {
    if (isNaN(+mediaId)) {
      throw new BadRequestException('mediaId deve ser um número válido.');
    }
    const userId = req.user.userId;
    return this.ratingService.getUserRating(userId, +mediaId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async submitRating(@Request() req, @Body() body: CreateRatingDto) {
    const { mediaId, score } = body;

    if (mediaId === undefined || mediaId === null || typeof mediaId !== 'number') {
      throw new BadRequestException('O campo mediaId é obrigatório e deve ser um número.');
    }

    if (score === undefined || score === null || typeof score !== 'number') {
      throw new BadRequestException('O campo score é obrigatório e deve ser um número.');
    }

    const userId = req.user.userId;
    return this.ratingService.submitRating(userId, mediaId, score);
  }
}
