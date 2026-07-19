import { TMDBService } from './tmdb.service';

export const TMDB_GENRE_MAP: Record<string, string[]> = {
  Ação: ['Action'],
  'Ação e Aventura': ['Action', 'Adventure'],
  'Action & Adventure': ['Action', 'Adventure'],
  Aventura: ['Adventure'],
  Animação: ['Animation'],
  Animation: ['Animation'],
  Comédia: ['Comedy'],
  Comedy: ['Comedy'],
  Crime: ['Crime'],
  Documentário: ['Documentary'],
  Documentary: ['Documentary'],
  Drama: ['Drama'],
  Família: ['Family'],
  Family: ['Family'],
  Fantasia: ['Fantasy'],
  Fantasy: ['Fantasy'],
  'Ficção Científica': ['Sci-Fi'],
  'Ficção Científica e Fantasia': ['Sci-Fi', 'Fantasy'],
  'Sci-Fi & Fantasy': ['Sci-Fi', 'Fantasy'],
  História: ['History'],
  History: ['History'],
  Terror: ['Horror'],
  Horror: ['Horror'],
  Música: ['Music'],
  Music: ['Music'],
  Mistério: ['Mystery'],
  Mystery: ['Mystery'],
  Romance: ['Romance'],
  Suspense: ['Thriller'],
  Thriller: ['Thriller'],
  Guerra: ['War'],
  War: ['War'],
  'Guerra e Política': ['War', 'Drama'],
  'War & Politics': ['War', 'Drama'],
};

export const STANDARD_GENRES = new Set([
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
  'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western', 'Movie', 'Filme',
  'TV Show', 'Série', 'Animação', 'Ação', 'Aventura', 'Comédia', 'Documentário',
  'Família', 'Fantasia', 'Ficção Científica', 'História', 'Terror', 'Música',
  'Mistério', 'Suspense', 'Guerra', 'Faroeste', 'Action & Adventure', 'Ação e Aventura',
  'Sci-Fi & Fantasy', 'Ficção Científica e Fantasia', 'War & Politics', 'Guerra e Política',
  'Kids', 'Reality', 'Soap', 'Anime',
  'Ecchi', 'Hentai', 'Mahou Shoujo', 'Mecha', 'Psychological', 'Slice of Life', 'Sports', 'Supernatural'
]);

export function buildGenerosDict(
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

export function capitalizeKeyword(name: string): string {
  if (!name) return '';
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function hasGenreOrTag(generos: any, target: string): boolean {
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

export function hasNonLatin(text: string | null | undefined): boolean {
  if (!text) return false;
  // Detects Cyrillic, Greek, Hebrew, Arabic, Thai, Devanagari, Georgian, Armenian, and CJK (Chinese, Japanese, Korean) characters.
  return /[\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u0600-\u06FF\u0E00-\u0E7F\u0900-\u097F\u10A0-\u10FF\u0530-\u058F\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/.test(
    text,
  );
}

export function resolveLatinTitle(item: any, defaultTitle: string): string {
  // If the default title is already in Latin script, use it directly
  if (defaultTitle && !hasNonLatin(defaultTitle)) {
    return defaultTitle;
  }

  if (
    item &&
    item.translations &&
    Array.isArray(item.translations.translations)
  ) {
    const enTranslation = item.translations.translations.find(
      (t: any) => t.iso_639_1 === 'en',
    );
    const enName = enTranslation?.data?.name || enTranslation?.data?.title;
    if (enName && !hasNonLatin(enName)) {
      return enName;
    }

    const ptTranslation = item.translations.translations.find(
      (t: any) => t.iso_639_1 === 'pt',
    );
    const ptName = ptTranslation?.data?.name || ptTranslation?.data?.title;
    if (ptName && !hasNonLatin(ptName)) {
      return ptName;
    }

    for (const t of item.translations.translations) {
      const name = t.data?.name || t.data?.title;
      if (name && !hasNonLatin(name)) {
        return name;
      }
    }
  }
  return defaultTitle;
}

export async function resolveLatinTitleForSearchItem(
  tmdbService: TMDBService,
  item: any,
  defaultTitle: string,
  isMovie: boolean,
): Promise<string> {
  // If the default title is already in Latin script, use it directly
  if (defaultTitle && !hasNonLatin(defaultTitle)) {
    return defaultTitle;
  }

  try {
    const details = isMovie
      ? await tmdbService.getMovieDetails(item.id)
      : await tmdbService.getTVShowDetails(item.id);
    if (
      details &&
      details.translations &&
      Array.isArray(details.translations.translations)
    ) {
      const enTranslation = details.translations.translations.find(
        (t: any) => t.iso_639_1 === 'en',
      );
      const enName = enTranslation?.data?.name || enTranslation?.data?.title;
      if (enName && !hasNonLatin(enName)) {
        return enName;
      }

      const ptTranslation = details.translations.translations.find(
        (t: any) => t.iso_639_1 === 'pt',
      );
      const ptName = ptTranslation?.data?.name || ptTranslation?.data?.title;
      if (ptName && !hasNonLatin(ptName)) {
        return ptName;
      }

      for (const t of details.translations.translations) {
        const name = t.data?.name || t.data?.title;
        if (name && !hasNonLatin(name)) {
          return name;
        }
      }
    }
  } catch {
    // ignore
  }
  return defaultTitle;
}

export function normalizeTMDBToAniList(
  media: any,
  mediaTypeForce?: 'tv' | 'movie',
): any {
  if (!media) return null;
  const isMovie =
    mediaTypeForce === 'movie' ||
    media.title !== undefined ||
    media.media_type === 'movie';

  let title = isMovie
    ? media.title || media.original_title
    : media.name || media.original_name;
  title = resolveLatinTitle(media, title);
  const statusMap: Record<string, string> = {
    'Returning Series': 'RELEASING',
    Ended: 'FINISHED',
    Released: 'FINISHED',
    'Post Production': 'RELEASING',
    'In Production': 'RELEASING',
  };
  const status =
    statusMap[media.status] ||
    (media.status ? media.status.toUpperCase() : 'FINISHED');

  const releaseDate = isMovie ? media.release_date : media.first_air_date;
  const parsedYear = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const year = parsedYear && !isNaN(parsedYear) ? parsedYear : null;

  let dataLancamento: Date | null = null;
  if (releaseDate) {
    const parsedDate = new Date(
      releaseDate.includes('T') ? releaseDate : releaseDate + 'T12:00:00Z',
    );
    if (!isNaN(parsedDate.getTime())) {
      dataLancamento = parsedDate;
    }
  }

  const posterPath = media.poster_path
    ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
    : null;
  const format = isMovie ? 'MOVIE' : 'TV';

  const genres = media.genres ? media.genres.map((g: any) => g.name) : [];
  const tipo = detectMediaType(genres, format);

  return {
    id: media.id,
    dataLancamento,
    title: {
      english: title,
      romaji: title,
      native: isMovie ? media.original_title : media.original_name,
    },
    coverImage: {
      large: posterPath,
    },
    averageScore: media.vote_average
      ? Math.round(media.vote_average * 10)
      : null,
    status,
    description: media.overview || 'Sem descrição.',
    genres,
    tags: [],
    episodes: isMovie ? 1 : media.number_of_episodes || null,
    season: isMovie ? 'MOVIE' : year ? 'YEAR' : null,
    seasonYear: year,
    countryOfOrigin: media.origin_country
      ? media.origin_country[0]
      : media.production_countries
        ? media.production_countries[0]?.iso_3166_1
        : null,
    format,
    tipo,
    source: 'TMDB',
    externalLinks: [],
    nextAiringEpisode:
      media.next_episode_to_air && media.next_episode_to_air.air_date
        ? (() => {
            const time = new Date(
              media.next_episode_to_air.air_date + 'T12:00:00Z',
            ).getTime();
            return isNaN(time)
              ? null
              : {
                  airingAt: Math.round(time / 1000),
                  episode: media.next_episode_to_air.episode_number,
                };
          })()
        : null,
    number_of_seasons: media.number_of_seasons || 1,
    seasons: media.seasons || [],
  };
}

export function detectMediaType(
  genresJson: any,
  format?: string | null,
): 'ANIME' | 'SERIE' | 'FILME' {
  let isAnimation = false;

  if (genresJson) {
    let genresList: string[] = [];
    if (Array.isArray(genresJson)) {
      genresList = genresJson.map((g: any) =>
        typeof g === 'object' ? g.name : String(g),
      );
    } else if (typeof genresJson === 'object') {
      genresList = Object.keys(genresJson);
    } else if (typeof genresJson === 'string') {
      try {
        const parsed = JSON.parse(genresJson);
        if (Array.isArray(parsed)) {
          genresList = parsed;
        } else if (typeof parsed === 'object') {
          genresList = Object.keys(parsed);
        }
      } catch {
        genresList = genresJson.split(',').map((g: string) => g.trim());
      }
    }

    isAnimation = genresList.some((g: string) => {
      const lower = g.toLowerCase();
      return lower === 'anime' || lower === 'animation' || lower === 'animação';
    });
  }

  if (isAnimation) {
    return 'ANIME';
  }

  if (format?.toUpperCase() === 'MOVIE') {
    return 'FILME';
  }

  return 'SERIE';
}

export const TMDB_GENRE_ID_TO_NAME: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action',
  10762: 'Kids',
  10764: 'Reality',
  10765: 'Sci-Fi',
  10766: 'Soap',
  10768: 'War',
};

export const TMDB_GENRE_NAME_TO_TV_ID: Record<string, number> = {
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  news: 10763,
  reality: 10764,
  'sci-fi': 10765,
  fantasy: 10765,
  soap: 10766,
  talk: 10767,
  war: 10768,
  western: 37,
  // Portuguese translations
  ação: 10759,
  aventura: 10759,
  animação: 16,
  comédia: 35,
  documentário: 99,
  família: 10751,
  mistério: 9648,
  'ficção científica': 10765,
  fantasia: 10765,
  guerra: 10768,
  faroeste: 37,
  // Combined/special
  'action & adventure': 10759,
  'ação e aventura': 10759,
  'sci-fi & fantasy': 10765,
  'ficção científica e fantasia': 10765,
  'war & politics': 10768,
  'guerra e política': 10768,
};

export const TMDB_GENRE_NAME_TO_MOVIE_ID: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  'sci-fi': 878,
  thriller: 53,
  war: 10752,
  western: 37,
  // Portuguese translations
  ação: 28,
  aventura: 12,
  animação: 16,
  comédia: 35,
  documentário: 99,
  família: 10751,
  fantasia: 14,
  história: 36,
  terror: 27,
  música: 10402,
  mistério: 9648,
  'ficção científica': 878,
  suspense: 53,
  guerra: 10752,
  faroeste: 37,
  // Combined/special
  'action & adventure': 28,
  'ação e aventura': 28,
  'sci-fi & fantasy': 14,
  'ficção científica e fantasia': 14,
  'war & politics': 10752,
  'guerra e política': 10752,
};

export const TMDB_STATIC_KEYWORDS: Record<string, number> = {
  shounen: 207826,
  seinen: 195668,
  shoujo: 206437,
  josei: 229074,
  'anti-hero': 2095,
  'female protagonist': 11322,
  'male protagonist': 360069,
  'ensemble cast': 374743,
  isekai: 237451,
  cyberpunk: 12190,
  'post-apocalyptic': 359337,
  space: 9882,
  'time loop': 10854,
  historical: 15126,
  "girls' love": 280003,
  harem: 9194,
  'love triangle': 128,
  tragedy: 10614,
  revenge: 9748,
  magic: 2343,
  'super power': 33637,
  school: 10873,
  work: 3640,
  music: 283297,
  mecha: 10046,
  vampire: 3133,
  demons: 361426,
  zombies: 360877,
  'otaku culture': 320963,
  'martial arts': 779,
  swordplay: 1400,
  ecchi: 195669,
  hentai: 198385,
  'psychological': 272553,
  'slice of life': 9914,
  sports: 6075,
  supernatural: 6152,
  "girls' love (gl)": 280003,
  'magical girl': 223595,
  'mahou shoujo': 223595,
};
