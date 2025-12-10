import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ArrowUpDown } from 'lucide-react';
import TarjetaPedido, { Order, CartItem, MenuItem } from './TarjetaPedido';

/** API ENDPOINTS */
const ORDERS_API = 'https://n8n.alliasoft.com/webhook/luis-res/pedidos';
const MENU_API = 'https://n8n.alliasoft.com/webhook/luis-res/menu';

/** ===== HELPERS DE IMPRESION (CORREGIDOS) ===== */
const COLS = 42;
const repeat = (ch: string, n: number) => Array(Math.max(0, n)).fill(ch).join('');
const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + repeat(' ', n - s.length));
const center = (s: string) => {
  const len = Math.min(s.length, COLS);
  const left = Math.floor((COLS - len) / 2);
  return repeat(' ', Math.max(0, left)) + s.slice(0, COLS);
};

const money = (n: number) => `$${(n || 0).toLocaleString('es-CO')}`;

// CORRECCIÓN 1: Convertir a String explícitamente para evitar error con números de teléfono
const cleanPhone = (raw: any) => String(raw || '').replace('@s.whatsapp.net', '').replace(/[^0-9+]/g, '');

// CORRECCIÓN 2: Convertir a String antes de usar replace para evitar error con direcciones numéricas (ej: 12016)
const sanitizeForTicket = (s: any): string =>
  String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').replace(/[^\S\n]+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

// CORRECCIÓN 3: Asegurar que wrapText reciba string
const wrapText = (text: any, width: number): string[] => {
  const str = String(text || '');
  if (width <= 0) return [str];
  const rawTokens = str.trim().split(/\s+/).filter(Boolean);
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

// Helpers de Parseo de detalles para Impresión
const parseMoneyToInt = (s: string | number): number => {
  const n = parseInt(String(s || '').replace(/[^0-9\-]/g, ''), 10);
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
  for (let i = 1; i < leftLines.length; i++) out.push(padRight(indent + leftLines[i], COLS));
  return out;
};

// ESC/POS Encoders
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
    if (basic.length === 1 && basic.charCodeAt(0) <= 0x7F) { bytes.push(basic.charCodeAt(0)); continue; }
    if (asciiFallback[ch]) { for (const c of asciiFallback[ch]) bytes.push(c.charCodeAt(0)); continue; }
    bytes.push(0x3F);
  }
  return bytes;
};
const isAndroid = (): boolean => /Android/i.test(navigator.userAgent || '');
const buildEscposFromLines = (lines: string[]): number[] => {
  const bytes: number[] = [];
  bytes.push(0x1B, 0x40); bytes.push(0x1B, 0x74, 0x10); bytes.push(0x1B, 0x61, 0x00); bytes.push(0x1D, 0x21, 0x01);
  const body = lines.join('\n') + '\n';
  bytes.push(...encodeCP1252(body));
  bytes.push(0x0A, 0x0A, 0x0A); bytes.push(0x1D, 0x56, 0x00);
  return bytes;
};
const sendToRawBT = async (ticketLines: string[]): Promise<void> => {
  if (!isAndroid()) throw new Error('Requiere Android con RawBT.');
  const escposBytes = buildEscposFromLines(ticketLines);
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;
  try { (window as any).location.href = url; return; } catch {}
  try { const a = document.createElement('a'); a.href = url; a.rel = 'noopener noreferrer'; document.body.appendChild(a); a.click(); document.body.removeChild(a); return; } catch {}
  throw new Error('No se pudo invocar RawBT.');
};

// Helper para transformar Carrito de Edición a String
const serializeCartToDetails = (items: CartItem[]): string => {
  return items
    .map(i => `- ${i.quantity}, ${i.name}, ${i.quantity * i.priceUnit}`)
    .join('; ');
};

const parseDetailsToCart = (raw: string): CartItem[] => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [';', '|']).map(x => x.trim()).filter(Boolean);
  return itemStrings.map(itemStr => {
    const parts = splitByCommaOutsideParens(itemStr).map(x => x.trim());
    let quantity = 1;
    let name = '';
    let priceTotal = 0;
    if (parts.length >= 3) {
      quantity = parseInt(parts[0].replace(/^-/, ''), 10) || 1;
      name = parts.slice(1, parts.length - 1).join(', ').trim();
      priceTotal = parseInt(parts[parts.length - 1], 10) || 0;
    } else if (parts.length === 2) {
      quantity = 1; 
      name = parts[0];
      priceTotal = parseInt(parts[1], 10) || 0;
    } else {
      name = parts[0] || 'Item';
    }
    const priceUnit = quantity > 0 ? Math.round(priceTotal / quantity) : 0;
    return { name, quantity, priceUnit };
  });
};

/** ===== API POST ===== */
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

const OrdersTab: React.FC = () => {
  // Estado General
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPayment, setFilterPayment] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'fecha' | 'row_number'>('row_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Estado Edición
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editValorRest, setEditValorRest] = useState(0);
  const [editValorDom, setEditValorDom] = useState(0);
  const [editMetodoPago, setEditMetodoPago] = useState('');
  
  // Carrito y Menú
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCat, setMenuCat] = useState('Todas');

  // Carga de Datos
  useEffect(() => {
    fetchOrders();
    fetchMenu();
    const interval = setInterval(fetchOrders, 20000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch(ORDERS_API);
      const data = await response.json();
      if (Array.isArray(data)) setOrders(data as Order[]);
    } catch (error) { console.error('Error fetching orders:', error); }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch(MENU_API);
      const data = await res.json();
      if (Array.isArray(data)) setMenuItems(data.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)));
    } catch (e) { console.error('Error menu', e); }
  };

  // Filtros Menú
  const filteredMenu = useMemo(() => {
    return menuItems.filter(item => {
      const matchSearch = item.nombre.toLowerCase().includes(menuSearch.toLowerCase());
      const matchCat = menuCat === 'Todas' || item.categorias.includes(menuCat);
      return matchSearch && matchCat;
    });
  }, [menuItems, menuSearch, menuCat]);

  const categories = useMemo(() => {
    const s = new Set<string>(['Todas']);
    menuItems.forEach(i => i.categorias.forEach(c => s.add(c)));
    return Array.from(s).sort();
  }, [menuItems]);

  // Funciones de Edición
  const startEdit = (o: Order) => {
    setEditingId(o.row_number);
    setEditNombre(o.nombre || '');
    setEditDireccion(o.direccion || '');
    setCartItems(parseDetailsToCart(o["detalle pedido"] || ''));
    setEditValorRest(o.valor_restaurante || 0);
    setEditValorDom(o.valor_domicilio || 0);
    setEditMetodoPago(o.metodo_pago || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCartItems([]);
  };

  const addItemToCart = (menuItem: MenuItem) => {
    setCartItems(prev => {
      const exists = prev.find(i => i.name === menuItem.nombre);
      if (exists) return prev.map(i => i.name === menuItem.nombre ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { name: menuItem.nombre, quantity: 1, priceUnit: menuItem.valor }];
    });
  };

  const decreaseItem = (index: number) => {
    setCartItems(prev => {
      const item = prev[index];
      if (item.quantity > 1) {
        const copy = [...prev];
        copy[index] = { ...item, quantity: item.quantity - 1 };
        return copy;
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  useEffect(() => {
    if (editingId !== null) {
      const total = cartItems.reduce((sum, item) => sum + (item.quantity * item.priceUnit), 0);
      setEditValorRest(total);
    }
  }, [cartItems, editingId]);

  const saveEdit = async (o: Order) => {
    const detailString = serializeCartToDetails(cartItems);
    const updated: Order = { ...o, nombre: editNombre, direccion: editDireccion, "detalle pedido": detailString, valor_restaurante: editValorRest, valor_domicilio: editValorDom, metodo_pago: editMetodoPago };
    setOrders(prev => prev.map(x => x.row_number === o.row_number ? updated : x));
    setEditingId(null);
    try {
      await postOrderFull(o, { nombre: editNombre, direccion: editDireccion, "detalle pedido": detailString, valor_restaurante: editValorRest, valor_domicilio: editValorDom, metodo_pago: editMetodoPago });
    } catch (e) { console.error(e); alert('No se pudo guardar los cambios.'); fetchOrders(); }
  };

  const updateOrderEstado = async (order: Order, newStatus: string) => {
    const updated = { ...order, estado: newStatus };
    setOrders(prev => prev.map(o => (o.row_number === order.row_number ? updated : o)));
    try { await postOrderFull(order, { estado: newStatus }); } catch (error) {
      console.error('Error status:', error);
      setOrders(prev => prev.map(o => (o.row_number === order.row_number ? order : o)));
      alert('No se pudo actualizar el estado.');
    }
  };

  // LOGICA DE IMPRESION HIBRIDA (Android=RawBT, Desktop=Window.print)
  const printOrder = async (order: Order) => {
    const customerName = sanitizeForTicket(order.nombre || 'Cliente');
    const customerPhone = cleanPhone(order.numero);
    const items = parseDetails(order["detalle pedido"]);
    const subtotal = order.valor_restaurante || 0;
    const domicilio = order.valor_domicilio || 0;
    const total = subtotal + domicilio;

    const before: string[] = [];
    const detail: string[] = [];
    const after:  string[] = [];

    before.push(repeat('=', COLS));
    before.push(center('LUIS RES'));
    before.push(center('Cra 37 #109-24'));
    before.push(center('Floridablanca - Caldas'));
    before.push(repeat('=', COLS));
    before.push(padRight(`PEDIDO #${order.row_number}`, COLS));
    before.push(...wrapLabelValue('Fecha', sanitizeForTicket(order.fecha || '')));
    before.push(...wrapLabelValue('Cliente', customerName));
    before.push(...wrapLabelValue('Teléfono', customerPhone));
    before.push(...wrapLabelValue('Dirección', sanitizeForTicket(order.direccion || '')));
    before.push(repeat('-', COLS));

    detail.push(center('DETALLE DEL PEDIDO'));
    detail.push(repeat('-', COLS));
    items.forEach(({ quantity, name, priceNum }) => {
      const block = formatItemBlock(quantity || '1', sanitizeForTicket(name), priceNum);
      block.forEach(l => detail.push(l));
    });
    detail.push(repeat('-', COLS));

    after.push(totalLine('Subtotal', subtotal));
    after.push(totalLine('Domicilio', domicilio));
    after.push(totalLine('TOTAL', total));
    after.push('');
    after.push(...wrapLabelValue('Método de pago', sanitizeForTicket(order.metodo_pago || '')));
    after.push(...wrapLabelValue('Estado', sanitizeForTicket(order.estado || '')));
    after.push(repeat('=', COLS));
    after.push(center('¡Gracias por su compra!'));
    after.push(repeat('=', COLS));

    // === 1. MODO ANDROID (RawBT) ===
    if (isAndroid()) {
      try {
        const allLines = [...before, ...detail, ...after];
        await sendToRawBT(allLines);
        
        // Si funcionó, actualizar estado
        const updated = { ...order, estado: 'impreso' };
        setOrders(prev => prev.map(o => (o.row_number === order.row_number ? updated : o)));
        await postOrderFull(order, { estado: 'impreso' });
        return;
      } catch (e) {
        console.warn("RawBT falló o no disponible, intentando fallback", e);
      }
    }

    // === 2. MODO ESCRITORIO (Window.print) ===
    const esc = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const TICKET_FONT_PX = 16;
    const DETAILS_FONT_PX = 18;
    const LINE_HEIGHT = 1.32;

    const itemsHtml = items.map(({ quantity, name, priceNum }) => `
      <div class="row item">
        <div class="qty">${esc(quantity || '1')}</div>
        <div class="name">${esc(sanitizeForTicket(name))}</div>
        <div class="price">${esc(money(priceNum))}</div>
      </div>
    `).join('');

    const innerHtml = `
      <div class="ticket">
        <div class="header">
          <div class="h1">LUIS RES</div>
          <div class="h2">Cra 37 #109-24</div>
          <div class="h2">Floridablanca - Caldas</div>
        </div>
        <div class="hr"></div>
        <div class="meta">
          <div class="kv"><span class="k">PEDIDO</span><span class="v">#${order.row_number}</span></div>
          <div class="kv"><span class="k">Fecha</span><span class="v">${esc(sanitizeForTicket(order.fecha))}</span></div>
          <div class="kv"><span class="k">Cliente</span><span class="v">${esc(customerName)}</span></div>
          <div class="kv"><span class="k">Teléfono</span><span class="v">${esc(customerPhone)}</span></div>
          <div class="kv"><span class="k">Dirección</span><span class="v">${esc(sanitizeForTicket(order.direccion))}</span></div>
        </div>
        <div class="hr"></div>
        <div class="section-title">DETALLE DEL PEDIDO</div>
        <div class="items">${itemsHtml}</div>
        <div class="hr"></div>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span class="val">${esc(money(subtotal))}</span></div>
          <div class="row"><span>Domicilio</span><span class="val">${esc(money(domicilio))}</span></div>
          <div class="row strong"><span>TOTAL</span><span class="val">${esc(money(total))}</span></div>
        </div>
        <div class="extra">
          <div class="kv"><span class="k">Método de pago</span><span class="v">${esc(sanitizeForTicket(order.metodo_pago))}</span></div>
          <div class="kv"><span class="k">Estado</span><span class="v">${esc(sanitizeForTicket(order.estado))}</span></div>
        </div>
        <div class="hr"></div>
        <div class="footer">¡Gracias por su compra!</div>
      </div>
    `;

    const fullHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Factura #${order.row_number}</title>
          <style>
            @media print { @page { size: 80mm auto; margin: 0; } }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body {
              font-family: "Courier New", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
              font-variant-numeric: tabular-nums;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .ticket { width: 72mm; margin: 0 auto; padding: 2mm; }
            :root { --fs-general: ${TICKET_FONT_PX}px; --fs-items: ${DETAILS_FONT_PX}px; --lh: ${LINE_HEIGHT}; }
            .hr { border-top: 1px solid #000; margin: 2mm 0; }
            .header { text-align: center; line-height: var(--lh); }
            .header .h1 { font-size: var(--fs-items); font-weight: 700; }
            .header .h2 { font-size: var(--fs-general); }
            .meta, .extra { display: grid; row-gap: 1mm; font-size: var(--fs-general); line-height: var(--lh); }
            .kv { display: grid; grid-template-columns: auto 1fr; column-gap: 2mm; align-items: baseline; }
            .kv .k { white-space: nowrap; font-weight: 600; }
            .kv .v { overflow-wrap: anywhere; word-break: break-word; }
            .section-title { text-align: center; font-size: var(--fs-items); font-weight: 600; line-height: var(--lh); margin: 1mm 0; }
            .items { display: grid; row-gap: 1mm; font-size: var(--fs-items); line-height: var(--lh); }
            .row.item { display: grid; grid-template-columns: auto 1fr min-content; column-gap: 2mm; align-items: start; }
            .qty { white-space: nowrap; }
            .name { overflow-wrap: anywhere; word-break: break-word; }
            .price { white-space: nowrap; text-align: right; }
            .totals { display: grid; row-gap: 1mm; font-size: var(--fs-general); line-height: var(--lh); }
            .totals .row { display: grid; grid-template-columns: 1fr min-content; column-gap: 2mm; align-items: baseline; }
            .totals .row .val { white-space: nowrap; text-align: right; }
            .totals .row.strong { font-weight: 800; }
            .footer { text-align: center; font-size: var(--fs-general); line-height: var(--lh); font-weight: 600; }
          </style>
        </head>
        <body>
          ${innerHtml}
          <script>
            try {
              window.onload = function() {
                if (typeof window.print === 'function') {
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
                }
              }
            } catch (e) {}
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=380,height=700');
    if (printWindow) {
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      try {
        const updated = { ...order, estado: 'impreso' };
        setOrders(prev => prev.map(o => (o.row_number === order.row_number ? updated : o)));
        await postOrderFull(order, { estado: 'impreso' });
      } catch (e) {}
    }
  };

  // Ordenamiento y Filtros
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
    return [...byFilters].sort((a, b) => {
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
  }, [orders, filterStatus, filterPayment, sortBy, sortDir]);

  return (
    <div className="min-w-0">
      {/* Barra de filtros sticky */}
      <div className="sticky top-0 md:top-24 z-20 bg-white/80 backdrop-blur border-b border-gray-100 shadow-sm px-4 py-4 mb-6 -mx-4 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Gestión de Pedidos
            <span className="bg-gray-100 text-gray-600 text-sm px-2.5 py-0.5 rounded-full">{filteredOrders.length}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm text-sm outline-none">
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt === 'todos' ? 'Todos los estados' : opt}</option>)}
            </select>
            <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm text-sm outline-none">
              {paymentOptions.map(opt => <option key={opt} value={opt}>{opt === 'todos' ? 'Todos los pagos' : opt}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))} className="border border-gray-300 rounded-lg px-3 py-2 flex items-center gap-2 bg-white shadow-sm hover:bg-gray-50 text-sm">
                <ArrowUpDown size={16} /> {sortDir === 'asc' ? 'Asc' : 'Desc'}
              </button>
              <button onClick={fetchOrders} className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm text-sm transition-colors">
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredOrders.map((order) => (
          <TarjetaPedido
            key={order.row_number}
            order={order}
            isEditing={editingId === order.row_number}
            // State Edicion
            editNombre={editNombre} setEditNombre={setEditNombre}
            editDireccion={editDireccion} setEditDireccion={setEditDireccion}
            editValorRest={editValorRest}
            editValorDom={editValorDom} setEditValorDom={setEditValorDom}
            editMetodoPago={editMetodoPago} setEditMetodoPago={setEditMetodoPago}
            cartItems={cartItems} setCartItems={setCartItems}
            // Menú y Filtros
            menuSearch={menuSearch} setMenuSearch={setMenuSearch}
            menuCat={menuCat} setMenuCat={setMenuCat}
            filteredMenu={filteredMenu} categories={categories}
            addItemToCart={addItemToCart} decreaseItem={decreaseItem}
            // Acciones
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onStartEdit={startEdit}
            onPrint={printOrder}
            onStatusChange={updateOrderEstado}
          />
        ))}
      </div>
    </div>
  );
};

export default OrdersTab;