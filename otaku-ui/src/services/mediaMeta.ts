// Metadados do TMDB mostrados na página de detalhes (filmes, séries e animes).
import { formatMovieDate, formatRuntime } from './movies';

export interface MetaEntry {
  icon: string;
  label: string;
  value: string;
}

export interface CastMember {
  nome: string;
  personagem?: string | null;
  fotoUrl?: string | null;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Código de idioma (ex: "ja") para o nome em português
export const formatLanguageName = (code?: string | null): string => {
  if (!code) return '';
  try {
    const nome = new Intl.DisplayNames(['pt-PT'], { type: 'language' }).of(code);
    return nome ? capitalize(nome) : code;
  } catch {
    return code;
  }
};

// Os países chegam como nome ou, quando o TMDB só tem a origem, como código (ex: "JP")
export const formatCountryName = (country: string): string => {
  if (!/^[A-Z]{2}$/.test(country)) return country;
  try {
    return new Intl.DisplayNames(['pt-PT'], { type: 'region' }).of(country) || country;
  } catch {
    return country;
  }
};

export const formatTmdbScore = (nota?: number | null, votos?: number | null): string => {
  if (!nota) return '';
  return `${Number(nota).toFixed(1)} / 10${votos ? ` (${Number(votos).toLocaleString('pt-PT')} votos)` : ''}`;
};

const SERIES_TYPE_LABELS: Record<string, string> = {
  Miniseries: 'Minissérie',
  Documentary: 'Documentário',
  Reality: 'Reality Show',
  'Talk Show': 'Talk Show',
  News: 'Notícias',
  Video: 'Vídeo',
};

// Lista de metadados de uma série/anime; só ficam os campos com valor
export const buildSeriesMeta = (item: any): MetaEntry[] => {
  const meta = item?.serie || {};
  const temporadas = meta.temporadas
    ? `${meta.temporadas} ${meta.temporadas === 1 ? 'temporada' : 'temporadas'}${meta.episodios ? ` · ${meta.episodios} episódios` : ''}`
    : '';
  const terminou = ['Ended', 'Canceled'].includes(meta.estadoTmdb);
  return [
    { icon: 'event', label: 'Primeira Emissão', value: formatMovieDate(meta.primeiraEmissao || item?.dataLancamento) },
    { icon: 'event_available', label: terminou ? 'Último Episódio' : 'Episódio Mais Recente', value: meta.ultimaEmissao && meta.ultimaEmissao !== meta.primeiraEmissao ? formatMovieDate(meta.ultimaEmissao) : '' },
    { icon: 'video_library', label: 'Temporadas', value: temporadas },
    { icon: 'schedule', label: 'Duração por Episódio', value: formatRuntime(item?.duracaoEpisodio) },
    { icon: 'category', label: 'Formato', value: SERIES_TYPE_LABELS[meta.tipoSerie] || '' },
    { icon: 'lightbulb', label: 'Criação', value: (meta.criadores || []).join(', ') },
    { icon: 'movie_edit', label: 'Realização', value: (meta.realizadores || []).join(', ') },
    { icon: 'menu_book', label: 'Obra Original', value: (meta.obraOriginal || []).join(', ') },
    { icon: 'title', label: 'Título Original', value: meta.tituloOriginal && meta.tituloOriginal !== item?.titulo ? meta.tituloOriginal : '' },
    { icon: 'translate', label: 'Idioma Original', value: formatLanguageName(meta.idiomaOriginal) },
    { icon: 'public', label: 'País', value: (meta.paises || []).map(formatCountryName).join(', ') },
    { icon: 'live_tv', label: 'Canal', value: (meta.canais || []).join(', ') },
    { icon: 'apartment', label: 'Produção', value: (meta.produtoras || []).join(', ') },
    { icon: 'star', label: 'Nota TMDB', value: formatTmdbScore(meta.notaTmdb, meta.votosTmdb) },
  ].filter(m => !!m.value);
};
