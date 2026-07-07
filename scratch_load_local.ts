import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function loadTable(
  tableName: string,
  data: any[],
  insertFn: (batch: any[]) => Promise<any>
) {
  if (!data || data.length === 0) {
    console.log(`No records to load for ${tableName}. Skipping.`);
    return;
  }
  console.log(`Loading ${data.length} records into ${tableName}...`);
  try {
    // Insert in batches of 100 to avoid query size limits
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await insertFn(batch);
    }
    console.log(`Successfully loaded ${tableName}.`);
  } catch (error) {
    console.error(`Error loading table ${tableName}:`, error);
  }
}

async function resetSequence(tableName: string, columnName: string = 'id') {
  try {
    // This query is specific to PostgreSQL to sync auto-increment sequences
    const query = `
      SELECT setval(
        pg_get_serial_sequence('"${tableName}"', '${columnName}'),
        COALESCE(MAX("${columnName}"), 1),
        MAX("${columnName}") IS NOT NULL
      ) FROM "${tableName}";
    `;
    await prisma.$executeRawUnsafe(query);
    console.log(`Reset sequence for ${tableName}.`);
  } catch (error) {
    // Ignore error if not running on PostgreSQL or if sequence doesn't exist
    // console.log(`Could not reset sequence for ${tableName}:`, error.message);
  }
}

async function main() {
  const dumpPath = path.join(__dirname, 'db_dump.json');
  if (!fs.existsSync(dumpPath)) {
    console.error(`Error: File ${dumpPath} not found. Please run the dump script first.`);
    process.exit(1);
  }

  console.log("Reading dump file...");
  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));

  console.log("Starting data load into the database configured in .env...");

  // 1. User
  await loadTable('User', dump.User, (batch) =>
    prisma.user.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('User');

  // 2. Anime
  await loadTable('Anime', dump.Anime, (batch) =>
    prisma.anime.createMany({ data: batch, skipDuplicates: true })
  );

  // 3. Manga
  await loadTable('Manga', dump.Manga, (batch) =>
    prisma.manga.createMany({ data: batch, skipDuplicates: true })
  );

  // 4. Media
  await loadTable('Media', dump.Media, (batch) =>
    prisma.media.createMany({ data: batch, skipDuplicates: true })
  );

  // 5. Achievement
  await loadTable('Achievement', dump.Achievement, (batch) =>
    prisma.achievement.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('Achievement');

  // 6. GenreTag
  await loadTable('GenreTag', dump.GenreTag, (batch) =>
    prisma.genreTag.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('GenreTag');

  // 7. GiftCode
  await loadTable('GiftCode', dump.GiftCode, (batch) =>
    prisma.giftCode.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('GiftCode');

  // 8. ChatSession
  await loadTable('ChatSession', dump.ChatSession, (batch) =>
    prisma.chatSession.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('ChatSession');

  // 9. ChatMessage
  await loadTable('ChatMessage', dump.ChatMessage, (batch) =>
    prisma.chatMessage.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('ChatMessage');

  // 10. UserAnime
  await loadTable('UserAnime', dump.UserAnime, (batch) =>
    prisma.userAnime.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('UserAnime');

  // 11. UserManga
  await loadTable('UserManga', dump.UserManga, (batch) =>
    prisma.userManga.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('UserManga');

  // 12. UserTopFavorite
  await loadTable('UserTopFavorite', dump.UserTopFavorite, (batch) =>
    prisma.userTopFavorite.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('UserTopFavorite');

  // 13. UserStatistics
  await loadTable('UserStatistics', dump.UserStatistics, (batch) =>
    prisma.userStatistics.createMany({ data: batch, skipDuplicates: true })
  );

  // 14. UserAchievement
  await loadTable('UserAchievement', dump.UserAchievement, (batch) =>
    prisma.userAchievement.createMany({ data: batch, skipDuplicates: true })
  );

  // 15. UserSubscription
  await loadTable('UserSubscription', dump.UserSubscription, (batch) =>
    prisma.userSubscription.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('UserSubscription');

  // 16. UserRating
  await loadTable('UserRating', dump.UserRating, (batch) =>
    prisma.userRating.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('User_Rating');

  // 17. Comment
  await loadTable('Comment', dump.Comment, (batch) =>
    prisma.comment.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('User_Comment');

  // 18. CustomList
  await loadTable('CustomList', dump.CustomList, (batch) =>
    prisma.customList.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('CustomList');

  // 19. CustomListItem
  await loadTable('CustomListItem', dump.CustomListItem, (batch) =>
    prisma.customListItem.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('CustomListItem');

  // 20. Notification
  await loadTable('Notification', dump.Notification, (batch) =>
    prisma.notification.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('Notification');

  // 21. SyncLog
  await loadTable('SyncLog', dump.SyncLog, (batch) =>
    prisma.syncLog.createMany({ data: batch, skipDuplicates: true })
  );
  await resetSequence('SyncLog');

  console.log("Data restore completed successfully!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
