import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { UpdateUserStatisticsDto } from './dto/update-statistics.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { BackupService } from './backup.service';
import { AchievementService } from './achievement.service';
import { GiftCodeService } from './gift-code.service';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backupService: BackupService,
    private readonly achievementService: AchievementService,
    private readonly giftCodeService: GiftCodeService,
    private readonly subscriptionService: SubscriptionService,
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

  async getAniListAnimeById(id: number) {
    return this.backupService.getAniListAnimeById(id);
  }

  async getAniListMangaById(id: number) {
    return this.backupService.getAniListMangaById(id);
  }

  async getAchievements(userId: number) {
    return this.achievementService.getAchievements(userId);
  }

  async getAchievementCatalog() {
    return this.achievementService.getAchievementCatalog();
  }

  async unlockAchievement(userId: number, achievementId: number) {
    return this.achievementService.unlockAchievement(userId, achievementId);
  }

  async seedAchievements() {
    return this.achievementService.seedAchievements();
  }

  async createAchievement(data: CreateAchievementDto) {
    return this.achievementService.createAchievement(data);
  }

  async updateAchievement(id: number, data: UpdateAchievementDto) {
    return this.achievementService.updateAchievement(id, data);
  }

  async redeemGiftCode(userId: number, inputCode: string) {
    return this.giftCodeService.redeemGiftCode(userId, inputCode);
  }

  async listGiftCodes() {
    return this.giftCodeService.listGiftCodes();
  }

  async generateGiftCode(
    durationDays: number,
    customCode?: string,
    expiresAt?: string,
  ) {
    return this.giftCodeService.generateGiftCode(durationDays, customCode, expiresAt);
  }

  async listAllSubscriptions() {
    return this.subscriptionService.listAllSubscriptions();
  }

  async updateSubscription(id: number, updateData: UpdateSubscriptionDto) {
    return this.subscriptionService.updateSubscription(id, updateData);
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

  async setFavorite(
    userId: number,
    favoriteData: {
      anilistMediaId: number;
      mediaType: 'ANIME' | 'MANGA';
      rankPosition: number;
    },
  ) {
    const { anilistMediaId, mediaType, rankPosition } = favoriteData;
    if (rankPosition < 1 || rankPosition > 3) {
      throw new BadRequestException('A posição do ranking deve ser 1, 2 ou 3.');
    }

    await this.prisma.userTopFavorite.deleteMany({
      where: {
        userId,
        anilistMediaId,
        mediaType,
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
        anilistMediaId,
        mediaType,
      },
      create: {
        userId,
        anilistMediaId,
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
        subscription: true,
        topFavorites: {
          orderBy: { rankPosition: 'asc' },
        },
        achievements: {
          include: {
            achievement: true,
          },
          orderBy: { unlockedAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Utilizador não encontrado.');
    }

    if (
      user.subscription &&
      user.subscription.status === 'ACTIVE' &&
      user.subscription.currentPeriodEnd < new Date()
    ) {
      await this.prisma.$transaction([
        this.prisma.userSubscription.update({
          where: { userId },
          data: { status: 'EXPIRED' },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { tipoConta: 'padrao' },
        }),
      ]);
      user.subscription.status = 'EXPIRED';
      user.tipoConta = 'padrao';
    }

    let topFavoritesWithDetails: any[] = [];
    if (user.topFavorites && user.topFavorites.length > 0) {
      const animeIds = user.topFavorites
        .filter((f) => f.mediaType === 'ANIME')
        .map((f) => f.anilistMediaId);
      const mangaIds = user.topFavorites
        .filter((f) => f.mediaType === 'MANGA')
        .map((f) => f.anilistMediaId);

      const [localAnimes, localMangas] = await Promise.all([
        this.prisma.anime.findMany({ where: { id: { in: animeIds } } }),
        this.prisma.manga.findMany({ where: { id: { in: mangaIds } } }),
      ]);

      const animeMap = new Map(localAnimes.map((a) => [a.id, a]));
      const mangaMap = new Map(localMangas.map((m) => [m.id, m]));

      topFavoritesWithDetails = user.topFavorites.map((fav) => {
        if (fav.mediaType === 'ANIME') {
          const anime = animeMap.get(fav.anilistMediaId);
          return {
            ...fav,
            titulo: anime?.titulo || 'Título Desconhecido',
            capaUrl: anime?.capaUrl || '',
          };
        } else {
          const manga = mangaMap.get(fav.anilistMediaId);
          return {
            ...fav,
            titulo: manga?.titulo || 'Título Desconhecido',
            capaUrl: manga?.capaUrl || '',
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
    const validTypes = ['padrao', 'pro', 'ADMIN'];
    if (!validTypes.includes(tipoConta)) {
      throw new BadRequestException('Tipo de conta inválido.');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!currentUser) {
      throw new BadRequestException('Utilizador não encontrado.');
    }

    if (currentUser.tipoConta === 'pro' && tipoConta === 'padrao') {
      throw new BadRequestException(
        'Não é permitido despromover um utilizador Pro para Padrão, pois trata-se de um serviço pago.',
      );
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
