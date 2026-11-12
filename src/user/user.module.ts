import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BackfillStatsService } from './backfill-stats.service';
import { BackupService } from './backup.service';
import { StatisticsModule } from '../statistics/statistics.module';
import { TMDBService } from '../anime/tmdb.service';

@Module({
  imports: [PrismaModule, StatisticsModule],
  controllers: [UserController],
  providers: [
    UserService,
    BackfillStatsService,
    BackupService,
    TMDBService,
  ],
  exports: [
    UserService,
    BackupService,
  ],
})
export class UserModule {}
