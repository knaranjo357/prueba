import React from "react";
import { Trash2, Save, ShoppingBag, Minus, Plus, MessageSquare, X } from "lucide-react";
import { formatPrice } from "../../../utils/dateUtils";
import { useManualOrder } from "../useManualState";
import { OrderFormFields } from "./OrderFormFields";
import { toInt } from "../utils";
export const MobileCart: React.FC<{ state: ReturnType<typeof useManualOrder> }> = ({ state }) => {
  const {
    cartOpenMobile, setCartOpenMobile, cartCount, totalFinal,
    clearAll, saveOrder, totalRestaurante, hasDelivery, valorDomicilio,
    cart, isTakeaway, remove, dec, inc, setNote, updateItem
  } = state;

  return (
    <>
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-50">
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
      </div>

      {cartOpenMobile && (
        <div className="fixed inset-0 z-[80]">
          <button onClick={() => setCartOpenMobile(false)} className="absolute inset-0 bg-black/35" aria-label="Cerrar" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] border-t border-slate-200 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-slate-900">Caja</div>
                  <div className="text-[11px] text-slate-500">Ajusta con +/- • Esc para cerrar</div>
                </div>
                <button
                  onClick={() => setCartOpenMobile(false)}
                  className="p-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={clearAll}
                  className="py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-extrabold hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center justify-center"
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

            <div className="flex-1 overflow-y-auto p-3 bg-slate-50 flex flex-col gap-3">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-extrabold text-sm text-slate-900 mb-2">Datos de entrega / cliente</h3>
                <OrderFormFields state={state} />
              </div>
              
              <div className="space-y-2 mt-1">
                <h3 className="font-extrabold text-sm text-slate-900 px-1 border-b border-slate-200 pb-2 mb-2">Productos</h3>
                {cart.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <ShoppingBag className="mx-auto mb-2 opacity-50" size={32} />
                    <p className="font-semibold text-sm">Carrito vacío</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="bg-white rounded-3xl border border-slate-200 p-3 shadow-sm transition-colors group">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1 group">
                          <input
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            className="font-extrabold text-slate-900 text-sm leading-tight w-full bg-transparent outline-none border-b border-transparent group-hover:border-slate-200 focus:border-amber-400 transition-colors focus:bg-amber-50 px-1 py-0.5 rounded cursor-text"
                            placeholder="Nombre del producto"
                          />
                          <div className="flex items-center mt-1 px-1 flex-wrap gap-y-1">
                            <span className="text-[11px] text-slate-500 font-bold mr-1">$</span>
                            <input
                              type="number"
                              value={item.priceUnit || ""}
                              onChange={(e) => {
                                const val = toInt(e.target.value);
                                updateItem(item.id, { priceUnit: val, baseValor: val - (isTakeaway ? (item.extraLlevar || 0) : 0) });
                              }}
                              className="text-[11px] text-slate-500 font-bold bg-transparent outline-none border-b border-transparent group-hover:border-slate-200 focus:border-amber-400 w-16 transition-colors focus:bg-amber-50 px-1 py-0.5 rounded cursor-text"
                              placeholder="Precio"
                            />
                            <span className="text-[11px] text-slate-500 ml-1">c/u</span>
                            {isTakeaway && (
                              <span className="ml-2 flex items-center text-amber-700 font-bold text-[11px]">
                                (+ $
                                <input
                                  type="number"
                                  value={item.extraLlevar ?? ""}
                                  onChange={(e) => {
                                    const extra = toInt(e.target.value);
                                    updateItem(item.id, { extraLlevar: extra, priceUnit: (item.baseValor || 0) + extra });
                                  }}
                                  className="text-[11px] text-amber-700 font-bold bg-transparent outline-none border-b border-transparent group-hover:border-slate-200 focus:border-amber-400 w-12 text-center transition-colors focus:bg-amber-50 px-0.5 py-0.5 rounded cursor-text mx-1"
                                  placeholder="0"
                                />
                                icopor)
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => remove(item.id)}
                          className="p-2 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors bg-slate-50"
                          title="Quitar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="mt-3 flex justify-between items-center">
                        <div className="flex items-center bg-slate-100 rounded-2xl h-10 border border-slate-200 overflow-hidden shadow-inner">
                          <button
                            onClick={() => dec(item.id)}
                            className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 transition"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-10 text-center font-black text-sm text-slate-900">{item.quantity}</span>
                          <button
                            onClick={() => inc(item.id)}
                            className="w-11 h-full flex items-center justify-center hover:bg-slate-200 text-slate-700 transition"
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
                  ))
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-white">
              <button
                onClick={() => setCartOpenMobile(false)}
                className="w-full py-3 rounded-3xl bg-slate-100 text-slate-800 font-extrabold hover:bg-slate-200 transition-colors"
              >
                Seguir agregando
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
