import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Pencil, X, Save, Plus, Search, MapPin, DollarSign } from 'lucide-react';

interface Domicilio {
  row_number?: number;
  barrio: string;
  precio: number;
}

const DOMICILIOS_API = 'https://n8n.alliasoft.com/webhook/luis-res/domicilios';
const currencyCO = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const AdminDomicilios: React.FC = () => {
  const [items, setItems] = useState<Domicilio[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ediciones
  const [editingId, setEditingId] = useState<string | 'new' | null>(null); // key = barrio
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

  // Buscar
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => (i.barrio || '').toLowerCase().includes(q));
  }, [items, query]);

  // Acciones
  const startNew = () => {
    setEditingId('new');
    setNewBarrio('');
    setNewPrecio(0);
    // Scroll to top suavemente para ver el formulario
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
        barrio: barrioKey, // clave (no editable)
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
      // Evitar duplicados por nombre (client-side)
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

  // Manejo de teclado
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
    <div className="min-w-0 pb-20">
      {/* === HEADER & TOOLS === */}
      <div className="sticky top-24 z-20 bg-white/90 backdrop-blur border-b border-gray-100 -mx-4 px-4 py-4 mb-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Zonas y Tarifas</h2>
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">{items.length} Zonas</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 md:flex-none min-w-[240px] group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar barrio..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white shadow-sm pl-10 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                autoComplete="off"
              />
            </div>

            <button
              onClick={fetchItems}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 p-2 rounded-lg shadow-sm transition-colors"
              title="Actualizar"
              disabled={loading}
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={startNew}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95"
            >
              <Plus size={18} />
              Nueva Zona
            </button>
          </div>
        </div>
      </div>

      {/* === FORMULARIO DE CREACIÓN (Expandible) === */}
      {editingId === 'new' && (
        <div className="max-w-2xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white border-2 border-amber-400 rounded-xl p-6 shadow-xl relative">
            <div className="absolute -top-3 left-6 bg-amber-400 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <Plus size={12} /> Agregando Nueva Zona
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Barrio</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all">
                  <MapPin size={18} className="text-gray-400" />
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
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio Domicilio</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all">
                  <DollarSign size={18} className="text-gray-400" />
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
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={cancelEdit} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancelar</button>
              <button 
                onClick={saveNew} 
                disabled={saving}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {saving ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18} />} 
                Guardar Zona
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === GRID DE DOMICILIOS === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Estado de Carga */}
        {loading && items.length === 0 && (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4 mt-auto"></div>
            </div>
          ))
        )}

        {filtered.map((d) => {
          const isEditing = editingId === d.barrio;
          
          // --- MODO EDICIÓN (TARJETA) ---
          if (isEditing) {
            return (
              <div key={d.barrio} className="bg-white rounded-xl border-2 border-amber-400 shadow-lg p-4 relative animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm truncate">
                     <MapPin size={16} className="text-amber-500" />
                     {d.barrio}
                   </h3>
                </div>
                
                <div className="mb-4">
                   <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nuevo Precio</label>
                   <div className="flex items-center gap-1 border-b-2 border-amber-400 pb-1">
                      <span className="text-gray-400 font-bold">$</span>
                      <input 
                        type="number"
                        autoFocus
                        value={Number.isFinite(editPrecio) ? editPrecio : 0}
                        onChange={(e) => setEditPrecio(parseInt(e.target.value || '0', 10))}
                        onKeyDown={(e) => onEditKeyDown(e, d.barrio)}
                        className="w-full outline-none text-xl font-bold text-gray-900 bg-transparent"
                      />
                   </div>
                </div>

                <div className="flex gap-2 mt-2">
                   <button 
                     onClick={() => saveExisting(d.barrio)} 
                     disabled={saving}
                     className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-sm font-bold shadow-sm"
                   >
                     Guardar
                   </button>
                   <button 
                     onClick={cancelEdit} 
                     className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg"
                   >
                     <X size={18}/>
                   </button>
                </div>
              </div>
            );
          }

          // --- MODO LECTURA (TARJETA) ---
          return (
            <div 
              key={d.barrio} 
              className="group bg-white rounded-xl border border-gray-200 hover:border-amber-200 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[140px]"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-gray-50 text-gray-400 group-hover:text-amber-500 group-hover:bg-amber-50 rounded-lg transition-colors mb-3">
                    <MapPin size={20} />
                  </div>
                  <button 
                    onClick={() => startEdit(d)} 
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-amber-600 hover:bg-gray-50 rounded-full transition-all"
                    title="Editar Precio"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <h3 className="font-bold text-gray-700 leading-tight mb-1 line-clamp-2" title={d.barrio}>
                  {d.barrio}
                </h3>
              </div>

              <div className="pt-3 border-t border-gray-50 mt-2 flex items-baseline justify-between">
                <span className="text-xs text-gray-400 font-medium uppercase">Tarifa</span>
                <span className="text-xl font-black text-gray-900 tracking-tight">
                  {currencyCO.format(Number(d.precio || 0))}
                </span>
              </div>
            </div>
          );
        })}

        {/* Estado Vacío */}
        {!loading && filtered.length === 0 && editingId !== 'new' && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <MapPin size={48} className="mb-2 opacity-20" />
            <p>No se encontraron zonas</p>
            <button onClick={startNew} className="mt-2 text-amber-500 font-bold hover:underline">Agregar una nueva</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDomicilios;