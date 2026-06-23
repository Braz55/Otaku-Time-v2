import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ListPlus, Loader2, Plus, Sparkles, Upload } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GenreTagPicker from '../components/GenreTagPicker';

type CustomList = {
  id: number;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  isPublic: boolean;
  criteria?: any;
  _count?: { items: number };
};

const ListsPage = () => {
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [lists, setLists] = useState<CustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Metadata for genre/tag picker
  const [metadata, setMetadata] = useState<any[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    coverUrl: '',
    isPublic: false,
    selectedGenres: [] as string[],
    selectedTags: [] as string[],
    includeAnime: true,
    includeManga: true,
  });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const loadLists = async () => {
    setLoading(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/lists`, { headers });
      if (!res.ok) throw new Error('Erro ao carregar listas');
      setLists(await res.json());
    } catch (error) {
      console.error(error);
      showToast('Não foi possível carregar as listas.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    setLoadingMetadata(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/anime/genres-and-tags`, { headers });
      if (res.ok) {
        setMetadata(await res.json());
      }
    } catch (error) {
      console.error("Error loading metadata:", error);
    } finally {
      setLoadingMetadata(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadLists();
      fetchMetadata();
    }
  }, [token]);

  // Compress/resize image using Canvas before converting to base64
  const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor, seleciona um ficheiro de imagem válido.', 'warning');
      return;
    }

    try {
      const compressed = await compressImage(file, 800, 450);
      setForm(prev => ({ ...prev, coverUrl: compressed }));
      showToast('Capa carregada e comprimida!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao processar imagem.', 'error');
    }
  };

  const createList = async () => {
    if (!form.name.trim() || creating) return;
    setCreating(true);
    try {
      const criteria = {
        genres: form.selectedGenres,
        tags: form.selectedTags,
        mediaTypes: [
          ...(form.includeAnime ? ['ANIME'] : []),
          ...(form.includeManga ? ['MANGA'] : []),
        ],
      };
      const res = await customFetch(`${API_BASE_URL}/lists`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          coverUrl: form.coverUrl,
          isPublic: form.isPublic,
          criteria,
        }),
      });
      if (!res.ok) throw new Error('Erro ao criar lista');
      const created = await res.json();
      showToast('Lista criada.', 'success');
      navigate(`/lists/${created.id}`);
    } catch (error) {
      console.error(error);
      showToast('Não foi possível criar a lista.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-6 md:py-10 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display-lg text-3xl md:text-5xl font-black text-white tracking-tight">Listas</h2>
          <p className="text-on-surface-variant text-sm mt-2">Coleções personalizadas com ordem própria e sincronização por géneros ou tags.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-sm">
          <Sparkles className="w-4 h-4" />
          {lists.length} listas
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        <div className="bg-surface-container border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center">
              <ListPlus className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white">Nova lista</h3>
          </div>

          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição" rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary resize-none" />
          
          <div className="space-y-2">
            <input 
              type="file" 
              id="cover-upload-file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex gap-2">
              <input 
                value={form.coverUrl} 
                onChange={e => setForm({ ...form, coverUrl: e.target.value })} 
                placeholder="URL da capa ou importa um ficheiro" 
                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" 
              />
              <button
                type="button"
                onClick={() => document.getElementById('cover-upload-file')?.click()}
                className="px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Upload className="w-4 h-4 text-primary" />
                <span>Importar</span>
              </button>
            </div>
          </div>

          {loadingMetadata ? (
            <div className="py-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <GenreTagPicker
              metadata={metadata}
              selectedGenres={form.selectedGenres}
              selectedTags={form.selectedTags}
              isOpen={pickerOpen}
              onOpen={() => setPickerOpen(true)}
              onClose={() => setPickerOpen(false)}
              onToggleGenre={(name) => {
                setForm(prev => {
                  const exist = prev.selectedGenres.includes(name);
                  return {
                    ...prev,
                    selectedGenres: exist 
                      ? prev.selectedGenres.filter(g => g !== name) 
                      : [...prev.selectedGenres, name]
                  };
                });
              }}
              onToggleTag={(name) => {
                setForm(prev => {
                  const exist = prev.selectedTags.includes(name);
                  return {
                    ...prev,
                    selectedTags: exist 
                      ? prev.selectedTags.filter(t => t !== name) 
                      : [...prev.selectedTags, name]
                  };
                });
              }}
              onClear={() => {
                setForm(prev => ({ ...prev, selectedGenres: [], selectedTags: [] }));
              }}
            />
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              ['includeAnime', 'Anime'],
              ['includeManga', 'Manga'],
              ['isPublic', 'Pública'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))} className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${form[key as keyof typeof form] ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-on-surface-variant'}`}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={createList} disabled={creating || !form.name.trim()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-on-primary font-black disabled:opacity-50 active:scale-95 transition-all">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
          ) : lists.length === 0 ? (
            <div className="col-span-full py-20 text-center rounded-2xl border border-white/10 bg-white/5 text-on-surface-variant">Ainda não tens listas personalizadas.</div>
          ) : lists.map(list => (
            <Link key={list.id} to={`/lists/${list.id}`} className="group rounded-2xl overflow-hidden bg-surface-container border border-white/10 hover:border-primary/40 transition-all shadow-lg">
              <div className="aspect-[16/9] bg-surface-container-highest relative overflow-hidden">
                {list.coverUrl ? <img src={list.coverUrl} alt={list.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full bg-gradient-to-br from-primary/40 via-secondary/30 to-emerald-500/30" />}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center gap-1">
                  {list.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {list.isPublic ? 'Pública' : 'Privada'}
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-white font-black text-lg truncate">{list.name}</h3>
                <p className="text-on-surface-variant text-xs line-clamp-2 min-h-[2rem] mt-1">{list.description || 'Sem descrição.'}</p>
                <p className="text-primary text-xs font-bold mt-4">{list._count?.items || 0} itens</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ListsPage;
