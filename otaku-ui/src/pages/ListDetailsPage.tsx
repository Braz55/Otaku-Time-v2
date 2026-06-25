import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Loader2, Save, Trash2, Upload, GripVertical, Search, X } from 'lucide-react';
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

const ListDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<CustomList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Library & Search States
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingItemId, setAddingItemId] = useState<number | null>(null);

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Original snapshot to detect unsaved order changes
  const [originalOrder, setOriginalOrder] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    coverUrl: '',
    isPublic: false,
    coverPosition: 50,
  });

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const hydrateForm = (data: CustomList) => {
    setForm({
      name: data.name || '',
      description: data.description || '',
      coverUrl: data.coverUrl || '',
      isPublic: Boolean(data.isPublic),
      coverPosition: data.criteria?.coverPosition ?? 50,
    });
  };

  // Derive changes dynamically
  const hasUnsavedChanges = useMemo(() => {
    if (!list) return false;
    const formChanged = list.name !== form.name ||
                        (list.description || '') !== form.description ||
                        (list.coverUrl || '') !== form.coverUrl ||
                        list.isPublic !== form.isPublic ||
                        (list.criteria?.coverPosition ?? 50) !== form.coverPosition;

    const orderChanged = list.items && list.items.length > 0 &&
                         list.items.map(i => i.id).join(',') !== originalOrder;

    return formChanged || orderChanged;
  }, [form, list, originalOrder]);

  // Synchronize unsaved changes state to window global
  useEffect(() => {
    (window as any).hasUnsavedChanges = hasUnsavedChanges;
    return () => {
      (window as any).hasUnsavedChanges = false;
    };
  }, [hasUnsavedChanges]);

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      window.dispatchEvent(new CustomEvent('show-unsaved-changes-modal', {
        detail: {
          action: () => {
            navigate('/lists');
          }
        }
      }));
    } else {
      navigate('/lists');
    }
  };

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('show-unsaved-changes-modal', {
        detail: {
          action: () => {
            navigate(path);
          }
        }
      }));
    }
  };

  // Browser Reload / Window Close Blocker
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Tens alterações não guardadas nesta lista. Desejas sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadList = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await customFetch(`${API_BASE_URL}/lists/${id}`, { headers });
      if (!res.ok) throw new Error('Erro ao carregar lista');
      const data = await res.json();
      setList(data);
      hydrateForm(data);
      setOriginalOrder(data.items.map((i: any) => i.id).join(','));
    } catch (error) {
      console.error(error);
      showToast('Não foi possível carregar a lista.', 'error');
      navigate('/lists');
    } finally {
      setLoading(false);
    }
  };

  const fetchLibrary = async () => {
    if (!token) return;
    try {
      const [animeRes, mangaRes] = await Promise.all([
        customFetch(`${API_BASE_URL}/anime`, { headers }),
        customFetch(`${API_BASE_URL}/manga`, { headers }),
      ]);
      
      let allItems: any[] = [];
      
      if (animeRes.ok) {
        const animeData = await animeRes.json();
        if (Array.isArray(animeData)) {
          allItems = [...allItems, ...animeData.map((item: any) => ({
            id: item.animeId || item.id,
            titulo: item.anime?.titulo || item.titulo,
            capaUrl: item.anime?.capaUrl || item.capaUrl,
            mediaType: 'ANIME',
          }))];
        }
      }
      
      if (mangaRes.ok) {
        const mangaData = await mangaRes.json();
        if (Array.isArray(mangaData)) {
          allItems = [...allItems, ...mangaData.map((item: any) => ({
            id: item.mangaId || item.id,
            titulo: item.manga?.titulo || item.titulo,
            capaUrl: item.manga?.capaUrl || item.capaUrl,
            mediaType: 'MANGA',
          }))];
        }
      }
      
      setLibraryItems(allItems);
    } catch (err) {
      console.error('Error fetching library for list details:', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadList();
      fetchLibrary();
    }
  }, [token, id]);

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

  const saveList = async () => {
    if (!id || !list || saving) return;
    setSaving(true);
    try {
      // 1. If form details changed, save them
      const formChanged = list.name !== form.name ||
                          (list.description || '') !== form.description ||
                          (list.coverUrl || '') !== form.coverUrl ||
                          list.isPublic !== form.isPublic ||
                          (list.criteria?.coverPosition ?? 50) !== form.coverPosition;

      let updatedList = list;
      if (formChanged) {
        const res = await customFetch(`${API_BASE_URL}/lists/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            coverUrl: form.coverUrl,
            isPublic: form.isPublic,
            criteria: { ...list.criteria, coverPosition: form.coverPosition },
          }),
        });
        if (!res.ok) throw new Error('Erro ao guardar detalhes da lista');
        updatedList = await res.json();
      }

      // 2. If order changed, save the order
      const orderChanged = list.items.map(i => i.id).join(',') !== originalOrder;
      if (orderChanged) {
        const res = await customFetch(`${API_BASE_URL}/lists/${id}/items/order`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ items: list.items.map((item, index) => ({ id: item.id, position: index + 1 })) }),
        });
        if (!res.ok) throw new Error('Erro ao guardar a ordem dos itens');
        updatedList = await res.json();
      }

      setList(updatedList);
      hydrateForm(updatedList);
      setOriginalOrder(updatedList.items.map((i: any) => i.id).join(','));
      showToast('Lista guardada com sucesso.', 'success');
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Não foi possível guardar a lista.', 'error');
    } finally {
      setSaving(false);
    }
  };



  const moveItem = (index: number, delta: -1 | 1) => {
    if (!list) return;
    const target = index + delta;
    if (target < 0 || target >= list.items.length) return;
    const next = [...list.items];
    [next[index], next[target]] = [next[target], next[index]];
    setList(prev => prev ? { ...prev, items: next } : null);
  };

  const moveItemToPosition = (fromIndex: number, toIndex: number) => {
    if (!list || fromIndex === toIndex) return;
    const next = [...list.items];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setList(prev => prev ? { ...prev, items: next } : null);
  };

  const handleAddItemToList = async (mediaId: number, mediaType: 'ANIME' | 'MANGA') => {
    if (!id || !list || addingItemId) return;
    
    // Require saving order first
    const orderChanged = list.items.map(i => i.id).join(',') !== originalOrder;
    if (orderChanged) {
      showToast('Por favor, guarda as alterações da ordem antes de adicionar novos itens.', 'warning');
      return;
    }

    setAddingItemId(mediaId);
    try {
      const res = await customFetch(`${API_BASE_URL}/lists/${id}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ anilistMediaId: mediaId, mediaType }),
      });
      if (!res.ok) throw new Error('Erro ao adicionar item');
      
      const updatedList = await res.json();
      setList(updatedList);
      setOriginalOrder(updatedList.items.map((i: any) => i.id).join(','));
      showToast('Item adicionado à lista!', 'success');
      setSearchQuery('');
    } catch (error) {
      console.error(error);
      showToast('Não foi possível adicionar o item à lista.', 'error');
    } finally {
      setAddingItemId(null);
    }
  };

  const removeItem = async (item: ListItem) => {
    if (!id || !list) return;

    // Require saving order first
    const orderChanged = list.items.map(i => i.id).join(',') !== originalOrder;
    if (orderChanged) {
      showToast('Por favor, guarda as alterações da ordem antes de remover itens.', 'warning');
      return;
    }

    try {
      const res = await customFetch(`${API_BASE_URL}/lists/${id}/items/${item.mediaType}/${item.anilistMediaId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Erro ao remover item');
      const updatedList = await res.json();
      setList(updatedList);
      setOriginalOrder(updatedList.items.map((i: any) => i.id).join(','));
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

  // Local filter for library items suggestions
  const filteredLibraryItems = useMemo(() => {
    if (!searchQuery.trim() || !list) return [];
    const query = searchQuery.toLowerCase();
    
    return libraryItems.filter(item => {
      // 1. Title match
      if (!item.titulo?.toLowerCase().includes(query)) return false;
      
      // 2. Already in this list
      const alreadyInList = list.items.some(listItem => 
        listItem.anilistMediaId === item.id && listItem.mediaType === item.mediaType
      );
      return !alreadyInList;
    });
  }, [searchQuery, libraryItems, list]);

  if (loading || !list) {
    return <div className="py-32 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-6 md:py-10 space-y-8">
      <button onClick={handleBackClick} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-on-surface-variant hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Listas
      </button>

      <section className="relative min-h-[280px] rounded-2xl overflow-hidden border border-white/10 bg-surface-container">
        {form.coverUrl ? (
          <img 
            src={form.coverUrl} 
            alt={list.name} 
            className="absolute inset-0 w-full h-full object-cover transition-[object-position] duration-150" 
            style={{ objectPosition: `center ${form.coverPosition}%` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-secondary/30 to-emerald-500/30" />
        )}
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
        {/* Sidebar form */}
        <div className="bg-surface-container border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg">
          <h3 className="text-white font-black">Editar lista</h3>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary resize-none" />
          
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
                placeholder="URL da capa ou importa ficheiro" 
                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" 
              />
              <button
                type="button"
                onClick={() => document.getElementById('cover-upload-file')?.click()}
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
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-on-surface-variant">
                <span>Posição Vertical da Capa</span>
                <span className="text-primary-light font-mono">{form.coverPosition}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={form.coverPosition}
                onChange={(e) => setForm(prev => ({ ...prev, coverPosition: Number(e.target.value) }))}
                className="w-full accent-primary bg-black/40 h-2 rounded-lg cursor-pointer animate-none"
              />
              <p className="text-[10px] text-gray-500">Arrasta para ajustar a posição vertical da capa.</p>
            </div>
          )}

          <button 
            type="button"
            onClick={() => setForm(prev => ({ ...prev, isPublic: !prev.isPublic }))} 
            className={`w-full py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
              form.isPublic 
                ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(139,92,246,0.1)]' 
                : 'bg-white/5 border-white/10 text-on-surface-variant'
            }`}
          >
            {form.isPublic ? 'Lista Pública' : 'Lista Privada'}
          </button>

          <button 
            onClick={saveList} 
            disabled={saving || !hasUnsavedChanges} 
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black active:scale-95 transition-all shadow-md ${
              hasUnsavedChanges 
                ? 'bg-primary text-on-primary hover:bg-primary/95 ring-2 ring-primary/40' 
                : 'bg-white/5 border border-white/10 text-on-surface-variant cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {hasUnsavedChanges ? 'Guardar Alterações' : 'Guardado'}
          </button>
          
          <button onClick={deleteList} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-error/15 border border-error/30 text-error font-bold active:scale-95 transition-all">
            <Trash2 className="w-4 h-4" />
            Eliminar lista
          </button>
        </div>

        {/* Content list & search */}
        <div className="space-y-6">
          {/* Adicionar Títulos Section */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 bg-surface-container shadow-md">
            <h4 className="text-white font-black text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">add_circle</span>
              Adicionar Títulos da Biblioteca
            </h4>
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por título na tua biblioteca..." 
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-primary"
              />
              <Search className="absolute left-3 top-2.5 text-on-surface-variant w-4 h-4" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-on-surface-variant hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Suggestions list */}
            {searchQuery && (
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar bg-black/10 p-2.5 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                {filteredLibraryItems.length === 0 ? (
                  <p className="text-[11px] text-on-surface-variant text-center py-4">Nenhum título disponível encontrado.</p>
                ) : (
                  filteredLibraryItems.slice(0, 10).map(item => (
                    <div key={`${item.mediaType}-${item.id}`} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.capaUrl ? (
                          <img src={item.capaUrl} alt={item.titulo} className="w-8 aspect-[3/4] object-cover rounded-md flex-shrink-0" />
                        ) : (
                          <div className="w-8 aspect-[3/4] bg-white/5 rounded-md flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-white font-bold text-xs truncate">{item.titulo}</p>
                          <p className="text-[9px] text-on-surface-variant mt-0.5">{item.mediaType}</p>
                        </div>
                      </div>
                      <button
                        disabled={addingItemId === item.id}
                        onClick={() => handleAddItemToList(item.id, item.mediaType)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-black text-[10px] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
                      >
                        {addingItemId === item.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <span>Adicionar</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* List items block */}
          <div className="space-y-3">
            {list.items.length === 0 ? (
              <div className="py-20 text-center rounded-2xl border border-white/10 bg-white/5 text-on-surface-variant">Esta lista ainda não tem itens.</div>
            ) : list.items.map((item, index) => {
              const media = item.mediaType === 'ANIME' ? item.anime : item.manga;
              const mediaTypePath = item.mediaType.toLowerCase();
              const isBeingDragged = draggedIndex === index;

              return (
                <div 
                  key={item.id} 
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index));
                    setDraggedIndex(index);
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    if (fromIndex !== index) {
                      moveItemToPosition(fromIndex, index);
                    }
                  }}
                  className={`grid grid-cols-[auto_56px_1fr_auto] sm:grid-cols-[auto_72px_1fr_auto] gap-3 sm:gap-4 items-center bg-surface-container border border-white/10 rounded-2xl p-3 transition-all ${
                    isBeingDragged ? 'opacity-40 border-dashed border-primary/50 scale-[0.98]' : 'hover:border-white/20'
                  }`}
                >
                  {/* Drag Handle Icon */}
                  <div className="text-on-surface-variant/40 hover:text-white cursor-grab active:cursor-grabbing p-1 select-none flex items-center justify-center">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <Link to={`/details/${mediaTypePath}/${item.anilistMediaId}`} onClick={(e) => handleLinkClick(e, `/details/${mediaTypePath}/${item.anilistMediaId}`)} className="aspect-[3/4] rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                    {media?.capaUrl ? <img src={media.capaUrl} alt={media?.titulo} className="w-full h-full object-cover" /> : null}
                  </Link>

                  <div className="min-w-0">
                    <p className="text-primary text-xs font-black">#{index + 1} · {item.mediaType}</p>
                    <Link to={`/details/${mediaTypePath}/${item.anilistMediaId}`} onClick={(e) => handleLinkClick(e, `/details/${mediaTypePath}/${item.anilistMediaId}`)} className="text-white font-black text-base sm:text-lg truncate block hover:text-primary transition-colors">{media?.titulo || `Media ${item.anilistMediaId}`}</Link>
                    <p className="text-on-surface-variant text-xs line-clamp-2 mt-0.5">{media?.descricao || 'Sem descrição.'}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-30 flex items-center justify-center active:scale-95 transition-transform">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveItem(index, 1)} disabled={index === list.items.length - 1} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white disabled:opacity-30 flex items-center justify-center active:scale-95 transition-transform">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeItem(item)} className="w-9 h-9 rounded-xl bg-error/10 border border-error/20 text-error flex items-center justify-center active:scale-95 transition-transform">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ListDetailsPage;
