import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Search, List, ChevronLeft, Plus, Trash2, PlusCircle, MinusCircle, Calendar as CalendarIcon } from 'lucide-react';

// Interfaces
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

const HomePage = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [categoria, setCategoria] = useState<'anime' | 'manga'>('anime');
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [resultadosPesquisa, setResultadosPesquisa] = useState<AniListItem[]>([]);
  const [resultadosDB, setResultadosDB] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'home' | 'details'>('home');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Headers helper
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const pesquisar = async () => {
    if (!termoPesquisa) return;
    setLoading(true);
    const url = `http://localhost:3001/${categoria}/search/${encodeURIComponent(termoPesquisa)}`;
    
    try {
      const response = await fetch(url, { headers: getHeaders() });
      const data = await response.json();
      setResultadosPesquisa(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao pesquisar:", error);
    } finally {
      setLoading(false);
    }
  };

  const adicionarAoBanco = async (titulo: string) => {
    const url = `http://localhost:3001/${categoria}/import`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nome: titulo, userId: user?.id })
      });
      
      if (response.ok) {
        alert(`"${titulo}" adicionado com sucesso!`);
        consultarMinhaLista();
      } else {
        alert("Erro ao adicionar item.");
      }
    } catch (error) {
      console.error("Erro no POST:", error);
    }
  };

  const consultarMinhaLista = async () => {
    setLoading(true);
    const url = `http://localhost:3001/${categoria}`;
    try {
      const response = await fetch(url, { headers: getHeaders() });
      const data = await response.json();
      setResultadosDB(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao consultar DB:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalhes = async (idOrTitle: number | string, isExternal: boolean = false) => {
    setLoading(true);
    const endpoint = isExternal ? 'external' : '';
    const url = `http://localhost:3001/${categoria}${endpoint ? '/' + endpoint : ''}/${encodeURIComponent(idOrTitle)}`;
    
    try {
      const response = await fetch(url, { headers: getHeaders() });
      const data = await response.json();
      
      if (isExternal) {
        const normalized = {
          id: data.id,
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

  const removerDaLista = async (id: number) => {
    if (!window.confirm("Tens a certeza que queres remover este item da tua lista?")) return;
    
    const url = `http://localhost:3001/${categoria}/${id}`;
    try {
      const response = await fetch(url, { 
        method: 'DELETE',
        headers: getHeaders()
      });
      if (response.ok) {
        setView('home');
        setResultadosDB(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error("Erro ao remover:", error);
    }
  };

  const atualizarProgresso = async (delta: number) => {
    if (!selectedItem || selectedItem.isExternal) return;

    const campo = categoria === 'anime' ? 'epAtual' : 'capAtual';
    const novoValor = (selectedItem[campo] || 0) + delta;
    if (novoValor < 0) return;

    setSelectedItem((prev: any) => ({ ...prev, [campo]: novoValor }));

    const url = `http://localhost:3001/${categoria}/${selectedItem.id}`;
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ [campo]: novoValor })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedItem((prev: any) => ({ ...prev, ...data }));
        setResultadosDB(prev => prev.map(item => item.id === selectedItem.id ? { ...item, ...data } : item));
      }
    } catch (error) {
      console.error("Erro ao atualizar progresso:", error);
    }
  };

  useEffect(() => {
    consultarMinhaLista();
  }, [categoria]);

  return (
    <div className="min-h-screen bg-[#0f1014] text-gray-200 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {view === 'home' ? (
          <>
            <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent cursor-pointer" onClick={() => setView('home')}>
                    Otaku Time
                  </h1>
                  <p className="text-gray-500 mt-1">Bem-vindo, {user?.nome}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-[#1a1c23] p-1.5 rounded-xl border border-gray-800">
                  <button 
                    onClick={() => { setCategoria('anime'); setResultadosPesquisa([]); }}
                    className={`px-4 py-2 rounded-lg transition-all ${categoria === 'anime' ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-gray-800'}`}
                  >
                    Anime
                  </button>
                  <button 
                    onClick={() => { setCategoria('manga'); setResultadosPesquisa([]); }}
                    className={`px-4 py-2 rounded-lg transition-all ${categoria === 'manga' ? 'bg-pink-600 text-white shadow-lg' : 'hover:bg-gray-800'}`}
                  >
                    Manga
                  </button>
                </div>
                <button 
                  onClick={() => navigate('/calendar')}
                  className="p-3 bg-purple-600/10 text-purple-400 rounded-xl hover:bg-purple-600 hover:text-white transition-all border border-purple-500/20"
                  title="Calendário"
                >
                  <CalendarIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={logout}
                  className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </header>

            <section className="mb-12">
              <div className="flex gap-2 max-w-2xl mx-auto mb-8">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder={`Procurar ${categoria}...`}
                    className="w-full bg-[#1a1c23] border border-gray-800 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
                    value={termoPesquisa}
                    onChange={(e) => setTermoPesquisa(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && pesquisar()}
                  />
                </div>
                <button 
                  onClick={pesquisar}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all active:scale-95"
                >
                  Pesquisar
                </button>
                <button 
                  onClick={consultarMinhaLista}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-all border border-gray-700 active:scale-95"
                >
                  Ver Minha Lista
                </button>
              </div>

              {loading && <div className="text-center text-purple-400 animate-pulse mb-6">A carregar...</div>}

              {resultadosPesquisa.length > 0 && (
                <div className="animate-slide-up">
                  <h2 className="text-xl mb-6 flex items-center gap-2 font-semibold">
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
                          <img src={item.coverImage.large} className="w-full h-full object-cover" alt={item.title.english} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-semibold">Ver Detalhes</span>
                          </div>
                        </div>
                        <div className="p-4 text-center">
                          <h3 className="text-sm font-medium line-clamp-2 min-h-[40px]">{item.title.english || item.title.romaji}</h3>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {resultadosDB.length > 0 ? (
              <section className="mt-16 animate-slide-up">
                <h2 className="text-xl mb-8 flex items-center gap-2 font-semibold">
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
                        <img src={item.capaUrl} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500" alt={item.titulo} />
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold border border-white/10">
                          {categoria === 'anime' ? `EP ${item.epAtual}` : `CAP ${item.capAtual}`}
                        </div>
                      </div>
                      <div className="p-4 text-center">
                        <h3 className="text-sm font-medium line-clamp-1">{item.titulo}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="mt-16 text-center py-20 border-t border-gray-800/50">
                <div className="bg-[#1a1c23] inline-flex p-6 rounded-full mb-4">
                  <List className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-400">A tua lista de {categoria} está vazia</h3>
                <p className="text-gray-600 mt-2">Pesquisa e adiciona algo para começares a tua jornada!</p>
              </section>
            )}
          </>
        ) : (
          <div className="animate-slide-up">
            <button onClick={() => setView('home')} className="mb-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              Voltar
            </button>

            {selectedItem && (
              <div className="bg-[#1a1c23] rounded-3xl overflow-hidden border border-gray-800 shadow-2xl">
                <div className="relative h-64 md:h-96">
                  <div className="absolute inset-0 overflow-hidden">
                    <img src={selectedItem.capaUrl} className="w-full h-full object-cover blur-3xl opacity-20" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c23] via-transparent to-transparent"></div>
                  </div>
                  
                  <div className="relative h-full flex flex-col md:flex-row items-end p-8 gap-8">
                    <div className="w-40 md:w-64 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-800 flex-shrink-0">
                      <img src={selectedItem.capaUrl} className="w-full h-full object-cover" alt={selectedItem.titulo} />
                    </div>
                    <div className="flex-1 pb-4">
                      <h2 className="text-4xl md:text-5xl font-bold mb-4">{selectedItem.titulo}</h2>
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
                      
                      <div className="space-y-1">
                        <p className="text-gray-500 text-sm uppercase tracking-wider">Progresso</p>
                        <div className="flex items-center gap-4">
                          {!selectedItem.isExternal && (
                            <button onClick={() => atualizarProgresso(-1)} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
                              <MinusCircle className="w-5 h-5" />
                            </button>
                          )}
                          <p className="font-semibold text-xl">
                            <span className="text-purple-400">
                              {categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual}
                            </span> / {categoria === 'anime' ? selectedItem.numEpisodiosTotal || '?' : selectedItem.numCapitulosTotal || '?'}
                          </p>
                          {!selectedItem.isExternal && (
                            <button onClick={() => atualizarProgresso(1)} className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-900/20 transition-all">
                              <PlusCircle className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-gray-800/30 p-6 rounded-2xl border border-gray-700/50 backdrop-blur-md">
                      <h4 className="font-semibold mb-4">Ações</h4>
                      {selectedItem.isExternal ? (
                        <button 
                          onClick={() => { adicionarAoBanco(selectedItem.titulo); setView('home'); }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                        >
                          <Plus className="w-5 h-5" />
                          Adicionar à Minha Lista
                        </button>
                      ) : (
                        <button 
                          onClick={() => removerDaLista(selectedItem.id)}
                          className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-5 h-5" />
                          Remover da Lista
                        </button>
                      )}
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
};

export default HomePage;
