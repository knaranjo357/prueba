import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Pencil, X, Save, Plus, Search } from 'lucide-react';

interface Domicilio {
  row_number?: number;
  barrio: string;
  precio: number;
}

const DOMICILIOS_API = 'https://n8n.alliasoft.com/webhook/luis-res/domicilios';

const AdminDomicilios: React.FC = () => {
  const [items, setItems] = useState<Domicilio[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [barrio, setBarrio] = useState('');
  const [precio, setPrecio] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(DOMICILIOS_API);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data as Domicilio[]);
    } catch (e) {
      console.error(e);
      alert('No se pudieron cargar los domicilios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    const t = setInterval(fetchItems, 20000);
    return () => clearInterval(t);
  }, []);

  const startNew = () => {
    setEditingId('new');
    setBarrio('');
    setPrecio(0);
  };

  const startEdit = (d: Domicilio) => {
    setEditingId(d.row_number ?? null);
    setBarrio(d.barrio || '');
    setPrecio(Number(d.precio) || 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setBarrio('');
    setPrecio(0);
  };

  const save = async () => {
    try {
      if (!barrio.trim()) {
        alert('El barrio es obligatorio.');
        return;
      }
      const payload = {
        barrio: barrio.trim(),
        precio: Number(precio) || 0,
      };
      const res = await fetch(DOMICILIOS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // {{ $json.body.barrio }} / {{ $json.body.precio }}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cancelEdit();
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar el domicilio.');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => (i.barrio || '').toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="min-w-0">
      {/* Barra de acciones */}
      <div className="sticky top-24 z-20 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-900">Zonas de Domicilio</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar barrio..."
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm pl-9"
                />
                <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
              </div>
              <button
                onClick={fetchItems}
                className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm"
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
              <button
                onClick={startNew}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm flex items-center gap-2"
              >
                <Plus size={16} />
                Nuevo barrio
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form nuevo/edición (en línea, estilo OrdersTab) */}
      {editingId === 'new' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <h3 className="font-bold text-gray-900 mb-3">Crear barrio</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Barrio</label>
              <input
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nombre del barrio"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Precio</label>
              <input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm">
              <Save size={16} /> Guardar
            </button>
            <button onClick={cancelEdit} className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm flex items-center gap-2">
              <X size={16} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="grid gap-4">
        {loading && <div className="text-sm text-gray-500">Cargando…</div>}
        {filtered.map((d) => {
          const isEditing = editingId === d.row_number;
          return (
            <div key={d.row_number ?? `${d.barrio}-${d.precio}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900">Barrio</h3>
                  <p className="text-sm text-gray-600">#{d.row_number ?? '-'}</p>
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => startEdit(d)}
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm flex items-center gap-2"
                  >
                    <Pencil size={16} /> Editar
                  </button>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={save} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm">
                      <Save size={16} /> Guardar
                    </button>
                    <button onClick={cancelEdit} className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm flex items-center gap-2">
                      <X size={16} /> Cancelar
                    </button>
                  </div>
                )}
              </div>

              {!isEditing ? (
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Barrio</p>
                    <p className="font-medium break-words">{d.barrio}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Precio</p>
                    <p className="font-medium">${Number(d.precio || 0).toLocaleString('es-CO')}</p>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Barrio</label>
                    <input
                      value={barrio}
                      onChange={(e) => setBarrio(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Precio</label>
                    <input
                      type="number"
                      value={precio}
                      onChange={(e) => setPrecio(parseInt(e.target.value || '0', 10))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDomicilios;
