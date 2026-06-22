import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFromAniList(id: number, type: 'ANIME' | 'MANGA') {
  const query = `
    query ($id: Int, $type: MediaType) {
      Media(id: $id, type: $type) {
        countryOfOrigin
        format
        source
      }
    }
  `;
  const variables = { id, type };

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      console.log('Rate limit hit. Sleeping for 5 seconds...');
      await delay(5000);
      return fetchFromAniList(id, type); // Retry
    }

    const result = await response.json() as any;
    return result?.data?.Media || null;
  } catch (error) {
    console.error(`Error querying AniList for ${type} ID ${id}:`, error);
    return null;
  }
}

async function main() {
  console.log('Starting backfill script for Anime and Manga metadata...');

  // 1. Update Animes
  const animes = await prisma.anime.findMany({
    where: {
      OR: [
        { paisOrigem: null },
        { formato: null },
        { materialOrigem: null }
      ]
    }
  });

  console.log(`Found ${animes.length} Animes needing update.`);
  let animeCount = 0;
  for (const anime of animes) {
    console.log(`Updating Anime [${anime.id}] ${anime.titulo}...`);
    const metadata = await fetchFromAniList(anime.id, 'ANIME');
    
    if (metadata) {
      await prisma.anime.update({
        where: { id: anime.id },
        data: {
          paisOrigem: metadata.countryOfOrigin || null,
          formato: metadata.format || null,
          materialOrigem: metadata.source || null,
        }
      });
      animeCount++;
    }
    
    await delay(1000); // 1s sleep to avoid rate limiting
  }
  console.log(`Successfully updated ${animeCount} Animes.`);

  // 2. Update Mangas
  const mangas = await prisma.manga.findMany({
    where: {
      OR: [
        { paisOrigem: null },
        { formato: null },
        { materialOrigem: null }
      ]
    }
  });

  console.log(`Found ${mangas.length} Mangas needing update.`);
  let mangaCount = 0;
  for (const manga of mangas) {
    console.log(`Updating Manga [${manga.id}] ${manga.titulo}...`);
    const metadata = await fetchFromAniList(manga.id, 'MANGA');
    
    if (metadata) {
      await prisma.manga.update({
        where: { id: manga.id },
        data: {
          paisOrigem: metadata.countryOfOrigin || null,
          formato: metadata.format || null,
          materialOrigem: metadata.source || null,
        }
      });
      mangaCount++;
    }
    
    await delay(1000); // 1s sleep to avoid rate limiting
  }
  console.log(`Successfully updated ${mangaCount} Mangas.`);

  console.log('Backfill script complete.');
}

main()
  .catch(err => {
    console.error('Error running backfill script:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
