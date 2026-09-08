// Teste do algoritmo de importação do TV Time mapeado por contagem de episódios

interface Episode {
  season: number;
  episodeNumber: number;
  globalEpisodeNumber?: number | null;
}

interface DBAnime {
  episodesList: Episode[] | null;
}

function processProgress(watchedCount: number, jsonMaxSeason: number, jsonMaxEpisode: number, dbAnime: DBAnime) {
  let maxSeason = 1;
  let maxEpisode = 0;

  if (dbAnime && dbAnime.episodesList && Array.isArray(dbAnime.episodesList) && dbAnime.episodesList.length > 0) {
    const filteredEpisodes = (dbAnime.episodesList as any[])
      .filter(ep => ep.season > 0)
      .sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.episodeNumber - b.episodeNumber;
      });

    if (watchedCount > 0 && filteredEpisodes.length > 0) {
      if (watchedCount <= filteredEpisodes.length) {
        const targetEp = filteredEpisodes[watchedCount - 1];
        maxSeason = targetEp.season;
        maxEpisode = targetEp.episodeNumber;
      } else {
        const targetEp = filteredEpisodes[filteredEpisodes.length - 1];
        maxSeason = targetEp.season;
        maxEpisode = targetEp.episodeNumber;
      }
    } else {
      maxSeason = 1;
      maxEpisode = 0;
    }
  } else {
    maxSeason = jsonMaxSeason;
    maxEpisode = jsonMaxEpisode;
  }

  return { maxSeason, maxEpisode };
}

// Mock de episódios da BD:
// Temporada 1: 12 episódios
// Temporada 2: 12 episódios
// Specials (Temporada 0): 2 episódios
const mockEpisodes: Episode[] = [
  { season: 0, episodeNumber: 1 },
  { season: 0, episodeNumber: 2 },
  { season: 1, episodeNumber: 1 },
  { season: 1, episodeNumber: 2 },
  { season: 1, episodeNumber: 3 },
  { season: 1, episodeNumber: 4 },
  { season: 1, episodeNumber: 5 },
  { season: 1, episodeNumber: 6 },
  { season: 1, episodeNumber: 7 },
  { season: 1, episodeNumber: 8 },
  { season: 1, episodeNumber: 9 },
  { season: 1, episodeNumber: 10 },
  { season: 1, episodeNumber: 11 },
  { season: 1, episodeNumber: 12 },
  { season: 2, episodeNumber: 1 },
  { season: 2, episodeNumber: 2 },
  { season: 2, episodeNumber: 3 },
  { season: 2, episodeNumber: 4 },
  { season: 2, episodeNumber: 5 },
  { season: 2, episodeNumber: 6 },
  { season: 2, episodeNumber: 7 },
  { season: 2, episodeNumber: 8 },
  { season: 2, episodeNumber: 9 },
  { season: 2, episodeNumber: 10 },
  { season: 2, episodeNumber: 11 },
  { season: 2, episodeNumber: 12 },
];

console.log("=== INICIANDO TESTES DO ALGORITMO DE IMPORTAÇÃO ===");

// Caso 1: Utilizador assistiu a 5 episódios (deve dar S01E05)
let res = processProgress(5, 1, 5, { episodesList: mockEpisodes });
console.log(`Caso 1 (Esperado S01E05): S${res.maxSeason.toString().padStart(2, '0')}E${res.maxEpisode.toString().padStart(2, '0')} -> ${res.maxSeason === 1 && res.maxEpisode === 5 ? "PASS" : "FAIL"}`);

// Caso 2: Utilizador assistiu a 15 episódios (deve dar S02E03, já que S01 tem 12 episódios)
res = processProgress(15, 2, 3, { episodesList: mockEpisodes });
console.log(`Caso 2 (Esperado S02E03): S${res.maxSeason.toString().padStart(2, '0')}E${res.maxEpisode.toString().padStart(2, '0')} -> ${res.maxSeason === 2 && res.maxEpisode === 3 ? "PASS" : "FAIL"}`);

// Caso 3: Sem episódios na BD (deve usar fallback do JSON)
res = processProgress(15, 2, 10, { episodesList: null });
console.log(`Caso 3 (Esperado S02E10 via Fallback): S${res.maxSeason.toString().padStart(2, '0')}E${res.maxEpisode.toString().padStart(2, '0')} -> ${res.maxSeason === 2 && res.maxEpisode === 10 ? "PASS" : "FAIL"}`);

// Caso 4: Utilizador viu mais episódios do que existem na BD (ex: viu 30 mas só temos 24)
res = processProgress(30, 3, 6, { episodesList: mockEpisodes });
console.log(`Caso 4 (Esperado S02E12 - Último da BD): S${res.maxSeason.toString().padStart(2, '0')}E${res.maxEpisode.toString().padStart(2, '0')} -> ${res.maxSeason === 2 && res.maxEpisode === 12 ? "PASS" : "FAIL"}`);

// Caso 5: Assistiu a 0 episódios
res = processProgress(0, 1, 0, { episodesList: mockEpisodes });
console.log(`Caso 5 (Esperado S01E00): S${res.maxSeason.toString().padStart(2, '0')}E${res.maxEpisode.toString().padStart(2, '0')} -> ${res.maxSeason === 1 && res.maxEpisode === 0 ? "PASS" : "FAIL"}`);
