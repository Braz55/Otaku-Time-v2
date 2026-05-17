import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../context/MediaContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar as CalendarIcon, Clock, ExternalLink } from 'lucide-react';
import { format, isSameDay, startOfToday, addDays, eachDayOfInterval } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { API_BASE_URL } from '../config';

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
  const { categoria } = useMedia();
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
      const [animeRes, mangaRes] = await Promise.all([
        fetch(`${API_BASE_URL}/anime`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/manga`, { headers: { 'Authorization': `Bearer ${token}` } })
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

  const itemsOnSelectedDay = items.filter(item => 
    item.type === categoria && isSameDay(new Date(item.displayDate), selectedDate)
  );

  return (
    <div className="min-h-screen bg-[#0f1014] text-gray-200 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <button 
            onClick={() => navigate('/')}
            className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-600/20 rounded-2xl border border-purple-500/20">
              <CalendarIcon className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                Release Calendar
              </h1>
              <p className="text-gray-500 mt-1">Track upcoming episodes and chapters from your library</p>
            </div>
          </div>
        </header>

        {/* Date Selector */}
        <div className="flex gap-4 mb-12 overflow-x-auto pb-4 scrollbar-hide">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 rounded-2xl border transition-all ${
                  isSelected 
                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/30 scale-105' 
                    : 'bg-[#1a1c23] border-gray-800 text-gray-500 hover:border-gray-600'
                }`}
              >
                <span className="text-xs uppercase font-bold tracking-widest mb-1">
                  {format(day, 'EEE', { locale: enUS })}
                </span>
                <span className="text-2xl font-bold">
                  {format(day, 'd')}
                </span>
                <span className="text-[10px] uppercase font-medium mt-1">
                  {format(day, 'MMMM', { locale: enUS })}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500">Checking broadcast schedules...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-3">
              <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
              Releases for {isSameDay(selectedDate, startOfToday()) ? 'Today' : format(selectedDate, "EEEE, MMMM d", { locale: enUS })}
            </h2>

            {itemsOnSelectedDay.length > 0 ? (
              <div className="grid gap-4">
                {itemsOnSelectedDay.map((item: any) => (
                  <div 
                    key={`${item.type}-${item.id}`}
                    className="bg-[#1a1c23] border border-gray-800 rounded-2xl p-4 flex items-center gap-6 hover:border-purple-500/30 transition-all group"
                  >
                    <div className="w-20 h-28 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={item.capaUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.titulo} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md mb-1 inline-block ${item.type === 'anime' ? 'bg-purple-500/20 text-purple-400' : 'bg-pink-500/20 text-pink-400'}`}>
                            {item.type}
                          </span>
                          <h3 className="text-xl font-bold group-hover:text-purple-400 transition-colors">{item.titulo}</h3>
                        </div>
                        <span className={`${item.type === 'anime' ? 'bg-purple-600/10 text-purple-400 border-purple-500/20' : 'bg-pink-600/10 text-pink-400 border-pink-500/20'} px-3 py-1 rounded-full text-xs font-bold border`}>
                          {item.type === 'anime' ? 'EP' : 'CH'} {item.displayNum}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-gray-500 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>Broadcast at {format(new Date(item.displayDate), 'HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-3 bg-gray-800 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#1a1c23]/50 border border-dashed border-gray-800 rounded-3xl p-20 text-center">
                <div className="bg-gray-800/50 inline-flex p-6 rounded-full mb-6">
                  <Clock className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-400">No releases scheduled for this day</h3>
                <p className="text-gray-600 mt-2">No items in your library have episodes or chapters scheduled for this date.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
