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
      const n = (i.nombre || '').toLowerCase();
      const w = String(i.whatsapp ?? '');
      const d = (i.direccion || '').toLowerCase();
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
      <div className="sticky top-24 z-20 bg-white/90 backdrop-blur border-b border-gray-100 -mx-4 px-4 py-4 mb-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Directorio Clientes</h2>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">{items.length}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 md:flex-none min-w-[240px] group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nombre o teléfono..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white shadow-sm pl-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-md shadow-blue-600/20 flex items-center gap-2 transition-transform active:scale-95"
            >
              <Plus size={18} />
              Nuevo Cliente
            </button>
          </div>
        </div>
      </div>

      {/* === FORMULARIO DE CREACIÓN/EDICIÓN (Expandible) === */}
      {(editingId !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 {editingId === 'new' ? <Plus size={18} className="text-blue-600"/> : <Pencil size={18} className="text-amber-600"/>}
                 {editingId === 'new' ? 'Agregar Nuevo Cliente' : 'Editar Cliente'}
               </h3>
               <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4">
              {editingId === 'new' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">WhatsApp (Obligatorio)</label>
                  <input
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value)}
                    placeholder="310 123 4567"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">Se guardará como: {normalizeWhatsApp(newWhatsapp) || '...'}</p>
                </div>
              )}
              
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                 <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                   <User size={16} className="text-gray-400"/>
                   <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="w-full outline-none" placeholder="Nombre completo"/>
                 </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dirección</label>
                 <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                   <MapPin size={16} className="text-gray-400"/>
                   <input value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} className="w-full outline-none" placeholder="Calle 123 #45-67"/>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Costo Domicilio</label>
                   <input type="number" value={editDomicilio} onChange={(e) => setEditDomicilio(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"/>
                </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notas / Observaciones</label>
                 <textarea value={editNotas} onChange={(e) => setEditNotas(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 resize-none" rows={2} placeholder="Detalles adicionales..."/>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={cancelEdit} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Cancelar</button>
              <button 
                onClick={() => saveClient(editingId === 'new', editingId === 'new' ? '' : editingId)}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={18}/>}
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
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-32 animate-pulse flex flex-col gap-2">
               <div className="h-4 bg-gray-200 rounded w-1/3"></div>
               <div className="h-3 bg-gray-200 rounded w-2/3"></div>
               <div className="h-8 bg-gray-200 rounded w-full mt-auto"></div>
            </div>
          ))
        )}

        {filtered.map((c, index) => {
          const key = normalizeWhatsApp(String(c.whatsapp ?? ''));
          const idKey = key || `idx-${index}`;

          return (
            <div key={idKey} className="group bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all p-4 flex flex-col relative">
              <div className="flex justify-between items-start mb-2">
                 <h3 className="font-bold text-gray-900 truncate pr-8" title={c.nombre}>{c.nombre || 'Sin Nombre'}</h3>
                 <button 
                   onClick={() => startEdit(c)}
                   className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                 >
                   <Pencil size={16}/>
                 </button>
              </div>

              <div className="space-y-1.5 mb-4 flex-1">
                 {key ? (
                   <a href={`https://wa.me/${key}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-green-600 font-medium hover:underline w-fit">
                     <MessageCircle size={14}/> +{key}
                   </a>
                 ) : <span className="text-xs text-gray-400 italic">Sin WhatsApp</span>}
                 
                 <p className="text-sm text-gray-600 flex items-start gap-2">
                   <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400"/>
                   <span className="line-clamp-2">{c.direccion || 'Sin dirección'}</span>
                 </p>
                 
                 {c.notas && (
                   <p className="text-xs text-gray-500 flex items-start gap-2 bg-gray-50 p-1.5 rounded mt-2">
                     <FileText size={12} className="mt-0.5 shrink-0"/>
                     <span className="line-clamp-2">{c.notas}</span>
                   </p>
                 )}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
                 <div className="text-xs text-gray-400 font-medium uppercase">
                    Domicilio: <span className="text-gray-700 font-bold ml-1">{c.domicilio ? currencyCO.format(Number(c.domicilio)) : '$0'}</span>
                 </div>
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <User size={48} className="mx-auto mb-2 opacity-20"/>
            <p>No se encontraron clientes</p>
            <button onClick={startNew} className="mt-2 text-blue-500 hover:underline font-medium">Crear nuevo cliente</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminClientes;