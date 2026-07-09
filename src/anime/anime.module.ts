import { Module } from '@nestjs/common';
import { AnimeService } from './anime.service';
import { AnimeController } from './anime.controller';
import { TMDBService } from './tmdb.service';
import { AniListService } from './anilist.service';
import { RecommendationService } from './recommendation.service';
import { TVTimeImportService } from './tvtime-import.service';
import { CalendarService } from './calendar.service';
import { ListModule } from '../list/list.module';

@Module({
  imports: [ListModule],
  controllers: [AnimeController],
  providers: [
    AnimeService,
    TMDBService,
    AniListService,
    RecommendationService,
    TVTimeImportService,
    CalendarService,
  ],
  exports: [
    AnimeService,
    TMDBService,
    AniListService,
    RecommendationService,
    TVTimeImportService,
    CalendarService,
  ],
})
export class AnimeModule {}
