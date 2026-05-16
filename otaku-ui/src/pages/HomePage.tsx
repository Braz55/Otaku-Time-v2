import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { Loader2 } from 'lucide-react';



const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
  "Horror", "Mecha", "Mystery", "Psychological", "Romance", 
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
];

const TRACKING_STATUS_OPTIONS = [
  { value: 'WATCHING', animeLabel: 'A Ver', mangaLabel: 'A Ler' },
  { value: 'PLANNED', animeLabel: 'Ver mais tarde', mangaLabel: 'Ler mais tarde' },
  { value: 'COMPLETED', animeLabel: 'Visto', mangaLabel: 'Lido' },
  { value: 'PAUSED', animeLabel: 'Em Pausa', mangaLabel: 'Em Pausa' },
  { value: 'DROPPED', animeLabel: 'Desistiu', mangaLabel: 'Desistiu' },
];

const HomePage = () => {
  const { user, token } = useAuth();
  const { categoria, isShowingFavorites, setIsShowingFavorites, isSearchOpen, homeTrigger } = useMedia();
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
  
  const [latestChapter, setLatestChapter] = useState<number | null>(null);
  const [latestChapterError, setLatestChapterError] = useState<string | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkSite, setNewLinkSite] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const carregarCapituloMaisRecente = async (anilistId: number) => {
    if (categoria !== 'manga') return;
    setLoadingLatest(true);
    setLatestChapter(null);
    setLatestChapterError(null);
    try {
      const res = await fetch(`http://localhost:3001/manga/latest-chapter/${anilistId}`, { headers: getHeaders() });
      const data = await res.json();
      if (data) {
        if (data.latest) setLatestChapter(data.latest);
        if (data.error) setLatestChapterError(data.error);
      }
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
        setAnimesDashboard(animes.filter(a => a.status === 'WATCHING' && (a.epAtual || 0) < (a.anime?.numEpisodiosTotal || 9999)));
      }
      if (Array.isArray(mangas)) {
        setMangasDashboard(mangas.filter(m => m.status === 'WATCHING' && (m.capAtual || 0) < (m.manga?.numCapitulosTotal || 9999)));
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
      
      if (!data) {
        alert('Não foi possível carregar os detalhes. Tenta novamente mais tarde.');
        return;
      }
      
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
        const itemData = data.manga || data.anime || data;
        // Preservamos o ID da base de dados original para as operações de PATCH/DELETE
        setSelectedItem({ ...itemData, ...data, dbId: data.id, isExternal: false });
      }

      if (targetType === 'manga') {
        carregarCapituloMaisRecente(data.mangaId || data.id);
      }

      setView('details');
      setShowEpList(false);
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
    } finally {
      setLoading(false);
    }
  };

  const removerDaLista = async (id: number) => {
    if (!window.confirm("Tens a certeza que queres remover este item?")) return;
    const targetId = selectedItem?.dbId || id;
    const url = `http://localhost:3001/${categoria}/${targetId}`;
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
    const targetId = selectedItem.dbId || selectedItem.id;
    setSelectedItem((prev: any) => ({ ...prev, [campo]: valor }));
    const url = `http://localhost:3001/${categoria}/${targetId}`;
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ [campo]: valor })
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedItem((prev: any) => ({ ...prev, ...data, dbId: data.id }));
        setResultadosDB(prev => prev.map(item => item.id === targetId ? { ...item, ...data } : item));
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
    setTermoPesquisa('');
    
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

  const adicionarLinkPessoal = async () => {
    if (!newLinkSite || !newLinkUrl || selectedItem.isExternal) return;
    const novosLinks = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados) : [];
    novosLinks.push({ site: newLinkSite, url: newLinkUrl, language: 'PT', type: 'Custom' });
    const jsonStr = JSON.stringify(novosLinks);
    await atualizarCampo('linksPersonalizados', jsonStr);
    setNewLinkSite('');
    setNewLinkUrl('');
    setShowAddLink(false);
  };

  useEffect(() => {
    consultarMinhaLista();
    carregarDashboard();
  }, [categoria, homeTrigger]);

  useEffect(() => {
    if (!isSearchOpen) {
      setTermoPesquisa('');
      setSelectedGenre(null);
      setResultadosPesquisa([]);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    setView('home');
    setSelectedItem(null);
  }, [isShowingFavorites, isSearchOpen]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {view === 'home' ? (
        <div className="w-full">
          {/* Search Section */}
          {isSearchOpen && (
            <>
              <section className="relative hero-gradient pt-16 pb-20 px-4 md:px-10 text-center overflow-hidden animate-in slide-in-from-top-4 duration-500">
                <div className="max-w-3xl mx-auto space-y-8 relative z-10">
                  <div className="space-y-4">
                    <h2 className="font-display-lg text-display-lg leading-tight text-4xl md:text-5xl">
                      Pesquisa os teus <span className={categoria === 'anime' ? 'text-primary' : 'text-secondary'}>{categoria === 'anime' ? 'Animes' : 'Mangás'}</span> favoritos
                    </h2>
                    <p className="text-on-surface-variant font-body-lg text-body-lg max-w-xl mx-auto">
                      Explora a nossa base de dados para encontrares novos títulos.
                    </p>
                  </div>
              <div className={`glass-panel p-2 rounded-3xl flex items-center shadow-2xl group focus-within:ring-2 ${categoria === 'anime' ? 'ring-primary/50' : 'ring-secondary/50'} transition-all`}>
                <span className="material-symbols-outlined px-4 text-on-surface-variant group-focus-within:text-white" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
                <input 
                  className="bg-transparent border-none focus:ring-0 w-full py-4 text-on-surface font-body-md text-body-md placeholder:text-outline-variant outline-none" 
                  placeholder={`Search for ${categoria} titles...`} 
                  type="text"
                  value={termoPesquisa}
                  onChange={(e) => setTermoPesquisa(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedGenre(null); pesquisar(); } }}
                />
                <button 
                  onClick={() => { setSelectedGenre(null); pesquisar(); }} 
                  className={`${categoria === 'anime' ? 'bg-primary-container text-on-primary-container' : 'bg-secondary-container text-on-secondary-container'} px-8 py-3 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all`}
                >
                  Search
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {GENRES.map((g) => (
                  <span 
                    key={g} 
                    onClick={() => pesquisarPorGenero(g)} 
                    className={`px-4 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${selectedGenre === g ? (categoria === 'anime' ? 'bg-primary border-primary text-on-primary' : 'bg-secondary border-secondary text-on-secondary') : 'bg-surface-variant/50 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                  >
                    {g}
                  </span>
                ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Content Sections */}
          <div className="px-4 md:px-10 space-y-16 mt-8 pb-10">
            {/* Dashboard Queue */}
            {(!isShowingFavorites && !isSearchOpen) && (
              <section className="space-y-12">
                <div className="text-center py-12 hero-gradient rounded-[40px] border border-white/10 shadow-2xl p-8 mb-12 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-transparent blur-3xl"></div>
                  <h2 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent tracking-tight mb-4 relative z-10">
                    Otaku-Time
                  </h2>
                  <p className="text-on-surface-variant text-lg max-w-xl mx-auto relative z-10 font-medium">
                    O teu portal premium de acompanhamento de Animes e Mangás.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                    <h3 className="font-headline-lg text-headline-lg text-2xl font-bold">Fila de Prioridades</h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Anime Column */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> Continuar a ver
                    </h4>
                    {animesDashboard.length > 0 ? animesDashboard.map(item => {
                      const totalEp = (item.anime?.statusLancamento === 'RELEASING' && item.anime?.proximoEpisodio) ? item.anime.proximoEpisodio - 1 : (item.anime?.numEpisodiosTotal || item.numEpisodiosTotal || '?');
                      const progressoPercentual = typeof totalEp === 'number' && totalEp > 0 ? ((item.epAtual || 0) / totalEp) * 100 : (((item.epAtual || 0) / ((item.epAtual || 0) + 1)) * 100);
                      return (
                        <div key={item.id} className="glass-panel p-4 rounded-3xl flex gap-4 hover:bg-white/5 transition-all group relative overflow-hidden border border-white/5 hover:border-purple-500/30">
                          <div className="w-24 h-32 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => abrirDetalhes(item.animeId || item.id, false, 'anime')}>
                            <img src={item.anime?.capaUrl || item.capaUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div className="cursor-pointer" onClick={() => abrirDetalhes(item.animeId || item.id, false, 'anime')}>
                              <h5 className="font-bold text-lg line-clamp-1 group-hover:text-purple-400 transition-colors">{item.anime?.titulo || item.titulo}</h5>
                              <p className="text-sm text-on-surface-variant">Episódio {(item.epAtual || 0) + 1} / {totalEp}</p>
                            </div>
                            <div className="space-y-3">
                              <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                                <div className="h-full bg-primary shadow-[0_0_10px_rgba(221,184,255,0.5)] transition-all duration-500" style={{ width: `${Math.min(progressoPercentual, 100)}%` }}></div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => marcarComoVisto(item, 'anime')} className="flex-1 py-2 bg-primary/10 border border-primary/20 text-primary text-xs font-bold rounded-xl hover:bg-primary hover:text-on-primary transition-all shadow-sm">Marcar como Visto</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }) : <p className="text-on-surface-variant text-sm italic">Nenhum anime em progresso...</p>}
                  </div>

                  {/* Manga Column */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span> Continuar a ler
                    </h4>
                    {mangasDashboard.length > 0 ? mangasDashboard.map(item => {
                      const totalCap = (item.manga?.statusLancamento === 'RELEASING' && item.manga?.proximoCapituloNumero) ? item.manga.proximoCapituloNumero - 1 : (item.manga?.numCapitulosTotal || item.numCapitulosTotal || '?');
                      const progressoPercentual = typeof totalCap === 'number' && totalCap > 0 ? ((item.capAtual || 0) / totalCap) * 100 : (((item.capAtual || 0) / ((item.capAtual || 0) + 1)) * 100);
                      return (
                        <div key={item.id} className="glass-panel p-4 rounded-3xl flex gap-4 hover:bg-white/5 transition-all group relative overflow-hidden border border-white/5 hover:border-pink-500/30">
                          <div className="w-24 h-32 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => abrirDetalhes(item.mangaId || item.id, false, 'manga')}>
                            <img src={item.manga?.capaUrl || item.capaUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-1">
                            <div className="cursor-pointer" onClick={() => abrirDetalhes(item.mangaId || item.id, false, 'manga')}>
                              <h5 className="font-bold text-lg line-clamp-1 group-hover:text-pink-400 transition-colors">{item.manga?.titulo || item.titulo}</h5>
                              <p className="text-sm text-on-surface-variant">Capítulo {(item.capAtual || 0) + 1} / {totalCap}</p>
                            </div>
                            <div className="space-y-3">
                              <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                                <div className="h-full bg-secondary shadow-[0_0_10px_rgba(255,176,203,0.5)] transition-all duration-500" style={{ width: `${Math.min(progressoPercentual, 100)}%` }}></div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => marcarComoVisto(item, 'manga')} className="flex-1 py-2 bg-secondary/10 border border-secondary/20 text-secondary text-xs font-bold rounded-xl hover:bg-secondary hover:text-on-secondary transition-all shadow-sm">Marcar como Lido</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }) : <p className="text-on-surface-variant text-sm italic">Nenhum mangá em progresso...</p>}
                  </div>
                </div>
              </section>
            )}

            {/* Library Grid */}
            {(isShowingFavorites && !isSearchOpen) && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>video_library</span>
                    <h3 className="font-headline-lg text-headline-lg text-2xl font-bold">
                      A Minha Lista ({categoria})
                    </h3>
                  </div>
                  {loading && <Loader2 className="w-6 h-6 text-primary animate-spin" />}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                  {resultadosDB.length > 0 ? (
                    resultadosDB.map((item) => (
                      <div key={item.id} className="group cursor-pointer space-y-3" onClick={() => abrirDetalhes(item.id, false)}>
                        <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-lg transform transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1 border border-white/5 group-hover:border-purple-500/50">
                          <img src={item.anime?.capaUrl || item.manga?.capaUrl || item.capaUrl} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                          <div className="absolute bottom-4 left-4 right-4 z-10">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-2 ${categoria === 'anime' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>
                              {categoria.toUpperCase()}
                            </span>
                            <p className="font-bold text-sm text-white line-clamp-1">{item.anime?.titulo || item.manga?.titulo || item.titulo}</p>
                          </div>
                          <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 text-white z-10 border border-white/10">
                            <span className="material-symbols-outlined text-[12px] text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> #{item.prioridade || '-'}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-center text-on-surface-variant py-10 italic">Nenhum item guardado na tua lista.</p>
                  )}
                </div>
              </section>
            )}

            {/* Search Results Grid */}
            {isSearchOpen && (
              <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    <h3 className="font-headline-lg text-headline-lg text-2xl font-bold">
                      Resultados da Pesquisa {selectedGenre ? `- ${selectedGenre}` : ''}
                    </h3>
                  </div>
                  {loading && <Loader2 className="w-6 h-6 text-primary animate-spin" />}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                  {resultadosPesquisa.length > 0 ? (
                    resultadosPesquisa.map((item) => (
                      <div key={item.id} className="group cursor-pointer space-y-3" onClick={() => abrirDetalhes(item.id, true)}>
                        <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-lg transform transition-all duration-300 group-hover:scale-[1.02] group-hover:-translate-y-1 border border-white/5 group-hover:border-pink-500/50">
                          <img src={item.coverImage.large} className="w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                          <div className="absolute bottom-4 left-4 right-4 z-10">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-2 ${categoria === 'anime' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>
                              {categoria.toUpperCase()}
                            </span>
                            <p className="font-bold text-sm text-white line-clamp-1">{item.title.english || item.title.romaji}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : !loading && (
                    <p className="col-span-full text-center text-on-surface-variant py-10 italic">Nenhum resultado encontrado.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      ) : (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            <button onClick={() => setView('home')} className="mb-10 flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors group font-bold">
              <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
              Back to Home
            </button>
            {selectedItem && (
              <div className="glass-panel rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(147,51,234,0.1)]">
                <div className="relative h-[400px] md:h-[500px]">
                  <img src={selectedItem.capaUrl} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div>
                  <div className="relative h-full flex flex-col md:flex-row items-end p-8 md:p-12 gap-8">
                    <div className="w-48 md:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-background flex-shrink-0">
                      <img src={selectedItem.capaUrl} className="w-full h-full object-cover" alt={selectedItem.titulo} />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${categoria === 'anime' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-secondary/20 text-secondary border-secondary/30'}`}>
                          {categoria}
                        </span>
                        <span className="text-on-surface-variant text-sm flex items-center gap-1 font-bold">
                          <span className="material-symbols-outlined text-sm text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> {selectedItem.isExternal ? 'New' : `#${selectedItem.prioridade}`}
                        </span>
                      </div>
                      <h2 className="font-display-lg text-4xl md:text-5xl font-bold mb-6 tracking-tight text-white">{selectedItem.titulo}</h2>
                      {categoria === 'manga' && (
                        <div className="flex items-center gap-3 mb-6">
                          {loadingLatest ? (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-variant/50 rounded-full border border-white/10 animate-pulse">
                              <Loader2 className="w-4 h-4 text-secondary animate-spin" />
                              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Checking MangaDex...</span>
                            </div>
                          ) : latestChapter ? (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary/20 rounded-full border border-secondary/30 shadow-[0_0_15px_rgba(255,176,203,0.2)] animate-in zoom-in">
                              <span className="material-symbols-outlined text-[16px] text-secondary">auto_awesome</span>
                              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Latest on MangaDex: {latestChapter}</span>
                            </div>
                          ) : latestChapterError ? (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 rounded-full border border-red-500/30">
                              <span className="material-symbols-outlined text-[16px] text-red-500">info</span>
                              <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{latestChapterError}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-variant/50 rounded-full border border-white/10">
                              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">info</span>
                              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">No external info</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.generos?.split(',').map((g: string) => (
                          <span key={g} className="px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full text-xs font-bold text-on-surface border border-white/10 tracking-wider">
                            {g.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-8 md:p-12 grid md:grid-cols-3 gap-12">
                  <div className="md:col-span-2 space-y-12">
                    <div>
                      <h3 className="font-headline-lg text-2xl font-bold mb-6 flex items-center gap-3">
                        <span className={`w-1.5 h-6 rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                        Synopsis
                      </h3>
                      <p className="text-on-surface-variant leading-relaxed text-lg font-body-lg">
                        {selectedItem.descricao || "No description available."}
                      </p>
                    </div>
                    
                    {(() => {
                      const linksOficiais = selectedItem.linksExternos ? JSON.parse(selectedItem.linksExternos).map((l: any) => ({ ...l, tipo: 'Official' })) : [];
                      const linksPessoais = selectedItem.linksPersonalizados ? JSON.parse(selectedItem.linksPersonalizados).map((l: any) => ({ ...l, tipo: 'Custom' })) : [];
                      const todosLinks = [...linksOficiais, ...linksPessoais];
                      
                      return (todosLinks.length > 0 || (!selectedItem.isExternal)) && (
                        <div className="space-y-6 pt-10 border-t border-white/5">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="font-headline-lg text-2xl font-bold flex items-center gap-3">
                              <span className={`w-1.5 h-6 rounded-full ${categoria === 'anime' ? 'bg-primary' : 'bg-secondary'}`}></span>
                              Where to {categoria === 'anime' ? 'Watch' : 'Read'}
                            </h3>
                            {!selectedItem.isExternal && (
                              <button onClick={() => setShowAddLink(!showAddLink)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-xs border ${categoria === 'anime' ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-on-primary' : 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary hover:text-on-secondary'}`}>
                                <span className="material-symbols-outlined text-[16px]">add</span> ADD LINK
                              </button>
                            )}
                          </div>
                          
                          {showAddLink && !selectedItem.isExternal && (
                            <div className="flex flex-col sm:flex-row gap-3 p-4 bg-surface-variant/30 border border-white/10 rounded-2xl mb-4 animate-in slide-in-from-top-4">
                              <input type="text" placeholder="Name (Ex: Crunchyroll)" value={newLinkSite} onChange={e => setNewLinkSite(e.target.value)} className="flex-1 bg-black/30 px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-primary transition-all text-sm text-white" />
                              <input type="url" placeholder="URL (https://...)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="flex-[2] bg-black/30 px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-primary transition-all text-sm text-white" />
                              <button onClick={adicionarLinkPessoal} disabled={!newLinkSite || !newLinkUrl} className="px-6 py-2.5 bg-primary hover:bg-primary/80 disabled:bg-surface-variant disabled:text-on-surface-variant text-on-primary rounded-xl font-bold transition-all text-sm">SAVE</button>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {todosLinks.map((link: any, index: number) => (
                              <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-between p-5 glass-panel hover:bg-white/5 rounded-2xl transition-all group shadow-lg border-transparent hover:border-white/10`}>
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${link.tipo === 'Custom' ? 'bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-on-secondary' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary'}`}>
                                    <span className="material-symbols-outlined">open_in_new</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                                      {link.site}
                                      {link.tipo === 'Custom' && <span className="px-2 py-0.5 bg-secondary/20 text-secondary text-[10px] rounded-full border border-secondary/30">CUSTOM</span>}
                                    </p>
                                    <p className="text-xs text-on-surface-variant font-bold uppercase">{link.language || 'Global'}</p>
                                  </div>
                                </div>
                                <span className={`material-symbols-outlined transition-all group-hover:translate-x-1 ${link.tipo === 'Custom' ? 'text-on-surface-variant group-hover:text-secondary' : 'text-on-surface-variant group-hover:text-primary'}`}>chevron_right</span>
                              </a>
                            ))}
                            {todosLinks.length === 0 && (
                              <p className="text-on-surface-variant italic text-sm col-span-2">No links available. Add one above!</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-10 border-t border-white/5">
                      <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center">
                        <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-2">Status</p>
                        <p className={`font-bold text-xl ${selectedItem.statusLancamento === 'RELEASING' ? 'text-primary' : 'text-on-surface'}`}>
                          {selectedItem.statusLancamento === 'RELEASING' ? 'Releasing' : 
                           selectedItem.statusLancamento === 'FINISHED' ? 'Finished' : 
                           selectedItem.statusLancamento === 'HIATUS' ? 'Hiatus' : 
                           selectedItem.statusLancamento === 'CANCELLED' ? 'Cancelled' : 
                           selectedItem.statusLancamento || 'Unknown'}
                        </p>
                      </div>
                      <div className={`p-6 rounded-3xl transition-all flex flex-col items-center justify-center text-center ${showEpList ? 'bg-primary/10 border border-primary/30 sm:col-span-3' : 'glass-panel'}`}>
                        <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-2">Progress</p>
                        <div className="flex items-center gap-4 mb-4">
                          {!selectedItem.isExternal && (
                            <button onClick={() => atualizarProgresso(-1)} className="p-1.5 rounded-lg bg-surface-variant hover:bg-white/10 transition-colors">
                              <span className="material-symbols-outlined text-[20px]">remove</span>
                            </button>
                          )}
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" max={categoria === 'anime' ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : selectedItem.numEpisodiosTotal) : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : selectedItem.numCapitulosTotal)} value={categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual} onChange={(e) => { const val = parseInt(e.target.value) || 0; atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', val); }} className={`bg-transparent ${categoria === 'anime' ? 'text-primary' : 'text-secondary'} font-black text-3xl w-16 text-center outline-none border-b-2 border-white/10 focus:border-white/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                            <span className="text-on-surface-variant font-black text-2xl mx-1">/</span> 
                            <span className="text-on-surface-variant font-black text-2xl">
                              {categoria === 'anime' 
                                ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || '?'))
                                : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (selectedItem.numCapitulosTotal || (latestChapter ? `${latestChapter}` : '?')))
                              }
                            </span>
                          </div>
                          {!selectedItem.isExternal && (
                            <button onClick={() => atualizarProgresso(1)} className={`p-1.5 rounded-lg text-on-primary transition-all ${categoria === 'anime' ? 'bg-primary hover:bg-primary/80' : 'bg-secondary hover:bg-secondary/80'}`}>
                              <span className="material-symbols-outlined text-[20px]">add</span>
                            </button>
                          )}
                          {!selectedItem.isExternal && (
                            <button onClick={() => setShowEpList(!showEpList)} className={`p-1.5 rounded-lg transition-all ${showEpList ? (categoria === 'anime' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary') : 'bg-surface-variant text-on-surface-variant hover:text-white'}`}>
                              <span className="material-symbols-outlined text-[20px]">list</span>
                            </button>
                          )}
                        </div>
                        {showEpList && !selectedItem.isExternal && (
                          <div className="w-full mt-4 border-t border-white/10 pt-6 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                              {[...Array(categoria === 'anime' 
                                ? ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoEpisodio) ? selectedItem.proximoEpisodio - 1 : (selectedItem.numEpisodiosTotal || 0)) 
                                : ((selectedItem.statusLancamento === 'RELEASING' && selectedItem.proximoCapituloNumero) ? selectedItem.proximoCapituloNumero - 1 : (Math.ceil(latestChapter || selectedItem.numCapitulosTotal || 0) || 0))
                              )].map((_, i) => {
                                const num = i + 1;
                                const isWatched = num <= (categoria === 'anime' ? selectedItem.epAtual : selectedItem.capAtual);
                                return (
                                  <button key={num} onClick={() => atualizarCampo(categoria === 'anime' ? 'epAtual' : 'capAtual', num)} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-all ${isWatched ? (categoria === 'anime' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary') : 'bg-surface-variant/50 text-on-surface-variant hover:bg-surface-variant hover:text-white border border-white/5'}`}>
                                    {num}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      {!showEpList && (
                        <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center text-center">
                          <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest mb-2">Season</p>
                          <p className="font-bold text-xl text-white">
                            {selectedItem.temporada ? `${selectedItem.temporada} ${selectedItem.ano || ''}` : selectedItem.ano || 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="glass-panel p-8 rounded-[32px]">
                      <h4 className="text-lg font-bold mb-6 flex items-center gap-2">Quick Actions</h4>
                      {selectedItem.isExternal ? (
                        <button onClick={() => { adicionarAoBanco(selectedItem.titulo); setView('home'); }} className="w-full bg-primary hover:bg-primary/80 text-on-primary py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg"><span className="material-symbols-outlined">add</span> ADD TO VAULT</button>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Tracking Status</label>
                            <div className="grid grid-cols-1 gap-2">
                              {TRACKING_STATUS_OPTIONS.map((opt) => {
                                const isSelected = selectedItem.status === opt.value;
                                return (
                                  <button key={opt.value} onClick={() => atualizarCampo('status', opt.value)} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-sm font-bold ${isSelected ? (categoria === 'anime' ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/20 border-secondary text-secondary') : 'bg-surface-variant/30 border-white/5 text-on-surface-variant hover:border-white/20'}`}>
                                    {/* Using Material Symbols instead of Lucide icons */}
                                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                      {opt.value === 'WATCHING' ? 'play_circle' : 
                                       opt.value === 'PLANNED' ? 'schedule' : 
                                       opt.value === 'COMPLETED' ? 'check_circle' : 
                                       opt.value === 'PAUSED' ? 'pause_circle' : 'cancel'}
                                    </span>
                                    {categoria === 'anime' ? opt.animeLabel : opt.mangaLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <button onClick={() => removerDaLista(selectedItem.id)} className="w-full bg-error/10 hover:bg-error text-error hover:text-on-error py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 text-sm mt-4">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                            REMOVE FROM VAULT
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
