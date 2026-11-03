import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticsService } from '../statistics/statistics.service';

@Injectable()
export class BackfillStatsService implements OnModuleInit {
  private readonly logger = new Logger(BackfillStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly statisticsService: StatisticsService,
  ) {}

  async onModuleInit() {
    this.logger.log(
      'Starting statistics backfill migration for existing users...',
    );
    try {
      await this.runBackfill();
      this.logger.log('Statistics backfill migration completed successfully.');
    } catch (error) {
      this.logger.error('Failed to run statistics backfill migration:', error);
    }
  }

  async runBackfill() {
    const users = await this.prisma.user.findMany({ select: { id: true } });

    for (const user of users) {
      await this.statisticsService.recalculateUserStats(user.id);
    }
  }
}
