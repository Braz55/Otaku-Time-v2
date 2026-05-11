import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { Search, Calendar as CalendarIcon, Sparkles, Loader2, ChevronLeft, Plus, Trash2, PlusCircle, MinusCircle } from 'lucide-react';
import MediaCard from '../components/MediaCard';

// Interfaces
interface AniListItem {
  id: number;
  title: { english: string; romaji: string; };
  coverImage: { large: string; };
  status: string;
  genres?: string[];
}

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
  "Horror", "Mecha", "Mystery", "Psychological", "Romance", 
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
];

const HomePage = () => {
  const { user, token } = useAuth();
  const { categoria, setCategoria, isShowingFavorites, setIsShowingFavorites } = useMedia();
  const navigate = useNavigate();
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [resultadosPesquisa, setResultadosPesquisa] = useState<any[]>([]);
  const [resultadosDB, setResultadosDB] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'home' | 'details'>('home');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const pesquisar = async () => {
    if (!termoPesquisa) return;
    setLoading(true);
    setIsShowingFavorites(false);
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
        setIsShowingFavorites(true);
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
      if (Array.isArray(data)) {
        const sorted = data.sort((a, b) => {
          const posA = a.prioridade || 999;
          const posB = b.prioridade || 999;
          return posA - posB;
        });
        setResultadosDB(sorted);
      }
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
    if (!window.confirm("Tens a certeza que queres remover este item?")) return;
    const url = `http://localhost:3001/${categoria}/${id}`;
    try {
      const response = await fetch(url, { method: 'DELETE', headers: getHeaders() });
      if (response.ok) {
        setView('home');
        consultarMinhaLista();
      }
    } catch (error) {
      console.error("Erro ao remover:", error);
    }
  };

  const atualizarCampo = async (campo: string, valor: any) => {
    if (!selectedItem || selectedItem.isExternal) return;
    setSelectedItem((prev: any) => ({ ...prev, [campo]: valor }));
    const url = `http://localhost:3001/${categoria}/${selectedItem.id}`;
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ [campo]: valor })
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedItem((prev: any) => ({ ...prev, ...data }));
        setResultadosDB(prev => prev.map(item => item.id === selectedItem.id ? { ...item, ...data } : item));
      }
    } catch (error) {
      console.error(`Erro ao atualizar ${campo}:`, error);
    }
  };

  const atualizarProgresso = async (delta: number) => {
    if (!selectedItem || selectedItem.isExternal) return;
    const campo = categoria === 'anime' ? 'epAtual' : 'capAtual';
    const novoValor = (selectedItem[campo] || 0) + delta;
    if (novoValor < 0) return;
    atualizarCampo(campo, novoValor);
  };

  const pesquisarPorGenero = async (genero: string) => {
    setLoading(true);
    setIsShowingFavorites(false);
    setSelectedGenre(genero);
    setTermoPesquisa(''); // Limpa a pesquisa por texto
    
    const url = `http://localhost:3001/${categoria}/genre/${encodeURIComponent(genero)}`;
    try {
      const response = await fetch(url, { headers: getHeaders() });
      const data = await response.json();
      setResultadosPesquisa(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao pesquisar por género:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    consultarMinhaLista();
    if (!isShowingFavorites && termoPesquisa) {
      pesquisar();
    }
    if (!isShowingFavorites && selectedGenre) {
      pesquisarPorGenero(selectedGenre);
    }
  }, [categoria]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {view === 'home' ? (
          <div className="space-y-12">
            {/* Toolbar Section */}
            <section className="flex flex-col items-center gap-8">
              <div className="flex gap-3">
                <button 
                  onClick={() => navigate('/calendar')}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white rounded-xl font-bold transition-all border border-purple-500/20 active:scale-95 text-sm"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Calendário
                </button>
                <button 
                  className="flex items-center gap-2 px-6 py-3 bg-[#1a1c23] hover:bg-gray-800 text-gray-400 rounded-xl font-bold transition-all border border-gray-800 active:scale-95 text-sm"
                  onClick={() => alert("Módulo IA em desenvolvimento...")}
                >
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  Pedir Sugestões
                </button>
              </div>

              {/* Search Bar */}
              <div className="w-full max-w-3xl flex flex-col gap-6">
                <div className="flex gap-3 p-2 bg-[#1a1c23] rounded-3xl border border-gray-800 shadow-2xl focus-within:border-purple-500/50 transition-all">
                  <div className="relative flex-1 flex items-center">
                    <Search className="absolute left-4 w-5 h-5 text-gray-500" />
                    <input 
                      type="text" 
                      placeholder={`Pesquisar ${categoria}s...`}
                      className="w-full bg-transparent pl-12 pr-4 py-3 outline-none text-lg"
                      value={termoPesquisa}
                      onChange={(e) => setTermoPesquisa(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setSelectedGenre(null);
                          pesquisar();
                        }
                      }}
                    />
                  </div>
                  <button 
                    onClick={() => { setSelectedGenre(null); pesquisar(); }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-10 py-3 rounded-2xl font-black transition-all"
                  >
                    PESQUISAR
                  </button>
                </div>

                {/* Genre Chips */}
                <div className="flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 mask-fade-edges">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      onClick={() => pesquisarPorGenero(g)}
                      className={`whitespace-nowrap px-6 py-2.5 rounded-full text-xs font-bold transition-all border ${
                        selectedGenre === g 
                        ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' 
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                      } backdrop-blur-sm`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Results Grid */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <span className={`w-2 h-8 rounded-full ${isShowingFavorites ? 'bg-pink-500' : 'bg-purple-500'}`}></span>
                  {isShowingFavorites ? `A Minha Lista (${categoria})` : resultadosPesquisa.length > 0 ? 'Resultados da Pesquisa' : 'Início'}
                </h2>
                {loading && <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />}
              </div>

              {(isShowingFavorites ? resultadosDB : resultadosPesquisa).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {(isShowingFavorites ? resultadosDB : resultadosPesquisa).map((item) => (
                    <MediaCard 
                      key={item.id}
                      titulo={isShowingFavorites ? item.titulo : (item.title.english || item.title.romaji)}
                      capaUrl={isShowingFavorites ? item.capaUrl : item.coverImage.large}
                      generos={isShowingFavorites ? item.generos : item.genres?.join(', ')}
                      ranking={isShowingFavorites ? item.prioridade : undefined}
                      progresso={isShowingFavorites ? (categoria === 'anime' ? `EP ${item.epAtual}` : `CAP ${item.capAtual}`) : undefined}
                      onClick={() => abrirDetalhes(isShowingFavorites ? item.id : (item.title.english || item.title.romaji), !isShowingFavorites)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-[#1a1c23]/30 rounded-[40px] border border-dashed border-gray-800">
                  <p className="text-gray-500 text-lg">
                    {isShowingFavorites ? 'Ainda não tens itens na tua lista.' : 'Pesquisa algo para começar!'}
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            <button onClick={() => setView('home')} className="mb-10 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              Voltar
            </button>

            {selectedItem && (
              <div className="bg-[#1a1c23] rounded-[40px] overflow-hidden border border-gray-800 shadow-2xl">
                {/* Hero Detail Area */}
                <div className="relative h-[400px] md:h-[500px]">
                  <img src={selectedItem.capaUrl} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c23] via-transparent to-transparent"></div>
                  
                  <div className="relative h-full flex flex-col md:flex-row items-end p-10 gap-10">
                    <div className="w-48 md:w-72 aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-800 flex-shrink-0">
                      <img src={selectedItem.capaUrl} className="w-full h-full object-cover" alt={selectedItem.titulo} />
                    </div>
                    <div className="flex-1 pb-4">
                      <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">{selectedItem.titulo}</h2>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.generos?.split(',').map((g: string) => (
                          <span key={g} className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-black text-gray-300 border border-white/5 uppercase tracking-wider">
                            {g.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Details Area */}
                <div className="p-10 grid md:grid-cols-3 gap-16">
                  <div className="md:col-span-2 space-y-10">
                    <div>
                      <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                        Sinopse
                      </h3>
                      <p className="text-gray-400 leading-relaxed text-xl font-light">
                        {selectedItem.descricao || "Sem descrição disponível."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-12 py-10 border-t border-gray-800/50">
                      <div className="space-y-2">
                        <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">Status</p>
                        <p className="font-bold text-xl text-purple-400 uppercase">{selectedItem.statusLancamento}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">O teu Progresso</p>
                        <div className="flex items-center gap-4">
                          {!selectedItem.isExternal && (
                            <button onClick={() => atualizarProgresso(-1)} className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
                              <MinusCircle className="w-6 h-6" />
                            </button>
                          )}
                          <p className="font-black text-3xl">
                            <span className="text-purple-400">
                              {categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual}
                            </span> 
                            <span className="text-gray-700 mx-2">/</span> 
                            <span className="text-gray-500">{categoria === 'anime' ? selectedItem.numEpisodiosTotal || '?' : selectedItem.numCapitulosTotal || '?'}</span>
                          </p>
                          {!selectedItem.isExternal && (
                            <button onClick={() => atualizarProgresso(1)} className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-900/20 transition-all">
                              <PlusCircle className="w-6 h-6" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Actions */}
                  <div className="space-y-8">
                    <div className="bg-gray-800/20 p-8 rounded-[32px] border border-gray-700/50 backdrop-blur-md">
                      <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                        Ações Rápidas
                      </h4>
                      {selectedItem.isExternal ? (
                        <button 
                          onClick={() => { adicionarAoBanco(selectedItem.titulo); setView('home'); }}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-900/20"
                        >
                          <Plus className="w-6 h-6" />
                          ADICIONAR À LISTA
                        </button>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Posição na Lista</label>
                            <div className="relative">
                              <input 
                                type="number"
                                min="1"
                                value={selectedItem.prioridade || ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseInt(e.target.value);
                                  atualizarCampo('prioridade', val);
                                }}
                                className="w-full bg-black/40 border border-gray-800 rounded-2xl px-5 py-4 focus:border-purple-500 outline-none transition-colors font-black text-2xl text-purple-400"
                                placeholder="Ranking"
                              />
                              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-700 font-black text-xl">#</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => removerDaLista(selectedItem.id)}
                            className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3"
                          >
                            <Trash2 className="w-6 h-6" />
                            REMOVER DA LISTA
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default HomePage;
