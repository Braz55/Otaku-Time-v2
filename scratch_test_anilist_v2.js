const q = `query { Media(search: "Naruto", type: ANIME) { id title { romaji } } }`;
fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0'
  },
  body: JSON.stringify({ query: q })
})
.then(r => r.json())
.then(data => console.log('MEDIA DIRECT:', JSON.stringify(data)))
.catch(console.error);

const q2 = `query { Page(perPage: 3) { media(search: "Naruto", type: ANIME) { id } } }`;
fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0'
  },
  body: JSON.stringify({ query: q2 })
})
.then(r => r.json())
.then(data => console.log('PAGE SEARCH:', JSON.stringify(data)))
.catch(console.error);
