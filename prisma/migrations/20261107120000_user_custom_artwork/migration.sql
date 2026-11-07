-- L-15: capa e banner personalizados passam a ser do utilizador, não do catálogo global
ALTER TABLE "UserAnime" ADD COLUMN IF NOT EXISTS "capaPersonalizada" TEXT;
ALTER TABLE "UserAnime" ADD COLUMN IF NOT EXISTS "bannerPersonalizado" TEXT;
ALTER TABLE "UserManga" ADD COLUMN IF NOT EXISTS "capaPersonalizada" TEXT;
ALTER TABLE "UserManga" ADD COLUMN IF NOT EXISTS "bannerPersonalizado" TEXT;
