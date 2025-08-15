import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings,
  Printer,
  RefreshCw,
  LogOut,
  Menu as MenuIcon,
  ShoppingBag,
  ArrowUpDown
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
  "detalle pedido": string; // <- llave con espacio según tu API
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  estado: string;
}

type MenuItemWithRow = MenuItem & { row_number?: number };

const ORDERS_API = 'https://n8n.alliasoft.com/webhook/luis-res/pedidos';
const MENU_API = 'https://n8n.alliasoft.com/webhook/luis-res/menu';

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

// Envuelve texto a un ancho fijo, respetando palabras; parte palabras muy largas.
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

// Campo "Etiqueta: valor" con wrap e indentación del valor
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

// Línea "Etiqueta .... $valor" con el monto alineado a la derecha
const totalLine = (label: string, amount: number): string => {
  const right = money(amount);
  const leftWidth = COLS - right.length - 1; // 1 espacio separador
  return padRight(label, leftWidth) + ' ' + right;
};

// Ítem con precio a la derecha y nombre envuelto a la izquierda
const formatItemBlock = (qty: string, name: string, priceNum: number): string[] => {
  const price = money(priceNum);
  const qtyLabel = qty ? `${qty} ` : '';
  const rightWidth = price.length + 1; // espacio + precio
  const leftWidth = COLS - rightWidth;

  const leftText = (qtyLabel + (name || '')).trim();
  const leftLines = wrapText(leftText, leftWidth);

  const out: string[] = [];
  // Primera línea con precio a la derecha
  const firstLeft = padRight(leftLines[0] || '', leftWidth);
  out.push(firstLeft + ' ' + price);

  // Siguientes líneas sin precio, alineadas bajo el nombre (se indenta el espacio del qty)
  const indent = repeat(' ', qtyLabel.length || 0);
  for (let i = 1; i < leftLines.length; i++) {
    out.push(padRight(indent + leftLines[i], COLS));
  }
  return out;
};

/* =========================
   ESC/POS + RawBT Helpers
   ========================= */

// Convierte string (UTF-8) a bytes
const utf8ToBytes = (str: string): number[] => {
  const encoder = new TextEncoder(); // soporta acentos/ñ
  return Array.from(encoder.encode(str));
};

// Base64 seguro para binario
const bytesToBase64 = (bytes: number[]): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa espera Latin1; como ya es binario, sirve
  return btoa(binary);
};

// Construye payload ESC/POS a partir de líneas de texto monoespaciado
const buildEscposFromLines = (lines: string[]): number[] => {
  const bytes: number[] = [];

  // Init
  bytes.push(0x1B, 0x40); // ESC @

  // Alineación izquierda por defecto
  bytes.push(0x1B, 0x61, 0x00); // ESC a 0

  // Texto + saltos de línea
  const body = lines.join('\n') + '\n';
  bytes.push(...utf8ToBytes(body));

  // Feed extra antes de corte
  bytes.push(0x0A, 0x0A, 0x0A);

  // Corte completo (GS V 0)
  bytes.push(0x1D, 0x56, 0x00);

  return bytes;
};

// Detecta si es Android (para lanzar esquema rawbt)
const isAndroid = (): boolean =>
  /Android/i.test(navigator.userAgent || '');

// Envía a RawBT usando el esquema rawbt:base64,<payload>
// Si no es Android, opcionalmente puedes hacer fallback a window.print()
const sendToRawBT = async (ticketLines: string[]): Promise<void> => {
  if (!isAndroid()) {
    throw new Error('Esta impresión directa requiere Android con RawBT instalado.');
  }

  const escposBytes = buildEscposFromLines(ticketLines);
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;

  // Múltiples estrategias para invocar el esquema
  try {
    window.location.href = url;
    return;
  } catch {
    // ignore
  }

  try {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  } catch {
    // ignore
  }

  throw new Error('No se pudo invocar RawBT. Verifica que RawBT esté instalado y el servicio de impresión activo.');
};

const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
  const [menuItems, setMenuItems] = useState<MenuItemWithRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPayment, setFilterPayment] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'fecha' | 'row_number'>('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Mantener sesión si ya inició previamente
  useEffect(() => {
    const saved = localStorage.getItem('admin_auth');
    if (saved === '1') {
      setIsAuthenticated(true);
      loadMenuItems();
      fetchOrders();
    }
  }, []);

  // Auto refresh orders every 20 seconds
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
      loadMenuItems();
      fetchOrders();
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

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const items = await fetchMenuItems();
      setMenuItems(
        (items as MenuItemWithRow[]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      );
    } catch (error) {
      console.error('Error loading menu items:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // --- MENU: toggle disponibilidad con POST ---
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

    // Optimista: aplica cambio y revierte si falla
    setMenuItems(prev => prev.map(i => (i.id === item.id ? { ...i, disponible: nuevoValor } : i)));
    try {
      await postAvailability(payload);
    } catch (err) {
      console.error(err);
      // revertir
      setMenuItems(prev => prev.map(i => (i.id === item.id ? { ...i, disponible: !nuevoValor } : i)));
      alert('No se pudo guardar el cambio. Intenta de nuevo.');
    }
  };

  const updateOrderStatus = async (orderNumber: number, newStatus: string) => {
    try {
      const response = await fetch(ORDERS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          row_number: orderNumber,
          estado: newStatus,
        }),
      });

      if (response.ok) {
        setOrders(prev => prev.map(order => (order.row_number === orderNumber ? { ...order, estado: newStatus } : order)));
      }
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const parseDetails = (raw: string) => {
    return raw
      .split(';')
      .filter(item => item.trim())
      .map(item => {
        const parts = item.trim().split(',');
        if (parts.length >= 3) {
          const quantity = parts[0].replace('-', '').trim();
          const name = parts[1].trim();
          const priceNum = parseInt(parts[2].replace(/[^0-9]/g, ''), 10) || 0;
          return { quantity, name, priceNum };
        }
        return { quantity: '', name: item.trim(), priceNum: 0 };
      });
  };

  // ====== IMPRESIÓN DIRECTA: RawBT en Android (sin preview) ======
  const printOrder = async (order: Order) => {
    const customerName = order.nombre || 'Cliente';
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
    lines.push(...wrapLabelValue('Fecha', order.fecha || ''));
    lines.push(...wrapLabelValue('Cliente', customerName));
    lines.push(...wrapLabelValue('Teléfono', customerPhone));
    lines.push(...wrapLabelValue('Dirección', order.direccion || ''));

    lines.push(repeat('-', COLS));
    lines.push(center('DETALLE DEL PEDIDO'));
    lines.push(repeat('-', COLS));

    items.forEach(({ quantity, name, priceNum }) => {
      const block = formatItemBlock(quantity || '1', name, priceNum);
      block.forEach(l => lines.push(l));
    });

    lines.push(repeat('-', COLS));
    lines.push(totalLine('Subtotal', subtotal));
    lines.push(totalLine('Domicilio', domicilio));
    lines.push(totalLine('TOTAL', total));
    lines.push('');
    lines.push(...wrapLabelValue('Método de pago', order.metodo_pago || ''));
    lines.push(...wrapLabelValue('Estado', order.estado || ''));
    lines.push(repeat('=', COLS));
    lines.push(center('¡Gracias por su compra!'));
    lines.push(repeat('=', COLS));

    // → Android + RawBT: enviar sin preview
    try {
      await sendToRawBT(lines);
      updateOrderStatus(order.row_number, 'impreso');
      return;
    } catch (err: any) {
      // Si no es Android o RawBT no está disponible, hacemos fallback opcional
      console.warn('RawBT directo no disponible, usando fallback de impresión de navegador:', err?.message);
    }

    // ====== Fallback (PC / no Android): ventana de impresión del navegador ======
    const html = `
      <div>
        <pre>${lines.join(String.fromCharCode(10))}</pre>
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
      updateOrderStatus(order.row_number, 'impreso');
    }
  };

  // Opciones dinámicas de filtros basadas en los datos actuales
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
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      case 'preparando': return 'bg-blue-100 text-blue-800';
      case 'listo': return 'bg-green-100 text-green-800';
      case 'en camino': return 'bg-purple-100 text-purple-800';
      case 'entregado': return 'bg-gray-100 text-gray-800';
      case 'impreso': return 'bg-indigo-100 text-indigo-800';
      case 'confirmado': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentColor = (payment: string) => {
    const p = (payment || '').toLowerCase();
    if (p.includes('confirmada')) return 'bg-green-100 text-green-800';
    if (p.includes('espera')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold/50"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold/50"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-gold hover:bg-gold/90 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Settings className="text-gold" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
                <p className="text-gray-600">Luis Res</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'menu' 
                      ? 'bg-white text-gold shadow-sm' 
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
                      ? 'bg-white text-gold shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ShoppingBag size={16} className="inline mr-2" />
                  Pedidos
                </button>
              </div>
              
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 p-2"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'menu' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Gestión de Menú</h2>
              <button
                onClick={loadMenuItems}
                className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
            </div>

            <div className="grid gap-4">
              {menuItems.map((item) => (
                <div key={item.id as any} className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{item.nombre}</h3>
                      <p className="text-sm text-gray-600 mb-2">{item.descripcion}</p>
                      <div className="flex items-center gap-2 mb-2">
                        {item.categorias?.map((categoria: string) => (
                          <span
                            key={categoria}
                            className="bg-gold/20 text-gold px-2 py-1 rounded-full text-xs font-medium"
                          >
                            {categoria}
                          </span>
                        ))}
                      </div>
                      <p className="font-bold text-gold">{formatPrice(item.valor)}</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        item.disponible 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.disponible ? 'Disponible' : 'Agotado'}
                      </div>

                      {/* Switch ON/OFF */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.disponible}
                        onClick={() => updateMenuItemAvailability(item, !item.disponible)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold/50 ${
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
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900">Gestión de Pedidos</h2>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                >
                  {statusOptions.map(opt => (
                    <option key={opt} value={opt}>{opt === 'todos' ? 'Todos los estados' : opt}</option>
                  ))}
                </select>
                
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                >
                  {paymentOptions.map(opt => (
                    <option key={opt} value={opt}>{opt === 'todos' ? 'Todos los pagos' : opt}</option>
                  ))}
                </select>

                {/* Ordenamiento */}
                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'fecha' | 'row_number')}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="fecha">Ordenar por fecha</option>
                    <option value="row_number">Ordenar por N° de pedido</option>
                  </select>
                  <button
                    onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="border border-gray-300 rounded-lg px-3 py-2 flex items-center gap-2"
                    title={`Orden ${sortDir === 'asc' ? 'ascendente' : 'descendente'}`}
                  >
                    <ArrowUpDown size={16} />
                    {sortDir === 'asc' ? 'Asc' : 'Desc'}
                  </button>
                </div>
                
                <button
                  onClick={fetchOrders}
                  className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  Actualizar
                </button>
              </div>
            </div>

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
                  <div key={order.row_number} id={anchorId} className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-gray-900">Pedido #{order.row_number}</h3>
                        <p className="text-sm text-gray-600">{order.fecha}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.estado)}`}>
                          {order.estado}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentColor(order.metodo_pago)}`}>
                          {order.metodo_pago}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="font-medium text-gray-900">{order.nombre}</p>
                        <p className="text-sm">
                          <a href={`#${anchorId}`} onClick={goToAnchor} className="text-blue-600 hover:underline">{phone}</a>
                        </p>
                        <p className="text-sm text-gray-600">{order.direccion}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Detalle del pedido:</p>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm">
                          <ul className="list-disc pl-4">
                            {parsed.map(({ quantity, name, priceNum }, index) => (
                              <li key={index}>{`${quantity} ${name} - $${priceNum.toLocaleString()}`}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
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
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2"
                        >
                          <Printer size={16} />
                          Imprimir
                        </button>
                        
                        <select
                          value={order.estado}
                          onChange={(e) => updateOrderStatus(order.row_number, e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2"
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="preparando">Preparando</option>
                          <option value="listo">Listo</option>
                          <option value="en camino">En camino</option>
                          <option value="entregado">Entregado</option>
                          <option value="impreso">Impreso</option>
                          <option value="confirmado">Confirmado</option>
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
