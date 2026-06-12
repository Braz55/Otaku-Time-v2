import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BackfillStatsService } from './backfill-stats.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [UserService, BackfillStatsService],
  exports: [UserService],
})
export class UserModule {}
