import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, RefreshCw
} from 'lucide-react';
import { format, isSameDay, startOfToday, addDays, eachDayOfInterval } from 'date-fns';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';

interface AiringAnime {
  id: number;
  titulo: string;
  capaUrl: string;
  displayNum: number;
  displayDate: string;
  type: 'anime' | 'manga';
  prioridade?: number | null;
}

const CalendarPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AiringAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(startOfToday());



  const days = eachDayOfInterval({
    start: startOfToday(),
    end: addDays(startOfToday(), 6),
  });

  const fetchAiring = async () => {
    setLoading(true);
    try {
      const animeRes = await customFetch(`${API_BASE_URL}/anime`, { headers: { 'Authorization': `Bearer ${token}` } });
      const animeData = await animeRes.json();
      
      const airingAnime = animeData
        .filter((a: any) => a.proximoEpisodioData !== null)
        .map((a: any) => ({ ...a, type: 'anime' as const, displayDate: a.proximoEpisodioData, displayNum: a.proximoEpisodio }));

      setItems(airingAnime);
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
        classes: 'bg-secondary/20 text-secondary border border-secondary/30 shadow-lg'
      };
    }

    if (isSameDay(date, now)) {
      const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
      if (diffMinutes >= -15 && diffMinutes <= 120) {
        return {
          text: 'LIVE NOW',
          classes: 'bg-secondary text-white shadow-lg animate-pulse'
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



  const itemsOnSelectedDay = items.filter(item => {
    return isSameDay(new Date(item.displayDate), selectedDate);
  });

  return (
    <div className="pt-8 px-6 md:px-margin-desktop pb-32">
      {/* Header Section */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-secondary font-label-md tracking-widest mb-2 block uppercase font-bold text-xs">
              Upcoming Releases
            </span>
            <h2 className="font-display-lg text-3xl md:text-display-lg font-extrabold text-white">
              Calendário de Lançamentos
            </h2>
          </div>
        </div>
      </section>

      {/* Sticky Date Selector */}
      <section className="mb-12 sticky top-[72px] md:top-[88px] z-30 py-4 bg-background/50 backdrop-blur-sm -mx-2 px-2">
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
                  className="flex flex-col items-center justify-center min-w-[72px] md:min-w-[100px] h-[84px] md:h-[105px] p-4 md:p-5 rounded-2xl bg-secondary text-white shadow-[0_8px_30px_rgba(194,24,91,0.3)] cursor-pointer ring-2 ring-secondary ring-offset-4 ring-offset-background scale-105 transition-all flex-shrink-0 relative z-10"
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
                className="flex flex-col items-center justify-center min-w-[64px] md:min-w-[80px] h-[76px] md:h-[92px] p-3 md:p-4 rounded-2xl bg-white/5 border border-white/5 text-on-surface-variant cursor-pointer group hover:text-white hover:border-secondary/40 hover:bg-white/10 transition-all flex-shrink-0 relative z-0"
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
            <span className="w-2 h-6 bg-primary rounded-full"></span>
            Lançamentos de {isSameDay(selectedDate, startOfToday()) ? 'Hoje' : getFormattedWeekDay(selectedDate)}
          </h2>

          {itemsOnSelectedDay.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {itemsOnSelectedDay.map((item) => {
                const badge = getReleaseBadge(item);
                const formattedTime = format(new Date(item.displayDate), 'HH:mm');

                return (
                  <article 
                    key={`${item.type}-${item.id}`}
                    className="glass-panel rim-light p-4 rounded-2xl flex gap-4 hover:border-secondary/50 transition-all cursor-pointer group min-w-0"
                    onClick={() => navigate('/', { state: { openDetailsId: item.id, openDetailsType: item.type } })}
                  >
                    <div className="w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 relative">
                      <img 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        src={item.capaUrl} 
                        alt={item.titulo} 
                      />
                      <div className="absolute top-2 left-2">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-md ${badge.classes}`}>
                          {badge.text}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col justify-between py-1 min-w-0 flex-1">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-bold">
                          <span className="text-secondary flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-secondary" />
                            {formattedTime} (JST)
                          </span>
                          <span className="bg-deep-gray/80 backdrop-blur-md text-white px-2 py-0.5 rounded border border-white/10 font-medium">
                            Episódio {item.displayNum}
                          </span>
                        </div>
                        
                        <h3 className="font-label-md text-sm text-white leading-tight font-bold group-hover:text-secondary transition-colors truncate">
                          {item.titulo}
                        </h3>
                        
                        <p className="text-on-surface-variant text-[11px] leading-relaxed line-clamp-2">
                          Acompanha o novo episódio de {item.titulo} transmitido em direto do Japão.
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="flex items-center gap-1.5 text-xs text-secondary font-bold hover:underline">
                          <span>Ver Detalhes</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container-low/50 border border-dashed border-white/5 rounded-[32px] p-10 md:p-16 text-left max-w-3xl my-6 space-y-4">
              <div className="bg-white/5 inline-flex p-4 rounded-full border border-white/5 shadow-inner text-on-surface-variant">
                <Clock className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Sem lançamentos para este dia</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed max-w-md">
                Nenhum anime da tua biblioteca tem novos episódios agendados para a data selecionada.
              </p>
            </div>
          )}

          {/* Timeline & Weekly Stats */}
          <section className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 border-t border-white/10 pt-12 animate-in fade-in duration-500">
              <div className="lg:col-span-2">
                <h3 className="font-headline-lg text-white mb-8 flex items-center gap-3 text-xl md:text-2xl font-black">
                  <Clock className="w-6 h-6 text-secondary" />
                  Próximas 24 Horas
                </h3>
                
                <div className="space-y-4">
                  {items.filter(item => {
                    const itemDate = new Date(item.displayDate);
                    const now = new Date();
                    const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    return itemDate >= now && itemDate <= next24;
                  })
                  .sort((a, b) => new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime())
                  .slice(0, 5)
                  .map((item) => {
                    const date = new Date(item.displayDate);
                    return (
                      <div 
                        key={`timeline-${item.type}-${item.id}`} 
                        className="glass-panel p-5 rounded-2xl flex items-center gap-6 group hover:border-secondary/30 transition-all cursor-pointer border border-white/5"
                        onClick={() => navigate('/', { state: { openDetailsId: item.id, openDetailsType: item.type } })}
                      >
                        <div className="text-center min-w-[80px]">
                          <span className="text-secondary font-black block text-sm">
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
                          <h4 className="text-white font-bold group-hover:text-secondary transition-colors truncate">{item.titulo}</h4>
                          <p className="text-on-surface-variant text-xs">
                            Episódio {item.displayNum} • Anime
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
                <div className="glass-panel bg-surface-container rounded-3xl p-8 border border-white/10 lg:sticky lg:top-28">
                  <h3 className="font-headline-lg text-white mb-6 text-xl font-black">Resumo da Semana</h3>
                  <div className="space-y-6 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Total de Lançamentos</span>
                      <span className="text-white font-black text-lg">{items.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Sua Lista (Hoje)</span>
                      <span className="text-secondary font-black text-lg">
                        {items.filter(i => isSameDay(new Date(i.displayDate), startOfToday())).length}
                      </span>
                    </div>
                    <div className="h-[1px] bg-white/10"></div>
                    <div>
                      <p className="text-[10px] text-on-surface-variant mb-4 uppercase tracking-widest font-black">Mais Aguardados</p>
                      <div className="space-y-4">
                        {(() => {
                          const mostAnticipated = [...items]
                            .sort((a, b) => {
                              const pA = a.prioridade || 999;
                              const pB = b.prioridade || 999;
                              if (pA !== pB) return pA - pB;
                              return new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime();
                            })
                            .slice(0, 2);

                          return mostAnticipated.map((item, idx) => (
                            <div key={`summary-${idx}`} className="flex items-center gap-3">
                              <div className={`w-1.5 h-8 rounded-full ${idx === 0 ? 'bg-secondary' : 'bg-secondary/60'}`}></div>
                              <div className="min-w-0">
                                <p className="text-white font-medium text-xs truncate">{item.titulo}</p>
                                <p className="text-on-surface-variant text-[10px] font-bold">
                                  {getFormattedWeekDay(new Date(item.displayDate))}, {format(new Date(item.displayDate), 'HH:mm')}
                                </p>
                              </div>
                            </div>
                          ));
                        })()}
                        {items.length === 0 && (
                          <p className="text-on-surface-variant text-xs italic">Sem destaques.</p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/')}
                      className="w-full mt-6 bg-surface-container-highest hover:bg-primary hover:text-white border border-white/5 py-3.5 rounded-2xl font-bold text-on-surface text-xs transition-all active:scale-95 cursor-pointer shadow"
                    >
                      Voltar para Biblioteca
                    </button>
                  </div>
                </div>
              </div>
            </section>
        </>
      )}
    </div>
  );
};

export default CalendarPage;
