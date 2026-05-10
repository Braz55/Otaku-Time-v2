import { Injectable } from '@nestjs/common';
import { CreateMangaDto } from './dto/create-manga.dto';
import { PrismaService } from '../prisma/prisma.service'; // A nossa ponte

@Injectable()
export class MangaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMangaDto: CreateMangaDto) {
    // Dizemos ao Prisma para guardar o Manga com os dados que vieram do Thunder Client
    return this.prisma.manga.create({
      data: createMangaDto,
    });
  }

  // 1. A função que faz o pedido GraphQL focado em MANGA
  async searchAniListManga(nomeManga: string) {
    const query = `
      query ($search: String) {
        Media(search: $search, type: MANGA) {
          title { english romaji }
          status
          chapters
          genres
          tags { name rank }
          description
          coverImage { large }
        }
      }
    `;

    const variables = { search: nomeManga };

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

  // 2. A função que formata e grava na tua Base de Dados
  async importFromAniList(nomeManga: string, userId: number) {
    const aniListData = await this.searchAniListManga(nomeManga);

    if (!aniListData) {
      throw new Error('Manga não encontrado na AniList');
    }

    // Juntar os géneros e as 5 melhores tags
    const topTags = aniListData.tags.slice(0, 5).map((tag: any) => tag.name).join(', ');
    const generosComTags = `${aniListData.genres.join(', ')}, ${topTags}`;

    // Limpar o HTML da descrição
    const descricaoLimpa = aniListData.description ? aniListData.description.replace(/<[^>]*>?/gm, '') : "Sem descrição disponível.";

    // Mapear para o formato da tua tabela de Manga
    const novoManga = {
      titulo: aniListData.title.english || aniListData.title.romaji,
      statusLancamento: aniListData.status,
      generos: generosComTags,
      descricao: descricaoLimpa,
      numCapitulosTotal: aniListData.chapters, // Aqui usamos os capítulos!
      capaUrl: aniListData.coverImage.large,
      userId: userId,
      statusLeitura: "Planeado",
      capAtual: 0,
      prioridade: 5, // Uma prioridade padrão
    };

    return this.prisma.manga.create({
      data: novoManga,
    });
  }

  // 3. NOVA FUNÇÃO: Devolve uma LISTA de 10 Mangas para a interface de pesquisa
  async searchMangaList(nomeManga: string) {
    console.log('--- PESQUISA MANGA ---');
    const query = `
      query ($s: String) {
        Page(page: 1, perPage: 10) {
          media(search: $s, type: MANGA) {
            id
            title { english romaji }
            coverImage { large }
          }
        }
      }
    `;

    const variables = { s: nomeManga };

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

      const result = await response.json() as any;
      console.log('Resposta AniList (Manga):', JSON.stringify(result));
      
      if (result.errors) {
        console.error('Erro AniList:', result.errors);
        return [];
      }
      return result?.data?.Page?.media || [];
    } catch (error) {
      console.error('Erro fetch manga:', error);
      return [];
    }
  }

  findAll() {
    // Já deixamos o findAll a funcionar para poderes ver a tua lista toda depois
    return this.prisma.manga.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} manga`;
  }

  update(id: number, updateDto: any) {
    return `This action updates a #${id} manga`;
  }

  remove(id: number) {
    return `This action removes a #${id} manga`;
  }
}