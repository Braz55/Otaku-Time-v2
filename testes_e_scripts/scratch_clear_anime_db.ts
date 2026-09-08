import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 A iniciar a limpeza dos registos antigos de Anime...');

  try {
    const animes = await prisma.anime.findMany({ select: { id: true } });
    const animeIds = animes.map((a: any) => a.id);

    console.log(`Encontrados ${animeIds.length} animes na base de dados.`);

    const deletedUserAnime = await prisma.userAnime.deleteMany({});
    console.log(`✅ Apagados ${deletedUserAnime.count} registos de progresso (UserAnime).`);

    const deletedListItems = await prisma.customListItem.deleteMany({
      where: { mediaType: 'ANIME' }
    });
    console.log(`✅ Apagados ${deletedListItems.count} itens de listas personalizadas (CustomListItem).`);

    const deletedComments = await prisma.comment.deleteMany({
      where: { mediaId: { in: animeIds } }
    });
    console.log(`✅ Apagados ${deletedComments.count} comentários.`);

    const deletedRatings = await prisma.userRating.deleteMany({
      where: { mediaId: { in: animeIds } }
    });
    console.log(`✅ Apagados ${deletedRatings.count} classificações de utilizadores.`);

    const deletedAnimes = await prisma.anime.deleteMany({});
    console.log(`✅ Apagados ${deletedAnimes.count} animes do catálogo global.`);

    const deletedMedia = await prisma.media.deleteMany({
      where: { id: { in: animeIds } }
    });
    console.log(`✅ Apagados ${deletedMedia.count} registos de estatísticas de media.`);

    console.log('\n✨ Limpeza concluída com sucesso! A base de dados de anime está limpa.');
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
