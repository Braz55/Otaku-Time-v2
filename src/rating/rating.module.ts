import { Module } from '@nestjs/common';
import { RatingService } from './rating.service';
import { RatingController } from './rating.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TMDBService } from '../anime/tmdb.service';

@Module({
  imports: [PrismaModule],
  controllers: [RatingController],
  providers: [RatingService, TMDBService],
  exports: [RatingService],
})
export class RatingModule {}
