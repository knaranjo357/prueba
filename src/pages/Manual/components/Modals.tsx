import React from "react";
import { X, PlusCircle, Package, Banknote, Minus, Plus, MessageSquare, ShoppingBag } from "lucide-react";
import { useManualOrder } from "../useManualState";

export const Modals: React.FC<{ state: ReturnType<typeof useManualOrder> }> = ({ state }) => {
  const {
    noteModalOpen, noteModalItemId, closeNoteModal, currentNote, setNote,
    customModalOpen, closeCustomModal, customName, setCustomName, customValue,
    setCustomValue, customQty, setCustomQty, customNote, setCustomNote, handleAddCustomItem
  } = state;

  return (
    <>
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

      {/* MODAL ÍTEM MANUAL */}
      {customModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <button className="absolute inset-0 bg-black/40" onClick={closeCustomModal} aria-label="Cerrar modal" />
          <div className="relative w-[92vw] max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col rounded-t-3xl">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-amber-600">
                  <PlusCircle size={18} />
                  <span className="font-extrabold text-slate-900 text-base">Ítem Manual</span>
                </div>
                <button onClick={closeCustomModal} className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold leading-snug">
                Configura un producto personalizado que no está en el menú.
              </p>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5 ml-1">Nombre del producto</label>
                <div className="relative">
                  <Package size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    autoFocus
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ej: Porción adicional de arroz"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-amber-500/40 outline-none text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5 ml-1">Precio Unitario</label>
                  <div className="relative">
                    <Banknote size={14} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="number"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-amber-500/40 outline-none text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5 ml-1">Cantidad</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl h-[42px] overflow-hidden">
                    <button
                      onClick={() => setCustomQty((q) => Math.max(1, (parseInt(q, 10) || 1) - 1).toString())}
                      className="w-10 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value.replace(/\D/g, ""))}
                      className="flex-1 w-full bg-transparent text-center font-black text-sm outline-none"
                    />
                    <button
                      onClick={() => setCustomQty((q) => ((parseInt(q, 10) || 0) + 1).toString())}
                      className="w-10 h-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5 ml-1">Nota (opcional)</label>
                <div className="relative">
                  <MessageSquare size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Ej: Empacado por separado"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-amber-500/40 outline-none text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white rounded-b-3xl">
              <button
                onClick={handleAddCustomItem}
                className="w-full py-3 rounded-2xl bg-amber-500 text-white font-extrabold text-sm hover:bg-amber-600 transition-all flex justify-center items-center gap-2 shadow-md shadow-amber-500/20 active:scale-[0.98]"
              >
                <ShoppingBag size={18} /> Agregar a Caja
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
