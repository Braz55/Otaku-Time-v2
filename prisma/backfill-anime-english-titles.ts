import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.split('?')[0],
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const apiKey = process.env.TMDB_API_KEY as string;
if (!apiKey) {
  console.error('Error: TMDB_API_KEY is not defined in the environment variables!');
  process.exit(1);
}

function hasNonLatin(text: string | null | undefined): boolean {
  if (!text) return false;
  // Detects Cyrillic, Greek, Hebrew, Arabic, Thai, Devanagari, Georgian, Armenian, and CJK characters.
  return /[\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u0600-\u06FF\u0E00-\u0E7F\u0900-\u097F\u10A0-\u10FF\u0530-\u058F\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/.test(text);
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Build TMDB request headers
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};
if (apiKey.startsWith('eyJ')) {
  headers['Authorization'] = `Bearer ${apiKey}`;
}

async function fetchFromTMDB(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  if (!apiKey.startsWith('eyJ')) {
    url.searchParams.append('api_key', apiKey);
  }
  url.searchParams.append('language', 'en-US'); // query in English
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.append(key, val);
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`TMDB HTTP error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function main() {
  console.log('🚀 Starting backfill of Anime titles to English...');

  const animes = await prisma.anime.findMany({
    select: { id: true, titulo: true, formato: true },
  });
  console.log(`Found ${animes.length} Anime records in database.`);

  let updatedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < animes.length; i++) {
    const anime = animes[i];
    const percentage = (((i + 1) / animes.length) * 100).toFixed(1);
    console.log(`[${i + 1}/${animes.length}] (${percentage}%) Checking Anime ID ${anime.id}: "${anime.titulo}"...`);

    let details: any = null;
    let isMovie = anime.formato === 'MOVIE';

    try {
      if (isMovie) {
        try {
          details = await fetchFromTMDB(`/movie/${anime.id}`, { append_to_response: 'translations' });
        } catch (e) {
          // fallback to TV show if movie fetch failed
          details = await fetchFromTMDB(`/tv/${anime.id}`, { append_to_response: 'translations' });
          isMovie = false;
        }
      } else {
        try {
          details = await fetchFromTMDB(`/tv/${anime.id}`, { append_to_response: 'translations' });
        } catch (e) {
          // fallback to Movie if TV fetch failed
          details = await fetchFromTMDB(`/movie/${anime.id}`, { append_to_response: 'translations' });
          isMovie = true;
        }
      }

      if (!details) {
        console.warn(`⚠️ Could not fetch details for Anime ID ${anime.id}`);
        continue;
      }

      const defaultTitle = isMovie
        ? (details.title || details.original_title)
        : (details.name || details.original_name);

      let resolvedTitle = defaultTitle;

      if (defaultTitle && !hasNonLatin(defaultTitle)) {
        resolvedTitle = defaultTitle;
      } else if (details.translations && Array.isArray(details.translations.translations)) {
        // 1. Try English
        const enTranslation = details.translations.translations.find((t: any) => t.iso_639_1 === 'en');
        const enName = enTranslation?.data?.name || enTranslation?.data?.title;
        if (enName && !hasNonLatin(enName)) {
          resolvedTitle = enName;
        } else {
          // 2. Try Portuguese
          const ptTranslation = details.translations.translations.find((t: any) => t.iso_639_1 === 'pt');
          const ptName = ptTranslation?.data?.name || ptTranslation?.data?.title;
          if (ptName && !hasNonLatin(ptName)) {
            resolvedTitle = ptName;
          } else {
            // 3. Try any Latin script translation
            for (const t of details.translations.translations) {
              const name = t.data?.name || t.data?.title;
              if (name && !hasNonLatin(name)) {
                resolvedTitle = name;
                break;
              }
            }
          }
        }
      }

      if (resolvedTitle && resolvedTitle !== anime.titulo) {
        console.log(`   ➡️ Updating title: "${anime.titulo}" ➡️ "${resolvedTitle}"`);
        await prisma.anime.update({
          where: { id: anime.id },
          data: { titulo: resolvedTitle },
        });
        updatedCount++;
      } else {
        console.log(`   ✅ Title matches or is already optimal: "${resolvedTitle}"`);
      }

    } catch (err: any) {
      console.error(`❌ Error updating Anime ID ${anime.id}:`, err.message || err);
      errorCount++;
    }

    // Small delay between requests to avoid rate limits
    await delay(100);
  }

  console.log('\n======================================');
  console.log(`🎉 Backfill complete!`);
  console.log(`Updated titles: ${updatedCount}`);
  console.log(`Errors encountered: ${errorCount}`);
  console.log('======================================');
}

main()
  .catch((e) => console.error('Unhandled script error:', e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
