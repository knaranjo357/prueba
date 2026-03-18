import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils,
  Beef,
  Fish,
  Play,
  Package,
  AlertCircle,
  Clock3,
  CheckCircle2,
  User,
  ChefHat,
  ShoppingBag,
  StickyNote,
} from 'lucide-react';

/** ===== API ===== */
const ORDERS_API = 'https://n8n.alliasoft.com/webhook/luis-res/pedidos';

/** ===== Tipos ===== */
interface Order {
  row_number: number;
  fecha: string;
  nombre?: string;
  numero?: string;
  direccion?: string;
  'detalle pedido': string;
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  estado: string;
}

type AllowedStatus =
  | 'pidiendo'
  | 'confirmado'
  | 'impreso'
  | 'preparando'
  | 'en camino'
  | 'entregado';

type ParsedItem = {
  quantity: number;
  name: string;
  note: string;
  priceTotal: number;
  priceUnit: number;
};

type GrillSummaryItem = {
  key: string;
  name: string;
  qty: number;
  type: 'carne' | 'pescado' | 'otro';
};

/** ===== Helpers ===== */
const formatPrice = (n: number) => `$${(n || 0).toLocaleString('es-CO')}`;

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

const splitByCommaOutsideParens = (s: string): string[] =>
  splitOutsideParens(s, [',']);

const extractNameAndNote = (raw: string) => {
  const text = (raw || '').trim();

  const match = text.match(/^(.*?)(?:\s*\(([^()]*)\))?\s*$/);
  if (!match) {
    return { name: text, note: '' };
  }

  return {
    name: (match[1] || '').trim(),
    note: (match[2] || '').trim(),
  };
};

const parseDetails = (raw: string): ParsedItem[] => {
  if (!raw) return [];

  const itemStrings = splitOutsideParens(raw, [';', '|'])
    .map((x) => x.trim())
    .filter(Boolean);

  return itemStrings.map((itemStr) => {
    const parts = splitByCommaOutsideParens(itemStr).map((x) => x.trim());

    let quantity = 1;
    let rawName = '';
    let priceTotal = 0;

    if (parts.length >= 3) {
      quantity = Math.max(
        1,
        Math.abs(parseInt(parts[0].replace(/^-/, ''), 10) || 1)
      );
      rawName = parts.slice(1, parts.length - 1).join(', ').trim();
      priceTotal = parseMoneyToInt(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      quantity = 1;
      rawName = parts[0];
      priceTotal = parseMoneyToInt(parts[1]);
    } else {
      quantity = 1;
      rawName = parts[0] || '';
      priceTotal = 0;
    }

    const { name, note } = extractNameAndNote(rawName);
    const priceUnit = quantity > 0 ? Math.round(priceTotal / quantity) : 0;

    return {
      quantity,
      name,
      note,
      priceTotal,
      priceUnit,
    };
  });
};

const isCarne = (name: string) => {
  const n = (name || '').toLowerCase();
  return /(carne|res|semioreada|sobrebarriga|lomo|cerdo|pechuga|pollo|pernil|gallina|chorizo|rellena|morcilla|picada)/.test(
    n
  );
};

const isPescado = (name: string) => {
  const n = (name || '').toLowerCase();
  return /(mojarra|pescado|tilapia|trucha)/.test(n);
};

const getCookType = (name: string): 'carne' | 'pescado' | 'otro' => {
  if (isCarne(name)) return 'carne';
  if (isPescado(name)) return 'pescado';
  return 'otro';
};

const buildFullPayload = (o: Order, override?: Partial<Order>) => {
  const merged = { ...o, ...(override || {}) };
  return {
    numero: merged.numero ?? '',
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

const elapsedMin = (dateStr: string) => {
  const t = new Date(dateStr).getTime() || 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
};

const formatHour = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });

const getStatusUI = (estado: string) => {
  const s = (estado || '').toLowerCase().trim();

  if (s === 'preparando') {
    return {
      label: 'Preparando',
      cls: 'bg-blue-100 text-blue-800 border-blue-300',
    };
  }

  if (s === 'confirmado' || s === 'impreso') {
    return {
      label: 'Pendiente',
      cls: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    };
  }

  return {
    label: estado,
    cls: 'bg-gray-100 text-gray-700 border-gray-300',
  };
};

/** ===== Component ===== */
const Kitchen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  /** Fetch */
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(ORDERS_API);
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data as Order[]);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 20000);
    return () => clearInterval(id);
  }, []);

  /** Solo cocina */
  const kitchenOrders = useMemo(() => {
    const keep = new Set<AllowedStatus>(['confirmado', 'impreso', 'preparando']);

    return orders
      .filter((o) => keep.has(o.estado as AllowedStatus))
      .sort((a, b) => {
        const aPrep = a.estado === 'preparando' ? 1 : 0;
        const bPrep = b.estado === 'preparando' ? 1 : 0;

        if (aPrep !== bPrep) return bPrep - aPrep;

        const aT = new Date(a.fecha).getTime() || 0;
        const bT = new Date(b.fecha).getTime() || 0;
        return aT - bT;
      });
  }, [orders]);

  const selectedOrders = useMemo(
    () => kitchenOrders.filter((o) => selected.includes(o.row_number)),
    [kitchenOrders, selected]
  );

  const pendingOrders = useMemo(
    () => kitchenOrders.filter((o) => o.estado !== 'preparando'),
    [kitchenOrders]
  );

  const preparingOrders = useMemo(
    () => kitchenOrders.filter((o) => o.estado === 'preparando'),
    [kitchenOrders]
  );

  /** Resumen para parrilla */
  const parrillaSummary = useMemo<GrillSummaryItem[]>(() => {
    const acc: Record<string, GrillSummaryItem> = {};

    selectedOrders.forEach((order) => {
      const items = parseDetails(order['detalle pedido']);
      items.forEach((item) => {
        const type = getCookType(item.name);
        if (type === 'otro') return;

        const key = item.name.trim().toLowerCase();

        if (!acc[key]) {
          acc[key] = {
            key,
            name: item.name,
            qty: 0,
            type,
          };
        }

        acc[key].qty += item.quantity || 1;
      });
    });

    return Object.values(acc).sort((a, b) => b.qty - a.qty);
  }, [selectedOrders]);

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const bulkUpdateStatus = async (newStatus: AllowedStatus) => {
    if (!['preparando', 'en camino'].includes(newStatus)) return;

    const ids = new Set(selected);
    const toUpdate = orders.filter((o) => ids.has(o.row_number));

    setOrders((prev) =>
      prev.map((o) => (ids.has(o.row_number) ? { ...o, estado: newStatus } : o))
    );
    setSelected([]);

    try {
      await Promise.all(toUpdate.map((o) => postOrderFull(o, { estado: newStatus })));
    } catch (e) {
      console.error('Fallo actualizando estado:', e);
      fetchOrders();
    }
  };

  const singleUpdateStatus = async (order: Order, newStatus: AllowedStatus) => {
    const original = order.estado;

    setOrders((prev) =>
      prev.map((o) =>
        o.row_number === order.row_number ? { ...o, estado: newStatus } : o
      )
    );

    try {
      await postOrderFull(order, { estado: newStatus });
    } catch (e) {
      console.error('Error actualizando pedido:', e);
      setOrders((prev) =>
        prev.map((o) =>
          o.row_number === order.row_number ? { ...o, estado: original } : o
        )
      );
    }
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const isSelected = selected.includes(order.row_number);
    const status = getStatusUI(order.estado);
    const items = parseDetails(order['detalle pedido']);
    const mins = elapsedMin(order.fecha);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className={`rounded-2xl border-2 bg-white shadow-sm transition-all ${
          isSelected
            ? 'border-orange-400 ring-2 ring-orange-200'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div
          className="p-4 cursor-pointer"
          onClick={() => toggle(order.row_number)}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <User size={15} className="text-gray-500" />
                <span className="font-black text-gray-900 truncate">
                  {order.nombre || 'Cliente'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock3 size={13} />
                <span>Hace {mins} min</span>
                <span>•</span>
                <span>{formatHour(order.fecha)}</span>
              </div>
            </div>

            <div
              className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${status.cls}`}
            >
              {status.label}
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => {
              const type = getCookType(item.name);

              return (
                <div
                  key={`${order.row_number}-${idx}`}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="shrink-0 bg-gray-900 text-white text-xs font-black px-2 py-1 rounded-lg">
                        {item.quantity}x
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm break-words">
                            {item.name}
                          </span>

                          {type === 'carne' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              Carne
                            </span>
                          )}

                          {type === 'pescado' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              Pescado
                            </span>
                          )}
                        </div>

                        {item.note && (
                          <div className="mt-1 flex items-start gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                            <StickyNote size={12} className="mt-0.5 shrink-0" />
                            <span>{item.note}</span>
                          </div>
                        )}

                        <div className="mt-1 text-xs text-gray-500">
                          {formatPrice(item.priceUnit)} c/u
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="font-black text-gray-900 text-sm">
                        {formatPrice(item.priceTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
            {order.estado !== 'preparando' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  singleUpdateStatus(order, 'preparando');
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <Play size={15} />
                Iniciar
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  singleUpdateStatus(order, 'en camino');
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <Package size={15} />
                A despacho
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                <ChefHat className="text-orange-600" size={24} />
                Cocina / Parrilla
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Solo información útil para producción
                {loading && ' · actualizando...'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                <div className="text-xs text-yellow-700 font-bold">Pendientes</div>
                <div className="text-xl font-black text-yellow-900">{pendingOrders.length}</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <div className="text-xs text-blue-700 font-bold">Preparando</div>
                <div className="text-xl font-black text-blue-900">{preparingOrders.length}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <div className="text-xs text-orange-700 font-bold">Seleccionados</div>
                <div className="text-xl font-black text-orange-900">{selected.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          {/* Lista */}
          <div className="space-y-4">
            {/* Pendientes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={18} className="text-yellow-600" />
                <h2 className="font-black text-gray-900">Pendientes</h2>
              </div>

              {pendingOrders.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-500">
                  No hay pedidos pendientes.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <AnimatePresence>
                    {pendingOrders.map((order) => (
                      <OrderCard key={order.row_number} order={order} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Preparando */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock3 size={18} className="text-blue-600" />
                <h2 className="font-black text-gray-900">Preparando</h2>
              </div>

              {preparingOrders.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-500">
                  No hay pedidos en preparación.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <AnimatePresence>
                    {preparingOrders.map((order) => (
                      <OrderCard key={order.row_number} order={order} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Panel parrilla */}
          <aside className="space-y-4">
            {selected.length > 0 ? (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                  <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                    <ShoppingBag size={18} className="text-orange-600" />
                    Acciones
                  </h3>

                  <div className="space-y-2">
                    <button
                      onClick={() => bulkUpdateStatus('preparando')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                    >
                      <Play size={16} />
                      Iniciar seleccionados
                    </button>

                    <button
                      onClick={() => bulkUpdateStatus('en camino')}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                    >
                      <Package size={16} />
                      Pasar seleccionados a despacho
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-4">
                  <h3 className="font-black text-red-800 mb-3 flex items-center gap-2">
                    <Beef size={18} className="text-red-600" />
                    Resumen para parrilla
                  </h3>

                  {parrillaSummary.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      En los pedidos seleccionados no hay carnes ni pescados.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {parrillaSummary.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {item.type === 'carne' ? (
                                <Beef size={15} className="text-red-600 shrink-0" />
                              ) : (
                                <Fish size={15} className="text-blue-600 shrink-0" />
                              )}

                              <span className="font-bold text-gray-900 text-sm truncate">
                                {item.name}
                              </span>
                            </div>

                            <div className="bg-gray-900 text-white text-xs font-black px-2 py-1 rounded-lg shrink-0">
                              {item.qty}x
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                  <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    Pedidos seleccionados
                  </h3>

                  <div className="space-y-2">
                    {selectedOrders.map((order) => (
                      <div
                        key={order.row_number}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="font-bold text-sm text-gray-900">
                          {order.nombre || 'Cliente'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {parseDetails(order['detalle pedido']).length} productos
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
                <Utensils size={34} className="text-gray-400 mx-auto mb-3" />
                <h3 className="font-bold text-gray-900 mb-1">Selecciona pedidos</h3>
                <p className="text-sm text-gray-500">
                  Toca uno o varios pedidos para ver el resumen de parrilla y operar más rápido.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Kitchen;