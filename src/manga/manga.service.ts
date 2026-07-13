import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';
import { AnilistMangaService } from './anilist-manga.service';
import { MangaSyncService } from './manga-sync.service';

@Injectable()
export class MangaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listService: ListService,
    @Inject(forwardRef(() => AnilistMangaService))
    private readonly anilistMangaService: AnilistMangaService,
    @Inject(forwardRef(() => MangaSyncService))
    private readonly mangaSyncService: MangaSyncService,
  ) {}

  // -------------------------------------------------------------
  // DELEGATED METHODS
  // -------------------------------------------------------------

  async searchAniListManga(nomeManga: string, userId?: number) {
    return this.anilistMangaService.searchAniListManga(nomeManga, userId);
  }

  async searchAniListById(id: number) {
    return this.anilistMangaService.searchAniListById(id);
  }

  async searchMangaList(nome: string, page: number = 1, userId?: number) {
    return this.anilistMangaService.searchMangaList(nome, page, userId);
  }

  async searchByGenre(genre: string, page: number = 1, userId?: number) {
    return this.anilistMangaService.searchByGenre(genre, page, userId);
  }

  async importFromAniList(
    nomeManga: string,
    userId: number,
    anilistId?: number,
  ) {
    return this.anilistMangaService.importFromAniList(nomeManga, userId, anilistId);
  }

  async getLatestChapterFromBakaUpdates(title: string, mangaObj?: any) {
    return this.mangaSyncService.getLatestChapterFromBakaUpdates(title, mangaObj);
  }

  async getLatestChapterFromMangaDex(
    anilistId: number,
    title: string,
    mangaObj?: any,
  ) {
    return this.mangaSyncService.getLatestChapterFromMangaDex(anilistId, title, mangaObj);
  }

  async syncLatestChapter(anilistId: number) {
    return this.mangaSyncService.syncLatestChapter(anilistId);
  }

  // -------------------------------------------------------------
  // CORE LOCAL CATALOG & USER LIST METHODS (CRUD, SYNC)
  // -------------------------------------------------------------

  async backgroundUpdateManga(mangaId: number, userId: number) {
    try {
      const aniListData = await this.searchAniListById(mangaId);
      if (aniListData) {
        const generosDict = buildGenerosDict(
          aniListData.genres,
          aniListData.tags?.slice(0, 10),
        );
        const linksJSON = aniListData.externalLinks
          ? JSON.stringify(aniListData.externalLinks)
          : null;

        await this.prisma.manga.update({
          where: { id: mangaId },
          data: {
            capaUrl: aniListData.coverImage.large,
            linksExternos: linksJSON,
            generos: generosDict,
          },
        });

        // Garantir registo de Media
        const averageScore = aniListData.averageScore
          ? aniListData.averageScore / 10
          : 0;
        const existingMedia = await this.prisma.media.findUnique({
          where: { id: mangaId },
        });
        if (!existingMedia) {
          await this.prisma.media.create({
            data: {
              id: mangaId,
              avaliacao_base: averageScore,
              total_votos_users: 0,
              soma_notas_users: 0,
              avaliacao_geral: averageScore,
            },
          });
        }
      }
    } catch (error) {
      console.error(
        `Error in backgroundUpdateManga for manga ID ${mangaId}:`,
        error,
      );
    } finally {
      this.recalculateUserStats(userId).catch((err) => {
        console.error('Error recalculating user stats in background:', err);
      });
      this.syncLatestChapter(mangaId).catch((err) => {
        console.error(
          `[BackgroundSync] Erro ao sincronizar capítulos para manga ID ${mangaId} em background:`,
          err,
        );
      });
    }
  }

  async findAll(userId: number, status?: string) {
    const whereClause: any = { userId };
    if (status) {
      const statusArr = status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) =>
          ['WATCHING', 'PLANNED', 'COMPLETED', 'PAUSED', 'DROPPED'].includes(s),
        );
      if (statusArr.length > 0) {
        whereClause.status = { in: statusArr };
      }
    }

    const list = await this.prisma.userManga.findMany({
      where: whereClause,
      include: { manga: true },
    });
    const mangaIds = list.map((item) => item.mangaId);
    const ratings = await this.prisma.media.findMany({
      where: { id: { in: mangaIds } },
    });
    const ratingMap = new Map(ratings.map((r) => [r.id, r]));

    return list.map((item) => {
      const rating = ratingMap.get(item.mangaId);
      return {
        id: item.id,
        mangaId: item.mangaId,
        titulo: item.manga.titulo,
        statusLancamento: item.manga.statusLancamento,
        capaUrl: item.manga.capaUrl,
        generos: item.manga.generos,
        descricao: item.manga.descricao,
        status: item.status,
        capAtual: item.capAtual,
        numCapitulosTotal: item.manga.numCapitulosTotal,
        prioridade: item.prioridade,
        linksExternos: item.manga.linksExternos,
        linksPersonalizados: item.linksPersonalizados,
        notas: item.notas,
        proximoCapituloNumero: item.manga.proximoCapituloNumero,
        proximoCapituloData: item.manga.proximoCapituloData,
        updatedAt: item.updatedAt,
        lastProgressUpdate: item.lastProgressUpdate,
        avaliacaoGeral: rating?.avaliacao_geral ?? null,
        totalVotosUsers: rating?.total_votos_users ?? 0,
        mediaUpdatedAt: item.manga.updatedAt,
      };
    });
  }

  async findOne(id: number, user: any) {
    const item = await this.prisma.userManga.findUnique({
      where: { id },
      include: { manga: true },
    });
    if (!item) return null;

    if (item.userId !== user.userId && user.tipoConta !== 'ADMIN') {
      throw new ForbiddenException(
        'Não tem permissão para aceder a este registo.',
      );
    }
    const rating = await this.prisma.media.findUnique({
      where: { id: item.mangaId },
    });
    return {
      id: item.id,
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      statusLancamento: item.manga.statusLancamento,
      capaUrl: item.manga.capaUrl,
      generos: item.manga.generos,
      descricao: item.manga.descricao,
      status: item.status,
      capAtual: item.capAtual,
      numCapitulosTotal: item.manga.numCapitulosTotal,
      prioridade: item.prioridade,
      linksExternos: item.manga.linksExternos,
      linksPersonalizados: item.linksPersonalizados,
      notas: item.notas,
      proximoCapituloNumero: item.manga.proximoCapituloNumero,
      proximoCapituloData: item.manga.proximoCapituloData,
      updatedAt: item.updatedAt,
      lastProgressUpdate: item.lastProgressUpdate,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async update(id: number, updateDto: any, user: any) {
    const atual = await this.prisma.userManga.findUnique({
      where: { id },
      include: { manga: true },
    });
    if (!atual) return null;

    if (atual.userId !== user.userId && user.tipoConta !== 'ADMIN') {
      throw new ForbiddenException(
        'Não tem permissão para aceder a este registo.',
      );
    }

    if (
      updateDto.numCapitulosTotal !== undefined &&
      user.tipoConta !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Apenas administradores podem alterar metadados do catálogo global.',
      );
    }

    if (updateDto.numCapitulosTotal !== undefined) {
      const total = updateDto.numCapitulosTotal;
      const updateData: any = { numCapitulosTotal: total };
      if (atual.manga.statusLancamento === 'RELEASING') {
        updateData.proximoCapituloNumero = total + 1;
        atual.manga.proximoCapituloNumero = total + 1;
      }
      await this.prisma.manga.update({
        where: { id: atual.mangaId },
        data: updateData,
      });
      atual.manga.numCapitulosTotal = total;
    }

    const novosDados = { ...updateDto };
    delete novosDados.numCapitulosTotal;

    if (updateDto.status !== undefined && atual.status === 'DROPPED') {
      novosDados.wasDropped = true;
    }

    if (updateDto.status === 'COMPLETED') {
      const totalDisponivel =
        atual.manga.statusLancamento === 'RELEASING' &&
        atual.manga.proximoCapituloNumero
          ? atual.manga.proximoCapituloNumero - 1
          : atual.manga.numCapitulosTotal || atual.capAtual;
      novosDados.capAtual = totalDisponivel;
    }

    if (updateDto.capAtual !== undefined) {
      const cap = updateDto.capAtual;
      const totalDisponivel =
        atual.manga.statusLancamento === 'RELEASING' &&
        atual.manga.proximoCapituloNumero
          ? atual.manga.proximoCapituloNumero - 1
          : atual.manga.numCapitulosTotal;

      if (atual.status === 'PLANNED' && cap > 0) novosDados.status = 'WATCHING';
      if (
        atual.status === 'COMPLETED' &&
        totalDisponivel &&
        cap < totalDisponivel
      ) {
        novosDados.status = 'WATCHING';
      }

      if (
        atual.manga.statusLancamento !== 'RELEASING' &&
        atual.manga.numCapitulosTotal &&
        cap === atual.manga.numCapitulosTotal
      ) {
        novosDados.status = 'COMPLETED';
        novosDados.capAtual = atual.manga.numCapitulosTotal;
      } else {
        novosDados.capAtual = cap;
      }
    }

    if (
      novosDados.capAtual !== undefined &&
      novosDados.capAtual > atual.capAtual
    ) {
      novosDados.lastProgressUpdate = new Date();
    }

    const updated = await this.prisma.userManga.update({
      where: { id },
      data: novosDados,
      include: { manga: true },
    });
    this.recalculateUserStats(updated.userId).catch((err) => {
      console.error('Error recalculating user stats in background:', err);
    });
    const rating = await this.prisma.media.findUnique({
      where: { id: updated.mangaId },
    });
    return {
      ...updated,
      titulo: updated.manga.titulo,
      capaUrl: updated.manga.capaUrl,
      linksExternos: updated.manga.linksExternos,
      numCapitulosTotal: updated.manga.numCapitulosTotal,
      proximoCapituloNumero: updated.manga.proximoCapituloNumero,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async updateLastModified(id: number, date: Date = new Date()) {
    return this.prisma.manga.update({
      where: { id },
      data: { updatedAt: date },
    });
  }

  async remove(id: number, user: any) {
    const atual = await this.prisma.userManga.findUnique({
      where: { id },
    });
    if (!atual) return null;

    if (atual.userId !== user.userId && user.tipoConta !== 'ADMIN') {
      throw new ForbiddenException(
        'Não tem permissão para remover este registo.',
      );
    }

    const item = await this.prisma.userManga.delete({ where: { id } });
    if (item) {
      this.recalculateUserStats(item.userId).catch((err) => {
        console.error('Error recalculating user stats in background:', err);
      });
    }
    return item;
  }

  // -------------------------------------------------------------
  // HELPER CALCULATIONS & STATS
  // -------------------------------------------------------------

  async recalculateUserStats(userId: number) {
    try {
      const animes = await this.prisma.userAnime.findMany({
        where: { userId },
        include: { anime: true },
      });
      const mangas = await this.prisma.userManga.findMany({
        where: { userId },
        include: { manga: true },
      });

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
        ((totalEpisodesWatched * 24) / 1440).toFixed(2),
      );
      const mangaDaysWasted = parseFloat(
        ((totalMangaRead * 10) / 1440).toFixed(2),
      );

      await this.prisma.userStatistics.upsert({
        where: { userId },
        update: {
          totalAnimeCompleted,
          totalEpisodesWatched,
          totalMangaRead,
          animeDaysWasted,
          mangaDaysWasted,
        },
        create: {
          userId,
          totalAnimeCompleted,
          totalEpisodesWatched,
          totalMangaRead,
          animeDaysWasted,
          mangaDaysWasted,
        },
      });

      const unlockedAchievements = await this.prisma.userAchievement.findMany({
        where: { userId },
      });
      const unlockedSet = new Set(
        unlockedAchievements.map((ua) => ua.achievementId),
      );

      const awardAchievement = async (achievementId: number) => {
        if (!unlockedSet.has(achievementId)) {
          try {
            await this.prisma.userAchievement.create({
              data: { userId, achievementId },
            });
            unlockedSet.add(achievementId);
          } catch (e) {
            console.error(`Error creating achievement ${achievementId}:`, e);
          }
        }
      };

      await awardAchievement(1);

      if (totalEpisodesWatched >= 100) {
        await awardAchievement(3);
      }

      if (totalMangaRead >= 1) {
        await awardAchievement(4);
      }

      const completedAnimes = animes.filter((ua) => ua.status === 'COMPLETED');
      const isekaiCount = completedAnimes.filter((ua) => {
        if (!ua.anime?.generos) return false;
        if (typeof ua.anime.generos === 'string') {
          return ua.anime.generos.toLowerCase().includes('isekai');
        }
        if (typeof ua.anime.generos === 'object') {
          return Object.keys(ua.anime.generos).some(
            (key) => key.toLowerCase() === 'isekai',
          );
        }
        return false;
      }).length;
      if (isekaiCount >= 5) {
        await awardAchievement(2);
      }

      const favoritesCount = await this.prisma.userTopFavorite.count({
        where: { userId },
      });
      if (favoritesCount >= 3) {
        await awardAchievement(5);
      }

      const allIsekaiAnimesCount = completedAnimes.filter((ua) => {
        if (!ua.anime?.generos) return false;
        if (typeof ua.anime.generos === 'string') {
          return ua.anime.generos.toLowerCase().includes('isekai');
        }
        if (typeof ua.anime.generos === 'object') {
          return Object.keys(ua.anime.generos).some(
            (key) => key.toLowerCase() === 'isekai',
          );
        }
        return false;
      }).length;
      if (allIsekaiAnimesCount >= 3) await awardAchievement(6);
      if (allIsekaiAnimesCount >= 6) await awardAchievement(7);
      if (allIsekaiAnimesCount >= 12) await awardAchievement(8);
      if (allIsekaiAnimesCount >= 18) await awardAchievement(9);

      const allIsekaiMangasCount = mangas.filter((um) => {
        if (!um.manga?.generos) return false;
        if (typeof um.manga.generos === 'string') {
          return um.manga.generos.toLowerCase().includes('isekai');
        }
        if (typeof um.manga.generos === 'object') {
          return Object.keys(um.manga.generos).some(
            (key) => key.toLowerCase() === 'isekai',
          );
        }
        return false;
      }).length;
      if (allIsekaiMangasCount >= 3) await awardAchievement(10);
      if (allIsekaiMangasCount >= 6) await awardAchievement(11);
      if (allIsekaiMangasCount >= 12) await awardAchievement(12);
      if (allIsekaiMangasCount >= 18) await awardAchievement(13);

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentAnimes = animes.filter((a) => a.updatedAt >= oneWeekAgo);
      const recentHoursWatched = recentAnimes.reduce(
        (sum, a) => sum + ((a.epAtual || 0) * 24) / 60,
        0,
      );
      if (recentHoursWatched >= 4) await awardAchievement(14);
      if (recentHoursWatched >= 8) await awardAchievement(15);
      if (recentHoursWatched >= 12) await awardAchievement(16);
      if (recentHoursWatched >= 24) await awardAchievement(17);

      const recentMangas = mangas.filter((m) => m.updatedAt >= oneWeekAgo);
      const recentHoursRead = recentMangas.reduce(
        (sum, m) => sum + ((m.capAtual || 0) * 10) / 60,
        0,
      );
      if (recentHoursRead >= 4) await awardAchievement(18);
      if (recentHoursRead >= 8) await awardAchievement(19);
      if (recentHoursRead >= 12) await awardAchievement(20);
      if (recentHoursRead >= 24) await awardAchievement(21);

      const now = new Date();
      const currentHour = now.getHours();
      if (currentHour >= 3 && currentHour < 5) {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const updatedAnimeRecently = animes.some(
          (a) => a.updatedAt >= fiveMinsAgo,
        );
        if (updatedAnimeRecently) {
          await awardAchievement(22);
        }
        const updatedMangaRecently = mangas.some(
          (m) => m.updatedAt >= fiveMinsAgo,
        );
        if (updatedMangaRecently) {
          await awardAchievement(23);
        }
      }

      const completedBulkingAnimes = completedAnimes.filter((ua) => {
        if (!ua.anime?.generos) return false;
        const check = (g: string) => {
          const l = g.toLowerCase();
          return l === 'sports' || l === 'action' || l === 'desporto' || l === 'ação';
        };
        if (typeof ua.anime.generos === 'string') return check(ua.anime.generos);
        if (typeof ua.anime.generos === 'object') return Object.keys(ua.anime.generos).some(check);
        return false;
      }).length;
      if (completedBulkingAnimes >= 3) await awardAchievement(24);
      if (completedBulkingAnimes >= 6) await awardAchievement(25);
      if (completedBulkingAnimes >= 12) await awardAchievement(26);
      if (completedBulkingAnimes >= 18) await awardAchievement(27);

      const completedBulkingMangas = mangas.filter((um) => {
        if (um.status !== 'COMPLETED' || !um.manga?.generos) return false;
        const check = (g: string) => {
          const l = g.toLowerCase();
          return l === 'sports' || l === 'action' || l === 'desporto' || l === 'ação';
        };
        if (typeof um.manga.generos === 'string') return check(um.manga.generos);
        if (typeof um.manga.generos === 'object') return Object.keys(um.manga.generos).some(check);
        return false;
      }).length;
      if (completedBulkingMangas >= 3) await awardAchievement(28);
      if (completedBulkingMangas >= 6) await awardAchievement(29);
      if (completedBulkingMangas >= 12) await awardAchievement(30);
      if (completedBulkingMangas >= 18) await awardAchievement(31);

      const completedRomanceAnimes = completedAnimes.filter((ua) => {
        if (!ua.anime?.generos) return false;
        const check = (g: string) => {
          const l = g.toLowerCase();
          return l === 'romance' || l === 'drama' || l === 'shoujo';
        };
        if (typeof ua.anime.generos === 'string') return check(ua.anime.generos);
        if (typeof ua.anime.generos === 'object') return Object.keys(ua.anime.generos).some(check);
        return false;
      }).length;
      if (completedRomanceAnimes >= 3) await awardAchievement(32);
      if (completedRomanceAnimes >= 6) await awardAchievement(33);
      if (completedRomanceAnimes >= 12) await awardAchievement(34);
      if (completedRomanceAnimes >= 18) await awardAchievement(35);

      const completedRomanceMangas = mangas.filter((um) => {
        if (um.status !== 'COMPLETED' || !um.manga?.generos) return false;
        const check = (g: string) => {
          const l = g.toLowerCase();
          return l === 'romance' || l === 'drama' || l === 'shoujo';
        };
        if (typeof um.manga.generos === 'string') return check(um.manga.generos);
        if (typeof um.manga.generos === 'object') return Object.keys(um.manga.generos).some(check);
        return false;
      }).length;
      if (completedRomanceMangas >= 3) await awardAchievement(36);
      if (completedRomanceMangas >= 6) await awardAchievement(37);
      if (completedRomanceMangas >= 12) await awardAchievement(38);
      if (completedRomanceMangas >= 18) await awardAchievement(39);

      const nostalgiaAnimesCount = completedAnimes.filter(
        (ua) => ua.anime.ano && ua.anime.ano < 2000,
      ).length;
      if (nostalgiaAnimesCount >= 5) {
        await awardAchievement(40);
      }

      const nostalgiaMangasCount = mangas.filter((um) => {
        if (um.status !== 'COMPLETED') return false;
        const desc = (um.manga.descricao || '').toLowerCase();
        const title = um.manga.titulo.toLowerCase();
        return (
          /(?:198\d|199\d)\b/.test(desc) ||
          title.includes('dragon ball') ||
          title.includes('berserk') ||
          title.includes('evangelion') ||
          title.includes('slam dunk')
        );
      }).length;
      if (nostalgiaMangasCount >= 5) {
        await awardAchievement(41);
      }

      const tsundereAnimes = completedAnimes.filter((ua) => ua.wasDropped).length;
      if (tsundereAnimes >= 1) {
        await awardAchievement(42);
      }

      const tsundereMangas = mangas.filter((um) => um.status === 'COMPLETED' && um.wasDropped).length;
      if (tsundereMangas >= 1) {
        await awardAchievement(43);
      }

      if (totalMangaRead >= totalEpisodesWatched * 2 && totalMangaRead > 0) {
        await awardAchievement(46);
      }
    } catch (e) {
      console.error('Error recalculating user statistics/achievements:', e);
    }
  }
}

function buildGenerosDict(
  genres: string[] | undefined,
  tags: { name: string; rank?: number }[] | undefined,
): Record<string, number> {
  const dict: Record<string, number> = {};
  if (genres) {
    genres.forEach((g) => {
      dict[g.trim()] = 100;
    });
  }
  if (tags) {
    tags.forEach((t) => {
      dict[t.name.trim()] = t.rank !== undefined ? t.rank : 100;
    });
  }
  return dict;
}
