import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { ListModule } from './list/list.module';
import { KeepAwakeModule } from './keep-awake.module';
import { KeepAwakeMiddleware } from './keep-awake.middleware';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: process.env.NODE_ENV === 'test' ? 999999 : 100,
    }]),
    MangaModule,
    AnimeModule,
    UserModule,
    PrismaModule,
    AuthModule,
    SyncModule,
    RatingModule,
    CommentModule,
    ListModule,
    NotificationModule,
    KeepAwakeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(KeepAwakeMiddleware).forRoutes('*');
  }
}
