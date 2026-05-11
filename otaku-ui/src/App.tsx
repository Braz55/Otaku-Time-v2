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
  const [resultadosDB, setResultadosDB] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'home' | 'details'>('home');
  const [selectedItem, setSelectedItem] = useState<any>(null);

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

  // 4. Abrir Detalhes (DB ou AniList)
  const abrirDetalhes = async (idOrTitle: number | string, isExternal: boolean = false) => {
    setLoading(true);
    const endpoint = isExternal ? 'external' : '';
    const url = `http://localhost:3001/${categoria}${endpoint ? '/' + endpoint : ''}/${encodeURIComponent(idOrTitle)}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      // Normalização dos dados para a interface de detalhes
      if (isExternal) {
        const normalized = {
          id: data.id, // ID da AniList (não usado para delete)
          titulo: data.title.english || data.title.romaji,
          capaUrl: data.coverImage.large,
          descricao: data.description ? data.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.",
          generos: data.genres ? data.genres.join(', ') : (data.tags ? data.tags.map((t: any) => t.name).join(', ') : ''),
          statusLancamento: data.status,
          numEpisodiosTotal: data.episodes,
          numCapitulosTotal: data.chapters,
          temporada: data.season,
          ano: data.seasonYear,
          isExternal: true
        };
        setSelectedItem(normalized);
      } else {
        setSelectedItem({ ...data, isExternal: false });
      }
      
      setView('details');
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoading(false);
    }
  };

  // 5. Remover da Lista
  const removerDaLista = async (id: number) => {
    if (!window.confirm("Tens a certeza que queres remover este item da tua lista?")) return;
    
    const url = `http://localhost:3001/${categoria}/${id}`;
    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (response.ok) {
        setView('home');
        setResultadosDB(prev => prev.filter(item => item.id !== id));
      } else {
        alert("Erro ao remover.");
      }
    } catch (error) {
      console.error("Erro ao remover:", error);
    }
  };

  // 6. Atualizar Progresso (Episódios/Capítulos)
  const atualizarProgresso = async (delta: number) => {
    if (!selectedItem || selectedItem.isExternal) return;

    const campo = categoria === 'anime' ? 'epAtual' : 'capAtual';
    const novoValor = (selectedItem[campo] || 0) + delta;
    
    if (novoValor < 0) return;

    // Optimistic UI: Atualiza logo no ecrã para parecer instantâneo
    setSelectedItem((prev: any) => ({ ...prev, [campo]: novoValor }));

    const url = `http://localhost:3001/${categoria}/${selectedItem.id}`;
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: novoValor })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Sincroniza com os dados reais (ex: status pode ter mudado para "Completo")
        setSelectedItem((prev: any) => ({ ...prev, ...data }));
        // Atualiza também na lista principal
        setResultadosDB(prev => prev.map(item => item.id === selectedItem.id ? { ...item, ...data } : item));
      }
    } catch (error) {
      console.error("Erro ao atualizar progresso:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1014] text-gray-200 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {view === 'home' ? (
          <>
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent cursor-pointer" onClick={() => setView('home')}>
                  Otaku Time
                </h1>
                <p className="text-gray-500 mt-1">Gerencia a tua coleção de Anime e Manga</p>
              </div>
              
              <div className="flex items-center gap-4 bg-[#1a1c23] p-2 rounded-xl border border-gray-800">
                <button 
                  onClick={() => { setCategoria('anime'); setResultadosDB([]); setResultadosPesquisa([]); }}
                  className={`px-4 py-2 rounded-lg transition-all ${categoria === 'anime' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'hover:bg-gray-800'}`}
                >
                  Anime
                </button>
                <button 
                  onClick={() => { setCategoria('manga'); setResultadosDB([]); setResultadosPesquisa([]); }}
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
                      <div 
                        key={item.id} 
                        onClick={() => abrirDetalhes(item.title.english || item.title.romaji, true)}
                        className="group cursor-pointer bg-[#1a1c23] rounded-2xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all hover:-translate-y-1"
                      >
                        <div className="relative aspect-[3/4]">
                          <img 
                            src={item.coverImage.large} 
                            alt={item.title.english || item.title.romaji} 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                            <span className="text-white font-semibold">Ver Detalhes</span>
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
                    <div 
                      key={item.id} 
                      onClick={() => abrirDetalhes(item.id)}
                      className="group cursor-pointer bg-[#1a1c23] rounded-2xl overflow-hidden border border-gray-800 hover:border-pink-500/30 transition-all"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <img 
                          src={item.capaUrl} 
                          alt={item.titulo} 
                          className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white font-semibold">Ver Detalhes</span>
                        </div>
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
          </>
        ) : (
          /* Details View */
          <div className="animate-slide-up">
            <button 
              onClick={() => setView('home')}
              className="mb-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar para a Lista
            </button>

            {selectedItem && (
              <div className="bg-[#1a1c23] rounded-3xl overflow-hidden border border-gray-800 shadow-2xl">
                <div className="relative h-64 md:h-96">
                  <div className="absolute inset-0 overflow-hidden">
                    <img src={selectedItem.capaUrl} className="w-full h-full object-cover blur-2xl opacity-30 scale-110" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c23] via-transparent to-transparent"></div>
                  </div>
                  
                  <div className="relative h-full flex flex-col md:flex-row items-end p-8 gap-8">
                    <div className="w-40 md:w-64 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-800 flex-shrink-0">
                      <img src={selectedItem.capaUrl} className="w-full h-full object-cover" alt={selectedItem.titulo} />
                    </div>
                    <div className="flex-1 pb-4">
                      <h2 className="text-4xl md:text-6xl font-bold mb-4">{selectedItem.titulo}</h2>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.generos?.split(',').map((g: string) => (
                          <span key={g} className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-gray-300 border border-white/5">
                            {g.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid md:grid-cols-3 gap-12">
                  <div className="md:col-span-2 space-y-8">
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                        Sinopse
                      </h3>
                      <p className="text-gray-400 leading-relaxed text-lg">
                        {selectedItem.descricao || "Sem descrição disponível."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-8 py-8 border-t border-gray-800">
                      <div className="space-y-1">
                        <p className="text-gray-500 text-sm uppercase tracking-wider">Status</p>
                        <p className="font-semibold text-purple-400">{selectedItem.statusLancamento}</p>
                      </div>
                      {categoria === 'anime' ? (
                        <>
                          <div className="space-y-1">
                            <p className="text-gray-500 text-sm uppercase tracking-wider">Progresso</p>
                            <div className="flex items-center gap-4">
                              {!selectedItem.isExternal && (
                                <button 
                                  onClick={() => atualizarProgresso(-1)}
                                  className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center border border-gray-700 transition-colors"
                                >
                                  -
                                </button>
                              )}
                              <p className="font-semibold text-xl">
                                <span className="text-purple-400">{selectedItem.epAtual}</span> / {selectedItem.numEpisodiosTotal || '?'}
                              </p>
                              {!selectedItem.isExternal && (
                                <button 
                                  onClick={() => atualizarProgresso(1)}
                                  className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center shadow-lg shadow-purple-900/20 transition-all active:scale-90"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-gray-500 text-sm uppercase tracking-wider">Temporada</p>
                            <p className="font-semibold capitalize">{selectedItem.temporada} {selectedItem.ano}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <p className="text-gray-500 text-sm uppercase tracking-wider">Capítulos</p>
                            <div className="flex items-center gap-4">
                              {!selectedItem.isExternal && (
                                <button 
                                  onClick={() => atualizarProgresso(-1)}
                                  className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center border border-gray-700 transition-colors"
                                >
                                  -
                                </button>
                              )}
                              <p className="font-semibold text-xl">
                                <span className="text-pink-400">{selectedItem.capAtual}</span> / {selectedItem.numCapitulosTotal || '?'}
                              </p>
                              {!selectedItem.isExternal && (
                                <button 
                                  onClick={() => atualizarProgresso(1)}
                                  className="w-8 h-8 rounded-full bg-pink-600 hover:bg-pink-700 flex items-center justify-center shadow-lg shadow-pink-900/20 transition-all active:scale-90"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-gray-500 text-sm uppercase tracking-wider">Prioridade</p>
                            <p className="font-semibold text-pink-400">{selectedItem.prioridade}/10</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700/50">
                      <h4 className="font-semibold mb-4">Ações</h4>
                      {selectedItem.isExternal ? (
                        <button 
                          onClick={() => {
                            adicionarAoBanco(selectedItem.titulo);
                            setView('home');
                          }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Adicionar à Minha Lista
                        </button>
                      ) : (
                        <button 
                          onClick={() => removerDaLista(selectedItem.id)}
                          className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remover da Lista
                        </button>
                      )}
                    </div>

                    <div className="bg-purple-600/10 p-6 rounded-2xl border border-purple-500/20">
                      <p className="text-sm text-purple-300">
                        {categoria === 'anime' ? 'A acompanhar este anime' : 'A ler este manga'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;