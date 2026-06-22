import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Loader2, Save, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { customFetch } from '../services/apiBridge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type ListItem = {
  id: number;
  anilistMediaId: number;
  mediaType: 'ANIME' | 'MANGA';
  position: number;
  anime?: any;
  manga?: any;
};

type CustomList = {
  id: number;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  isPublic: boolean;
  criteria?: any;
  items: ListItem[];
};

const splitValues = (value: string) => value.split(',').map(v => v.trim()).filter(Boolean);

const ListDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<CustomList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    coverUrl: '',
    isPublic: false,
    genres: '',
    tags: '',
    includeAnime: true,
    includeManga: true,
  });

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const hydrateForm = (data: CustomList) => {
    const criteria = data.criteria || {};
    setForm({
      name: data.name || '',
      description: data.description || '',
      coverUrl: data.coverUrl || '',
      isPublic: Boolean(data.isPublic),
      genres: (criteria.genres || []).join(', '),
      tags: (criteria.tags || []).join(', '),
      includeAnime: !criteria.mediaTypes?.length || criteria.mediaTypes.includes('ANIME'),
      includeManga: !criteria.mediaTypes?.length || criteria.mediaTypes.includes('MANGA'),
    });
  };

  const loadList = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/lists/${id}`, { headers });
      if (!res.ok) throw new Error('Erro ao carregar lista');
      const data = await res.json();
      setList(data);
      hydrateForm(data);
    } catch (error) {
      console.error(error);
      showToast('Não foi possível carregar a lista.', 'error');
      navigate('/lists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadList();
  }, [token, id]);

  const saveList = async () => {
    if (!id || saving) return;
    setSaving(true);
    try {
      const criteria = {
        genres: splitValues(form.genres),
        tags: splitValues(form.tags),
        mediaTypes: [
          ...(form.includeAnime ? ['ANIME'] : []),
          ...(form.includeManga ? ['MANGA'] : []),
        ],
      };
      const res = await customFetch(`${API_BASE_URL}/lists/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          coverUrl: form.coverUrl,
          isPublic: form.isPublic,
          criteria,
        }),
      });
      if (!res.ok) throw new Error('Erro ao guardar lista');
      const data = await res.json();
      setList(data);
      hydrateForm(data);
      showToast('Lista guardada.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível guardar a lista.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const persistOrder = async (items: ListItem[]) => {
    if (!id) return;
    setList(prev => prev ? { ...prev, items } : prev);
    try {
      const res = await customFetch(`${API_BASE_URL}/lists/${id}/items/order`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ items: items.map((item, index) => ({ id: item.id, position: index + 1 })) }),
      });
      if (!res.ok) throw new Error('Erro ao ordenar');
      setList(await res.json());
    } catch (error) {
      console.error(error);
      showToast('Não foi possível guardar a ordem.', 'error');
      loadList();
    }
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    if (!list) return;
    const target = index + delta;
    if (target < 0 || target >= list.items.length) return;
    const next = [...list.items];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  };

  const removeItem = async (item: ListItem) => {
    if (!id) return;
    try {
      const res = await customFetch(`${API_BASE_URL}/lists/${id}/items/${item.mediaType}/${item.anilistMediaId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Erro ao remover item');
      setList(await res.json());
      showToast('Item removido.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível remover o item.', 'error');
    }
  };

  const deleteList = async () => {
    if (!id || !confirm('Eliminar esta lista?')) return;
    try {
      const res = await customFetch(`${API_BASE_URL}/lists/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Erro ao eliminar lista');
      showToast('Lista eliminada.', 'success');
      navigate('/lists');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível eliminar a lista.', 'error');
    }
  };

  if (loading || !list) {
    return <div className="py-32 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-6 md:py-10 space-y-8">
      <button onClick={() => navigate('/lists')} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-on-surface-variant hover:text-white">
        <ArrowLeft className="w-4 h-4" />
        Listas
      </button>

      <section className="relative min-h-[280px] rounded-2xl overflow-hidden border border-white/10 bg-surface-container">
        {list.coverUrl ? <img src={list.coverUrl} alt={list.name} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-secondary/30 to-emerald-500/30" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-black/20" />
        <div className="relative z-10 p-6 md:p-10 min-h-[280px] flex flex-col justify-end">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-black/50 text-white text-xs font-bold flex items-center gap-1">
              {list.isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {list.isPublic ? 'Pública' : 'Privada'}
            </span>
            <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">{list.items.length} itens</span>
          </div>
          <h2 className="font-display-lg text-4xl md:text-6xl font-black text-white tracking-tight">{list.name}</h2>
          <p className="text-on-surface-variant max-w-3xl mt-3">{list.description || 'Sem descrição.'}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">
        <div className="bg-surface-container border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-black">Editar lista</h3>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary resize-none" />
          <input value={form.coverUrl} onChange={e => setForm({ ...form, coverUrl: e.target.value })} placeholder="URL da capa" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
          <input value={form.genres} onChange={e => setForm({ ...form, genres: e.target.value })} placeholder="Géneros" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
          <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Tags" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
          <div className="grid grid-cols-3 gap-2">
            {[
              ['includeAnime', 'Anime'],
              ['includeManga', 'Manga'],
              ['isPublic', 'Pública'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))} className={`py-2.5 rounded-xl border text-xs font-bold ${form[key as keyof typeof form] ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-on-surface-variant'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={saveList} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-on-primary font-black disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
          <button onClick={deleteList} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-error/15 border border-error/30 text-error font-bold">
            <Trash2 className="w-4 h-4" />
            Eliminar lista
          </button>
        </div>

        <div className="space-y-3">
          {list.items.length === 0 ? (
            <div className="py-20 text-center rounded-2xl border border-white/10 bg-white/5 text-on-surface-variant">Esta lista ainda não tem itens.</div>
          ) : list.items.map((item, index) => {
            const media = item.mediaType === 'ANIME' ? item.anime : item.manga;
            const mediaTypePath = item.mediaType.toLowerCase();
            return (
              <div key={item.id} className="grid grid-cols-[56px_1fr_auto] sm:grid-cols-[72px_1fr_auto] gap-4 items-center bg-surface-container border border-white/10 rounded-2xl p-3">
                <Link to={`/details/${mediaTypePath}/${item.anilistMediaId}`} className="aspect-[3/4] rounded-xl overflow-hidden bg-white/5">
                  {media?.capaUrl ? <img src={media.capaUrl} alt={media?.titulo} className="w-full h-full object-cover" /> : null}
                </Link>
                <div className="min-w-0">
                  <p className="text-primary text-xs font-black">#{index + 1} · {item.mediaType}</p>
                  <Link to={`/details/${mediaTypePath}/${item.anilistMediaId}`} className="text-white font-black text-base sm:text-lg truncate block hover:text-primary">{media?.titulo || `Media ${item.anilistMediaId}`}</Link>
                  <p className="text-on-surface-variant text-xs line-clamp-2">{media?.descricao || 'Sem descrição.'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-30 flex items-center justify-center">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveItem(index, 1)} disabled={index === list.items.length - 1} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-30 flex items-center justify-center">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeItem(item)} className="w-9 h-9 rounded-xl bg-error/10 border border-error/20 text-error flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ListDetailsPage;
