-- L-23 + L-24 + L-25 (opção A): uma obra passa a ser identificada pelo par (fonte, id externo).
--   ANILIST    = manga (IDs da AniList)
--   TMDB_TV    = anime/série (IDs de séries do TMDB)
--   TMDB_MOVIE = anime/filme (IDs de filmes do TMDB; numeração separada da das séries)
--
-- Antes de aplicar, confirmar que já não há animes com IDs antigos da AniList (ver a query no fim
-- deste ficheiro). A fonte de cada anime é deduzida do formato: 'MOVIE' → TMDB_MOVIE, resto → TMDB_TV.

-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('ANILIST', 'TMDB_TV', 'TMDB_MOVIE');

-- ---------------------------------------------------------------------------------------------
-- Largar as chaves que vão mudar de forma
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "UserAnime" DROP CONSTRAINT "UserAnime_animeId_fkey";
ALTER TABLE "User_Rating" DROP CONSTRAINT "User_Rating_media_id_media_type_fkey";
ALTER TABLE "CustomListItem" DROP CONSTRAINT "CustomListItem_animeId_fkey";
ALTER TABLE "CustomListItem" DROP CONSTRAINT "CustomListItem_media_check";

DROP INDEX "UserAnime_userId_animeId_key";
DROP INDEX "UserTopFavorite_userId_anilistMediaId_mediaType_key";
DROP INDEX "User_Rating_user_id_media_id_media_type_key";
DROP INDEX "User_Comment_media_id_media_type_idx";
DROP INDEX "CustomListItem_listId_animeId_key";

-- ---------------------------------------------------------------------------------------------
-- Anime: chave (fonte, id)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "Anime" ADD COLUMN "fonte" "MediaSource";
UPDATE "Anime" SET "fonte" = CASE WHEN "formato" = 'MOVIE' THEN 'TMDB_MOVIE' ELSE 'TMDB_TV' END::"MediaSource";
ALTER TABLE "Anime" ALTER COLUMN "fonte" SET NOT NULL;
ALTER TABLE "Anime" DROP CONSTRAINT "Anime_pkey",
ADD CONSTRAINT "Anime_pkey" PRIMARY KEY ("fonte", "id");
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_fonte_check" CHECK ("fonte" IN ('TMDB_TV', 'TMDB_MOVIE'));

-- Fonte de um anime já existente (até aqui o id era único na tabela Anime, por isso há no máximo um)
CREATE TEMPORARY TABLE "_anime_fonte" AS SELECT "id", "fonte" FROM "Anime";

-- ---------------------------------------------------------------------------------------------
-- UserAnime
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "UserAnime" ADD COLUMN "animeFonte" "MediaSource";
UPDATE "UserAnime" u SET "animeFonte" = a."fonte" FROM "_anime_fonte" a WHERE a."id" = u."animeId";
ALTER TABLE "UserAnime" ALTER COLUMN "animeFonte" SET NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- Media: (id, mediaType) → (fonte, id)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "Media" ADD COLUMN "fonte" "MediaSource";
UPDATE "Media" SET "fonte" = 'ANILIST' WHERE "mediaType" = 'MANGA';
UPDATE "Media" m SET "fonte" = COALESCE(
  (SELECT a."fonte" FROM "_anime_fonte" a WHERE a."id" = m."id"), 'TMDB_TV')
WHERE m."mediaType" = 'ANIME';
ALTER TABLE "Media" ALTER COLUMN "fonte" SET NOT NULL;
ALTER TABLE "Media" DROP CONSTRAINT "Media_pkey",
DROP COLUMN "mediaType",
ADD CONSTRAINT "Media_pkey" PRIMARY KEY ("fonte", "id");

-- ---------------------------------------------------------------------------------------------
-- User_Rating
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "User_Rating" ADD COLUMN "media_source" "MediaSource";
UPDATE "User_Rating" SET "media_source" = 'ANILIST' WHERE "media_type" = 'MANGA';
UPDATE "User_Rating" r SET "media_source" = COALESCE(
  (SELECT a."fonte" FROM "_anime_fonte" a WHERE a."id" = r."media_id"), 'TMDB_TV')
WHERE r."media_type" = 'ANIME';
ALTER TABLE "User_Rating" ALTER COLUMN "media_source" SET NOT NULL;
ALTER TABLE "User_Rating" DROP COLUMN "media_type";

-- ---------------------------------------------------------------------------------------------
-- User_Comment
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "User_Comment" ADD COLUMN "media_source" "MediaSource";
UPDATE "User_Comment" SET "media_source" = 'ANILIST' WHERE "media_type" = 'MANGA';
UPDATE "User_Comment" c SET "media_source" = COALESCE(
  (SELECT a."fonte" FROM "_anime_fonte" a WHERE a."id" = c."media_id"), 'TMDB_TV')
WHERE c."media_type" = 'ANIME';
ALTER TABLE "User_Comment" ALTER COLUMN "media_source" SET NOT NULL;
ALTER TABLE "User_Comment" DROP COLUMN "media_type";

-- ---------------------------------------------------------------------------------------------
-- UserTopFavorite: anilistMediaId → (fonte, mediaId); mediaType fica como prateleira do destaque
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "UserTopFavorite" RENAME COLUMN "anilistMediaId" TO "mediaId";
ALTER TABLE "UserTopFavorite" ADD COLUMN "fonte" "MediaSource";
UPDATE "UserTopFavorite" SET "fonte" = 'ANILIST' WHERE "mediaType" = 'MANGA';
UPDATE "UserTopFavorite" f SET "fonte" = COALESCE(
  (SELECT a."fonte" FROM "_anime_fonte" a WHERE a."id" = f."mediaId"), 'TMDB_TV')
WHERE f."mediaType" = 'ANIME';
ALTER TABLE "UserTopFavorite" ALTER COLUMN "fonte" SET NOT NULL;
ALTER TABLE "UserTopFavorite" ADD CONSTRAINT "UserTopFavorite_fonte_check" CHECK (
  ("mediaType" = 'MANGA') = ("fonte" = 'ANILIST')
);

-- ---------------------------------------------------------------------------------------------
-- Notification: fonte da obra (null nas notificações de sistema)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "Notification" ADD COLUMN "fonte" "MediaSource";
UPDATE "Notification" SET "fonte" = 'ANILIST' WHERE "type" = 'MANGA' AND "mediaId" IS NOT NULL;
UPDATE "Notification" n SET "fonte" = COALESCE(
  (SELECT a."fonte" FROM "_anime_fonte" a WHERE a."id" = n."mediaId"), 'TMDB_TV')
WHERE n."type" = 'ANIME' AND n."mediaId" IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- CustomListItem: mediaType → fonte
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "CustomListItem" ADD COLUMN "fonte" "MediaSource";
UPDATE "CustomListItem" SET "fonte" = 'ANILIST' WHERE "mediaType" = 'MANGA';
UPDATE "CustomListItem" i SET "fonte" = a."fonte"
FROM "_anime_fonte" a WHERE i."mediaType" = 'ANIME' AND a."id" = i."animeId";
ALTER TABLE "CustomListItem" ALTER COLUMN "fonte" SET NOT NULL;
ALTER TABLE "CustomListItem" DROP COLUMN "mediaType";
ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_media_check" CHECK (
  ("fonte" = 'ANILIST' AND "mangaId" IS NOT NULL AND "animeId" IS NULL) OR
  ("fonte" IN ('TMDB_TV', 'TMDB_MOVIE') AND "animeId" IS NOT NULL AND "mangaId" IS NULL)
);

DROP TABLE "_anime_fonte";

-- ---------------------------------------------------------------------------------------------
-- Novas chaves
-- ---------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX "UserAnime_userId_animeFonte_animeId_key" ON "UserAnime"("userId", "animeFonte", "animeId");
CREATE UNIQUE INDEX "UserTopFavorite_userId_fonte_mediaId_key" ON "UserTopFavorite"("userId", "fonte", "mediaId");
CREATE UNIQUE INDEX "User_Rating_user_id_media_source_media_id_key" ON "User_Rating"("user_id", "media_source", "media_id");
CREATE INDEX "User_Comment_media_source_media_id_idx" ON "User_Comment"("media_source", "media_id");
CREATE UNIQUE INDEX "CustomListItem_listId_fonte_animeId_key" ON "CustomListItem"("listId", "fonte", "animeId");

ALTER TABLE "UserAnime" ADD CONSTRAINT "UserAnime_animeFonte_animeId_fkey" FOREIGN KEY ("animeFonte", "animeId") REFERENCES "Anime"("fonte", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User_Rating" ADD CONSTRAINT "User_Rating_media_source_media_id_fkey" FOREIGN KEY ("media_source", "media_id") REFERENCES "Media"("fonte", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_fonte_animeId_fkey" FOREIGN KEY ("fonte", "animeId") REFERENCES "Anime"("fonte", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Verificação a correr ANTES de aplicar (deve devolver 0 linhas). Um formato fora de TV/MOVIE ou
-- uma série sem lista de episódios indica um anime com ID antigo da AniList, que tem de ser
-- migrado para o TMDB primeiro (basta abri-lo na app: a migração preguiçosa trata dele).
--
--   SELECT "id", "titulo", "formato" FROM "Anime"
--   WHERE "formato" NOT IN ('TV', 'MOVIE') OR "formato" IS NULL
--      OR ("formato" = 'TV' AND "episodesList" IS NULL);
-- ---------------------------------------------------------------------------------------------
