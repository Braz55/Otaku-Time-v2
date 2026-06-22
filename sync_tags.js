const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// GraphQL Query helper
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

  // 1. Fetch all local animes
  const animes = await prisma.anime.findMany();
  console.log(`Found ${animes.length} animes in local database.`);
  
  for (let i = 0; i < animes.length; i++) {
    const anime = animes[i];
    console.log(`[${i+1}/${animes.length}] Processing Anime: "${anime.titulo}" (ID: ${anime.id})...`);
    
    const mediaInfo = await fetchAniListInfo(anime.id, 'ANIME');
    if (mediaInfo) {
      const generosDict = buildGenerosDict(mediaInfo.genres, mediaInfo.tags ? mediaInfo.tags.slice(0, 10) : undefined);
      
      await prisma.anime.update({
        where: { id: anime.id },
        data: {
          generos: generosDict
        }
      });
      console.log(`  -> Saved genres (dictionary):`, JSON.stringify(generosDict));
    } else {
      console.log(`  -> Failed to fetch info from AniList.`);
    }
    // Respect rate limits (AniList has a 90 requests/minute limit)
    await delay(700);
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
    // Respect rate limits
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
