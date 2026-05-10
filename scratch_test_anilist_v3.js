const q = `query { Page(perPage: 3) { media(sort: POPULARITY_DESC, type: ANIME) { id title { romaji } } } }`;
fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: q })
})
.then(r => r.json())
.then(data => console.log('POPULAR LIST:', JSON.stringify(data)))
.catch(console.error);
