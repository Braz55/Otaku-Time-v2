import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Minutos assumidos por episódio de anime e por capítulo de manga
const MINUTES_PER_EPISODE = 24;
const MINUTES_PER_CHAPTER = 10;

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculateUserStats(userId: number) {
    try {
      await this.computeAndSave(userId);
    } catch (e) {
      console.error('Error recalculating user statistics:', e);
    }
  }

  private async computeAndSave(userId: number) {
    const [animes, mangas] = await Promise.all([
      this.prisma.userAnime.findMany({
        where: { userId },
        select: { status: true, epAtual: true },
      }),
      this.prisma.userManga.findMany({
        where: { userId },
        select: { capAtual: true },
      }),
    ]);

    const totalAnimeCompleted = animes.filter(
      (a) => a.status === 'COMPLETED',
    ).length;
    const totalEpisodesWatched = animes.reduce(
      (sum, a) => sum + (a.epAtual || 0),
      0,
    );
    const totalMangaRead = mangas.reduce(
      (sum, m) => sum + Math.floor(m.capAtual || 0),
      0,
    );
    const animeDaysWasted = parseFloat(
      ((totalEpisodesWatched * MINUTES_PER_EPISODE) / 1440).toFixed(2),
    );
    const mangaDaysWasted = parseFloat(
      ((totalMangaRead * MINUTES_PER_CHAPTER) / 1440).toFixed(2),
    );

    const stats = {
      totalAnimeCompleted,
      totalEpisodesWatched,
      totalMangaRead,
      animeDaysWasted,
      mangaDaysWasted,
    };

    await this.prisma.userStatistics.upsert({
      where: { userId },
      update: stats,
      create: { userId, ...stats },
    });
  }
}
