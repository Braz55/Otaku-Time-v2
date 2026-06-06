import { Injectable, BadRequestException } from '@nestjs/common';
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

  async update(id: number, updateDto: any) {
    const data = { ...updateDto };
    if (data.password) {
      if (!data.currentPassword) {
        throw new BadRequestException('A palavra-passe atual é obrigatória para definir uma nova.');
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

  async fetchAniListGraphQL(query: string, variables: any, retries = 3, delayMs = 1500): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query, variables }),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
          console.warn(`[Backend Restore] AniList Rate Limited (429). Waiting ${waitTime}ms before retry (attempt ${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }

        const result = await response.json() as any;
        return result?.data?.Media || null;
      } catch (error) {
        console.warn(`[Backend Restore] Error querying AniList (attempt ${attempt}/${retries}):`, error);
        if (attempt === retries) return null;
        await new Promise(resolve => setTimeout(resolve, delayMs));
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
          tags { name }
          episodes
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
          tags { name }
          chapters
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
            numEpisodiosTotal: metadata ? metadata.episodes : undefined,
          },
          create: {
            id: item.animeId,
            titulo: metadata ? (metadata.title.english || metadata.title.romaji) : item.titulo,
            statusLancamento: metadata ? metadata.status : 'UNKNOWN',
            capaUrl: metadata ? metadata.coverImage?.large : '',
            generos: generosComTags,
            descricao: descricaoLimpa,
            numEpisodiosTotal: metadata ? metadata.episodes : null
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

        // Pausa de no mínimo 2 segundos antes de passar para o próximo item
        // Isto garante que tudo é guardado por ordem na BD sem sobreposições e respeita o rate limiting da API
        await new Promise(resolve => setTimeout(resolve, 2000));
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
            numCapitulosTotal: metadata ? metadata.chapters : undefined,
          },
          create: {
            id: item.mangaId,
            titulo: metadata ? (metadata.title.english || metadata.title.romaji) : item.titulo,
            statusLancamento: metadata ? metadata.status : 'UNKNOWN',
            capaUrl: metadata ? metadata.coverImage?.large : '',
            generos: generosComTags,
            descricao: descricaoLimpa,
            numCapitulosTotal: metadata ? metadata.chapters : null
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

        // Pausa de no mínimo 2 segundos antes de passar para o próximo item
        // Isto garante que tudo é guardado por ordem na BD sem sobreposições e respeita o rate limiting da API
        await new Promise(resolve => setTimeout(resolve, 2000));
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