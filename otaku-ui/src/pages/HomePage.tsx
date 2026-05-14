import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { Search, Calendar as CalendarIcon, Sparkles, Loader2, ChevronLeft, ChevronRight, ExternalLink as ExternalLinkIcon, Plus, Trash2, PlusCircle, MinusCircle, Star, Clock, CheckCircle2, PauseCircle, XCircle, PlayCircle, List, Info } from 'lucide-react';
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

const TRACKING_STATUS_OPTIONS = [
  { value: 'WATCHING', animeLabel: 'A Ver', mangaLabel: 'A Ler', icon: PlayCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
  { value: 'PLANNED', animeLabel: 'Ver mais tarde', mangaLabel: 'Ler mais tarde', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { value: 'COMPLETED', animeLabel: 'Visto', mangaLabel: 'Lido', icon: CheckCircle2, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { value: 'PAUSED', animeLabel: 'Em Pausa', mangaLabel: 'Em Pausa', icon: PauseCircle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { value: 'DROPPED', animeLabel: 'Desistiu', mangaLabel: 'Desistiu', icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
];

const HomePage = () => {
  const { user, token } = useAuth();
  const { categoria, setCategoria, isShowingFavorites, setIsShowingFavorites, triggerHome, homeTrigger } = useMedia();
  const navigate = useNavigate();
  const [termoPesquisa, setTermoPesquisa] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [resultadosPesquisa, setResultadosPesquisa] = useState<any[]>([]);
  const [resultadosDB, setResultadosDB] = useState<any[]>([]);
  const [animesDashboard, setAnimesDashboard] = useState<any[]>([]);
  const [mangasDashboard, setMangasDashboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'home' | 'details'>('home');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showEpList, setShowEpList] = useState(false);
  
  // Novo estado para o capítulo mais recente do MangaDex
  const [latestChapter, setLatestChapter] = useState<number | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const carregarCapituloMaisRecente = async (anilistId: number) => {
    if (categoria !== 'manga') return;
    setLoadingLatest(true);
    setLatestChapter(null);
    try {
      const res = await fetch(`http://localhost:3001/manga/latest-chapter/${anilistId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data && data.latest) setLatestChapter(data.latest);
    } catch (err) {
      console.error('Erro ao carregar cap mais recente:', err);
    } finally {
      setLoadingLatest(false);
    }
  };

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
        carregarDashboard();
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

  const carregarDashboard = async () => {
    setLoading(true);
    try {
      const [animeRes, mangaRes] = await Promise.all([
        fetch('http://localhost:3001/anime', { headers: getHeaders() }),
        fetch('http://localhost:3001/manga', { headers: getHeaders() })
      ]);
      
      const animes = await animeRes.json();
      const mangas = await mangaRes.json();

      if (Array.isArray(animes)) {
        setAnimesDashboard(animes.filter(a => a.status === 'WATCHING' && a.epAtual < (a.numEpisodiosTotal || 9999)));
      }
      if (Array.isArray(mangas)) {
        setMangasDashboard(mangas.filter(m => m.status === 'WATCHING' && m.capAtual < (m.numCapitulosTotal || 9999)));
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoVisto = async (item: any, type: 'anime' | 'manga') => {
    const campo = type === 'anime' ? 'epAtual' : 'capAtual';
    const novoValor = (item[campo] || 0) + 1;
    const url = `http://localhost:3001/${type}/${item.id}`;
    
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ [campo]: novoValor })
      });
      if (response.ok) {
        carregarDashboard();
        if (selectedItem && selectedItem.id === item.id) {
          const updated = await response.json();
          setSelectedItem(updated);
        }
      }
    } catch (error) {
      console.error("Erro ao marcar como visto:", error);
    }
  };

  const abrirDetalhes = async (id: number, isExternal = false, forcedType?: 'anime' | 'manga') => {
    setLoading(true);
    const targetType = forcedType || categoria;
    const url = isExternal 
      ? `http://localhost:3001/${targetType}/anilist/${id}`
      : `http://localhost:3001/${targetType}/${id}`;
    
    try {
      const response = await fetch(url, { headers: getHeaders() });
      const data = await response.json();
      
      if (isExternal && data) {
        const normalized = {
          id: data.id,
          titulo: data.title?.english || data.title?.romaji || 'Título Desconhecido',
          capaUrl: data.coverImage?.large,
          descricao: data.description ? data.description.replace(/<[^>]*>?/gm, '') : "Sem descrição.",
          generos: data.genres ? data.genres.join(', ') : (data.tags ? data.tags.map((t: any) => t.name).join(', ') : ''),
          statusLancamento: data.status,
          numEpisodiosTotal: data.episodes,
          numCapitulosTotal: data.chapters,
          temporada: data.season,
          ano: data.seasonYear,
          linksExternos: data.externalLinks ? JSON.stringify(data.externalLinks) : null,
          isExternal: true
        };
        setSelectedItem(normalized);
      } else if (data) {
        // Se for um item da DB, temos de aceder a data.manga se existir, ou data diretamente
        const itemData = data.manga || data.anime || data;
        setSelectedItem({ ...data, ...itemData, isExternal: false });
      } else {
        throw new Error('Nenhum dado recebido');
      }

      // Se for Manga, disparar o carregamento do capítulo mais recente (MangaDex)
      if (targetType === 'manga') {
        // Usamos o mangaId (ID da AniList) se existir, caso contrário usamos o id direto
        carregarCapituloMaisRecente(data.mangaId || data.id);
      }

      setView('details');
      setShowEpList(false);
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
      alert("Não foi possível carregar os detalhes. Tenta novamente.");
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
    carregarDashboard();
    
    // Se voltarmos para o dashboard (isShowingFavorites === false), resetamos tudo
    if (!isShowingFavorites) {
      setView('home');
      setSelectedItem(null);
      setTermoPesquisa('');
      setSelectedGenre(null);
    }
  }, [categoria, isShowingFavorites, homeTrigger]);

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
                  onClick={() => navigate('/chat')}
                  className="flex items-center gap-2 px-6 py-3 bg-[#1a1c23] hover:bg-gray-800 text-gray-400 rounded-xl font-bold transition-all border border-gray-800 active:scale-95 text-sm"
                >
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  Otaku Chat
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

            {/* Results Grid / Dashboard */}
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              {!isShowingFavorites && !termoPesquisa && !selectedGenre ? (
                /* NEW DASHBOARD VIEW */
                <div className="grid md:grid-cols-2 gap-12">
                  {/* Anime Column */}
                  <div className="space-y-6">
                    <h2 className="text-2xl font-black flex items-center gap-3 text-purple-400">
                      <PlayCircle className="w-6 h-6" />
                      VER ASSEGUIR
                    </h2>
                    <div className="space-y-4">
                      {animesDashboard.length > 0 ? animesDashboard.map(item => (
                        <div key={item.id} className="group flex items-center gap-4 bg-[#1a1c23] p-4 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-all">
                          <img 
                            src={item.anime?.capaUrl || item.capaUrl} 
                            className="w-20 h-20 object-cover rounded-2xl cursor-pointer" 
                            alt="" 
                            onClick={() => abrirDetalhes(item.animeId || item.id, false, 'anime')}
                          />
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => abrirDetalhes(item.animeId || item.id, false, 'anime')}>
                            <h3 className="font-bold text-gray-200 truncate">{item.anime?.titulo || item.titulo}</h3>
                            <p className="text-xs text-gray-500 font-black mt-1">EPISÓDIO {(item.epAtual || 0) + 1}</p>
                            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                              <div 
                                className="bg-purple-500 h-full transition-all duration-500" 
                                style={{ width: `${((item.epAtual || 0) / (item.anime?.numEpisodiosTotal || item.numEpisodiosTotal || (item.anime?.proximoEpisodio ? item.anime.proximoEpisodio - 1 : (item.epAtual || 0) + 1))) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                          <button 
                            onClick={() => marcarComoVisto(item, 'anime')}
                            className="px-6 py-3 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white rounded-2xl font-black text-xs transition-all border border-purple-500/20 active:scale-95"
                          >
                            VISTO
                          </button>
                        </div>
                      )) : (
                        <p className="text-gray-600 italic text-sm py-4">Nada para ver de momento...</p>
                      )}
                    </div>
                  </div>

                  {/* Manga Column */}
                  <div className="space-y-6">
                    <h2 className="text-2xl font-black flex items-center gap-3 text-pink-400">
                      <Clock className="w-6 h-6" />
                      LER ASSEGUIR
                    </h2>
                    <div className="space-y-4">
                      {mangasDashboard.length > 0 ? mangasDashboard.map(item => (
                        <div key={item.id} className="group flex items-center gap-4 bg-[#1a1c23] p-4 rounded-3xl border border-gray-800 hover:border-pink-500/50 transition-all">
                          <img 
                            src={item.manga?.capaUrl || item.capaUrl} 
                            className="w-20 h-20 object-cover rounded-2xl cursor-pointer" 
                            alt="" 
                            onClick={() => abrirDetalhes(item.mangaId || item.id, false, 'manga')}
                          />
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => abrirDetalhes(item.mangaId || item.id, false, 'manga')}>
                            <h3 className="font-bold text-gray-200 truncate">{item.manga?.titulo || item.titulo}</h3>
                            <p className="text-xs text-gray-500 font-black mt-1">CAPÍTULO {(item.capAtual || 0) + 1}</p>
                            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                              <div 
                                className="bg-pink-500 h-full transition-all duration-500" 
                                style={{ width: `${((item.capAtual || 0) / (item.manga?.numCapitulosTotal || item.numCapitulosTotal || (item.manga?.proximoCapituloNumero ? item.manga.proximoCapituloNumero - 1 : (item.capAtual || 0) + 1))) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                          <button 
                            onClick={() => marcarComoVisto(item, 'manga')}
                            className="px-6 py-3 bg-pink-600/10 hover:bg-pink-600 text-pink-400 hover:text-white rounded-2xl font-black text-xs transition-all border border-pink-500/20 active:scale-95"
                          >
                            LIDO
                          </button>
                        </div>
                      )) : (
                        <p className="text-gray-600 italic text-sm py-4">Nada para ler de momento...</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ORIGINAL SEARCH/LIST VIEW */
                <>
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
                          onClick={() => abrirDetalhes(item.id, !isShowingFavorites)}
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
                </>
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
                      <h2 className="text-4xl md:text-6xl font-black mb-3 tracking-tight">{selectedItem.titulo}</h2>
                      
                      {/* Badge do Capítulo Mais Recente (MangaDex) */}
                      {categoria === 'manga' && (
                        <div className="flex items-center gap-3 mb-6">
                          {loadingLatest ? (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-800/50 rounded-full border border-gray-700 animate-pulse">
                              <Loader2 className="w-4 h-4 text-pink-500 animate-spin" />
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">A consultar MangaDex...</span>
                            </div>
                          ) : latestChapter ? (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-pink-500/20 rounded-full border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.2)] animate-in zoom-in">
                              <Sparkles className="w-4 h-4 text-pink-400" />
                              <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Último Cap no MangaDex: {latestChapter}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-800/50 rounded-full border border-gray-700">
                              <Info className="w-4 h-4 text-gray-600" />
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sem info no MangaDex</span>
                            </div>
                          )}
                        </div>
                      )}

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

                    {/* Secção de Links Oficiais */}
                    {selectedItem.linksExternos && (
                      <div className="space-y-6 pt-10 border-t border-gray-800/50">
                        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                          <span className="w-1.5 h-6 bg-pink-500 rounded-full"></span>
                          Onde Assistir / Ler
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {JSON.parse(selectedItem.linksExternos).map((link: any, index: number) => (
                            <a 
                              key={index} 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-5 bg-gray-800/20 hover:bg-purple-600/10 border border-gray-800 hover:border-purple-500/50 rounded-[24px] transition-all group shadow-lg"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all">
                                  <ExternalLinkIcon className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-gray-200 uppercase tracking-wide">{link.site}</p>
                                  <p className="text-xs text-gray-500 font-bold uppercase">{link.language || 'Geral'}</p>
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-all group-hover:translate-x-1" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-10 border-t border-gray-800/50">
                      <div className="bg-gray-800/30 p-6 rounded-3xl border border-gray-700/50 flex flex-col items-center justify-center text-center">
                        <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mb-2">Status</p>
                        <p className="font-bold text-xl text-purple-400 uppercase">
                          {selectedItem.statusLancamento === 'RELEASING' ? 'Em Lançamento' : 
                           selectedItem.statusLancamento === 'FINISHED' ? 'Finalizado' : 
                           selectedItem.statusLancamento === 'HIATUS' ? 'Em Hiato' : 
                           selectedItem.statusLancamento === 'CANCELLED' ? 'Cancelado' : 
                           selectedItem.statusLancamento || 'Desconhecido'}
                        </p>
                      </div>
                      
                      <div className={`p-6 rounded-3xl border transition-all flex flex-col items-center justify-center text-center ${showEpList ? 'bg-purple-900/10 border-purple-500/50 sm:col-span-3' : 'bg-gray-800/30 border-gray-700/50'}`}>
                        <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mb-2">Progresso</p>
                        <div className="flex items-center gap-4 mb-4">
                          {!selectedItem.isExternal && (
                            <button onClick={() => atualizarProgresso(-1)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
                              <MinusCircle className="w-5 h-5" />
                            </button>
                          )}
                          <div className="flex items-center gap-1">
                            <input 
                              type="number"
                              min="0"
                              max={categoria === 'anime' ? selectedItem.numEpisodiosTotal : selectedItem.numCapitulosTotal}
                              value={categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', val);
                              }}
                              className="bg-transparent text-purple-400 font-black text-3xl w-16 text-center outline-none border-b-2 border-purple-500/20 focus:border-purple-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-gray-700 font-black text-2xl mx-1">/</span> 
                            <span className="text-gray-500 font-black text-2xl">
                              {categoria === 'anime' 
                                ? (selectedItem.numEpisodiosTotal || (selectedItem.proximoEpisodio ? `${selectedItem.proximoEpisodio - 1}+` : (selectedItem.statusLancamento === 'RELEASING' ? 'Lançando' : '?')))
                                : (selectedItem.numCapitulosTotal || (latestChapter ? `${latestChapter}+` : (selectedItem.statusLancamento === 'RELEASING' ? 'Lançando' : '?')))
                              }
                            </span>
                          </div>
                          {!selectedItem.isExternal && (
                            <button onClick={() => atualizarProgresso(1)} className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 transition-all">
                              <PlusCircle className="w-5 h-5" />
                            </button>
                          )}
                          {!selectedItem.isExternal && (
                            <button 
                              onClick={() => setShowEpList(!showEpList)}
                              className={`p-1.5 rounded-lg transition-all ${showEpList ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}
                            >
                              <List className="w-5 h-5" />
                            </button>
                          )}
                        </div>

                        {showEpList && !selectedItem.isExternal && (
                          <div className="w-full mt-4 border-t border-purple-500/20 pt-6 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              {[...Array(categoria === 'anime' 
                                ? (selectedItem.numEpisodiosTotal || (selectedItem.proximoEpisodio ? selectedItem.proximoEpisodio - 1 : 0)) 
                                : (Math.ceil(latestChapter || selectedItem.numCapitulosTotal || 0) || 0)
                              )].map((_, i) => {
                                const num = i + 1;
                                const isWatched = num <= (categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual);
                                return (
                                  <button
                                    key={num}
                                    onClick={() => atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', num)}
                                    className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                                      isWatched 
                                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                                      : 'bg-gray-800/50 text-gray-500 hover:bg-gray-700 hover:text-white border border-gray-700'
                                    }`}
                                  >
                                    {num}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {!showEpList && (
                        <div className="bg-gray-800/30 p-6 rounded-3xl border border-gray-700/50 flex flex-col items-center justify-center text-center">
                          <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest mb-2">Temporada</p>
                          <p className="font-bold text-xl text-gray-300">
                            {selectedItem.temporada ? `${selectedItem.temporada} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A'}
                          </p>
                        </div>
                      )}
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
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Estado de Acompanhamento</label>
                            <div className="grid grid-cols-1 gap-2">
                              {TRACKING_STATUS_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const isSelected = selectedItem.status === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => atualizarCampo('status', opt.value)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-sm font-bold ${
                                      isSelected 
                                      ? `${opt.bg} border-purple-500 ${opt.color}` 
                                      : 'bg-black/20 border-gray-800 text-gray-500 hover:border-gray-700'
                                    }`}
                                  >
                                    <Icon className="w-4 h-4" />
                                    {categoria === 'anime' ? opt.animeLabel : opt.mangaLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <button 
                            onClick={() => removerDaLista(selectedItem.id)}
                            className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-sm mt-4"
                          >
                            <Trash2 className="w-5 h-5" />
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
