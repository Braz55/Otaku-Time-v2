import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnimeService {
  constructor(private readonly prisma: PrismaService) {}

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
            status
            description
            genres
            tags { name }
            episodes
            season
            seasonYear
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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json() as any;
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
          status
          description
          genres
          tags { name }
          episodes
          season
          seasonYear
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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json() as any;
      return result?.data?.Media || null;
    } catch (error) {
      console.error('Erro ao buscar ID na AniList:', error);
      return null;
    }
  }

  // Importa para o Catálogo Global e adiciona à lista do utilizador
  async importFromAniList(nomeAnime: string, userId: number, anilistId?: number) {
    const aniListData = anilistId ? await this.searchAniListById(anilistId) : await this.searchAniList(nomeAnime, userId);
    if (!aniListData) throw new Error('Anime não encontrado na AniList');

    const topTags = aniListData.tags ? aniListData.tags.slice(0, 5).map((tag: any) => tag.name).join(', ') : '';
    const generosComTags = `${aniListData.genres ? aniListData.genres.join(', ') : ''}, ${topTags}`;
    const descricaoLimpa = aniListData.description ? aniListData.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.";
    const linksJSON = aniListData.externalLinks ? JSON.stringify(aniListData.externalLinks) : null;

    const anime = await this.prisma.anime.upsert({
      where: { id: aniListData.id },
      update: {
        numEpisodiosTotal: aniListData.episodes,
        capaUrl: aniListData.coverImage.large,
        statusLancamento: aniListData.status,
        linksExternos: linksJSON,
        proximoEpisodio: aniListData.nextAiringEpisode?.episode,
        proximoEpisodioData: aniListData.nextAiringEpisode ? new Date(aniListData.nextAiringEpisode.airingAt * 1000) : null,
      },
      create: {
        id: aniListData.id,
        titulo: aniListData.title.english || aniListData.title.romaji,
        statusLancamento: aniListData.status,
        descricao: descricaoLimpa,
        generos: generosComTags,
        capaUrl: aniListData.coverImage.large,
        numEpisodiosTotal: aniListData.episodes,
        temporada: aniListData.season,
        ano: aniListData.seasonYear,
        linksExternos: linksJSON,
        proximoEpisodio: aniListData.nextAiringEpisode?.episode,
        proximoEpisodioData: aniListData.nextAiringEpisode ? new Date(aniListData.nextAiringEpisode.airingAt * 1000) : null,
      },
    });

    const userAnime = await this.prisma.userAnime.upsert({
      where: { userId_animeId: { userId, animeId: anime.id } },
      update: {},
      create: { userId, animeId: anime.id, status: 'PLANNED', epAtual: 0 },
      include: { anime: true }
    });
    await this.recalculateUserStats(userId);
    return userAnime;
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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      return [];
    }
  }

  async findAll(userId: number) {
    const list = await this.prisma.userAnime.findMany({ where: { userId }, include: { anime: true } });
    return list.map(item => ({
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
      updatedAt: item.updatedAt
    }));
  }

  async findOne(id: number) {
    const item = await this.prisma.userAnime.findUnique({ where: { id }, include: { anime: true } });
    if (!item) return null;
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
      updatedAt: item.updatedAt
    };
  }

  async update(id: number, updateDto: any) {
    const atual = await this.prisma.userAnime.findUnique({ where: { id }, include: { anime: true } });
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
        data: updateData
      });
      atual.anime.numEpisodiosTotal = total;
    }

    let novosDados = { ...updateDto };
    delete novosDados.numEpisodiosTotal;

    if (updateDto.status === 'COMPLETED') {
      const totalDisponivel = (atual.anime.statusLancamento === 'RELEASING' && atual.anime.proximoEpisodio) 
        ? atual.anime.proximoEpisodio - 1 
        : (atual.anime.numEpisodiosTotal || atual.epAtual);
      novosDados.epAtual = totalDisponivel;
    }

    if (updateDto.epAtual !== undefined) {
      const ep = updateDto.epAtual;
      const totalDisponivel = (atual.anime.statusLancamento === 'RELEASING' && atual.anime.proximoEpisodio) 
        ? atual.anime.proximoEpisodio - 1 
        : atual.anime.numEpisodiosTotal;

      if (atual.status === 'PLANNED' && ep > 0) novosDados.status = 'WATCHING';
      if (atual.status === 'COMPLETED' && totalDisponivel && ep < totalDisponivel) novosDados.status = 'WATCHING';

      if (atual.anime.statusLancamento !== 'RELEASING' && atual.anime.numEpisodiosTotal && ep >= atual.anime.numEpisodiosTotal) {
        novosDados.status = 'COMPLETED';
        novosDados.epAtual = atual.anime.numEpisodiosTotal;
      }
    }
    const updated = await this.prisma.userAnime.update({ where: { id }, data: novosDados, include: { anime: true } });
    await this.recalculateUserStats(updated.userId);
    return { ...updated, titulo: updated.anime.titulo, capaUrl: updated.anime.capaUrl, linksExternos: updated.anime.linksExternos, numEpisodiosTotal: updated.anime.numEpisodiosTotal, proximoEpisodio: updated.anime.proximoEpisodio };
  }

  async updateLastModified(id: number, date: Date = new Date()) {
    return this.prisma.anime.update({
      where: { id },
      data: { updatedAt: date }
    });
  }

  async remove(id: number) {
    const item = await this.prisma.userAnime.delete({ where: { id } });
    if (item) {
      await this.recalculateUserStats(item.userId);
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
      const response = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ query, variables }) });
      const result = await response.json() as any;
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
      const existe = await this.prisma.anime.findUnique({ where: { id: anilistId } });
      if (existe) {
        await this.prisma.anime.update({
          where: { id: anilistId },
          data: { 
            numEpisodiosTotal: aniListData.episodes,
            proximoEpisodio: aniListData.nextAiringEpisode?.episode,
            proximoEpisodioData: aniListData.nextAiringEpisode ? new Date(aniListData.nextAiringEpisode.airingAt * 1000) : null
          }
        });
      }
    }
    return { latest, source: 'AniList' };
  }

  async recalculateUserStats(userId: number) {
    try {
      const animes = await this.prisma.userAnime.findMany({ where: { userId } });
      const mangas = await this.prisma.userManga.findMany({ where: { userId } });

      const totalAnimeCompleted = animes.filter(a => a.status === 'COMPLETED').length;
      const totalEpisodesWatched = animes.reduce((sum, a) => sum + (a.epAtual || 0), 0);
      const totalMangaRead = mangas.reduce((sum, m) => sum + Math.floor(m.capAtual || 0), 0);
      const animeDaysWasted = parseFloat(((totalEpisodesWatched * 24) / 1440).toFixed(2));
      const mangaDaysWasted = parseFloat(((totalMangaRead * 10) / 1440).toFixed(2));

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

      // --- Conquistas automáticas ---
      // 1. Primeiros passos: sempre obtido
      await this.prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: 1 } },
        update: {},
        create: { userId, achievementId: 1 }
      });

      // 2. Maratonista (ex: mais de 100 episódios no total)
      if (totalEpisodesWatched >= 100) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: 3 } },
          update: {},
          create: { userId, achievementId: 3 }
        });
      }

      // 3. Leitor Voraz (se leu o primeiro capítulo)
      if (totalMangaRead >= 1) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: 4 } },
          update: {},
          create: { userId, achievementId: 4 }
        });
      }

      // 4. Isekai Trash: Se viu 5+ animes do género "Isekai"
      const animesDetalhes = await this.prisma.userAnime.findMany({
        where: { userId, status: 'COMPLETED' },
        include: { anime: true }
      });
      const isekaiCount = animesDetalhes.filter(ua => ua.anime.generos?.toLowerCase().includes('isekai')).length;
      if (isekaiCount >= 5) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: 2 } },
          update: {},
          create: { userId, achievementId: 2 }
        });
      }

      // 5. Crítico de Elite: se definiu 3 destaques no pódio
      const favoritesCount = await this.prisma.userTopFavorite.count({ where: { userId } });
      if (favoritesCount >= 3) {
        await this.prisma.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: 5 } },
          update: {},
          create: { userId, achievementId: 5 }
        });
      }
    } catch (e) {
      console.error('Error recalculating user statistics/achievements:', e);
    }
  }
}