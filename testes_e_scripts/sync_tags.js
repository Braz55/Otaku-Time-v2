const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ? process.env.DATABASE_URL.split('?')[0] : undefined,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TMDB_GENRE_MAP = {
  'Ação': ['Action'],
  'Ação e Aventura': ['Action', 'Adventure'],
  'Action & Adventure': ['Action', 'Adventure'],
  'Aventura': ['Adventure'],
  'Animação': ['Animation'],
  'Animation': ['Animation'],
  'Comédia': ['Comedy'],
  'Comedy': ['Comedy'],
  'Crime': ['Crime'],
  'Documentário': ['Documentary'],
  'Documentary': ['Documentary'],
  'Drama': ['Drama'],
  'Família': ['Family'],
  'Family': ['Family'],
  'Fantasia': ['Fantasy'],
  'Fantasy': ['Fantasy'],
  'Ficção Científica': ['Sci-Fi'],
  'Ficção Científica e Fantasia': ['Sci-Fi', 'Fantasy'],
  'Sci-Fi & Fantasy': ['Sci-Fi', 'Fantasy'],
  'História': ['History'],
  'History': ['History'],
  'Terror': ['Horror'],
  'Horror': ['Horror'],
  'Música': ['Music'],
  'Music': ['Music'],
  'Mistério': ['Mystery'],
  'Mystery': ['Mystery'],
  'Romance': ['Romance'],
  'Suspense': ['Thriller'],
  'Thriller': ['Thriller'],
  'Guerra': ['War'],
  'War': ['War'],
  'Guerra e Política': ['War', 'Drama'],
  'War & Politics': ['War', 'Drama'],
  'Faroeste': ['Western'],
  'Western': ['Western']
};

async function ensureExtraGenreTags() {
  const extraTags = [
    // Genres
    { name: 'Animation', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Animação', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Crime', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Documentary', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Documentário', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Family', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Família', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'History', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'História', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'War', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Guerra', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Western', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    { name: 'Faroeste', type: 'GENRE', category: 'Géneros Principais', subcategory: 'Género', isAdult: false, isExposed: true },
    
    // Formats/Types
    { name: 'Movie', type: 'TAG', category: 'Formato', subcategory: 'Tipo', isAdult: false, isExposed: true },
    { name: 'Filme', type: 'TAG', category: 'Formato', subcategory: 'Tipo', isAdult: false, isExposed: true },
    { name: 'TV Show', type: 'TAG', category: 'Formato', subcategory: 'Tipo', isAdult: false, isExposed: true },
    { name: 'Série', type: 'TAG', category: 'Formato', subcategory: 'Tipo', isAdult: false, isExposed: true },
  ];

  for (const tag of extraTags) {
    await prisma.genreTag.upsert({
      where: { name: tag.name },
      update: {
        type: tag.type,
        category: tag.category,
        subcategory: tag.subcategory,
        isExposed: tag.isExposed,
      },
      create: tag,
    });
  }
  console.log("Extra genres and format tags ensured in the GenreTag database table.");
}

function capitalizeKeyword(name) {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildGenerosDict(genres, tags) {
  const dict = {};
  if (genres) {
    genres.forEach(g => {
      dict[g.trim()] = 100;
    });
  }
  if (tags) {
    tags.forEach(t => {
      dict[t.name.trim()] = t.rank !== undefined ? t.rank : 100;
    });
  }
  return dict;
}

// TMDB Keywords and Details Fetcher
async function fetchTMDBData(id, format) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error("TMDB_API_KEY is not defined in the environment!");
    return null;
  }
  const isBearer = apiKey.startsWith('eyJ');
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (isBearer) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  const isMovie = format === 'MOVIE';
  const detailsEndpoint = isMovie ? `/movie/${id}` : `/tv/${id}`;
  const keywordsEndpoint = isMovie ? `/movie/${id}/keywords` : `/tv/${id}/keywords`;
  
  const urlParams = isBearer ? '' : `?api_key=${apiKey}`;
  const detailsUrl = `https://api.themoviedb.org/3${detailsEndpoint}${urlParams}`;
  const keywordsUrl = `https://api.themoviedb.org/3${keywordsEndpoint}${urlParams}`;
  
  try {
    // 1. Fetch details
    const detailsRes = await fetch(detailsUrl, { headers });
    if (!detailsRes.ok) return null;
    const details = await detailsRes.json();
    
    // 2. Fetch keywords
    const keywordsRes = await fetch(keywordsUrl, { headers });
    const keywordsData = keywordsRes.ok ? await keywordsRes.json() : null;
    
    const genres = details.genres ? details.genres.map(g => g.name) : [];
    const keywordsList = keywordsData ? (isMovie ? keywordsData.keywords : keywordsData.results) : [];
    const keywords = keywordsList ? keywordsList.map(k => k.name) : [];
    
    return { genres, keywords };
  } catch (error) {
    console.error(`Error fetching TMDB data for ID ${id}:`, error);
    return null;
  }
}

// AniList GraphQL Query Helper (for Manga)
async function fetchAniListInfo(id, type) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ${type}) {
        genres
        tags { name rank }
      }
    }
  `;
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { id } }),
    });
    if (!response.ok) {
      if (response.status === 429) {
        console.log("Rate limited by AniList. Waiting 5 seconds...");
        await delay(5000);
        return fetchAniListInfo(id, type);
      }
      return null;
    }
    const result = await response.json();
    return result?.data?.Media || null;
  } catch (error) {
    console.error(`Error querying AniList for ${type} ID ${id}:`, error);
    return null;
  }
}

async function main() {
  console.log("Starting DB tag synchronization...");
  await ensureExtraGenreTags();

  // 1. Fetch all local animes
  const animes = await prisma.anime.findMany();
  console.log(`Found ${animes.length} animes in local database.`);
  
  for (let i = 0; i < animes.length; i++) {
    const anime = animes[i];
    console.log(`[${i+1}/${animes.length}] Processing Anime/Serie: "${anime.titulo}" (ID: ${anime.id})...`);
    
    const tmdbData = await fetchTMDBData(anime.id, anime.formato);
    if (tmdbData) {
      const generosDict = {};
      if (tmdbData.genres) {
        tmdbData.genres.forEach(g => {
          const trimmed = g.trim();
          generosDict[trimmed] = 100;
          
          const mapped = TMDB_GENRE_MAP[trimmed];
          if (mapped) {
            mapped.forEach(m => {
              generosDict[m] = 100;
            });
          }
        });
      }

      const format = anime.formato || '';
      if (format === 'MOVIE') {
        generosDict['Movie'] = 100;
        generosDict['Filme'] = 100;
      } else {
        generosDict['TV Show'] = 100;
        generosDict['Série'] = 100;
      }

      const isAnimation = tmdbData.genres?.some(
        g => g.trim().toLowerCase() === 'animação' || g.trim().toLowerCase() === 'animation'
      );
      if (isAnimation) {
        generosDict['Animation'] = 100;
        generosDict['Animação'] = 100;
      }

      if (tmdbData.keywords) {
        tmdbData.keywords.forEach(k => {
          const capitalized = capitalizeKeyword(k.trim());
          if (capitalized) {
            generosDict[capitalized] = 100;
          }
        });
      }
      
      await prisma.anime.update({
        where: { id: anime.id },
        data: {
          generos: generosDict
        }
      });
      console.log(`  -> Saved genres (dictionary):`, JSON.stringify(generosDict));
    } else {
      console.log(`  -> Failed to fetch info from TMDB.`);
    }
    // Respect TMDB rate limits/cooldown
    await delay(200);
  }

  // 2. Fetch all local mangas
  const mangas = await prisma.manga.findMany();
  console.log(`Found ${mangas.length} mangas in local database.`);
  
  for (let i = 0; i < mangas.length; i++) {
    const manga = mangas[i];
    console.log(`[${i+1}/${mangas.length}] Processing Manga: "${manga.titulo}" (ID: ${manga.id})...`);
    
    const mediaInfo = await fetchAniListInfo(manga.id, 'MANGA');
    if (mediaInfo) {
      const generosDict = buildGenerosDict(mediaInfo.genres, mediaInfo.tags ? mediaInfo.tags.slice(0, 10) : undefined);
      
      await prisma.manga.update({
        where: { id: manga.id },
        data: {
          generos: generosDict
        }
      });
      console.log(`  -> Saved genres (dictionary):`, JSON.stringify(generosDict));
    } else {
      console.log(`  -> Failed to fetch info from AniList.`);
    }
    // Respect AniList rate limits
    await delay(700);
  }

  console.log("Database synchronization completed successfully!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

