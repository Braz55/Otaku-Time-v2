import { Module } from '@nestjs/common';
import { AnimeService } from './anime.service';
import { AnimeController } from './anime.controller';
import { TMDBService } from './tmdb.service';
import { ListModule } from '../list/list.module';

@Module({
  imports: [ListModule],
  controllers: [AnimeController],
  providers: [AnimeService, TMDBService],
  exports: [AnimeService, TMDBService],
})
export class AnimeModule {}
