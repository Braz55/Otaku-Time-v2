import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AnimeService } from './src/anime/anime.service';
import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  console.log("Bootstrapping NestJS application context...");
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const animeService = app.get(AnimeService);
  const prisma = app.get(PrismaService);
  
  // Find a user to use for testing
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No user found in the database. Please register/create a user first.");
    await app.close();
    return;
  }
  
  console.log(`Using User: "${user.nome}" (ID: ${user.id})`);
  
  // 1. Test TV Show / Anime import (Chainsaw Man)
  console.log("\n--- TEST 1: Importing TV Show / Anime 'Chainsaw Man' ---");
  try {
    const importRes = await animeService.importFromAniList("Chainsaw Man", user.id);
    console.log("Successfully imported!");
    console.log("Saved Anime Details in DB:");
    const savedAnime = await prisma.anime.findUnique({
      where: { id: importRes.animeId }
    });
    console.log(`Title: ${savedAnime?.titulo}`);
    console.log(`Format: ${savedAnime?.formato}`);
    console.log(`Generos / Keywords saved:`, JSON.stringify(savedAnime?.generos, null, 2));
  } catch (error) {
    console.error("Error during Chainsaw Man import test:", error);
  }

  // 2. Test Movie import (Spirited Away or similar movie)
  console.log("\n--- TEST 2: Importing Movie 'Spirited Away' ---");
  try {
    const importRes = await animeService.importFromAniList("Spirited Away", user.id);
    console.log("Successfully imported!");
    console.log("Saved Movie Details in DB:");
    const savedMovie = await prisma.anime.findUnique({
      where: { id: importRes.animeId }
    });
    console.log(`Title: ${savedMovie?.titulo}`);
    console.log(`Format: ${savedMovie?.formato}`);
    console.log(`Generos / Keywords saved:`, JSON.stringify(savedMovie?.generos, null, 2));
  } catch (error) {
    console.error("Error during Spirited Away import test:", error);
  }
  
  await app.close();
}

bootstrap().catch(console.error);
