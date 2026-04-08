import React from "react";
import { useManualOrder } from "../useManualState";
import { formatPrice } from "../../../utils/dateUtils";
import { QtyPill } from "./QtyPill";
import { computeUnitPrice } from "../utils";
import { ChevronUp, ChevronDown, PlusCircle } from "lucide-react";

export const MenuSection: React.FC<{ state: ReturnType<typeof useManualOrder> }> = ({ state }) => {
  const {
    loadingMenu, groupedMenu, addToCart, isTakeaway, qtyById, dec, noteById, openNoteModal,
    expanded, toggleGroup
  } = state;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
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
                        <div
                          key={id}
                          onClick={() => addToCart(item)}
                          className={`rounded-3xl border px-3 py-3 [@media(max-height:820px)]:py-2 text-left active:scale-[0.98] transition-all cursor-pointer ${
                            disabled
                              ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60"
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

                          <div className="mt-2 [@media(max-height:820px)]:mt-1.5" onClick={stop}>
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
                        </div>
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
                    {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </button>

                  {isOpen && (
                    <div className="p-3 [@media(max-height:820px)]:p-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                      {group.items.map((item) => {
                        const unit = computeUnitPrice(item, isTakeaway);
                        const disabled = !item.disponible;
                        const id = String(item.id);
                        const qty = qtyById[id] || 0;

                        return (
                          <div
                            key={id}
                            onClick={() => addToCart(item)}
                            className={`rounded-3xl border px-3 py-3 [@media(max-height:820px)]:py-2 active:scale-[0.98] transition-all text-left cursor-pointer ${
                              disabled
                                ? "bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-60"
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

                              <div className="shrink-0" onClick={stop}>
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
                          </div>
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
              <div
                key={group.id}
                onClick={() => !disabled && addToCart(item)}
                className={`bg-white rounded-3xl border shadow-sm p-4 [@media(max-height:820px)]:p-3 text-left active:scale-[0.99] transition-all cursor-pointer ${
                  disabled
                    ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50 opacity-60"
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

                  <div className="shrink-0" onClick={stop}>
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
