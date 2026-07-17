import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TMDBService {
  private readonly logger = new Logger(TMDBService.name);
  private readonly apiKey = process.env.TMDB_API_KEY;

  constructor() {
    if (!this.apiKey) {
      this.logger.error(
        'TMDB_API_KEY is not defined in the environment variables!',
      );
    }
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.apiKey && this.apiKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private buildUrl(
    endpoint: string,
    params: Record<string, string> = {},
  ): string {
    const url = new URL(`https://api.themoviedb.org/3${endpoint}`);

    // If not using Bearer Token, add api_key parameter
    if (this.apiKey && !this.apiKey.startsWith('eyJ')) {
      url.searchParams.append('api_key', this.apiKey);
    }

    // Default language is English (US) if not overridden
    if (!params.language) {
      url.searchParams.append('language', 'en-US');
    }

    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, val);
      }
    }

    return url.toString();
  }

  private async fetchFromTMDB(
    endpoint: string,
    params: Record<string, string> = {},
    retries = 3,
    delay = 500,
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error('TMDB_API_KEY is not configured');
    }

    const url = this.buildUrl(endpoint, params);
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, { headers: this.headers });
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : delay * Math.pow(2, i);
          this.logger.warn(
            `TMDB rate limit hit (429) on ${endpoint}. Waiting ${waitTime}ms before retry...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
        if (!response.ok) {
          if (response.status >= 500 && i < retries - 1) {
            this.logger.warn(
              `TMDB server error (${response.status}) on ${endpoint}. Retrying in ${delay * Math.pow(2, i)}ms...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, delay * Math.pow(2, i)),
            );
            continue;
          }
          const err = new Error(
            `TMDB API error: ${response.status} ${response.statusText}`,
          );
          (err as any).status = response.status;
          throw err;
        }
        return await response.json();
      } catch (error: any) {
        if (error.status === 404) {
          throw error;
        }
        if (i === retries - 1) {
          this.logger.error(
            `Error fetching from TMDB endpoint ${endpoint} after ${retries} attempts:`,
            error,
          );
          throw error;
        }
        this.logger.warn(
          `Error fetching from TMDB endpoint ${endpoint} (attempt ${i + 1}/${retries}): ${error.message || error}. Retrying...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, i)),
        );
      }
    }
  }

  /**
   * Search for TV Shows or Movies on TMDB.
   * If type is multi, it searches both.
   */
  async search(
    query: string,
    page: number = 1,
    language?: string,
  ): Promise<any[]> {
    try {
      const results = await this.fetchFromTMDB('/search/multi', {
        query,
        page: page.toString(),
        ...(language ? { language } : {}),
      });

      const mediaItems = results.results || [];
      // Filter only TV and Movie results, and sort by popularity desc
      return mediaItems
        .filter(
          (item: any) =>
            item.media_type === 'tv' || item.media_type === 'movie',
        )
        .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
    } catch (error: any) {
      this.logger.error(
        `TMDB search error: ${error.message || error}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Get TV Show details.
   */
  async getTVShowDetails(id: number): Promise<any> {
    return this.fetchFromTMDB(`/tv/${id}`, {
      append_to_response: 'translations',
    });
  }

  /**
   * Get TV Season details (including episode list with air dates).
   */
  async getTVSeasonDetails(id: number, seasonNumber: number): Promise<any> {
    return this.fetchFromTMDB(`/tv/${id}/season/${seasonNumber}`);
  }

  /**
   * Get Movie details.
   */
  async getMovieDetails(id: number): Promise<any> {
    return this.fetchFromTMDB(`/movie/${id}`, {
      append_to_response: 'translations',
    });
  }

  /**
   * Get keywords for a TV Show or Movie from TMDB.
   */
  async getKeywords(id: number, type: 'tv' | 'movie'): Promise<string[]> {
    try {
      const endpoint =
        type === 'tv' ? `/tv/${id}/keywords` : `/movie/${id}/keywords`;
      const response = await this.fetchFromTMDB(endpoint);
      const list = type === 'tv' ? response.results : response.keywords;
      if (list && Array.isArray(list)) {
        return list.map((k: any) => k.name);
      }
      return [];
    } catch (error: any) {
      this.logger.error(
        `Error fetching keywords for ${type} ID ${id}: ${error.message || error}`,
      );
      return [];
    }
  }

  /**
   * Discover TV Shows with filters.
   */
  async discoverTV(params: Record<string, string> = {}): Promise<any> {
    return this.fetchFromTMDB('/discover/tv', params);
  }

  /**
   * Discover Movies with filters.
   */
  async discoverMovies(params: Record<string, string> = {}): Promise<any> {
    return this.fetchFromTMDB('/discover/movie', params);
  }

  /**
   * Find TV show or movie by TVDB ID.
   */
  async findByTVDBId(
    tvdbId: number,
  ): Promise<{ id: number; type: 'tv' | 'movie' } | null> {
    try {
      const results = await this.fetchFromTMDB(`/find/${tvdbId}`, {
        external_source: 'tvdb_id',
      });
      if (results.tv_results && results.tv_results.length > 0) {
        return { id: results.tv_results[0].id, type: 'tv' };
      }
      if (results.movie_results && results.movie_results.length > 0) {
        return { id: results.movie_results[0].id, type: 'movie' };
      }
      return null;
    } catch (error) {
      this.logger.error(`Error finding media by TVDB ID ${tvdbId}:`, error);
      return null;
    }
  }
}
