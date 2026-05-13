import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Plus, Trash2, Bot, User, Loader2, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const ChatPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingMessages, setFetchingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession);
    } else {
      setMessages([]);
    }
  }, [activeSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:3001/chat/sessions', { headers: getHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSessions(data);
        if (data.length > 0 && !activeSession) {
          setActiveSession(data[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar sessões:', err);
    }
  };

  const fetchMessages = async (sessionId: number) => {
    setFetchingMessages(true);
    try {
      const res = await fetch(`http://localhost:3001/chat/sessions/${sessionId}/messages`, { headers: getHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setFetchingMessages(false);
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
      console.error('Erro ao criar sessão:', err);
    }
  };

  const deleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Apagar esta conversa?')) return;

    try {
      await fetch(`http://localhost:3001/chat/sessions/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      setSessions(sessions.filter(s => s.id !== id));
      if (activeSession === id) setActiveSession(null);
    } catch (err) {
      console.error('Erro ao apagar sessão:', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSession || loading) return;

    const userMsg = input;
    setInput('');
    
    // Adiciona mensagem do utilizador localmente para feedback instantâneo
    const tempUserMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: userMsg,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/chat/sessions/${activeSession}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userMsg })
      });
      const aiMsg = await res.json();
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-96px)] bg-[#0f1014] text-gray-200 overflow-hidden">
      {/* Sidebar - Histórico */}
      <div className="w-80 border-r border-gray-800 bg-[#16181d]/50 backdrop-blur-xl flex flex-col">
        <div className="p-6">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nova Conversa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${
                activeSession === session.id 
                  ? 'bg-purple-600/20 border-purple-500/50 text-white' 
                  : 'bg-transparent border-transparent hover:bg-gray-800/50 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <MessageSquare className={`w-5 h-5 ${activeSession === session.id ? 'text-purple-400' : 'text-gray-600'}`} />
                <span className="truncate font-medium">{session.titulo}</span>
              </div>
              <button 
                onClick={(e) => deleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Chat Header */}
        <div className="h-20 border-b border-gray-800 flex items-center justify-between px-8 bg-[#0f1014]/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Otaku Bot</h2>
              <p className="text-xs text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Online (Llama 3.1)
              </p>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {activeSession ? (
            <>
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-4 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                      msg.role === 'user' ? 'bg-purple-600' : 'bg-pink-600'
                    }`}>
                      {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                    </div>
                    <div className={`p-5 rounded-3xl shadow-xl border ${
                      msg.role === 'user' 
                        ? 'bg-purple-600/10 border-purple-500/20 rounded-tr-none text-gray-100' 
                        : 'bg-gray-800/50 border-gray-700/50 rounded-tl-none text-gray-200'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex gap-4 max-w-[80%]">
                    <div className="w-10 h-10 rounded-2xl bg-pink-600 flex items-center justify-center shrink-0 shadow-lg">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700/50 p-5 rounded-3xl rounded-tl-none flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                      <span className="text-sm text-gray-400 font-medium italic">A pensar...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-gray-800/50 flex items-center justify-center border border-gray-700">
                <MessageSquare className="w-12 h-12 text-gray-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-400">Bem-vindo ao Chat!</h3>
                <p className="text-gray-600 max-w-sm mt-2">
                  Seleciona uma conversa ou cria uma nova para começares a falar com o Otaku Bot.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 bg-gradient-to-t from-[#0f1014] via-[#0f1014] to-transparent">
          <form 
            onSubmit={sendMessage}
            className={`flex gap-4 p-2 bg-[#1a1c23]/80 backdrop-blur-xl border rounded-[30px] shadow-2xl transition-all ${
              activeSession ? 'border-gray-700 focus-within:border-purple-500/50' : 'opacity-50 pointer-events-none border-transparent'
            }`}
          >
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunta algo sobre anime ou manga..."
              className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-gray-100 placeholder:text-gray-600"
            />
            <button 
              type="submit"
              disabled={!input.trim() || loading || !activeSession}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white p-4 rounded-full transition-all shadow-lg active:scale-90 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-600 mt-4 uppercase tracking-[0.2em] font-black">
            Powered by OtakuTime Intelligence & Llama 3.1
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
