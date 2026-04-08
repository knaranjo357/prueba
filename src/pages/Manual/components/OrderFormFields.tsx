import React from "react";
import { User, Phone, MapPin, Store, MessageSquare, CreditCard, Banknote, ArrowLeftRight } from "lucide-react";
import { useManualOrder } from "../useManualState";

export const OrderFormFields: React.FC<{ state: ReturnType<typeof useManualOrder> }> = ({ state }) => {
  const {
    mode, nombre, setNombre, numero, setNumero, mesaLugar, setMesaLugar,
    recogerEn, setRecogerEn, barrio, setBarrio, barrioOpen, setBarrioOpen,
    onBarrioFocus, onBarrioBlur, loadingDomicilios, exactMatch, valorDomicilio,
    barrioSuggestions, selectBarrio, direccionExacta, setDireccionExacta,
    setValorDomicilio, buildDireccionFinal, metodoPago, setMetodoPago, hasDelivery
  } = state;

  const toInt = (val: string | number) => {
    const v = parseInt(String(val).replace(/[^0-9-]/g, ""), 10);
    return isNaN(v) ? 0 : v;
  };

  const PayPill = () => (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => setMetodoPago("efectivo")}
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-2xl border font-extrabold text-sm transition-all ${
          metodoPago === "efectivo"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
      >
        <Banknote size={16} /> Efectivo
      </button>
      <button
        onClick={() => setMetodoPago("transferencia")}
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-2xl border font-extrabold text-sm transition-all ${
          metodoPago === "transferencia"
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
      >
        <ArrowLeftRight size={16} /> Transferencia
      </button>
    </div>
  );

  return (
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
              value={valorDomicilio || ""}
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
          <CreditCard size={14} />Método de pago
        </div>
        <PayPill />
      </div>
    </div>
  );
};
