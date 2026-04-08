import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Search, PhoneOff, Trash2, X, Plus, User, Pencil, Save, AlertCircle } from 'lucide-react';

interface Ignorado {
  row_number?: number;
  whatsapp: number | string;
  contacto: string;
}

const IGNORAR_API = 'https://n8n.alliasoft.com/webhook/luis-res/ignorar-numeros';

const AdminIgnorar: React.FC = () => {
  const [items, setItems] = useState<Ignorado[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editContacto, setEditContacto] = useState('');

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(IGNORAR_API, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data as Ignorado[]);
    } catch (e) {
      console.error(e);
      alert('No se pudieron cargar los números ignorados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => 
      String(i.whatsapp).toLowerCase().includes(q) || 
      (i.contacto || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const startNew = () => {
    setEditingId('new');
    setEditWhatsapp('');
    setEditContacto('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEdit = (d: Ignorado) => {
    if (d.row_number === undefined) return;
    setEditingId(d.row_number);
    setEditWhatsapp(String(d.whatsapp || ''));
    setEditContacto(d.contacto || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditWhatsapp('');
    setEditContacto('');
    setSaving(false);
  };

  const handleDelete = async (row_number: number | undefined) => {
    if (!row_number) return;
    if (!window.confirm('¿Estás seguro de que quieres eliminar este número de la lista de ignorados?')) return;
    
    try {
      setDeletingId(row_number);
      const res = await fetch(IGNORAR_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_number }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar el número.');
    } finally {
      setDeletingId(null);
    }
  };

  const saveNew = async () => {
    if (saving) return;
    const wpp = editWhatsapp.trim();
    if (!wpp) {
      alert('El número de WhatsApp es obligatorio.');
      return;
    }
    
    try {
      setSaving(true);
      const payload = {
        whatsapp: wpp,
        contacto: editContacto.trim()
      };

      const res = await fetch(IGNORAR_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cancelEdit();
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo agregar el número.');
    } finally {
      setSaving(false);
    }
  };

  const saveExisting = async (row_number: number) => {
    if (saving) return;
    const wpp = editWhatsapp.trim();
    if (!wpp) {
      alert('El número de WhatsApp es obligatorio.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        row_number,
        whatsapp: wpp,
        contacto: editContacto.trim()
      };

      const res = await fetch(IGNORAR_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cancelEdit();
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo actualizar el número.');
    } finally {
      setSaving(false);
    }
  };

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row_number?: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingId === 'new') saveNew();
      else if (row_number) saveExisting(row_number);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div className="min-w-0 pb-12">
      <div className="sticky top-14 md:top-14 z-20 bg-white/90 backdrop-blur border-b border-gray-100 -mx-4 px-4 py-4 mb-5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Números Ignorados</h2>
            <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
              {items.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none min-w-[220px] group">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-500 transition-colors"
              />
              <input
                id="search-ignorar"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por número o contacto..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white shadow-sm pl-9 pr-9 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none transition-all text-sm"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setTimeout(() => document.getElementById('search-ignorar')?.focus(), 0);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <button
              onClick={fetchItems}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 p-2 rounded-lg shadow-sm transition-colors"
              title="Actualizar"
              disabled={loading}
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={startNew}
              className="bg-gray-900 hover:bg-black text-white px-3 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all active:scale-95 text-sm"
            >
              <Plus size={16} />
              Agregar
            </button>
          </div>
        </div>
      </div>

      {editingId === 'new' && (
        <div className="max-w-2xl mx-auto mb-5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white border-2 border-amber-400 rounded-lg p-4 shadow-lg relative">
            <div className="absolute -top-3 left-4 bg-amber-400 text-white px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
              <Plus size={11} /> Agregando Nuevo Número
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 flex gap-2 items-start text-blue-800 text-xs mt-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-blue-500" />
              <p>
                <strong>Nota importante:</strong> El código del país es obligatorio para el correcto funcionamiento. 
                Ejemplo para Colombia: <strong>57</strong>310..., <strong>sin usar espacios</strong> ni el símbolo +.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  WhatsApp (con código de país)
                </label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all">
                  <PhoneOff size={16} className="text-gray-400" />
                  <input
                    type="text"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value.replace(/\s+/g, ''))}
                    onKeyDown={onEditKeyDown}
                    placeholder="Ej: 573001234567"
                    className="bg-transparent w-full outline-none text-sm font-medium font-mono"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Nombre del Contacto
                </label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all">
                  <User size={16} className="text-gray-400" />
                  <input
                    type="text"
                    value={editContacto}
                    onChange={(e) => setEditContacto(e.target.value)}
                    onKeyDown={onEditKeyDown}
                    className="bg-transparent w-full outline-none text-sm font-medium"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={cancelEdit}
                className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={saveNew}
                disabled={saving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2 disabled:opacity-50 transition-all text-sm"
              >
                {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                Guardar Número
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {loading &&
          items.length === 0 &&
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-lg border border-gray-100 p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
              <div className="h-7 bg-gray-200 rounded w-3/4 mt-auto"></div>
            </div>
          ))}

        {filtered.map((d) => {
          const isEditing = editingId === d.row_number;

          if (isEditing) {
            return (
              <div
                key={d.row_number}
                className="bg-white rounded-lg border-2 border-amber-400 shadow-md p-3 relative animate-in zoom-in-95 duration-200 col-span-1 sm:col-span-2 lg:col-span-2"
              >
                <div className="absolute -top-3 left-4 bg-amber-400 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                  Editando
                </div>
                
                <div className="bg-blue-50 border border-blue-100 rounded-md p-2 mb-3 flex gap-1.5 items-start text-blue-800 text-[11px] mt-2">
                  <AlertCircle size={14} className="shrink-0 text-blue-500" />
                  <p>Código del país obligatorio (ej: 57) sin espacios.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      WhatsApp
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value.replace(/\s+/g, ''))}
                      onKeyDown={(e) => onEditKeyDown(e, d.row_number)}
                      className="w-full border-b-2 border-amber-400 outline-none text-sm font-mono text-gray-900 bg-transparent pb-1 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Contacto
                    </label>
                    <input
                      type="text"
                      value={editContacto}
                      onChange={(e) => setEditContacto(e.target.value)}
                      onKeyDown={(e) => onEditKeyDown(e, d.row_number)}
                      className="w-full border-b-2 border-amber-400 outline-none text-sm font-medium text-gray-900 bg-transparent pb-1 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => saveExisting(d.row_number as number)}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={d.row_number}
              className="group relative bg-white rounded-lg border border-gray-200 hover:border-amber-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[90px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="truncate">
                  <h3
                    className="font-bold text-gray-700 leading-tight text-sm line-clamp-2"
                    title={d.contacto}
                  >
                    {d.contacto || 'Sin Nombre'}
                  </h3>
                  <p className="text-gray-500 text-xs mt-1 font-mono">{d.whatsapp}</p>
                </div>

                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 shrink-0 bg-white/80 pr-1 rounded-l-lg absolute right-2 top-2">
                  <button
                    onClick={() => startEdit(d)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(d.row_number)}
                    disabled={deletingId === d.row_number}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Eliminar"
                  >
                    {deletingId === d.row_number ? (
                      <RefreshCw size={14} className="animate-spin text-red-500" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && editingId !== 'new' && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <PhoneOff size={40} className="mb-2 opacity-20" />
            <p className="text-sm">No se encontraron números ignorados</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminIgnorar;
