import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ListPlus, Loader2, Plus, Sparkles, Upload, X } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

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
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    coverUrl: '',
    isPublic: false,
    coverPosition: 50,
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

  useEffect(() => {
    if (token) {
      loadLists();
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
      const compressed = await compressImage(file, 1200, 675);
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
      const res = await customFetch(`${API_BASE_URL}/lists`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          coverUrl: form.coverUrl,
          isPublic: form.isPublic,
          criteria: { coverPosition: form.coverPosition },
        }),
      });
      if (!res.ok) throw new Error('Erro ao criar lista');
      const created = await res.json();
      showToast('Lista criada.', 'success');
      setShowCreateModal(false);
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
          <p className="text-on-surface-variant text-sm mt-2">Coleções personalizadas com ordenação manual.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-on-surface-variant font-bold text-xs md:text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            {lists.length} listas
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-on-primary font-black text-xs md:text-sm shadow-lg hover:shadow-primary/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Lista</span>
          </button>
        </div>
      </div>

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {loading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
          ) : lists.length === 0 ? (
            <div className="col-span-full py-20 text-center rounded-2xl border border-white/10 bg-white/5 text-on-surface-variant">Ainda não tens listas personalizadas.</div>
          ) : lists.map(list => (
            <Link key={list.id} to={`/lists/${list.id}`} className="group rounded-2xl overflow-hidden bg-surface-container border border-white/10 hover:border-primary/40 transition-all shadow-lg">
              <div className="aspect-[16/9] bg-surface-container-highest relative overflow-hidden">
                {list.coverUrl ? (
                  <img 
                    src={list.coverUrl} 
                    alt={list.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    style={{ objectPosition: `center ${list.criteria?.coverPosition ?? 50}%` }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/40 via-secondary/30 to-emerald-500/30" />
                )}
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

      {/* Modal de Criação de Lista */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-surface-container rounded-[24px] border border-white/10 shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                  <ListPlus className="w-5 h-5" />
                </div>
                <h3 className="font-display-md text-lg font-extrabold text-white">Nova Lista</h3>
              </div>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setForm({ name: '', description: '', coverUrl: '', isPublic: false, coverPosition: 50 });
                }} 
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Nome da Lista</label>
                <input 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  placeholder="Ex: Os meus animes preferidos..." 
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Descrição</label>
                <textarea 
                  value={form.description} 
                  onChange={e => setForm({ ...form, description: e.target.value })} 
                  placeholder="Diz algo sobre esta coleção..." 
                  rows={3} 
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary resize-none" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Capa da Lista</label>
                <input 
                  type="file" 
                  id="modal-cover-upload-file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <input 
                    value={form.coverUrl} 
                    onChange={e => setForm({ ...form, coverUrl: e.target.value })} 
                    placeholder="URL da imagem ou importa do dispositivo" 
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" 
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('modal-cover-upload-file')?.click()}
                    className="px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-primary" />
                    <span>Importar</span>
                  </button>
                </div>
                {form.coverUrl && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, coverUrl: '', coverPosition: 50 }))}
                    className="w-full py-1 text-center text-[10px] text-red-400 font-bold hover:text-red-300 transition-colors cursor-pointer"
                  >
                    Remover Capa
                  </button>
                )}
              </div>

              {form.coverUrl && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                    <span>Posição Vertical da Capa</span>
                    <span className="text-primary-light font-mono">{form.coverPosition}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={form.coverPosition}
                    onChange={(e) => setForm(prev => ({ ...prev, coverPosition: Number(e.target.value) }))}
                    className="w-full accent-primary bg-black/40 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="w-full h-24 rounded-xl border border-white/10 overflow-hidden relative mt-1">
                    <img 
                      src={form.coverUrl} 
                      alt="Capa Preview" 
                      className="absolute inset-0 w-full h-full object-cover" 
                      style={{ objectPosition: `center ${form.coverPosition}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, isPublic: !prev.isPublic }))} 
                  className={`w-full py-3 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    form.isPublic 
                      ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(139,92,246,0.1)]' 
                      : 'bg-white/5 border-white/10 text-on-surface-variant'
                  }`}
                >
                  {form.isPublic ? 'Lista Pública' : 'Lista Privada'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 border-t border-white/5 pt-4 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setForm({ name: '', description: '', coverUrl: '', isPublic: false, coverPosition: 50 });
                }}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-95 text-center cursor-pointer font-black"
              >
                Cancelar
              </button>
              <button
                onClick={createList}
                disabled={creating || !form.name.trim()}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-black text-xs transition-all active:scale-95 text-center cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Criar Lista</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListsPage;
