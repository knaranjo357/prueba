// src/pages/Manual.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Filter,
  Utensils,
  Package,
  PlusCircle,
  Minus,
  Plus,
  Trash2,
  Save,
  Printer,
  User,
  Phone,
  MapPin,
  CreditCard,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
  ReceiptText,
} from "lucide-react";

import { formatPrice } from "../utils/dateUtils"; // ajusta si tu ruta es distinta

/** ENDPOINTS */
const MENU_FULL_API = "https://n8n.alliasoft.com/webhook/luis-res/menu-completo";
const MAKE_ORDER_API = "https://n8n.alliasoft.com/webhook/luis-res/hacer-pedido";
const MANUAL_ORDERS_API = "https://n8n.alliasoft.com/webhook/luisres/pedidos/manual";

/** TIPOS */
type MenuItemFull = {
  row_number?: number;
  id: number | string;
  disponible: boolean;
  nombre: string;
  descripcion?: string;
  precio_adicional_llevar?: number;
  servicios?: string[];
  categorias: string[];
  para_llevar?: boolean;
  valor: number;
};

type CartItem = {
  id: string;
  name: string;
  quantity: number;
  baseValor: number; // valor base (mesa)
  extraLlevar: number; // adicional llevar (si aplica)
  priceUnit: number; // base + (isTakeaway? extra : 0)
  notes: string;
};

type ManualOrder = {
  row_number: number;
  fecha: string; // "2025-11-20 18:59:00"
  nombre: string;
  numero: string;
  direccion: string;
  detalle_pedido?: string;
  "detalle pedido"?: string;
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  estado: string;
};

/** ===== helpers ===== */
const pad2 = (n: number) => String(n).padStart(2, "0");
const makeNumeroFallback = () => {
  const d = new Date();
  return `p_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
};
const toInt = (v: any) => {
  const n = parseInt(String(v ?? "").replace(/[^0-9\-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const normalizeNote = (s: string) => {
  const raw = (s || "").trim();
  if (!raw) return "";
  return raw.replace(/^\(+/, "").replace(/\)+$/, "").trim();
};

const computeUnitPrice = (item: MenuItemFull, isTakeaway: boolean) => {
  const base = Number(item.valor) || 0;
  const extra =
    isTakeaway && item.para_llevar ? Number(item.precio_adicional_llevar) || 0 : 0;
  return base + extra;
};

const groupBaseNameForPiquete = (name: string) => {
  return (name || "").replace(/(\d{2,3}[.,]?\d{3})|\d{4,}$/g, "").trim();
};

const splitOutsideParens = (s: string, separators = [";"]) => {
  const sepSet = new Set(separators);
  const out: string[] = [];
  let buf = "";
  let depth = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);

    if (depth === 0 && sepSet.has(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};

const splitByCommaOutsideParens = (s: string) => splitOutsideParens(s, [","]);

const parseDetailsForView = (raw: string) => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [";", "|"])
    .map((x) => x.trim())
    .filter(Boolean);

  return itemStrings.map((itemStr) => {
    const parts = splitByCommaOutsideParens(itemStr).map((x) => x.trim());

    let quantity = 1;
    let name = "";
    let priceTotal = 0;

    if (parts.length >= 3) {
      quantity = parseInt(parts[0].replace(/^-/, ""), 10) || 1;
      name = parts.slice(1, parts.length - 1).join(", ").trim();
      priceTotal = toInt(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      quantity = 1;
      name = parts[0];
      priceTotal = toInt(parts[1]);
    } else {
      name = parts[0] || "Item";
      priceTotal = 0;
    }

    return { quantity, name, priceTotal };
  });
};

/** Serializa EXACTO: "- qty,nombre (nota) ,totalLinea;" */
const serializeCartToDetalle = (items: CartItem[]) => {
  return items
    .map((i) => {
      const note = normalizeNote(i.notes);
      const nameWithNote = note ? `${i.name} (${note})` : i.name;
      const lineTotal = (Number(i.priceUnit) || 0) * (Number(i.quantity) || 0);
      return `- ${i.quantity},${nameWithNote} ,${lineTotal};`;
    })
    .join("\n");
};

/** ===== ticket helpers (mismos de antes) ===== */
const COLS = 42;
const repeat = (ch: string, n: number) => Array(Math.max(0, n)).fill(ch).join("");
const padRight = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + repeat(" ", n - s.length));
const center = (s: string) => {
  const len = Math.min(s.length, COLS);
  const left = Math.floor((COLS - len) / 2);
  return repeat(" ", Math.max(0, left)) + s.slice(0, COLS);
};
const money = (n: number) => `$${(n || 0).toLocaleString("es-CO")}`;

const sanitizeForTicket = (s: any): string =>
  String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

const wrapText = (text: any, width: number): string[] => {
  const str = String(text || "");
  if (width <= 0) return [str];
  const rawTokens = str.trim().split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (const t of rawTokens) {
    if (t.length <= width) tokens.push(t);
    else for (let i = 0; i < t.length; i += width) tokens.push(t.slice(i, i + width));
  }
  const lines: string[] = [];
  let line = "";
  for (const tok of tokens) {
    if (!line.length) line = tok;
    else if ((line + " " + tok).length <= width) line += " " + tok;
    else {
      lines.push(line);
      line = tok;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

const wrapLabelValue = (label: string, value: string): string[] => {
  const prefix = `${label}: `;
  const valueWidth = Math.max(0, COLS - prefix.length);
  const vLines = wrapText(value || "", valueWidth);
  const out: string[] = [];
  out.push(padRight(prefix + (vLines[0] || ""), COLS));
  const indent = repeat(" ", prefix.length);
  for (let i = 1; i < vLines.length; i++) out.push(padRight(indent + vLines[i], COLS));
  return out;
};

const parseMoneyToInt = (s: string | number): number => {
  const n = parseInt(String(s || "").replace(/[^0-9\-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
};

const parseDetailsForPrint = (raw: string) => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [";", "|"])
    .map((x) => x.trim())
    .filter(Boolean);

  return itemStrings.map((itemStr) => {
    const parts = splitByCommaOutsideParens(itemStr).map((x) => x.trim());
    let quantity = "1";
    let name = "";
    let priceNum = 0;

    if (parts.length >= 3) {
      quantity = parts[0].replace(/^-/, "").trim() || "1";
      name = parts.slice(1, parts.length - 1).join(", ").trim();
      priceNum = parseMoneyToInt(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      quantity = "1";
      name = parts[0];
      priceNum = parseMoneyToInt(parts[1]);
    } else {
      quantity = "1";
      name = parts[0] || "";
      priceNum = 0;
    }
    const qMatch = quantity.match(/-?\d+/);
    if (qMatch) quantity = String(Math.abs(parseInt(qMatch[0], 10)));
    return { quantity, name, priceNum };
  });
};

const formatItemBlock = (qty: string, name: string, priceNum: number): string[] => {
  const price = money(priceNum);
  const qtyLabel = qty ? `${qty} ` : "";
  const rightWidth = price.length + 1;
  const leftWidth = COLS - rightWidth;
  const leftText = (qtyLabel + (name || "")).trim();
  const leftLines = wrapText(leftText, leftWidth);
  const out: string[] = [];
  const firstLeft = padRight(leftLines[0] || "", leftWidth);
  out.push(firstLeft + " " + price);
  const indent = repeat(" ", qtyLabel.length || 0);
  for (let i = 1; i < leftLines.length; i++) out.push(padRight(indent + leftLines[i], COLS));
  return out;
};

// RawBT encoder
const bytesToBase64 = (bytes: number[]): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
const cp1252Map: Record<string, number> = {
  Á: 0xc1, É: 0xc9, Í: 0xcd, Ó: 0xd3, Ú: 0xda, Ü: 0xdc, Ñ: 0xd1,
  á: 0xe1, é: 0xe9, í: 0xed, ó: 0xf3, ú: 0xfa, ü: 0xfc, ñ: 0xf1,
  "€": 0x80, "£": 0xa3, "¥": 0xa5, "¢": 0xa2, "°": 0xb0, "¿": 0xbf, "¡": 0xa1,
  "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92, "—": 0x97, "–": 0x96, "…": 0x85,
};
const asciiFallback: Record<string, string> = {
  "“": '"', "”": '"', "‘": "'", "’": "'", "—": "-", "–": "-", "…": "...", "€": "EUR",
};
const encodeCP1252 = (str: string): number[] => {
  const bytes: number[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x7f) { bytes.push(code); continue; }
    if (cp1252Map[ch] !== undefined) { bytes.push(cp1252Map[ch]); continue; }
    const basic = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (basic.length === 1 && basic.charCodeAt(0) <= 0x7f) { bytes.push(basic.charCodeAt(0)); continue; }
    if (asciiFallback[ch]) { for (const c of asciiFallback[ch]) bytes.push(c.charCodeAt(0)); continue; }
    bytes.push(0x3f);
  }
  return bytes;
};
const isAndroid = () => /Android/i.test(navigator.userAgent || "");
const buildEscposFromLines = (lines: string[]): number[] => {
  const bytes: number[] = [];
  bytes.push(0x1b, 0x40);
  bytes.push(0x1b, 0x74, 0x10);
  bytes.push(0x1b, 0x61, 0x00);
  bytes.push(0x1d, 0x21, 0x01);
  const body = lines.join("\n") + "\n";
  bytes.push(...encodeCP1252(body));
  bytes.push(0x0a, 0x0a, 0x0a);
  bytes.push(0x1d, 0x56, 0x00);
  return bytes;
};
const sendToRawBT = async (ticketLines: string[]) => {
  if (!isAndroid()) throw new Error("Requiere Android con RawBT.");
  const escposBytes = buildEscposFromLines(ticketLines);
  const base64 = bytesToBase64(escposBytes);
  const url = `rawbt:base64,${base64}`;
  try { (window as any).location.href = url; return; } catch {}
  try {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  } catch {}
  throw new Error("No se pudo invocar RawBT.");
};

const printTicket = async (order: ManualOrder) => {
  const detalle = order.detalle_pedido ?? order["detalle pedido"] ?? "";
  const items = parseDetailsForPrint(detalle);

  const subtotal = order.valor_restaurante || 0;
  const domicilio = order.valor_domicilio || 0;
  const total = subtotal + domicilio;

  const before: string[] = [];
  const detailLines: string[] = [];
  const after: string[] = [];

  before.push(repeat("=", COLS));
  before.push(center("LUIS RES"));
  before.push(center("Cra 37 #109-24"));
  before.push(center("Floridablanca - Caldas"));
  before.push(repeat("=", COLS));
  before.push(padRight(`PEDIDO #${order.row_number ?? ""}`, COLS));
  before.push(...wrapLabelValue("Fecha", sanitizeForTicket(order.fecha || "")));
  before.push(...wrapLabelValue("Cliente", sanitizeForTicket(order.nombre || "Cliente")));
  before.push(...wrapLabelValue("Teléfono", sanitizeForTicket(order.numero || "")));
  before.push(...wrapLabelValue("Dirección", sanitizeForTicket(order.direccion || "")));
  before.push(repeat("-", COLS));

  detailLines.push(center("DETALLE DEL PEDIDO"));
  detailLines.push(repeat("-", COLS));
  items.forEach(({ quantity, name, priceNum }) => {
    formatItemBlock(quantity || "1", sanitizeForTicket(name), priceNum).forEach((l) => detailLines.push(l));
  });
  detailLines.push(repeat("-", COLS));

  const totalLine = (label: string, amount: number) => {
    const right = money(amount);
    const leftWidth = COLS - right.length - 1;
    return padRight(label, leftWidth) + " " + right;
  };

  after.push(totalLine("Subtotal", subtotal));
  after.push(totalLine("Domicilio", domicilio));
  after.push(totalLine("TOTAL", total));
  after.push("");
  after.push(...wrapLabelValue("Método de pago", sanitizeForTicket(order.metodo_pago || "")));
  after.push(...wrapLabelValue("Estado", sanitizeForTicket(order.estado || "")));
  after.push(repeat("=", COLS));
  after.push(center("¡Gracias por su compra!"));
  after.push(repeat("=", COLS));

  if (isAndroid()) {
    await sendToRawBT([...before, ...detailLines, ...after]);
    return;
  }

  // Desktop print simple (igual al anterior, simplificado)
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const itemsHtml = items
    .map(
      ({ quantity, name, priceNum }) => `
        <div style="display:grid;grid-template-columns:auto 1fr auto;gap:8px;font-size:16px;">
          <div><b>${esc(quantity || "1")}x</b></div>
          <div>${esc(sanitizeForTicket(name))}</div>
          <div style="text-align:right;white-space:nowrap;"><b>${esc(money(priceNum))}</b></div>
        </div>
      `
    )
    .join("");

  const html = `
  <!doctype html>
  <html><head><meta charset="utf-8"/>
  <style>
    @media print { @page { size: 80mm auto; margin: 0; } }
    body{font-family:Courier New,monospace;margin:0;padding:0}
    .t{width:72mm;margin:0 auto;padding:8px}
    .c{text-align:center}
    .hr{border-top:1px solid #000;margin:8px 0}
  </style>
  </head>
  <body>
    <div class="t">
      <div class="c"><div style="font-size:18px;font-weight:900">LUIS RES</div>
      <div>Cra 37 #109-24</div><div>Floridablanca - Caldas</div></div>
      <div class="hr"></div>
      <div><b>Pedido:</b> #${esc(String(order.row_number ?? ""))}</div>
      <div><b>Fecha:</b> ${esc(order.fecha || "")}</div>
      <div><b>Cliente:</b> ${esc(order.nombre || "Cliente")}</div>
      <div><b>Tel:</b> ${esc(order.numero || "")}</div>
      <div><b>Dir:</b> ${esc(order.direccion || "")}</div>
      <div class="hr"></div>
      <div class="c" style="font-weight:900">DETALLE</div>
      <div style="display:grid;gap:6px">${itemsHtml}</div>
      <div class="hr"></div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
        <div>Subtotal</div><div><b>${esc(money(subtotal))}</b></div>
        <div>Domicilio</div><div><b>${esc(money(domicilio))}</b></div>
        <div style="font-weight:900">TOTAL</div><div style="font-weight:900">${esc(money(total))}</div>
      </div>
      <div class="hr"></div>
      <div class="c" style="font-weight:900">¡Gracias por su compra!</div>
    </div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),400)}</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=380,height=700");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
};

/** ===== micro toast ===== */
type Toast = { type: "success" | "error" | "info"; msg: string } | null;

const toastStyle = (t: Toast) => {
  if (!t) return "";
  if (t.type === "success") return "bg-emerald-600";
  if (t.type === "error") return "bg-rose-600";
  return "bg-slate-800";
};

/** ===== COMPONENTE ===== */
const Manual: React.FC = () => {
  // modo
  const [isTakeaway, setIsTakeaway] = useState(false);

  // menu
  const [menuItems, setMenuItems] = useState<MenuItemFull[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // carrito
  const [cart, setCart] = useState<CartItem[]>([]);

  // datos pedido (NO obligatorios)
  const [nombre, setNombre] = useState("");
  const [numero, setNumero] = useState("");
  const [direccion, setDireccion] = useState("");
  const [valorDomicilio, setValorDomicilio] = useState(0);
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");
  const [estado, setEstado] = useState<"pidiendo" | "impreso">("pidiendo");

  // pedidos drawer
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [manualOrders, setManualOrders] = useState<ManualOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState("");

  // toast
  const [toast, setToast] = useState<Toast>(null);
  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 1800);
  };

  /** fetch menu */
  const fetchMenu = async () => {
    setLoadingMenu(true);
    try {
      const res = await fetch(MENU_FULL_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MenuItemFull[];
      const clean = Array.isArray(data) ? data : [];
      clean.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
      setMenuItems(clean);
    } catch (e) {
      console.error("menu error", e);
      showToast({ type: "error", msg: "No se pudo cargar el menú." });
    } finally {
      setLoadingMenu(false);
    }
  };

  /** fetch orders */
  const fetchManualOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(MANUAL_ORDERS_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ManualOrder[];
      const arr = Array.isArray(data) ? data : [];
      arr.sort((a, b) => (b.row_number ?? 0) - (a.row_number ?? 0));
      setManualOrders(arr);
    } catch (e) {
      console.error("orders error", e);
      showToast({ type: "error", msg: "No se pudieron cargar pedidos." });
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    // NO abrimos pedidos por defecto
  }, []);

  /** categorías */
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((it) => (it.categorias || []).forEach((c) => set.add(c)));
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "es"))];
  }, [menuItems]);

  /** menu filtrado */
  const filteredMenuItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return menuItems.filter((item) => {
      const inSearch = !term || (item.nombre || "").toLowerCase().includes(term);
      const inCat =
        selectedCategory === "Todas" || (item.categorias || []).includes(selectedCategory);
      return inSearch && inCat;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  /** grouping */
  type GroupType = "almuerzo" | "piquete" | "single";
  type MenuGroup = { id: string; type: GroupType; title: string; items: MenuItemFull[] };

  const groupedMenu = useMemo(() => {
    const groups: MenuGroup[] = [];
    const processed = new Set<string>();

    const almuerzos = filteredMenuItems.filter((i) =>
      (i.nombre || "").toLowerCase().startsWith("almuerzo")
    );
    if (almuerzos.length) {
      groups.push({
        id: "grp-almuerzos",
        type: "almuerzo",
        title: "Almuerzos del Día",
        items: almuerzos,
      });
      almuerzos.forEach((i) => processed.add(String(i.id)));
    }

    const piquetes = filteredMenuItems.filter(
      (i) => (i.nombre || "").toLowerCase().startsWith("piquete") && !processed.has(String(i.id))
    );

    const piqueteGroups: Record<string, MenuItemFull[]> = {};
    piquetes.forEach((item) => {
      const base = groupBaseNameForPiquete(item.nombre);
      if (!piqueteGroups[base]) piqueteGroups[base] = [];
      piqueteGroups[base].push(item);
      processed.add(String(item.id));
    });

    Object.entries(piqueteGroups).forEach(([base, variants]) => {
      variants.sort((a, b) => (Number(a.valor) || 0) - (Number(b.valor) || 0));
      groups.push({ id: `grp-${base}`, type: "piquete", title: base, items: variants });
    });

    filteredMenuItems.forEach((item) => {
      if (!processed.has(String(item.id))) {
        groups.push({ id: String(item.id), type: "single", title: item.nombre, items: [item] });
      }
    });

    return groups;
  }, [filteredMenuItems]);

  /** id->menu */
  const menuById = useMemo(() => {
    const m = new Map<string, MenuItemFull>();
    menuItems.forEach((it) => m.set(String(it.id), it));
    return m;
  }, [menuItems]);

  /** recalc prices when mode changes */
  useEffect(() => {
    setCart((prev) =>
      prev.map((ci) => {
        const mi = menuById.get(ci.id);
        const base = mi ? Number(mi.valor) || 0 : ci.baseValor;
        const extra = mi && mi.para_llevar ? Number(mi.precio_adicional_llevar) || 0 : ci.extraLlevar;
        const priceUnit = base + (isTakeaway ? extra : 0);
        return { ...ci, baseValor: base, extraLlevar: extra, priceUnit };
      })
    );
    if (!isTakeaway) setValorDomicilio(0);
  }, [isTakeaway, menuById]);

  /** totals */
  const totalRestaurante = useMemo(() => {
    return cart.reduce((acc, it) => acc + (Number(it.priceUnit) || 0) * (Number(it.quantity) || 0), 0);
  }, [cart]);

  const totalFinal = useMemo(() => {
    return totalRestaurante + (isTakeaway ? (Number(valorDomicilio) || 0) : 0);
  }, [totalRestaurante, valorDomicilio, isTakeaway]);

  /** cart ops */
  const addToCart = (item: MenuItemFull) => {
    if (!item.disponible) return;
    const id = String(item.id);
    const baseValor = Number(item.valor) || 0;
    const extra = item.para_llevar ? Number(item.precio_adicional_llevar) || 0 : 0;
    const priceUnit = baseValor + (isTakeaway ? extra : 0);

    setCart((prev) => {
      const exists = prev.find((x) => x.id === id);
      if (exists) return prev.map((x) => (x.id === id ? { ...x, quantity: x.quantity + 1 } : x));
      return [...prev, { id, name: item.nombre, quantity: 1, baseValor, extraLlevar: extra, priceUnit, notes: "" }];
    });
  };

  const inc = (id: string) => setCart((p) => p.map((x) => (x.id === id ? { ...x, quantity: x.quantity + 1 } : x)));
  const dec = (id: string) =>
    setCart((p) => p.map((x) => (x.id === id ? { ...x, quantity: x.quantity - 1 } : x)).filter((x) => x.quantity > 0));
  const remove = (id: string) => setCart((p) => p.filter((x) => x.id !== id));
  const setNote = (id: string, note: string) => setCart((p) => p.map((x) => (x.id === id ? { ...x, notes: note } : x)));
  const clearAll = () => setCart([]);

  const toggleGroup = (id: string) => setExpanded((p) => ({ ...p, [id]: !(p[id] ?? true) }));

  /** open orders drawer */
  const openOrders = async () => {
    setOrdersOpen(true);
    // lazy load cuando abre
    if (!manualOrders.length) await fetchManualOrders();
  };

  /** save order: SOLO exige que haya detalle (items) */
  const saveOrder = async (opts: { print: boolean }) => {
    if (!cart.length || totalRestaurante <= 0) {
      showToast({ type: "info", msg: "Agrega productos para guardar." });
      return;
    }

    const numeroFinal = (numero.trim() || makeNumeroFallback()).trim();
    const nombreFinal = nombre.trim() || "Cliente";
    const direccionFinal = direccion.trim() || (isTakeaway ? "PARA LLEVAR" : "MESA");
    const detalle = serializeCartToDetalle(cart);
    const domicilio = isTakeaway ? (Number(valorDomicilio) || 0) : 0;

    const payload: any = {
      nombre: nombreFinal,
      direccion: direccionFinal,
      "detalle pedido": detalle,
      valor_restaurante: totalRestaurante,
      valor_domicilio: domicilio,
      metodo_pago: metodoPago,
      estado: opts.print ? "impreso" : estado,
      // extra (si tu n8n lo usa, perfecto; si no, normalmente no molesta)
      numero: numeroFinal,
    };

    try {
      const res = await fetch(MAKE_ORDER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      showToast({ type: "success", msg: opts.print ? "Guardado e imprimiendo…" : "Pedido guardado." });

      // limpiar
      clearAll();
      setNombre("");
      setNumero("");
      setDireccion("");
      setValorDomicilio(0);
      setMetodoPago("efectivo");
      setEstado("pidiendo");

      // refrescar list (si está abierto, actualiza; si no, lo dejamos quieto)
      if (ordersOpen) await fetchManualOrders();

      if (opts.print) {
        // tomamos el más reciente por row_number
        try {
          const rr = await fetch(MANUAL_ORDERS_API);
          const dd = (await rr.json()) as ManualOrder[];
          const arr = Array.isArray(dd) ? dd : [];
          arr.sort((a, b) => (b.row_number ?? 0) - (a.row_number ?? 0));
          const latest = arr[0];
          if (latest) await printTicket(latest);
        } catch {
          // fallback mínimo
          await printTicket({
            row_number: 0,
            fecha: new Date().toISOString(),
            nombre: nombreFinal,
            numero: numeroFinal,
            direccion: direccionFinal,
            detalle_pedido: detalle,
            valor_restaurante: totalRestaurante,
            valor_domicilio: domicilio,
            metodo_pago: metodoPago,
            estado: "impreso",
          });
        }
      }
    } catch (e) {
      console.error(e);
      showToast({ type: "error", msg: "No se pudo guardar el pedido." });
    }
  };

  /** drawer filter */
  const filteredOrders = useMemo(() => {
    const term = ordersSearch.trim().toLowerCase();
    if (!term) return manualOrders;
    return manualOrders.filter((o) => {
      const a = (o.nombre || "").toLowerCase();
      const b = (o.direccion || "").toLowerCase();
      const c = String(o.numero || "").toLowerCase();
      return a.includes(term) || b.includes(term) || c.includes(term);
    });
  }, [manualOrders, ordersSearch]);

  /** Preview detalle (UX: ayuda a confiar) */
  const detallePreview = useMemo(() => {
    const raw = serializeCartToDetalle(cart);
    const parsed = parseDetailsForView(raw);
    return { raw, parsed };
  }, [cart]);

  return (
    <div className="relative flex h-[calc(100vh-60px)] bg-slate-50 overflow-hidden">
      {/* TOAST */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90]">
          <div className={`${toastStyle(toast)} text-white px-4 py-2 rounded-xl shadow-xl text-sm font-bold`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Sidebar categorías (desktop) */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
              <Filter size={18} className="text-amber-600" /> Categorías
            </h3>
            <button
              onClick={fetchMenu}
              className={`p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 ${loadingMenu ? "animate-spin" : ""}`}
              title="Recargar menú"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Tip: usa el buscador y toca los productos para agregarlos.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                selectedCategory === cat
                  ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="truncate">{cat}</span>
              {selectedCategory === cat && <span className="w-2 h-2 rounded-full bg-amber-500" />}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={openOrders}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-950 flex items-center justify-center gap-2"
          >
            <ReceiptText size={16} /> Pedidos
          </button>
        </div>
      </aside>

      {/* Centro: menú */}
      <section className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
        {/* Header suave */}
        <div className="bg-white p-3 border-b border-slate-200 shrink-0">
          <div className="flex flex-col xl:flex-row gap-3 justify-between items-center">
            {/* buscador */}
            <div className="flex items-center gap-2 w-full xl:w-2/3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar (almuerzo, piquete, sopa, mojarra...)"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/40 outline-none text-sm"
                />
              </div>

              <button
                onClick={openOrders}
                className="lg:hidden px-3 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold flex items-center gap-2"
                title="Pedidos"
              >
                <ReceiptText size={16} /> Pedidos
              </button>

              <button
                onClick={fetchMenu}
                className={`p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 border border-slate-200 ${loadingMenu ? "animate-spin" : ""}`}
                title="Recargar"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {/* switch mesa / llevar */}
            <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 w-full xl:w-auto">
              <button
                onClick={() => setIsTakeaway(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
                  !isTakeaway ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <Utensils size={16} /> Mesa
              </button>
              <button
                onClick={() => setIsTakeaway(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
                  isTakeaway ? "bg-amber-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <Package size={16} /> Llevar
              </button>
            </div>
          </div>

          {/* categorías mobile */}
          <div className="lg:hidden mt-3 overflow-x-auto pb-1 flex gap-2 scrollbar-hide">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
                  selectedCategory === cat
                    ? "bg-amber-500 text-white border-amber-600"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* menú grid */}
        <div className="flex-1 overflow-y-auto p-3 bg-slate-50">
          {loadingMenu ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-2" />
              <p className="text-sm font-semibold">Cargando menú...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {groupedMenu.map((group) => {
                // PIQUETES
                if (group.type === "piquete") {
                  return (
                    <div
                      key={group.id}
                      className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100">
                        <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{group.title}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">Toca el tamaño para agregar</p>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        {group.items.map((item) => {
                          const unit = computeUnitPrice(item, isTakeaway);
                          const disabled = !item.disponible;
                          return (
                            <button
                              key={String(item.id)}
                              onClick={() => addToCart(item)}
                              disabled={disabled}
                              className={`rounded-2xl border px-3 py-3 text-left active:scale-[0.98] transition-all ${
                                disabled
                                  ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                                  : "bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50"
                              }`}
                            >
                              <div className="text-base font-black text-slate-900">
                                {formatPrice(unit).replace(",00", "")}
                              </div>
                              {isTakeaway && item.para_llevar && (item.precio_adicional_llevar || 0) > 0 && (
                                <div className="text-[10px] font-extrabold text-amber-700 mt-1">
                                  +{formatPrice(item.precio_adicional_llevar || 0)} llevar
                                </div>
                              )}
                              {!item.disponible && (
                                <div className="text-[10px] font-extrabold uppercase mt-1">Agotado</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // ALMUERZOS
                if (group.type === "almuerzo") {
                  const isOpen = expanded[group.id] ?? true;
                  return (
                    <div key={group.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm sm:col-span-2 xl:col-span-3 overflow-hidden">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex justify-between items-center px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="bg-white border border-slate-200 text-slate-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            {group.items.length}
                          </span>
                          <h3 className="font-extrabold text-slate-900 text-sm">{group.title}</h3>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                      </button>

                      {isOpen && (
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                          {group.items.map((item) => {
                            const unit = computeUnitPrice(item, isTakeaway);
                            const disabled = !item.disponible;
                            return (
                              <button
                                key={String(item.id)}
                                onClick={() => addToCart(item)}
                                disabled={disabled}
                                className={`rounded-2xl border px-3 py-3 active:scale-[0.98] transition-all text-left ${
                                  disabled
                                    ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                                    : "bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-extrabold text-slate-900 truncate">
                                    {(item.nombre || "").replace(/^Almuerzo (con )?/i, "")}
                                  </div>
                                  <PlusCircle size={18} className={disabled ? "text-slate-200" : "text-amber-500"} />
                                </div>
                                <div className="mt-1 text-xs font-black text-slate-900">{formatPrice(unit)}</div>
                                {isTakeaway && item.para_llevar && (item.precio_adicional_llevar || 0) > 0 && (
                                  <div className="text-[10px] font-extrabold text-amber-700 mt-1">
                                    +{formatPrice(item.precio_adicional_llevar || 0)} llevar
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // SINGLE
                const item = group.items[0];
                const unit = computeUnitPrice(item, isTakeaway);
                const disabled = !item.disponible;

                return (
                  <button
                    key={group.id}
                    onClick={() => addToCart(item)}
                    disabled={disabled}
                    className={`bg-white rounded-2xl border shadow-sm p-4 text-left active:scale-[0.99] transition-all ${
                      disabled
                        ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
                        : "border-slate-200 hover:border-amber-300 hover:shadow-md"
                    }`}
                  >
                    <div className="font-extrabold text-slate-900 text-sm leading-snug">{item.nombre}</div>
                    {item.descripcion ? (
                      <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{item.descripcion}</div>
                    ) : (
                      <div className="text-[11px] text-slate-400 mt-1">—</div>
                    )}
                    <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
                      <div>
                        <div className="text-xs text-slate-500 font-semibold">Precio</div>
                        <div className="text-lg font-black text-slate-900">{formatPrice(unit)}</div>
                      </div>
                      <PlusCircle size={22} className={disabled ? "text-slate-200" : "text-amber-500"} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Derecha: caja */}
      <aside className="w-80 xl:w-96 bg-white border-l border-slate-200 flex flex-col shrink-0">
        {/* header caja (ya no negro) */}
        <div className="p-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isTakeaway ? "bg-amber-500" : "bg-emerald-500"}`} />
                <h2 className="font-extrabold text-slate-900">Pedido manual</h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {isTakeaway ? "Para llevar: suma automáticamente el adicional." : "Mesa: usa el valor base."}
              </p>
            </div>

            <button
              onClick={openOrders}
              className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-950"
              title="Ver pedidos"
            >
              <ReceiptText size={16} /> Pedidos
            </button>
          </div>

          {/* datos (opcionales) */}
          <div className="mt-4 grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <User size={14} className="text-slate-400 mr-2" />
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre (opcional)"
                  className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                />
              </div>
              <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <Phone size={14} className="text-slate-400 mr-2" />
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Número (opcional)"
                  className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
              <MapPin size={14} className="text-slate-400 mr-2" />
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder={isTakeaway ? "Dirección (opcional)" : "Mesa / lugar (opcional)"}
                className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* chips pago/estado */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <CreditCard size={14} className="text-slate-400 mr-2" />
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as any)}
                  className="bg-transparent text-sm w-full outline-none text-slate-800 appearance-none cursor-pointer"
                >
                  <option value="efectivo">efectivo</option>
                  <option value="transferencia">transferencia</option>
                </select>
              </div>

              <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
                <span className="text-[10px] font-extrabold text-slate-500 mr-2">Estado</span>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as any)}
                  className="bg-transparent text-sm w-full outline-none text-slate-800 appearance-none cursor-pointer"
                >
                  <option value="pidiendo">pidiendo</option>
                  <option value="impreso">impreso</option>
                </select>
              </div>
            </div>

            {isTakeaway && (
              <div className="flex items-center bg-amber-50 rounded-xl px-3 py-2 border border-amber-200">
                <span className="text-[10px] font-extrabold text-amber-800 mr-2">Domicilio</span>
                <input
                  type="number"
                  value={valorDomicilio}
                  onChange={(e) => setValorDomicilio(toInt(e.target.value))}
                  placeholder="0"
                  className="bg-transparent text-sm w-full outline-none text-slate-900 placeholder-amber-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* carrito */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Package size={32} />
              <p className="text-sm font-semibold">Sin productos</p>
              <p className="text-[11px] text-slate-400">Agrega desde el menú.</p>
            </div>
          ) : (
            <>
              {cart.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900 text-sm break-words leading-tight">{item.name}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {formatPrice(item.priceUnit)} c/u
                        {isTakeaway && item.extraLlevar > 0 && (
                          <span className="ml-2 text-amber-700 font-extrabold">
                            (+{formatPrice(item.extraLlevar)})
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(item.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Quitar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <div className="flex items-center bg-slate-100 rounded-xl h-9 border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => dec(item.id)}
                        className="w-10 h-full flex items-center justify-center hover:bg-slate-200 text-slate-600"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-10 text-center font-black text-sm text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => inc(item.id)}
                        className="w-10 h-full flex items-center justify-center hover:bg-slate-200 text-slate-600"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-semibold">Línea</div>
                      <div className="font-black text-slate-900">{formatPrice(item.quantity * item.priceUnit)}</div>
                    </div>
                  </div>

                  <div className="mt-3 relative">
                    <MessageSquare size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      value={item.notes}
                      onChange={(e) => setNote(item.id, e.target.value)}
                      placeholder="Nota (ej: sin ensalada, con ají)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm focus:ring-2 focus:ring-amber-500/40 outline-none text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              ))}

              {/* preview detalle (muy útil para UX) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3">
                <div className="text-xs font-extrabold text-slate-900 mb-2">Detalle que se enviará</div>
                <pre className="text-[11px] text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
{detallePreview.raw || "(vacío)"}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* footer total + acciones */}
        <div className="bg-white border-t border-slate-200 p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">Restaurante</div>
              <div className="text-xl font-black text-slate-900">{formatPrice(totalRestaurante)}</div>
            </div>
            {isTakeaway && (
              <div className="text-right">
                <div className="text-[11px] text-slate-500 font-semibold">Domicilio</div>
                <div className="text-lg font-black text-slate-900">{formatPrice(valorDomicilio || 0)}</div>
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-between items-center border-t border-slate-100 pt-3">
            <div className="text-sm font-extrabold text-slate-700">Total</div>
            <div className="text-2xl font-black text-slate-900">{formatPrice(totalFinal)}</div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={clearAll}
              className="py-3 rounded-2xl bg-slate-100 text-slate-700 font-extrabold hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center justify-center"
              title="Limpiar"
            >
              <Trash2 size={18} />
            </button>

            <button
              onClick={() => saveOrder({ print: false })}
              className="py-3 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-950 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} /> Guardar
            </button>

            <button
              onClick={() => saveOrder({ print: true })}
              className="py-3 rounded-2xl bg-amber-600 text-white font-extrabold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
              title="Guardar e imprimir"
            >
              <Printer size={18} /> Imprimir
            </button>
          </div>
        </div>
      </aside>

      {/* ===== DRAWER PEDIDOS (oculto hasta click) ===== */}
      {ordersOpen && (
        <div className="fixed inset-0 z-[80]">
          {/* overlay */}
          <button
            onClick={() => setOrdersOpen(false)}
            className="absolute inset-0 bg-black/30"
            aria-label="Cerrar"
          />

          {/* panel */}
          <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-extrabold text-slate-900 flex items-center gap-2">
                    <ReceiptText size={18} className="text-amber-600" /> Pedidos manuales
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {manualOrders.length ? `${manualOrders.length} pedidos` : "Sin pedidos cargados"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchManualOrders}
                    className={`px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-extrabold hover:bg-slate-100 flex items-center gap-2 ${
                      loadingOrders ? "opacity-70" : ""
                    }`}
                  >
                    <RefreshCw size={16} className={loadingOrders ? "animate-spin" : ""} />
                    Actualizar
                  </button>
                  <button
                    onClick={() => setOrdersOpen(false)}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                    title="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={ordersSearch}
                  onChange={(e) => setOrdersSearch(e.target.value)}
                  placeholder="Buscar por nombre, dirección o número…"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/40 outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 bg-slate-50">
              {loadingOrders ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-2" />
                  <p className="text-sm font-semibold">Cargando pedidos...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-10">
                  No hay resultados.
                </div>
              ) : (
                filteredOrders.slice(0, 60).map((o) => {
                  const detalle = o.detalle_pedido ?? o["detalle pedido"] ?? "";
                  const preview = parseDetailsForView(detalle);
                  const total = (o.valor_restaurante || 0) + (o.valor_domicilio || 0);

                  return (
                    <div key={o.row_number} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-500 font-mono font-bold">#{o.row_number}</div>
                          <div className="font-black text-slate-900 break-words">{o.nombre || "Cliente"}</div>
                          <div className="text-[11px] text-slate-600 break-words">{o.direccion}</div>
                          <div className="text-[10px] text-slate-400 mt-1">{o.fecha}</div>

                          <div className="mt-2 flex gap-2 flex-wrap">
                            <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700">
                              {o.metodo_pago}
                            </span>
                            <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                              {o.estado}
                            </span>
                            {o.valor_domicilio > 0 && (
                              <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                + domicilio
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-[11px] text-slate-500 font-semibold">Total</div>
                            <div className="text-lg font-black text-slate-900">{money(total)}</div>
                          </div>
                          <button
                            onClick={() => printTicket(o)}
                            className="px-3 py-2 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-950 flex items-center gap-2"
                          >
                            <Printer size={16} /> Imprimir
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        {preview.slice(0, 3).map((it, idx) => (
                          <div key={idx} className="flex justify-between gap-2 text-[12px] text-slate-700">
                            <span className="truncate">
                              <span className="font-extrabold">{it.quantity}x</span> {it.name}
                            </span>
                            <span className="font-extrabold text-slate-700">{money(it.priceTotal)}</span>
                          </div>
                        ))}
                        {preview.length > 3 && (
                          <div className="text-[11px] text-slate-400 mt-1">+{preview.length - 3} más…</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white">
              <button
                onClick={() => setOrdersOpen(false)}
                className="w-full py-3 rounded-2xl bg-slate-100 text-slate-800 font-extrabold hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Manual;
