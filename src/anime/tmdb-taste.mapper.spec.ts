import {
  buildTasteProfile,
  extractTmdbKeywordTags,
  normalizeTmdbTastes,
  tmdbGenreId,
  tmdbGenreNamesFromIds,
} from './tmdb-taste.mapper';

describe('tmdb-taste.mapper', () => {
  describe('normalizeTmdbTastes', () => {
    it('splits compound TMDB genres and drops format/animation noise', () => {
      expect(
        normalizeTmdbTastes({
          'Action & Adventure': 100,
          'Sci-Fi & Fantasy': 100,
          Animation: 100,
          Animação: 100,
          'TV Show': 100,
          Série: 100,
        }),
      ).toEqual({ Action: 100, Adventure: 100, 'Sci-Fi': 100, Fantasy: 100 });
    });

    it('maps Portuguese and movie genre names to the same canonical genre', () => {
      expect(
        normalizeTmdbTastes({ 'Ficção Científica': 100, 'Science Fiction': 60 }),
      ).toEqual({ 'Sci-Fi': 100 });
    });

    it('keeps keywords in lowercase with their weight', () => {
      expect(
        normalizeTmdbTastes({ Isekai: 80, 'Based On Manga': 80, Comedy: 100 }),
      ).toEqual({ isekai: 80, Comedy: 100 });
    });

    it('accepts the old comma separated text format', () => {
      expect(normalizeTmdbTastes('Action, Comédia')).toEqual({
        Action: 100,
        Comedy: 100,
      });
    });

    it('returns nothing for empty values', () => {
      expect(normalizeTmdbTastes(null)).toEqual({});
      expect(normalizeTmdbTastes(undefined)).toEqual({});
    });
  });

  describe('genre ids', () => {
    it('uses different ids for series and movies', () => {
      expect(tmdbGenreId('Action', 'tv')).toBe(10759);
      expect(tmdbGenreId('Action', 'movie')).toBe(28);
      expect(tmdbGenreId('Romance', 'tv')).toBeUndefined();
      expect(tmdbGenreId('Romance', 'movie')).toBe(10749);
    });

    it('turns result genre_ids back into canonical genres', () => {
      expect(tmdbGenreNamesFromIds([16, 10759, 35], 'tv')).toEqual([
        'Action',
        'Adventure',
        'Comedy',
      ]);
      expect(tmdbGenreNamesFromIds([16, 878], 'movie')).toEqual(['Sci-Fi']);
      expect(tmdbGenreNamesFromIds(undefined, 'tv')).toEqual([]);
    });
  });

  describe('extractTmdbKeywordTags', () => {
    it('reads series (results) and movie (keywords) responses', () => {
      expect(
        extractTmdbKeywordTags({
          keywords: { results: [{ id: 1, name: 'time loop' }] },
        }),
      ).toEqual([{ name: 'Time Loop', rank: 80 }]);
      expect(
        extractTmdbKeywordTags({
          keywords: { keywords: [{ id: 2, name: 'isekai' }] },
        }),
      ).toEqual([{ name: 'Isekai', rank: 80 }]);
    });

    it('drops noise, genres repeated as keywords, and caps the list', () => {
      const many = Array.from({ length: 30 }, (_, i) => ({
        name: `theme ${i}`,
      }));
      const tags = extractTmdbKeywordTags({
        keywords: {
          results: [
            { name: 'anime' },
            { name: 'based on manga' },
            { name: 'romance' },
            ...many,
          ],
        },
      });
      expect(tags).toHaveLength(10);
      expect(tags[0].name).toBe('Theme 0');
    });

    it('returns nothing when the response has no keywords', () => {
      expect(extractTmdbKeywordTags({})).toEqual([]);
      expect(extractTmdbKeywordTags(null)).toEqual([]);
    });
  });

  describe('buildTasteProfile', () => {
    it('weights tastes by status and groups them by co-occurrence', () => {
      const { scores, profiles } = buildTasteProfile([
        { tastes: { Action: 100, isekai: 80 }, status: 'COMPLETED' },
        { tastes: { Action: 100, Fantasy: 100 }, status: 'WATCHING' },
        { tastes: { Comedy: 100 }, status: 'DROPPED' },
      ]);
      expect(scores).toEqual({
        Action: 250,
        isekai: 120,
        Fantasy: 100,
        Comedy: 30,
      });
      expect(profiles[0]).toEqual(['Action', 'isekai', 'Fantasy']);
      // Os perfis seguintes não repetem os gostos dos anteriores
      expect(profiles[1]).toEqual(['isekai']);
      expect(profiles[2]).toEqual(['Fantasy']);
    });

    it('returns no profiles for an empty library', () => {
      expect(buildTasteProfile([])).toEqual({ scores: {}, profiles: [] });
    });
  });
});
