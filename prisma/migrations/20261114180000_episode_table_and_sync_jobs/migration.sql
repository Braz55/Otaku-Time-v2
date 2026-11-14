-- Fase 2 da sincronização:
--   Episode = um episódio por linha (fonte de verdade); Anime.episodesList passa a ser a cópia
--             de leitura. As linhas das obras existentes são criadas pela aplicação no arranque,
--             a partir do episodesList (EpisodeStoreService.backfillFromJson).
--   SyncJob = fila de sincronização guardada na base de dados.

-- CreateTable
CREATE TABLE "Episode" (
    "animeFonte" "MediaSource" NOT NULL,
    "animeId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "globalEpisodeNumber" INTEGER,
    "name" TEXT,
    "airDate" TIMESTAMP(3),
    "stillPath" TEXT,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("animeFonte","animeId","season","episodeNumber")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "fonte" "MediaSource" NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SyncJob_status_check" CHECK ("status" IN ('PENDING', 'RUNNING', 'DONE', 'FAILED'))
);

-- CreateIndex
CREATE INDEX "Episode_notifiedAt_airDate_idx" ON "Episode"("notifiedAt", "airDate");
CREATE INDEX "SyncJob_status_runAfter_idx" ON "SyncJob"("status", "runAfter");
CREATE INDEX "SyncJob_runId_idx" ON "SyncJob"("runId");

-- No máximo um job por tratar por obra: pôr a mesma obra na fila duas vezes não duplica trabalho
CREATE UNIQUE INDEX "SyncJob_obra_ativa_key" ON "SyncJob"("fonte", "mediaId") WHERE "status" IN ('PENDING', 'RUNNING');

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_animeFonte_animeId_fkey" FOREIGN KEY ("animeFonte", "animeId") REFERENCES "Anime"("fonte", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SyncLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
