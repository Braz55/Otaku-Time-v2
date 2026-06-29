import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListService } from '../list/list.service';

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

function hasGenreOrTag(generos: any, target: string): boolean {
  if (!generos) return false;
  if (typeof generos === 'string') {
    return generos.toLowerCase().includes(target.toLowerCase());
  }
  if (typeof generos === 'object') {
    return Object.keys(generos).some(
      (key) => key.toLowerCase() === target.toLowerCase(),
    );
  }
  return false;
}

@Injectable()
export class AnimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listService: ListService,
  ) {}

  // Busca dados detalhados da AniList por Nome
  async searchAniList(nomeAnime: string, userId?: number) {
    let isAdult: boolean | undefined = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.showAdultContent) {
        isAdult = undefined;
      }
    }

    const query = `
      query ($s: String, $isAdult: Boolean) {
        Page(perPage: 1) {
          media(search: $s, type: ANIME, sort: SEARCH_MATCH, isAdult: $isAdult) {
            id
            title { english romaji native }
            coverImage { large }
            averageScore
            status
            description
            genres
            tags { name rank }
            episodes
            season
            seasonYear
            countryOfOrigin
            format
            source
            externalLinks { url site type language }
            nextAiringEpisode {
              airingAt
              episode
            }
          }
        }
      }
    `;
    const variables = { s: nomeAnime, isAdult };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media[0] || null;
    } catch (error) {
      console.error('Erro na ligação à AniList:', error);
      return null;
    }
  }

  // Busca dados detalhados da AniList por ID
  async searchAniListById(id: number) {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { english romaji native }
          coverImage { large }
          averageScore
          status
          description
          genres
          tags { name rank }
          episodes
          season
          seasonYear
          countryOfOrigin
          format
          source
          externalLinks { url site type language }
          nextAiringEpisode {
            airingAt
            episode
          }
        }
      }
    `;
    const variables = { id };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Media || null;
    } catch (error) {
      console.error('Erro ao buscar ID na AniList:', error);
      return null;
    }
  }

  // Importa para o Catálogo Global e adiciona à lista do utilizador
  async importFromAniList(
    nomeAnime: string,
    userId: number,
    anilistId?: number,
  ) {
    let anime = anilistId
      ? await this.prisma.anime.findUnique({ where: { id: anilistId } })
      : null;

    if (anime) {
      const userAnime = await this.prisma.userAnime.upsert({
        where: { userId_animeId: { userId, animeId: anime.id } },
        update: {},
        create: { userId, animeId: anime.id, status: 'PLANNED', epAtual: 0 },
        include: { anime: true },
      });

      this.backgroundUpdateAnime(anime.id, userId).catch((err) => {
        console.error('Error in backgroundUpdateAnime:', err);
      });

      const rating = await this.prisma.media.findUnique({
        where: { id: anime.id },
      });
      return {
        ...userAnime,
        avaliacaoGeral: rating?.avaliacao_geral ?? null,
        totalVotosUsers: rating?.total_votos_users ?? 0,
      };
    }

    const aniListData = anilistId
      ? await this.searchAniListById(anilistId)
      : await this.searchAniList(nomeAnime, userId);
    if (!aniListData) throw new Error('Anime não encontrado na AniList');

    const generosDict = buildGenerosDict(
      aniListData.genres,
      aniListData.tags?.slice(0, 10),
    );
    const descricaoLimpa = aniListData.description
      ? aniListData.description.replace(/<[^>]*>?/gm, '')
      : 'Sem descrição.';
    const linksJSON = aniListData.externalLinks
      ? JSON.stringify(aniListData.externalLinks)
      : null;

    anime = await this.prisma.anime.upsert({
      where: { id: aniListData.id },
      update: {
        numEpisodiosTotal: aniListData.episodes,
        capaUrl: aniListData.coverImage.large,
        statusLancamento: aniListData.status,
        linksExternos: linksJSON,
        proximoEpisodio: aniListData.nextAiringEpisode?.episode,
        proximoEpisodioData: aniListData.nextAiringEpisode
          ? new Date(aniListData.nextAiringEpisode.airingAt * 1000)
          : null,
        generos: generosDict,
        paisOrigem: aniListData.countryOfOrigin,
        formato: aniListData.format,
        materialOrigem: aniListData.source,
      },
      create: {
        id: aniListData.id,
        titulo: aniListData.title.english || aniListData.title.romaji,
        statusLancamento: aniListData.status,
        descricao: descricaoLimpa,
        generos: generosDict,
        capaUrl: aniListData.coverImage.large,
        numEpisodiosTotal: aniListData.episodes,
        temporada: aniListData.season,
        ano: aniListData.seasonYear,
        paisOrigem: aniListData.countryOfOrigin,
        formato: aniListData.format,
        materialOrigem: aniListData.source,
        linksExternos: linksJSON,
        proximoEpisodio: aniListData.nextAiringEpisode?.episode,
        proximoEpisodioData: aniListData.nextAiringEpisode
          ? new Date(aniListData.nextAiringEpisode.airingAt * 1000)
          : null,
      },
    });

    // Criar registo de Media se não existir para semente híbrida de avaliações
    const averageScore = aniListData.averageScore
      ? aniListData.averageScore / 10
      : 0;
    const existingMedia = await this.prisma.media.findUnique({
      where: { id: anime.id },
    });
    if (!existingMedia) {
      await this.prisma.media.create({
        data: {
          id: anime.id,
          avaliacao_base: averageScore,
          total_votos_users: 0,
          soma_notas_users: 0,
          avaliacao_geral: averageScore,
        },
      });
    }

    const userAnime = await this.prisma.userAnime.upsert({
      where: { userId_animeId: { userId, animeId: anime.id } },
      update: {},
      create: { userId, animeId: anime.id, status: 'PLANNED', epAtual: 0 },
      include: { anime: true },
    });
    this.recalculateUserStats(userId).catch((err) => {
      console.error('Error recalculating user stats in background:', err);
    });
    const rating = await this.prisma.media.findUnique({
      where: { id: anime.id },
    });
    return {
      ...userAnime,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async backgroundUpdateAnime(animeId: number, userId: number) {
    try {
      const aniListData = await this.searchAniListById(animeId);
      if (aniListData) {
        const generosDict = buildGenerosDict(
          aniListData.genres,
          aniListData.tags?.slice(0, 10),
        );
        const descricaoLimpa = aniListData.description
          ? aniListData.description.replace(/<[^>]*>?/gm, '')
          : 'Sem descrição.';
        const linksJSON = aniListData.externalLinks
          ? JSON.stringify(aniListData.externalLinks)
          : null;

        await this.prisma.anime.update({
          where: { id: animeId },
          data: {
            numEpisodiosTotal: aniListData.episodes,
            capaUrl: aniListData.coverImage.large,
            statusLancamento: aniListData.status,
            linksExternos: linksJSON,
            proximoEpisodio: aniListData.nextAiringEpisode?.episode,
            proximoEpisodioData: aniListData.nextAiringEpisode
              ? new Date(aniListData.nextAiringEpisode.airingAt * 1000)
              : null,
            generos: generosDict,
          },
        });

        // Garantir registo de Media
        const averageScore = aniListData.averageScore
          ? aniListData.averageScore / 10
          : 0;
        const existingMedia = await this.prisma.media.findUnique({
          where: { id: animeId },
        });
        if (!existingMedia) {
          await this.prisma.media.create({
            data: {
              id: animeId,
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
        `Error in backgroundUpdateAnime for anime ID ${animeId}:`,
        error,
      );
    } finally {
      this.recalculateUserStats(userId).catch((err) => {
        console.error('Error recalculating user stats in background:', err);
      });
    }
  }

  async searchAnimeList(nomeAnime: string, page: number = 1, userId?: number) {
    let isAdult: boolean | undefined = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.showAdultContent) {
        isAdult = undefined;
      }
    }

    const query = `
      query ($s: String, $page: Int, $isAdult: Boolean) {
        Page(page: $page, perPage: 24) {
          media(search: $s, type: ANIME, sort: SEARCH_MATCH, isAdult: $isAdult) {
            id
            title { romaji english }
            coverImage { large }
            status
          }
        }
      }
    `;
    const variables = { s: nomeAnime.trim(), page, isAdult };
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      return [];
    }
  }

  async findAll(userId: number) {
    const list = await this.prisma.userAnime.findMany({
      where: { userId },
      include: { anime: true },
    });
    const animeIds = list.map((item) => item.animeId);
    const ratings = await this.prisma.media.findMany({
      where: { id: { in: animeIds } },
    });
    const ratingMap = new Map(ratings.map((r) => [r.id, r]));

    return list.map((item) => {
      const rating = ratingMap.get(item.animeId);
      return {
        id: item.id,
        animeId: item.animeId,
        titulo: item.anime.titulo,
        statusLancamento: item.anime.statusLancamento,
        capaUrl: item.anime.capaUrl,
        generos: item.anime.generos,
        descricao: item.anime.descricao,
        status: item.status,
        epAtual: item.epAtual,
        numEpisodiosTotal: item.anime.numEpisodiosTotal,
        temporada: item.anime.temporada,
        ano: item.anime.ano,
        prioridade: item.prioridade,
        linksExternos: item.anime.linksExternos,
        linksPersonalizados: item.linksPersonalizados,
        proximoEpisodio: item.anime.proximoEpisodio,
        proximoEpisodioData: item.anime.proximoEpisodioData,
        updatedAt: item.updatedAt,
        lastProgressUpdate: item.lastProgressUpdate,
        avaliacaoGeral: rating?.avaliacao_geral ?? null,
        totalVotosUsers: rating?.total_votos_users ?? 0,
      };
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true },
    });
    if (!item) return null;
    const rating = await this.prisma.media.findUnique({
      where: { id: item.animeId },
    });
    return {
      id: item.id,
      animeId: item.animeId,
      titulo: item.anime.titulo,
      statusLancamento: item.anime.statusLancamento,
      capaUrl: item.anime.capaUrl,
      generos: item.anime.generos,
      descricao: item.anime.descricao,
      status: item.status,
      epAtual: item.epAtual,
      numEpisodiosTotal: item.anime.numEpisodiosTotal,
      temporada: item.anime.temporada,
      ano: item.anime.ano,
      prioridade: item.prioridade,
      linksExternos: item.anime.linksExternos,
      linksPersonalizados: item.linksPersonalizados,
      proximoEpisodio: item.anime.proximoEpisodio,
      proximoEpisodioData: item.anime.proximoEpisodioData,
      updatedAt: item.updatedAt,
      lastProgressUpdate: item.lastProgressUpdate,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async update(id: number, updateDto: any) {
    const atual = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true },
    });
    if (!atual) return null;

    if (updateDto.numEpisodiosTotal !== undefined) {
      const total = updateDto.numEpisodiosTotal;
      const updateData: any = { numEpisodiosTotal: total };
      if (atual.anime.statusLancamento === 'RELEASING') {
        updateData.proximoEpisodio = total + 1;
        atual.anime.proximoEpisodio = total + 1;
      }
      await this.prisma.anime.update({
        where: { id: atual.animeId },
        data: updateData,
      });
      atual.anime.numEpisodiosTotal = total;
    }

    const novosDados = { ...updateDto };
    delete novosDados.numEpisodiosTotal;

    if (updateDto.status !== undefined && atual.status === 'DROPPED') {
      novosDados.wasDropped = true;
    }

    if (updateDto.status === 'COMPLETED') {
      const totalDisponivel =
        atual.anime.statusLancamento === 'RELEASING' &&
        atual.anime.proximoEpisodio
          ? atual.anime.proximoEpisodio - 1
          : atual.anime.numEpisodiosTotal || atual.epAtual;
      novosDados.epAtual = totalDisponivel;
    }

    if (updateDto.epAtual !== undefined) {
      const ep = updateDto.epAtual;
      const totalDisponivel =
        atual.anime.statusLancamento === 'RELEASING' &&
        atual.anime.proximoEpisodio
          ? atual.anime.proximoEpisodio - 1
          : atual.anime.numEpisodiosTotal;

      if (atual.status === 'PLANNED' && ep > 0) novosDados.status = 'WATCHING';
      if (
        atual.status === 'COMPLETED' &&
        totalDisponivel &&
        ep < totalDisponivel
      )
        novosDados.status = 'WATCHING';

      if (
        atual.anime.statusLancamento !== 'RELEASING' &&
        atual.anime.numEpisodiosTotal &&
        ep >= atual.anime.numEpisodiosTotal
      ) {
        novosDados.status = 'COMPLETED';
        novosDados.epAtual = atual.anime.numEpisodiosTotal;
      }
    }

    if (
      novosDados.epAtual !== undefined &&
      novosDados.epAtual > atual.epAtual
    ) {
      novosDados.lastProgressUpdate = new Date();
    }

    const updated = await this.prisma.userAnime.update({
      where: { id },
      data: novosDados,
      include: { anime: true },
    });
    this.recalculateUserStats(updated.userId).catch((err) => {
      console.error('Error recalculating user stats in background:', err);
    });
    const rating = await this.prisma.media.findUnique({
      where: { id: updated.animeId },
    });
    return {
      ...updated,
      titulo: updated.anime.titulo,
      capaUrl: updated.anime.capaUrl,
      linksExternos: updated.anime.linksExternos,
      numEpisodiosTotal: updated.anime.numEpisodiosTotal,
      proximoEpisodio: updated.anime.proximoEpisodio,
      avaliacaoGeral: rating?.avaliacao_geral ?? null,
      totalVotosUsers: rating?.total_votos_users ?? 0,
    };
  }

  async updateLastModified(id: number, date: Date = new Date()) {
    return this.prisma.anime.update({
      where: { id },
      data: { updatedAt: date },
    });
  }

  async remove(id: number) {
    const item = await this.prisma.userAnime.delete({ where: { id } });
    if (item) {
      this.recalculateUserStats(item.userId).catch((err) => {
        console.error('Error recalculating user stats in background:', err);
      });
    }
    return item;
  }

  async searchByGenre(genre: string, page: number = 1, userId?: number) {
    let isAdult: boolean | undefined = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.showAdultContent) {
        isAdult = undefined;
      }
    }

    const query = `query ($g: String, $page: Int, $isAdult: Boolean) { Page(page: $page, perPage: 24) { media(genre: $g, type: ANIME, sort: POPULARITY_DESC, isAdult: $isAdult) { id title { english romaji } coverImage { large } genres } } }`;
    const variables = { g: genre, page, isAdult };
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      return [];
    }
  }

  async syncLatestEpisode(anilistId: number) {
    const aniListData = await this.searchAniListById(anilistId);
    if (!aniListData) return { latest: null };

    let latest = aniListData.episodes || null;
    if (aniListData.status === 'RELEASING' && aniListData.nextAiringEpisode) {
      latest = aniListData.nextAiringEpisode.episode - 1;
    }

    if (latest !== null) {
      const existe = await this.prisma.anime.findUnique({
        where: { id: anilistId },
      });
      if (existe) {
        await this.prisma.anime.update({
          where: { id: anilistId },
          data: {
            numEpisodiosTotal: aniListData.episodes,
            proximoEpisodio: aniListData.nextAiringEpisode?.episode,
            proximoEpisodioData: aniListData.nextAiringEpisode
              ? new Date(aniListData.nextAiringEpisode.airingAt * 1000)
              : null,
          },
        });
      }
    }
    return { latest, source: 'AniList' };
  }

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

      // --- Obter conquistas já desbloqueadas para evitar chamadas de BD desnecessárias ---
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

      // --- Conquistas automáticas ---
      // 1. Primeiros passos: sempre obtido
      await awardAchievement(1);

      // 2. Maratonista (ex: mais de 100 episódios no total)
      if (totalEpisodesWatched >= 100) {
        await awardAchievement(3);
      }

      // 3. Leitor Voraz (se leu o primeiro capítulo)
      if (totalMangaRead >= 1) {
        await awardAchievement(4);
      }

      // 4. Isekai Trash: Se viu 5+ animes do género "Isekai"
      // Reutiliza o array 'animes' em memória em vez de fazer nova consulta redundante
      const completedAnimes = animes.filter((ua) => ua.status === 'COMPLETED');
      const isekaiCount = completedAnimes.filter((ua) =>
        hasGenreOrTag(ua.anime.generos, 'isekai'),
      ).length;
      if (isekaiCount >= 5) {
        await awardAchievement(2);
      }

      // 5. Crítico de Elite: se definiu 3 destaques no pódio
      const favoritesCount = await this.prisma.userTopFavorite.count({
        where: { userId },
      });
      if (favoritesCount >= 3) {
        await awardAchievement(5);
      }

      // 6-9: A Vítima do Camião-kun (Isekai - Anime)
      const allIsekaiAnimesCount = animes.filter((ua) =>
        hasGenreOrTag(ua.anime.generos, 'isekai'),
      ).length;
      if (allIsekaiAnimesCount >= 3) await awardAchievement(6);
      if (allIsekaiAnimesCount >= 6) await awardAchievement(7);
      if (allIsekaiAnimesCount >= 12) await awardAchievement(8);
      if (allIsekaiAnimesCount >= 18) await awardAchievement(9);

      // 10-13: Isekai de Bolso (Isekai - Mangá)
      const allIsekaiMangasCount = mangas.filter((um) =>
        hasGenreOrTag(um.manga.generos, 'isekai'),
      ).length;
      if (allIsekaiMangasCount >= 3) await awardAchievement(10);
      if (allIsekaiMangasCount >= 6) await awardAchievement(11);
      if (allIsekaiMangasCount >= 12) await awardAchievement(12);
      if (allIsekaiMangasCount >= 18) await awardAchievement(13);

      // 14-17: Resina Esgotada (Binge Watching - Anime)
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

      // 18-21: Luz Acesa (Binge Reading - Mangá)
      const recentMangas = mangas.filter((m) => m.updatedAt >= oneWeekAgo);
      const recentHoursRead = recentMangas.reduce(
        (sum, m) => sum + ((m.capAtual || 0) * 10) / 60,
        0,
      );
      if (recentHoursRead >= 4) await awardAchievement(18);
      if (recentHoursRead >= 8) await awardAchievement(19);
      if (recentHoursRead >= 12) await awardAchievement(20);
      if (recentHoursRead >= 24) await awardAchievement(21);

      // 22-23: Culto da Madrugada
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

      // 24-27: Protagonista em Bulking (Sports/Action - Anime)
      const completedBulkingAnimes = animes.filter(
        (ua) =>
          ua.status === 'COMPLETED' &&
          (hasGenreOrTag(ua.anime.generos, 'sports') ||
            hasGenreOrTag(ua.anime.generos, 'action') ||
            hasGenreOrTag(ua.anime.generos, 'desporto') ||
            hasGenreOrTag(ua.anime.generos, 'ação')),
      ).length;
      if (completedBulkingAnimes >= 3) await awardAchievement(24);
      if (completedBulkingAnimes >= 6) await awardAchievement(25);
      if (completedBulkingAnimes >= 12) await awardAchievement(26);
      if (completedBulkingAnimes >= 18) await awardAchievement(27);

      // 28-31: Protagonista em Bulking (Sports/Action - Mangá)
      const completedBulkingMangas = mangas.filter(
        (um) =>
          um.status === 'COMPLETED' &&
          (hasGenreOrTag(um.manga.generos, 'sports') ||
            hasGenreOrTag(um.manga.generos, 'action') ||
            hasGenreOrTag(um.manga.generos, 'desporto') ||
            hasGenreOrTag(um.manga.generos, 'ação')),
      ).length;
      if (completedBulkingMangas >= 3) await awardAchievement(28);
      if (completedBulkingMangas >= 6) await awardAchievement(29);
      if (completedBulkingMangas >= 12) await awardAchievement(30);
      if (completedBulkingMangas >= 18) await awardAchievement(31);

      // 32-35: Síndrome de Shoujo (Romance/Drama - Anime)
      const completedRomanceAnimes = animes.filter(
        (ua) =>
          ua.status === 'COMPLETED' &&
          (hasGenreOrTag(ua.anime.generos, 'romance') ||
            hasGenreOrTag(ua.anime.generos, 'drama') ||
            hasGenreOrTag(ua.anime.generos, 'shoujo')),
      ).length;
      if (completedRomanceAnimes >= 3) await awardAchievement(32);
      if (completedRomanceAnimes >= 6) await awardAchievement(33);
      if (completedRomanceAnimes >= 12) await awardAchievement(34);
      if (completedRomanceAnimes >= 18) await awardAchievement(35);

      // 36-39: Síndrome de Shoujo (Romance/Drama - Mangá)
      const completedRomanceMangas = mangas.filter(
        (um) =>
          um.status === 'COMPLETED' &&
          (hasGenreOrTag(um.manga.generos, 'romance') ||
            hasGenreOrTag(um.manga.generos, 'drama') ||
            hasGenreOrTag(um.manga.generos, 'shoujo')),
      ).length;
      if (completedRomanceMangas >= 3) await awardAchievement(36);
      if (completedRomanceMangas >= 6) await awardAchievement(37);
      if (completedRomanceMangas >= 12) await awardAchievement(38);
      if (completedRomanceMangas >= 18) await awardAchievement(39);

      // 40: Nostalgia Pura (Anime)
      const nostalgiaAnimesCount = animes.filter(
        (ua) =>
          ua.status === 'COMPLETED' && ua.anime.ano && ua.anime.ano < 2000,
      ).length;
      if (nostalgiaAnimesCount >= 5) {
        await awardAchievement(40);
      }

      // 41: Nostalgia Pura (Mangá)
      const nostalgiaMangasCount = mangas.filter(
        (um) =>
          um.status === 'COMPLETED' &&
          (/(?:198\d|199\d)\b/.test(um.manga.descricao || '') ||
            um.manga.titulo.toLowerCase().includes('dragon ball') ||
            um.manga.titulo.toLowerCase().includes('berserk') ||
            um.manga.titulo.toLowerCase().includes('evangelion') ||
            um.manga.titulo.toLowerCase().includes('slam dunk')),
      ).length;
      if (nostalgiaMangasCount >= 5) {
        await awardAchievement(41);
      }

      // 42: Tsundere Assumido (Anime)
      const tsundereAnimes = animes.filter(
        (ua) => ua.status === 'COMPLETED' && ua.wasDropped,
      ).length;
      if (tsundereAnimes >= 1) {
        await awardAchievement(42);
      }

      // 43: Tsundere Assumido (Mangá)
      const tsundereMangas = mangas.filter(
        (um) => um.status === 'COMPLETED' && um.wasDropped,
      ).length;
      if (tsundereMangas >= 1) {
        await awardAchievement(43);
      }

      // 46: O Arconte da Leitura
      if (totalMangaRead >= totalEpisodesWatched * 2 && totalMangaRead > 0) {
        await awardAchievement(46);
      }
    } catch (e) {
      console.error('Error recalculating user statistics/achievements:', e);
    }
  }

  async getGenreTags() {
    return this.prisma.genreTag.findMany({
      orderBy: [
        { type: 'asc' },
        { category: 'asc' },
        { subcategory: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async getRecommendations(
    type: 'ANIME' | 'MANGA',
    userId: number,
    page: number = 1,
  ) {
    let userLibraryIds = new Set<number>();
    let userInteractedItems: {
      generos: any;
      status: string;
      paisOrigem: string | null;
    }[] = [];

    if (type === 'ANIME') {
      const userAnimes = await this.prisma.userAnime.findMany({
        where: { userId },
        include: { anime: true },
      });
      userLibraryIds = new Set<number>(userAnimes.map((ua) => ua.animeId));
      userInteractedItems = userAnimes.map((ua) => ({
        generos: ua.anime?.generos,
        status: ua.status,
        paisOrigem: ua.anime?.paisOrigem || null,
      }));
    } else {
      const userMangas = await this.prisma.userManga.findMany({
        where: { userId },
        include: { manga: true },
      });
      userLibraryIds = new Set<number>(userMangas.map((um) => um.mangaId));
      userInteractedItems = userMangas.map((um) => ({
        generos: um.manga?.generos,
        status: um.status,
        paisOrigem: um.manga?.paisOrigem || null,
      }));
    }

    const tasteScores: Record<string, number> = {};
    userInteractedItems.forEach((item) => {
      if (!item.generos) return;

      let genresObj: Record<string, number> = {};
      if (typeof item.generos === 'string') {
        item.generos
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((g) => {
            genresObj[g] = 100;
          });
      } else if (typeof item.generos === 'object') {
        genresObj = item.generos as Record<string, number>;
      }

      let multiplier = 1.0;
      if (item.status === 'COMPLETED') multiplier = 1.5;
      else if (item.status === 'DROPPED') multiplier = 0.3;
      else if (item.status === 'PAUSED') multiplier = 0.5;

      Object.entries(genresObj).forEach(([tag, weight]) => {
        const score = (typeof weight === 'number' ? weight : 100) * multiplier;
        tasteScores[tag] = (tasteScores[tag] || 0) + score;
      });
    });

    const sortedTastes = Object.entries(tasteScores)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    const allDbGenresTags = await this.prisma.genreTag.findMany({
      select: { name: true, type: true },
    });
    const dbGenreNames = allDbGenresTags
      .filter((gt) => gt.type === 'GENRE')
      .map((gt) => gt.name);
    const dbAllNames = allDbGenresTags.map((gt) => gt.name);

    const unexploredTastes = dbAllNames.filter((name) => !tasteScores[name]);

    const discoveryTastes: string[] = [];
    if (unexploredTastes.length > 0) {
      const index1 = Math.floor(Math.random() * unexploredTastes.length);
      discoveryTastes.push(unexploredTastes[index1]);
      if (unexploredTastes.length > 1) {
        const index2 = (index1 + 1) % unexploredTastes.length;
        discoveryTastes.push(unexploredTastes[index2]);
      }
    }

    // Calcular o país de preferência com base nos itens da biblioteca
    const countryCounts: Record<string, number> = {};
    userInteractedItems.forEach((item) => {
      if (item.paisOrigem) {
        countryCounts[item.paisOrigem] =
          (countryCounts[item.paisOrigem] || 0) + 1;
      }
    });

    let preferredCountry: string | undefined = undefined;
    const sortedCountries = Object.entries(countryCounts).sort(
      (a, b) => b[1] - a[1],
    );
    if (sortedCountries.length > 0 && sortedCountries[0][1] > 0) {
      preferredCountry = sortedCountries[0][0];
    }

    // Helper para extrair coocorrências de tags baseadas nos itens que contêm um gosto âncora
    const buildProfileForAnchor = (
      anchor: string,
      excludeTastes: string[] = [],
    ) => {
      if (!anchor) return [];

      const coCounts: Record<string, number> = {};
      userInteractedItems.forEach((item) => {
        if (!item.generos) return;

        let genresObj: Record<string, number> = {};
        if (typeof item.generos === 'string') {
          item.generos
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((g) => {
              genresObj[g] = 100;
            });
        } else if (typeof item.generos === 'object') {
          genresObj = item.generos as Record<string, number>;
        }

        if (genresObj[anchor]) {
          let multiplier = 1.0;
          if (item.status === 'COMPLETED') multiplier = 1.5;
          else if (item.status === 'DROPPED') multiplier = 0.3;
          else if (item.status === 'PAUSED') multiplier = 0.5;

          Object.keys(genresObj).forEach((tag) => {
            if (tag !== anchor) {
              const weight = genresObj[tag];
              const score =
                (typeof weight === 'number' ? weight : 100) * multiplier;
              coCounts[tag] = (coCounts[tag] || 0) + score;
            }
          });
        }
      });

      const sortedCo = Object.entries(coCounts)
        .filter((entry) => !excludeTastes.includes(entry[0]))
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0]);

      return [anchor, ...sortedCo.slice(0, 3)];
    };

    // Construção de Perfis Temáticos Combinados
    const profile1 = sortedTastes[0]
      ? buildProfileForAnchor(sortedTastes[0])
      : [];
    const profile2 = sortedTastes[1]
      ? buildProfileForAnchor(sortedTastes[1], profile1)
      : [];
    const profile3 = sortedTastes[2]
      ? buildProfileForAnchor(sortedTastes[2], [...profile1, ...profile2])
      : [];

    console.log(
      `\x1b[35m[Recomendações - ${type}]\x1b[0m Utilizador ID: ${userId}`,
    );
    console.log(
      `  -> País de preferência (Preferred Country):`,
      preferredCountry || 'Nenhum',
    );
    console.log(`  -> Perfil Temático 1 (Profile 1):`, profile1);
    console.log(`  -> Perfil Temático 2 (Profile 2):`, profile2);
    console.log(`  -> Perfil Temático 3 (Profile 3):`, profile3);
    console.log(`  -> Gostos para Descoberta (Discovery):`, discoveryTastes);

    let isAdult: boolean | undefined = false;
    const userObj = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (userObj && userObj.showAdultContent) {
      isAdult = undefined;
    }

    // Helper para classificar e reordenar localmente de acordo com a quantidade de tags coincidentes
    const rankPoolByProfile = (pool: any[], profile: string[]) => {
      if (profile.length === 0) return pool;
      return pool
        .map((item) => {
          let overlap = 0;
          const itemGenres = item.genres || [];
          const itemTags = (item.tags || []).map((t: any) => t.name);
          const itemAllTastes = [...itemGenres, ...itemTags];

          profile.forEach((taste) => {
            if (itemAllTastes.includes(taste)) {
              overlap++;
            }
          });

          return { item, overlap };
        })
        .sort((a, b) => b.overlap - a.overlap)
        .map((entry) => entry.item);
    };

    const fetchCandidatePoolForProfile = async (
      profile: string[],
      sort: string = 'POPULARITY_DESC',
      country?: string,
    ) => {
      if (!profile || profile.length === 0) return [];

      const genres = profile.filter((t) => dbGenreNames.includes(t));
      const tags = profile.filter((t) => !dbGenreNames.includes(t));

      const rawCandidates = await this.fetchCandidatesFromAniList(
        type,
        genres.length > 0 ? genres : undefined,
        tags.length > 0 ? tags : undefined,
        sort,
        isAdult,
        country,
      );

      return rankPoolByProfile(rawCandidates, profile);
    };

    const fetchCandidatePool = async (
      genres?: string[],
      tags?: string[],
      sort: string = 'POPULARITY_DESC',
      country?: string,
    ) => {
      return this.fetchCandidatesFromAniList(
        type,
        genres,
        tags,
        sort,
        isAdult,
        country,
      );
    };

    const [
      poolPrimary1,
      poolPrimary2,
      poolSecondary1,
      poolDiscovery,
      poolGlobal,
    ] = await Promise.all([
      profile1.length > 0
        ? fetchCandidatePoolForProfile(
            profile1,
            'TRENDING_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      profile2.length > 0
        ? fetchCandidatePoolForProfile(
            profile2,
            'POPULARITY_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      profile3.length > 0
        ? fetchCandidatePoolForProfile(
            profile3,
            'POPULARITY_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      discoveryTastes[0]
        ? fetchCandidatePool(
            dbGenreNames.includes(discoveryTastes[0])
              ? [discoveryTastes[0]]
              : undefined,
            !dbGenreNames.includes(discoveryTastes[0])
              ? [discoveryTastes[0]]
              : undefined,
            'TRENDING_DESC',
          )
        : Promise.resolve([]),
      fetchCandidatePool(
        undefined,
        undefined,
        'TRENDING_DESC',
        preferredCountry,
      ),
    ]);

    const allCandidates: any[] = [];
    const maxLen = Math.max(
      poolPrimary1.length,
      poolPrimary2.length,
      poolSecondary1.length,
      poolDiscovery.length,
      poolGlobal.length,
    );

    const addedIds = new Set<number>();

    for (let i = 0; i < maxLen; i++) {
      const candidatesInRound = [
        poolPrimary1[i],
        poolPrimary2[i],
        poolSecondary1[i],
        poolGlobal[i],
        poolDiscovery[i],
      ].filter(Boolean);

      candidatesInRound.forEach((item) => {
        if (!userLibraryIds.has(item.id) && !addedIds.has(item.id)) {
          allCandidates.push(item);
          addedIds.add(item.id);
        }
      });
    }

    if (allCandidates.length === 0) {
      poolGlobal.forEach((item) => {
        if (!userLibraryIds.has(item.id) && !addedIds.has(item.id)) {
          allCandidates.push(item);
          addedIds.add(item.id);
        }
      });
    }

    const perPage = 24;
    const startIndex = (page - 1) * perPage;
    return allCandidates.slice(startIndex, startIndex + perPage);
  }

  private async fetchCandidatesFromAniList(
    type: 'ANIME' | 'MANGA',
    genres?: string[],
    tags?: string[],
    sort: string = 'POPULARITY_DESC',
    isAdult?: boolean,
    country?: string,
  ): Promise<any[]> {
    const query = `
      query ($genres: [String], $tags: [String], $sort: [MediaSort], $isAdult: Boolean, $type: MediaType, $country: CountryCode) {
        Page(page: 1, perPage: 25) {
          media(genre_in: $genres, tag_in: $tags, type: $type, sort: $sort, isAdult: $isAdult, countryOfOrigin: $country) {
            id
            title { english romaji native }
            coverImage { large }
            genres
            tags { name }
            averageScore
            description
            episodes
            chapters
            status
          }
        }
      }
    `;

    const variables: any = {
      type,
      sort: [sort],
      isAdult,
    };

    if (genres && genres.length > 0) variables.genres = genres;
    if (tags && tags.length > 0) variables.tags = tags;
    if (country) variables.country = country;

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      console.error('Error fetching candidates from AniList:', error);
      return [];
    }
  }

  async explore(
    type: 'ANIME' | 'MANGA' = 'ANIME',
    genres?: string[],
    tags?: string[],
    year?: number,
    season?: string,
    format?: string,
    status?: string,
    source?: string,
    country?: string,
    sort: string = 'TRENDING_DESC',
    page: number = 1,
    userId?: number,
  ) {
    if (sort === 'RECOMMENDED') {
      if (!userId) return [];
      return this.getRecommendations(type, userId, page);
    }

    let isAdult: boolean | undefined = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && user.showAdultContent) {
        isAdult = undefined;
      }
    }

    const query = `
      query (
        $genres: [String], 
        $tags: [String], 
        $sort: [MediaSort], 
        $page: Int, 
        $isAdult: Boolean, 
        $type: MediaType, 
        $seasonYear: Int, 
        $season: MediaSeason, 
        $format: MediaFormat, 
        $status: MediaStatus, 
        $source: MediaSource,
        $country: CountryCode
      ) {
        Page(page: $page, perPage: 24) {
          media(
            genre_in: $genres, 
            tag_in: $tags, 
            type: $type, 
            sort: $sort, 
            isAdult: $isAdult, 
            seasonYear: $seasonYear, 
            season: $season, 
            format: $format, 
            status: $status, 
            source: $source,
            countryOfOrigin: $country
          ) {
            id
            title { english romaji native }
            coverImage { large }
            genres
            tags { name }
            averageScore
            description
            episodes
            chapters
            status
          }
        }
      }
    `;

    const variables: any = {
      type,
      sort: [sort],
      page,
      isAdult,
    };

    if (genres && genres.length > 0) {
      variables.genres = genres;
    }
    if (tags && tags.length > 0) {
      variables.tags = tags;
    }
    if (year) {
      variables.seasonYear = year;
    }
    if (season && season !== 'Any') {
      variables.season = season;
    }
    if (format && format !== 'Any') {
      variables.format = format;
    }
    if (status && status !== 'Any') {
      variables.status = status;
    }
    if (source && source !== 'Any') {
      variables.source = source;
    }
    if (country && country !== 'Any') {
      variables.country = country;
    }

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      console.error('Error in explore query:', error);
      return [];
    }
  }
}
