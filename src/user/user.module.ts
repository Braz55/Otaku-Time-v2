import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BackfillStatsService } from './backfill-stats.service';
import { BackupService } from './backup.service';
import { AchievementService } from './achievement.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    UserService,
    BackfillStatsService,
    BackupService,
    AchievementService,
  ],
  exports: [
    UserService,
    BackupService,
    AchievementService,
  ],
})
export class UserModule {}
