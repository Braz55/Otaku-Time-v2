-- L-28: o item de lista deixa de guardar uma cópia do ID da obra (anilistMediaId).
-- A obra passa a ser identificada só pela chave estrangeira animeId ou mangaId.

-- Dados existentes: preencher a FK a partir da cópia quando ficou a NULL (ex.: obra apagada com
-- SET NULL) e a obra ainda existe; os itens que continuam sem obra são lixo e são apagados.
UPDATE "CustomListItem" i SET "animeId" = i."anilistMediaId"
WHERE i."mediaType" = 'ANIME' AND i."animeId" IS NULL
  AND EXISTS (SELECT 1 FROM "Anime" a WHERE a."id" = i."anilistMediaId");

UPDATE "CustomListItem" i SET "mangaId" = i."anilistMediaId"
WHERE i."mediaType" = 'MANGA' AND i."mangaId" IS NULL
  AND EXISTS (SELECT 1 FROM "Manga" m WHERE m."id" = i."anilistMediaId");

UPDATE "CustomListItem" SET "mangaId" = NULL WHERE "mediaType" = 'ANIME';
UPDATE "CustomListItem" SET "animeId" = NULL WHERE "mediaType" = 'MANGA';

DELETE FROM "CustomListItem" WHERE "animeId" IS NULL AND "mangaId" IS NULL;

-- Se a cópia e a FK tinham divergido, a mesma obra pode aparecer duas vezes na lista: fica a mais antiga.
DELETE FROM "CustomListItem" a USING "CustomListItem" b
WHERE a."id" > b."id" AND a."listId" = b."listId" AND a."animeId" = b."animeId";

DELETE FROM "CustomListItem" a USING "CustomListItem" b
WHERE a."id" > b."id" AND a."listId" = b."listId" AND a."mangaId" = b."mangaId";

-- DropForeignKey
ALTER TABLE "CustomListItem" DROP CONSTRAINT "CustomListItem_animeId_fkey";

-- DropForeignKey
ALTER TABLE "CustomListItem" DROP CONSTRAINT "CustomListItem_mangaId_fkey";

-- DropIndex
DROP INDEX "CustomListItem_listId_anilistMediaId_mediaType_key";

-- AlterTable
ALTER TABLE "CustomListItem" DROP COLUMN "anilistMediaId";

-- CreateIndex
CREATE UNIQUE INDEX "CustomListItem_listId_animeId_key" ON "CustomListItem"("listId", "animeId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomListItem_listId_mangaId_key" ON "CustomListItem"("listId", "mangaId");

-- AddForeignKey
ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exatamente uma das FKs preenchida, e a que corresponde ao tipo.
ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_media_check" CHECK (
  ("mediaType" = 'ANIME' AND "animeId" IS NOT NULL AND "mangaId" IS NULL) OR
  ("mediaType" = 'MANGA' AND "mangaId" IS NOT NULL AND "animeId" IS NULL)
);
