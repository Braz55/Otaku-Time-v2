import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';
import { AnilistMangaService } from './anilist-manga.service';
import { MangaSyncService } from './manga-sync.service';

@Injectable()
export class MangaService {
  private readonly logger = new Logger(MangaService.name);

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
        bannerUrl: item.manga.bannerUrl,
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
      bannerUrl: item.manga.bannerUrl,
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

    if (updateDto.capaUrl !== undefined || updateDto.bannerUrl !== undefined) {
      const mangaData: any = {};
      if (updateDto.capaUrl !== undefined) mangaData.capaUrl = updateDto.capaUrl;
      if (updateDto.bannerUrl !== undefined) mangaData.bannerUrl = updateDto.bannerUrl;
      await this.prisma.manga.update({
        where: { id: atual.mangaId },
        data: mangaData,
      });
      if (updateDto.capaUrl !== undefined) atual.manga.capaUrl = updateDto.capaUrl;
      if (updateDto.bannerUrl !== undefined) atual.manga.bannerUrl = updateDto.bannerUrl;
    }

    const novosDados = { ...updateDto };
    delete novosDados.numCapitulosTotal;
    delete novosDados.capaUrl;
    delete novosDados.bannerUrl;

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
      bannerUrl: updated.manga.bannerUrl,
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

      // Achievement processing disabled for performance optimization
    } catch (e) {
      console.error('Error recalculating user statistics:', e);
    }
  }

  async getMangaCovers(id: number, title?: string): Promise<{ posters: string[]; backdrops: string[] }> {
    const posters: string[] = [];
    try {
      let searchTitle = title;
      if (!searchTitle) {
        const local = await this.prisma.manga.findUnique({ where: { id } });
        if (local) {
          searchTitle = local.titulo;
          if (local.capaUrl) posters.push(local.capaUrl);
        } else {
          const aniData = await this.anilistMangaService.searchAniListById(id);
          if (aniData) {
            searchTitle = aniData.title?.english || aniData.title?.romaji;
            if (aniData.coverImage?.large) posters.push(aniData.coverImage.large);
          }
        }
      }

      if (searchTitle) {
        const searchRes = await fetch(
          `https://api.mangadex.org/manga?title=${encodeURIComponent(searchTitle)}&limit=1`,
        );
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          if (searchJson?.data && searchJson.data.length > 0) {
            const mangadexId = searchJson.data[0].id;
            const coverRes = await fetch(
              `https://api.mangadex.org/cover?manga[]=${mangadexId}&limit=100&order[volume]=asc`,
            );
            if (coverRes.ok) {
              const coverJson = await coverRes.json();
              if (coverJson?.data && Array.isArray(coverJson.data)) {
                for (const c of coverJson.data) {
                  const fileName = c.attributes?.fileName;
                  if (fileName) {
                    const coverUrl = `https://uploads.mangadex.org/covers/${mangadexId}/${fileName}`;
                    if (!posters.includes(coverUrl)) {
                      posters.push(coverUrl);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      this.logger.error(`Error fetching manga covers for ID ${id}:`, e);
    }

    return { posters, backdrops: [] };
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
