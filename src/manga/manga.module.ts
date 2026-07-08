import { Module } from '@nestjs/common';
import { MangaService } from './manga.service';
import { MangaController } from './manga.controller';
import { AnilistMangaService } from './anilist-manga.service';
import { MangaSyncService } from './manga-sync.service';
import { ListModule } from '../list/list.module';

@Module({
  imports: [ListModule],
  controllers: [MangaController],
  providers: [MangaService, AnilistMangaService, MangaSyncService],
  exports: [MangaService, AnilistMangaService, MangaSyncService],
})
export class MangaModule {}
