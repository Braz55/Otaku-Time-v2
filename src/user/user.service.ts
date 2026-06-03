import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
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

  update(id: number, updateDto: any) {
    return this.prisma.user.update({
      where: { id },
      data: updateDto,
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
      include: { anime: true }
    });
    const mangas = await this.prisma.userManga.findMany({
      where: { userId },
      include: { manga: true }
    });

    const backupAnimes = animes.map(item => ({
      animeId: item.animeId,
      titulo: item.anime.titulo,
      status: item.status,
      epAtual: item.epAtual,
      prioridade: item.prioridade,
      numEpisodiosTotal: item.anime.numEpisodiosTotal,
      tipo: 'anime'
    }));

    const backupMangas = mangas.map(item => ({
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      status: item.status,
      capAtual: item.capAtual,
      prioridade: item.prioridade,
      numCapitulosTotal: item.manga.numCapitulosTotal,
      tipo: 'manga'
    }));

    return {
      version: 1,
      backupDate: new Date().toISOString(),
      exporter: "Otaku-Time",
      userId,
      data: {
        animes: backupAnimes,
        mangas: backupMangas
      }
    };
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
          tags { name }
          episodes
        }
      }
    `;
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { id } }),
      });
      const result = await response.json() as any;
      return result?.data?.Media || null;
    } catch {
      return null;
    }
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
          tags { name }
          chapters
        }
      }
    `;
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { id } }),
      });
      const result = await response.json() as any;
      return result?.data?.Media || null;
    } catch {
      return null;
    }
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
        
        const topTags = metadata?.tags ? metadata.tags.slice(0, 5).map((tag: any) => tag.name).join(', ') : '';
        const generosComTags = metadata ? `${metadata.genres ? metadata.genres.join(', ') : ''}, ${topTags}` : '';
        const descricaoLimpa = metadata?.description ? metadata.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.";

        // Garantir que o anime global existe
        await this.prisma.anime.upsert({
          where: { id: item.animeId },
          update: {
            titulo: metadata ? (metadata.title.english || metadata.title.romaji) : item.titulo,
            statusLancamento: metadata ? metadata.status : undefined,
            capaUrl: metadata ? metadata.coverImage?.large : undefined,
            generos: generosComTags || undefined,
            descricao: metadata ? descricaoLimpa : undefined,
            numEpisodiosTotal: metadata ? metadata.episodes : (item.numEpisodiosTotal || undefined),
          },
          create: {
            id: item.animeId,
            titulo: metadata ? (metadata.title.english || metadata.title.romaji) : item.titulo,
            statusLancamento: metadata ? metadata.status : 'UNKNOWN',
            capaUrl: metadata ? metadata.coverImage?.large : '',
            generos: generosComTags,
            descricao: descricaoLimpa,
            numEpisodiosTotal: metadata ? metadata.episodes : (item.numEpisodiosTotal || null)
          }
        });

        // Upsert UserAnime
        await this.prisma.userAnime.upsert({
          where: { userId_animeId: { userId, animeId: item.animeId } },
          update: {
            epAtual: item.epAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5
          },
          create: {
            userId,
            animeId: item.animeId,
            epAtual: item.epAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5
          }
        });
      }
    }

    // Restaurar Mangas
    if (Array.isArray(mangas)) {
      for (const item of mangas) {
        const metadata = await this.getAniListMangaById(item.mangaId);

        const topTags = metadata?.tags ? metadata.tags.slice(0, 5).map((tag: any) => tag.name).join(', ') : '';
        const generosComTags = metadata ? `${metadata.genres ? metadata.genres.join(', ') : ''}, ${topTags}` : '';
        const descricaoLimpa = metadata?.description ? metadata.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.";

        // Garantir que o manga global existe
        await this.prisma.manga.upsert({
          where: { id: item.mangaId },
          update: {
            titulo: metadata ? (metadata.title.english || metadata.title.romaji) : item.titulo,
            statusLancamento: metadata ? metadata.status : undefined,
            capaUrl: metadata ? metadata.coverImage?.large : undefined,
            generos: generosComTags || undefined,
            descricao: metadata ? descricaoLimpa : undefined,
            numCapitulosTotal: metadata ? metadata.chapters : (item.numCapitulosTotal || undefined),
          },
          create: {
            id: item.mangaId,
            titulo: metadata ? (metadata.title.english || metadata.title.romaji) : item.titulo,
            statusLancamento: metadata ? metadata.status : 'UNKNOWN',
            capaUrl: metadata ? metadata.coverImage?.large : '',
            generos: generosComTags,
            descricao: descricaoLimpa,
            numCapitulosTotal: metadata ? metadata.chapters : (item.numCapitulosTotal || null)
          }
        });

        // Upsert UserManga
        await this.prisma.userManga.upsert({
          where: { userId_mangaId: { userId, mangaId: item.mangaId } },
          update: {
            capAtual: item.capAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5
          },
          create: {
            userId,
            mangaId: item.mangaId,
            capAtual: item.capAtual,
            status: item.status,
            prioridade: item.prioridade ?? 5
          }
        });
      }
    }

    return { success: true, message: 'Restore completed successfully' };
  }

  async clearUserLibrary(userId: number) {
    await this.prisma.userAnime.deleteMany({ where: { userId } });
    await this.prisma.userManga.deleteMany({ where: { userId } });
    return { success: true, message: 'Library cleared successfully' };
  }
}