import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw
} from 'lucide-react';
import { format, startOfToday, addDays, subDays, differenceInCalendarDays } from 'date-fns';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useTranslation } from '../hooks/useTranslation';
import { useMedia } from '../context/MediaContext';

interface AiringAnime {
  id: number;
  originalId: number;
  titulo: string;
  capaUrl: string;
  displayNum: number;
  displayDate: string;
  type: 'anime' | 'manga';
  prioridade?: number | null;
  season?: number;
  epAtualGlobal?: number;
  epName?: string | null;
}

const CalendarPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setCategoria } = useMedia();
  const [items, setItems] = useState<AiringAnime[]>([]);
  const [loading, setLoading] = useState(true);

  const today = startOfToday();

  useEffect(() => {
    setCategoria('anime');
  }, [setCategoria]);

  const getFormattedWeekDay = (date: Date) => {
    const dayNameEn = format(date, 'EEEE');
    if (t("Segunda") !== "Segunda") {
      return dayNameEn;
    }
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

  const fetchAiring = async () => {
    setLoading(true);
    try {
      const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
      const animeRes = await customFetch(
        `${API_BASE_URL}/anime/calendar?start_date=${yesterdayStr}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const calendarData = await animeRes.json();
      setItems(calendarData);
    } catch (error) {
      console.error("Error loading calendar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiring();
  }, []);

  // Initialize chronological groups
  const groupedItems: Record<string, { label: string; dateStr: string; items: AiringAnime[] }> = {};
  groupedItems['yesterday'] = { label: t('ONTEM'), dateStr: format(subDays(today, 1), 'yyyy-MM-dd'), items: [] };
  groupedItems['today'] = { label: t('HOJE'), dateStr: format(today, 'yyyy-MM-dd'), items: [] };
  groupedItems['tomorrow'] = { label: t('AMANHÃ'), dateStr: format(addDays(today, 1), 'yyyy-MM-dd'), items: [] };
  
  for (let offset = 2; offset <= 6; offset++) {
    const dDate = addDays(today, offset);
    groupedItems[`day-${offset}`] = {
      label: getFormattedWeekDay(dDate).toUpperCase(),
      dateStr: format(dDate, 'yyyy-MM-dd'),
      items: []
    };
  }
  groupedItems['later'] = { label: t('DEPOIS'), dateStr: 'later', items: [] };

  // Group fetched releases
  const addedToLater = new Set<number>();
  items.forEach(item => {
    const itemDate = new Date(item.displayDate);
    const diff = differenceInCalendarDays(itemDate, today);
    
    if (diff === -1) {
      groupedItems['yesterday'].items.push(item);
    } else if (diff === 0) {
      groupedItems['today'].items.push(item);
    } else if (diff === 1) {
      groupedItems['tomorrow'].items.push(item);
    } else if (diff >= 2 && diff <= 6) {
      groupedItems[`day-${diff}`].items.push(item);
    } else if (diff >= 7) {
      // In the "Depois" section, only include the next (earliest) episode of each anime
      if (!addedToLater.has(item.originalId)) {
        groupedItems['later'].items.push(item);
        addedToLater.add(item.originalId);
      }
    }
  });

  // Sort by date inside each group
  Object.keys(groupedItems).forEach(key => {
    groupedItems[key].items.sort((a, b) => new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime());
  });

  const renderCard = (item: AiringAnime) => {
    const isPastOrToday = new Date(item.displayDate) <= new Date();
    const isWatched = item.epAtualGlobal !== undefined && item.displayNum <= item.epAtualGlobal;
    const airDateObj = new Date(item.displayDate);
    const diffDays = differenceInCalendarDays(airDateObj, today);

    // Dynamic Badges
    const badges: { text: string; classes: string }[] = [];
    
    if (item.displayNum === 1) {
      badges.push({
        text: t('PREMIERE'),
        classes: 'border border-white/20 text-white bg-white/5'
      });
    }

    // "NOVO" badge if it is from yesterday/today and unwatched
    if (diffDays >= -1 && diffDays <= 0 && !isWatched) {
      badges.push({
        text: t('NOVO'),
        classes: 'bg-[#EED535] text-black font-black'
      });
    }

    if (isPastOrToday) {
      badges.push({
        text: t('EXIBIDO'),
        classes: 'bg-[#10B981] text-white font-black'
      });
    } else {
      if (diffDays >= 1 && diffDays <= 3) {
        badges.push({
          text: t('MAIS RECENTE'),
          classes: 'border border-white/20 text-white bg-white/5'
        });
      } else {
        badges.push({
          text: t('AGENDADO'),
          classes: 'border border-white/10 text-white/60 bg-white/5'
        });
      }
    }

    const isDefaultTime =
      airDateObj.getUTCHours() === 12 &&
      airDateObj.getUTCMinutes() === 0 &&
      airDateObj.getUTCSeconds() === 0;

    const formattedTime = isDefaultTime ? null : format(airDateObj, 'HH:mm');

    return (
      <article 
        key={item.id}
        className="glass-panel rim-light p-4 md:p-5 rounded-2xl flex gap-4 md:gap-6 hover:border-secondary/40 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer group min-w-0"
        onClick={() => navigate(`/details/${item.type}/${item.originalId}`)}
      >
        {/* Cover Poster */}
        <div className="w-16 h-24 md:w-20 md:h-28 rounded-xl overflow-hidden flex-shrink-0 relative border border-white/5 shadow-lg">
          <img 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            src={item.capaUrl} 
            alt={item.titulo} 
          />
        </div>
        
        {/* Content details */}
        <div className="flex flex-col justify-between py-1 min-w-0 flex-1">
          <div className="space-y-1 min-w-0">
            {/* Show title capsule */}
            <div className="flex items-center min-w-0">
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/details/${item.type}/${item.originalId}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 border border-white/10 rounded-full text-[10px] font-black text-white hover:bg-white/10 hover:border-white/25 transition-all uppercase tracking-wider bg-white/5 truncate max-w-full"
              >
                <span className="truncate">{item.titulo}</span>
                <span className="text-[8px] text-white/50 flex-shrink-0">&gt;</span>
              </span>
            </div>
            
            {/* Season/Episode details */}
            <h3 className="text-base md:text-lg font-extrabold text-white leading-tight mt-1">
              {item.type === 'anime' 
                ? `${item.season ? `T${item.season} | ` : ''}E${item.displayNum}`
                : `${t('Capítulo')} ${item.displayNum}`}
            </h3>
            
            {/* Episode title */}
            {item.epName && (
              <p className="text-on-surface-variant text-[11px] leading-relaxed truncate max-w-md md:max-w-xl">
                {item.epName}
              </p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2 pt-1.5">
              {badges.map((b, idx) => (
                <span 
                  key={idx} 
                  className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm shrink-0 ${b.classes}`}
                >
                  {b.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right side information */}
        <div className="flex flex-col justify-center items-end shrink-0 pl-2">
          {diffDays >= 7 ? (
            /* Huge Remaining Days text for LATER (Depois) */
            <div className="text-right flex flex-col items-end">
              <span className="text-3xl md:text-4xl font-black text-white leading-none">
                {diffDays}
              </span>
              <span className="text-[9px] text-on-surface-variant font-bold tracking-widest uppercase mt-1">
                {t('DIAS')}
              </span>
            </div>
          ) : (
            /* Broadcast Time */
            formattedTime && (
              <div className="text-right text-xs text-on-surface-variant space-y-1">
                <span className="text-secondary font-black block text-base md:text-lg">
                  {formattedTime}
                </span>
                <span className="text-[9px] uppercase tracking-widest font-bold opacity-60">
                  {t('HORA')}
                </span>
              </div>
            )
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="pt-8 px-6 md:px-margin-desktop pb-32 max-w-3xl mx-auto">
      {/* Header Section */}
      <section className="mb-12 text-center md:text-left">
        <div>
          <span className="text-secondary font-label-md tracking-widest mb-2 block uppercase font-bold text-xs">
            Upcoming Releases
          </span>
          <h2 className="font-display-lg text-3xl md:text-display-lg font-extrabold text-white">
            {t("Calendário de Lançamentos")}
          </h2>
        </div>
      </section>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin text-primary" />
          <p className="text-gray-500 text-sm">{t("A carregar calendário de lançamentos...")}</p>
        </div>
      ) : (
        <main className="space-y-12">
          {Object.entries(groupedItems).map(([key, group]) => (
            <section key={key} id={`group-${key}`}>
              {/* Centered Group Pill Header */}
              <div className="flex justify-center mb-6">
                <span className="bg-surface-container border border-white/5 text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase shadow-md">
                  {group.label}
                </span>
              </div>

              {/* Group Content */}
              {group.items.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {group.items.map((item) => renderCard(item))}
                </div>
              ) : (
                <div className="bg-surface-container-low/20 border border-dashed border-white/5 rounded-2xl p-6 text-center">
                  <p className="text-on-surface-variant text-[11px] font-medium italic">
                    {t("Sem lançamentos para este dia")}
                  </p>
                </div>
              )}
            </section>
          ))}
        </main>
      )}
    </div>
  );
};

export default CalendarPage;
