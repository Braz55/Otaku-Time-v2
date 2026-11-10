import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';
import { AnilistMangaService } from './anilist-manga.service';
import { MangaSyncService } from './manga-sync.service';
import { StatisticsService } from '../statistics/statistics.service';
import { aplicarRegrasDeProgresso } from '../library/progress-rules';
import { artworkUpdateData, resolveArtwork } from '../library/artwork';
import { mediaKey } from '../rating/media-type';

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
    private readonly statisticsService: StatisticsService,
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
          where: mediaKey(mangaId, 'MANGA'),
        });
        if (!existingMedia) {
          await this.prisma.media.create({
            data: {
              id: mangaId,
              mediaType: 'MANGA',
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
      where: { id: { in: mangaIds }, mediaType: 'MANGA' },
    });
    const ratingMap = new Map(ratings.map((r) => [r.id, r]));

    return list.map((item) => {
      const rating = ratingMap.get(item.mangaId);
      return {
        id: item.id,
        mangaId: item.mangaId,
        titulo: item.manga.titulo,
        statusLancamento: item.manga.statusLancamento,
        ...resolveArtwork(item, item.manga),
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
      where: mediaKey(item.mangaId, 'MANGA'),
    });
    return {
      id: item.id,
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      statusLancamento: item.manga.statusLancamento,
      ...resolveArtwork(item, item.manga),
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
    if (!atual) {
      throw new NotFoundException('Manga não encontrado na biblioteca.');
    }

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
    delete novosDados.capaUrl;
    delete novosDados.bannerUrl;
    // Capa/banner escolhidos ficam na entrada do utilizador, não no catálogo global (L-15)
    Object.assign(novosDados, artworkUpdateData(updateDto));

    // Último capítulo lançado: numa obra em emissão é o anterior ao próximo previsto
    const ultimoDisponivel =
      atual.manga.statusLancamento === 'RELEASING' &&
      atual.manga.proximoCapituloNumero
        ? atual.manga.proximoCapituloNumero - 1
        : atual.manga.numCapitulosTotal;
    const regras = aplicarRegrasDeProgresso(
      { status: atual.status, progresso: atual.capAtual },
      {
        terminada: atual.manga.statusLancamento !== 'RELEASING',
        total: ultimoDisponivel,
        ultimoDisponivel,
        limiteLancado: null,
        limitarAoTotal: false,
      },
      { status: updateDto.status, progresso: updateDto.capAtual },
    );

    if (regras.status !== undefined) novosDados.status = regras.status;
    if (regras.wasDropped) novosDados.wasDropped = true;
    if (regras.progresso !== undefined) novosDados.capAtual = regras.progresso;
    if (regras.lastProgressUpdate) {
      novosDados.lastProgressUpdate = regras.lastProgressUpdate;
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
      where: mediaKey(updated.mangaId, 'MANGA'),
    });
    return {
      ...updated,
      titulo: updated.manga.titulo,
      ...resolveArtwork(updated, updated.manga),
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
    if (!atual) {
      throw new NotFoundException('Manga não encontrado na biblioteca.');
    }

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
    return this.statisticsService.recalculateUserStats(userId);
  }

  async getMangaCovers(id: number, title?: string): Promise<{ posters: string[]; backdrops: string[] }> {
    const posters: string[] = [];
    const backdrops: string[] = [];
    try {
      const titleCandidates: string[] = [];
      if (title) titleCandidates.push(title);

      const local = await this.prisma.manga.findUnique({ where: { id } });
      if (local) {
        if (local.titulo) titleCandidates.push(local.titulo);
        if (local.capaUrl && !posters.includes(local.capaUrl)) posters.push(local.capaUrl);
        if (local.bannerUrl && !backdrops.includes(local.bannerUrl)) backdrops.push(local.bannerUrl);
      }

      const aniData = await this.anilistMangaService.searchAniListById(id);
      if (aniData) {
        if (aniData.title?.english) titleCandidates.push(aniData.title.english);
        if (aniData.title?.romaji) titleCandidates.push(aniData.title.romaji);
        if (aniData.coverImage?.extraLarge && !posters.includes(aniData.coverImage.extraLarge)) {
          posters.push(aniData.coverImage.extraLarge);
        }
        if (aniData.coverImage?.large && !posters.includes(aniData.coverImage.large)) {
          posters.push(aniData.coverImage.large);
        }
        if (aniData.bannerImage && !backdrops.includes(aniData.bannerImage)) {
          backdrops.push(aniData.bannerImage);
        }
      }

      const uniqueTitles = Array.from(new Set(titleCandidates.filter(Boolean)));

      for (const candidateTitle of uniqueTitles) {
        try {
          const searchRes = await fetch(
            `https://api.mangadex.org/manga?title=${encodeURIComponent(candidateTitle)}&limit=1`,
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
              break;
            }
          }
        } catch (err) {
          // Continue trying next candidate title
        }
      }
    } catch (e) {
      this.logger.error(`Error fetching manga covers for ID ${id}:`, e);
    }

    return { posters, backdrops };
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
