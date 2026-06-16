import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, RefreshCw, Play, BookOpen, Bookmark 
} from 'lucide-react';
import { format, isSameDay, startOfToday, addDays, eachDayOfInterval } from 'date-fns';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useIsMobile } from '../hooks/useIsMobile';

interface AiringAnime {
  id: number;
  titulo: string;
  capaUrl: string;
  displayNum: number;
  displayDate: string;
  type: 'anime' | 'manga';
}

const CalendarPage = () => {
  const { token } = useAuth();
  const { setCategoria } = useMedia();
  const navigate = useNavigate();
  const [items, setItems] = useState<AiringAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [activeFilter, setActiveFilter] = useState<'all' | 'anime' | 'manga'>('all');
  const isMobile = useIsMobile();

  const days = eachDayOfInterval({
    start: startOfToday(),
    end: addDays(startOfToday(), 6),
  });

  const fetchAiring = async () => {
    setLoading(true);
    try {
      const [animeRes, mangaRes] = await Promise.all([
        customFetch(`${API_BASE_URL}/anime`, { headers: { 'Authorization': `Bearer ${token}` } }),
        customFetch(`${API_BASE_URL}/manga`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      const animeData = await animeRes.json();
      const mangaData = await mangaRes.json();

      const airingAnime = animeData
        .filter((a: any) => a.proximoEpisodioData !== null)
        .map((a: any) => ({ ...a, type: 'anime' as const, displayDate: a.proximoEpisodioData, displayNum: a.proximoEpisodio }));

      const airingManga = mangaData
        .filter((m: any) => m.proximoCapituloData !== null)
        .map((m: any) => ({ ...m, type: 'manga' as const, displayDate: m.proximoCapituloData, displayNum: m.proximoCapituloNumero }));

      setItems([...airingAnime, ...airingManga]);
    } catch (error) {
      console.error("Error loading calendar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiring();
  }, []);

  const getWeekdayLabel = (day: Date) => {
    if (isSameDay(day, startOfToday())) return 'HOJE';
    const english = format(day, 'EEE'); // 'Mon', 'Tue', 'Wed', etc.
    const mapping: Record<string, string> = {
      'Mon': 'SEG',
      'Tue': 'TER',
      'Wed': 'QUA',
      'Thu': 'QUI',
      'Fri': 'SEX',
      'Sat': 'SÁB',
      'Sun': 'DOM'
    };
    return mapping[english] || english.toUpperCase();
  };

  const getFormattedWeekDay = (date: Date) => {
    const dayNameEn = format(date, 'EEEE');
    const mapping: Record<string, string> = {
      'Monday': 'Segunda-feira',
      'Tuesday': 'Terça-feira',
      'Wednesday': 'Quarta-feira',
      'Thursday': 'Quinta-feira',
      'Friday': 'Sexta-feira',
      'Saturday': 'Sábado',
      'Sunday': 'Domingo'
    };
    return mapping[dayNameEn] || dayNameEn;
  };

  const getReleaseBadge = (item: AiringAnime) => {
    const date = new Date(item.displayDate);
    const now = new Date();
    
    if (item.type === 'manga') {
      return {
        text: 'NOVO CAPÍTULO',
        classes: 'bg-deep-gray border border-white/10 text-white shadow-lg'
      };
    }

    if (item.displayNum === 1) {
      return {
        text: 'ESTREIA',
        classes: 'bg-vibrant-purple/20 text-vibrant-purple border border-vibrant-purple/30 shadow-lg'
      };
    }

    if (isSameDay(date, now)) {
      const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
      if (diffMinutes >= -15 && diffMinutes <= 120) {
        return {
          text: 'LIVE NOW',
          classes: 'bg-electric-magenta text-white shadow-lg animate-pulse'
        };
      } else if (diffMinutes > 120) {
        return {
          text: 'CONCLUÍDO',
          classes: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        };
      }
    }

    return {
      text: 'AGENDADO',
      classes: 'bg-primary/20 text-primary border border-primary/30'
    };
  };

  const handleFilterChange = (filter: 'all' | 'anime' | 'manga') => {
    setActiveFilter(filter);
    if (filter !== 'all') {
      setCategoria(filter);
    }
  };

  const itemsOnSelectedDay = items.filter(item => {
    const matchesCategory = activeFilter === 'all' || item.type === activeFilter;
    const matchesDay = isSameDay(new Date(item.displayDate), selectedDate);
    return matchesCategory && matchesDay;
  });

  return (
    <div className="pt-8 px-6 md:px-margin-desktop pb-32">
      {/* Header Section */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-electric-magenta font-label-md tracking-widest mb-2 block uppercase font-bold text-xs">
              Upcoming Releases
            </span>
            <h2 className="font-display-lg text-3xl md:text-display-lg font-extrabold text-white">
              Calendário de Lançamentos
            </h2>
          </div>
          
          <div className="flex items-center gap-2 bg-surface-container rounded-xl p-1 border border-border-glass">
            <button 
              onClick={() => handleFilterChange('all')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                activeFilter === 'all' 
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              Todos
            </button>
            <button 
              onClick={() => handleFilterChange('anime')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                activeFilter === 'anime' 
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              Anime
            </button>
            <button 
              onClick={() => handleFilterChange('manga')}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                activeFilter === 'manga' 
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              Manga
            </button>
          </div>
        </div>
      </section>

      {/* Sticky Date Selector */}
      <section className="mb-12 sticky top-20 z-30 py-4 bg-background/50 backdrop-blur-sm -mx-2 px-2">
        <div className="flex items-center gap-4 overflow-x-auto hide-scrollbar pb-2">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, startOfToday());
            const weekday = getWeekdayLabel(day);
            const dayNum = format(day, 'd');

            if (isSelected) {
              return (
                <div 
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className="flex flex-col items-center justify-center min-w-[72px] md:min-w-[100px] h-[84px] md:h-[105px] p-4 md:p-5 rounded-2xl bg-gradient-to-br from-vibrant-purple to-electric-magenta text-white shadow-[0_8px_30px_rgb(139,92,246,0.3)] cursor-pointer ring-2 ring-primary ring-offset-4 ring-offset-background scale-105 transition-all flex-shrink-0"
                >
                  <span className="text-[10px] md:text-label-sm mb-1 uppercase font-bold">
                    {isToday ? 'Hoje' : weekday}
                  </span>
                  <span className="text-xl md:text-headline-lg font-extrabold">{dayNum}</span>
                </div>
              );
            }

            return (
              <div 
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className="flex flex-col items-center justify-center min-w-[64px] md:min-w-[80px] h-[76px] md:h-[92px] p-3 md:p-4 rounded-2xl bg-white/5 border border-white/5 text-on-surface-variant cursor-pointer group hover:text-white hover:border-vibrant-purple/40 hover:bg-white/10 transition-all flex-shrink-0"
              >
                <span className="text-[10px] md:text-label-sm mb-1 uppercase opacity-60 group-hover:opacity-100 transition-opacity">
                  {weekday}
                </span>
                <span className="text-lg md:text-headline-lg font-bold">{dayNum}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Content Grid: Release Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin text-primary" />
          <p className="text-gray-500 text-sm">A carregar calendário de lançamentos...</p>
        </div>
      ) : (
        <>
          <h2 className="font-headline-lg-mobile text-xl md:text-2xl text-white flex items-center gap-2 mb-8 font-black">
            <span className="w-2 h-6 bg-vibrant-purple rounded-full"></span>
            Lançamentos de {isSameDay(selectedDate, startOfToday()) ? 'Hoje' : getFormattedWeekDay(selectedDate)}
          </h2>

          {itemsOnSelectedDay.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {itemsOnSelectedDay.map((item) => {
                const badge = getReleaseBadge(item);
                const isAnime = item.type === 'anime';
                const formattedTime = format(new Date(item.displayDate), 'HH:mm');

                return (
                  <article 
                    key={`${item.type}-${item.id}`}
                    className="glass-panel rounded-3xl overflow-hidden flex flex-col group h-full border border-white/10 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-surface-container-lowest">
                      <img 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        src={item.capaUrl} 
                        alt={item.titulo} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                      <div className="absolute top-4 left-4">
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg ${badge.classes}`}>
                          {badge.text}
                        </span>
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-deep-gray/80 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded-md border border-white/10 font-medium">
                            {isAnime ? `Episódio ${item.displayNum}` : `Capítulo ${item.displayNum}`}
                          </span>
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${isAnime ? 'bg-primary/20 text-primary border-primary/30' : 'bg-secondary/20 text-secondary border-secondary/30'}`}>
                            {isAnime ? 'Anime' : 'Manga'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-vibrant-purple text-label-sm font-bold flex items-center gap-1">
                          <Clock className="w-4 h-4 text-primary" />
                          {formattedTime} (JST)
                        </span>
                        <span className="text-on-surface-variant text-[10px] uppercase tracking-wider font-bold">
                          {isAnime ? 'Streaming' : 'Weekly Release'}
                        </span>
                      </div>
                      <h3 className="font-headline-lg text-lg text-white mb-2 leading-tight group-hover:text-primary transition-colors line-clamp-1">
                        {item.titulo}
                      </h3>
                      <p className="text-on-surface-variant text-xs leading-relaxed line-clamp-2 mb-6">
                        {isAnime 
                          ? `Acompanha o novo episódio de ${item.titulo} transmitido em direto do Japão.` 
                          : `Lê o mais recente capítulo de ${item.titulo} lançado oficialmente.`}
                      </p>
                      <div className="mt-auto pt-4 border-t border-white/15 flex items-center justify-between">
                        {isAnime ? (
                          <button 
                            onClick={() => navigate(`/`)}
                            className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all cursor-pointer"
                          >
                            <span className="text-xs uppercase font-extrabold tracking-wider">Assistir Agora</span>
                            <Play className="w-4 h-4 text-primary" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => navigate(`/`)}
                            className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all cursor-pointer"
                          >
                            <span className="text-xs uppercase font-extrabold tracking-wider">Ler Online</span>
                            <BookOpen className="w-4 h-4 text-primary" />
                          </button>
                        )}
                        <button 
                          onClick={() => navigate(`/`)}
                          className="text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                          title="Adicionar à Lista"
                        >
                          <Bookmark className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container-low/50 border border-dashed border-white/10 rounded-[32px] p-20 text-center max-w-2xl mx-auto my-12">
              <div className="bg-white/5 inline-flex p-6 rounded-full mb-6 border border-white/5 shadow-inner text-on-surface-variant">
                <Clock className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Sem lançamentos para este dia</h3>
              <p className="text-on-surface-variant text-sm max-w-md mx-auto leading-relaxed">
                Nenhum anime ou manga da tua biblioteca tem novos episódios ou capítulos agendados para a data selecionada.
              </p>
            </div>
          )}

          {/* Timeline & Weekly Stats (Desktop only section) */}
          {!isMobile && (
            <section className="mt-24 grid grid-cols-1 lg:grid-cols-3 gap-12 border-t border-white/10 pt-16 animate-in fade-in duration-500">
              <div className="lg:col-span-2">
                <h3 className="font-headline-lg text-white mb-8 flex items-center gap-3 text-xl md:text-2xl font-black">
                  <Clock className="w-6 h-6 text-vibrant-purple" />
                  Próximas 24 Horas
                </h3>
                
                <div className="space-y-4">
                  {items.filter(item => {
                    const itemDate = new Date(item.displayDate);
                    return itemDate >= startOfToday();
                  })
                  .sort((a, b) => new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime())
                  .slice(0, 5)
                  .map((item) => {
                    const date = new Date(item.displayDate);
                    const isAnime = item.type === 'anime';
                    return (
                      <div 
                        key={`timeline-${item.type}-${item.id}`} 
                        className="glass-panel p-5 rounded-2xl flex items-center gap-6 group hover:border-primary/30 transition-all cursor-pointer border border-white/5"
                        onClick={() => navigate(`/`)}
                      >
                        <div className="text-center min-w-[80px]">
                          <span className="text-electric-magenta font-black block text-sm">
                            {format(date, 'HH:mm')}
                          </span>
                          <span className="text-on-surface-variant text-[9px] uppercase tracking-widest font-bold">
                            {isSameDay(date, startOfToday()) ? 'Hoje' : format(date, 'dd/MM')}
                          </span>
                        </div>
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                          <img alt={item.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform" src={item.capaUrl} />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h4 className="text-white font-bold group-hover:text-primary transition-colors truncate">{item.titulo}</h4>
                          <p className="text-on-surface-variant text-xs">
                            {isAnime ? `Episódio ${item.displayNum}` : `Capítulo ${item.displayNum}`} • {isAnime ? 'Anime' : 'Manga'}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <span className="bg-surface-container-highest text-on-surface border border-white/5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            Agendado
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="text-on-surface-variant text-xs italic py-4">Sem lançamentos futuros agendados nos próximos dias.</p>
                  )}
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="glass-panel bg-surface-container rounded-3xl p-8 border border-white/10 sticky top-28">
                  <h3 className="font-headline-lg text-white mb-6 text-xl font-black">Resumo da Semana</h3>
                  <div className="space-y-6 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Total de Lançamentos</span>
                      <span className="text-white font-black text-lg">{items.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Sua Lista (Hoje)</span>
                      <span className="text-primary font-black text-lg">
                        {items.filter(i => isSameDay(new Date(i.displayDate), startOfToday())).length}
                      </span>
                    </div>
                    <div className="h-[1px] bg-white/10"></div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant mb-4 uppercase tracking-widest font-black">Mais Aguardados</p>
                      <div className="space-y-4">
                        {items.slice(0, 2).map((item, idx) => (
                          <div key={`summary-${idx}`} className="flex items-center gap-3">
                            <div className={`w-1.5 h-8 rounded-full ${idx === 0 ? 'bg-electric-magenta' : 'bg-vibrant-purple'}`}></div>
                            <div className="min-w-0">
                              <p className="text-white font-medium text-xs truncate">{item.titulo}</p>
                              <p className="text-on-surface-variant text-[10px] font-bold">
                                {getFormattedWeekDay(new Date(item.displayDate))}, {format(new Date(item.displayDate), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                        ))}
                        {items.length === 0 && (
                          <p className="text-on-surface-variant text-xs italic">Sem destaques.</p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/')}
                      className="w-full mt-6 bg-surface-container-highest hover:bg-primary hover:text-on-primary border border-white/5 py-3.5 rounded-2xl font-bold text-on-surface text-xs transition-all active:scale-95 cursor-pointer shadow"
                    >
                      Voltar para Biblioteca
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default CalendarPage;
