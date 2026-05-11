import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnimeService {
  constructor(private readonly prisma: PrismaService) {}

  // Busca dados detalhados da AniList
  async searchAniList(nomeAnime: string) {
    const query = `
      query ($s: String) {
        Page(perPage: 1) {
          media(search: $s, type: ANIME, sort: SEARCH_MATCH) {
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
          }
        }
      }
    `;
    const variables = { s: nomeAnime };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media[0] || null;
    } catch (error) {
      console.error('Erro na ligação à AniList:', error);
      return null;
    }
  }

  // Importa para o Catálogo Global e adiciona à lista do utilizador
  async importFromAniList(nomeAnime: string, userId: number) {
    const aniListData = await this.searchAniList(nomeAnime);
    if (!aniListData) throw new Error('Anime não encontrado na AniList');

    const topTags = aniListData.tags ? aniListData.tags.slice(0, 5).map((tag: any) => tag.name).join(', ') : '';
    const generosComTags = `${aniListData.genres ? aniListData.genres.join(', ') : ''}, ${topTags}`;
    const descricaoLimpa = aniListData.description ? aniListData.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.";

    // 1. Upsert no Catálogo Global (Anime)
    const anime = await this.prisma.anime.upsert({
      where: { id: aniListData.id },
      update: {
        numEpisodiosTotal: aniListData.episodes,
        capaUrl: aniListData.coverImage.large,
        statusLancamento: aniListData.status,
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
      },
    });

    // 2. Criar ou obter a relação na lista pessoal (UserAnime)
    return this.prisma.userAnime.upsert({
      where: {
        userId_animeId: { userId, animeId: anime.id },
      },
      update: {}, // Mantém o progresso se já existir
      create: {
        userId,
        animeId: anime.id,
        status: 'PLANNED',
        epAtual: 0,
      },
      include: { anime: true }
    });
  }

  // Pesquisa simplificada para a interface (devolve 10 resultados)
  async searchAnimeList(nomeAnime: string) {
    const query = `
      query ($s: String) {
        Page(perPage: 10) {
          media(search: $s, type: ANIME, sort: SEARCH_MATCH) {
            id
            title { romaji english }
            coverImage { large }
            status
          }
        }
      }
    `;
    const variables = { s: nomeAnime.trim() };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      console.error('Erro no fetch:', error);
      return [];
    }
  }

  // Retorna a lista pessoal do utilizador
  async findAll(userId: number) {
    const list = await this.prisma.userAnime.findMany({
      where: { userId },
      include: { anime: true }
    });

    // Mapear para o formato que o frontend espera
    return list.map(item => ({
      id: item.id,
      animeId: item.animeId,
      titulo: item.anime.titulo,
      statusLancamento: item.anime.statusLancamento,
      capaUrl: item.anime.capaUrl,
      generos: item.anime.generos,
      descricao: item.anime.descricao,
      status: this.mapStatus(item.status, 'anime'),
      epAtual: item.epAtual,
      numEpisodiosTotal: item.anime.numEpisodiosTotal,
      temporada: item.anime.temporada,
      ano: item.anime.ano
    }));
  }

  // Retorna um item da lista pessoal
  async findOne(id: number) {
    const item = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true }
    });
    if (!item) return null;

    return {
      id: item.id,
      animeId: item.animeId,
      titulo: item.anime.titulo,
      statusLancamento: item.anime.statusLancamento,
      capaUrl: item.anime.capaUrl,
      generos: item.anime.generos,
      descricao: item.anime.descricao,
      status: this.mapStatus(item.status, 'anime'),
      epAtual: item.epAtual,
      numEpisodiosTotal: item.anime.numEpisodiosTotal,
      temporada: item.anime.temporada,
      ano: item.anime.ano
    };
  }

  // Atualiza o progresso na lista pessoal
  async update(id: number, updateDto: any) {
    const atual = await this.prisma.userAnime.findUnique({
      where: { id },
      include: { anime: true }
    });
    if (!atual) return null;

    let novosDados = { ...updateDto };

    if (updateDto.epAtual !== undefined) {
      const ep = updateDto.epAtual;
      if (atual.status === 'PLANNED' && ep > 0) novosDados.status = 'WATCHING';
      if (atual.anime.numEpisodiosTotal && ep >= atual.anime.numEpisodiosTotal) {
        novosDados.status = 'COMPLETED';
        novosDados.epAtual = atual.anime.numEpisodiosTotal;
      }
      if (ep < 0) novosDados.epAtual = 0;
    }

    const updated = await this.prisma.userAnime.update({
      where: { id },
      data: novosDados,
      include: { anime: true }
    });

    return {
      id: updated.id,
      animeId: updated.animeId,
      titulo: updated.anime.titulo,
      statusLancamento: updated.anime.statusLancamento,
      capaUrl: updated.anime.capaUrl,
      generos: updated.anime.generos,
      descricao: updated.anime.descricao,
      status: this.mapStatus(updated.status, 'anime'),
      epAtual: updated.epAtual,
      numEpisodiosTotal: updated.anime.numEpisodiosTotal,
      temporada: updated.anime.temporada,
      ano: updated.anime.ano
    };
  }

  private mapStatus(status: string, type: 'anime' | 'manga') {
    const mapping = {
      PLANNED: 'Planeado',
      WATCHING: type === 'anime' ? 'Assistindo' : 'Lendo',
      COMPLETED: 'Completo',
      PAUSED: 'Pausado',
      DROPPED: 'Dropado'
    };
    return mapping[status] || status;
  }

  // Remove apenas da lista pessoal, mantém no catálogo global
  remove(id: number) {
    return this.prisma.userAnime.delete({
      where: { id },
    });
  }
}