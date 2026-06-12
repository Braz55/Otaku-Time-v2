import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MangaModule } from './manga/manga.module';
import { AnimeModule } from './anime/anime.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './sync/sync.module';
import { RatingModule } from './rating/rating.module';
import { CommentModule } from './comment/comment.module';
import { KeepAwakeService } from './keep-awake.service';
import { KeepAwakeMiddleware } from './keep-awake.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MangaModule,
    AnimeModule,
    UserModule,
    PrismaModule,
    AuthModule,
    SyncModule,
    RatingModule,
    CommentModule,
  ],
  controllers: [AppController],
  providers: [AppService, KeepAwakeService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(KeepAwakeMiddleware)
      .forRoutes('*');
  }
}
