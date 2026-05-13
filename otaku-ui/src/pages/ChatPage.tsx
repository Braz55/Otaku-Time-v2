import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { MessageSquare, Send, Plus, Trash2, Bot, User, Loader2, X, PlusCircle, Star, ChevronLeft, Sparkles, Wand2, Hash, Zap, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MediaCard from '../components/MediaCard';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Session {
  id: number;
  titulo: string;
  createdAt: string;
  updatedAt: string;
}

const GENRES = [
  "Ação", "Artes Marciais", "Aventura", "BL (Yaoi)", "Comédia", "Culto", "Cyberpunk", "Demónios", "Drama", 
  "Ecchi", "Escolar", "Espaço", "Fantasia", "GL (Yuri)", "Gore", "Harem", "Histórico", "Horror", "Isekai", 
  "Josei", "Mahou Shoujo", "Mecha", "Militar", "Mistério", "Music", "Policial", "Psicológico", "Reverse Harem", 
  "Romance", "Samurai", "Sci-Fi", "Seinen", "Shoujo", "Shounen", "Slice of Life", "Sobrevivência", "Sports", 
  "Steampunk", "Super Poderes", "Supernatural", "Thriller", "Vampiros", "Zombies"
].sort();

const RecommendationCard = ({ id, token, onOpen }: { id: string, token: string, onOpen: (item: any) => void }) => {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await fetch(`http://localhost:3001/anime/anilist/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data && data.id) {
          setItem({
            id: data.id,
            titulo: data.title?.english || data.title?.romaji || 'Título desconhecido',
            capaUrl: data.coverImage?.large,
            generos: data.genres?.join(', '),
            descricao: data.description?.replace(/<[^>]*>?/gm, ''),
            statusLancamento: data.status,
            numEpisodiosTotal: data.episodes,
            numCapitulosTotal: data.chapters,
            tipo: data.type === 'MANGA' ? 'manga' : 'anime'
          });
        }
      } catch (err) {
        console.error('Erro ao buscar recomendação:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id, token]);

  if (loading) return <div className="w-48 h-64 bg-gray-800 animate-pulse rounded-2xl"></div>;
  if (!item) return null;

  return (
    <div className="w-48 shrink-0">
      <MediaCard 
        titulo={item.titulo}
        capaUrl={item.capaUrl}
        generos={item.generos}
        progresso={item.statusLancamento}
        onClick={() => onOpen(item)}
      />
    </div>
  );
};

const ChatPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSession) fetchMessages(activeSession);
    else setMessages([]);
  }, [activeSession]);

  useEffect(() => scrollToBottom(), [messages]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:3001/chat/sessions', { headers: getHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSessions(data);
        if (data.length > 0 && !activeSession) setActiveSession(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (sessionId: number) => {
    try {
      const res = await fetch(`http://localhost:3001/chat/sessions/${sessionId}/messages`, { headers: getHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const createNewSession = async () => {
    const titulo = prompt('Título da conversa:', 'Nova Conversa');
    if (!titulo) return;
    try {
      const res = await fetch('http://localhost:3001/chat/sessions', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ titulo })
      });
      const newSession = await res.json();
      setSessions([newSession, ...sessions]);
      setActiveSession(newSession.id);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Apagar esta conversa?')) return;
    try {
      await fetch(`http://localhost:3001/chat/sessions/${id}`, { method: 'DELETE', headers: getHeaders() });
      setSessions(sessions.filter(s => s.id !== id));
      if (activeSession === id) setActiveSession(null);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const adicionarALista = async () => {
    if (!selectedItem) return;
    const type = selectedItem.tipo || (selectedItem.numCapitulosTotal ? 'manga' : 'anime');
    try {
      const res = await fetch(`http://localhost:3001/${type}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          id: selectedItem.id,
          titulo: selectedItem.titulo,
          capaUrl: selectedItem.capaUrl,
          generos: selectedItem.generos,
          descricao: selectedItem.descricao,
          statusLancamento: selectedItem.statusLancamento,
          numEpisodiosTotal: selectedItem.numEpisodiosTotal,
          numCapitulosTotal: selectedItem.numCapitulosTotal
        })
      });
      if (res.ok) {
        alert('Adicionado com sucesso!');
        setSelectedItem(null);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar à lista.');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && selectedGenres.length === 0) || !activeSession || loading) return;

    let finalPrompt = input.trim();
    if (selectedGenres.length > 0) {
      const genresStr = selectedGenres.join(', ');
      finalPrompt = `Recomenda-me algo de ${genresStr}${finalPrompt ? '. Além disso: ' + finalPrompt : ''}`;
    }

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: finalPrompt, createdAt: new Date().toISOString() }]);
    setInput('');
    setSelectedGenres([]);
    setShowGenreSelector(false);
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:3001/chat/sessions/${activeSession}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: finalPrompt })
      });
      if (!res.ok) throw new Error();
      const aiMsg = await res.json();
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        role: 'assistant', 
        content: 'Erro de comunicação com o motor de IA.', 
        createdAt: new Date().toISOString() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    if (!content) return null;
    const recRegex = /\[REC:(\d+)\]/g;
    const recommendations: string[] = [];
    let match;
    while ((match = recRegex.exec(content)) !== null) {
      recommendations.push(match[1]);
    }
    const cleanText = content.replace(recRegex, '').trim();

    return (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap leading-relaxed">{cleanText}</p>
        {recommendations.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {recommendations.map(id => (
              <RecommendationCard key={id} id={id} token={token || ''} onOpen={setSelectedItem} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-96px)] bg-[#0f1014] text-gray-200 overflow-hidden relative">
      
      {/* Detalhes Overlay */}
      {selectedItem && (
        <div className="absolute inset-0 z-50 bg-[#0f1014]/95 backdrop-blur-2xl flex flex-col animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <button onClick={() => setSelectedItem(null)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-bold">
              <ChevronLeft className="w-6 h-6" /> Voltar ao Chat
            </button>
            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-800 rounded-full transition-colors"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-10">
              <img src={selectedItem.capaUrl} className="w-72 h-[450px] object-cover rounded-[40px] shadow-2xl border border-white/10" alt="" />
              <div className="flex-1 space-y-6">
                <div>
                  <h1 className="text-4xl font-black text-white leading-tight">{selectedItem.titulo}</h1>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {selectedItem.generos?.split(',').map((g: string) => (
                      <span key={g} className="px-4 py-1.5 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-xl text-xs font-black uppercase">{g.trim()}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1a1c23] p-4 rounded-3xl border border-gray-800">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Status</p>
                    <p className="font-black text-gray-200 uppercase">{selectedItem.statusLancamento}</p>
                  </div>
                  <div className="bg-[#1a1c23] p-4 rounded-3xl border border-gray-800">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Conteúdo</p>
                    <p className="font-black text-gray-200 uppercase">{selectedItem.numEpisodiosTotal ? `${selectedItem.numEpisodiosTotal} Episódios` : `${selectedItem.numCapitulosTotal || '?'} Capítulos`}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-lg font-black text-white uppercase flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" /> Sinopse</h3>
                  <p className="text-gray-400 leading-relaxed text-lg">{selectedItem.descricao}</p>
                </div>
                <button 
                  onClick={adicionarALista}
                  className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-[30px] font-black text-xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <PlusCircle className="w-6 h-6" /> Adicionar à Minha Lista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 bg-[#16181d]/50 backdrop-blur-xl flex flex-col">
        <div className="p-6">
          <button onClick={createNewSession} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95">
            <Plus className="w-5 h-5" /> Nova Conversa
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
          {sessions.map(session => (
            <div key={session.id} onClick={() => setActiveSession(session.id)} className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${activeSession === session.id ? 'bg-purple-600/20 border-purple-500/50 text-white' : 'bg-transparent border-transparent hover:bg-gray-800/50 text-gray-400'}`}>
              <div className="flex items-center gap-3 truncate"><MessageSquare className={`w-5 h-5 ${activeSession === session.id ? 'text-purple-400' : 'text-gray-600'}`} /><span className="truncate font-medium">{session.titulo}</span></div>
              <button onClick={(e) => deleteSession(session.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="h-20 border-b border-gray-800 flex items-center justify-between px-8 bg-[#0f1014]/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg"><Bot className="w-6 h-6 text-white" /></div>
            <div><h2 className="font-bold text-lg">Otaku Bot</h2><p className="text-xs text-green-500 flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>Online (Llama 3.1)</p></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {activeSession ? (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-purple-600' : 'bg-pink-600'}`}>{msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}</div>
                    <div className={`p-5 rounded-3xl shadow-xl border ${msg.role === 'user' ? 'bg-purple-600/10 border-purple-500/20 rounded-tr-none text-gray-100' : 'bg-gray-800/50 border-gray-700/50 rounded-tl-none text-gray-200'}`}>{renderMessageContent(msg.content)}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex gap-4 max-w-[80%]">
                    <div className="w-10 h-10 rounded-2xl bg-pink-600 flex items-center justify-center shrink-0 shadow-lg"><Bot className="w-6 h-6 text-white" /></div>
                    <div className="bg-gray-800/50 border border-gray-700/50 p-5 rounded-3xl rounded-tl-none flex items-center gap-3"><div className="flex gap-1"><span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:0.2s]"></span><span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:0.4s]"></span></div></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gray-800/50 flex items-center justify-center border border-gray-700"><MessageSquare className="w-12 h-12 text-gray-600" /></div>
              <div><h3 className="text-2xl font-bold text-gray-400">Bem-vindo ao Chat!</h3><p className="text-gray-600 max-w-sm mt-2">Seleciona uma conversa para começares.</p></div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 bg-gradient-to-t from-[#0f1014] via-[#0f1014] to-transparent relative">
          {showGenreSelector && (
            <div className="mb-6 p-6 bg-[#16181d]/90 backdrop-blur-2xl border border-gray-800 rounded-[32px] shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 max-h-64 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500" /> Explorar por Género</h3>
                {selectedGenres.length > 0 && <button onClick={() => setSelectedGenres([])} className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase">Limpar tudo</button>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {GENRES.map(genre => (
                  <button key={genre} onClick={() => toggleGenre(genre)} className={`px-4 py-3 rounded-2xl text-[11px] font-black transition-all border text-left flex items-center gap-2 ${selectedGenres.includes(genre) ? 'bg-purple-600 border-purple-400 text-white shadow-[0_5px_15px_rgba(147,51,234,0.3)]' : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedGenres.includes(genre) ? 'bg-white animate-pulse' : 'bg-gray-600'}`}></div>{genre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 relative">
            <button onClick={() => setShowGenreSelector(!showGenreSelector)} className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 border flex items-center gap-2 ${showGenreSelector ? 'bg-purple-600 border-purple-400 text-white' : 'bg-[#1a1c23] border-gray-800 text-purple-400 hover:text-white hover:bg-purple-600'}`}>
              <Wand2 className="w-6 h-6" />
              {selectedGenres.length > 0 && <span className="absolute -top-2 -right-2 w-6 h-6 bg-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0f1014] animate-in zoom-in">{selectedGenres.length}</span>}
            </button>
            <form onSubmit={sendMessage} className={`flex-1 flex gap-4 p-2 bg-[#1a1c23]/80 backdrop-blur-xl border rounded-[30px] shadow-2xl transition-all ${activeSession ? 'border-gray-700 focus-within:border-purple-500/50' : 'opacity-50 pointer-events-none border-transparent'}`}>
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={selectedGenres.length > 0 ? `A pedir ${selectedGenres.length} géneros... adiciona detalhes!` : "Pergunta algo sobre anime ou manga..."} className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-gray-100 placeholder:text-gray-600" />
              <button type="submit" disabled={(!input.trim() && selectedGenres.length === 0) || loading || !activeSession} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-full transition-all shadow-lg active:scale-90 disabled:opacity-50 disabled:active:scale-100">{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}</button>
            </form>
          </div>
          <p className="text-center text-[10px] text-gray-600 mt-4 uppercase tracking-[0.2em] font-black">Powered by OtakuTime Intelligence & Llama 3.1</p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
