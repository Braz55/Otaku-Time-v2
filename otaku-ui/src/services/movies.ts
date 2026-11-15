// Regras próprias dos filmes (tipo FILME). Os animes e as séries não passam por aqui.

// Filme "a sério": um filme de anime tem tipo ANIME e continua a seguir a lógica dos animes.
export const isFilme = (item: any): boolean =>
  (item?.tipo ?? item?.anime?.tipo) === 'FILME';

export const getMovieReleaseDate = (item: any): Date | null => {
  const raw = item?.dataLancamento ?? item?.anime?.dataLancamento;
  if (!raw) return null;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
};

// Com data de estreia, é a data que manda; sem data, vale o estado guardado.
export const isMovieUnreleased = (item: any, now: Date = new Date()): boolean => {
  const date = getMovieReleaseDate(item);
  if (date) return date > now;
  const status = item?.statusLancamento ?? item?.anime?.statusLancamento;
  return !!status && !['FINISHED', 'CANCELLED', 'CANCELED'].includes(status);
};

export type MovieState = 'VISTO' | 'POR_ESTREAR' | 'POR_VER';

export const getMovieState = (item: any, now: Date = new Date()): MovieState => {
  if (item?.status === 'COMPLETED') return 'VISTO';
  return isMovieUnreleased(item, now) ? 'POR_ESTREAR' : 'POR_VER';
};

export const formatMovieDate = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const daysUntil = (date: Date, now: Date = new Date()): number =>
  Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

export const formatRuntime = (minutes?: number | null): string => {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}min` : `${m}min`;
};

export const formatMoney = (value?: number | null): string => {
  if (!value || value <= 0) return '';
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};
