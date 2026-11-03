import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BackfillStatsService } from './backfill-stats.service';
import { BackupService } from './backup.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    UserService,
    BackfillStatsService,
    BackupService,
  ],
  exports: [
    UserService,
    BackupService,
  ],
})
export class UserModule {}
