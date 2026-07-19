import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const otherTags = await prisma.genreTag.findMany({
    where: {
      category: 'Outros Temas',
      name: {
        endsWith: '\u200b'
      }
    },
    select: { name: true }
  });

  console.log(`Total Anime tags in "Outros Temas": ${otherTags.length}`);
  const cleanNames = otherTags.map(t => t.name.replace(/\u200b/g, ''));
  
  // Print first 200 other tags
  console.log("Sample of 200 tags currently in 'Outros Temas':");
  console.log(JSON.stringify(cleanNames.slice(0, 200), null, 2));

  await app.close();
}

main().catch(err => {
  console.error(err);
});
