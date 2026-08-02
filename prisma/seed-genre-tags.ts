import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.split('?')[0],
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Hentai',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller'
];

async function main() {
  console.log("Starting seeding of GenreTag table...");

  // 1. Fetch all unique genres/tags currently in use in local database
  console.log("Analyzing currently used tags in Anime and Manga tables...");
  const animes = await prisma.anime.findMany({ select: { generos: true } });
  const mangas = await prisma.manga.findMany({ select: { generos: true } });

  const usedTags = new Set<string>();
  
  function processField(fieldValue: any) {
    if (!fieldValue) return;
    if (typeof fieldValue === 'string') {
      fieldValue.split(',').forEach(part => {
        const trimmed = part.trim();
        if (trimmed) {
          usedTags.add(trimmed.toLowerCase());
        }
      });
    } else if (typeof fieldValue === 'object') {
      Object.keys(fieldValue).forEach(key => {
        usedTags.add(key.toLowerCase());
      });
    }
  }

  animes.forEach(a => processField(a.generos));
  mangas.forEach(m => processField(m.generos));

  console.log(`Found ${usedTags.size} unique tags/genres in use in the database.`);

  // 2. Read grouped tags JSON
  const groupedTagsPath = path.join(
    'C:', 'Users', 'Utilizador', '.gemini', 'antigravity', 'brain',
    'e053e470-4624-490e-a164-a8be67ff4bc6', 'scratch', 'grouped_tags.json'
  );

  if (!fs.existsSync(groupedTagsPath)) {
    throw new Error(`Grouped tags file not found at ${groupedTagsPath}`);
  }

  const groupedTags = JSON.parse(fs.readFileSync(groupedTagsPath, 'utf8'));

  const itemsToInsert: Array<{
    name: string;
    type: string;
    category: string;
    subcategory: string;
    isAdult: boolean;
    isExposed: boolean;
  }> = [];

  // Add all 19 genres (always exposed = true)
  GENRES.forEach(g => {
    itemsToInsert.push({
      name: g,
      type: 'GENRE',
      category: 'Géneros Principais',
      subcategory: 'Género',
      isAdult: g === 'Hentai',
      isExposed: true
    });
  });

  // Whitelist of core tags allowed to be exposed in the main search slider (if present in the DB)
  const EXPOSED_TAGS_WHITELIST = [
    'Shounen', 'Seinen', 'Shoujo', 'Josei',
    'Anti-Hero', 'Female Protagonist', 'Male Protagonist', 'Ensemble Cast', 'Primarily Adult Cast',
    'Isekai', 'Cyberpunk', 'Post-Apocalyptic', 'Space', 'Time Loop', 'Historical',
    "Girls' Love", 'Harem', 'Love Triangle', 'Tragedy', 'Revenge', 'Magic', 'Super Power', 
    'School', 'Work', 'Music', 'Mecha', 'Vampire', 'Demons', 'Zombies', 'Otaku Culture', 'Martial Arts', 'Swordplay'
  ].map(tag => tag.toLowerCase());

  // Add all 423 tags grouped in categories
  Object.entries(groupedTags).forEach(([mainCat, subCats]) => {
    Object.entries(subCats as Record<string, Array<{ name: string; isAdult: boolean }>>).forEach(([subCat, tagsList]) => {
      tagsList.forEach(t => {
        // Avoid duplicate if genre has same name as tag
        if (GENRES.includes(t.name)) return;

        const isUsed = usedTags.has(t.name.toLowerCase());
        const isExposed = isUsed && EXPOSED_TAGS_WHITELIST.includes(t.name.toLowerCase());
        
        itemsToInsert.push({
          name: t.name,
          type: 'TAG',
          category: mainCat,
          subcategory: subCat,
          isAdult: !!t.isAdult,
          isExposed
        });
      });
    });
  });

  console.log(`Total items to seed: ${itemsToInsert.length}`);

  // Clear existing GenreTag table to avoid unique constraint violations on re-seed
  console.log("Clearing existing GenreTag records...");
  await prisma.genreTag.deleteMany({});

  // Seed items
  console.log("Inserting new GenreTag records...");
  let insertedCount = 0;
  
  // We can insert them in chunks or one by one
  for (const item of itemsToInsert) {
    await prisma.genreTag.create({
      data: item
    });
    insertedCount++;
    if (insertedCount % 50 === 0) {
      console.log(`Inserted ${insertedCount}/${itemsToInsert.length} records...`);
    }
  }

  console.log(`Seeding completed! Successfully inserted ${insertedCount} GenreTag records.`);
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
