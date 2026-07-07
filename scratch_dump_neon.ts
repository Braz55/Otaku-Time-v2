import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function dumpTable(tableName: string, queryFn: () => Promise<any[]>) {
  console.log(`Dumping table ${tableName}...`);
  try {
    const data = await queryFn();
    console.log(`Fetched ${data.length} records from ${tableName}.`);
    return data;
  } catch (error) {
    console.error(`Error dumping table ${tableName}:`, error);
    return [];
  }
}

async function main() {
  console.log("Starting Neon database dump...");

  const dump: Record<string, any[]> = {};

  dump.User = await dumpTable('User', () => prisma.user.findMany());
  dump.Anime = await dumpTable('Anime', () => prisma.anime.findMany());
  dump.UserAnime = await dumpTable('UserAnime', () => prisma.userAnime.findMany());
  dump.Manga = await dumpTable('Manga', () => prisma.manga.findMany());
  dump.UserManga = await dumpTable('UserManga', () => prisma.userManga.findMany());
  dump.ChatSession = await dumpTable('ChatSession', () => prisma.chatSession.findMany());
  dump.ChatMessage = await dumpTable('ChatMessage', () => prisma.chatMessage.findMany());
  dump.SyncLog = await dumpTable('SyncLog', () => prisma.syncLog.findMany());
  dump.UserTopFavorite = await dumpTable('UserTopFavorite', () => prisma.userTopFavorite.findMany());
  dump.UserStatistics = await dumpTable('UserStatistics', () => prisma.userStatistics.findMany());
  dump.Achievement = await dumpTable('Achievement', () => prisma.achievement.findMany());
  dump.UserAchievement = await dumpTable('UserAchievement', () => prisma.userAchievement.findMany());
  dump.UserSubscription = await dumpTable('UserSubscription', () => prisma.userSubscription.findMany());
  dump.GiftCode = await dumpTable('GiftCode', () => prisma.giftCode.findMany());
  dump.Media = await dumpTable('Media', () => prisma.media.findMany());
  dump.UserRating = await dumpTable('UserRating', () => prisma.userRating.findMany());
  dump.Comment = await dumpTable('Comment', () => prisma.comment.findMany());
  dump.GenreTag = await dumpTable('GenreTag', () => prisma.genreTag.findMany());
  dump.CustomList = await dumpTable('CustomList', () => prisma.customList.findMany());
  dump.CustomListItem = await dumpTable('CustomListItem', () => prisma.customListItem.findMany());
  dump.Notification = await dumpTable('Notification', () => prisma.notification.findMany());

  const outputPath = path.join(__dirname, 'db_dump.json');
  console.log(`Writing dump to ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2), 'utf-8');
  console.log("Dump completed successfully!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
