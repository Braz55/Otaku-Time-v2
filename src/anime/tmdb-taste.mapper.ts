// Normalizador de géneros e palavras-chave do TMDB para o motor de recomendações de anime.
//
// O TMDB não tem o par géneros/tags da AniList: tem géneros com IDs diferentes para séries e
// para filmes (alguns compostos, como "Action & Adventure") e palavras-chave livres. Este
// ficheiro traduz o que está guardado em Anime.generos para um vocabulário único de "gostos":
//   - géneros canónicos (as chaves de TMDB_CANONICAL_GENRES);
//   - palavras-chave, em minúsculas.
// Só é usado pelos animes. O manga continua a usar os géneros/tags da AniList tal como vêm.

export type TmdbMedium = 'tv' | 'movie';

// ID da Animação, igual em séries e filmes. É a base de todas as pesquisas de anime.
export const TMDB_ANIMATION_GENRE_ID = 16;

// Género canónico → ID no TMDB em cada tipo. Há géneros que só existem num dos tipos
// (por exemplo, o TMDB não tem Romance nem Terror nas séries).
export const TMDB_CANONICAL_GENRES: Record<
  string,
  { tv?: number; movie?: number }
> = {
  Action: { tv: 10759, movie: 28 },
  Adventure: { tv: 10759, movie: 12 },
  Comedy: { tv: 35, movie: 35 },
  Crime: { tv: 80, movie: 80 },
  Documentary: { tv: 99, movie: 99 },
  Drama: { tv: 18, movie: 18 },
  Family: { tv: 10751, movie: 10751 },
  Fantasy: { tv: 10765, movie: 14 },
  History: { movie: 36 },
  Horror: { movie: 27 },
  Kids: { tv: 10762 },
  Music: { movie: 10402 },
  Mystery: { tv: 9648, movie: 9648 },
  Romance: { movie: 10749 },
  'Sci-Fi': { tv: 10765, movie: 878 },
  Thriller: { movie: 53 },
  War: { tv: 10768, movie: 10752 },
  Western: { tv: 37, movie: 37 },
};

// Nomes com que um género pode estar guardado (inglês e português do TMDB, nomes compostos
// das séries) → géneros canónicos. As chaves estão em minúsculas.
const GENRE_ALIASES: Record<string, string[]> = {
  'action & adventure': ['Action', 'Adventure'],
  'sci-fi & fantasy': ['Sci-Fi', 'Fantasy'],
  'war & politics': ['War'],
  'science fiction': ['Sci-Fi'],
  ação: ['Action'],
  aventura: ['Adventure'],
  'ação e aventura': ['Action', 'Adventure'],
  comédia: ['Comedy'],
  documentário: ['Documentary'],
  família: ['Family'],
  fantasia: ['Fantasy'],
  'ficção científica': ['Sci-Fi'],
  'ficção científica e fantasia': ['Sci-Fi', 'Fantasy'],
  história: ['History'],
  terror: ['Horror'],
  música: ['Music'],
  mistério: ['Mystery'],
  suspense: ['Thriller'],
  guerra: ['War'],
  'guerra e política': ['War'],
  faroeste: ['Western'],
};
for (const name of Object.keys(TMDB_CANONICAL_GENRES)) {
  GENRE_ALIASES[name.toLowerCase()] = [name];
}

// Chaves que não dizem nada sobre o gosto: todos os animes são animação, e o formato
// (filme/série) não é um tema. As últimas são palavras-chave do TMDB sobre a origem da obra.
const NOISE = new Set([
  'animation',
  'animação',
  'anime',
  'movie',
  'filme',
  'tv show',
  'série',
  'tv movie',
  'reality',
  'soap',
  'news',
  'talk',
  'based on manga',
  'based on light novel',
  'based on web novel',
  'based on novel or book',
  'based on video game',
  'based on comic',
  'adult animation',
]);

const cleanKey = (key: string) =>
  key.replace(/​/g, '').trim().toLowerCase();

export function isTmdbGenre(taste: string): boolean {
  return TMDB_CANONICAL_GENRES[taste] !== undefined;
}

// ID do género canónico num tipo de obra; undefined quando o TMDB não o tem nesse tipo.
export function tmdbGenreId(
  taste: string,
  medium: TmdbMedium,
): number | undefined {
  return TMDB_CANONICAL_GENRES[taste]?.[medium];
}

// genre_ids de um resultado do TMDB → géneros canónicos (um ID composto dá vários).
export function tmdbGenreNamesFromIds(
  ids: number[] | undefined,
  medium: TmdbMedium,
): string[] {
  if (!ids) return [];
  const names: string[] = [];
  for (const [name, byMedium] of Object.entries(TMDB_CANONICAL_GENRES)) {
    const id = byMedium[medium];
    if (id !== undefined && ids.includes(id)) names.push(name);
  }
  return names;
}

// Anime.generos (dicionário nome → peso, ou texto separado por vírgulas nos registos antigos)
// → dicionário de gostos canónicos. Quando vários nomes dão o mesmo gosto fica o maior peso.
export function normalizeTmdbTastes(generos: unknown): Record<string, number> {
  const raw: Record<string, unknown> = {};
  if (typeof generos === 'string') {
    generos.split(',').forEach((g) => {
      raw[g] = 100;
    });
  } else if (generos && typeof generos === 'object' && !Array.isArray(generos)) {
    Object.assign(raw, generos);
  }

  const tastes: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const clean = cleanKey(key);
    if (!clean || NOISE.has(clean)) continue;
    const weight = typeof value === 'number' ? value : 100;
    for (const taste of GENRE_ALIASES[clean] ?? [clean]) {
      tastes[taste] = Math.max(tastes[taste] ?? 0, weight);
    }
  }
  return tastes;
}

// Peso das palavras-chave ao guardar uma obra. O TMDB não lhes dá relevância (a AniList dá
// um rank às tags), por isso ficam todas um pouco abaixo dos géneros (100).
export const TMDB_KEYWORD_WEIGHT = 80;
const MAX_KEYWORDS_PER_WORK = 10;

// Palavras-chave de uma resposta de detalhes do TMDB (pedida com append_to_response=keywords),
// no formato { name, rank } que buildGenerosDict espera. As séries trazem-nas em
// keywords.results e os filmes em keywords.keywords.
export function extractTmdbKeywordTags(
  media: any,
): { name: string; rank: number }[] {
  const list = media?.keywords?.results ?? media?.keywords?.keywords;
  if (!Array.isArray(list)) return [];
  const tags: { name: string; rank: number }[] = [];
  for (const keyword of list) {
    const clean = typeof keyword?.name === 'string' ? cleanKey(keyword.name) : '';
    // Um género repetido como palavra-chave não acrescenta nada ao que já vem em genres
    if (!clean || NOISE.has(clean) || GENRE_ALIASES[clean]) continue;
    const name = clean
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    tags.push({ name, rank: TMDB_KEYWORD_WEIGHT });
    if (tags.length === MAX_KEYWORDS_PER_WORK) break;
  }
  return tags;
}

export interface TasteItem {
  tastes: Record<string, number>;
  status: string;
}

export interface TasteProfile {
  // Pontuação acumulada de cada gosto na biblioteca
  scores: Record<string, number>;
  // Até três perfis temáticos: um gosto âncora e os que mais aparecem com ele
  profiles: string[][];
}

const statusMultiplier = (status: string) => {
  if (status === 'COMPLETED') return 1.5;
  if (status === 'DROPPED') return 0.3;
  if (status === 'PAUSED') return 0.5;
  return 1.0;
};

// Mesma ideia do motor do manga (gostos pesados pelo estado da obra, perfis por coocorrência),
// escrita à parte para as duas fontes poderem evoluir sem se afetarem.
export function buildTasteProfile(items: TasteItem[]): TasteProfile {
  const scores: Record<string, number> = {};
  for (const item of items) {
    const multiplier = statusMultiplier(item.status);
    for (const [taste, weight] of Object.entries(item.tastes)) {
      scores[taste] = (scores[taste] ?? 0) + weight * multiplier;
    }
  }

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([taste]) => taste);

  const profileFor = (anchor: string, exclude: string[]) => {
    const together: Record<string, number> = {};
    for (const item of items) {
      if (!item.tastes[anchor]) continue;
      const multiplier = statusMultiplier(item.status);
      for (const [taste, weight] of Object.entries(item.tastes)) {
        if (taste === anchor) continue;
        together[taste] = (together[taste] ?? 0) + weight * multiplier;
      }
    }
    const companions = Object.entries(together)
      .filter(([taste]) => !exclude.includes(taste))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([taste]) => taste);
    return [anchor, ...companions];
  };

  const profiles: string[][] = [];
  for (const anchor of ranked.slice(0, 3)) {
    profiles.push(profileFor(anchor, profiles.flat()));
  }
  return { scores, profiles };
}
