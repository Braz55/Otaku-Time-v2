import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TMDBService } from './tmdb.service';
import { TMDB_STATIC_KEYWORDS } from './anime.utils';
import {
  TMDB_ANIMATION_GENRE_ID,
  TMDB_CANONICAL_GENRES,
  TmdbMedium,
  buildTasteProfile,
  isTmdbGenre,
  normalizeTmdbTastes,
  tmdbGenreId,
  tmdbGenreNamesFromIds,
} from './tmdb-taste.mapper';

// Língua original a pedir ao TMDB conforme o país mais frequente na biblioteca. Por omissão
// japonês, como na página Explorar.
const LANGUAGE_BY_COUNTRY: Record<string, string> = {
  JP: 'ja',
  CN: 'zh',
  KR: 'ko',
};

const PER_PAGE = 24;
// Abaixo disto, uma pesquisa com palavras-chave é completada com outra só pelo género
const MIN_POOL_SIZE = 10;

export interface AnimeCandidate {
  id: number;
  fonte: 'TMDB_TV' | 'TMDB_MOVIE';
  title: { english: string; romaji: string; native: string };
  coverImage: { large: string };
  genres: string[];
  averageScore: number | null;
  description: string;
  format: 'TV' | 'MOVIE';
  status: string;
  tipo: 'ANIME';
  popularity: number;
}

interface PoolQuery {
  tastes: string[];
  sortBy: 'popularity.desc' | 'vote_average.desc';
}

// Recomendações de anime, só com dados do TMDB: o gosto vem dos géneros e palavras-chave
// guardados em Anime.generos e os candidatos vêm do /discover do TMDB, com IDs do TMDB.
// As recomendações de manga (AniList) vivem no RecommendationService e não passam por aqui.
@Injectable()
export class AnimeRecommendationService {
  private readonly logger = new Logger(AnimeRecommendationService.name);
  // Palavra-chave (minúsculas) → ID no TMDB; null quando o TMDB não a tem
  private readonly keywordIds = new Map<string, number | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdbService: TMDBService,
  ) {}

  async getRecommendations(
    userId: number,
    page: number = 1,
  ): Promise<AnimeCandidate[]> {
    const userAnimes = await this.prisma.userAnime.findMany({
      where: { userId },
      include: { anime: true },
    });

    const libraryKeys = new Set(
      userAnimes.map((ua) => `${ua.animeFonte}:${ua.animeId}`),
    );
    const libraryTitles = new Set(
      userAnimes
        .map((ua) => ua.anime?.titulo?.toLowerCase())
        .filter((t): t is string => !!t),
    );

    const { scores, profiles } = buildTasteProfile(
      userAnimes.map((ua) => ({
        tastes: normalizeTmdbTastes(ua.anime?.generos),
        status: ua.status,
      })),
    );

    const language = this.preferredLanguage(
      userAnimes.map((ua) => ua.anime?.paisOrigem),
    );
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const includeAdult = !!user?.showAdultContent;

    const discovery = this.discoveryGenre(scores, userId);
    this.logger.debug(
      `User ${userId}: perfis ${JSON.stringify(profiles)}, descoberta ${discovery ?? 'nenhuma'}, língua ${language}`,
    );

    const fetchPool = (query: PoolQuery) =>
      this.fetchPool(query, language, includeAdult);

    const [pool1, pool2, pool3, poolDiscovery, poolGlobal] = await Promise.all([
      profiles[0]
        ? fetchPool({ tastes: profiles[0], sortBy: 'popularity.desc' })
        : [],
      profiles[1]
        ? fetchPool({ tastes: profiles[1], sortBy: 'popularity.desc' })
        : [],
      profiles[2]
        ? fetchPool({ tastes: profiles[2], sortBy: 'vote_average.desc' })
        : [],
      discovery
        ? fetchPool({ tastes: [discovery], sortBy: 'popularity.desc' })
        : [],
      fetchPool({ tastes: [], sortBy: 'popularity.desc' }),
    ]);

    // Um candidato de cada grupo à vez, para a página misturar os vários perfis
    const pools = [pool1, pool2, pool3, poolGlobal, poolDiscovery];
    const longest = Math.max(...pools.map((p) => p.length));
    const candidates: AnimeCandidate[] = [];
    const added = new Set<string>();
    for (let i = 0; i < longest; i++) {
      for (const pool of pools) {
        const item = pool[i];
        if (!item) continue;
        const key = `${item.fonte}:${item.id}`;
        if (
          added.has(key) ||
          libraryKeys.has(key) ||
          libraryTitles.has(item.title.english.toLowerCase()) ||
          libraryTitles.has(item.title.native.toLowerCase())
        ) {
          continue;
        }
        added.add(key);
        candidates.push(item);
      }
    }

    const start = (page - 1) * PER_PAGE;
    return candidates.slice(start, start + PER_PAGE);
  }

  private preferredLanguage(countries: (string | null | undefined)[]): string {
    const counts: Record<string, number> = {};
    for (const country of countries) {
      if (country) counts[country] = (counts[country] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return (top && LANGUAGE_BY_COUNTRY[top]) || 'ja';
  }

  // Um género que o utilizador ainda não explorou. Muda de dia para dia, mas é o mesmo em
  // todas as páginas pedidas no mesmo dia, para a paginação não repetir nem saltar obras.
  private discoveryGenre(
    scores: Record<string, number>,
    userId: number,
  ): string | undefined {
    const unexplored = Object.keys(TMDB_CANONICAL_GENRES).filter(
      (genre) => !scores[genre],
    );
    if (unexplored.length === 0) return undefined;
    const day = Math.floor(Date.now() / 86_400_000);
    return unexplored[(day + userId) % unexplored.length];
  }

  private async fetchPool(
    query: PoolQuery,
    language: string,
    includeAdult: boolean,
  ): Promise<AnimeCandidate[]> {
    const genres = query.tastes.filter(isTmdbGenre);
    const keywords = query.tastes.filter((t) => !isTmdbGenre(t));

    const [tv, movie] = await Promise.all([
      this.discover('tv', genres, keywords, query.sortBy, language, includeAdult),
      this.discover(
        'movie',
        genres,
        keywords,
        query.sortBy,
        language,
        includeAdult,
      ),
    ]);

    const byProfile = (item: AnimeCandidate) =>
      genres.filter((g) => item.genres.includes(g)).length;
    return [...tv, ...movie].sort(
      (a, b) =>
        byProfile(b) - byProfile(a) ||
        (query.sortBy === 'vote_average.desc'
          ? (b.averageScore ?? 0) - (a.averageScore ?? 0)
          : b.popularity - a.popularity),
    );
  }

  // Uma pesquisa no /discover de um tipo de obra. O TMDB não deixa misturar "e" com "ou" no
  // mesmo parâmetro, por isso: Animação E o género principal do perfil, e as palavras-chave
  // do perfil ligadas por "ou". Os outros géneros do perfil só contam na ordenação.
  private async discover(
    medium: TmdbMedium,
    genres: string[],
    keywords: string[],
    sortBy: PoolQuery['sortBy'],
    language: string,
    includeAdult: boolean,
  ): Promise<AnimeCandidate[]> {
    const mainGenre = genres[0];
    const mainGenreId = mainGenre ? tmdbGenreId(mainGenre, medium) : undefined;
    // Género que o TMDB não tem neste tipo (Romance nas séries, por exemplo): procura-se a
    // palavra-chave com o mesmo nome.
    const keywordNames =
      mainGenre && mainGenreId === undefined
        ? [mainGenre.toLowerCase(), ...keywords]
        : keywords;
    const keywordIds = await this.resolveKeywordIds(keywordNames);
    if (mainGenre && mainGenreId === undefined && keywordIds.length === 0) {
      return [];
    }

    const base: Record<string, string> = {
      with_genres: [TMDB_ANIMATION_GENRE_ID, mainGenreId]
        .filter((id) => id !== undefined)
        .join(','),
      with_original_language: language,
      sort_by: sortBy,
      include_adult: String(includeAdult),
      page: '1',
    };
    if (sortBy === 'vote_average.desc') base['vote_count.gte'] = '100';

    const run = async (params: Record<string, string>) => {
      try {
        const data =
          medium === 'tv'
            ? await this.tmdbService.discoverTV(params)
            : await this.tmdbService.discoverMovies(params);
        return (data?.results ?? [])
          .filter((item: any) => item?.id && item.poster_path)
          .map((item: any) => this.toCandidate(item, medium));
      } catch (error: any) {
        this.logger.warn(
          `TMDB discover (${medium}) falhou: ${error?.message ?? error}`,
        );
        return [] as AnimeCandidate[];
      }
    };

    if (keywordIds.length === 0) return run(base);

    const withKeywords = await run({
      ...base,
      with_keywords: keywordIds.join('|'),
    });
    if (withKeywords.length >= MIN_POOL_SIZE || mainGenreId === undefined) {
      return withKeywords;
    }
    // Poucos resultados com as palavras-chave: completa só com o género
    const seen = new Set(withKeywords.map((c) => c.id));
    const byGenre = await run(base);
    return [...withKeywords, ...byGenre.filter((c) => !seen.has(c.id))];
  }

  private async resolveKeywordIds(names: string[]): Promise<number[]> {
    const ids = await Promise.all(names.map((n) => this.resolveKeywordId(n)));
    return [...new Set(ids.filter((id): id is number => id !== null))];
  }

  private async resolveKeywordId(name: string): Promise<number | null> {
    const staticId = TMDB_STATIC_KEYWORDS[name];
    if (staticId !== undefined) return staticId;
    const cached = this.keywordIds.get(name);
    if (cached !== undefined) return cached;
    try {
      const res = await this.tmdbService.searchKeywords(name);
      // Só o nome exato: a primeira sugestão do TMDB pode ser um tema diferente
      const exact = (res?.results ?? []).find(
        (r: any) => typeof r?.name === 'string' && r.name.toLowerCase() === name,
      );
      const id: number | null = exact?.id ?? null;
      this.keywordIds.set(name, id);
      return id;
    } catch (error: any) {
      // Falha temporária: não fica em cache, para voltar a tentar no próximo pedido
      this.logger.warn(
        `Não foi possível resolver a palavra-chave "${name}": ${error?.message ?? error}`,
      );
      return null;
    }
  }

  // Resultado do /discover → o formato que a página Explorar já recebe para os animes
  private toCandidate(item: any, medium: TmdbMedium): AnimeCandidate {
    const isMovie = medium === 'movie';
    const original = (isMovie ? item.original_title : item.original_name) || '';
    const title = (isMovie ? item.title : item.name) || original;
    return {
      id: item.id,
      fonte: isMovie ? 'TMDB_MOVIE' : 'TMDB_TV',
      title: { english: title, romaji: title, native: original },
      coverImage: {
        large: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      },
      genres: tmdbGenreNamesFromIds(item.genre_ids, medium),
      averageScore: item.vote_average
        ? Math.round(item.vote_average * 10)
        : null,
      description: item.overview || '',
      format: isMovie ? 'MOVIE' : 'TV',
      status: 'FINISHED',
      tipo: 'ANIME',
      popularity: item.popularity ?? 0,
    };
  }
}
