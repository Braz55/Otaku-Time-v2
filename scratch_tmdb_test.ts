import 'dotenv/config';

// Script de teste para simular as chamadas da API do TMDB e o mapeamento dos dados.
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.error("ERRO: TMDB_API_KEY não foi configurado no ficheiro .env!");
  console.log("Por favor, adiciona 'TMDB_API_KEY=\"a_tua_chave\"' ao teu .env e corre o script novamente.");
  process.exit(1);
}

const apiKey: string = TMDB_API_KEY;

// Helper para fazer as chamadas à API do TMDB
async function fetchTMDB(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  
  // Deteta se a chave é um Bearer Token (v4) ou uma API Key normal (v3)
  const isBearer = apiKey.startsWith('eyJ');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (isBearer) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    url.searchParams.append('api_key', apiKey);
  }

  // Adiciona suporte a idioma português nas chamadas
  url.searchParams.append('language', 'pt-PT');

  for (const [key, val] of Object.entries(params)) {
    url.searchParams.append(key, val);
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Erro na API do TMDB [${response.status}]: ${response.statusText}`);
  }
  return response.json();
}

async function testTMDBIntegration() {
  console.log("==================================================");
  console.log("🚀 A iniciar teste de integração com a API do TMDB...");
  console.log("==================================================\n");

  const query = "Attack on Titan";
  console.log(`1. A pesquisar série/anime: "${query}"...`);
  
  // 1. Pesquisa
  const searchResults = await fetchTMDB('/search/tv', { query });
  if (!searchResults.results || searchResults.results.length === 0) {
    console.log("Nenhum resultado encontrado.");
    return;
  }

  console.log("\n   Resultados da pesquisa (primeiros 5):");
  searchResults.results.slice(0, 5).forEach((res: any, index: number) => {
    console.log(`   [${index + 1}] "${res.name}" (Original: "${res.original_name}") | ID: ${res.id} | Popularidade: ${res.popularity}`);
  });
  console.log("\n");

  // Ordenar resultados por popularidade decrescente para encontrar a série principal
  const sortedResults = [...searchResults.results].sort((a: any, b: any) => b.popularity - a.popularity);
  const mainShow = sortedResults[0];
  console.log(`   Série selecionada (mais popular): "${mainShow.name}" (ID TMDB: ${mainShow.id})`);
  console.log(`   Data de Estreia: ${mainShow.first_air_date}`);
  console.log(`   Nota Média: ${mainShow.vote_average}/10 (${mainShow.vote_count} votos)`);
  console.log(`   Sinopse: ${mainShow.overview || 'Sem sinopse.'}\n`);

  // 2. Detalhes da Série
  console.log(`2. A obter detalhes completos da série (ID: ${mainShow.id})...`);
  const details = await fetchTMDB(`/tv/${mainShow.id}`);
  
  console.log(`   Título Original: ${details.original_name}`);
  console.log(`   Estado de Lançamento: ${details.status}`); // ex: Returning Series, Ended
  console.log(`   Número Total de Temporadas: ${details.number_of_seasons}`);
  console.log(`   Número Total de Episódios: ${details.number_of_episodes}`);
  
  const seasonsInfo = details.seasons.map((s: any) => ({
    name: s.name,
    number: s.season_number,
    epCount: s.episode_count,
    airDate: s.air_date
  }));
  console.log("   Temporadas mapeadas:", JSON.stringify(seasonsInfo, null, 2));

  if (details.next_episode_to_air) {
    const nextEp = details.next_episode_to_air;
    console.log(`\n   🔔 PRÓXIMO EPISÓDIO DETETADO:`);
    console.log(`   - Temporada: ${nextEp.season_number}, Episódio: ${nextEp.episode_number}`);
    console.log(`   - Data de Estreia: ${nextEp.air_date}`);
  }
  console.log("\n");

  // 3. Obter Episódios da Última Temporada (ou temporada ativa)
  // Vamos usar a temporada 1 ou a mais recente para o teste
  const activeSeasonNum = details.number_of_seasons > 0 ? details.number_of_seasons : 1;
  console.log(`3. A obter lista de episódios da Temporada ${activeSeasonNum}...`);
  const seasonDetails = await fetchTMDB(`/tv/${mainShow.id}/season/${activeSeasonNum}`);
  
  console.log(`   Nome da Temporada: ${seasonDetails.name}`);
  console.log(`   Quantidade de Episódios na Temporada: ${seasonDetails.episodes.length}`);

  // 4. Mapear o nosso JSON de proximosEpisodios
  console.log(`\n4. A simular mapeamento para o JSON 'proximosEpisodios' (exibindo até 5 eps)...`);
  const proximosEpisodios = seasonDetails.episodes.map((ep: any) => {
    return {
      season: ep.season_number,
      episode: ep.episode_number,
      airDate: ep.air_date ? new Date(ep.air_date + "T12:00:00Z").toISOString() : null, // Mapeado para UTC
      notified: false
    };
  });

  console.log(JSON.stringify(proximosEpisodios.slice(0, 5), null, 2));
  if (proximosEpisodios.length > 5) {
    console.log(`   ... e mais ${proximosEpisodios.length - 5} episódios.`);
  }

  // 5. Simular a verificação de Lançamentos Locais
  console.log(`\n5. A simular verificação de episódios recém-lançados...`);
  const simulatedNow = new Date();
  console.log(`   Hora Atual Simulada: ${simulatedNow.toISOString()}`);
  
  let notificationCount = 0;
  for (const ep of proximosEpisodios) {
    if (ep.airDate) {
      const epDate = new Date(ep.airDate);
      if (simulatedNow >= epDate && !ep.notified) {
        console.log(`   🔔 [NOTIFICAÇÃO] O Episódio ${ep.episode} da Temporada ${ep.season} de "${details.name}" já estreou! (Data: ${ep.airDate})`);
        ep.notified = true;
        notificationCount++;
      }
    }
  }
  
  if (notificationCount === 0) {
    console.log("   Nenhuma notificação gerada (todos os episódios futuros estão agendados para datas posteriores).");
  } else {
    console.log(`   Total de notificações simuladas enviadas: ${notificationCount}`);
  }

  console.log("\n==================================================");
  console.log("✅ Teste concluído com sucesso!");
  console.log("==================================================");
}

testTMDBIntegration().catch(err => {
  console.error("\n❌ Erro durante o teste de integração:", err.message);
});
