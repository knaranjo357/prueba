import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw, ArrowUpDown } from 'lucide-react';

/** API */
const ORDERS_API = 'https://n8n.alliasoft.com/webhook/luis-res/pedidos';

/** Tipos */
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

/** Estados permitidos */
const allowedStatuses = [
  'pidiendo',
  'confirmado',
  'impreso',
  'preparando',
  'en camino',
  'entregado',
] as const;

/** ===== Helpers POS 80 (para ESC/POS) ===== */
const COLS = 42;
const repeat = (ch: string, n: number) => Array(Math.max(0, n)).fill(ch).join('');
const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + repeat(' ', n - s.length));
const center = (s: string) => {
  const len = Math.min(s.length, COLS);
  const left = Math.floor((COLS - len) / 2);
  return repeat(' ', Math.max(0, left)) + s.slice(0, COLS);
};

/** ✔ Moneda fija en es-CO */
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
  const rawTokens = (text || '').trim().split(/\s+/).filter(Boolean);
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

/** ✔ Mantiene el precio a la derecha (para ESC/POS) */
const formatItemBlock = (qty: string, name: string, priceNum: number): string[] => {
  const price = money(priceNum);
  const qtyLabel = qty ? `${qty} ` : '';
  const rightWidth = price.length + 1; // 1 espacio
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

/** ===== ESC/POS + RawBT ===== */
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

/** ===== Tamaños (EXACTOS pedidas en fallback) ===== */
const TICKET_FONT_PX = 16;   // general
const DETAILS_FONT_PX = 18;  // items
const LINE_HEIGHT = 1.32;    // ajuste fino para evitar saltos/overflow visual

/** ESC/POS — multiplicadores (no son px; solo afectan RawBT) */
const GENERAL_HEIGHT_MULT = 1;
const DETAILS_HEIGHT_MULT = 2;
const GENERAL_WIDTH_MULT  = 1;
const DETAILS_WIDTH_MULT  = 1;

const buildEscposFromLines = (lines: string[]): number[] => {
  const bytes: number[] = [];
  bytes.push(0x1B, 0x40);       // ESC @ init
  bytes.push(0x1B, 0x74, 0x10); // ESC t 16 => CP1252
  bytes.push(0x1B, 0x61, 0x00); // left
  bytes.push(0x1D, 0x21, 0x01); // doble ALTURA
  const body = lines.join('\n') + '\n';
  bytes.push(...encodeCP1252(body));
  bytes.push(0x0A, 0x0A, 0x0A);
  bytes.push(0x1D, 0x56, 0x00); // corte
  return bytes;
};

const isAndroid = (): boolean => /Android/i.test(navigator.userAgent || '');

/** === (Dejado por compatibilidad, pero NO se usa para evitar Premium) === */
const sendHtmlToRawBT = async (_fullHtml: string): Promise<void> => {
  throw new Error('Deshabilitado para evitar requisito Premium de RawBT.');
};

const sendToRawBT = async (ticketLines: string[]): Promise<void> => {
  if (!isAndroid()) throw new Error('Esta impresión directa requiere Android con RawBT instalado.');
  const escposBytes = buildEscposFromLines(ticketLines);
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;
  try { (window as any).location.href = url; return; } catch {}
  try {
    const a = document.createElement('a');
    a.href = url; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    return;
  } catch {}
  throw new Error('No se pudo invocar RawBT. Verifica que RawBT esté instalado y el servicio de impresión activo.');
};

/** ===== ESC/POS con secciones (detalle más grande) ===== */
const makeSizeByte = (heightMul = 1, widthMul = 1): number =>
  ((Math.max(1, widthMul) - 1) << 4) | (Math.max(1, heightMul) - 1);

const buildEscposTicket = (
  normalBefore: string[],
  detailLines: string[],
  normalAfter: string[],
): number[] => {
  const bytes: number[] = [];
  const enc = (arr: string[]) => encodeCP1252(arr.join('\n') + '\n');

  // Init + codepage + alineación
  bytes.push(0x1B, 0x40);
  bytes.push(0x1B, 0x74, 0x10);  // CP1252
  bytes.push(0x1B, 0x61, 0x00);  // left

  // Tamaño general
  bytes.push(0x1D, 0x21, makeSizeByte(GENERAL_HEIGHT_MULT, GENERAL_WIDTH_MULT));
  bytes.push(...enc(normalBefore));

  // Tamaño detalles
  bytes.push(0x1D, 0x21, makeSizeByte(DETAILS_HEIGHT_MULT, DETAILS_WIDTH_MULT));
  bytes.push(...enc(detailLines));

  // Volver a tamaño general
  bytes.push(0x1D, 0x21, makeSizeByte(GENERAL_HEIGHT_MULT, GENERAL_WIDTH_MULT));
  bytes.push(...enc(normalAfter));

  // Feed + corte
  bytes.push(0x0A, 0x0A, 0x0A);
  bytes.push(0x1D, 0x56, 0x00);
  return bytes;
};

const sendToRawBTSections = async (
  normalBefore: string[],
  detailLines: string[],
  normalAfter: string[],
): Promise<void> => {
  if (!isAndroid()) throw new Error('Esta impresión directa requiere Android con RawBT instalado.');
  const escposBytes = buildEscposTicket(normalBefore, detailLines, normalAfter);
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;
  try { (window as any).location.href = url; return; } catch {}
  try {
    const a = document.createElement('a');
    a.href = url; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    return;
  } catch {}
  throw new Error('No se pudo invocar RawBT. Verifica que RawBT esté instalado y el servicio activo.');
};

/** ===== POST ampliado ===== */
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

/** ===== UI por estado ===== */
const getStatusUI = (estado?: string) => {
  const s = (estado || '').toLowerCase().trim();
  if (s === 'pidiendo') {
    return {
      card: 'bg-yellow-50 border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-800',
    };
  }
  if (s === 'confirmado') {
    return {
      card: 'bg-orange-50 border-orange-200',
      badge: 'bg-orange-100 text-orange-800',
    };
  }
  // default: verde para impreso, entregado y los demás
  return {
    card: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-800',
  };
};

/** ===== Componente ===== */
const OrdersTab: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPayment, setFilterPayment] = useState<string>('todos');

  // ✅ Por defecto ordenar por N° de pedido descendente
  const [sortBy, setSortBy] = useState<'fecha' | 'row_number'>('row_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Edición (un pedido a la vez)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editDetalle, setEditDetalle] = useState('');
  const [editValorRest, setEditValorRest] = useState(0);
  const [editValorDom, setEditValorDom] = useState(0);
  const [editMetodoPago, setEditMetodoPago] = useState('');

  // Carga inicial + auto refresh 20s
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 20000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch(ORDERS_API);
      const data = await response.json();
      if (Array.isArray(data)) setOrders(data as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  /** Entrar a editar */
  const startEdit = (o: Order) => {
    setEditingId(o.row_number);
    setEditNombre(o.nombre || '');
    setEditDireccion(o.direccion || '');
    setEditDetalle(o['detalle pedido'] || '');
    setEditValorRest(o.valor_restaurante || 0);
    setEditValorDom(o.valor_domicilio || 0);
    setEditMetodoPago(o.metodo_pago || '');
  };

  /** Cancelar edición */
  const cancelEdit = () => setEditingId(null);

  /** Guardar edición */
  const saveEdit = async (o: Order) => {
    const updated: Order = {
      ...o,
      nombre: editNombre,
      direccion: editDireccion,
      "detalle pedido": editDetalle,
      valor_restaurante: editValorRest,
      valor_domicilio: editValorDom,
      metodo_pago: editMetodoPago,
    };
    // Optimista
    setOrders(prev => prev.map(x => x.row_number === o.row_number ? updated : x));
    try {
      await postOrderFull(o, {
        nombre: editNombre,
        direccion: editDireccion,
        "detalle pedido": editDetalle,
        valor_restaurante: editValorRest,
        valor_domicilio: editValorDom,
        metodo_pago: editMetodoPago,
      });
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar los cambios.');
      fetchOrders();
      setEditingId(null);
    }
  };

  /** Auto-cálculo valor_restaurante cuando cambia detalle */
  useEffect(() => {
    if (editingId === null) return;
    const sum = parseDetails(editDetalle).reduce((acc, it) => acc + (it.priceNum || 0), 0);
    setEditValorRest(sum);
  }, [editDetalle, editingId]);

  /** Actualizar solo estado, pero con payload completo */
  const updateOrderEstado = async (order: Order, newStatus: string) => {
    const updated = { ...order, estado: newStatus };
    setOrders(prev => prev.map(o => (o.row_number === order.row_number ? updated : o)));
    try {
      await postOrderFull(order, { estado: newStatus });
    } catch (error) {
      console.error('Error updating order status:', error);
      setOrders(prev => prev.map(o => (o.row_number === order.row_number ? order : o)));
      alert('No se pudo actualizar el estado. Intenta nuevamente.');
    }
  };

  /** Impresión y marcar impreso SIN RawBT Premium (solo ESC/POS en Android) */
  const printOrder = async (order: Order) => {
    const customerName = sanitizeForTicket(order.nombre || 'Cliente');
    const customerPhone = cleanPhone(order.numero);
    const items = parseDetails(order["detalle pedido"]);
    const subtotal = order.valor_restaurante || 0;
    const domicilio = order.valor_domicilio || 0;
    const total = subtotal + domicilio;

    // --- ESC/POS: se construyen líneas monoespaciadas ---
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

    // ===== ANDROID -> SOLO ESC/POS (gratis) =====
    if (isAndroid()) {
      try {
        // 1) ESC/POS con secciones (detalles más grandes)
        await sendToRawBTSections(before, detail, after);

        const updated = { ...order, estado: 'impreso' };
        setOrders(prev => prev.map(o => (o.row_number === order.row_number ? updated : o)));
        await postOrderFull(order, { estado: 'impreso' });
        return;
      } catch (e1) {
        console.warn('ESC/POS secciones falló, probando ESC/POS simple:', (e1 as any)?.message);
      }

      try {
        // 2) Fallback: ESC/POS simple (mismo layout monoespaciado)
        const allLines = [...before, ...detail, ...after];
        await sendToRawBT(allLines);

        const updated = { ...order, estado: 'impreso' };
        setOrders(prev => prev.map(o => (o.row_number === order.row_number ? updated : o)));
        await postOrderFull(order, { estado: 'impreso' });
        return;
      } catch (e2) {
        console.warn('ESC/POS simple falló, usando ventana del navegador:', (e2 as any)?.message);
        // si llega aquí, intentamos PC como último recurso
      }
    }

    // ===== PC / Último recurso: HTML en ventana (como ya lo tenías) =====
    const esc = (s: string) =>
      (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

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
          <div class="kv"><span class="k">Fecha</span><span class="v">${esc(order.fecha || '')}</span></div>
          <div class="kv"><span class="k">Cliente</span><span class="v">${esc(customerName)}</span></div>
          <div class="kv"><span class="k">Teléfono</span><span class="v">${esc(customerPhone)}</span></div>
          <div class="kv"><span class="k">Dirección</span><span class="v">${esc(order.direccion || '')}</span></div>
        </div>

        <div class="hr"></div>

        <div class="section-title">DETALLE DEL PEDIDO</div>

        <div class="items">
          ${itemsHtml}
        </div>

        <div class="hr"></div>

        <div class="totals">
          <div class="row"><span>Subtotal</span><span class="val">${esc(money(subtotal))}</span></div>
          <div class="row"><span>Domicilio</span><span class="val">${esc(money(domicilio))}</span></div>
          <div class="row strong"><span>TOTAL</span><span class="val">${esc(money(total))}</span></div>
        </div>

        <div class="extra">
          <div class="kv"><span class="k">Método de pago</span><span class="v">${esc(order.metodo_pago || '')}</span></div>
          <div class="kv"><span class="k">Estado</span><span class="v">${esc(order.estado || '')}</span></div>
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
            .ticket { width: 72mm; margin: 0; padding: 2mm; }

            :root {
              --fs-general: ${TICKET_FONT_PX}px;
              --fs-items: ${DETAILS_FONT_PX}px;
              --lh: ${LINE_HEIGHT};
            }

            .hr { border-top: 1px solid #000; margin: 2mm 0; }

            .header { text-align: center; line-height: var(--lh); }
            .header .h1 { font-size: var(--fs-items); font-weight: 700; }
            .header .h2 { font-size: var(--fs-general); }

            .meta, .extra {
              display: grid;
              row-gap: 1mm;
              font-size: var(--fs-general);
              line-height: var(--lh);
            }
            .kv {
              display: grid;
              grid-template-columns: auto 1fr;
              column-gap: 2mm;
              align-items: baseline;
            }
            .kv .k { white-space: nowrap; font-weight: 600; }
            .kv .v { overflow-wrap: anywhere; word-break: break-word; }

            .section-title {
              text-align: center;
              font-size: var(--fs-items);
              font-weight: 600;
              line-height: var(--lh);
              margin: 1mm 0;
            }

            .items {
              display: grid;
              row-gap: 1mm;
              font-size: var(--fs-items);
              line-height: var(--lh);
            }
            .row.item {
              display: grid;
              grid-template-columns: auto 1fr min-content;
              column-gap: 2mm;
              align-items: start;
            }
            .qty { white-space: nowrap; }
            .name { overflow-wrap: anywhere; word-break: break-word; }
            .price { white-space: nowrap; text-align: right; }

            .totals {
              display: grid;
              row-gap: 1mm;
              font-size: var(--fs-general);
              line-height: var(--lh);
            }
            .totals .row {
              display: grid;
              grid-template-columns: 1fr min-content;
              column-gap: 2mm;
              align-items: baseline;
            }
            .totals .row .val { white-space: nowrap; text-align: right; }
            .totals .row.strong { font-weight: 800; }

            .footer {
              text-align: center;
              font-size: var(--fs-general);
              line-height: var(--lh);
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          ${innerHtml}
          <script>
            try {
              window.onload = function() {
                if (typeof window.print === 'function') {
                  window.print();
                  setTimeout(function() { window.close(); }, 600);
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
      } catch (e) {
        console.error('No se pudo marcar como impreso en fallback:', e);
      }
    }
  };

  /** Filtros/orden */
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

  return (
    <div className="min-w-0">
      {/* Barra de filtros sticky */}
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

      {/* Cards de pedidos */}
      <div className="grid gap-4">
        {filteredOrders.map((order) => {
          const parsed = parseDetails(order["detalle pedido"]);
          const total = (order.valor_restaurante || 0) + (order.valor_domicilio || 0);
          const phone = cleanPhone(order.numero);
          const isEditing = editingId === order.row_number;
          const anchorId = `pedido-${order.row_number}`;
          const ui = getStatusUI(order.estado);

          return (
            <div
              key={order.row_number}
              id={anchorId}
              className={`rounded-lg shadow-sm border p-4 ${ui.card}`}
            >
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900">Pedido #{order.row_number}</h3>
                  <p className="text-sm text-gray-600">{order.fecha}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${ui.badge}`}>
                    {order.estado}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {order.metodo_pago}
                  </span>

                  {!isEditing ? (
                    <button
                      onClick={() => startEdit(order)}
                      className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm"
                    >
                      Editar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => saveEdit(order)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium shadow-sm"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="min-w-0">
                  {!isEditing ? (
                    <>
                      <p className="font-medium text-gray-900 break-words">{order.nombre}</p>
                      {/* WhatsApp directo */}
                      <p className="text-sm">
                        <a
                          href={`https://wa.me/${encodeURIComponent(phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-words"
                          title="Abrir chat de WhatsApp"
                        >
                          {phone}
                        </a>
                      </p>
                      <p className="text-sm text-gray-600 break-words">{order.direccion}</p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Número (no editable)</label>
                        <input
                          value={phone}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Nombre</label>
                        <input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Dirección</label>
                        <textarea
                          value={editDireccion}
                          onChange={(e) => setEditDireccion(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  {!isEditing ? (
                    <>
                      <p className="text-sm text-gray-600 mb-2">Detalle del pedido:</p>

                      {/* ✔ Grid con precio alineado a la derecha */}
                      <div className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-200">
                        <div className="grid grid-cols-12 gap-x-2">
                          {parsed.map(({ quantity, name, priceNum }, index) => (
                            <React.Fragment key={index}>
                              <div className="col-span-2 whitespace-nowrap">{quantity}</div>
                              <div className="col-span-7 break-words">{name}</div>
                              <div className="col-span-3 text-right tabular-nums">
                                ${priceNum.toLocaleString('es-CO')}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm text-gray-600 mb-2">Detalle del pedido (auto-recalcula restaurante)</label>
                      <textarea
                        value={editDetalle}
                        onChange={(e) => setEditDetalle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={4}
                        placeholder="Ej: 2, Bandeja Paisa, 28000; 1, Limonada, 6000"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Suma automática: <strong>${editValorRest.toLocaleString('es-CO')}</strong>
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  {!isEditing ? (
                    <>
                      <span className="font-bold text-gray-900">
                        TOTAL: ${total.toLocaleString('es-CO')}
                      </span>
                      <span className="text-sm text-gray-600">
                        Restaurante: ${order.valor_restaurante.toLocaleString('es-CO')}
                      </span>
                      {order.valor_domicilio > 0 && (
                        <span className="text-sm text-gray-600">
                          Domicilio: ${order.valor_domicilio.toLocaleString('es-CO')}
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Valor restaurante (auto)</label>
                        <input
                          type="number"
                          value={editValorRest}
                          onChange={(e) => setEditValorRest(parseInt(e.target.value || '0', 10))}
                          className="w-40 px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Valor domicilio</label>
                        <input
                          type="number"
                          value={editValorDom}
                          onChange={(e) => setEditValorDom(parseInt(e.target.value || '0', 10))}
                          className="w-40 px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Método de pago</label>
                        <input
                          value={editMetodoPago}
                          onChange={(e) => setEditMetodoPago(e.target.value)}
                          className="w-48 px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Efectivo / Transferencia / ..."
                        />
                      </div>
                    </div>
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

                  {/* Estado editable, POST manda payload completo */}
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
  );
};

export default OrdersTab;
