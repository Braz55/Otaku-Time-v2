import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCalendar(userId: number, startDateStr?: string) {
    const startLimit = startDateStr ? new Date(startDateStr) : new Date();
    if (!startDateStr) {
      startLimit.setDate(startLimit.getDate() - 2);
    }
    startLimit.setHours(0, 0, 0, 0);
    const startLimitTime = startLimit.getTime();

    const userAnimes = await this.prisma.userAnime.findMany({
      where: {
        userId,
        status: { not: 'DROPPED' },
        wasDropped: false,
      },
      include: {
        anime: true,
      },
    });

    const airingAnime: any[] = [];

    for (const ua of userAnimes) {
      const a = ua.anime;
      if (!a) continue;

      const episodes = (a.episodesList as any[]) || [];
      if (Array.isArray(episodes) && episodes.length > 0) {
        episodes.forEach((ep: any) => {
          const airDate = ep.airDate || ep.air_date;
          const episodeNum =
            ep.episodeNumber ?? ep.episode ?? ep.episode_number;
          if (airDate && episodeNum !== undefined) {
            const epTime = new Date(airDate).getTime();
            if (epTime >= startLimitTime) {
              airingAnime.push({
                id: ua.id * 10000 + (ep.season || 0) * 100 + episodeNum,
                originalId: a.id,
                titulo: a.titulo,
                capaUrl: a.capaUrl,
                displayNum: episodeNum,
                displayDate: airDate,
                type: 'anime',
                prioridade: ua.prioridade,
                season: ep.season,
                epAtualGlobal: ua.epAtual,
                epName: ep.name || null,
              });
            }
          }
        });
      } else if (a.proximoEpisodioData) {
        const epTime = new Date(a.proximoEpisodioData).getTime();
        if (epTime >= startLimitTime) {
          airingAnime.push({
            id: ua.id,
            originalId: a.id,
            titulo: a.titulo,
            capaUrl: a.capaUrl,
            displayNum: a.proximoEpisodio,
            displayDate: a.proximoEpisodioData.toISOString(),
            type: 'anime',
            prioridade: ua.prioridade,
            epAtualGlobal: ua.epAtual,
            epName: null,
          });
        }
      }
    }

    airingAnime.sort(
      (a, b) =>
        new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime(),
    );
    return airingAnime;
  }

  async autoTransitionPlannedToWatching(
    animeId: number,
    episodesList: any[],
    animeTitle: string,
  ) {
    if (
      !episodesList ||
      !Array.isArray(episodesList) ||
      episodesList.length === 0
    ) {
      return;
    }

    const now = new Date();

    const sorted = [...episodesList]
      .filter((ep) => ep.season > 0)
      .sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.episodeNumber - b.episodeNumber;
      });

    const firstEp = sorted[0];
    if (!firstEp || !firstEp.airDate) {
      return;
    }

    const firstEpAirDate = new Date(firstEp.airDate);
    if (now < firstEpAirDate) {
      return;
    }

    const plannedUserAnimes = await this.prisma.userAnime.findMany({
      where: {
        animeId,
        status: 'PLANNED',
      },
    });

    for (const ua of plannedUserAnimes) {
      if (ua.updatedAt.getTime() < firstEpAirDate.getTime()) {
        await this.prisma.userAnime.update({
          where: { id: ua.id },
          data: {
            status: 'WATCHING',
            lastProgressUpdate: now,
          },
        });

        await this.prisma.notification.create({
          data: {
            userId: ua.userId,
            title: 'Anime planeado estreou!',
            message: `O primeiro episódio de "${animeTitle}" estreou! Mudámos o status para "A ver".`,
            type: 'ANIME',
            mediaId: animeId,
          },
        });

        this.logger.log(
          `[AutoTransition] Moved user ${ua.userId} tracking of anime "${animeTitle}" (${animeId}) from PLANNED to WATCHING.`,
        );
      }
    }
  }
}
