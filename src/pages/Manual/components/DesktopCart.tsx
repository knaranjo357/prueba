import React from "react";
import { Trash2, Save, ShoppingBag, Minus, Plus, MessageSquare, ChevronUp, ChevronDown, PlusCircle } from "lucide-react";
import { formatPrice } from "../../../utils/dateUtils";
import { useManualOrder } from "../useManualState";
import { OrderFormFields } from "./OrderFormFields";
import { toInt } from "../utils";

export const DesktopCart: React.FC<{ state: ReturnType<typeof useManualOrder> }> = ({ state }) => {
  const {
    mode, cartCount, clearAll, saveOrder, totalRestaurante,
    hasDelivery, valorDomicilio, totalFinal, cart, isTakeaway,
    remove, dec, inc, setNote, detalleOpen, setDetalleOpen,
    detallePreview, updateItem, setCustomModalOpen
  } = state;

  return (
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

        <OrderFormFields state={state} />
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
              <div key={item.id} className="bg-white rounded-3xl border border-slate-200 p-3 [@media(max-height:820px)]:p-2.5 shadow-sm group hover:border-amber-200 transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      className="font-extrabold text-slate-900 text-sm w-full bg-transparent outline-none border-b border-transparent group-hover:border-slate-200 focus:border-amber-400 transition-colors leading-tight focus:bg-amber-50 px-1 py-0.5 rounded cursor-text"
                      placeholder="Nombre del producto"
                    />
                    <div className="flex items-center mt-1 px-1 flex-wrap gap-y-1">
                      <span className="text-[11px] text-slate-500 font-black mr-1">$</span>
                      <input
                        type="number"
                        value={item.priceUnit || ""}
                        onChange={(e) => {
                          const val = toInt(e.target.value);
                          updateItem(item.id, { priceUnit: val, baseValor: val - (isTakeaway ? (item.extraLlevar || 0) : 0) });
                        }}
                        className="text-[11px] text-slate-500 font-black bg-transparent outline-none border-b border-transparent group-hover:border-slate-200 focus:border-amber-400 w-16 transition-colors focus:bg-amber-50 px-1 py-0.5 rounded cursor-text"
                        placeholder="Precio"
                      />
                      <span className="text-[11px] text-slate-500 ml-1">c/u</span>
                      {isTakeaway && (
                        <span className="ml-2 flex items-center text-amber-700 font-extrabold text-[11px]">
                          (+ $
                          <input
                            type="number"
                            value={item.extraLlevar ?? ""}
                            onChange={(e) => {
                              const extra = toInt(e.target.value);
                              updateItem(item.id, { extraLlevar: extra, priceUnit: (item.baseValor || 0) + extra });
                            }}
                            className="text-[11px] text-amber-700 font-black bg-transparent outline-none border-b border-transparent group-hover:border-amber-200 focus:border-amber-400 w-12 text-center transition-colors focus:bg-amber-50 px-0.5 py-0.5 rounded cursor-text mx-1"
                            placeholder="0"
                          />
                          icopor)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="p-2 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-2"
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
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center font-black text-sm text-slate-900 select-none">{item.quantity}</span>
                    <button
                      onClick={() => inc(item.id)}
                      className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="text-right px-1">
                    <div className="text-[11px] text-slate-500 font-semibold">Línea</div>
                    <div className="font-black text-slate-900">{formatPrice(item.quantity * item.priceUnit)}</div>
                  </div>
                </div>

                <div className="mt-3 [@media(max-height:820px)]:mt-2.5 relative">
                  <MessageSquare size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    value={item.notes}
                    onChange={(e) => setNote(item.id, e.target.value)}
                    placeholder="Nota (ej: sin ensalada, con ají)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-3 text-sm focus:ring-2 focus:ring-amber-500/40 outline-none text-slate-800 placeholder-slate-400 transition-all focus:bg-white"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={() => setCustomModalOpen(true)}
              className="w-full py-2.5 my-2 rounded-2xl border border-dashed border-slate-300 bg-transparent text-slate-500 hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <PlusCircle size={16} /> Agregar Ítem Manual
            </button>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setDetalleOpen((v) => !v)}
                className="w-full px-3 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
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
  );
};
