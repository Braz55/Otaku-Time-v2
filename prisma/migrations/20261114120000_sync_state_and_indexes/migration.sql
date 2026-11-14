-- Estado da sincronização por obra, separado do updatedAt, e índices usados pela sincronização.
--   lastSyncedAt = última sincronização bem sucedida
--   nextSyncAt   = quando a obra volta a entrar na fila FULL (sucesso: +7 dias; falha: backoff)
--   syncFailures = falhas seguidas
--   syncStatus   = 'OK' ou 'GONE' (a fonte respondeu 404; a obra sai das filas automáticas)

-- AlterTable
ALTER TABLE "Anime" ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "nextSyncAt" TIMESTAMP(3),
ADD COLUMN "syncFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'OK';

ALTER TABLE "Anime" ADD CONSTRAINT "Anime_syncStatus_check" CHECK ("syncStatus" IN ('OK', 'GONE'));

-- AlterTable
ALTER TABLE "Manga" ADD COLUMN "mangaUpdatesId" TEXT,
ADD COLUMN "mangaDexId" TEXT,
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "nextSyncAt" TIMESTAMP(3),
ADD COLUMN "syncFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'OK';

ALTER TABLE "Manga" ADD CONSTRAINT "Manga_syncStatus_check" CHECK ("syncStatus" IN ('OK', 'GONE'));

-- As obras existentes mantêm a cadência que tinham: até aqui a fila FULL guiava-se pelo updatedAt.
UPDATE "Anime" SET "lastSyncedAt" = "updatedAt", "nextSyncAt" = "updatedAt" + INTERVAL '7 days';
UPDATE "Manga" SET "lastSyncedAt" = "updatedAt", "nextSyncAt" = "updatedAt" + INTERVAL '7 days';

-- CreateIndex
CREATE INDEX "Anime_nextSyncAt_idx" ON "Anime"("nextSyncAt");
CREATE INDEX "Anime_statusLancamento_idx" ON "Anime"("statusLancamento");
CREATE INDEX "Manga_nextSyncAt_idx" ON "Manga"("nextSyncAt");
CREATE INDEX "Manga_statusLancamento_idx" ON "Manga"("statusLancamento");
CREATE INDEX "UserAnime_animeFonte_animeId_status_idx" ON "UserAnime"("animeFonte", "animeId", "status");
CREATE INDEX "UserManga_mangaId_status_idx" ON "UserManga"("mangaId", "status");
CREATE INDEX "SyncLog_timestamp_idx" ON "SyncLog"("timestamp");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_type_fonte_mediaId_idx" ON "Notification"("userId", "type", "fonte", "mediaId");
