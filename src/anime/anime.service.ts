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
      query ($search: String) {
        Page(perPage: 10) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
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
          }
        }
      }
    `;

    const variables = { search: nomeAnime };

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.ANILIST_TOKEN}`,
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();
      
      // Se a AniList devolver erros no JSON
      if (result.errors) {
        console.error('Erro na AniList:', result.errors);
        return null;
      }

      return result.data.Media;
    } catch (error) {
      console.error('Erro na ligação à AniList:', error);
      return null;
    }
  }

  // NOVA FUNÇÃO: Vai à AniList e GRAVA na tua base de dados automaticamente!
  async importFromAniList(nomeAnime: string, userId: number) {
    // 1. Vai buscar os dados à AniList usando a função que já temos
    const aniListData = await this.searchAniList(nomeAnime);

    if (!aniListData) {
      throw new Error('Anime não encontrado na AniList');
    }

    // 2. Vamos juntar os Géneros e as 5 melhores Tags para a tua IA ler depois
    const topTags = aniListData.tags.slice(0, 5).map((tag: any) => tag.name).join(', ');
    const generosComTags = `${aniListData.genres.join(', ')}, ${topTags}`;

    // 3. Limpar as tags de HTML (<br>) da descrição da AniList
    const descricaoLimpa = aniListData.description.replace(/<[^>]*>?/gm, '');

    // 4. Mapear os dados da AniList para o formato do teu DTO/Prisma
    const novoAnime = {
      titulo: aniListData.title.english || aniListData.title.romaji,
      statusLancamento: aniListData.status,
      generos: generosComTags,
      descricao: descricaoLimpa,
      numEpisodiosTotal: aniListData.episodes,
      capaUrl: aniListData.coverImage.large,
      userId: userId, // Ligamos ao teu utilizador (ID 1)
      statusVisualizacao: "Planeado",
      epAtual: 0,
      temporada: aniListData.season,
      ano: aniListData.seasonYear,
    };

    // 5. Mandar o Prisma gravar!
    return this.prisma.anime.create({
      data: novoAnime,
    });
  }

  
  // NOVA FUNÇÃO: Devolve uma LISTA de 10 Animes para a interface
  async searchAnimeList(nomeAnime: string) {
    // 1. Limpa o nome
    const termo = nomeAnime.trim();

    // 2. Query simplificada ao máximo (exatamente como nos exemplos da doc)
    const query = `
    {
      Page(perPage: 10) {
        media(search: "${termo}", type: ANIME) {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
          }
        }
      }
    }
    `;

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.ANILIST_TOKEN}`,
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({ query }), // Enviamos apenas a query string
      });

      const result = await response.json();

      // Este log vai mostrar se a AniList deu erro de sintaxe
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