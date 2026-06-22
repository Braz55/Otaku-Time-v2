CREATE TABLE "CustomList" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "criteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "CustomList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomListItem" (
    "id" SERIAL NOT NULL,
    "listId" INTEGER NOT NULL,
    "anilistMediaId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animeId" INTEGER,
    "mangaId" INTEGER,

    CONSTRAINT "CustomListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomListItem_listId_anilistMediaId_mediaType_key" ON "CustomListItem"("listId", "anilistMediaId", "mediaType");
CREATE INDEX "CustomListItem_listId_position_idx" ON "CustomListItem"("listId", "position");

ALTER TABLE "CustomList" ADD CONSTRAINT "CustomList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "CustomList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE SET NULL ON UPDATE CASCADE;
