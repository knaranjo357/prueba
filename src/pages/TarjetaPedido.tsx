import React, { useCallback, useRef } from 'react';
import {
  Printer,
  Save,
  X,
  MapPin,
  Phone,
  User,
  CreditCard,
  Clock,
  ShoppingBasket,
  Minus,
  Plus,
  Search,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';

/** TIPOS */
export interface Order {
  row_number: number;
  fecha: string;
  nombre?: string;
  numero?: string | number;
  direccion: string;
  'detalle pedido': string;
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  estado: string;
  fuente?: string;
}

export type MenuItem = {
  id: number | string;
  nombre: string;
  valor: number;
  categorias: string[];
  disponible: boolean;
};

export type CartItem = {
  name: string;
  quantity: number;
  priceUnit: number;
  notes?: string;
};

/** HELPERS UI */
const money = (n: number) => `$${(n || 0).toLocaleString('es-CO')}`;

const cleanPhone = (raw: unknown) => {
  const v =
    raw && typeof raw === 'object'
      ? (raw as any).numero ?? (raw as any).value ?? (raw as any).phone ?? ''
      : raw;
  const s = String(v ?? '');
  return s.replace(/@s\.whatsapp\.net$/i, '').replace(/[^0-9+]/g, '');
};

const getRawPhone = (raw: unknown): string => {
  const v =
    raw && typeof raw === 'object'
      ? (raw as any).numero ?? (raw as any).value ?? (raw as any).phone ?? ''
      : raw;
  return String(v ?? '').trim();
};

const paymentMethods = [
  'transferencia',
  'transferencia_espera',
  'efectivo',
  'transferencia_confirmada',
] as const;

const allowedStatuses = [
  'pidiendo',
  'confirmado',
  'impreso',
  'preparando',
  'en camino',
  'entregado',
  'con problema',
] as const;

const getStatusUI = (estado?: string) => {
  const s = (estado || '').toLowerCase().trim();
  if (s === 'pidiendo')    return { card: 'bg-yellow-50 border-yellow-400 ring-yellow-400/20',  badge: 'bg-yellow-100 text-yellow-800 border border-yellow-400',  dot: 'bg-yellow-400' };
  if (s === 'confirmado')  return { card: 'bg-orange-50 border-orange-400 ring-orange-400/20',  badge: 'bg-orange-100 text-orange-800 border border-orange-400',  dot: 'bg-orange-500' };
  if (s === 'impreso')     return { card: 'bg-sky-50 border-sky-400 ring-sky-400/20',        badge: 'bg-sky-100 text-sky-800 border border-sky-400',           dot: 'bg-sky-500'    };
  if (s === 'preparando')  return { card: 'bg-violet-50 border-violet-400 ring-violet-400/20',  badge: 'bg-violet-100 text-violet-800 border border-violet-400',  dot: 'bg-violet-500' };
  if (s === 'en camino')   return { card: 'bg-cyan-50 border-cyan-400 ring-cyan-400/20',      badge: 'bg-cyan-100 text-cyan-800 border border-cyan-400',        dot: 'bg-cyan-500'   };
  if (s === 'entregado')   return { card: 'bg-emerald-50 border-emerald-400 ring-emerald-400/20',badge: 'bg-emerald-100 text-emerald-800 border border-emerald-400',dot: 'bg-emerald-500'};
  if (s === 'con problema')return { card: 'bg-rose-50 border-rose-500 ring-rose-500/20',      badge: 'bg-rose-100 text-rose-800 border border-rose-500',        dot: 'bg-rose-500'   };
  return { card: 'bg-white border-gray-300 ring-gray-300/20', badge: 'bg-gray-100 text-gray-700 border border-gray-300', dot: 'bg-gray-400' };
};

// === LOGICA DE PARSEO ===
const splitOutsideParens = (s: string, separators = [';']): string[] => {
  const sepSet = new Set(separators);
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && sepSet.has(ch)) { if (buf.trim()) out.push(buf.trim()); buf = ''; }
    else { buf += ch; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};

const splitByCommaOutsideParens = (s: string): string[] => splitOutsideParens(s, [',']);

const parseDetailsForView = (raw: string) => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [';', '|']).map(x => x.trim()).filter(Boolean);
  return itemStrings.map(itemStr => {
    const parts = splitByCommaOutsideParens(itemStr).map(x => x.trim());
    let quantity = 1, name = '', priceTotal = 0;
    if (parts.length >= 3) {
      quantity = parseInt(parts[0].replace(/^-/, ''), 10) || 1;
      name = parts.slice(1, parts.length - 1).join(', ').trim();
      priceTotal = parseInt(parts[parts.length - 1], 10) || 0;
    } else if (parts.length === 2) {
      quantity = 1; name = parts[0]; priceTotal = parseInt(parts[1], 10) || 0;
    } else {
      name = parts[0] || 'Item';
    }
    const priceUnit = quantity > 0 ? Math.round(priceTotal / quantity) : 0;
    return { quantity, name, priceTotal, priceUnit };
  });
};

// ─── Botón táctil sin delay y con feedback inmediato ───────────────────────
interface TapButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  onTap?: () => void;
}

const TapButton: React.FC<TapButtonProps> = ({ children, className = '', onTap, onClick, ...rest }) => {
  const fired = useRef(false);
  const timer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fired.current = false;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();          // cancela el click sintético del browser (300ms tap delay)
    if (!fired.current) {
      fired.current = true;
      onTap?.();
      onClick?.(e as any);
    }
    if (timer.current) clearTimeout(timer.current);
  }, [onTap, onClick]);

  const handlePointerCancel = useCallback(() => {
    fired.current = true;        // cancelado, no disparar
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      {...rest}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      // Mantener onClick como fallback en desktop
      onClick={e => { if (!fired.current) { onClick?.(e); onTap?.(); } fired.current = false; }}
      style={{ touchAction: 'manipulation', userSelect: 'none', WebkitTapHighlightColor: 'transparent', ...rest.style }}
      className={className}
    >
      {children}
    </button>
  );
};

interface TarjetaPedidoProps {
  order: Order;
  isEditing: boolean;
  editNombre: string;
  setEditNombre: (v: string) => void;
  editDireccion: string;
  setEditDireccion: (v: string) => void;
  editValorRest: number;
  editValorDom: number;
  setEditValorDom: (v: number) => void;
  editMetodoPago: string;
  setEditMetodoPago: (v: string) => void;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  menuSearch: string;
  setMenuSearch: (v: string) => void;
  menuCat: string;
  setMenuCat: (v: string) => void;
  filteredMenu: MenuItem[];
  categories: string[];
  addItemToCart: (item: MenuItem) => void;
  decreaseItem: (idx: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (o: Order) => void;
  onStartEdit: (o: Order) => void;
  onPrint: (o: Order) => void;
  onStatusChange: (o: Order, status: string) => void;
  onPaymentMethodChange?: (o: Order, method: string) => void;
}

const TarjetaPedido: React.FC<TarjetaPedidoProps> = ({
  order, isEditing,
  editNombre, setEditNombre,
  editDireccion, setEditDireccion,
  editValorRest, editValorDom, setEditValorDom,
  editMetodoPago, setEditMetodoPago,
  cartItems, setCartItems,
  menuSearch, setMenuSearch,
  menuCat, setMenuCat,
  filteredMenu, categories,
  addItemToCart, decreaseItem,
  onCancelEdit, onSaveEdit, onStartEdit,
  onPrint, onStatusChange, onPaymentMethodChange,
}) => {
  const phone    = cleanPhone(order?.numero ?? '');
  const rawPhone = getRawPhone(order?.numero ?? '');
  const ui       = getStatusUI(order.estado);
  const total    = (order.valor_restaurante || 0) + (order.valor_domicilio || 0);

  // ════════════════════════════════════════════
  // MODO EDICIÓN
  // ════════════════════════════════════════════
  if (isEditing) {
    return (
      <div className="md:col-span-2 xl:col-span-3 bg-white border-2 border-amber-400 rounded-2xl shadow-2xl relative overflow-hidden ring-4 ring-amber-400/10 z-30">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-400" />

        {/* ── Header ── */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-gray-100 bg-white sticky top-0 z-20">
          <h3 className="font-black text-gray-900 flex items-center gap-2.5 text-[15px]">
            <span className="w-7 h-7 rounded-full bg-amber-400 text-white flex items-center justify-center text-xs font-black">
              #{order.row_number}
            </span>
            Editando pedido
          </h3>
          <TapButton
            onTap={onCancelEdit}
            className="text-gray-400 hover:text-red-500 p-2.5 hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={20} />
          </TapButton>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-0">
          {/* ── Col Izquierda: datos ── */}
          <div className="order-1 lg:col-span-4 p-4 space-y-3.5 border-b lg:border-b-0 lg:border-r border-gray-100 bg-white">

            {/* Nombre */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Cliente / Mesero</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-400/30 focus-within:border-amber-400 transition-all">
                <User size={16} className="text-gray-400 shrink-0" />
                <input
                  value={editNombre}
                  onChange={e => setEditNombre(e.target.value)}
                  className="bg-transparent w-full outline-none text-base font-medium text-gray-800"
                  placeholder="Nombre del cliente"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            {/* Teléfono */}
            {rawPhone && (
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Teléfono / WhatsApp</p>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-green-600 shrink-0" />
                  <span className="text-sm font-mono font-semibold text-gray-700 break-all select-all">{rawPhone}</span>
                  {phone && (
                    <a
                      href={`https://wa.me/${phone}`}
                      target="_blank"
                      rel="noopener"
                      className="ml-auto shrink-0 text-[10px] font-bold text-green-700 bg-green-100 hover:bg-green-200 px-2 py-0.5 rounded-full transition-colors"
                    >
                      WA ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Dirección */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Dirección / Mesa / Notas</label>
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-400/30 focus-within:border-amber-400 transition-all">
                <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <textarea
                  value={editDireccion}
                  onChange={e => setEditDireccion(e.target.value)}
                  className="bg-transparent w-full outline-none text-sm text-gray-700 resize-none"
                  rows={3}
                  placeholder="Dirección o mesa..."
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            {/* Pago + Domicilio */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Pago</label>
                <div className="relative">
                  <select
                    value={editMetodoPago}
                    onChange={e => setEditMetodoPago(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-9 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
                    style={{ fontSize: '16px' }}
                  >
                    {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Domicilio ($)</label>
                <input
                  type="number"
                  value={editValorDom}
                  onChange={e => setEditValorDom(parseInt(e.target.value || '0', 10))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none font-semibold text-right focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            {/* Totales */}
            <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100">
              <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                <span>Restaurante</span>
                <span className="font-semibold">{money(editValorRest)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 mb-2.5 border-b border-amber-200 pb-2">
                <span>Domicilio</span>
                <span className="font-semibold">{money(editValorDom)}</span>
              </div>
              <div className="flex justify-between items-center font-black text-gray-900">
                <span className="text-sm">Total</span>
                <span className="text-xl">{money(editValorRest + editValorDom)}</span>
              </div>
            </div>
          </div>

          {/* ── Col Derecha: carrito + menú ── */}
          <div className="order-2 lg:col-span-8 flex flex-col bg-gray-50/30">

            {/* Header carrito */}
            <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between">
              <span className="font-black text-gray-800 text-sm flex items-center gap-2">
                <ShoppingBasket size={16} className="text-amber-500" />
                Productos del pedido
              </span>
              <span className="text-xs font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                {cartItems.reduce((s, i) => s + i.quantity, 0)} unid.
              </span>
            </div>

            {/* ── LISTA CARRITO ── */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[320px] lg:max-h-[260px] min-h-[100px]">
              {cartItems.length === 0 && (
                <div className="flex flex-col items-center justify-center h-28 text-gray-400 opacity-60">
                  <ShoppingBasket size={28} className="mb-2" />
                  <p className="text-sm">Carrito vacío</p>
                </div>
              )}

              {cartItems.map((item, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm">
                  <div className="flex items-center gap-2 px-3 py-2.5">

                    {/* ── Controles cantidad: targets grandes, sin delay ── */}
                    <div className="flex items-center rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shrink-0" style={{ height: 44 }}>
                      <TapButton
                        onTap={() => decreaseItem(idx)}
                        className="flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                        style={{ width: 44, height: 44 }}
                        aria-label="Quitar uno"
                      >
                        <Minus size={15} />
                      </TapButton>
                      <span
                        className="flex items-center justify-center font-black text-[15px] text-gray-800 bg-white border-x border-gray-200"
                        style={{ width: 36, height: 44 }}
                      >
                        {item.quantity}
                      </span>
                      <TapButton
                        onTap={() => addItemToCart({ nombre: item.name, valor: item.priceUnit } as any)}
                        className="flex items-center justify-center text-gray-500 hover:text-green-600 hover:bg-green-50 active:bg-green-100 transition-colors"
                        style={{ width: 44, height: 44 }}
                        aria-label="Agregar uno"
                      >
                        <Plus size={15} />
                      </TapButton>
                    </div>

                    {/* Nombre + precio unit */}
                    <div className="flex-1 min-w-0 px-1">
                      <p className="text-[13px] font-bold text-gray-800 truncate leading-tight">{item.name}</p>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">{money(item.priceUnit)} c/u</p>
                    </div>

                    {/* Total ítem */}
                    <p className="text-sm font-black text-gray-900 shrink-0 tabular-nums">{money(item.quantity * item.priceUnit)}</p>

                    {/* Eliminar */}
                    <TapButton
                      onTap={() => setCartItems(prev => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 active:bg-red-100 rounded-xl transition-all shrink-0 ml-1"
                      aria-label="Eliminar ítem"
                    >
                      <X size={15} />
                    </TapButton>
                  </div>

                  {/* Nota del ítem */}
                  <div className="px-3 pb-2.5">
                    <div className="flex items-center gap-1.5 bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5 focus-within:border-amber-300 focus-within:bg-amber-50 transition-all">
                      <MessageSquare size={11} className="text-amber-400 shrink-0" />
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={e =>
                          setCartItems(prev =>
                            prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x)
                          )
                        }
                        placeholder="Nota (ej: sin cebolla)"
                        className="w-full bg-transparent outline-none text-xs text-gray-600 placeholder:text-amber-400/70 font-medium"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── BUSCADOR + MENÚ ── */}
            <div className="border-t border-gray-200 bg-white p-3">

              {/* Buscador */}
              <div className="relative mb-2.5">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id={`search-menu-pedido-${order.row_number}`}
                  value={menuSearch}
                  onChange={e => setMenuSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none bg-gray-50 focus:bg-white transition-all"
                  style={{ fontSize: '16px' }}
                  autoComplete="off"
                />
                {menuSearch && (
                  <TapButton
                    onTap={() => {
                      setMenuSearch('');
                      document.getElementById(`search-menu-pedido-${order.row_number}`)?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 active:text-gray-800 p-1.5 rounded-lg"
                    aria-label="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </TapButton>
                )}
              </div>

              {/* Categorías */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                {categories.map(c => (
                  <TapButton
                    key={c}
                    onTap={() => setMenuCat(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-bold transition-colors shrink-0 ${
                      menuCat === c ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'
                    }`}
                    style={{ minHeight: 36 }}
                  >
                    {c}
                  </TapButton>
                ))}
              </div>

              {/* Grid de productos — cards grandes y fáciles de tocar */}
              <div className="h-52 lg:h-36 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-0.5">
                {filteredMenu.map(m => (
                  <TapButton
                    key={m.id}
                    onTap={() => addItemToCart(m)}
                    className="text-left bg-white border-2 border-gray-200 px-2.5 py-2 rounded-xl hover:border-amber-400 hover:shadow-sm active:bg-amber-50 active:border-amber-500 active:scale-[0.97] transition-all flex flex-col justify-between"
                    style={{ minHeight: 56 }}
                  >
                    <p className="text-xs font-bold text-gray-700 line-clamp-2 leading-tight break-words">{m.nombre}</p>
                    <p className="text-[10px] font-semibold text-amber-600 mt-1">{money(m.valor)}</p>
                  </TapButton>
                ))}
              </div>

              {/* Guardar / Cancelar */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <TapButton
                  onTap={onCancelEdit}
                  className="px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancelar
                </TapButton>
                <TapButton
                  onTap={() => onSaveEdit(order)}
                  className="flex-1 justify-center px-5 py-3 bg-gray-900 hover:bg-black active:bg-gray-700 text-white rounded-xl font-black flex items-center gap-2 text-sm shadow-lg transition-all"
                >
                  <Save size={16} /> Guardar cambios
                </TapButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  // MODO LECTURA
  // ════════════════════════════════════════════
  const itemsPreview = parseDetailsForView(order['detalle pedido']);

  return (
    <div
      id={`pedido-${order.row_number}`}
      className={`rounded-2xl border-4 p-5 transition-all duration-200 shadow-xl ring-4 ${ui.card}`}
    >
      {/* Header: número + estado */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="font-mono text-xs font-bold text-gray-500 bg-white/70 px-2 py-0.5 rounded-lg border border-gray-200/60">
          #{order.row_number}
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${ui.badge}`}>
          {order.estado}
        </span>
      </div>

      {/* Nombre + teléfono + dirección */}
      <div className="mb-4">
        <p className="font-black text-gray-900 text-xl leading-tight break-words mb-2">
          {order.nombre || 'Cliente'}
        </p>

        {phone && (
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg transition-colors mb-2"
            title="Abrir WhatsApp"
          >
            <Phone size={14} />
            <span className="break-all">{phone}</span>
          </a>
        )}

        <p className="text-sm text-gray-600 flex items-start gap-1.5 font-medium">
          <MapPin size={13} className="mt-0.5 shrink-0 text-gray-400" />
          <span className="break-words">{order.direccion || 'Sin dirección'}</span>
        </p>
        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
          <Clock size={11} />
          {order.fecha}
        </p>
      </div>

      {/* Items preview */}
      <div className="bg-white/60 rounded-xl border border-gray-200/60 p-1 overflow-hidden text-sm shadow-sm">
        {itemsPreview.length === 0 ? (
          <p className="text-center text-gray-400 text-xs py-2 italic">Sin detalles registrados</p>
        ) : (
          itemsPreview.map((item, idx) => (
            <div
              key={idx}
              className="flex justify-between items-start p-2 border-b border-dashed border-gray-200 last:border-0 hover:bg-white/80 transition-colors rounded-lg"
            >
              <div className="flex gap-3 items-start overflow-hidden">
                <span className="font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs min-w-[28px] text-center shrink-0 mt-0.5">
                  {item.quantity}
                </span>
                <span className="text-gray-800 font-medium break-words leading-tight">{item.name}</span>
              </div>
              <span className="text-gray-600 text-xs whitespace-nowrap font-bold tabular-nums shrink-0 ml-2">
                {money(item.priceTotal)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Botones de acción principales — grandes, fáciles de tocar */}
      <div className="mt-3 flex gap-2">
        <TapButton
          onTap={() => onStartEdit(order)}
          className="flex-1 px-3 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 transition-all shadow-sm"
        >
          Editar
        </TapButton>
        <TapButton
          onTap={() => onPrint(order)}
          className="flex-1 px-3 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black active:bg-gray-700 flex items-center justify-center gap-2 shadow-md transition-all"
        >
          <Printer size={15} /> Imprimir
        </TapButton>
      </div>

      {/* Resumen financiero + selects de estado/pago */}
      <div className="mt-3 flex items-start gap-3">
        {/* Totales */}
        <div className="bg-white/80 rounded-xl border border-gray-200/60 px-3 py-2 flex-1 min-w-[130px]">
          <div className="flex justify-between items-center text-xs text-gray-500 mb-0.5">
            <span>Rest</span>
            <span className="font-semibold">{money(order.valor_restaurante)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-gray-500 mb-1.5 pb-1.5 border-b border-gray-100">
            <span>Dom</span>
            <span className="font-semibold">{money(order.valor_domicilio)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total</span>
            <span className="text-base font-black text-gray-900">{money(total)}</span>
          </div>
        </div>

        {/* Selects de estado y pago */}
        <div className="flex flex-col gap-2 shrink-0">
          {onPaymentMethodChange && (
            <div className="relative">
              <CreditCard size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={order.metodo_pago || 'efectivo'}
                onChange={e => onPaymentMethodChange(order, e.target.value)}
                className="text-xs appearance-none bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 rounded-lg pl-6 pr-7 py-2 font-semibold text-gray-600 cursor-pointer transition-all focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none"
                style={{ touchAction: 'manipulation' }}
              >
                {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
          <div className="relative">
            <select
              value={order.estado}
              onChange={e => onStatusChange(order, e.target.value)}
              className="text-xs appearance-none bg-gray-100 hover:bg-gray-200 border border-transparent hover:border-gray-300 rounded-lg px-3 py-2 font-semibold text-gray-600 cursor-pointer transition-all focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none pr-7 w-full"
              style={{ touchAction: 'manipulation' }}
            >
              {allowedStatuses.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TarjetaPedido;