import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        statistics: {
          create: {}, // Cria automaticamente o registo de estatísticas em branco
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
    return this.prisma.user.findMany();
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async update(id: number, updateDto: any) {
    const data = { ...updateDto };
    if (data.password) {
      if (!data.currentPassword) {
        throw new BadRequestException(
          'A palavra-passe atual é obrigatória para definir uma nova.',
        );
      }
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) {
        throw new BadRequestException('Utilizador não encontrado.');
      }
      const isMatch = await bcrypt.compare(data.currentPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('A palavra-passe atual está incorreta.');
      }
      data.password = await bcrypt.hash(data.password, 10);
      data.tokenVersion = user.tokenVersion + 1;
      delete data.currentPassword;
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

  async generateBackup(userId: number) {
    const animes = await this.prisma.userAnime.findMany({
      where: { userId },
      include: { anime: true },
    });
    const mangas = await this.prisma.userManga.findMany({
      where: { userId },
      include: { manga: true },
    });

    const backupAnimes = animes.map((item) => ({
      animeId: item.animeId,
      titulo: item.anime.titulo,
      status: item.status,
      epAtual: item.epAtual,
      prioridade: item.prioridade,
      numEpisodiosTotal: item.anime.numEpisodiosTotal,
      tipo: 'anime',
    }));

    const backupMangas = mangas.map((item) => ({
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      status: item.status,
      capAtual: item.capAtual,
      prioridade: item.prioridade,
      numCapitulosTotal: item.manga.numCapitulosTotal,
      tipo: 'manga',
    }));

    return {
      version: 1,
      backupDate: new Date().toISOString(),
      exporter: 'Otaku-Time',
      userId,
      data: {
        animes: backupAnimes,
        mangas: backupMangas,
      },
    };
  }

  async fetchAniListGraphQL(
    query: string,
    variables: any,
    retries = 3,
    delayMs = 1500,
  ): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
          console.warn(
            `[Backend Restore] AniList Rate Limited (429). Waiting ${waitTime}ms before retry (attempt ${attempt}/${retries})...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }

        const result = await response.json();
        return result?.data?.Media || null;
      } catch (error) {
        console.warn(
          `[Backend Restore] Error querying AniList (attempt ${attempt}/${retries}):`,
          error,
        );
        if (attempt === retries) return null;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  async getAniListAnimeById(id: number) {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { english romaji native }
          coverImage { large }
          status
          description
          genres
          tags { name rank }
          episodes
          countryOfOrigin
          format
          source
        }
      }
    `;
    return this.fetchAniListGraphQL(query, { id });
  }

  async getAniListMangaById(id: number) {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: MANGA) {
          id
          title { english romaji native }
          coverImage { large }
          status
          description
          genres
          tags { name rank }
          chapters
          countryOfOrigin
          format
          source
        }
      }
    `;
    return this.fetchAniListGraphQL(query, { id });
  }

  async restoreBackup(userId: number, backup: any) {
    if (!backup || !backup.data) {
      throw new Error('Backup inválido ou sem dados');
    }

    const { animes, mangas } = backup.data;

    // Restaurar Animes
    if (Array.isArray(animes)) {
      for (const item of animes) {
        const metadata = await this.getAniListAnimeById(item.animeId);

        const generosDict = metadata
          ? buildGenerosDict(metadata.genres, metadata.tags?.slice(0, 5))
          : {};
        const descricaoLimpa = metadata?.description
          ? metadata.description.replace(/<[^>]*>?/gm, '')
          : 'Sem descrição.';

        // Garantir que o anime global existe
        // Usa o numEpisodiosTotal do backup como fallback caso a AniList não devolva metadata
        // (ex: o backup contém IDs TMDB que a AniList não reconhece)
        const numEpisodiosFallback = item.numEpisodiosTotal ?? null;
        await this.prisma.anime.upsert({
          where: { id: item.animeId },
          update: {
            titulo: metadata
              ? metadata.title.english || metadata.title.romaji
              : item.titulo,
            statusLancamento: metadata ? metadata.status : undefined,
            capaUrl: metadata ? metadata.coverImage?.large : undefined,
            generos: metadata ? generosDict : undefined,
            descricao: metadata ? descricaoLimpa : undefined,
            numEpisodiosTotal: metadata
              ? metadata.episodes
              : numEpisodiosFallback,
            paisOrigem: metadata ? metadata.countryOfOrigin : undefined,
            formato: metadata ? metadata.format : undefined,
            materialOrigem: metadata ? metadata.source : undefined,
          },
          create: {
            id: item.animeId,
            titulo: metadata
              ? metadata.title.english || metadata.title.romaji
              : item.titulo,
            statusLancamento: metadata ? metadata.status : 'UNKNOWN',
            capaUrl: metadata ? metadata.coverImage?.large : '',
            generos: generosDict,
            descricao: descricaoLimpa,
            numEpisodiosTotal: metadata
              ? metadata.episodes
              : numEpisodiosFallback,
            paisOrigem: metadata ? metadata.countryOfOrigin : null,
            formato: metadata ? metadata.format : null,
            materialOrigem: metadata ? metadata.source : null,
          },
        });

        // Upsert UserAnime
        await this.prisma.userAnime.upsert({
          where: { userId_animeId: { userId, animeId: item.animeId } },
          update: {
            epAtual: item.epAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5,
          },
          create: {
            userId,
            animeId: item.animeId,
            epAtual: item.epAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5,
          },
        });

        // Pausa de no mínimo 2 segundos antes de passar para o próximo item
        // Isto garante que tudo é guardado por ordem na BD sem sobreposições e respeita o rate limiting da API
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Restaurar Mangas
    if (Array.isArray(mangas)) {
      for (const item of mangas) {
        const metadata = await this.getAniListMangaById(item.mangaId);

        const generosDict = metadata
          ? buildGenerosDict(metadata.genres, metadata.tags?.slice(0, 5))
          : {};
        const descricaoLimpa = metadata?.description
          ? metadata.description.replace(/<[^>]*>?/gm, '')
          : 'Sem descrição.';

        // Garantir que o manga global existe
        // Usa o numCapitulosTotal do backup como fallback caso a AniList não devolva metadata
        const numCapitulosFallback = item.numCapitulosTotal ?? null;
        await this.prisma.manga.upsert({
          where: { id: item.mangaId },
          update: {
            titulo: metadata
              ? metadata.title.english || metadata.title.romaji
              : item.titulo,
            statusLancamento: metadata ? metadata.status : undefined,
            capaUrl: metadata ? metadata.coverImage?.large : undefined,
            generos: metadata ? generosDict : undefined,
            descricao: metadata ? descricaoLimpa : undefined,
            numCapitulosTotal: metadata
              ? metadata.chapters
              : numCapitulosFallback,
            paisOrigem: metadata ? metadata.countryOfOrigin : undefined,
            formato: metadata ? metadata.format : undefined,
            materialOrigem: metadata ? metadata.source : undefined,
          },
          create: {
            id: item.mangaId,
            titulo: metadata
              ? metadata.title.english || metadata.title.romaji
              : item.titulo,
            statusLancamento: metadata ? metadata.status : 'UNKNOWN',
            capaUrl: metadata ? metadata.coverImage?.large : '',
            generos: generosDict,
            descricao: descricaoLimpa,
            numCapitulosTotal: metadata
              ? metadata.chapters
              : numCapitulosFallback,
            paisOrigem: metadata ? metadata.countryOfOrigin : null,
            formato: metadata ? metadata.format : null,
            materialOrigem: metadata ? metadata.source : null,
          },
        });

        // Upsert UserManga
        await this.prisma.userManga.upsert({
          where: { userId_mangaId: { userId, mangaId: item.mangaId } },
          update: {
            capAtual: item.capAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5,
          },
          create: {
            userId,
            mangaId: item.mangaId,
            capAtual: item.capAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5,
          },
        });

        // Pausa de no mínimo 2 segundos antes de passar para o próximo item
        // Isto garante que tudo é guardado por ordem na BD sem sobreposições e respeita o rate limiting da API
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return { success: true, message: 'Restore completed successfully' };
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

  // --- Destaques (Top Favorites) ---
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

    // Remover se o mesmo anime/manga já estiver em outro rank para evitar violação de unique e permitir troca de posições
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

  // --- Estatísticas ---
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

  async updateStatistics(userId: number, statsData: any) {
    return this.prisma.userStatistics.upsert({
      where: { userId },
      update: statsData,
      create: {
        userId,
        ...statsData,
      },
    });
  }

  // --- Conquistas ---
  async getAchievements(userId: number) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true,
      },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  async getAchievementCatalog() {
    return this.prisma.achievement.findMany();
  }

  async unlockAchievement(userId: number, achievementId: number) {
    const achievementExists = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
    });
    if (!achievementExists) {
      throw new BadRequestException('Conquista não encontrada no catálogo.');
    }

    return this.prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId,
        },
      },
      update: {},
      create: {
        userId,
        achievementId,
      },
    });
  }

  async seedAchievements() {
    const defaultAchievements = [
      {
        id: 1,
        name: 'Primeiros Passos',
        description: 'Criou uma conta no Otaku-Time.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        rarity: 'COMMON',
      },
      {
        id: 2,
        name: 'Isekai Trash',
        description: 'Assistiu a mais de 5 animes do género Isekai.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3135/3135755.png',
        rarity: 'RARE',
      },
      {
        id: 3,
        name: 'Maratonista',
        description: 'Terminou de ver um anime inteiro em menos de 24 horas.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3135/3135768.png',
        rarity: 'EPIC',
      },
      {
        id: 4,
        name: 'Leitor Voraz',
        description: 'Leu o seu primeiro capítulo de manga.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3135/3135789.png',
        rarity: 'COMMON',
      },
      {
        id: 5,
        name: 'Crítico de Elite',
        description:
          'Adicionou 3 conteúdos favoritos em destaque no seu perfil.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3135/3135802.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 6,
        name: 'A Vítima do Camião-kun I',
        description: 'Adicionou 3 animes Isekai à biblioteca.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2234/2234691.png',
        rarity: 'COMMON',
      },
      {
        id: 7,
        name: 'A Vítima do Camião-kun II',
        description: 'Adicionou 6 animes Isekai à biblioteca.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2234/2234691.png',
        rarity: 'RARE',
      },
      {
        id: 8,
        name: 'A Vítima do Camião-kun III',
        description: 'Adicionou 12 animes Isekai à biblioteca.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2234/2234691.png',
        rarity: 'EPIC',
      },
      {
        id: 9,
        name: 'A Vítima do Camião-kun IV',
        description: 'Adicionou 18 animes Isekai à biblioteca.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2234/2234691.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 10,
        name: 'Isekai de Bolso I',
        description: 'Adicionou 3 mangás Isekai à biblioteca.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3594/3594164.png',
        rarity: 'COMMON',
      },
      {
        id: 11,
        name: 'Isekai de Bolso II',
        description: 'Adicionou 6 mangás Isekai à biblioteca.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3594/3594164.png',
        rarity: 'RARE',
      },
      {
        id: 12,
        name: 'Isekai de Bolso III',
        description: 'Adicionou 12 mangás Isekai à biblioteca.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3594/3594164.png',
        rarity: 'EPIC',
      },
      {
        id: 13,
        name: 'Isekai de Bolso IV',
        description: 'Adicionou 18 mangás Isekai à biblioteca.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3594/3594164.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 14,
        name: 'Resina Esgotada I',
        description: 'Acumulou 4 horas de anime assistidos numa semana.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3565/3565418.png',
        rarity: 'COMMON',
      },
      {
        id: 15,
        name: 'Resina Esgotada II',
        description: 'Acumulou 8 horas de anime assistidos numa semana.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3565/3565418.png',
        rarity: 'RARE',
      },
      {
        id: 16,
        name: 'Resina Esgotada III',
        description: 'Acumulou 12 horas de anime assistidos numa semana.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3565/3565418.png',
        rarity: 'EPIC',
      },
      {
        id: 17,
        name: 'Resina Esgotada IV',
        description: 'Acumulou 24 horas de anime assistidos numa semana.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3565/3565418.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 18,
        name: 'Luz Acesa I',
        description: 'Acumulou 4 horas de leitura de mangá numa semana.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2232/2232688.png',
        rarity: 'COMMON',
      },
      {
        id: 19,
        name: 'Luz Acesa II',
        description: 'Acumulou 8 horas de leitura de mangá numa semana.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2232/2232688.png',
        rarity: 'RARE',
      },
      {
        id: 20,
        name: 'Luz Acesa III',
        description: 'Acumulou 12 horas de leitura de mangá numa semana.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2232/2232688.png',
        rarity: 'EPIC',
      },
      {
        id: 21,
        name: 'Luz Acesa IV',
        description: 'Acumulou 24 horas de leitura de mangá numa semana.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2232/2232688.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 22,
        name: 'Culto da Madrugada (Anime)',
        description: 'Terminou um episódio entre as 03:00 e as 05:00 da manhã.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3892/3892881.png',
        rarity: 'EPIC',
      },
      {
        id: 23,
        name: 'Culto da Madrugada (Mangá)',
        description: 'Terminou um capítulo entre as 03:00 e as 05:00 da manhã.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3892/3892881.png',
        rarity: 'EPIC',
      },

      {
        id: 24,
        name: 'Protagonista em Bulking I (Anime)',
        description: 'Completou 3 animes de Desporto ou Ação.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2910/2910793.png',
        rarity: 'COMMON',
      },
      {
        id: 25,
        name: 'Protagonista em Bulking II (Anime)',
        description: 'Completou 6 animes de Desporto ou Ação.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2910/2910793.png',
        rarity: 'RARE',
      },
      {
        id: 26,
        name: 'Protagonista em Bulking III (Anime)',
        description: 'Completou 12 animes de Desporto ou Ação.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2910/2910793.png',
        rarity: 'EPIC',
      },
      {
        id: 27,
        name: 'Protagonista em Bulking IV (Anime)',
        description: 'Completou 18 animes de Desporto ou Ação.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2910/2910793.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 28,
        name: 'Protagonista em Bulking I (Mangá)',
        description: 'Completou 3 mangás de Desporto ou Ação.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2910/2910793.png',
        rarity: 'COMMON',
      },
      {
        id: 29,
        name: 'Protagonista em Bulking II (Mangá)',
        description: 'Completou 6 mangás de Desporto ou Ação.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2910/2910793.png',
        rarity: 'RARE',
      },
      {
        id: 30,
        name: 'Protagonista em Bulking III (Mangá)',
        description: 'Completou 12 mangás de Desporto ou Ação.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2910/2910793.png',
        rarity: 'EPIC',
      },
      {
        id: 31,
        name: 'Protagonista em Bulking IV (Mangá)',
        description: 'Completou 18 mangás de Desporto ou Ação.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2910/2910793.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 32,
        name: 'Síndrome de Shoujo I (Anime)',
        description: 'Completou 3 animes de Romance ou Drama.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3655/3655610.png',
        rarity: 'COMMON',
      },
      {
        id: 33,
        name: 'Síndrome de Shoujo II (Anime)',
        description: 'Completou 6 animes de Romance ou Drama.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3655/3655610.png',
        rarity: 'RARE',
      },
      {
        id: 34,
        name: 'Síndrome de Shoujo III (Anime)',
        description: 'Completou 12 animes de Romance ou Drama.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3655/3655610.png',
        rarity: 'EPIC',
      },
      {
        id: 35,
        name: 'Síndrome de Shoujo IV (Anime)',
        description: 'Completou 18 animes de Romance ou Drama.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3655/3655610.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 36,
        name: 'Síndrome de Shoujo I (Mangá)',
        description: 'Completou 3 mangás de Romance ou Drama.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3655/3655610.png',
        rarity: 'COMMON',
      },
      {
        id: 37,
        name: 'Síndrome de Shoujo II (Mangá)',
        description: 'Completou 6 mangás de Romance ou Drama.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3655/3655610.png',
        rarity: 'RARE',
      },
      {
        id: 38,
        name: 'Síndrome de Shoujo III (Mangá)',
        description: 'Completou 12 mangás de Romance ou Drama.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3655/3655610.png',
        rarity: 'EPIC',
      },
      {
        id: 39,
        name: 'Síndrome de Shoujo IV (Mangá)',
        description: 'Completou 18 mangás de Romance ou Drama.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3655/3655610.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 40,
        name: 'Nostalgia Pura (Anime)',
        description: 'Completou 5 animes lançados antes do ano 2000.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2889/2889312.png',
        rarity: 'LEGENDARY',
      },
      {
        id: 41,
        name: 'Nostalgia Pura (Mangá)',
        description: 'Completou 5 mangás lançados antes do ano 2000.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2889/2889312.png',
        rarity: 'LEGENDARY',
      },

      {
        id: 42,
        name: 'Tsundere Assumido (Anime)',
        description:
          'Colocou um anime na lista de "Desistiu" e depois completou-o.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3565/3565538.png',
        rarity: 'EPIC',
      },
      {
        id: 43,
        name: 'Tsundere Assumido (Mangá)',
        description:
          'Colocou um mangá na lista de "Desistiu" e depois completou-o.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3565/3565538.png',
        rarity: 'EPIC',
      },

      {
        id: 44,
        name: 'Roleta Russa Sobrevivida (Anime)',
        description:
          'Pesquisou aleatoriamente 10 vezes num dia sem adicionar nada.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3601/3601685.png',
        rarity: 'RARE',
      },
      {
        id: 45,
        name: 'Roleta Russa Sobrevivida (Mangá)',
        description:
          'Pesquisou aleatoriamente 10 vezes num dia sem adicionar nada.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/3601/3601685.png',
        rarity: 'RARE',
      },

      {
        id: 46,
        name: 'O Arconte da Leitura',
        description:
          'Tem o dobro de capítulos lidos em relação aos episódios vistos.',
        badgeImageUrl:
          'https://cdn-icons-png.flaticon.com/512/2232/2232677.png',
        rarity: 'EPIC',
      },
    ];

    for (const ach of defaultAchievements) {
      await this.prisma.achievement.upsert({
        where: { id: ach.id },
        update: {
          name: ach.name,
          description: ach.description,
          badgeImageUrl: ach.badgeImageUrl,
          rarity: ach.rarity,
        },
        create: ach,
      });
    }
    return { success: true, message: 'Achievements seeded successfully.' };
  }

  async getUserProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    // Dynamic expiration check
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

    // Buscar detalhes locais dos favoritos para evitar chamadas de API externas na página de perfil
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

    const { password, ...profile } = user;
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

  // --- Métodos de Administração ---
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

  // --- Subscrições & Gift Codes ---
  async redeemGiftCode(userId: number, inputCode: string) {
    const code = inputCode.trim().toUpperCase();
    const gift = await this.prisma.giftCode.findUnique({
      where: { code },
    });

    if (!gift) {
      throw new BadRequestException('Código inválido ou não encontrado.');
    }
    if (gift.isUsed) {
      throw new BadRequestException('Este código já foi utilizado.');
    }
    if (gift.expiresAt && gift.expiresAt < new Date()) {
      throw new BadRequestException('Este código expirou.');
    }

    const durationMs = gift.durationDays * 24 * 60 * 60 * 1000;
    const now = new Date();
    let newEndDate: Date;

    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (sub && sub.status === 'ACTIVE' && sub.currentPeriodEnd > now) {
      newEndDate = new Date(sub.currentPeriodEnd.getTime() + durationMs);
    } else {
      newEndDate = new Date(now.getTime() + durationMs);
    }

    await this.prisma.$transaction([
      this.prisma.giftCode.update({
        where: { id: gift.id },
        data: {
          isUsed: true,
          redeemedByUserId: userId,
          redeemedAt: now,
        },
      }),
      this.prisma.userSubscription.upsert({
        where: { userId },
        update: {
          status: 'ACTIVE',
          currentPeriodEnd: newEndDate,
          planType: 'PREMIUM',
        },
        create: {
          userId,
          status: 'ACTIVE',
          startDate: now,
          currentPeriodEnd: newEndDate,
          planType: 'PREMIUM',
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { tipoConta: 'pro' },
      }),
    ]);

    return {
      success: true,
      message: `Premium (${gift.durationDays} dias) resgatado com sucesso!`,
      currentPeriodEnd: newEndDate,
    };
  }

  async listGiftCodes() {
    return this.prisma.giftCode.findMany({
      include: {
        redeemedByUser: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async generateGiftCode(
    durationDays: number,
    customCode?: string,
    expiresAt?: string,
  ) {
    let code = customCode?.trim().toUpperCase();
    if (!code) {
      const rand = () =>
        Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `OTAKU-${rand()}-${rand()}`;
    }

    const exists = await this.prisma.giftCode.findUnique({ where: { code } });
    if (exists) {
      throw new BadRequestException('O código inserido já existe.');
    }

    return this.prisma.giftCode.create({
      data: {
        code,
        durationDays,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
  }

  async listAllSubscriptions() {
    return this.prisma.userSubscription.findMany({
      include: {
        user: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });
  }

  async updateSubscription(id: number, updateData: any) {
    const data: any = {};
    if (updateData.planType) data.planType = updateData.planType;
    if (updateData.status) data.status = updateData.status;
    if (updateData.currentPeriodEnd)
      data.currentPeriodEnd = new Date(updateData.currentPeriodEnd);

    const sub = await this.prisma.userSubscription.update({
      where: { id },
      data,
      include: {
        user: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    if (data.status === 'EXPIRED') {
      await this.prisma.user.update({
        where: { id: sub.userId },
        data: { tipoConta: 'padrao' },
      });
    } else if (data.status === 'ACTIVE') {
      await this.prisma.user.update({
        where: { id: sub.userId },
        data: { tipoConta: 'pro' },
      });
    }

    return sub;
  }

  async createAchievement(data: {
    name: string;
    description: string;
    badgeImageUrl?: string;
    rarity?: string;
  }) {
    if (!data.name || !data.description) {
      throw new BadRequestException('Nome e descrição são obrigatórios.');
    }
    return this.prisma.achievement.create({
      data: {
        name: data.name,
        description: data.description,
        badgeImageUrl: data.badgeImageUrl || null,
        rarity: data.rarity || 'COMMON',
      },
    });
  }

  async updateAchievement(
    id: number,
    data: {
      name?: string;
      description?: string;
      badgeImageUrl?: string;
      rarity?: string;
    },
  ) {
    const ach = await this.prisma.achievement.findUnique({
      where: { id },
    });
    if (!ach) {
      throw new BadRequestException('Conquista não encontrada.');
    }
    return this.prisma.achievement.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        description:
          data.description !== undefined ? data.description : undefined,
        badgeImageUrl:
          data.badgeImageUrl !== undefined ? data.badgeImageUrl : undefined,
        rarity: data.rarity !== undefined ? data.rarity : undefined,
      },
    });
  }
}
