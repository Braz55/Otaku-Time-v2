import { Module } from '@nestjs/common';
import { MangaService } from './manga.service';
import { MangaController } from './manga.controller';
import { AnilistMangaService } from './anilist-manga.service';
import { MangaSyncService } from './manga-sync.service';
import { ListModule } from '../list/list.module';
import { NotificationModule } from '../notification/notification.module';
import { StatisticsModule } from '../statistics/statistics.module';

@Module({
  imports: [ListModule, NotificationModule, StatisticsModule],
  controllers: [MangaController],
  providers: [MangaService, AnilistMangaService, MangaSyncService],
  exports: [MangaService, AnilistMangaService, MangaSyncService],
})
export class MangaModule {}
