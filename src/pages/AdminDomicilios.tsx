import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Pencil, X, Save, Plus, Search, MapPin, DollarSign } from 'lucide-react';

interface Domicilio {
  row_number?: number;
  barrio: string;
  precio: number;
}

const DOMICILIOS_API = 'https://n8n.alliasoft.com/webhook/luis-res/domicilios';
const currencyCO = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const AdminDomicilios: React.FC = () => {
  const [items, setItems] = useState<Domicilio[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editPrecio, setEditPrecio] = useState<number>(0);
  const [newBarrio, setNewBarrio] = useState('');
  const [newPrecio, setNewPrecio] = useState<number>(0);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(DOMICILIOS_API, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data as Domicilio[]);
    } catch (e) {
      console.error(e);
      alert('No se pudieron cargar los domicilios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const t = setInterval(fetchItems, 20000);
    return () => clearInterval(t);
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => (i.barrio || '').toLowerCase().includes(q));
  }, [items, query]);

  const startNew = () => {
    setEditingId('new');
    setNewBarrio('');
    setNewPrecio(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEdit = (d: Domicilio) => {
    setEditingId(d.barrio);
    setEditPrecio(Number(d.precio) || 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrecio(0);
    setNewBarrio('');
    setNewPrecio(0);
    setSaving(false);
  };

  const saveExisting = async (barrioKey: string) => {
    if (saving) return;
    try {
      setSaving(true);
      const payload = {
        barrio: barrioKey,
        precio: Number.isFinite(editPrecio) ? editPrecio : 0,
      };

      const res = await fetch(DOMICILIOS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cancelEdit();
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar el precio.');
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const b = newBarrio.trim();

      if (!b) {
        alert('El barrio es obligatorio.');
        return;
      }

      const exists = items.some(i => (i.barrio || '').trim().toLowerCase() === b.toLowerCase());
      if (exists) {
        alert('Ese barrio ya existe. Edita su precio directamente.');
        return;
      }

      const payload = {
        barrio: b,
        precio: Number.isFinite(newPrecio) ? newPrecio : 0,
      };

      const res = await fetch(DOMICILIOS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cancelEdit();
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo crear el barrio.');
    } finally {
      setSaving(false);
    }
  };

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, barrioKey?: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingId === 'new') saveNew();
      else if (barrioKey) saveExisting(barrioKey);
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
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Zonas de Domicilio</h2>
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar barrio..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white shadow-sm pl-9 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none transition-all text-sm"
                autoComplete="off"
              />
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
              Nueva Zona
            </button>
          </div>
        </div>
      </div>

      {editingId === 'new' && (
        <div className="max-w-2xl mx-auto mb-5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white border-2 border-amber-400 rounded-lg p-4 shadow-lg relative">
            <div className="absolute -top-3 left-4 bg-amber-400 text-white px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1">
              <Plus size={11} /> Agregando Nueva Zona
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Nombre del Barrio
                </label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all">
                  <MapPin size={16} className="text-gray-400" />
                  <input
                    value={newBarrio}
                    onChange={(e) => setNewBarrio(e.target.value)}
                    onKeyDown={onEditKeyDown}
                    placeholder="Ej: Cañaveral"
                    className="bg-transparent w-full outline-none text-sm font-medium"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Precio Domicilio
                </label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all">
                  <DollarSign size={16} className="text-gray-400" />
                  <input
                    type="number"
                    min={0}
                    value={Number.isFinite(newPrecio) ? newPrecio : 0}
                    onChange={(e) => setNewPrecio(parseInt(e.target.value || '0', 10))}
                    onKeyDown={onEditKeyDown}
                    className="bg-transparent w-full outline-none text-sm font-medium"
                    placeholder="0"
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
                Guardar Zona
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
          const isEditing = editingId === d.barrio;

          if (isEditing) {
            return (
              <div
                key={d.barrio}
                className="bg-white rounded-lg border-2 border-amber-400 shadow-md p-3 relative animate-in zoom-in-95 duration-200"
              >
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm truncate">
                    <MapPin size={15} className="text-amber-500" />
                    {d.barrio}
                  </h3>
                </div>

                <div className="mb-3">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Nuevo Precio
                  </label>
                  <div className="flex items-center gap-1 border-b-2 border-amber-400 pb-1">
                    <span className="text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      autoFocus
                      value={Number.isFinite(editPrecio) ? editPrecio : 0}
                      onChange={(e) => setEditPrecio(parseInt(e.target.value || '0', 10))}
                      onKeyDown={(e) => onEditKeyDown(e, d.barrio)}
                      className="w-full outline-none text-lg font-bold text-gray-900 bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => saveExisting(d.barrio)}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={d.barrio}
              className="group bg-white rounded-lg border border-gray-200 hover:border-amber-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[90px]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3
                  className="font-bold text-gray-700 leading-tight text-sm line-clamp-2"
                  title={d.barrio}
                >
                  {d.barrio}
                </h3>

                <button
                  onClick={() => startEdit(d)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-amber-600 hover:bg-gray-50 rounded-full transition-all shrink-0"
                  title="Editar Precio"
                >
                  <Pencil size={14} />
                </button>
              </div>

              <div className="pt-2 mt-2 border-t border-gray-50 flex justify-end">
                <span className="text-lg font-black text-gray-900 tracking-tight truncate">
                  {currencyCO.format(Number(d.precio || 0))}
                </span>
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && editingId !== 'new' && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <MapPin size={40} className="mb-2 opacity-20" />
            <p className="text-sm">No se encontraron zonas</p>
            <button
              onClick={startNew}
              className="mt-2 text-amber-500 font-bold hover:underline text-sm"
            >
              Agregar una nueva
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDomicilios;