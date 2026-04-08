import React from "react";
import { Minus, Plus } from "lucide-react";

const stop = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export const QtyPill: React.FC<{
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
        onClick={(e) => { stop(e); onPlus(); }}
        className={`inline-flex items-center gap-2 ${compact ? "px-3 py-1.5" : "px-4 py-2"} rounded-full bg-amber-600 text-white font-extrabold hover:bg-amber-700 active:scale-[0.98] transition-all`}
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
        onClick={(e) => { stop(e); onMinus(); }}
        title="Quitar"
        aria-label="Quitar"
      >
        <Minus size={compact ? 14 : 16} />
      </button>
      <div className={`${mid} ${txt} font-black tabular-nums select-none`}>{qty}</div>
      <button
        className={`${btn} flex items-center justify-center hover:bg-white/10 active:bg-white/15`}
        onClick={(e) => { stop(e); onPlus(); }}
        title="Agregar"
        aria-label="Agregar"
      >
        <Plus size={compact ? 14 : 16} />
      </button>
    </div>
  );
};
