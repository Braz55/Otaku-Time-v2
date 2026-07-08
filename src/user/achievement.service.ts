import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';

@Injectable()
export class AchievementService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createAchievement(data: CreateAchievementDto) {
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

  async updateAchievement(id: number, data: UpdateAchievementDto) {
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
