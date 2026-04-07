import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Pencil, X, Save, Plus, Search, MessageCircle, MapPin, User, FileText } from 'lucide-react';

interface Cliente {
  row_number?: number;
  nombre: string;
  whatsapp: number | string;
  direccion: string;
  domicilio: number | string;
  notas: string;
}

const CLIENTES_API = 'https://n8n.alliasoft.com/webhook/luis-res/clientes';
const currencyCO = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** Normaliza el whatsapp a 57XXXXXXXXXX */
const normalizeWhatsApp = (raw: string): string => {
  const digits = (raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('57') && digits.length >= 12) return digits;
  const no00 = digits.replace(/^00/, '');
  if (no00.startsWith('57') && no00.length >= 12) return no00;
  if (/^3\d{9}$/.test(no00)) return `57${no00}`;
  const noZeros = no00.replace(/^0+/, '');
  if (noZeros.startsWith('57') && noZeros.length >= 12) return noZeros;
  return `57${noZeros}`;
};

const AdminClientes: React.FC = () => {
  const [items, setItems] = useState<Cliente[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edición
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editDomicilio, setEditDomicilio] = useState<number>(0);
  const [editNotas, setEditNotas] = useState('');

  // Creación (Variables separadas para claridad, aunque podríamos reutilizar las de edición)
  const [newWhatsapp, setNewWhatsapp] = useState('');

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(CLIENTES_API, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data as Cliente[]);
    } catch (e) {
      console.error(e);
      alert('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const t = setInterval(fetchItems, 20000);
    return () => clearInterval(t);
  }, [fetchItems]);

  // Filtrado
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => {
      const n = String(i.nombre || '').toLowerCase();
      const w = String(i.whatsapp ?? '');
      const d = String(i.direccion || '').toLowerCase();
      return n.includes(q) || w.includes(q) || d.includes(q);
    });
  }, [items, query]);

  // --- ACCIONES ---
  const startNew = () => {
    setEditingId('new');
    setNewWhatsapp('');
    setEditNombre('');
    setEditDireccion('');
    setEditDomicilio(0);
    setEditNotas('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEdit = (c: Cliente) => {
    const key = normalizeWhatsApp(String(c.whatsapp ?? ''));
    setEditingId(key);
    setEditNombre(c.nombre || '');
    setEditDireccion(c.direccion || '');
    setEditDomicilio(Number(c.domicilio) || 0);
    setEditNotas(c.notas || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaving(false);
  };

  const saveClient = async (isNew: boolean, key: string) => {
    if (saving) return;
    
    // Validaciones básicas
    if (isNew) {
        const wpp = normalizeWhatsApp(newWhatsapp);
        if (!wpp || wpp.length < 12) {
            alert('WhatsApp inválido (mínimo 10 dígitos)');
            return;
        }
        if (items.some(i => normalizeWhatsApp(String(i.whatsapp)) === wpp)) {
            alert('Este cliente ya existe');
            return;
        }
        key = wpp; // Asignar la clave normalizada
    }

    try {
      setSaving(true);
      const payload = {
        whatsapp: Number(key),
        nombre: (editNombre || '').trim(),
        direccion: (editDireccion || '').trim(),
        domicilio: Number.isFinite(editDomicilio) ? Number(editDomicilio) : 0,
        notas: (editNotas || '').trim(),
      };

      const res = await fetch(CLIENTES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      
      cancelEdit();
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar el cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 pb-20">
      {/* === HEADER & TOOLS === */}
      <div className="sticky top-14 md:top-14 z-20 bg-white/90 backdrop-blur border-b border-gray-100 -mx-4 px-4 py-4 mb-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Clientes</h2>
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">{items.length}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 md:flex-none min-w-[240px] group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
              <input
                id="search-clientes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nombre o teléfono..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white shadow-sm pl-10 pr-10 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none transition-all"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setTimeout(() => document.getElementById('search-clientes')?.focus(), 0);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-none outline-none p-1 rounded-full hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              onClick={fetchItems}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 p-2 rounded-lg shadow-sm transition-colors"
              title="Actualizar"
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={startNew}
              className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus size={18} />
              Nuevo Cliente
            </button>
          </div>
        </div>
      </div>

      {/* === MODAL CREACIÓN/EDICIÓN === */}
      {(editingId !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
               <h3 className="font-black text-gray-900 flex items-center gap-2">
                 {editingId === 'new'
                   ? <Plus size={18} className="text-amber-500"/>
                   : <Pencil size={18} className="text-amber-500"/>}
                 {editingId === 'new' ? 'Nuevo Cliente' : 'Editar Cliente'}
               </h3>
               <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                 <X size={18}/>
               </button>
            </div>

            <div className="p-6 space-y-4">
              {editingId === 'new' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">WhatsApp (Obligatorio)</label>
                  <input
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value)}
                    placeholder="310 123 4567"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none font-mono bg-gray-50 focus:bg-white transition-all"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Se guardará como: <span className="font-bold text-gray-600">{normalizeWhatsApp(newWhatsapp) || '—'}</span></p>
                </div>
              )}

              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nombre</label>
                 <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/30 transition-all">
                   <User size={15} className="text-gray-400"/>
                   <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="w-full outline-none bg-transparent text-sm font-medium text-gray-800 placeholder:text-gray-400" placeholder="Nombre completo"/>
                 </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Dirección</label>
                 <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/30 transition-all">
                   <MapPin size={15} className="text-gray-400"/>
                   <input value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} className="w-full outline-none bg-transparent text-sm font-medium text-gray-800 placeholder:text-gray-400" placeholder="Calle 123 #45-67"/>
                 </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Costo Domicilio</label>
                <input
                  type="number"
                  value={editDomicilio}
                  onChange={(e) => setEditDomicilio(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 outline-none text-sm font-medium transition-all"
                />
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notas / Observaciones</label>
                 <textarea
                   value={editNotas}
                   onChange={(e) => setEditNotas(e.target.value)}
                   className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 outline-none resize-none text-sm font-medium transition-all"
                   rows={2}
                   placeholder="Detalles adicionales..."
                 />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={cancelEdit} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors">Cancelar</button>
              <button
                onClick={() => saveClient(editingId === 'new', editingId === 'new' ? '' : editingId)}
                disabled={saving}
                className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
              >
                {saving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === GRID DE TARJETAS === */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && items.length === 0 && (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-36 animate-pulse flex flex-col gap-3">
               <div className="h-4 bg-gray-200 rounded w-2/5"></div>
               <div className="h-3 bg-gray-200 rounded w-3/5"></div>
               <div className="h-3 bg-gray-200 rounded w-1/2"></div>
               <div className="h-8 bg-gray-200 rounded w-full mt-auto"></div>
            </div>
          ))
        )}

        {filtered.map((c, index) => {
          const key = normalizeWhatsApp(String(c.whatsapp ?? ''));
          const idKey = key || `idx-${index}`;

          return (
            <div key={idKey} className="group bg-white rounded-xl border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all duration-200 p-4 flex flex-col relative">
              {/* Barra superior de acento */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-400 rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex justify-between items-start mb-3">
                 <h3 className="font-black text-gray-900 truncate pr-8 text-base" title={c.nombre}>
                   {c.nombre || 'Sin Nombre'}
                 </h3>
                 <button
                   onClick={() => startEdit(c)}
                   className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                 >
                   <Pencil size={15}/>
                 </button>
              </div>

              <div className="space-y-2 mb-4 flex-1">
                 {key ? (
                   <a href={`https://wa.me/${key}`} target="_blank" rel="noreferrer"
                     className="flex items-center gap-2 text-sm text-green-700 font-semibold hover:underline w-fit bg-green-50 px-2.5 py-1 rounded-lg"
                   >
                     <MessageCircle size={13}/> +{key}
                   </a>
                 ) : <span className="text-xs text-gray-400 italic">Sin WhatsApp</span>}

                 <p className="text-sm text-gray-600 flex items-start gap-2">
                   <MapPin size={13} className="mt-0.5 shrink-0 text-gray-400"/>
                   <span className="line-clamp-2">{c.direccion || 'Sin dirección'}</span>
                 </p>

                 {c.notas && (
                   <p className="text-xs text-gray-500 flex items-start gap-2 bg-gray-50 px-2.5 py-2 rounded-lg mt-1">
                     <FileText size={11} className="mt-0.5 shrink-0 text-gray-400"/>
                     <span className="line-clamp-2">{c.notas}</span>
                   </p>
                 )}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
                 <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                    Domicilio
                 </div>
                 <span className="text-sm font-black text-gray-800">
                   {c.domicilio ? currencyCO.format(Number(c.domicilio)) : '$0'}
                 </span>
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <User size={40} className="mx-auto mb-3 opacity-20"/>
            <p className="font-medium">No se encontraron clientes</p>
            <button onClick={startNew} className="mt-3 text-amber-600 hover:underline font-bold text-sm">+ Crear nuevo cliente</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminClientes;