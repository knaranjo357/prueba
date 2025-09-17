import React, { useEffect, useMemo, useState } from 'react';
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

/** Normaliza el whatsapp a 573XXXXXXXXX (sin +, espacios, etc.) */
const normalizeWhatsApp = (raw: string): string => {
  const digits = (raw || '').replace(/\D+/g, ''); // solo números
  if (!digits) return '';
  // si ya empieza por 57 -> mantener
  if (digits.startsWith('57')) return digits;
  // si empieza por 00357... o 0057... (casos raros) – quitamos 00 inicial
  const no00 = digits.replace(/^00/, '');
  if (no00.startsWith('57')) return no00;
  // si empieza por 3XXXXXXXXX (móvil Colombia) -> anteponer 57
  if (/^3\d{9}$/.test(no00)) return `57${no00}`;
  // fallback: si empieza por 57 después de quitar 0s al inicio
  const noLeadingZeros = no00.replace(/^0+/, '');
  if (noLeadingZeros.startsWith('57')) return noLeadingZeros;
  // último recurso: anteponer 57
  return `57${noLeadingZeros}`;
};

const AdminClientes: React.FC = () => {
  const [items, setItems] = useState<Cliente[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  // form
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [direccion, setDireccion] = useState('');
  const [domicilio, setDomicilio] = useState<number>(0);
  const [notas, setNotas] = useState('');

  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(CLIENTES_API);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data as Cliente[]);
    } catch (e) {
      console.error(e);
      alert('No se pudieron cargar los clientes.');
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
    setNombre('');
    setWhatsapp('');
    setDireccion('');
    setDomicilio(0);
    setNotas('');
  };

  const startEdit = (c: Cliente) => {
    setEditingId(c.row_number ?? null);
    setNombre(c.nombre || '');
    setWhatsapp(String(c.whatsapp ?? ''));
    setDireccion(c.direccion || '');
    setDomicilio(Number(c.domicilio) || 0);
    setNotas(c.notas || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNombre('');
    setWhatsapp('');
    setDireccion('');
    setDomicilio(0);
    setNotas('');
  };

  const save = async () => {
    try {
      const wpp = normalizeWhatsApp(whatsapp);
      if (!wpp) {
        alert('El WhatsApp es obligatorio y debe ser válido.');
        return;
      }
      const payload = {
        whatsapp: Number(wpp),         // {{ $json.body.whatsapp }}
        nombre: (nombre || '').trim(), // {{ $json.body.nombre }}
        direccion: (direccion || '').trim(), // {{ $json.body.direccion }}
        domicilio: Number(domicilio) || 0,   // {{ $json.body.domicilio }}
        notas: (notas || '').trim(),         // {{ $json.body.notas }}
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
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => {
      const n = (i.nombre || '').toLowerCase();
      const w = String(i.whatsapp || '');
      return n.includes(q) || w.includes(q);
    });
  }, [items, query]);

  return (
    <div className="min-w-0">
      {/* Barra de acciones */}
      <div className="sticky top-24 z-20 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o WhatsApp…"
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
                Nuevo cliente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form nuevo */}
      {editingId === 'new' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <h3 className="font-bold text-gray-900 mb-3">Crear cliente</h3>
          <div className="grid md:grid-cols-5 gap-3">
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-600 mb-1">WhatsApp (57 + 10 dígitos)</label>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="+57 3xx xxx xxxx"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-600 mb-1">Nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nombre"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Dirección</label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Dirección"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-600 mb-1">Domicilio</label>
              <input
                type="number"
                value={domicilio}
                onChange={(e) => setDomicilio(parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="0"
              />
            </div>
            <div className="md:col-span-5">
              <label className="block text-xs text-gray-600 mb-1">Notas</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
                placeholder="Observaciones del cliente"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm">
              <Save size={16} /> Guardar
            </button>
            <button onClick={cancelEdit} className="border border-gray-300 round
