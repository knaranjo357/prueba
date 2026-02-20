// src/pages/Manual.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  ShoppingBag,
  Sparkles,
  Store,
  Banknote,
  ArrowLeftRight,
} from "lucide-react";

import { formatPrice } from "../utils/dateUtils";

/** ENDPOINTS */
const MENU_FULL_API = "https://n8n.alliasoft.com/webhook/luis-res/menu-completo";
const MAKE_ORDER_API = "https://n8n.alliasoft.com/webhook/luis-res/hacer-pedido";
const DOMICILIOS_API = "https://n8n.alliasoft.com/webhook/luis-res/domicilios";

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
  baseValor: number;
  extraLlevar: number;
  priceUnit: number;
  notes: string;
};

type ManualOrder = {
  row_number: number;
  fecha: string;
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

type DomicilioRow = {
  row_number?: number;
  barrio: string;
  precio: number;
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
const norm = (s: string) => (s || "").trim().toLowerCase();

const computeUnitPrice = (item: MenuItemFull, isTakeaway: boolean) => {
  const base = Number(item.valor) || 0;
  const extra = isTakeaway && item.para_llevar ? Number(item.precio_adicional_llevar) || 0 : 0;
  return base + extra;
};

const groupBaseNameForPiquete = (name: string) =>
  (name || "").replace(/(\d{2,3}[.,]?\d{3})|\d{4,}$/g, "").trim();

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
    } else buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};

const splitByCommaOutsideParens = (s: string) => splitOutsideParens(s, [","]);

const parseDetailsForView = (raw: string) => {
  if (!raw) return [];
  const itemStrings = splitOutsideParens(raw, [";", "|"]).map((x) => x.trim()).filter(Boolean);

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
const serializeCartToDetalle = (items: CartItem[]) =>
  items
    .map((i) => {
      const note = normalizeNote(i.notes);
      const nameWithNote = note ? `${i.name} (${note})` : i.name;
      const lineTotal = (Number(i.priceUnit) || 0) * (Number(i.quantity) || 0);
      return `- ${i.quantity},${nameWithNote} ,${lineTotal};`;
    })
    .join("\n");

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
  const itemStrings = splitOutsideParens(raw, [";", "|"]).map((x) => x.trim()).filter(Boolean);

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
  Á: 0xc1,
  É: 0xc9,
  Í: 0xcd,
  Ó: 0xd3,
  Ú: 0xda,
  Ü: 0xdc,
  Ñ: 0xd1,
  á: 0xe1,
  é: 0xe9,
  í: 0xed,
  ó: 0xf3,
  ú: 0xfa,
  ü: 0xfc,
  ñ: 0xf1,
  "€": 0x80,
  "£": 0xa3,
  "¥": 0xa5,
  "¢": 0xa2,
  "°": 0xb0,
  "¿": 0xbf,
  "¡": 0xa1,
  "“": 0x93,
  "”": 0x94,
  "‘": 0x91,
  "’": 0x92,
  "—": 0x97,
  "–": 0x96,
  "…": 0x85,
};
const asciiFallback: Record<string, string> = {
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "—": "-",
  "–": "-",
  "…": "...",
  "€": "EUR",
};
const encodeCP1252 = (str: string): number[] => {
  const bytes: number[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x7f) {
      bytes.push(code);
      continue;
    }
    if (cp1252Map[ch] !== undefined) {
      bytes.push(cp1252Map[ch]);
      continue;
    }
    const basic = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (basic.length === 1 && basic.charCodeAt(0) <= 0x7f) {
      bytes.push(basic.charCodeAt(0));
      continue;
    }
    if (asciiFallback[ch]) {
      for (const c of asciiFallback[ch]) bytes.push(c.charCodeAt(0));
      continue;
    }
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
  try {
    (window as any).location.href = url;
    return;
  } catch {}
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
  return "bg-slate-900";
};

/** ===== UI bits ===== */
const stop = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const QtyPill: React.FC<{
  qty: number;
  disabled?: boolean;
  onPlus: () => void;
  onMinus: () => void;
  compact?: boolean;
}> = ({ qty, disabled, onPlus, onMinus, compact }) => {
  const btn = compact ? "h-8 w-8" : "h-9 w-9";
  const txt = compact ? "text-xs" : "text-sm";
  const mid = compact ? "px-2" : "px-3";

  if (disabled) {
    return (
      <div className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-400 text-[11px] font-extrabold border border-slate-200">
        Agotado
      </div>
    );
  }

  if (qty <= 0) {
    return (
      <button
        onClick={(e) => {
          stop(e);
          onPlus();
        }}
        className={`inline-flex items-center gap-2 ${compact ? "px-3 py-1.5" : "px-4 py-2"} rounded-full bg-amber-600 text-white font-extrabold hover:bg-amber-700 active:scale-[0.98]`}
        title="Agregar"
      >
        <Plus size={compact ? 14 : 16} />
        <span className={compact ? "text-xs" : "text-sm"}>Agregar</span>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center rounded-full overflow-hidden bg-slate-900 text-white">
      <button
        className={`${btn} flex items-center justify-center hover:bg-white/10 active:bg-white/15`}
        onClick={(e) => {
          stop(e);
          onMinus();
        }}
        title="Quitar"
      >
        <Minus size={compact ? 14 : 16} />
      </button>
      <div className={`${mid} ${txt} font-black tabular-nums`}>{qty}</div>
      <button
        className={`${btn} flex items-center justify-center hover:bg-white/10 active:bg-white/15`}
        onClick={(e) => {
          stop(e);
          onPlus();
        }}
        title="Agregar"
      >
        <Plus size={compact ? 14 : 16} />
      </button>
    </div>
  );
};

/** ===== COMPONENTE ===== */
type Mode = "mesa" | "llevar" | "recoger";

const Manual: React.FC = () => {
  // modo (mesa / llevar / recoger)
  const [mode, setMode] = useState<Mode>("mesa");
  const isTakeaway = mode !== "mesa"; // suma adicional llevar (icopor)
  const hasDelivery = mode === "llevar";

  // menu
  const [menuItems, setMenuItems] = useState<MenuItemFull[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // domicilios
  const [domicilios, setDomicilios] = useState<DomicilioRow[]>([]);
  const [loadingDomicilios, setLoadingDomicilios] = useState(false);
  const [barrioOpen, setBarrioOpen] = useState(false);
  const barrioCloseTimer = useRef<number | null>(null);

  // filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpenMobile, setCartOpenMobile] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);

  // datos pedido
  const [nombre, setNombre] = useState("");
  const [numero, setNumero] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");

  // dirección (según modo)
  const [mesaLugar, setMesaLugar] = useState("");
  const [barrio, setBarrio] = useState("");
  const [direccionExacta, setDireccionExacta] = useState("");
  const [recogerEn, setRecogerEn] = useState("");

  const [valorDomicilio, setValorDomicilio] = useState(0);

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

  /** fetch domicilios */
  const fetchDomicilios = async () => {
    setLoadingDomicilios(true);
    try {
      const res = await fetch(DOMICILIOS_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DomicilioRow[];
      const arr = Array.isArray(data) ? data : [];
      const clean = arr
        .filter((x) => x && x.barrio)
        .map((x) => ({ barrio: String(x.barrio), precio: Number(x.precio) || 0 }));
      clean.sort((a, b) => a.barrio.localeCompare(b.barrio, "es"));
      setDomicilios(clean);
    } catch (e) {
      console.error("domicilios error", e);
      showToast({ type: "error", msg: "No se pudieron cargar domicilios." });
    } finally {
      setLoadingDomicilios(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // Lazy-load domicilios cuando entras a delivery
  useEffect(() => {
    if (mode === "llevar" && domicilios.length === 0 && !loadingDomicilios) {
      fetchDomicilios();
    }
    if (mode !== "llevar") {
      setValorDomicilio(0);
    }
    if (mode === "recoger") {
      setValorDomicilio(0);
    }
  }, [mode]); // eslint-disable-line

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
      const inCat = selectedCategory === "Todas" || (item.categorias || []).includes(selectedCategory);
      return inSearch && inCat;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  /** grouping */
  type GroupType = "almuerzo" | "piquete" | "single";
  type MenuGroup = { id: string; type: GroupType; title: string; items: MenuItemFull[] };

  const groupedMenu = useMemo(() => {
    const groups: MenuGroup[] = [];
    const processed = new Set<string>();

    const almuerzos = filteredMenuItems.filter((i) => (i.nombre || "").toLowerCase().startsWith("almuerzo"));
    if (almuerzos.length) {
      groups.push({ id: "grp-almuerzos", type: "almuerzo", title: "Almuerzos del Día", items: almuerzos });
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
      if (!processed.has(String(item.id))) groups.push({ id: String(item.id), type: "single", title: item.nombre, items: [item] });
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
    if (!hasDelivery) setValorDomicilio(0);
  }, [isTakeaway, hasDelivery, menuById]);

  /** totals */
  const totalRestaurante = useMemo(
    () => cart.reduce((acc, it) => acc + (Number(it.priceUnit) || 0) * (Number(it.quantity) || 0), 0),
    [cart]
  );
  const totalFinal = useMemo(
    () => totalRestaurante + (hasDelivery ? (Number(valorDomicilio) || 0) : 0),
    [totalRestaurante, valorDomicilio, hasDelivery]
  );

  /** qty map (para mostrar contador en el menú) */
  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach((c) => (m[c.id] = (m[c.id] || 0) + (c.quantity || 0)));
    return m;
  }, [cart]);

  const cartCount = useMemo(() => cart.reduce((acc, it) => acc + (it.quantity || 0), 0), [cart]);

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

  /** barrio autocomplete */
  const barrioSuggestions = useMemo(() => {
    const q = norm(barrio);
    const base = domicilios;
    if (!q) return base.slice(0, 18);
    return base.filter((d) => norm(d.barrio).includes(q)).slice(0, 18);
  }, [barrio, domicilios]);

  const exactMatch = useMemo(() => {
    const q = norm(barrio);
    if (!q) return null;
    return domicilios.find((d) => norm(d.barrio) === q) || null;
  }, [barrio, domicilios]);

  useEffect(() => {
    // si escribe un barrio exacto, autollenar domicilio
    if (hasDelivery && exactMatch && (Number(valorDomicilio) || 0) !== (Number(exactMatch.precio) || 0)) {
      setValorDomicilio(Number(exactMatch.precio) || 0);
    }
  }, [hasDelivery, exactMatch]); // eslint-disable-line

  const selectBarrio = (b: string, precio: number) => {
    setBarrio(b);
    setValorDomicilio(Number(precio) || 0);
    setBarrioOpen(false);
  };

  const onBarrioFocus = () => {
    if (barrioCloseTimer.current) window.clearTimeout(barrioCloseTimer.current);
    setBarrioOpen(true);
  };
  const onBarrioBlur = () => {
    barrioCloseTimer.current = window.setTimeout(() => setBarrioOpen(false), 120);
  };

  /** Preview detalle */
  const detallePreview = useMemo(() => {
    const raw = serializeCartToDetalle(cart);
    const parsed = parseDetailsForView(raw);
    return { raw, parsed };
  }, [cart]);

  /** mode control */
  const ModePill = () => (
    <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
      <button
        onClick={() => setMode("mesa")}
        className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
          mode === "mesa" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-200"
        }`}
      >
        <Utensils size={16} /> Mesa
      </button>
      <button
        onClick={() => setMode("llevar")}
        className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
          mode === "llevar" ? "bg-amber-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
        }`}
      >
        <Package size={16} /> Domicilio
      </button>
      <button
        onClick={() => setMode("recoger")}
        className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
          mode === "recoger" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
        }`}
      >
        <Store size={16} /> Recoger
      </button>
    </div>
  );

  /** pago radio */
  const PayPill = () => (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => setMetodoPago("efectivo")}
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-2xl border font-extrabold text-sm transition-all ${
          metodoPago === "efectivo"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
        aria-pressed={metodoPago === "efectivo"}
      >
        <Banknote size={16} />
        Efectivo
      </button>
      <button
        onClick={() => setMetodoPago("transferencia")}
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-2xl border font-extrabold text-sm transition-all ${
          metodoPago === "transferencia"
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
        aria-pressed={metodoPago === "transferencia"}
      >
        <ArrowLeftRight size={16} />
        Transferencia
      </button>
    </div>
  );

  /** Dirección final (un solo campo) */
  const buildDireccionFinal = () => {
    if (mode === "mesa") return mesaLugar.trim() || "MESA";
    if (mode === "recoger") {
      const x = recogerEn.trim();
      return x ? `RECOGER: ${x}` : "RECOGER";
    }
    // llevar: "direccion exacta (barrio)"
    const d = direccionExacta.trim();
    const b = barrio.trim();
    if (d && b) return `${d} (${b})`;
    if (d) return b ? `${d} (${b})` : d;
    if (b) return `(${b})`;
    return "PARA LLEVAR";
  };

  /** save order */
  const saveOrder = async (opts: { print: boolean }) => {
    if (!cart.length || totalRestaurante <= 0) {
      showToast({ type: "info", msg: "Agrega productos para guardar." });
      return;
    }

    const numeroFinal = (numero.trim() || makeNumeroFallback()).trim();
    const nombreFinal = nombre.trim() || "Cliente";
    const direccionFinal = buildDireccionFinal();
    const detalle = serializeCartToDetalle(cart);
    const domicilio = hasDelivery ? (Number(valorDomicilio) || 0) : 0;

    const payload: any = {
      nombre: nombreFinal,
      direccion: direccionFinal,
      "detalle pedido": detalle,
      valor_restaurante: totalRestaurante,
      valor_domicilio: domicilio,
      metodo_pago: metodoPago,
      estado: opts.print ? "impreso" : "pidiendo",
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
      setMesaLugar("");
      setBarrio("");
      setDireccionExacta("");
      setRecogerEn("");
      setValorDomicilio(0);
      setMetodoPago("efectivo");
      setCartOpenMobile(false);

      if (opts.print) {
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
    } catch (e) {
      console.error(e);
      showToast({ type: "error", msg: "No se pudo guardar el pedido." });
    }
  };

  return (
    <div className="relative bg-slate-50">
      {/* TOAST */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90]">
          <div className={`${toastStyle(toast)} text-white px-4 py-2 rounded-xl shadow-xl text-sm font-bold`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* HEADER (sticky) */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-3">
          <div className="flex flex-col lg:flex-row gap-3 justify-between lg:items-center">
            {/* left: title + search */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Sparkles size={18} className="text-amber-700" />
                </div>
                <div>
                  <div className="font-black text-slate-900 leading-tight">Pedido Manual</div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    + muestra cantidad • - para corregir
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar (almuerzo, piquete, sopa, mojarra...)"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/40 outline-none text-sm"
                  />
                </div>

                <button
                  onClick={fetchMenu}
                  className={`p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-700 border border-slate-200 ${
                    loadingMenu ? "animate-spin" : ""
                  }`}
                  title="Recargar menú"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {/* right: mode + mobile cart */}
            <div className="flex gap-2 items-center w-full lg:w-auto">
              <ModePill />

              <button
                onClick={() => setCartOpenMobile(true)}
                className="lg:hidden shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold"
              >
                <ShoppingBag size={18} />
                <span className="text-sm">
                  Caja{cartCount > 0 ? ` (${cartCount})` : ""}
                </span>
              </button>
            </div>
          </div>

          {/* categorías (chips) */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <div className="flex items-center gap-2 text-slate-600 shrink-0">
              <Filter size={14} />
              <span className="text-[11px] font-extrabold">Categorías</span>
            </div>

            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
                  selectedCategory === cat
                    ? "bg-amber-500 text-white border-amber-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 lg:gap-6">
          {/* MENU */}
          <section className="min-w-0">
            {loadingMenu ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 bg-white rounded-3xl border border-slate-200">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-2" />
                <p className="text-sm font-semibold">Cargando menú...</p>
              </div>
            ) : groupedMenu.length === 0 ? (
              <div className="text-center text-slate-500 bg-white rounded-3xl border border-slate-200 p-10">
                No hay resultados con esos filtros.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {groupedMenu.map((group) => {
                  // PIQUETES
                  if (group.type === "piquete") {
                    return (
                      <div
                        key={group.id}
                        className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100">
                          <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{group.title}</h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">Usa + / - para ajustar</p>
                        </div>

                        <div className="p-3 grid grid-cols-2 gap-2">
                          {group.items.map((item) => {
                            const unit = computeUnitPrice(item, isTakeaway);
                            const disabled = !item.disponible;
                            const id = String(item.id);
                            const qty = qtyById[id] || 0;

                            return (
                              <button
                                key={id}
                                onClick={() => addToCart(item)}
                                disabled={disabled}
                                className={`rounded-3xl border px-3 py-3 text-left active:scale-[0.98] transition-all ${
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
                                    +{formatPrice(item.precio_adicional_llevar || 0)} icopor
                                  </div>
                                )}

                                <div className="mt-2">
                                  <QtyPill
                                    qty={qty}
                                    disabled={disabled}
                                    compact
                                    onPlus={() => addToCart(item)}
                                    onMinus={() => dec(id)}
                                  />
                                </div>
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
                      <div
                        key={group.id}
                        className="bg-white rounded-3xl border border-slate-200 shadow-sm sm:col-span-2 xl:col-span-3 overflow-hidden"
                      >
                        <button
                          onClick={() => toggleGroup(group.id)}
                          className="w-full flex justify-between items-center px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="bg-white border border-slate-200 text-slate-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                              {group.items.length}
                            </span>
                            <h3 className="font-extrabold text-slate-900 text-sm truncate">{group.title}</h3>
                          </div>
                          {isOpen ? (
                            <ChevronUp size={16} className="text-slate-500" />
                          ) : (
                            <ChevronDown size={16} className="text-slate-500" />
                          )}
                        </button>

                        {isOpen && (
                          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                            {group.items.map((item) => {
                              const unit = computeUnitPrice(item, isTakeaway);
                              const disabled = !item.disponible;
                              const id = String(item.id);
                              const qty = qtyById[id] || 0;

                              return (
                                <button
                                  key={id}
                                  onClick={() => addToCart(item)}
                                  disabled={disabled}
                                  className={`rounded-3xl border px-3 py-3 active:scale-[0.98] transition-all text-left ${
                                    disabled
                                      ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed"
                                      : "bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-sm font-extrabold text-slate-900 truncate">
                                        {(item.nombre || "").replace(/^Almuerzo (con )?/i, "")}
                                      </div>
                                      <div className="mt-1 text-xs font-black text-slate-900">{formatPrice(unit)}</div>
                                      {isTakeaway && item.para_llevar && (item.precio_adicional_llevar || 0) > 0 && (
                                        <div className="text-[10px] font-extrabold text-amber-700 mt-1">
                                          +{formatPrice(item.precio_adicional_llevar || 0)} icopor
                                        </div>
                                      )}
                                    </div>

                                    {/* control qty */}
                                    <div className="shrink-0">
                                      <QtyPill
                                        qty={qty}
                                        disabled={disabled}
                                        compact
                                        onPlus={() => addToCart(item)}
                                        onMinus={() => dec(id)}
                                      />
                                    </div>
                                  </div>
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
                  const id = String(item.id);
                  const qty = qtyById[id] || 0;

                  return (
                    <button
                      key={group.id}
                      onClick={() => addToCart(item)}
                      disabled={disabled}
                      className={`bg-white rounded-3xl border shadow-sm p-4 text-left active:scale-[0.99] transition-all ${
                        disabled
                          ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
                          : "border-slate-200 hover:border-amber-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 text-sm leading-snug">{item.nombre}</div>
                          {item.descripcion ? (
                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{item.descripcion}</div>
                          ) : (
                            <div className="text-[11px] text-slate-400 mt-1">—</div>
                          )}
                        </div>

                        <div className="shrink-0">
                          <QtyPill
                            qty={qty}
                            disabled={disabled}
                            compact
                            onPlus={() => addToCart(item)}
                            onMinus={() => dec(id)}
                          />
                        </div>
                      </div>

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
          </section>

          {/* CART (desktop/tablet) */}
          <aside className="hidden lg:flex bg-white border border-slate-200 rounded-3xl overflow-hidden flex-col min-h-[calc(100vh-140px)] sticky top-[100px]">
            {/* header */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${mode === "llevar" ? "bg-amber-500" : mode === "recoger" ? "bg-slate-900" : "bg-emerald-500"}`} />
                    <h2 className="font-extrabold text-slate-900">Caja</h2>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {mode === "mesa" ? "Mesa: valor base." : mode === "recoger" ? "Recoger: domicilio 0 (suma icopor si aplica)." : "Domicilio: barrio + dirección (auto precio)."}
                  </p>
                </div>

                {cartCount > 0 && (
                  <div className="text-[11px] font-extrabold bg-slate-900 text-white px-2 py-1 rounded-full">
                    {cartCount} item{cartCount === 1 ? "" : "s"}
                  </div>
                )}
              </div>

              {/* acciones arriba (sin scroll) */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={clearAll}
                  className="py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-extrabold hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center justify-center"
                  title="Limpiar"
                >
                  <Trash2 size={18} />
                </button>

                <button
                  onClick={() => saveOrder({ print: false })}
                  className="py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-950 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Guardar
                </button>

                <button
                  onClick={() => saveOrder({ print: true })}
                  className="py-2.5 rounded-2xl bg-amber-600 text-white font-extrabold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                  title="Guardar e imprimir"
                >
                  <Printer size={18} /> Imprimir
                </button>
              </div>

              {/* totales arriba también */}
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[11px] text-slate-500 font-semibold">Restaurante</div>
                    <div className="text-xl font-black text-slate-900">{formatPrice(totalRestaurante)}</div>
                  </div>
                  {hasDelivery && (
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-semibold">Domicilio</div>
                      <div className="text-lg font-black text-slate-900">{formatPrice(valorDomicilio || 0)}</div>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex justify-between items-center border-t border-slate-200 pt-2">
                  <div className="text-sm font-extrabold text-slate-700">Total</div>
                  <div className="text-2xl font-black text-slate-900">{formatPrice(totalFinal)}</div>
                </div>
              </div>

              {/* datos */}
              <div className="mt-4 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200">
                    <User size={14} className="text-slate-400 mr-2" />
                    <input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Nombre (opcional)"
                      className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                    />
                  </div>
                  <div className="flex items-center bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200">
                    <Phone size={14} className="text-slate-400 mr-2" />
                    <input
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Número (opcional)"
                      className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* dirección por modo */}
                {mode === "mesa" && (
                  <div className="flex items-center bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200">
                    <MapPin size={14} className="text-slate-400 mr-2" />
                    <input
                      value={mesaLugar}
                      onChange={(e) => setMesaLugar(e.target.value)}
                      placeholder="Mesa / lugar (opcional)"
                      className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                    />
                  </div>
                )}

                {mode === "recoger" && (
                  <div className="flex items-center bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200">
                    <Store size={14} className="text-slate-400 mr-2" />
                    <input
                      value={recogerEn}
                      onChange={(e) => setRecogerEn(e.target.value)}
                      placeholder="Recoger (opcional: nombre / referencia)"
                      className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                    />
                  </div>
                )}

                {mode === "llevar" && (
                  <>
                    {/* Barrio autocomplete */}
                    <div className="relative">
                      <div className="flex items-center bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200">
                        <MapPin size={14} className="text-slate-400 mr-2" />
                        <input
                          value={barrio}
                          onChange={(e) => {
                            setBarrio(e.target.value);
                            setBarrioOpen(true);
                          }}
                          onFocus={onBarrioFocus}
                          onBlur={onBarrioBlur}
                          placeholder={loadingDomicilios ? "Cargando barrios..." : "Barrio (autocompletar)"}
                          className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                        />

                        <div className="ml-2 shrink-0">
                          {loadingDomicilios ? (
                            <span className="text-[10px] font-extrabold text-slate-400">...</span>
                          ) : exactMatch ? (
                            <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-full">
                              {money(exactMatch.precio)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-full">
                              {money(valorDomicilio || 0)}
                            </span>
                          )}
                        </div>
                      </div>

                      {barrioOpen && barrioSuggestions.length > 0 && (
                        <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                          <div className="max-h-56 overflow-y-auto">
                            {barrioSuggestions.map((d) => (
                              <button
                                key={d.barrio}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  selectBarrio(d.barrio, d.precio);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-3"
                              >
                                <span className="text-sm font-extrabold text-slate-900 truncate">{d.barrio}</span>
                                <span className="text-[11px] font-black text-slate-700 whitespace-nowrap">
                                  {money(d.precio)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dirección exacta */}
                    <div className="flex items-center bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200">
                      <MessageSquare size={14} className="text-slate-400 mr-2" />
                      <input
                        value={direccionExacta}
                        onChange={(e) => setDireccionExacta(e.target.value)}
                        placeholder="Dirección exacta (ej: Cra 12 #34-56)"
                        className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                      />
                    </div>

                    {/* ajuste manual de domicilio (opcional) */}
                    <div className="flex items-center bg-amber-50 rounded-2xl px-3 py-2 border border-amber-200">
                      <span className="text-[10px] font-extrabold text-amber-800 mr-2">Domicilio</span>
                      <input
                        type="number"
                        value={valorDomicilio}
                        onChange={(e) => setValorDomicilio(toInt(e.target.value))}
                        placeholder="0"
                        className="bg-transparent text-sm w-full outline-none text-slate-900 placeholder-amber-500"
                      />
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Se enviará: <span className="font-extrabold text-slate-700">{buildDireccionFinal()}</span>
                    </div>
                  </>
                )}

                {/* Pago */}
                <div className="mt-1">
                  <div className="text-[11px] font-extrabold text-slate-600 mb-2 flex items-center gap-2">
                    <CreditCard size={14} />
                    Método de pago
                  </div>
                  <PayPill />
                </div>
              </div>
            </div>

            {/* items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <ShoppingBag size={32} />
                  <p className="text-sm font-semibold">Carrito vacío</p>
                  <p className="text-[11px] text-slate-400">Agrega desde el menú.</p>
                </div>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.id} className="bg-white rounded-3xl border border-slate-200 p-3 shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 text-sm break-words leading-tight">{item.name}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {formatPrice(item.priceUnit)} c/u
                            {isTakeaway && item.extraLlevar > 0 && (
                              <span className="ml-2 text-amber-700 font-extrabold">
                                (+{formatPrice(item.extraLlevar)} icopor)
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => remove(item.id)}
                          className="p-2 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Quitar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="mt-3 flex justify-between items-center">
                        <div className="flex items-center bg-slate-100 rounded-2xl h-10 border border-slate-200 overflow-hidden">
                          <button
                            onClick={() => dec(item.id)}
                            className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-10 text-center font-black text-sm text-slate-900">{item.quantity}</span>
                          <button
                            onClick={() => inc(item.id)}
                            className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700"
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
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-3 text-sm focus:ring-2 focus:ring-amber-500/40 outline-none text-slate-800 placeholder-slate-400"
                        />
                      </div>
                    </div>
                  ))}

                  {/* preview colapsable */}
                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setDetalleOpen((v) => !v)}
                      className="w-full px-3 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100"
                    >
                      <div className="text-xs font-extrabold text-slate-900">Detalle que se enviará</div>
                      {detalleOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                    </button>
                    {detalleOpen && (
                      <div className="p-3">
                        <pre className="text-[11px] text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-2xl p-3 leading-relaxed">
{detallePreview.raw || "(vacío)"}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ===== MOBILE: bottom bar + bottom sheet cart ===== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-white/95 backdrop-blur border-t border-slate-200 px-3 py-2">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2">
            <button
              onClick={() => setCartOpenMobile(true)}
              className="flex-1 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white font-extrabold"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} />
                <span>Ver caja</span>
                {cartCount > 0 && (
                  <span className="ml-1 text-[11px] bg-white/15 px-2 py-0.5 rounded-full">{cartCount}</span>
                )}
              </div>
              <div className="text-sm">{formatPrice(totalFinal)}</div>
            </button>
          </div>
        </div>

        {cartOpenMobile && (
          <div className="fixed inset-0 z-[80]">
            <button
              onClick={() => setCartOpenMobile(false)}
              className="absolute inset-0 bg-black/35"
              aria-label="Cerrar"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] border-t border-slate-200 shadow-2xl max-h-[88vh] flex flex-col">
              <div className="px-4 pt-4 pb-3 border-b border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">Caja</div>
                    <div className="text-[11px] text-slate-500">
                      Botones arriba • Ajusta con +/-
                    </div>
                  </div>
                  <button
                    onClick={() => setCartOpenMobile(false)}
                    className="p-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700"
                    title="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* acciones arriba en móvil */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    onClick={clearAll}
                    className="py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-extrabold hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center justify-center"
                    title="Limpiar"
                  >
                    <Trash2 size={18} />
                  </button>

                  <button
                    onClick={() => saveOrder({ print: false })}
                    className="py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-950 transition-colors flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> Guardar
                  </button>

                  <button
                    onClick={() => saveOrder({ print: true })}
                    className="py-2.5 rounded-2xl bg-amber-600 text-white font-extrabold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                    title="Guardar e imprimir"
                  >
                    <Printer size={18} /> Imprimir
                  </button>
                </div>

                {/* totales */}
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-[11px] text-slate-500 font-semibold">Restaurante</div>
                      <div className="text-xl font-black text-slate-900">{formatPrice(totalRestaurante)}</div>
                    </div>
                    {hasDelivery && (
                      <div className="text-right">
                        <div className="text-[11px] text-slate-500 font-semibold">Domicilio</div>
                        <div className="text-lg font-black text-slate-900">{formatPrice(valorDomicilio || 0)}</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex justify-between items-center border-t border-slate-200 pt-2">
                    <div className="text-sm font-extrabold text-slate-700">Total</div>
                    <div className="text-2xl font-black text-slate-900">{formatPrice(totalFinal)}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <ShoppingBag className="mx-auto mb-2" />
                    Carrito vacío
                  </div>
                ) : (
                  <>
                    {cart.map((item) => (
                      <div key={item.id} className="bg-white rounded-3xl border border-slate-200 p-3 shadow-sm">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 text-sm break-words leading-tight">{item.name}</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              {formatPrice(item.priceUnit)} c/u
                              {isTakeaway && item.extraLlevar > 0 && (
                                <span className="ml-2 text-amber-700 font-extrabold">
                                  (+{formatPrice(item.extraLlevar)} icopor)
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => remove(item.id)}
                            className="p-2 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Quitar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="mt-3 flex justify-between items-center">
                          <div className="flex items-center bg-slate-100 rounded-2xl h-10 border border-slate-200 overflow-hidden">
                            <button
                              onClick={() => dec(item.id)}
                              className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-10 text-center font-black text-sm text-slate-900">{item.quantity}</span>
                            <button
                              onClick={() => inc(item.id)}
                              className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700"
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
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-3 text-sm focus:ring-2 focus:ring-amber-500/40 outline-none text-slate-800 placeholder-slate-400"
                          />
                        </div>
                      </div>
                    ))}

                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setDetalleOpen((v) => !v)}
                        className="w-full px-3 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100"
                      >
                        <div className="text-xs font-extrabold text-slate-900">Detalle que se enviará</div>
                        {detalleOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                      </button>
                      {detalleOpen && (
                        <div className="p-3">
                          <pre className="text-[11px] text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-2xl p-3 leading-relaxed">
{detallePreview.raw || "(vacío)"}
                          </pre>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="p-3 border-t border-slate-200 bg-white">
                <button
                  onClick={() => setCartOpenMobile(false)}
                  className="w-full py-3 rounded-3xl bg-slate-100 text-slate-800 font-extrabold hover:bg-slate-200"
                >
                  Seguir agregando
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* spacing para que el bottom bar no tape contenido */}
      <div className="lg:hidden h-[84px]" />
    </div>
  );
};

export default Manual;