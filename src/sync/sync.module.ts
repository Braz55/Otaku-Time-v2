import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AnimeModule } from '../anime/anime.module';
import { MangaModule } from '../manga/manga.module';
import { EmailModule } from '../email/email.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, AnimeModule, MangaModule, EmailModule, NotificationModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
