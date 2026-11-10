-- L-24: avaliações e comentários passam a identificar a obra pelo par (id, tipo).
-- L-26: apagar um utilizador apaga também a sua biblioteca.
-- DropForeignKey
ALTER TABLE "UserAnime" DROP CONSTRAINT "UserAnime_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserManga" DROP CONSTRAINT "UserManga_userId_fkey";

-- DropForeignKey
ALTER TABLE "User_Rating" DROP CONSTRAINT "User_Rating_media_id_fkey";

-- DropIndex
DROP INDEX "User_Rating_user_id_media_id_key";

-- AlterTable
ALTER TABLE "Media" DROP CONSTRAINT "Media_pkey",
ADD COLUMN     "mediaType" "MediaType" NOT NULL DEFAULT 'ANIME',
ADD CONSTRAINT "Media_pkey" PRIMARY KEY ("id", "mediaType");

-- AlterTable
ALTER TABLE "User_Rating" ADD COLUMN     "media_type" "MediaType" NOT NULL DEFAULT 'ANIME';

-- AlterTable
ALTER TABLE "User_Comment" ADD COLUMN     "media_type" "MediaType" NOT NULL DEFAULT 'ANIME';

-- CreateIndex
CREATE UNIQUE INDEX "User_Rating_user_id_media_id_media_type_key" ON "User_Rating"("user_id", "media_id", "media_type");

-- CreateIndex
CREATE INDEX "User_Comment_media_id_media_type_idx" ON "User_Comment"("media_id", "media_type");

-- AddForeignKey
ALTER TABLE "UserAnime" ADD CONSTRAINT "UserAnime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserManga" ADD CONSTRAINT "UserManga_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User_Rating" ADD CONSTRAINT "User_Rating_media_id_media_type_fkey" FOREIGN KEY ("media_id", "media_type") REFERENCES "Media"("id", "mediaType") ON DELETE CASCADE ON UPDATE CASCADE;


-- Dados existentes: até aqui tudo era tratado como uma só série de IDs. Uma avaliação ou um comentário
-- passa a MANGA quando o ID só existe no catálogo de manga. Se existir nos dois catálogos não há forma
-- de saber a que obra pertencia, e fica como ANIME (o comportamento anterior para esses casos).
-- O ON UPDATE CASCADE da chave estrangeira leva o tipo da Media para os votos (User_Rating).
UPDATE "Media" SET "mediaType" = 'MANGA'
WHERE "id" IN (SELECT "id" FROM "Manga")
  AND "id" NOT IN (SELECT "id" FROM "Anime");

UPDATE "User_Comment" SET "media_type" = 'MANGA'
WHERE "media_id" IN (SELECT "id" FROM "Manga")
  AND "media_id" NOT IN (SELECT "id" FROM "Anime");
