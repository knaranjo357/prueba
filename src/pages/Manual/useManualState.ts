import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MenuItemFull, CartItem, DomicilioRow, ToastType, Mode, MenuGroup } from "./types";
import {
  norm,
  toInt,
  computeUnitPrice,
  groupBaseNameForPiquete,
  serializeCartToDetalle,
  parseDetailsForView,
  makeNumeroFallback,
  isTypingElement
} from "./utils";

const MENU_FULL_API = "https://n8n.alliasoft.com/webhook/luis-res/menu-completo";
const MAKE_ORDER_API = "https://n8n.alliasoft.com/webhook/luis-res/hacer-pedido";
const DOMICILIOS_API = "https://n8n.alliasoft.com/webhook/luis-res/domicilios";

export const useManualOrder = (onOrderSaved?: () => void) => {
  const [mode, setMode] = useState<Mode>("llevar");
  const isTakeaway = mode !== "mesa";
  const hasDelivery = mode === "llevar";

  const [menuItems, setMenuItems] = useState<MenuItemFull[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const [domicilios, setDomicilios] = useState<DomicilioRow[]>([]);
  const [loadingDomicilios, setLoadingDomicilios] = useState(false);
  const [barrioOpen, setBarrioOpen] = useState(false);
  const barrioCloseTimer = useRef<number | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpenMobile, setCartOpenMobile] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalItemId, setNoteModalItemId] = useState<string | null>(null);

  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customNote, setCustomNote] = useState("");

  const [nombre, setNombre] = useState("");
  const [numero, setNumero] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");

  const [mesaLugar, setMesaLugar] = useState("");
  const [barrio, setBarrio] = useState("");
  const [direccionExacta, setDireccionExacta] = useState("");
  const [recogerEn, setRecogerEn] = useState("");
  const [valorDomicilio, setValorDomicilio] = useState(0);

  const [toast, setToast] = useState<ToastType>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((t: ToastType) => {
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

  const openNoteModal = useCallback((id: string) => {
    setNoteModalItemId(id);
    setNoteModalOpen(true);
  }, []);

  const closeNoteModal = useCallback(() => {
    setNoteModalOpen(false);
    setNoteModalItemId(null);
  }, []);

  const closeCustomModal = useCallback(() => {
    setCustomModalOpen(false);
    setCustomName("");
    setCustomValue("");
    setCustomQty("1");
    setCustomNote("");
  }, []);

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
      showToast({ type: "error", msg: "No se pudieron cargar domicilios." });
    } finally {
      setLoadingDomicilios(false);
    }
    return () => controller.abort();
  }, [showToast]);

  useEffect(() => {
    fetchMenu();
    fetchDomicilios();
  }, [fetchMenu, fetchDomicilios]);

  useEffect(() => {
    if (mode === "llevar" && domicilios.length === 0 && !loadingDomicilios) {
      fetchDomicilios();
    }
    if (mode !== "llevar") setValorDomicilio(0);
    if (mode === "recoger") setValorDomicilio(0);
  }, [mode, domicilios.length, loadingDomicilios, fetchDomicilios]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((it) => (it.categorias || []).forEach((c) => set.add(c)));
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "es"))];
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return menuItems.filter((item) => {
      const inSearch = !term || (item.nombre || "").toLowerCase().includes(term);
      const inCat = selectedCategory === "Todas" || (item.categorias || []).includes(selectedCategory);
      return inSearch && inCat;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  const groupedMenu = useMemo(() => {
    const groups: MenuGroup[] = [];
    const processed = new Set<string>();

    const almuerzos = filteredMenuItems.filter((i) =>
      (i.nombre || "").toLowerCase().startsWith("almuerzo")
    );
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
      if (!processed.has(String(item.id))) {
        groups.push({ id: String(item.id), type: "single", title: item.nombre, items: [item] });
      }
    });

    return groups;
  }, [filteredMenuItems]);

  const menuById = useMemo(() => {
    const m = new Map<string, MenuItemFull>();
    menuItems.forEach((it) => m.set(String(it.id), it));
    return m;
  }, [menuItems]);

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

  const totalRestaurante = useMemo(
    () => cart.reduce((acc, it) => acc + (Number(it.priceUnit) || 0) * (Number(it.quantity) || 0), 0),
    [cart]
  );
  const totalFinal = useMemo(
    () => totalRestaurante + (hasDelivery ? Number(valorDomicilio) || 0 : 0),
    [totalRestaurante, valorDomicilio, hasDelivery]
  );

  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    cart.forEach((c) => (m[c.id] = (m[c.id] || 0) + (c.quantity || 0)));
    return m;
  }, [cart]);

  const noteById = useMemo(() => {
    const m: Record<string, string> = {};
    cart.forEach((c) => (m[c.id] = c.notes || ""));
    return m;
  }, [cart]);

  const currentNote = noteModalItemId ? noteById[noteModalItemId] || "" : "";
  const cartCount = useMemo(() => cart.reduce((acc, it) => acc + (it.quantity || 0), 0), [cart]);

  const addToCart = useCallback((item: MenuItemFull) => {
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
  }, [isTakeaway]);

  const inc = useCallback((id: string) => setCart((p) => p.map((x) => (x.id === id ? { ...x, quantity: x.quantity + 1 } : x))), []);
  const dec = useCallback((id: string) => setCart((p) => p.map((x) => (x.id === id ? { ...x, quantity: x.quantity - 1 } : x)).filter((x) => x.quantity > 0)), []);
  const remove = useCallback((id: string) => setCart((p) => p.filter((x) => x.id !== id)), []);
  const setNote = useCallback((id: string, note: string) => setCart((p) => p.map((x) => (x.id === id ? { ...x, notes: note } : x))), []);
  const clearAll = useCallback(() => setCart([]), []);
  const toggleGroup = useCallback((id: string) => setExpanded((p) => ({ ...p, [id]: !(p[id] ?? true) })), []);
  const updateItem = useCallback((id: string, updates: Partial<CartItem>) => setCart((p) => p.map((x) => (x.id === id ? { ...x, ...updates } : x))), []);

  const handleAddCustomItem = useCallback(() => {
    const val = toInt(customValue);
    const q = parseInt(customQty, 10) || 1;
    const name = customName.trim() || "Ítem Especial";
    setCart((prev) => [
      ...prev,
      { id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, name, quantity: q > 0 ? q : 1, baseValor: val, extraLlevar: 0, priceUnit: val, notes: customNote.trim() }
    ]);
    closeCustomModal();
  }, [customName, customValue, customQty, customNote, closeCustomModal]);

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
    if (hasDelivery && exactMatch && (Number(valorDomicilio) || 0) !== (Number(exactMatch.precio) || 0)) {
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

  const detallePreview = useMemo(() => {
    const raw = serializeCartToDetalle(cart);
    const parsed = parseDetailsForView(raw);
    return { raw, parsed };
  }, [cart]);

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
      setTimeout(() => onOrderSaved?.(), 250);
    } catch (e) {
      console.error(e);
      showToast({ type: "error", msg: "No se pudo guardar el pedido." });
    }
  }, [cart, totalRestaurante, numero, nombre, buildDireccionFinal, hasDelivery, valorDomicilio, metodoPago, clearAll, showToast, closeNoteModal, onOrderSaved]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (noteModalOpen) { e.preventDefault(); closeNoteModal(); return; }
        if (barrioOpen) setBarrioOpen(false);
        if (cartOpenMobile) setCartOpenMobile(false);
        return;
      }
      if (isTypingElement(e.target)) return;
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === "s") { e.preventDefault(); saveOrder(); return; }
      if (e.key === "Enter") { e.preventDefault(); saveOrder(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveOrder, barrioOpen, cartOpenMobile, noteModalOpen, closeNoteModal]);

  return {
    mode, setMode, isTakeaway, hasDelivery,
    menuItems, loadingMenu, fetchMenu,
    domicilios, loadingDomicilios, exactMatch, barrioSuggestions, barrioOpen, setBarrioOpen, onBarrioFocus, onBarrioBlur, selectBarrio,
    searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, allCategories,
    expanded, toggleGroup, groupedMenu,
    cart, cartCount, cartOpenMobile, setCartOpenMobile, detalleOpen, setDetalleOpen, qtyById, noteById, currentNote,
    toast, setToast,
    totalRestaurante, totalFinal,
    noteModalOpen, noteModalItemId, openNoteModal, closeNoteModal,
    customModalOpen, setCustomModalOpen, customName, setCustomName, customValue, setCustomValue, customQty, setCustomQty, customNote, setCustomNote, closeCustomModal, handleAddCustomItem,
    nombre, setNombre, numero, setNumero, metodoPago, setMetodoPago,
    mesaLugar, setMesaLugar, barrio, setBarrio, direccionExacta, setDireccionExacta, recogerEn, setRecogerEn, valorDomicilio, setValorDomicilio,
    addToCart, inc, dec, remove, setNote, clearAll, updateItem,
    detallePreview, buildDireccionFinal, saveOrder
  };
};
