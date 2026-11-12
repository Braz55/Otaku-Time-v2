// Verificação antes da migração 20261112130000_media_source_natural_key (só leitura).
// Lista animes que parecem ter ainda um ID antigo da AniList. Deve mostrar 0 linhas.
// Uso: node testes_e_scripts/verificar_animes_anilist.js
require('dotenv/config');
const { Client } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido no .env');
  console.log('Base de dados:', url.replace(/\/\/[^@]*@/, '//***@').split('?')[0]);

  const client = new Client({
    connectionString: url.split('?')[0],
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT "id", "titulo", "formato" FROM "Anime"
      WHERE "formato" NOT IN ('TV', 'MOVIE') OR "formato" IS NULL
         OR ("formato" = 'TV' AND "episodesList" IS NULL)
      ORDER BY "id"
    `);
    if (rows.length === 0) {
      console.log('OK: 0 linhas. Pode aplicar a migração.');
    } else {
      console.log(`ATENÇÃO: ${rows.length} anime(s) suspeitos:`);
      console.table(rows);
    }
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
