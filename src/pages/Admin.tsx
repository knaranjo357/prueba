import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Printer,
  RefreshCw,
  LogOut,
  Menu as MenuIcon,
  ShoppingBag,
  ArrowUpDown,
  Search,
  X as XIcon,
} from 'lucide-react';
import { fetchMenuItems } from '../api/menuApi';
import { MenuItem } from '../types';
import { formatPrice } from '../utils/dateUtils';

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

type MenuItemWithRow = MenuItem & { row_number?: number };

const ORDERS_API = 'https://n8n.alliasoft.com/webhook/luis-res/pedidos';
const MENU_API = 'https://n8n.alliasoft.com/webhook/luis-res/menu';

/** ======================
 *  VARIABLES DE COLUMNA
 *  Cambia estos 3 valores y listo.
 *  ====================== */
const GRID_COLS_MOBILE = 1;   // columnas en móviles
const GRID_COLS_MD = 2;       // columnas en tablets
const GRID_COLS_DESKTOP = 4;  // columnas en PC/desktop

// Mapa para generar clases Tailwind de forma segura (quedan "vistos" por el JIT)
const GRID_MAP: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

const gridColsClass =
  `${GRID_MAP[GRID_COLS_MOBILE] || 'grid-cols-1'} ` +
  `md:${GRID_MAP[GRID_COLS_MD] || 'grid-cols-2'} ` +
  `lg:${GRID_MAP[GRID_COLS_DESKTOP] || 'grid-cols-4'}`;

/// ===== Helpers para impresión POS 80 =====
const COLS = 42; // ancho típico (80mm)
const repeat = (ch: string, n: number) => Array(Math.max(0, n)).fill(ch).join('');
const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + repeat(' ', n - s.length));
const padLeft  = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : repeat(' ', n - s.length) + s);
const center   = (s: string) => {
  const len = Math.min(s.length, COLS);
  const left = Math.floor((COLS - len) / 2);
  return repeat(' ', Math.max(0, left)) + s.slice(0, COLS);
};
const money = (n: number) => `$${(n || 0).toLocaleString('es-CO')}`;
const cleanPhone = (raw: string) => raw.replace('@s.whatsapp.net', '').replace(/[^0-9+]/g, '');

const sanitizeForTicket = (s: string): string =>
  (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

const wrapText = (text: string, width: number): string[] => {
  if (width <= 0) return [text];
  const rawTokens = text.trim().split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (t.length <= width) tokens.push(t);
    else {
      for (let i = 0; i < t.length; i += width) tokens.push(t.slice(i, i + width));
    }
  }
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    if (!line.length) line = tok;
    else if ((line + ' ' + tok).length <= width) line += ' ' + tok;
    else { lines.push(line); line = tok; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

const wrapLabelValue = (label: string, value: string): string[] => {
  const prefix = `${label}: `;
  const valueWidth = Math.max(0, COLS - prefix.length);
  const vLines = wrapText(value || '', valueWidth);
  if (!vLines.length) return [padRight(prefix, COLS)];
  const out: string[] = [];
  out.push(padRight(prefix + vLines[0], COLS));
  const indent = repeat(' ', prefix.length);
  for (let i = 1; i < vLines.length; i++) out.push(padRight(indent + vLines[i], COLS));
  return out;
};

const totalLine = (label: string, amount: number): string => {
  const right = money(amount);
  const leftWidth = COLS - right.length - 1;
  return padRight(label, leftWidth) + ' ' + right;
};

const formatItemBlock = (qty: string, name: string, priceNum: number): string[] => {
  const price = money(priceNum);
  const qtyLabel = qty ? `${qty} ` : '';
  const rightWidth = price.length + 1;
  const leftWidth = COLS - rightWidth;

  const leftText = (qtyLabel + (name || '')).trim();
  const leftLines = wrapText(leftText, leftWidth);

  const out: string[] = [];
  const firstLeft = padRight(leftLines[0] || '', leftWidth);
  out.push(firstLeft + ' ' + price);

  const indent = repeat(' ', qtyLabel.length || 0);
  for (let i = 1; i < leftLines.length; i++) {
    out.push(padRight(indent + leftLines[i], COLS));
  }
  return out;
};

/* =========================
   Parser robusto de detalle
   ========================= */
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

const parseMoneyToInt = (s: string): number => {
  const n = parseInt((s || '').replace(/[^0-9\-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

const parseDetails = (raw: string) => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [';', '|']).map(x => x.trim()).filter(Boolean);

  return itemStrings.map(itemStr => {
    const parts = splitByCommaOutsideParens(itemStr).map(x => x.trim());

    let quantity = '';
    let name = '';
    let priceNum = 0;

    if (parts.length >= 3) {
      quantity = parts[0].replace(/^-/, '').trim() || '1';
      name = parts.slice(1, parts.length - 1).join(', ').trim();
      priceNum = parseMoneyToInt(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      quantity = '1';
      name = parts[0];
      priceNum = parseMoneyToInt(parts[1]);
    } else {
      quantity = '1';
      name = parts[0] || '';
      priceNum = 0;
    }

    const qMatch = quantity.match(/-?\d+/);
    if (qMatch) quantity = String(Math.abs(parseInt(qMatch[0], 10)));
    else quantity = '1';

    return { quantity, name, priceNum };
  });
};

/* =========================
   ESC/POS + RawBT Helpers
   ========================= */
const bytesToBase64 = (bytes: number[]): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const cp1252Map: Record<string, number> = {
  'Á': 0xC1, 'É': 0xC9, 'Í': 0xCD, 'Ó': 0xD3, 'Ú': 0xDA, 'Ü': 0xDC, 'Ñ': 0xD1,
  'á': 0xE1, 'é': 0xE9, 'í': 0xED, 'ó': 0xF3, 'ú': 0xFA, 'ü': 0xFC, 'ñ': 0xF1,
  '€': 0x80, '£': 0xA3, '¥': 0xA5, '¢': 0xA2, '°': 0xB0, '¿': 0xBF, '¡': 0xA1,
  '“': 0x93, '”': 0x94, '‘': 0x91, '’': 0x92, '—': 0x97, '–': 0x96, '…': 0x85,
};

const asciiFallback: Record<string, string> = {
  '“':'"', '”':'"', '‘':"'", '’':"'", '—':'-', '–':'-', '…':'...', '€':'EUR'
};

const encodeCP1252 = (str: string): number[] => {
  const bytes: number[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x7F) { bytes.push(code); continue; }
    if (cp1252Map[ch] !== undefined) { bytes.push(cp1252Map[ch]); continue; }

    const basic = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (basic.length === 1 && basic.charCodeAt(0) <= 0x7F) {
      bytes.push(basic.charCodeAt(0));
      continue;
    }
    if (asciiFallback[ch]) {
      for (const c of asciiFallback[ch]) bytes.push(c.charCodeAt(0));
      continue;
    }
    bytes.push(0x3F); // '?'
  }
  return bytes;
};

const buildEscposFromLines = (lines: string[]): number[] => {
  const bytes: number[] = [];
  bytes.push(0x1B, 0x40); // ESC @
  bytes.push(0x1B, 0x74, 0x10); // CP1252
  bytes.push(0x1B, 0x61, 0x00); // left
  const body = lines.join('\n') + '\n';
  bytes.push(...encodeCP1252(body));
  bytes.push(0x0A, 0x0A, 0x0A);
  bytes.push(0x1D, 0x56, 0x00); // cut
  return bytes;
};

const isAndroid = (): boolean =>
  /Android/i.test(navigator.userAgent || '');

const sendToRawBT = async (ticketLines: string[]): Promise<void> => {
  if (!isAndroid()) {
    throw new Error('Esta impresión directa requiere Android con RawBT instalado.');
  }
  const escposBytes = buildEscposFromLines(ticketLines);
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;

  try {
    (window as any).location.href = url;
    return;
  } catch {}

  try {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  } catch {}

  throw new Error('No se pudo invocar RawBT. Verifica que RawBT esté instalado y el servicio de impresión activo.');
};

/* =========================
   UI / Estado
   ========================= */

const allowedStatuses = [
  'pidiendo',
  'confirmado',
  'impreso',
  'preparando',
  'en camino',
  'entregado',
] as const;

const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');

  const [menuItems, setMenuItems] = useState<MenuItemWithRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros/orden para Pedidos
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPayment, setFilterPayment] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'fecha' | 'row_number'>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // UI Menu: búsqueda y categoría
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  // Mantener sesión si ya inició previamente
  useEffect(() => {
    const saved = localStorage.getItem('admin_auth');
    if (saved === '1') {
      setIsAuthenticated(true);
    }
  }, []);

  // GET automático al cambiar de tab (requerimiento)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'menu') {
      forceFetchMenuItems();
    } else {
      fetchOrders();
    }
  }, [activeTab, isAuthenticated]);

  // Auto refresh orders every 20 seconds (se mantiene)
  useEffect(() => {
    if (isAuthenticated && activeTab === 'orders') {
      const interval = setInterval(fetchOrders, 20000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeTab]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'alfredo@luisres.com' && password === 'luisres') {
      setIsAuthenticated(true);
      localStorage.setItem('admin_auth', '1');
    } else {
      alert('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin_auth');
    setEmail('');
    setPassword('');
  };

  // GET directo (sin cache)
  const forceFetchMenuItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(MENU_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      setMenuItems(
        (items as MenuItemWithRow[]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      );
    } catch (error) {
      console.error('Error fetching menu items:', error);
      try {
        const items = await fetchMenuItems();
        setMenuItems(
          (items as MenuItemWithRow[]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
      } catch (e) {
        console.error('Fallback fetchMenuItems failed:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = forceFetchMenuItems;

  const fetchOrders = async () => {
    try {
      const response = await fetch(ORDERS_API);
      const data = await response.json();
      if (Array.isArray(data)) {
        setOrders(data as Order[]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  // --- MENU: toggle disponibilidad con POST
  const postAvailability = async (payload: { row_number: number | null; id: number | string; disponible: boolean }) => {
    const res = await fetch(MENU_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('No se pudo actualizar la disponibilidad');
  };

  const updateMenuItemAvailability = async (item: MenuItemWithRow, nuevoValor: boolean) => {
    const payload = {
      row_number: item.row_number ?? null,
      id: (item as any).id,
      disponible: nuevoValor,
    };

    setMenuItems(prev => prev.map(i => (i.id === item.id ? { ...i, disponible: nuevoValor } : i)));
    try {
      await postAvailability(payload);
    } catch (err) {
      console.error(err);
      setMenuItems(prev => prev.map(i => (i.id === item.id ? { ...i, disponible: !nuevoValor } : i)));
      alert('No se pudo guardar el cambio. Intenta de nuevo.');
    }
  };

  // --- PEDIDOS: POST estado { numero, estado }
  const postOrderStatus = async (numeroRaw: string, newStatus: string) => {
    const response = await fetch(ORDERS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero: numeroRaw,
        estado: newStatus,
      }),
    });
    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
  };

  const updateOrderEstado = async (order: Order, newStatus: string) => {
    const numeroRaw = order.numero;
    const prevStatus = order.estado;

    setOrders(prev =>
      prev.map(o => (o.row_number === order.row_number ? { ...o, estado: newStatus } : o))
    );

    try {
      await postOrderStatus(numeroRaw, newStatus);
    } catch (error) {
      console.error('Error updating order status:', error);
      setOrders(prev =>
        prev.map(o => (o.row_number === order.row_number ? { ...o, estado: prevStatus } : o))
      );
      alert('No se pudo actualizar el estado. Intenta nuevamente.');
    }
  };

  // ====== IMPRESIÓN DIRECTA: RawBT en Android ======
  const printOrder = async (order: Order) => {
    const customerName = sanitizeForTicket(order.nombre || 'Cliente');
    const customerPhone = cleanPhone(order.numero);
    const items = parseDetails(order["detalle pedido"]);
    const subtotal = order.valor_restaurante || 0;
    const domicilio = order.valor_domicilio || 0;
    const total = subtotal + domicilio;

    const lines: string[] = [];
    lines.push(repeat('=', COLS));
    lines.push(center('LUIS RES'));
    lines.push(center('Cra 37 #109-24'));
    lines.push(center('Floridablanca - Caldas'));
    lines.push(repeat('=', COLS));

    lines.push(padRight(`PEDIDO #${order.row_number}`, COLS));
    lines.push(...wrapLabelValue('Fecha', sanitizeForTicket(order.fecha || '')));
    lines.push(...wrapLabelValue('Cliente', customerName));
    lines.push(...wrapLabelValue('Teléfono', customerPhone));
    lines.push(...wrapLabelValue('Dirección', sanitizeForTicket(order.direccion || '')));

    lines.push(repeat('-', COLS));
    lines.push(center('DETALLE DEL PEDIDO'));
    lines.push(repeat('-', COLS));

    items.forEach(({ quantity, name, priceNum }) => {
      const block = formatItemBlock(quantity || '1', sanitizeForTicket(name), priceNum);
      block.forEach(l => lines.push(l));
    });

    lines.push(repeat('-', COLS));
    lines.push(totalLine('Subtotal', subtotal));
    lines.push(totalLine('Domicilio', domicilio));
    lines.push(totalLine('TOTAL', total));
    lines.push('');
    lines.push(...wrapLabelValue('Método de pago', sanitizeForTicket(order.metodo_pago || '')));
    lines.push(...wrapLabelValue('Estado', sanitizeForTicket(order.estado || '')));
    lines.push(repeat('=', COLS));
    lines.push(center('¡Gracias por su compra!'));
    lines.push(repeat('=', COLS));

    try {
      await sendToRawBT(lines);
      await postOrderStatus(order.numero, 'impreso');
      setOrders(prev =>
        prev.map(o => (o.row_number === order.row_number ? { ...o, estado: 'impreso' } : o))
      );
      return;
    } catch (err: any) {
      console.warn('RawBT no disponible, fallback impresión navegador:', err?.message);
    }

    const html = `
      <div>
        <pre>${lines.map(l => l.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join(String.fromCharCode(10))}</pre>
      </div>
    `;
    const printWindow = window.open('', '_blank', 'width=380,height=700');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Factura #${order.row_number}</title>
            <style>
              @media print { @page { size: 80mm auto; margin: 0; } }
              body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 0; padding: 2mm; line-height: 1.25; }
              pre  { white-space: pre; margin: 0; font-size: 11px; }
            </style>
          </head>
          <body>
            ${html}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 1000);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

      try {
        await postOrderStatus(order.numero, 'impreso');
        setOrders(prev =>
          prev.map(o => (o.row_number === order.row_number ? { ...o, estado: 'impreso' } : o))
        );
      } catch (e) {
        console.error('No se pudo marcar como impreso en fallback:', e);
      }
    }
  };

  // Opciones dinámicas de filtros
  const statusOptions = useMemo(() => {
    const setVals = new Set<string>();
    orders.forEach(o => { if (o?.estado) setVals.add(o.estado); });
    return ['todos', ...Array.from(setVals)];
  }, [orders]);

  const paymentOptions = useMemo(() => {
    const setVals = new Set<string>();
    orders.forEach(o => { if (o?.metodo_pago) setVals.add(o.metodo_pago); });
    return ['todos', ...Array.from(setVals)];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const byFilters = orders.filter(order => {
      const statusMatch = filterStatus === 'todos' || order.estado === filterStatus;
      const paymentMatch = filterPayment === 'todos' || order.metodo_pago === filterPayment;
      return statusMatch && paymentMatch;
    });

    const sorted = [...byFilters].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'fecha') {
        const aT = new Date(a.fecha).getTime() || 0;
        const bT = new Date(b.fecha).getTime() || 0;
        cmp = aT - bT;
      } else {
        const aN = a.row_number ?? 0;
        const bN = b.row_number ?? 0;
        cmp = aN - bN;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [orders, filterStatus, filterPayment, sortBy, sortDir]);

  const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pidiendo': return 'bg-yellow-100 text-yellow-800';
      case 'confirmado': return 'bg-teal-100 text-teal-800';
      case 'impreso': return 'bg-indigo-100 text-indigo-800';
      case 'preparando': return 'bg-blue-100 text-blue-800';
      case 'en camino': return 'bg-purple-100 text-purple-800';
      case 'entregado': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentColor = (payment: string) => {
    const p = (payment || '').toLowerCase();
    if (p.includes('confirmada')) return 'bg-green-100 text-green-800';
    if (p.includes('espera')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  // ====== CATEGORÍAS y BÚSQUEDA (Menú) ======
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      (item.categorias || []).forEach((c: string) => set.add(c));
    });
    return ['Todas', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
  }, [menuItems]);

  const visibleMenuItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return menuItems.filter((item) => {
      const inCategory =
        selectedCategory === 'Todas' ||
        (item.categorias || []).includes(selectedCategory);
      const inName =
        term === '' ||
        (item.nombre || '').toLowerCase().includes(term);
      return inCategory && inName;
    });
  }, [menuItems, selectedCategory, searchTerm]);

  const clearSearch = () => setSearchTerm('');

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-100">
          <div className="text-center mb-6">
            <Settings size={48} className="text-gold mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-gray-600">Luis Res</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/40 focus:border-gold/40"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/40 focus:border-gold/40"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gold hover:bg-gold/90 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-sm"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <Settings className="text-gold" size={32} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 truncate">Panel de Administración</h1>
                <p className="text-gray-600">Luis Res</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'menu'
                      ? 'bg-white text-gold shadow-sm border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <MenuIcon size={16} className="inline mr-2" />
                  Menú
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'orders'
                      ? 'bg-white text-gold shadow-sm border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ShoppingBag size={16} className="inline mr-2" />
                  Pedidos
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                title="Cerrar sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'menu' && (
          <div className="flex gap-6">
            {/* Sidebar categorías: FIXED en todas las pantallas, pegada a la izquierda */}
            <aside className="fixed top-24 left-0 z-20 w-28 sm:w-40 lg:w-64 h-[calc(100vh-6rem)] shrink-0">
              <div className="h-full">
                <div className="flex items-center justify-between mb-3 px-2">
                  <h3 className="text-sm font-semibold text-gray-700">Categorías</h3>
                </div>

                {/* Buscador */}
                <div className="relative mb-3 px-2">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold/40 text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
                      title="Limpiar"
                    >
                      <XIcon size={14} />
                    </button>
                  )}
                </div>

                {/* Lista vertical UNA sola columna con scroll interno */}
                <div className="rounded-xl border border-gray-200 bg-white p-2 max-h-[calc(100vh-180px)] overflow-y-auto mx-2">
                  <div className="grid grid-cols-1 gap-2">
                    {allCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`rounded-lg border text-xs md:text-sm px-2.5 py-2 transition shadow-sm hover:shadow ${
                          selectedCategory === cat
                            ? 'bg-gold text-white border-gold'
                            : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                        title={cat}
                      >
                        <span className="block truncate">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botón actualizar menú */}
                <div className="px-2">
                  <button
                    onClick={loadMenuItems}
                    className="mt-3 w-full bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 shadow-sm"
                    title="Actualizar menú"
                  >
                    <RefreshCw size={16} />
                    Actualizar
                  </button>
                </div>
              </div>
            </aside>

            {/* Contenido Menú (desplazado a la derecha del sidebar fijo) */}
            <div className="flex-1 min-w-0 ml-28 sm:ml-40 lg:ml-64">
              {/* Grid con columnas variables (mobile/md/desktop) */}
              <div className={`grid ${gridColsClass} gap-4`}>
                {visibleMenuItems.map((item) => (
                  <div
                    key={item.id as any}
                    className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1 leading-tight break-words">
                        {item.nombre}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {item.categorias?.map((categoria: string) => (
                          <span
                            key={categoria}
                            className="bg-gold/10 text-gold px-2 py-0.5 rounded-full text-[11px] font-medium border border-gold/20"
                          >
                            {categoria}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="font-bold text-gold text-lg tracking-tight">{formatPrice(item.valor)}</p>

                      <div className="flex items-center gap-2">
                        <div
                          className={`px-2 py-0.5 rounded-full text-[12px] font-medium border ${
                            item.disponible
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {item.disponible ? 'Disponible' : 'Agotado'}
                        </div>

                        {/* Switch ON/OFF */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.disponible}
                          onClick={() => updateMenuItemAvailability(item, !item.disponible)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold/40 ${
                            item.disponible ? 'bg-green-600' : 'bg-gray-300'
                          }`}
                          title={item.disponible ? 'Marcar como agotado' : 'Marcar como disponible'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              item.disponible ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {loading && (
                <div className="text-sm text-gray-500 mt-4">Cargando menú…</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="min-w-0">
            {/* Barra de filtros STICKY debajo del header (se desplaza y luego se pega naturalmente) */}
            <div className="sticky top-24 z-20 bg-white/80 backdrop-blur border-b border-gray-100">
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <h2 className="text-xl font-bold text-gray-900">Gestión de Pedidos</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm"
                    >
                      {statusOptions.map(opt => (
                        <option key={opt} value={opt}>{opt === 'todos' ? 'Todos los estados' : opt}</option>
                      ))}
                    </select>

                    <select
                      value={filterPayment}
                      onChange={(e) => setFilterPayment(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm"
                    >
                      {paymentOptions.map(opt => (
                        <option key={opt} value={opt}>{opt === 'todos' ? 'Todos los pagos' : opt}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'fecha' | 'row_number')}
                        className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm"
                      >
                        <option value="fecha">Ordenar por fecha</option>
                        <option value="row_number">Ordenar por N° de pedido</option>
                      </select>
                      <button
                        onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                        className="border border-gray-300 rounded-lg px-3 py-2 flex items-center gap-2 bg-white shadow-sm"
                        title={`Orden ${sortDir === 'asc' ? 'ascendente' : 'descendente'}`}
                      >
                        <ArrowUpDown size={16} />
                        {sortDir === 'asc' ? 'Asc' : 'Desc'}
                      </button>

                      <button
                        onClick={fetchOrders}
                        className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm"
                      >
                        <RefreshCw size={16} />
                        Actualizar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contenido de pedidos: ya no necesita padding extra porque la barra es sticky */}
            <div className="grid gap-4">
              {filteredOrders.map((order) => {
                const parsed = parseDetails(order["detalle pedido"]);
                const total = (order.valor_restaurante || 0) + (order.valor_domicilio || 0);
                const phone = cleanPhone(order.numero);
                const anchorId = `pedido-${order.row_number}`;
                const goToAnchor = (e: React.MouseEvent) => {
                  e.preventDefault();
                  document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                };
                return (
                  <div key={order.row_number} id={anchorId} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900">Pedido #{order.row_number}</h3>
                        <p className="text-sm text-gray-600">{order.fecha}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.estado)}`}>
                          {order.estado}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentColor(order.metodo_pago)}`}>
                          {order.metodo_pago}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">{order.nombre}</p>
                        <p className="text-sm">
                          <a href={`#${anchorId}`} onClick={goToAnchor} className="text-blue-600 hover:underline break-words">{phone}</a>
                        </p>
                        <p className="text-sm text-gray-600 break-words">{order.direccion}</p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 mb-2">Detalle del pedido:</p>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-200">
                          <ul className="list-disc pl-4">
                            {parsed.map(({ quantity, name, priceNum }, index) => (
                              <li key={index}>{`${quantity} ${name} - $${priceNum.toLocaleString()}`}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-bold text-gray-900">
                          TOTAL: ${total.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-600">
                          Restaurante: ${order.valor_restaurante.toLocaleString()}
                        </span>
                        {order.valor_domicilio > 0 && (
                          <span className="text-sm text-gray-600">
                            Domicilio: ${order.valor_domicilio.toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => printOrder(order)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm"
                        >
                          <Printer size={16} />
                          Imprimir
                        </button>

                        <select
                          value={order.estado}
                          onChange={(e) => updateOrderEstado(order, e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm"
                        >
                          {allowedStatuses.map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
