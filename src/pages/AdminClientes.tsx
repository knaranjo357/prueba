import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Pencil, X, Save, Plus, Search, MessageSquareText } from 'lucide-react';

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

/** Normaliza el whatsapp a 57XXXXXXXXXX (sin +, espacios, guiones) */
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

  // Edición por fila (key = whatsapp normalizado)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editDomicilio, setEditDomicilio] = useState<number>(0);
  const [editNotas, setEditNotas] = useState('');

  // Creación
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newDireccion, setNewDireccion] = useState('');
  const [newDomicilio, setNewDomicilio] = useState<number>(0);
  const [newNotas, setNewNotas] = useState('');

  // Estados de guardado para bloquear botones
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(CLIENTES_API, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) setItems(data as Cliente[]);
    } catch (e) {
      console.error(e);
      alert('No se pudieron cargar los clientes.');
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
      const w = String(i.whatsapp || '');
      const d = (i.direccion || '').toLowerCase();
      return n.includes(q) || w.includes(q) || d.includes(q);
    });
  }, [items, query]);

  // Acciones
  const startNew = () => {
    setEditingId('new');
    setNewWhatsapp('');
    setNewNombre('');
    setNewDireccion('');
    setNewDomicilio(0);
    setNewNotas('');
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
    setEditNombre('');
    setEditDireccion('');
    setEditDomicilio(0);
    setEditNotas('');
    setNewWhatsapp('');
    setNewNombre('');
    setNewDireccion('');
    setNewDomicilio(0);
    setNewNotas('');
    setSaving(false);
  };

  // Guardar cambios en cliente existente (whatsapp = key, NO editable)
  const saveExisting = async (whatsappKey: string) => {
    if (saving) return;
    try {
      if (!whatsappKey) {
        alert('WhatsApp inválido.');
        return;
      }
      setSaving(true);
      const payload = {
        whatsapp: Number(whatsappKey), // clave (no se cambia)
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cancelEdit();
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  // Guardar nuevo cliente (aquí sí se ingresa whatsapp)
  const saveNew = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const wpp = normalizeWhatsApp(newWhatsapp);
      if (!wpp || wpp.length < 12) {
        alert('El WhatsApp es obligatorio y debe ser válido: 57 + 10 dígitos.');
        return;
      }
      // Evitar duplicados por whatsapp
      const exists = items.some(i => normalizeWhatsApp(String(i.whatsapp ?? '')) === wpp);
      if (exists) {
        alert('Ese WhatsApp ya existe. Edita ese cliente.');
        return;
      }
      const payload = {
        whatsapp: Number(wpp),
        nombre: (newNombre || '').trim(),
        direccion: (newDireccion || '').trim(),
        domicilio: Number.isFinite(newDomicilio) ? Number(newDomicilio) : 0,
        notas: (newNotas || '').trim(),
      };
      const res = await fetch(CLIENTES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cancelEdit();
      fetchItems();
    } catch (e) {
      console.error(e);
      alert('No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  // Enter/Esc en edición
  const onEditKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    whatsappKey?: string
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingId === 'new') saveNew();
      else if (whatsappKey) saveExisting(whatsappKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div className="min-w-0">
      {/* Barra de acciones sticky (siempre visible) */}
      <div className="sticky top-24 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900">Clientes</h2>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none min-w-[260px]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, WhatsApp o dirección…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm pl-9"
                  aria-label="Buscar clientes"
                  autoComplete="off"
                />
                <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-gray-500" />
              </div>

              <button
                onClick={fetchItems}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm disabled:opacity-60"
                disabled={loading}
                title="Actualizar lista"
              >
                <RefreshCw size={16} />
                Actualizar
              </button>

              <button
                onClick={startNew}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm flex items-center gap-2"
                title="Nuevo cliente"
              >
                <Plus size={16} />
                Nuevo cliente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla responsive */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-3 font-semibold text-gray-700">WhatsApp</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700">Nombre</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700">Dirección</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700">Domicilio</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-700">Notas</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {/* Fila creación */}
              {editingId === 'new' && (
                <tr className="bg-amber-50/50">
                  <td className="px-3 py-2 align-middle">
                    <input
                      value={newWhatsapp}
                      onChange={(e) => setNewWhatsapp(e.target.value)}
                      onKeyDown={(e) => onEditKeyDown(e)}
                      placeholder="+57 3xx xxx xxxx"
                      className="w-44 md:w-56 max-w-full px-3 py-2 border border-amber-300 rounded-md"
                      aria-label="WhatsApp nuevo"
                      autoComplete="off"
                      inputMode="numeric"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Guardado como:{' '}
                      <strong>{normalizeWhatsApp(newWhatsapp) || '—'}</strong>
                    </p>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      onKeyDown={(e) => onEditKeyDown(e)}
                      className="w-40 md:w-56 max-w-full px-3 py-2 border border-amber-300 rounded-md"
                      placeholder="Nombre"
                      aria-label="Nombre nuevo"
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      value={newDireccion}
                      onChange={(e) => setNewDireccion(e.target.value)}
                      onKeyDown={(e) => onEditKeyDown(e)}
                      className="w-56 md:w-80 max-w-full px-3 py-2 border border-amber-300 rounded-md"
                      placeholder="Dirección"
                      aria-label="Dirección nueva"
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="number"
                      min={0}
                      value={Number.isFinite(newDomicilio) ? newDomicilio : 0}
                      onChange={(e) => setNewDomicilio(parseInt(e.target.value || '0', 10))}
                      onKeyDown={(e) => onEditKeyDown(e)}
                      className="w-32 max-w-full px-3 py-2 border border-amber-300 rounded-md"
                      placeholder="0"
                      aria-label="Domicilio nuevo"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <textarea
                      value={newNotas}
                      onChange={(e) => setNewNotas(e.target.value)}
                      onKeyDown={(e) => onEditKeyDown(e)}
                      className="w-56 md:w-80 max-w-full px-3 py-2 border border-amber-300 rounded-md"
                      rows={1}
                      placeholder="Observaciones"
                      aria-label="Notas nuevas"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex gap-2">
                      <button
                        onClick={saveNew}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 disabled:opacity-60"
                        title="Guardar"
                        disabled={saving}
                      >
                        <Save size={16} /> <span className="hidden sm:inline">Guardar</span>
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="border border-gray-300 rounded-lg px-3 py-2 bg-white flex items-center gap-1"
                        title="Cancelar"
                      >
                        <X size={16} /> <span className="hidden sm:inline">Cancelar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Cargando */}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-gray-500">Cargando…</td>
                </tr>
              )}

              {/* Datos */}
              {filtered.map((c, index) => {
                const key = normalizeWhatsApp(String(c.whatsapp ?? ''));
                const idKey = key || (typeof c.row_number !== 'undefined' ? `row-${c.row_number}` : `idx-${index}`);
                const isEditing = editingId === key;

                return (
                  <tr key={idKey}>
                    {/* WhatsApp (NO editable) */}
                    <td className="px-3 py-3 align-middle">
                      {key ? (
                        <a
                          href={`https://wa.me/${encodeURIComponent(key)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
                          title="Abrir chat de WhatsApp"
                        >
                          <MessageSquareText size={14} /> {key}
                        </a>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>

                    {/* Nombre */}
                    <td className="px-3 py-3 align-middle">
                      {!isEditing ? (
                        <span className="font-medium break-words">{c.nombre || '—'}</span>
                      ) : (
                        <input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          onKeyDown={(e) => onEditKeyDown(e, key)}
                          className="w-40 md:w-56 max-w-full px-3 py-2 border border-gray-300 rounded-md"
                          autoFocus
                          aria-label="Editar nombre"
                          autoComplete="off"
                        />
                      )}
                    </td>

                    {/* Dirección */}
                    <td className="px-3 py-3 align-middle">
                      {!isEditing ? (
                        <span className="break-words">{c.direccion || '—'}</span>
                      ) : (
                        <input
                          value={editDireccion}
                          onChange={(e) => setEditDireccion(e.target.value)}
                          onKeyDown={(e) => onEditKeyDown(e, key)}
                          className="w-56 md:w-80 max-w-full px-3 py-2 border border-gray-300 rounded-md"
                          aria-label="Editar dirección"
                          autoComplete="off"
                        />
                      )}
                    </td>

                    {/* Domicilio */}
                    <td className="px-3 py-3 align-middle">
                      {!isEditing ? (
                        <span className="tabular-nums font-medium">
                          {c.domicilio !== '' && c.domicilio !== null && c.domicilio !== undefined
                            ? currencyCO.format(Number(c.domicilio || 0))
                            : '—'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={Number.isFinite(editDomicilio) ? editDomicilio : 0}
                          onChange={(e) => setEditDomicilio(parseInt(e.target.value || '0', 10))}
                          onKeyDown={(e) => onEditKeyDown(e, key)}
                          className="w-32 max-w-full px-3 py-2 border border-gray-300 rounded-md"
                          aria-label="Editar domicilio"
                        />
                      )}
                    </td>

                    {/* Notas */}
                    <td className="px-3 py-3 align-middle">
                      {!isEditing ? (
                        <span className="break-words">{c.notas || '—'}</span>
                      ) : (
                        <textarea
                          value={editNotas}
                          onChange={(e) => setEditNotas(e.target.value)}
                          onKeyDown={(e) => onEditKeyDown(e, key)}
                          className="w-56 md:w-80 max-w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={1}
                          aria-label="Editar notas"
                        />
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-3 align-middle">
                      {!isEditing ? (
                        <button
                          onClick={() => startEdit(c)}
                          className="border border-gray-300 rounded-lg px-3 py-2 bg-white flex items-center gap-1"
                          title="Editar"
                        >
                          <Pencil size={16} /> <span className="hidden sm:inline">Editar</span>
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveExisting(key)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 disabled:opacity-60"
                            title="Guardar"
                            disabled={saving}
                          >
                            <Save size={16} /> <span className="hidden sm:inline">Guardar</span>
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="border border-gray-300 rounded-lg px-3 py-2 bg-white flex items-center gap-1"
                            title="Cancelar"
                          >
                            <X size={16} /> <span className="hidden sm:inline">Cancelar</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Sin resultados */}
              {!loading && filtered.length === 0 && editingId !== 'new' && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No hay clientes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Consejo: toca <span className="font-medium">Editar</span>, modifica los campos y presiona{' '}
          <kbd className="px-1 border rounded">Enter</kbd> para guardar o{' '}
          <kbd className="px-1 border rounded">Esc</kbd> para cancelar. El <strong>WhatsApp no es editable</strong>.
        </p>
      </div>
    </div>
  );
};

export default AdminClientes;
