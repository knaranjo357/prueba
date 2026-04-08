import React, { useEffect, useRef, useState } from "react";
import { Search, RefreshCw, Filter, Utensils, Package, Store, Sparkles, X } from "lucide-react";

import { useManualOrder } from "./useManualState";
import { MenuSection } from "./components/MenuSection";
import { DesktopCart } from "./components/DesktopCart";
import { MobileCart } from "./components/MobileCart";
import { Modals } from "./components/Modals";

export const Manual: React.FC<{ onOrderSaved?: () => void }> = ({ onOrderSaved }) => {
  const state = useManualOrder(onOrderSaved);

  const {
    toast, mode, setMode, headerH,
    searchTerm, setSearchTerm, fetchMenu, loadingMenu,
    allCategories, selectedCategory, setSelectedCategory,
  } = {
    ...state,
    headerH: useHeaderHeight(), // a small custom hook we use inline below
  };

  const ModePill = () => (
    <div className="flex bg-slate-100 p-1 rounded-[1.25rem] w-full lg:w-auto shadow-inner border border-slate-200/50">
      <button
        onClick={() => setMode("mesa")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[0.9rem] text-[13px] font-black transition-all ${
          mode === "mesa" ? "bg-white text-slate-900 shadow-sm border border-slate-200/60" : "text-slate-500 hover:bg-slate-200/70"
        }`}
      >
        <Utensils size={14} className={mode === 'mesa' ? 'text-emerald-600' : ''} /> <span className="hidden xs:inline">Mesa</span><span className="xs:hidden">Mesa</span>
      </button>
      <button
        onClick={() => setMode("llevar")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[0.9rem] text-[13px] font-black transition-all ${
          mode === "llevar" ? "bg-amber-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200/70"
        }`}
      >
        <Package size={14} /> <span className="hidden xs:inline">Domicilio</span><span className="xs:hidden">Dom.</span>
      </button>
      <button
        onClick={() => setMode("recoger")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-[0.9rem] text-[13px] font-black transition-all ${
          mode === "recoger" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200/70"
        }`}
      >
        <Store size={14} /> <span className="hidden xs:inline">Recoger</span><span className="xs:hidden">Rec.</span>
      </button>
    </div>
  );

  return (
    <div className="relative bg-slate-50">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90]">
          <div
            className={`text-white px-4 py-2 rounded-xl shadow-xl text-sm font-bold opacity-100 transition-opacity ${
              toast.type === "success" ? "bg-emerald-600" : toast.type === "error" ? "bg-rose-600" : "bg-slate-900"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* HEADER MAIN */}
      <Header ref={headerH.ref}>
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
                    placeholder="Buscar (almuerzo, piquete, sopa...)"
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
            </div>
          </div>
        </div>
      </Header>

      {/* CATEGORÍAS */}
      <div className="sticky z-40 bg-white/95 backdrop-blur border-b border-slate-200" style={{ top: headerH.height }}>
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
          <MenuSection state={state} />
          <DesktopCart state={state} />
        </div>
      </div>

      <MobileCart state={state} />
      <Modals state={state} />
    </div>
  );
};

export default Manual;

// Utils helper to calculate dynamic sticky header height
const useHeaderHeight = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const update = () => setHeight(ref.current!.getBoundingClientRect().height);
    update();
    const RO = (window as any).ResizeObserver;
    let ro: any;
    if (RO) {
      ro = new RO(() => update());
      ro.observe(ref.current);
    }
    window.addEventListener("resize", update);
    return () => {
      try { if (ro) ro.disconnect(); } catch {}
      window.removeEventListener("resize", update);
    };
  }, []);

  return { height, ref };
};

const Header = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => (
  <div ref={ref} className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
    {children}
  </div>
));
Header.displayName = "Header";
