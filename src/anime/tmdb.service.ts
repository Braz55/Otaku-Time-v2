import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TMDBService {
  private readonly logger = new Logger(TMDBService.name);
  private readonly apiKey = process.env.TMDB_API_KEY;

  constructor() {
    if (!this.apiKey) {
      this.logger.error('TMDB_API_KEY is not defined in the environment variables!');
    }
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.apiKey && this.apiKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private buildUrl(endpoint: string, params: Record<string, string> = {}): string {
    const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
    
    // If not using Bearer Token, add api_key parameter
    if (this.apiKey && !this.apiKey.startsWith('eyJ')) {
      url.searchParams.append('api_key', this.apiKey);
    }
    
    // Default language is Portuguese (PT)
    url.searchParams.append('language', 'pt-PT');

    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, val);
      }
    }
    
    return url.toString();
  }

  private async fetchFromTMDB(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error('TMDB_API_KEY is not configured');
    }

    const url = this.buildUrl(endpoint, params);
    try {
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      this.logger.error(`Error fetching from TMDB endpoint ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Search for TV Shows or Movies on TMDB.
   * If type is multi, it searches both.
   */
  async search(query: string, page: number = 1): Promise<any[]> {
    try {
      const results = await this.fetchFromTMDB('/search/multi', {
        query,
        page: page.toString(),
      });

      const mediaItems = results.results || [];
      // Filter only TV and Movie results, and sort by popularity desc
      return mediaItems
        .filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie')
        .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));
    } catch {
      return [];
    }
  }

  /**
   * Get TV Show details.
   */
  async getTVShowDetails(id: number): Promise<any> {
    return this.fetchFromTMDB(`/tv/${id}`);
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
    return this.fetchFromTMDB(`/movie/${id}`);
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
}
