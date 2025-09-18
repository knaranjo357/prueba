import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  const [loading, setLoading] = useState(false);

  // Ediciones
  const [editingId, setEditingId] = useState<string | 'new' | null>(null); // usamos "barrio" como key
  const [editPrecio, setEditPrecio] = useState<number>(0);
  const [newBarrio, setNewBarrio] = useState('');
  const [newPrecio, setNewPrecio] = useState<number>(0);

  const fetchItems = useCallback(async () => {
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
  };

  const startEdit = (d: Domicilio) => {
    setEditingId(d.barrio);        // El barrio funciona como key
    setEditPrecio(Number(d.precio) || 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrecio(0);
    setNewBarrio('');
    setNewPrecio(0);
  };

  const saveExisting = async (barrioKey: string) => {
    try {
      const payload = {
        barrio: barrioKey,               // clave (no editable)
        precio: Number(editPrecio) || 0, // nuevo precio
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
    }
  };

  const saveNew = async () => {
    try {
      const b = newBarrio.trim();
      if (!b) {
        alert('El barrio es obligatorio.');
        return;
      }
      // Evitar duplicados por nombre (client-side)
      const exists = items.some(i => i.barrio.trim().toLowerCase() === b.toLowerCase());
      if (exists) {
        alert('Ese barrio ya existe. Edita su precio directamente.');
        return;
      }
      const payload = {
        barrio: b,
        precio: Number(newPrecio) || 0,
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
    }
  };

  // Manejo de teclado para Enter/Esc al editar
  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, barrioKey?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingId === 'new') saveNew();
      else if (barrioKey) saveExisting(barrioKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div className="min-w-0">
      {/* Barra superior sticky (siempre visible) */}
      <div className="sticky top-24 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900">Zonas de Domicilio</h2>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none min-w-[220px]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar barrio…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm pl-9"
                />
                <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-gray-500" />
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

      {/* Tabla responsive 2 columnas */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-[calc(6rem+1px)] md:top-[calc(6rem+1px)] z-10">
              <tr>
                <th className="text-left px-3 py-3 font-semibold text-gray-700 w-[60%]">Barrio</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700 w-[40%]">Precio</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {/* Fila de creación */}
              {editingId === 'new' && (
                <tr className="bg-amber-50/50">
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <input
                        value={newBarrio}
                        onChange={(e) => setNewBarrio(e.target.value)}
                        onKeyDown={(e) => onEditKeyDown(e)}
                        placeholder="Nombre del barrio"
                        className="w-full md:w-80 max-w-full px-3 py-2 border border-amber-300 rounded-md"
                      />
                      <button
                        onClick={saveNew}
                        className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1"
                        title="Guardar nuevo"
                      >
                        <Save size={16} /> <span className="hidden sm:inline">Guardar</span>
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="shrink-0 border border-gray-300 rounded-lg px-3 py-2 bg-white flex items-center gap-1"
                        title="Cancelar"
                      >
                        <X size={16} /> <span className="hidden sm:inline">Cancelar</span>
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="number"
                      value={newPrecio}
                      onChange={(e) => setNewPrecio(parseInt(e.target.value || '0', 10))}
                      onKeyDown={(e) => onEditKeyDown(e)}
                      className="w-40 max-w-full px-3 py-2 border border-amber-300 rounded-md"
                      placeholder="0"
                    />
                  </td>
                </tr>
              )}

              {/* Cargando */}
              {loading && (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-gray-500">Cargando…</td>
                </tr>
              )}

              {/* Filas de datos */}
              {filtered.map((d) => {
                const isEditing = editingId === d.barrio;
                return (
                  <tr key={d.barrio}>
                    {/* Barrio: solo lectura (key) */}
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900 break-words">{d.barrio}</span>
                        {!isEditing ? (
                          <button
                            onClick={() => startEdit(d)}
                            className="shrink-0 border border-gray-300 rounded-lg px-3 py-2 bg-white flex items-center gap-1"
                            title="Editar precio"
                          >
                            <Pencil size={16} /> <span className="hidden sm:inline">Editar</span>
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveExisting(d.barrio)}
                              className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1"
                              title="Guardar"
                            >
                              <Save size={16} /> <span className="hidden sm:inline">Guardar</span>
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="shrink-0 border border-gray-300 rounded-lg px-3 py-2 bg-white flex items-center gap-1"
                              title="Cancelar"
                            >
                              <X size={16} /> <span className="hidden sm:inline">Cancelar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Precio: editable solo cuando está en modo edición */}
                    <td className="px-3 py-3 align-middle">
                      {!isEditing ? (
                        <span className="tabular-nums font-medium">
                          ${Number(d.precio || 0).toLocaleString('es-CO')}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={editPrecio}
                          onChange={(e) => setEditPrecio(parseInt(e.target.value || '0', 10))}
                          onKeyDown={(e) => onEditKeyDown(e, d.barrio)}
                          className="w-40 max-w-full px-3 py-2 border border-gray-300 rounded-md"
                          autoFocus
                        />
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Sin resultados */}
              {!loading && filtered.length === 0 && editingId !== 'new' && (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-gray-500">
                    No hay barrios que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Consejo: toca <span className="font-medium">Editar</span>, cambia el precio y presiona <kbd className="px-1 border rounded">Enter</kbd> para guardar o <kbd className="px-1 border rounded">Esc</kbd> para cancelar.
        </p>
      </div>
    </div>
  );
};

export default AdminDomicilios;
