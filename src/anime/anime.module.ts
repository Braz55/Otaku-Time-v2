import { Module } from '@nestjs/common';
import { AnimeService } from './anime.service';
import { AnimeController } from './anime.controller';
import { TMDBService } from './tmdb.service';
import { AniListService } from './anilist.service';
import { RecommendationService } from './recommendation.service';
import { AnimeRecommendationService } from './anime-recommendation.service';
import { TVTimeImportService } from './tvtime-import.service';
import { CalendarService } from './calendar.service';
import { EpisodeStoreService } from './episode-store.service';
import { ListModule } from '../list/list.module';
import { NotificationModule } from '../notification/notification.module';
import { StatisticsModule } from '../statistics/statistics.module';

@Module({
  imports: [ListModule, NotificationModule, StatisticsModule],
  controllers: [AnimeController],
  providers: [
    AnimeService,
    TMDBService,
    AniListService,
    RecommendationService,
    AnimeRecommendationService,
    TVTimeImportService,
    CalendarService,
    EpisodeStoreService,
  ],
  exports: [
    AnimeService,
    TMDBService,
    AniListService,
    RecommendationService,
    TVTimeImportService,
    CalendarService,
    EpisodeStoreService,
  ],
})
export class AnimeModule {}
