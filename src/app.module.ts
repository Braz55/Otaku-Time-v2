import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MangaModule } from './manga/manga.module';
import { AnimeModule } from './anime/anime.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MangaModule,
    AnimeModule,
    UserModule,
    PrismaModule,
    AuthModule,
    ChatModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
