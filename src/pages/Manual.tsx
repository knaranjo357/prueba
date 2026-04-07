import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type DomicilioRow = {
  row_number?: number;
  barrio: string;
  precio: number;
};

type ManualProps = {
  onOrderSaved?: () => void;
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
const serializeCartToDetalle = (items: CartItem[]) =>
  items
    .map((i) => {
      const note = normalizeNote(i.notes);
      const nameWithNote = note ? `${i.name} (${note})` : i.name;
      const lineTotal = (Number(i.priceUnit) || 0) * (Number(i.quantity) || 0);
      return `- ${i.quantity},${nameWithNote} ,${lineTotal};`;
    })
    .join("\n");

/** ===== micro toast ===== */
type Toast = { type: "success" | "error" | "info"; msg: string } | null;

const toastStyle = (t: Toast) => {
  if (!t) return "";
  if (t.type === "success") return "bg-emerald-600";
  if (t.type === "error") return "bg-rose-600";
  return "bg-slate-900";
};

/** ===== UI helpers ===== */
const stop = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const isTypingElement = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = (node.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || (node as any).isContentEditable;
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
        className={`inline-flex items-center gap-2 ${
          compact ? "px-3 py-1.5" : "px-4 py-2"
        } rounded-full bg-amber-600 text-white font-extrabold hover:bg-amber-700 active:scale-[0.98]`}
        title="Agregar"
        aria-label="Agregar"
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
        aria-label="Quitar"
      >
        <Minus size={compact ? 14 : 16} />
      </button>
      <div className={`${mid} ${txt} font-black tabular-nums select-none`}>{qty}</div>
      <button
        className={`${btn} flex items-center justify-center hover:bg-white/10 active:bg-white/15`}
        onClick={(e) => {
          stop(e);
          onPlus();
        }}
        title="Agregar"
        aria-label="Agregar"
      >
        <Plus size={compact ? 14 : 16} />
      </button>
    </div>
  );
};

/** ===== COMPONENTE ===== */
type Mode = "mesa" | "llevar" | "recoger";

const Manual: React.FC<ManualProps> = ({ onOrderSaved }) => {
  // modo
  const [mode, setMode] = useState<Mode>("llevar");
  const isTakeaway = mode !== "mesa";
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

  // comentario modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalItemId, setNoteModalItemId] = useState<string | null>(null);

  const openNoteModal = useCallback((id: string) => {
    setNoteModalItemId(id);
    setNoteModalOpen(true);
  }, []);

  const closeNoteModal = useCallback(() => {
    setNoteModalOpen(false);
    setNoteModalItemId(null);
  }, []);

  // sticky categories under header
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => setHeaderH(el.getBoundingClientRect().height || 0);
    update();

    const RO = (window as any).ResizeObserver as any;
    let ro: any = null;

    if (RO) {
      ro = new RO(() => update());
      ro.observe(el);
    }

    window.addEventListener("resize", update);
    return () => {
      try {
        if (ro) ro.disconnect();
      } catch {}
      window.removeEventListener("resize", update);
    };
  }, []);

  // datos pedido
  const [nombre, setNombre] = useState("");
  const [numero, setNumero] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");

  // dirección
  const [mesaLugar, setMesaLugar] = useState("");
  const [barrio, setBarrio] = useState("");
  const [direccionExacta, setDireccionExacta] = useState("");
  const [recogerEn, setRecogerEn] = useState("");

  const [valorDomicilio, setValorDomicilio] = useState(0);

  // toast
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((t: Toast) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (barrioCloseTimer.current) window.clearTimeout(barrioCloseTimer.current);
    };
  }, []);

  /** fetch menu */
  const fetchMenu = useCallback(async () => {
    const controller = new AbortController();
    setLoadingMenu(true);

    try {
      const res = await fetch(MENU_FULL_API, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MenuItemFull[];
      const clean = Array.isArray(data) ? data : [];
      clean.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
      setMenuItems(clean);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      console.error("menu error", e);
      showToast({ type: "error", msg: "No se pudo cargar el menú." });
    } finally {
      setLoadingMenu(false);
    }

    return () => controller.abort();
  }, [showToast]);

  /** fetch domicilios */
  const fetchDomicilios = useCallback(async () => {
    const controller = new AbortController();
    setLoadingDomicilios(true);

    try {
      const res = await fetch(DOMICILIOS_API, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DomicilioRow[];
      const arr = Array.isArray(data) ? data : [];
      const clean = arr
        .filter((x) => x && x.barrio)
        .map((x) => ({ barrio: String(x.barrio), precio: Number(x.precio) || 0 }));

      clean.sort((a, b) => a.barrio.localeCompare(b.barrio, "es"));
      setDomicilios(clean);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      console.error("domicilios error", e);
      showToast({ type: "error", msg: "No se pudieron cargar domicilios." });
    } finally {
      setLoadingDomicilios(false);
    }

    return () => controller.abort();
  }, [showToast]);

  useEffect(() => {
    fetchMenu();
    // Iniciar fetchDomicilios porque el modo por defecto es "llevar"
    fetchDomicilios();
  }, [fetchMenu, fetchDomicilios]);

  useEffect(() => {
    if (mode === "llevar" && domicilios.length === 0 && !loadingDomicilios) {
      fetchDomicilios();
    }
    if (mode !== "llevar") setValorDomicilio(0);
    if (mode === "recoger") setValorDomicilio(0);
  }, [mode, domicilios.length, loadingDomicilios, fetchDomicilios]);

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
        const extra =
          mi && mi.para_llevar ? Number(mi.precio_adicional_llevar) || 0 : ci.extraLlevar;
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
    () => totalRestaurante + (hasDelivery ? Number(valorDomicilio) || 0 : 0),
    [totalRestaurante, valorDomicilio, hasDelivery]
  );

  /** qty map */
  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach((c) => (m[c.id] = (m[c.id] || 0) + (c.quantity || 0)));
    return m;
  }, [cart]);

  /** note map */
  const noteById = useMemo(() => {
    const m: Record<string, string> = {};
    cart.forEach((c) => (m[c.id] = c.notes || ""));
    return m;
  }, [cart]);

  const currentNote = noteModalItemId ? noteById[noteModalItemId] || "" : "";

  const cartCount = useMemo(() => cart.reduce((acc, it) => acc + (it.quantity || 0), 0), [cart]);

  /** cart ops */
  const addToCart = useCallback(
    (item: MenuItemFull) => {
      if (!item.disponible) return;

      const id = String(item.id);
      const baseValor = Number(item.valor) || 0;
      const extra = item.para_llevar ? Number(item.precio_adicional_llevar) || 0 : 0;
      const priceUnit = baseValor + (isTakeaway ? extra : 0);

      setCart((prev) => {
        const exists = prev.find((x) => x.id === id);
        if (exists) {
          return prev.map((x) => (x.id === id ? { ...x, quantity: x.quantity + 1 } : x));
        }
        return [
          ...prev,
          {
            id,
            name: item.nombre,
            quantity: 1,
            baseValor,
            extraLlevar: extra,
            priceUnit,
            notes: "",
          },
        ];
      });
    },
    [isTakeaway]
  );

  const inc = useCallback(
    (id: string) =>
      setCart((p) => p.map((x) => (x.id === id ? { ...x, quantity: x.quantity + 1 } : x))),
    []
  );

  const dec = useCallback(
    (id: string) =>
      setCart((p) =>
        p
          .map((x) => (x.id === id ? { ...x, quantity: x.quantity - 1 } : x))
          .filter((x) => x.quantity > 0)
      ),
    []
  );

  const remove = useCallback((id: string) => setCart((p) => p.filter((x) => x.id !== id)), []);
  const setNote = useCallback(
    (id: string, note: string) =>
      setCart((p) => p.map((x) => (x.id === id ? { ...x, notes: note } : x))),
    []
  );
  const clearAll = useCallback(() => setCart([]), []);
  const toggleGroup = useCallback(
    (id: string) => setExpanded((p) => ({ ...p, [id]: !(p[id] ?? true) })),
    []
  );

  /** barrio autocomplete */
  const barrioSuggestions = useMemo(() => {
    const q = norm(barrio);
    if (!q) return domicilios.slice(0, 18);
    return domicilios.filter((d) => norm(d.barrio).includes(q)).slice(0, 18);
  }, [barrio, domicilios]);

  const exactMatch = useMemo(() => {
    const q = norm(barrio);
    if (!q) return null;
    return domicilios.find((d) => norm(d.barrio) === q) || null;
  }, [barrio, domicilios]);

  useEffect(() => {
    if (
      hasDelivery &&
      exactMatch &&
      (Number(valorDomicilio) || 0) !== (Number(exactMatch.precio) || 0)
    ) {
      setValorDomicilio(Number(exactMatch.precio) || 0);
    }
  }, [hasDelivery, exactMatch, valorDomicilio]);

  const selectBarrio = useCallback((b: string, precio: number) => {
    setBarrio(b);
    setValorDomicilio(Number(precio) || 0);
    setBarrioOpen(false);
  }, []);

  const onBarrioFocus = useCallback(() => {
    if (barrioCloseTimer.current) window.clearTimeout(barrioCloseTimer.current);
    setBarrioOpen(true);
  }, []);

  const onBarrioBlur = useCallback(() => {
    barrioCloseTimer.current = window.setTimeout(() => setBarrioOpen(false), 120);
  }, []);

  /** preview detalle */
  const detallePreview = useMemo(() => {
    const raw = serializeCartToDetalle(cart);
    const parsed = parseDetailsForView(raw);
    return { raw, parsed };
  }, [cart]);

  /** dirección final */
  const buildDireccionFinal = useCallback(() => {
    if (mode === "mesa") return mesaLugar.trim() || "MESA";

    if (mode === "recoger") {
      const x = recogerEn.trim();
      return x ? `RECOGER: ${x}` : "RECOGER";
    }

    const d = direccionExacta.trim();
    const b = barrio.trim();

    if (d && b) return `${d} (${b})`;
    if (d) return b ? `${d} (${b})` : d;
    if (b) return `(${b})`;
    return "PARA LLEVAR";
  }, [mode, mesaLugar, recogerEn, direccionExacta, barrio]);

  /** guardar pedido */
  const saveOrder = useCallback(async () => {
    if (!cart.length || totalRestaurante <= 0) {
      showToast({ type: "info", msg: "Agrega productos para guardar." });
      return;
    }

    const numeroFinal = (numero.trim() || makeNumeroFallback()).trim();
    const nombreFinal = nombre.trim() || "Cliente";
    const direccionFinal = buildDireccionFinal();
    const detalle = serializeCartToDetalle(cart);
    const domicilio = hasDelivery ? Number(valorDomicilio) || 0 : 0;

    const payload: any = {
      nombre: nombreFinal,
      direccion: direccionFinal,
      "detalle pedido": detalle,
      valor_restaurante: totalRestaurante,
      valor_domicilio: domicilio,
      metodo_pago: metodoPago,
      estado: "pidiendo",
      numero: numeroFinal,
    };

    try {
      const res = await fetch(MAKE_ORDER_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      showToast({ type: "success", msg: "Pedido guardado." });

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
      closeNoteModal();

      setTimeout(() => {
        onOrderSaved?.();
      }, 250);
    } catch (e) {
      console.error(e);
      showToast({ type: "error", msg: "No se pudo guardar el pedido." });
    }
  }, [
    cart,
    totalRestaurante,
    numero,
    nombre,
    buildDireccionFinal,
    hasDelivery,
    valorDomicilio,
    metodoPago,
    clearAll,
    showToast,
    closeNoteModal,
    onOrderSaved,
  ]);

  /** Atajos teclado */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (noteModalOpen) {
          e.preventDefault();
          closeNoteModal();
          return;
        }
        if (barrioOpen) setBarrioOpen(false);
        if (cartOpenMobile) setCartOpenMobile(false);
        return;
      }

      if (isTypingElement(e.target)) return;

      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveOrder();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        saveOrder();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveOrder, barrioOpen, cartOpenMobile, noteModalOpen, closeNoteModal]);

  /** ===== UI bits ===== */
  const ModePill = () => (
    <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
      <button
        onClick={() => setMode("mesa")}
        className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
          mode === "mesa" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-200"
        }`}
        aria-pressed={mode === "mesa"}
      >
        <Utensils size={16} /> Mesa
      </button>
      <button
        onClick={() => setMode("llevar")}
        className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
          mode === "llevar" ? "bg-amber-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
        }`}
        aria-pressed={mode === "llevar"}
      >
        <Package size={16} /> Domicilio
      </button>
      <button
        onClick={() => setMode("recoger")}
        className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
          mode === "recoger" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
        }`}
        aria-pressed={mode === "recoger"}
      >
        <Store size={16} /> Recoger
      </button>
    </div>
  );

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

  return (
    <div className="relative bg-slate-50">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90]">
          <div className={`${toastStyle(toast)} text-white px-4 py-2 rounded-xl shadow-xl text-sm font-bold`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* HEADER MAIN */}
      <div ref={headerRef} className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-3 [@media(max-height:820px)]:py-2">
          <div className="flex flex-col lg:flex-row gap-3 [@media(max-height:820px)]:gap-2 justify-between lg:items-center">
            <div className="flex flex-col sm:flex-row gap-3 [@media(max-height:820px)]:gap-2 sm:items-center w-full">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Sparkles size={18} className="text-amber-700" />
                </div>
                <div>
                  <div className="font-black text-slate-900 leading-tight">Pedido Manual</div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Atajos: Enter=Guardar • Ctrl+S
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full">
                <div className="relative w-full group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input
                    id="search-manual"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar (almuerzo, piquete, sopa, mojarra...)"
                    className="w-full pl-9 pr-10 py-2.5 [@media(max-height:820px)]:py-2 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/40 outline-none text-sm transition-all"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setTimeout(() => document.getElementById('search-manual')?.focus(), 0);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-none outline-none p-1 rounded-full hover:bg-slate-200 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <button
                  onClick={fetchMenu}
                  className={`p-2.5 [@media(max-height:820px)]:p-2 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-700 border border-slate-200 ${
                    loadingMenu ? "animate-spin" : ""
                  }`}
                  title="Recargar menú"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div className="flex gap-2 items-center w-full lg:w-auto">
              <ModePill />

              <button
                onClick={() => setCartOpenMobile(true)}
                className="lg:hidden shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold"
              >
                <ShoppingBag size={18} />
                <span className="text-sm">Caja{cartCount > 0 ? ` (${cartCount})` : ""}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORÍAS */}
      <div className="sticky z-40 bg-white/95 backdrop-blur border-b border-slate-200" style={{ top: headerH }}>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-4 [@media(max-height:820px)]:py-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 lg:gap-6 [@media(max-height:820px)]:lg:gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 [@media(max-height:820px)]:gap-2">
                {groupedMenu.map((group) => {
                  // PIQUETES
                  if (group.type === "piquete") {
                    return (
                      <div
                        key={group.id}
                        className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="px-4 py-3 [@media(max-height:820px)]:py-2 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100">
                          <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{group.title}</h3>
                        </div>

                        <div className="p-3 [@media(max-height:820px)]:p-2 grid grid-cols-2 gap-2">
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
                                className={`rounded-3xl border px-3 py-3 [@media(max-height:820px)]:py-2 text-left active:scale-[0.98] transition-all ${
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

                                <div className="mt-2 [@media(max-height:820px)]:mt-1.5">
                                  <QtyPill
                                    qty={qty}
                                    disabled={disabled}
                                    compact
                                    onPlus={() => addToCart(item)}
                                    onMinus={() => dec(id)}
                                  />
                                </div>

                                {qty > 0 && (
                                  <button
                                    onClick={(e) => {
                                      stop(e);
                                      openNoteModal(id);
                                    }}
                                    className="mt-2 w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs hover:bg-slate-100"
                                    title="Agregar comentario"
                                  >
                                    Comentario{noteById[id] ? " ✓" : ""}
                                  </button>
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
                      <div
                        key={group.id}
                        className="bg-white rounded-3xl border border-slate-200 shadow-sm sm:col-span-2 xl:col-span-3 overflow-hidden"
                      >
                        <button
                          onClick={() => toggleGroup(group.id)}
                          className="w-full flex justify-between items-center px-4 py-3 [@media(max-height:820px)]:py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
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
                          <div className="p-3 [@media(max-height:820px)]:p-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
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
                                  className={`rounded-3xl border px-3 py-3 [@media(max-height:820px)]:py-2 active:scale-[0.98] transition-all text-left ${
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

                                  {qty > 0 && (
                                    <button
                                      onClick={(e) => {
                                        stop(e);
                                        openNoteModal(id);
                                      }}
                                      className="mt-2 w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs hover:bg-slate-100"
                                      title="Agregar comentario"
                                    >
                                      Comentario{noteById[id] ? " ✓" : ""}
                                    </button>
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
                  const id = String(item.id);
                  const qty = qtyById[id] || 0;

                  return (
                    <button
                      key={group.id}
                      onClick={() => addToCart(item)}
                      disabled={disabled}
                      className={`bg-white rounded-3xl border shadow-sm p-4 [@media(max-height:820px)]:p-3 text-left active:scale-[0.99] transition-all ${
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

                      {qty > 0 && (
                        <button
                          onClick={(e) => {
                            stop(e);
                            openNoteModal(id);
                          }}
                          className="mt-3 w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs hover:bg-slate-100"
                          title="Agregar comentario"
                        >
                          Comentario{noteById[id] ? " ✓" : ""}
                        </button>
                      )}

                      <div className="mt-3 [@media(max-height:820px)]:mt-2 flex items-end justify-between border-t border-slate-100 pt-3 [@media(max-height:820px)]:pt-2">
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

          {/* CART DESKTOP */}
          <aside
            className="
              hidden lg:flex bg-white border border-slate-200 rounded-3xl overflow-hidden flex-col
              sticky top-[100px] min-h-[calc(100vh-140px)]
              [@media(max-height:820px)]:top-[84px]
              [@media(max-height:820px)]:min-h-[calc(100vh-120px)]
            "
          >
            <div className="p-4 [@media(max-height:820px)]:p-3 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        mode === "llevar" ? "bg-amber-500" : mode === "recoger" ? "bg-slate-900" : "bg-emerald-500"
                      }`}
                    />
                    <h2 className="font-extrabold text-slate-900">Caja</h2>
                  </div>
                </div>

                {cartCount > 0 && (
                  <div className="text-[11px] font-extrabold bg-slate-900 text-white px-2 py-1 rounded-full">
                    {cartCount} item{cartCount === 1 ? "" : "s"}
                  </div>
                )}
              </div>

              <div className="mt-3 [@media(max-height:820px)]:mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={clearAll}
                  className="py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-extrabold hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center justify-center"
                  title="Limpiar"
                >
                  <Trash2 size={18} />
                </button>

                <button
                  onClick={saveOrder}
                  className="py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-950 transition-colors flex items-center justify-center gap-2"
                  title="Guardar (Enter / Ctrl+S)"
                >
                  <Save size={18} /> Guardar
                </button>
              </div>

              <div className="mt-3 [@media(max-height:820px)]:mt-2 bg-slate-50 border border-slate-200 rounded-2xl p-3 [@media(max-height:820px)]:p-2.5">
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

              <div className="mt-4 [@media(max-height:820px)]:mt-3 grid gap-2">
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
                  <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                    <Phone size={14} className="text-slate-400 ml-3 shrink-0" />
                    <input
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Número (opcional)"
                      className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400 px-2 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => setNumero(prev => {
                        const n = prev.trim();
                        if (!n) return n;
                        if (n.endsWith('@s.whatsapp.net')) return n;
                        return n + '@s.whatsapp.net';
                      })}
                      className="shrink-0 text-[10px] font-black text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-2 transition-colors whitespace-nowrap h-full border-l border-slate-200"
                      title="Agregar @s.whatsapp.net al número"
                    >
                      @WA
                    </button>
                  </div>
                </div>

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
                              ${exactMatch.precio.toLocaleString("es-CO")}
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-full">
                              ${Number(valorDomicilio || 0).toLocaleString("es-CO")}
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
                                  ${d.precio.toLocaleString("es-CO")}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200">
                      <MessageSquare size={14} className="text-slate-400 mr-2" />
                      <input
                        value={direccionExacta}
                        onChange={(e) => setDireccionExacta(e.target.value)}
                        placeholder="Dirección exacta (ej: Cra 12 #34-56)"
                        className="bg-transparent text-sm w-full outline-none text-slate-800 placeholder-slate-400"
                      />
                    </div>

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

                <div className="mt-1">
                  <div className="text-[11px] font-extrabold text-slate-600 mb-2 flex items-center gap-2">
                    <CreditCard size={14} />
                    Método de pago
                  </div>
                  <PayPill />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 [@media(max-height:820px)]:p-2 [@media(max-height:820px)]:space-y-1.5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <ShoppingBag size={32} />
                  <p className="text-sm font-semibold">Carrito vacío</p>
                  <p className="text-[11px] text-slate-400">Agrega desde el menú.</p>
                </div>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.id} className="bg-white rounded-3xl border border-slate-200 p-3 [@media(max-height:820px)]:p-2.5 shadow-sm">
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

                      <div className="mt-3 [@media(max-height:820px)]:mt-2.5 flex justify-between items-center">
                        <div className="flex items-center bg-slate-100 rounded-2xl h-10 border border-slate-200 overflow-hidden">
                          <button
                            onClick={() => dec(item.id)}
                            className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700"
                            aria-label="Disminuir"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-10 text-center font-black text-sm text-slate-900 select-none">{item.quantity}</span>
                          <button
                            onClick={() => inc(item.id)}
                            className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700"
                            aria-label="Aumentar"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] text-slate-500 font-semibold">Línea</div>
                          <div className="font-black text-slate-900">{formatPrice(item.quantity * item.priceUnit)}</div>
                        </div>
                      </div>

                      <div className="mt-3 [@media(max-height:820px)]:mt-2.5 relative">
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
                      {detalleOpen ? (
                        <ChevronUp size={16} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-500" />
                      )}
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

      {/* MOBILE */}
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
                {cartCount > 0 && <span className="ml-1 text-[11px] bg-white/15 px-2 py-0.5 rounded-full">{cartCount}</span>}
              </div>
              <div className="text-sm">{formatPrice(totalFinal)}</div>
            </button>
          </div>
        </div>

        {cartOpenMobile && (
          <div className="fixed inset-0 z-[80]">
            <button onClick={() => setCartOpenMobile(false)} className="absolute inset-0 bg-black/35" aria-label="Cerrar" />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] border-t border-slate-200 shadow-2xl max-h-[88vh] flex flex-col">
              <div className="px-4 pt-4 pb-3 border-b border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">Caja</div>
                    <div className="text-[11px] text-slate-500">Botones arriba • Ajusta con +/- • Esc para cerrar</div>
                  </div>
                  <button
                    onClick={() => setCartOpenMobile(false)}
                    className="p-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700"
                    title="Cerrar"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={clearAll}
                    className="py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-extrabold hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center justify-center"
                    title="Limpiar"
                  >
                    <Trash2 size={18} />
                  </button>

                  <button
                    onClick={saveOrder}
                    className="py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-950 transition-colors flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> Guardar
                  </button>
                </div>

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
                        {detalleOpen ? (
                          <ChevronUp size={16} className="text-slate-500" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-500" />
                        )}
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

      {/* MODAL COMENTARIO */}
      {noteModalOpen && noteModalItemId && (
        <div className="fixed inset-0 z-[95]">
          <button className="absolute inset-0 bg-black/40" onClick={closeNoteModal} aria-label="Cerrar comentario" />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="font-black text-slate-900">Comentario</div>
              <button
                onClick={closeNoteModal}
                className="p-2 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                title="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              <div className="text-[11px] text-slate-500 font-semibold mb-2">
                Nota para el producto (ej: sin ensalada, con ají)
              </div>

              <div className="relative">
                <MessageSquare size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  autoFocus
                  value={currentNote}
                  onChange={(e) => setNote(noteModalItemId, e.target.value)}
                  placeholder="Escribe el comentario..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-3 text-sm focus:ring-2 focus:ring-amber-500/40 outline-none text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNote(noteModalItemId, "")}
                  className="py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-extrabold hover:bg-slate-200"
                >
                  Limpiar
                </button>
                <button
                  onClick={closeNoteModal}
                  className="py-2.5 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-950"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="lg:hidden h-[84px]" />
    </div>
  );
};

export default Manual;
