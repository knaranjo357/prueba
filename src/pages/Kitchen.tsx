import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils,
  Beef,
  Play,
  Package,
  AlertCircle,
  Clock,
  CheckCircle,
  User,
  Phone,
  MapPin,
  Store
} from 'lucide-react';

/** ======= API (misma que OrdersTab) ======= */
const ORDERS_API = 'https://n8n.alliasoft.com/webhook/luis-res/pedidos';

/** ======= Tipos del backend (mismos que OrdersTab) ======= */
interface Order {
  row_number: number;
  fecha: string;
  nombre?: string;
  numero: string;
  direccion: string;
  "detalle pedido": string;
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  estado: string;
}

/** Estados permitidos por tu backend */
const allowedStatuses = [
  'pidiendo',
  'confirmado',
  'impreso',
  'preparando',
  'en camino',
  'entregado',
] as const;
type AllowedStatus = typeof allowedStatuses[number];

/** ======= Helpers de parseo (derivados de OrdersTab) ======= */
const repeat = (ch: string, n: number) => Array(Math.max(0, n)).fill(ch).join('');

const parseMoneyToInt = (s: string): number => {
  const n = parseInt((s || '').replace(/[^0-9\-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

const splitOutsideParens = (s: string, separators = [';']): string[] => {
  const sepSet = new Set(separators);
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && sepSet.has(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};

const splitByCommaOutsideParens = (s: string): string[] => splitOutsideParens(s, [',']);

type ParsedItem = { quantity: number; name: string };

/** Convierte "2, Bandeja, 28000; 1, Limonada, 6000" -> [{2, 'Bandeja'}, {1,'Limonada'}] */
const parseDetails = (raw: string): ParsedItem[] => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [';', '|']).map(x => x.trim()).filter(Boolean);
  return itemStrings.map(itemStr => {
    const parts = splitByCommaOutsideParens(itemStr).map(x => x.trim());
    let quantity = 1;
    let name = '';
    if (parts.length >= 3) {
      const q = parts[0].replace(/^-/, '').trim();
      quantity = Math.max(1, Math.abs(parseInt(q || '1', 10)) || 1);
      name = parts.slice(1, parts.length - 1).join(', ').trim();
    } else if (parts.length === 2) {
      quantity = 1;
      name = parts[0];
      // parts[1] sería el precio, que cocina no necesita
    } else {
      quantity = 1;
      name = parts[0] || '';
    }
    return { quantity, name };
  });
};

/** Heurística simple para categorizar ítems (para el resumen de parrilla) */
const categorize = (name: string): 'carnes' | 'pescados' | 'bebidas' | 'otros' => {
  const n = (name || '').toLowerCase();
  if (/(res|carne|lomo|cerdo|pechuga|pollo|churrasco|chata|punta|sobrecostilla|costilla|hígado|higado|morcilla)/.test(n)) return 'carnes';
  if (/(pescado|mojarra|tilapia|trucha)/.test(n)) return 'pescados';
  if (/(jugo|limonada|gaseosa|bebida|agua|refresco)/.test(n)) return 'bebidas';
  return 'otros';
};

const cleanPhone = (raw: string) => (raw || '').replace('@s.whatsapp.net', '').replace(/[^0-9+]/g, '');

/** ======= POST al backend con payload COMPLETO ======= */
const buildFullPayload = (o: Order, override?: Partial<Order>) => {
  const merged = { ...o, ...(override || {}) };
  return {
    numero: merged.numero,
    nombre: merged.nombre ?? '',
    direccion: merged.direccion ?? '',
    detalle_pedido: merged['detalle pedido'] ?? '',
    valor_restaurante: merged.valor_restaurante ?? 0,
    valor_domicilio: merged.valor_domicilio ?? 0,
    metodo_pago: merged.metodo_pago ?? '',
    estado: merged.estado ?? '',
  };
};

const postOrderFull = async (o: Order, override?: Partial<Order>) => {
  const response = await fetch(ORDERS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildFullPayload(o, override)),
  });
  if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
};

/** ======= Kitchen Component ======= */
const Kitchen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<number[]>([]); // row_number
  const [loading, setLoading] = useState(false);

  /** Carga inicial + auto-refresh */
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await fetch(ORDERS_API);
        const data = await res.json();
        if (Array.isArray(data)) setOrders(data as Order[]);
      } catch (e) {
        console.error('Error fetching orders:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
    const id = setInterval(fetchOrders, 20000);
    return () => clearInterval(id);
  }, []);

  /** Activos para cocina: confirmado / impreso / preparando */
  const activeOrders = useMemo(() => {
    const keep = new Set<AllowedStatus>(['confirmado', 'impreso', 'preparando']);
    return orders
      .filter(o => keep.has(o.estado as AllowedStatus))
      .sort((a, b) => {
        const aT = new Date(a.fecha).getTime() || 0;
        const bT = new Date(b.fecha).getTime() || 0;
        return aT - bT; // más antiguos primero
      });
  }, [orders]);

  const selectedOrders = useMemo(
    () => activeOrders.filter(o => selected.includes(o.row_number)),
    [activeOrders, selected]
  );

  /** Resumen parrillero: suma carnes de pedidos seleccionados */
  const parrilla = useMemo(() => {
    const map: Record<string, number> = {};
    selectedOrders.forEach(o => {
      const items = parseDetails(o['detalle pedido']);
      items.forEach(it => {
        if (categorize(it.name) === 'carnes') {
          const key = it.name.toUpperCase();
          map[key] = (map[key] || 0) + (it.quantity || 1);
        }
      });
    });
    // ordenamos por cantidad desc
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [selectedOrders]);

  /** Toggle selección */
  const toggle = (id: number) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  /** Acciones de estado */
  const bulkUpdateStatus = async (newStatus: AllowedStatus) => {
    // Solo estados válidos del flujo de cocina
    if (!(['preparando', 'en camino'] as AllowedStatus[]).includes(newStatus)) return;
    const ids = new Set(selected);
    const toUpdate = orders.filter(o => ids.has(o.row_number));
    // Optimista
    setOrders(prev => prev.map(o => (ids.has(o.row_number) ? { ...o, estado: newStatus } : o)));
    setSelected([]);
    try {
      await Promise.all(toUpdate.map(o => postOrderFull(o, { estado: newStatus })));
    } catch (e) {
      console.error('Fallo actualizando estado:', e);
      // Refetch para sincronizar
      try {
        const res = await fetch(ORDERS_API);
        const data = await res.json();
        if (Array.isArray(data)) setOrders(data as Order[]);
      } catch {}
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const elapsedMin = (dateStr: string) => {
    const t = new Date(dateStr).getTime() || 0;
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
  };

  const statusPill = (estado: string) => {
    if (estado === 'preparando') return { text: 'Preparando', cls: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (estado === 'impreso' || estado === 'confirmado') return { text: 'Pendiente', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    return { text: estado, cls: 'bg-gray-100 text-gray-800 border-gray-300' };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Utensils className="text-orange-600" size={24} />
                Cocina
              </h1>
              <p className="text-gray-600 text-sm">
                {activeOrders.length} pedidos en cocina {loading && '· actualizando…'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">
                {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs text-gray-600">{selected.length} seleccionados</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Lista de pedidos */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence>
                {activeOrders.map((order) => {
                  const pill = statusPill(order.estado);
                  const items = parseDetails(order['detalle pedido']);
                  const phone = cleanPhone(order.numero);
                  const sel = selected.includes(order.row_number);
                  const elapsed = elapsedMin(order.fecha);

                  return (
                    <motion.div
                      key={order.row_number}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer text-xs ${
                        sel ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggle(order.row_number)}
                    >
                      <div className="p-3">
                        {/* Encabezado */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold">
                            #{order.row_number}
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium border ${pill.cls}`}>
                            <div className="flex items-center gap-1">
                              {order.estado === 'preparando' ? <Clock size={14} /> : <AlertCircle size={14} />}
                              {pill.text}
                            </div>
                          </div>
                        </div>

                        {/* Cliente / Tiempo */}
                        <div className="mb-2">
                          <div className="flex items-center gap-1 mb-1">
                            <User size={12} className="text-gray-500" />
                            <span className="font-medium text-xs truncate">{order.nombre || 'Cliente'}</span>
                          </div>
                          <div className="text-[11px] text-gray-600 flex items-center gap-2">
                            <span>Hace {elapsed} min</span>
                            <span className="text-gray-400">·</span>
                            <span>{formatTime(order.fecha)}</span>
                          </div>
                        </div>

                        {/* Dirección / Tipo */}
                        <div className="mb-2 text-[11px] text-gray-700 flex items-start gap-1">
                          {order.direccion ? (
                            <>
                              <MapPin size={12} className="mt-0.5 text-gray-500" />
                              <span className="line-clamp-2">{order.direccion}</span>
                            </>
                          ) : (
                            <>
                              <Store size={12} className="mt-0.5 text-gray-500" />
                              <span>Recoger en local</span>
                            </>
                          )}
                        </div>

                        {/* Items */}
                        <div className="space-y-1">
                          {items.slice(0, 6).map((it, idx) => (
                            <div key={idx} className="bg-gray-50 rounded p-2">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1">
                                  <span className="font-medium text-xs">
                                    {it.quantity}x {it.name}
                                  </span>
                                </div>
                                {/* chips opcionales por categoría */}
                                <div className="flex gap-1">
                                  {categorize(it.name) === 'carnes' && (
                                    <span className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-[10px]">
                                      Carne
                                    </span>
                                  )}
                                  {categorize(it.name) === 'pescados' && (
                                    <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-[10px]">
                                      Pescado
                                    </span>
                                  )}
                                  {categorize(it.name) === 'bebidas' && (
                                    <span className="bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded text-[10px]">
                                      Bebida
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {items.length > 6 && (
                            <div className="text-[11px] text-gray-500 italic">… y {items.length - 6} más</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Panel derecho: Acciones + Resúmenes */}
          <div className="space-y-4">
            {selected.length > 0 ? (
              <>
                <div className="bg-white rounded-lg shadow-sm p-3">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Acciones ({selected.length})</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => bulkUpdateStatus('preparando')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Play size={14} />
                      Iniciar preparación
                    </button>
                    <button
                      onClick={() => bulkUpdateStatus('en camino')}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Package size={14} />
                      Pasar a despacho
                    </button>
                  </div>
                </div>

                {/* Resumen para parrillero */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1">
                    <Beef className="text-red-600" size={16} />
                    Para Parrillero
                  </h3>
                  {parrilla.length === 0 ? (
                    <div className="text-[12px] text-red-700">No hay carnes en la selección.</div>
                  ) : (
                    <div className="space-y-2">
                      {parrilla.map(([name, qty]) => (
                        <div key={name} className="bg-white rounded p-2 border border-red-200">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-red-800 text-xs">{name}</span>
                            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold">
                              {qty}x
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <Utensils size={32} className="text-gray-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">Selecciona Pedidos</h3>
                <p className="text-gray-600 text-xs">Haz clic en los pedidos para preparar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kitchen;
