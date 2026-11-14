// Junta as palavras-chave do TMDB a Anime.generos nos animes que já estão no catálogo, para
// as recomendações de anime não dependerem só dos géneros até à próxima sincronização.
//
//   npx ts-node prisma/backfill-anime-keywords.ts             simulação: mostra o que mudaria
//   npx ts-node prisma/backfill-anime-keywords.ts --apply     grava na base de dados
//   npx ts-node prisma/backfill-anime-keywords.ts --limit 20  só as primeiras 20 obras
//
// Só acrescenta chaves: os géneros e tags que a obra já tem ficam como estão. Pode ser
// corrido várias vezes; uma obra que já tem as palavras-chave não é regravada.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import { extractTmdbKeywordTags } from '../src/anime/tmdb-taste.mapper';

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : undefined;
if (LIMIT !== undefined && (!Number.isInteger(LIMIT) || LIMIT <= 0)) {
  console.error('--limit precisa de um número inteiro positivo.');
  process.exit(1);
}

const apiKey = process.env.TMDB_API_KEY as string;
if (!apiKey) {
  console.error('TMDB_API_KEY não está definida nas variáveis de ambiente.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.split('?')[0],
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const headers: Record<string, string> = { Accept: 'application/json' };
if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey}`;

// Palavras-chave de uma obra; null quando o TMDB responde 404 (a obra já não existe lá).
async function fetchKeywords(
  medium: 'tv' | 'movie',
  id: number,
  attempt = 1,
): Promise<any | null> {
  const url = new URL(`https://api.themoviedb.org/3/${medium}/${id}/keywords`);
  if (!apiKey.startsWith('eyJ')) url.searchParams.append('api_key', apiKey);

  const response = await fetch(url.toString(), { headers });
  if (response.status === 404) return null;
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    const retryAfter = Number(response.headers.get('retry-after'));
    await delay(retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt);
    return fetchKeywords(medium, id, attempt + 1);
  }
  if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
  return response.json();
}

// Anime.generos como dicionário nome → peso (os registos antigos têm texto com vírgulas)
function toDict(generos: unknown): Record<string, number> {
  if (typeof generos === 'string') {
    const dict: Record<string, number> = {};
    generos
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean)
      .forEach((g) => {
        dict[g] = 100;
      });
    return dict;
  }
  if (generos && typeof generos === 'object' && !Array.isArray(generos)) {
    return { ...(generos as Record<string, number>) };
  }
  return {};
}

async function main() {
  console.log(
    APPLY
      ? 'A gravar as palavras-chave do TMDB nos animes...'
      : 'SIMULAÇÃO (nada é gravado). Usa --apply para gravar.',
  );

  const animes = await prisma.anime.findMany({
    select: { id: true, fonte: true, titulo: true, generos: true },
    orderBy: [{ fonte: 'asc' }, { id: 'asc' }],
    take: LIMIT,
  });
  console.log(`${animes.length} obra(s) a verificar.\n`);

  let changed = 0;
  let unchanged = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < animes.length; i++) {
    const anime = animes[i];
    const label = `[${i + 1}/${animes.length}] ${anime.fonte}:${anime.id} "${anime.titulo}"`;
    try {
      // A fonte diz se é série ou filme: o mesmo número no outro tipo é outra obra (L-23)
      const medium = anime.fonte === 'TMDB_MOVIE' ? 'movie' : 'tv';
      const response = await fetchKeywords(medium, anime.id);
      if (!response) {
        console.log(`${label}: não existe no TMDB, ignorada`);
        notFound++;
        continue;
      }

      const generos = toDict(anime.generos);
      const existing = new Set(Object.keys(generos).map((k) => k.toLowerCase()));
      const added: string[] = [];
      for (const tag of extractTmdbKeywordTags({ keywords: response })) {
        if (existing.has(tag.name.toLowerCase())) continue;
        generos[tag.name] = tag.rank;
        added.push(tag.name);
      }

      if (added.length === 0) {
        unchanged++;
      } else {
        console.log(`${label}: + ${added.join(', ')}`);
        if (APPLY) {
          await prisma.anime.update({
            where: { fonte_id: { fonte: anime.fonte, id: anime.id } },
            data: { generos },
          });
        }
        changed++;
      }
    } catch (err: any) {
      console.error(`${label}: erro: ${err?.message ?? err}`);
      errors++;
    }
    await delay(100);
  }

  console.log('\n======================================');
  console.log(
    `${APPLY ? 'Obras atualizadas' : 'Obras que seriam atualizadas'}: ${changed}`,
  );
  console.log(`Sem nada a acrescentar: ${unchanged}`);
  console.log(`Não encontradas no TMDB: ${notFound}`);
  console.log(`Erros: ${errors}`);
  console.log('======================================');
  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('Erro não tratado:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
