import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { UpdateUserStatisticsDto } from './dto/update-statistics.dto';
import { BackupService } from './backup.service';
import { SetFavoriteDto } from './dto/set-favorite.dto';
import {
  isAnimeSource,
  kindOf,
  resolveMediaSource,
} from '../rating/media-type';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backupService: BackupService,
) {}

  // -------------------------------------------------------------
  // DELEGATED METHODS
  // -------------------------------------------------------------

  async generateBackup(userId: number) {
    return this.backupService.generateBackup(userId);
  }

  async restoreBackup(userId: number, backup: RestoreBackupDto) {
    return this.backupService.restoreBackup(userId, backup);
  }

  async fetchAniListGraphQL(query: string, variables: any) {
    return this.backupService.fetchAniListGraphQL(query, variables);
  }

  async getAniListMangaById(id: number) {
    return this.backupService.getAniListMangaById(id);
  }

  // -------------------------------------------------------------
  // CORE USER PROFILE & LIBRARY METHODS
  // -------------------------------------------------------------

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        statistics: {
          create: {},
        },
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      omit: {
        password: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      omit: {
        password: true,
      },
    });
  }

  async update(id: number, updateDto: UpdateProfileDto | UpdateUserDto) {
    const data: any = {};
    if (updateDto.nome !== undefined) data.nome = updateDto.nome;
    if (updateDto.theme !== undefined) data.theme = updateDto.theme;
    if (updateDto.preferredLanguage !== undefined) {
      data.preferredLanguage = updateDto.preferredLanguage;
    }
    if (updateDto.iconUrl !== undefined) data.iconUrl = updateDto.iconUrl;
    if (updateDto.bannerUrl !== undefined) data.bannerUrl = updateDto.bannerUrl;
    if (updateDto.showAdultContent !== undefined) {
      data.showAdultContent = updateDto.showAdultContent;
    }
    if (updateDto.preferences !== undefined)
      data.preferences = updateDto.preferences;

    if ('email' in updateDto && updateDto.email !== undefined) {
      data.email = updateDto.email;
    }

    if (updateDto.password) {
      const currentPassword = (updateDto as any).currentPassword;
      if (!currentPassword) {
        throw new BadRequestException(
          'A palavra-passe atual é obrigatória para definir uma nova.',
        );
      }
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) {
        throw new BadRequestException('Utilizador não encontrado.');
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('A palavra-passe atual está incorreta.');
      }
      data.password = await bcrypt.hash(updateDto.password, 10);
      data.tokenVersion = user.tokenVersion + 1;
    }
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Invalida todos os tokens já emitidos (access e refresh), em todos os dispositivos (L-09)
  async revokeAllSessions(id: number) {
    await this.prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  remove(id: number) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async clearUserLibrary(userId: number) {
    await this.prisma.userAnime.deleteMany({ where: { userId } });
    await this.prisma.userManga.deleteMany({ where: { userId } });
    return { success: true, message: 'Library cleared successfully' };
  }

  async clearUserAnimeLibrary(userId: number) {
    await this.prisma.userAnime.deleteMany({ where: { userId } });
    return { success: true, message: 'Anime library cleared successfully' };
  }

  async clearUserMangaLibrary(userId: number) {
    await this.prisma.userManga.deleteMany({ where: { userId } });
    return { success: true, message: 'Manga library cleared successfully' };
  }

  async getFavorites(userId: number) {
    return this.prisma.userTopFavorite.findMany({
      where: { userId },
      orderBy: { rankPosition: 'asc' },
    });
  }

  async setFavorite(userId: number, favoriteData: SetFavoriteDto) {
    const { mediaType, rankPosition } = favoriteData;
    const mediaId = favoriteData.mediaId ?? favoriteData.anilistMediaId;
    if (mediaId === undefined) {
      throw new BadRequestException('O campo mediaId é obrigatório.');
    }
    if (rankPosition < 1 || rankPosition > 3) {
      throw new BadRequestException('A posição do ranking deve ser 1, 2 ou 3.');
    }
    const fonte = await resolveMediaSource(this.prisma, mediaId, {
      fonte: favoriteData.fonte,
      mediaType,
      format: favoriteData.format,
    });
    if (kindOf(fonte) !== mediaType) {
      throw new BadRequestException('A fonte não corresponde ao tipo do destaque.');
    }

    await this.prisma.userTopFavorite.deleteMany({
      where: {
        userId,
        fonte,
        mediaId,
      },
    });

    return this.prisma.userTopFavorite.upsert({
      where: {
        userId_mediaType_rankPosition: {
          userId,
          mediaType,
          rankPosition,
        },
      },
      update: {
        fonte,
        mediaId,
      },
      create: {
        userId,
        fonte,
        mediaId,
        mediaType,
        rankPosition,
      },
    });
  }

  async removeFavorite(
    userId: number,
    mediaType: 'ANIME' | 'MANGA',
    rankPosition: number,
  ) {
    if (rankPosition < 1 || rankPosition > 3) {
      throw new BadRequestException('A posição do ranking deve ser 1, 2 ou 3.');
    }
    return this.prisma.userTopFavorite.deleteMany({
      where: {
        userId,
        mediaType,
        rankPosition,
      },
    });
  }

  async getStatistics(userId: number) {
    let stats = await this.prisma.userStatistics.findUnique({
      where: { userId },
    });
    if (!stats) {
      stats = await this.prisma.userStatistics.create({
        data: { userId },
      });
    }
    return stats;
  }

  async updateStatistics(userId: number, statsData: UpdateUserStatisticsDto) {
    return this.prisma.userStatistics.upsert({
      where: { userId },
      update: statsData,
      create: {
        userId,
        ...statsData,
      },
    });
  }

  async getUserProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      omit: {
        password: true,
        email: true,
      },
      include: {
        statistics: true,
        topFavorites: {
          orderBy: { rankPosition: 'asc' },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Utilizador não encontrado.');
    }

    let topFavoritesWithDetails: any[] = [];
    if (user.topFavorites && user.topFavorites.length > 0) {
      // Animes identificados por (fonte, id): uma série e um filme podem ter o mesmo id (L-23)
      const animeKeys = user.topFavorites
        .filter((f) => isAnimeSource(f.fonte))
        .map((f) => ({ fonte: f.fonte, id: f.mediaId }));
      const mangaIds = user.topFavorites
        .filter((f) => !isAnimeSource(f.fonte))
        .map((f) => f.mediaId);
      const keyOf = (fonte: string, id: number) => `${fonte}:${id}`;

      const [localAnimes, localMangas, userAnimes, userMangas] =
        await Promise.all([
          // OR vazio não devolve nada
          this.prisma.anime.findMany({
            where: { OR: animeKeys },
            select: { fonte: true, id: true, titulo: true, capaUrl: true },
          }),
          this.prisma.manga.findMany({
            where: { id: { in: mangaIds } },
            select: { id: true, titulo: true, capaUrl: true },
          }),
          // Capa personalizada do dono do perfil (L-15)
          this.prisma.userAnime.findMany({
            where: {
              userId,
              OR: animeKeys.map((k) => ({
                animeFonte: k.fonte,
                animeId: k.id,
              })),
            },
            select: {
              animeFonte: true,
              animeId: true,
              capaPersonalizada: true,
            },
          }),
          this.prisma.userManga.findMany({
            where: { userId, mangaId: { in: mangaIds } },
            select: { mangaId: true, capaPersonalizada: true },
          }),
        ]);

      const animeMap = new Map(
        localAnimes.map((a) => [keyOf(a.fonte, a.id), a]),
      );
      const mangaMap = new Map(localMangas.map((m) => [m.id, m]));
      const animeCapaMap = new Map(
        userAnimes.map((ua) => [
          keyOf(ua.animeFonte, ua.animeId),
          ua.capaPersonalizada,
        ]),
      );
      const mangaCapaMap = new Map(
        userMangas.map((um) => [um.mangaId, um.capaPersonalizada]),
      );

      topFavoritesWithDetails = user.topFavorites.map((fav) => {
        if (isAnimeSource(fav.fonte)) {
          const key = keyOf(fav.fonte, fav.mediaId);
          const anime = animeMap.get(key);
          return {
            ...fav,
            titulo: anime?.titulo || 'Título Desconhecido',
            capaUrl: animeCapaMap.get(key) || anime?.capaUrl || '',
          };
        } else {
          const manga = mangaMap.get(fav.mediaId);
          return {
            ...fav,
            titulo: manga?.titulo || 'Título Desconhecido',
            capaUrl: mangaCapaMap.get(fav.mediaId) || manga?.capaUrl || '',
          };
        }
      });
    }

    const userRatings = await this.prisma.userRating.findMany({
      where: { userId },
      select: { score: true },
    });

    const totalRated = userRatings.length;
    const averageScore =
      totalRated > 0
        ? parseFloat(
            (
              userRatings.reduce((sum, r) => sum + r.score, 0) / totalRated
            ).toFixed(1),
          )
        : 0.0;

    const animeCounts = await this.prisma.userAnime.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const mangaCounts = await this.prisma.userManga.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const animeStats = {
      watching: animeCounts.find((c) => c.status === 'WATCHING')?._count ?? 0,
      planned: animeCounts.find((c) => c.status === 'PLANNED')?._count ?? 0,
      completed: animeCounts.find((c) => c.status === 'COMPLETED')?._count ?? 0,
      paused: animeCounts.find((c) => c.status === 'PAUSED')?._count ?? 0,
      dropped: animeCounts.find((c) => c.status === 'DROPPED')?._count ?? 0,
    };

    const mangaStats = {
      reading: mangaCounts.find((c) => c.status === 'WATCHING')?._count ?? 0,
      planned: mangaCounts.find((c) => c.status === 'PLANNED')?._count ?? 0,
      completed: mangaCounts.find((c) => c.status === 'COMPLETED')?._count ?? 0,
      paused: mangaCounts.find((c) => c.status === 'PAUSED')?._count ?? 0,
      dropped: mangaCounts.find((c) => c.status === 'DROPPED')?._count ?? 0,
    };

    const profile = user;
    return {
      ...profile,
      topFavorites: topFavoritesWithDetails,
      statsSummary: {
        averageScore,
        totalRated,
        anime: animeStats,
        manga: mangaStats,
      },
    };
  }

  async getAdminUsersList() {
    const users = await this.prisma.user.findMany({
      include: {
        _count: {
          select: {
            animes: true,
            mangas: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    return users.map((user) => {
      const { password, ...rest } = user;
      return rest;
    });
  }

  async updateUserRole(id: number, tipoConta: string) {
    const validTypes = ['normal', 'ADMIN'];
    if (!validTypes.includes(tipoConta)) {
      throw new BadRequestException('Tipo de conta inválido.');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!currentUser) {
      throw new BadRequestException('Utilizador não encontrado.');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { tipoConta },
    });

    const { password, ...rest } = user;
    return rest;
  }

  async getAdminStats() {
    const totalUsers = await this.prisma.user.count();
    const totalAnimes = await this.prisma.anime.count();
    const totalMangas = await this.prisma.manga.count();
    const totalUserAnimes = await this.prisma.userAnime.count();
    const totalUserMangas = await this.prisma.userManga.count();

    return {
      totalUsers,
      totalAnimes,
      totalMangas,
      totalTrackedItems: totalUserAnimes + totalUserMangas,
    };
  }

  async getSyncLogs() {
    return this.prisma.syncLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }
}
