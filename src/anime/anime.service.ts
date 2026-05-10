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
        Media(search: $search, type: ANIME) {
          title { english romaji }
          status
          episodes
          season
          seasonYear
          genres
          tags { name rank }
          description
          coverImage { large }
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