import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRecommendations(
    type: 'ANIME' | 'MANGA',
    userId: number,
    page: number = 1,
  ) {
    let userLibraryIds = new Set<number>();
    let userLibraryTitles = new Set<string>();
    let userInteractedItems: {
      generos: any;
      status: string;
      paisOrigem: string | null;
    }[] = [];

    if (type === 'ANIME') {
      const userAnimes = await this.prisma.userAnime.findMany({
        where: { userId },
        include: { anime: true },
      });
      userLibraryIds = new Set<number>(userAnimes.map((ua) => ua.animeId));
      userLibraryTitles = new Set<string>(
        userAnimes.map((ua) => ua.anime?.titulo?.toLowerCase() || ''),
      );
      userInteractedItems = userAnimes.map((ua) => ({
        generos: ua.anime?.generos,
        status: ua.status,
        paisOrigem: ua.anime?.paisOrigem || null,
      }));
    } else {
      const userMangas = await this.prisma.userManga.findMany({
        where: { userId },
        include: { manga: true },
      });
      userLibraryIds = new Set<number>(userMangas.map((um) => um.mangaId));
      userInteractedItems = userMangas.map((um) => ({
        generos: um.manga?.generos,
        status: um.status,
        paisOrigem: um.manga?.paisOrigem || null,
      }));
    }

    const tasteScores: Record<string, number> = {};
    userInteractedItems.forEach((item) => {
      if (!item.generos) return;

      let genresObj: Record<string, number> = {};
      if (typeof item.generos === 'string') {
        item.generos
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((g) => {
            genresObj[g] = 100;
          });
      } else if (typeof item.generos === 'object') {
        genresObj = item.generos as Record<string, number>;
      }

      let multiplier = 1.0;
      if (item.status === 'COMPLETED') multiplier = 1.5;
      else if (item.status === 'DROPPED') multiplier = 0.3;
      else if (item.status === 'PAUSED') multiplier = 0.5;

      Object.entries(genresObj).forEach(([tag, weight]) => {
        const score = (typeof weight === 'number' ? weight : 100) * multiplier;
        tasteScores[tag] = (tasteScores[tag] || 0) + score;
      });
    });

    const sortedTastes = Object.entries(tasteScores)
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);

    const allDbGenresTags = await this.prisma.genreTag.findMany({
      select: { name: true, type: true },
    });
    const dbGenreNames = allDbGenresTags
      .filter((gt) => gt.type === 'GENRE')
      .map((gt) => gt.name);
    const dbAllNames = allDbGenresTags.map((gt) => gt.name);

    const unexploredTastes = dbAllNames.filter((name) => !tasteScores[name]);

    const discoveryTastes: string[] = [];
    if (unexploredTastes.length > 0) {
      const index1 = Math.floor(Math.random() * unexploredTastes.length);
      discoveryTastes.push(unexploredTastes[index1]);
      if (unexploredTastes.length > 1) {
        const index2 = (index1 + 1) % unexploredTastes.length;
        discoveryTastes.push(unexploredTastes[index2]);
      }
    }

    // Calcular o país de preferência com base nos itens da biblioteca
    const countryCounts: Record<string, number> = {};
    userInteractedItems.forEach((item) => {
      if (item.paisOrigem) {
        countryCounts[item.paisOrigem] =
          (countryCounts[item.paisOrigem] || 0) + 1;
      }
    });

    let preferredCountry: string | undefined = undefined;
    const sortedCountries = Object.entries(countryCounts).sort(
      (a, b) => b[1] - a[1],
    );
    if (sortedCountries.length > 0 && sortedCountries[0][1] > 0) {
      preferredCountry = sortedCountries[0][0];
    }

    // Helper para extrair coocorrências de tags baseadas nos itens que contêm um gosto âncora
    const buildProfileForAnchor = (
      anchor: string,
      excludeTastes: string[] = [],
    ) => {
      if (!anchor) return [];

      const coCounts: Record<string, number> = {};
      userInteractedItems.forEach((item) => {
        if (!item.generos) return;

        let genresObj: Record<string, number> = {};
        if (typeof item.generos === 'string') {
          item.generos
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((g) => {
              genresObj[g] = 100;
            });
        } else if (typeof item.generos === 'object') {
          genresObj = item.generos as Record<string, number>;
        }

        if (genresObj[anchor]) {
          let multiplier = 1.0;
          if (item.status === 'COMPLETED') multiplier = 1.5;
          else if (item.status === 'DROPPED') multiplier = 0.3;
          else if (item.status === 'PAUSED') multiplier = 0.5;

          Object.keys(genresObj).forEach((tag) => {
            if (tag !== anchor) {
              const weight = genresObj[tag];
              const score =
                (typeof weight === 'number' ? weight : 100) * multiplier;
              coCounts[tag] = (coCounts[tag] || 0) + score;
            }
          });
        }
      });

      const sortedCo = Object.entries(coCounts)
        .filter((entry) => !excludeTastes.includes(entry[0]))
        .sort((a, b) => b[1] - a[1])
        .map((entry) => entry[0]);

      return [anchor, ...sortedCo.slice(0, 3)];
    };

    // Construção de Perfis Temáticos Combinados
    const profile1 = sortedTastes[0]
      ? buildProfileForAnchor(sortedTastes[0])
      : [];
    const profile2 = sortedTastes[1]
      ? buildProfileForAnchor(sortedTastes[1], profile1)
      : [];
    const profile3 = sortedTastes[2]
      ? buildProfileForAnchor(sortedTastes[2], [...profile1, ...profile2])
      : [];

    console.log(
      `\x1b[35m[Recomendações - ${type}]\x1b[0m Utilizador ID: ${userId}`,
    );
    console.log(
      `  -> País de preferência (Preferred Country):`,
      preferredCountry || 'Nenhum',
    );
    console.log(`  -> Perfil Temático 1 (Profile 1):`, profile1);
    console.log(`  -> Perfil Temático 2 (Profile 2):`, profile2);
    console.log(`  -> Perfil Temático 3 (Profile 3):`, profile3);
    console.log(`  -> Gostos para Descoberta (Discovery):`, discoveryTastes);

    let isAdult: boolean | undefined = false;
    const userObj = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (userObj && userObj.showAdultContent) {
      isAdult = undefined;
    }

    // Helper para classificar e reordenar localmente de acordo com a quantidade de tags coincidentes
    const rankPoolByProfile = (pool: any[], profile: string[]) => {
      if (profile.length === 0) return pool;
      return pool
        .map((item) => {
          let overlap = 0;
          const itemGenres = item.genres || [];
          const itemTags = (item.tags || []).map((t: any) => t.name);
          const itemAllTastes = [...itemGenres, ...itemTags];

          profile.forEach((taste) => {
            if (itemAllTastes.includes(taste)) {
              overlap++;
            }
          });

          return { item, overlap };
        })
        .sort((a, b) => b.overlap - a.overlap)
        .map((entry) => entry.item);
    };

    const fetchCandidatePoolForProfile = async (
      profile: string[],
      sort: string = 'POPULARITY_DESC',
      country?: string,
    ) => {
      if (!profile || profile.length === 0) return [];

      const genres = profile.filter((t) => dbGenreNames.includes(t));
      const tags = profile.filter((t) => !dbGenreNames.includes(t));

      const rawCandidates = await this.fetchCandidatesFromAniList(
        type,
        genres.length > 0 ? genres : undefined,
        tags.length > 0 ? tags : undefined,
        sort,
        isAdult,
        country,
      );

      return rankPoolByProfile(rawCandidates, profile);
    };

    const fetchCandidatePool = async (
      genres?: string[],
      tags?: string[],
      sort: string = 'POPULARITY_DESC',
      country?: string,
    ) => {
      return this.fetchCandidatesFromAniList(
        type,
        genres,
        tags,
        sort,
        isAdult,
        country,
      );
    };

    const [
      poolPrimary1,
      poolPrimary2,
      poolSecondary1,
      poolDiscovery,
      poolGlobal,
    ] = await Promise.all([
      profile1.length > 0
        ? fetchCandidatePoolForProfile(
            profile1,
            'TRENDING_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      profile2.length > 0
        ? fetchCandidatePoolForProfile(
            profile2,
            'POPULARITY_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      profile3.length > 0
        ? fetchCandidatePoolForProfile(
            profile3,
            'POPULARITY_DESC',
            preferredCountry,
          )
        : Promise.resolve([]),
      discoveryTastes[0]
        ? fetchCandidatePool(
            dbGenreNames.includes(discoveryTastes[0])
              ? [discoveryTastes[0]]
              : undefined,
            !dbGenreNames.includes(discoveryTastes[0])
              ? [discoveryTastes[0]]
              : undefined,
            'TRENDING_DESC',
          )
        : Promise.resolve([]),
      fetchCandidatePool(
        undefined,
        undefined,
        'TRENDING_DESC',
        preferredCountry,
      ),
    ]);

    const allCandidates: any[] = [];
    const maxLen = Math.max(
      poolPrimary1.length,
      poolPrimary2.length,
      poolSecondary1.length,
      poolDiscovery.length,
      poolGlobal.length,
    );

    const addedIds = new Set<number>();

    for (let i = 0; i < maxLen; i++) {
      const candidatesInRound = [
        poolPrimary1[i],
        poolPrimary2[i],
        poolSecondary1[i],
        poolGlobal[i],
        poolDiscovery[i],
      ].filter(Boolean);

      candidatesInRound.forEach((item) => {
        const titleEn = (item.title?.english || '').toLowerCase();
        const titleRo = (item.title?.romaji || '').toLowerCase();
        const alreadyInLibrary =
          userLibraryIds.has(item.id) ||
          (type === 'ANIME' &&
            (userLibraryTitles.has(titleEn) || userLibraryTitles.has(titleRo)));

        if (!alreadyInLibrary && !addedIds.has(item.id)) {
          allCandidates.push(item);
          addedIds.add(item.id);
        }
      });
    }

    if (allCandidates.length === 0) {
      poolGlobal.forEach((item) => {
        const titleEn = (item.title?.english || '').toLowerCase();
        const titleRo = (item.title?.romaji || '').toLowerCase();
        const alreadyInLibrary =
          userLibraryIds.has(item.id) ||
          (type === 'ANIME' &&
            (userLibraryTitles.has(titleEn) || userLibraryTitles.has(titleRo)));

        if (!alreadyInLibrary && !addedIds.has(item.id)) {
          allCandidates.push(item);
          addedIds.add(item.id);
        }
      });
    }

    const perPage = 24;
    const startIndex = (page - 1) * perPage;
    return allCandidates.slice(startIndex, startIndex + perPage);
  }

  private async fetchCandidatesFromAniList(
    type: 'ANIME' | 'MANGA',
    genres?: string[],
    tags?: string[],
    sort: string = 'POPULARITY_DESC',
    isAdult?: boolean,
    country?: string,
  ): Promise<any[]> {
    const query = `
      query ($genres: [String], $tags: [String], $sort: [MediaSort], $isAdult: Boolean, $type: MediaType, $country: CountryCode) {
        Page(page: 1, perPage: 25) {
          media(genre_in: $genres, tag_in: $tags, type: $type, sort: $sort, isAdult: $isAdult, countryOfOrigin: $country) {
            id
            title { english romaji native }
            coverImage { large }
            genres
            tags { name }
            averageScore
            description
            episodes
            chapters
            status
          }
        }
      }
    `;

    const variables: any = {
      type,
      sort: [sort],
      isAdult,
    };

    if (genres && genres.length > 0) variables.genres = genres;
    if (tags && tags.length > 0) variables.tags = tags;
    if (country) variables.country = country;

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const result = await response.json();
      return result?.data?.Page?.media || [];
    } catch (error) {
      this.logger.error('Error fetching candidates from AniList:', error);
      return [];
    }
  }
}
