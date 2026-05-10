import { useState } from 'react';

// Interfaces para os dados da AniList (via NestJS)
interface AniListItem {
  id: number;
  title: {
    english: string;
    romaji: string;
  };
  coverImage: {
    large: string;
  };
  status: string;
}

// Interfaces para os dados do SQLite (via NestJS)
interface DBItem {
  id: number;
  titulo: string;
  capaUrl: string;
  generos: string;
}

function App() {
  const [categoria, setCategoria] = useState<'anime' | 'manga'>('anime');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [resultadosPesquisa, setResultadosPesquisa] = useState<AniListItem[]>([]);
  const [resultadosDB, setResultadosDB] = useState<DBItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Pesquisa na AniList (via Backend)
  const pesquisar = async () => {
    if (!termoPesquisa) return;
    setLoading(true);
    const url = `http://localhost:3001/${categoria}/search/${encodeURIComponent(termoPesquisa)}`;
    console.log(`[FETCH] Pesquisando em: ${url}`);
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      setResultadosPesquisa(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao pesquisar:", error);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Adicionar à Lista (Importar para DB)
  const adicionarAoBanco = async (titulo: string) => {
    const url = `http://localhost:3001/${categoria}/import`;
    console.log(`[POST] Importando em: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: titulo, userId: 1 })
      });
      
      if (response.ok) {
        alert(`"${titulo}" adicionado com sucesso!`);
      } else {
        alert("Erro ao adicionar item.");
      }
    } catch (error) {
      console.error("Erro no POST:", error);
    }
  };

  // 3. Consultar a Minha Lista (SQLite)
  const consultarMinhaLista = async () => {
    setLoading(true);
    const url = `http://localhost:3001/${categoria}`;
    console.log(`[FETCH] Consultando DB em: ${url}`);
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      setResultadosDB(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao consultar DB:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1014] text-gray-200 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Otaku Time
            </h1>
            <p className="text-gray-500 mt-1">Gerencia a tua coleção de Anime e Manga</p>
          </div>
          
          <div className="flex items-center gap-4 bg-[#1a1c23] p-2 rounded-xl border border-gray-800">
            <button 
              onClick={() => setCategoria('anime')}
              className={`px-4 py-2 rounded-lg transition-all ${categoria === 'anime' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'hover:bg-gray-800'}`}
            >
              Anime
            </button>
            <button 
              onClick={() => setCategoria('manga')}
              className={`px-4 py-2 rounded-lg transition-all ${categoria === 'manga' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'hover:bg-gray-800'}`}
            >
              Manga
            </button>
          </div>
        </header>

        {/* Search Section */}
        <section className="mb-12">
          <div className="flex gap-2 max-w-2xl mx-auto mb-8">
            <input 
              type="text" 
              placeholder={`Procurar ${categoria}...`}
              className="flex-1 bg-[#1a1c23] border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
              value={termoPesquisa}
              onChange={(e) => setTermoPesquisa(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pesquisar()}
            />
            <button 
              onClick={pesquisar}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all active:scale-95"
            >
              Pesquisar
            </button>
            <button 
              onClick={consultarMinhaLista}
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-all border border-gray-700"
            >
              Ver Minha Lista
            </button>
          </div>

          {loading && <div className="text-center text-purple-400 animate-pulse mb-6">A carregar dados...</div>}

          {/* Search Results Grid */}
          {resultadosPesquisa.length > 0 && (
            <div>
              <h2 className="text-xl mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-purple-500 rounded-full"></span>
                Resultados da Pesquisa
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {resultadosPesquisa.map((item) => (
                  <div key={item.id} className="group bg-[#1a1c23] rounded-2xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all hover:-translate-y-1">
                    <div className="relative aspect-[3/4]">
                      <img 
                        src={item.coverImage.large} 
                        alt={item.title.english || item.title.romaji} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <button 
                          onClick={() => adicionarAoBanco(item.title.english || item.title.romaji)}
                          className="w-full bg-white text-black py-2 rounded-lg font-bold text-sm hover:bg-purple-400 transition-colors"
                        >
                          + Adicionar
                        </button>
                      </div>
                    </div>
                    <div className="p-4 text-center">
                      <h3 className="text-sm font-medium line-clamp-2 min-h-[40px]">
                        {item.title.english || item.title.romaji}
                      </h3>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-2 block">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Database List Section */}
        {resultadosDB.length > 0 && (
          <section className="mt-16 pt-16 border-t border-gray-800">
            <h2 className="text-xl mb-8 flex items-center gap-2">
              <span className="w-2 h-8 bg-pink-500 rounded-full"></span>
              A Minha Coleção ({categoria})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {resultadosDB.map((item) => (
                <div key={item.id} className="bg-[#1a1c23] rounded-2xl overflow-hidden border border-gray-800 hover:border-pink-500/30 transition-all">
                  <div className="aspect-[3/4]">
                    <img 
                      src={item.capaUrl} 
                      alt={item.titulo} 
                      className="w-full h-full object-cover opacity-80"
                    />
                  </div>
                  <div className="p-4 text-center">
                    <h3 className="text-sm font-medium line-clamp-1">{item.titulo}</h3>
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 italic">
                      {item.generos}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

export default App;