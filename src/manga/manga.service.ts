import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MangaService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Busca dados detalhados da AniList (Manga)
  async searchAniListManga(nomeManga: string) {
    // ... (mesmo código da query)
    const query = `
      query ($s: String) {
        Page(perPage: 1) {
          media(search: $s, type: MANGA, sort: SEARCH_MATCH) {
            id
            title { english romaji }
            status
            chapters
            genres
            tags { name rank }
            description
            coverImage { large }
          }
        }
      }
    `;
    const variables = { s: nomeManga };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json() as any;
      return result?.data?.Page?.media[0] || null;
    } catch (error) {
      console.error('Erro na ligação à AniList:', error);
      return null;
    }
  }


  // 2. Importa para o Catálogo Global e adiciona à lista do utilizador
  async importFromAniList(nomeManga: string, userId: number) {
    const aniListData = await this.searchAniListManga(nomeManga);
    if (!aniListData) throw new Error('Manga não encontrado na AniList');

    const topTags = aniListData.tags ? aniListData.tags.slice(0, 5).map((tag: any) => tag.name).join(', ') : '';
    const generosComTags = `${aniListData.genres ? aniListData.genres.join(', ') : ''}, ${topTags}`;
    const descricaoLimpa = aniListData.description ? aniListData.description.replace(/<[^>]*>?/gm, '') : "Sem descrição disponível.";

    // 1. Upsert no Catálogo Global (Manga)
    const manga = await this.prisma.manga.upsert({
      where: { id: aniListData.id },
      update: {
        numCapitulosTotal: aniListData.chapters,
        capaUrl: aniListData.coverImage.large,
        statusLancamento: aniListData.status,
      },
      create: {
        id: aniListData.id,
        titulo: aniListData.title.english || aniListData.title.romaji,
        statusLancamento: aniListData.status,
        generos: generosComTags,
        descricao: descricaoLimpa,
        numCapitulosTotal: aniListData.chapters,
        capaUrl: aniListData.coverImage.large,
      },
    });

    // 2. Criar ou obter a relação na lista pessoal (UserManga)
    return this.prisma.userManga.upsert({
      where: {
        userId_mangaId: { userId, mangaId: manga.id },
      },
      update: {},
      create: {
        userId,
        mangaId: manga.id,
        status: 'PLANNED',
        capAtual: 0,
        prioridade: 5,
      },
      include: { manga: true }
    });
  }

  // 3. Pesquisa simplificada para a interface
  async searchMangaList(nomeManga: string) {
    const query = `
      query ($s: String) {
        Page(page: 1, perPage: 10) {
          media(search: $s, type: MANGA, sort: SEARCH_MATCH) {
            id
            title { english romaji }
            coverImage { large }
            status
          }
        }
      }
    `;
    const variables = { s: nomeManga };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json() as any;
      return result?.data?.Page?.media || [];
    } catch (error) {
      console.error('Erro fetch manga:', error);
      return [];
    }
  }

  // Retorna a lista pessoal do utilizador
  async findAll(userId: number) {
    const list = await this.prisma.userManga.findMany({
      where: { userId },
      include: { manga: true }
    });

    return list.map(item => ({
      id: item.id,
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      capaUrl: item.manga.capaUrl,
      generos: item.manga.generos,
      descricao: item.manga.descricao,
      status: item.status,
      capAtual: item.capAtual,
      numCapitulosTotal: item.manga.numCapitulosTotal,
      prioridade: item.prioridade,
      statusLancamento: item.manga.statusLancamento,
      proximoCapituloData: item.manga.proximoCapituloData,
      proximoCapituloNumero: item.manga.proximoCapituloNumero
    }));
  }

  // Retorna um item da lista pessoal
  async findOne(id: number) {
    const item = await this.prisma.userManga.findUnique({
      where: { id },
      include: { manga: true }
    });
    if (!item) return null;

    return {
      id: item.id,
      mangaId: item.mangaId,
      titulo: item.manga.titulo,
      capaUrl: item.manga.capaUrl,
      generos: item.manga.generos,
      descricao: item.manga.descricao,
      status: item.status,
      capAtual: item.capAtual,
      numCapitulosTotal: item.manga.numCapitulosTotal,
      prioridade: item.prioridade,
      statusLancamento: item.manga.statusLancamento,
      proximoCapituloData: item.manga.proximoCapituloData,
      proximoCapituloNumero: item.manga.proximoCapituloNumero
    };
  }

  // Atualiza o progresso na lista pessoal
  async update(id: number, updateDto: any) {
    const atual = await this.prisma.userManga.findUnique({
      where: { id },
      include: { manga: true }
    });
    if (!atual) return null;

    let novosDados = { ...updateDto };

    if (updateDto.capAtual !== undefined) {
      const cap = updateDto.capAtual;
      if (atual.status === 'PLANNED' && cap > 0) novosDados.status = 'WATCHING';
      if (atual.manga.numCapitulosTotal && cap >= atual.manga.numCapitulosTotal) {
        novosDados.status = 'COMPLETED';
        novosDados.capAtual = atual.manga.numCapitulosTotal;
      }
      if (cap < 0) novosDados.capAtual = 0;
    }

    const updated = await this.prisma.userManga.update({
      where: { id },
      data: novosDados,
      include: { manga: true }
    });

    return {
      id: updated.id,
      mangaId: updated.mangaId,
      titulo: updated.manga.titulo,
      capaUrl: updated.manga.capaUrl,
      generos: updated.manga.generos,
      descricao: updated.manga.descricao,
      status: updated.status,
      capAtual: updated.capAtual,
      numCapitulosTotal: updated.manga.numCapitulosTotal,
      prioridade: updated.prioridade,
      statusLancamento: updated.manga.statusLancamento
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

  // Remove apenas da lista pessoal
  remove(id: number) {
    return this.prisma.userManga.delete({
      where: { id },
    });
  }

  // Busca itens populares por género
  async searchByGenre(genre: string) {
    const query = `
      query ($g: String) {
        Page(perPage: 24) {
          media(genre: $g, type: MANGA, sort: POPULARITY_DESC) {
            id
            title { english romaji }
            coverImage { large }
            genres
          }
        }
      }
    `;
    const variables = { g: genre };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json() as any;
      return result?.data?.Page?.media || [];
    } catch (error) {
      console.error('Erro ao buscar por género na AniList:', error);
      return [];
    }
  }
}