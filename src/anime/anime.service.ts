import { Injectable } from '@nestjs/common';
import { CreateAnimeDto } from './dto/create-anime.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnimeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAnimeDto: CreateAnimeDto) {
    return this.prisma.anime.create({
      data: createAnimeDto,
    });
  }



  // NOVA FUNÇÃO: Vai buscar dados à AniList!
  async searchAniList(nomeAnime: string) {
    const query = `
      query ($s: String) {
        Page(perPage: 1) {
          media(search: $s, type: ANIME, sort: SEARCH_MATCH) {
            id
            title {
              english
              romaji
              native
            }
            coverImage {
              large
            }
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
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();
      
      if (result.errors) {
        console.error('Erro na AniList:', result.errors);
        return null;
      }

      return result?.data?.Page?.media[0] || null;
    } catch (error) {
      console.error('Erro na ligação à AniList:', error);
      return null;
    }
  }

  // NOVA FUNÇÃO: Vai à AniList e GRAVA na tua base de dados automaticamente!
  async importFromAniList(nomeAnime: string, userId: number) {
    const aniListData = await this.searchAniList(nomeAnime);

    if (!aniListData) {
      throw new Error('Anime não encontrado na AniList');
    }

    const topTags = aniListData.tags ? aniListData.tags.slice(0, 5).map((tag: any) => tag.name).join(', ') : '';
    const generosComTags = `${aniListData.genres ? aniListData.genres.join(', ') : ''}, ${topTags}`;

    const descricaoLimpa = aniListData.description ? aniListData.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.";

    const novoAnime = {
      titulo: aniListData.title.english || aniListData.title.romaji,
      statusLancamento: aniListData.status,
      generos: generosComTags,
      descricao: descricaoLimpa,
      numEpisodiosTotal: aniListData.episodes,
      capaUrl: aniListData.coverImage.large,
      userId: userId,
      statusVisualizacao: "Planeado",
      epAtual: 0,
      temporada: aniListData.season,
      ano: aniListData.seasonYear,
    };

    return this.prisma.anime.create({
      data: novoAnime,
    });
  }

  
  // NOVA FUNÇÃO: Devolve uma LISTA de 10 Animes para a interface
  async searchAnimeList(nomeAnime: string) {
    const termo = nomeAnime.trim();

    const query = `
      query ($s: String) {
        Page(perPage: 10) {
          media(search: $s, type: ANIME, sort: SEARCH_MATCH) {
            id
            title {
              romaji
              english
            }
            coverImage {
              large
            }
            status
          }
        }
      }
    `;

    const variables = { s: termo };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();

      console.log('--- RESPOSTA ANILIST ---');
      console.log(JSON.stringify(result, null, 2));

      if (result.data && result.data.Page) {
        return result.data.Page.media;
      }
      
      return [];
    } catch (error) {
      console.error('Erro no fetch:', error);
      return [];
    }
  }

  findAll() {
    return this.prisma.anime.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} anime`;
  }

  update(id: number, updateDto: any) {
    return `This action updates a #${id} anime`;
  }

  remove(id: number) {
    return `This action removes a #${id} anime`;
  }
}