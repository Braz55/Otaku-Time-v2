// L-23: uma obra é identificada pelo par (fonte, id). O mesmo número pode ser uma série do TMDB,
// um filme do TMDB e um manga da AniList ao mesmo tempo.
export type MediaSource = 'ANILIST' | 'TMDB_TV' | 'TMDB_MOVIE';

// Fonte de uma obra a partir do que a página sabe sobre ela: a fonte devolvida pela API,
// senão o formato (MOVIE → filme; o resto é série). O manga vem sempre da AniList.
export function getMediaSource(
  mediaType: string | undefined,
  item?: { fonte?: string | null; formato?: string | null; format?: string | null } | null,
  fallbackFormat?: string | null,
): MediaSource {
  if (mediaType?.toLowerCase() === 'manga') return 'ANILIST';
  if (item?.fonte === 'TMDB_TV' || item?.fonte === 'TMDB_MOVIE') return item.fonte;
  const format = (item?.formato || item?.format || fallbackFormat || '').toUpperCase();
  return format === 'MOVIE' ? 'TMDB_MOVIE' : 'TMDB_TV';
}

// Chave para comparar obras (ex.: "TMDB_TV:1399")
export function mediaKey(fonte: string, id: number | string): string {
  return `${fonte}:${id}`;
}
