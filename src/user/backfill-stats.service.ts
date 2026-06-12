import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BackfillStatsService implements OnModuleInit {
  private readonly logger = new Logger(BackfillStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Starting statistics backfill migration for existing users...');
    try {
      await this.runBackfill();
      this.logger.log('Statistics backfill migration completed successfully.');
    } catch (error) {
      this.logger.error('Failed to run statistics backfill migration:', error);
    }
  }

  async runBackfill() {
    const users = await this.prisma.user.findMany({
      include: {
        statistics: true,
        animes: true,
        mangas: true,
      },
    });

    for (const user of users) {
      const totalAnimeCompleted = user.animes.filter(a => a.status === 'COMPLETED').length;
      const totalEpisodesWatched = user.animes.reduce((sum, a) => sum + (a.epAtual || 0), 0);
      const totalMangaRead = user.mangas.reduce((sum, m) => sum + Math.floor(m.capAtual || 0), 0);
      const daysWasted = parseFloat(((totalEpisodesWatched * 24) / 1440).toFixed(2));

      await this.prisma.userStatistics.upsert({
        where: { userId: user.id },
        update: {
          totalAnimeCompleted,
          totalEpisodesWatched,
          totalMangaRead,
          daysWasted,
        },
        create: {
          userId: user.id,
          totalAnimeCompleted,
          totalEpisodesWatched,
          totalMangaRead,
          daysWasted,
        },
      });
    }
  }
}
