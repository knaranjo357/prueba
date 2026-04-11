import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Bot,
  Eye,
  Copy,
  Check,
  X,
  FileText,
} from 'lucide-react';

export interface PromptFragment {
  id: string;
  text: string;
  agentIds: string[];
}

export const PROMPT_AGENTS = [
  { id: 'agente almuerzo semana', name: 'Almuerzo Semana', short: 'Semana', activeBg: 'bg-violet-600', activeText: 'text-violet-700', lightBg: 'bg-violet-50', border: 'border-violet-300' },
  { id: 'agente almuerzo sabado', name: 'Almuerzo Sábado', short: 'Sábado', activeBg: 'bg-blue-600', activeText: 'text-blue-700', lightBg: 'bg-blue-50', border: 'border-blue-300' },
  { id: 'agente almuerzo domingo', name: 'Almuerzo Domingo', short: 'Domingo', activeBg: 'bg-emerald-600', activeText: 'text-emerald-700', lightBg: 'bg-emerald-50', border: 'border-emerald-300' },
  { id: 'agente almuerzo festivos', name: 'Almuerzo Festivos', short: 'Festivos', activeBg: 'bg-amber-500', activeText: 'text-amber-700', lightBg: 'bg-amber-50', border: 'border-amber-300' },
  { id: 'agente comida', name: 'Cena (Noche)', short: 'Noche', activeBg: 'bg-pink-600', activeText: 'text-pink-700', lightBg: 'bg-pink-50', border: 'border-pink-300' },
  { id: 'agente cerrado', name: 'Cerrado', short: 'Cerrado', activeBg: 'bg-red-600', activeText: 'text-red-700', lightBg: 'bg-red-50', border: 'border-red-300' },
  { id: 'agente comodin', name: 'Comodín', short: 'Comodín', activeBg: 'bg-gray-600', activeText: 'text-gray-600', lightBg: 'bg-gray-100', border: 'border-gray-300' },
];

/* ────────────────────────────────────────────────────────
   Modal: muestra y permite copiar el prompt compilado
──────────────────────────────────────────────────────── */
interface PreviewModalProps {
  initialAgentId: string;
  fragments: PromptFragment[];
  onClose: () => void;
}

function PreviewModal({ initialAgentId, fragments, onClose }: PreviewModalProps) {
  const [activeId, setActiveId] = useState(initialAgentId);
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const agent = PROMPT_AGENTS.find(a => a.id === activeId)!;

  const compiled = useMemo(() =>
    fragments
      .filter(f => f.agentIds.includes(activeId))
      .map(f => f.text)
      .filter(t => t.trim())
      .join('\n\n'),
    [fragments, activeId]
  );

  const copy = async () => {
    if (!compiled) return;
    try {
      await navigator.clipboard.writeText(compiled);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      textRef.current?.select();
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-purple-600" />
            <span className="font-bold text-gray-800 text-base">Vista de Prompt</span>
            <span className={`ml-2 text-xs font-bold px-2.5 py-1 rounded-full ${agent.lightBg} ${agent.activeText} ${agent.border} border`}>
              {agent.name}
            </span>
          </div>
          <button
            type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50 px-4 gap-1 py-2">
          {PROMPT_AGENTS.map(a => {
            const count = fragments.filter(f => f.agentIds.includes(a.id)).length;
            const isActive = a.id === activeId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveId(a.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${isActive
                    ? `${a.activeBg} text-white shadow-sm`
                    : 'text-gray-500 hover:bg-gray-200'
                  }`}
              >
                {a.short}
                {count > 0 && (
                  <span className={`text-[10px] font-black px-1 rounded-full ${isActive ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
          {compiled ? (
            <textarea
              ref={textRef}
              readOnly
              value={compiled}
              className="flex-1 w-full font-mono text-sm leading-relaxed text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-4 resize-none outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-500/10 transition-all"
              style={{ minHeight: 200 }}
              onClick={e => (e.target as HTMLTextAreaElement).select()}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <Bot size={28} className="text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">Sin contenido para este agente</p>
              <p className="text-xs text-gray-400 mt-1">Asigna fragmentos al agente <strong>{agent.name}</strong></p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {compiled && (
                <>
                  <span className="text-[11px] text-gray-400 font-medium">{compiled.length} chars</span>
                  <span className="text-gray-200">•</span>
                  <span className="text-[11px] text-gray-400 font-medium">
                    ~{compiled.split(/\s+/).filter(Boolean).length} palabras
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={copy}
              disabled={!compiled}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${copied
                  ? 'bg-green-600 text-white'
                  : compiled
                    ? 'bg-gray-900 hover:bg-black text-white shadow-sm hover:scale-105 transform'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copiado' : 'Copiar prompt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   FragmentCard: tarieta de escritura compacta y limpia
──────────────────────────────────────────────────────── */
interface FragmentCardProps {
  fragment: PromptFragment;
  index: number;
  total: number;
  onUpdate: (id: string, u: Partial<PromptFragment>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onPreview: (agentId: string) => void;
}

function FragmentCard({ fragment, index, total, onUpdate, onDelete, onMoveUp, onMoveDown, onPreview }: FragmentCardProps) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Usamos un pequeño truco para evitar el salto de scroll al ajustar altura
      const currentHeight = textarea.style.height;
      textarea.style.height = 'auto';
      const newHeight = textarea.scrollHeight;
      
      // Solo aplicamos si hay cambio real para evitar layouts innecesarios
      if (currentHeight !== `${newHeight}px`) {
        textarea.style.height = `${newHeight}px`;
      } else {
        textarea.style.height = currentHeight;
      }
    }
  }, [fragment.text]);

  useEffect(() => {
    const handler = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const toggleAgent = (agentId: string) => {
    const newIds = fragment.agentIds.includes(agentId)
      ? fragment.agentIds.filter(id => id !== agentId)
      : [...fragment.agentIds, agentId];
    onUpdate(fragment.id, { agentIds: newIds });
  };

  const toggleAll = () => {
    onUpdate(fragment.id, {
      agentIds: fragment.agentIds.length === PROMPT_AGENTS.length ? [] : PROMPT_AGENTS.map(a => a.id),
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="w-5 h-5 flex-shrink-0 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1" />
        <button type="button" onClick={() => onMoveUp(fragment.id)} disabled={isFirst}
          title="Mover arriba"
          className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
          <ArrowUp size={14} />
        </button>
        <button type="button" onClick={() => onMoveDown(fragment.id)} disabled={isLast}
          title="Mover abajo"
          className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
          <ArrowDown size={14} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => onDelete(fragment.id)}
          title="Eliminar fragmento"
          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <textarea
          ref={textareaRef}
          className="w-full text-[14px] resize-none outline-none placeholder:text-gray-300 font-mono leading-relaxed text-gray-800 bg-transparent border-0 p-0 focus:ring-0 min-h-[40px] transition-none overflow-hidden"
          placeholder={`Fragmento ${index + 1}: escribe aquí las instrucciones...`}
          value={fragment.text}
          onChange={(e) => onUpdate(fragment.id, { text: e.target.value })}
          rows={1}
          spellCheck={false}
        />
      </div>

      <div className="px-4 pb-3 pt-2 border-t border-gray-50 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1 flex-shrink-0">Para:</span>

        {PROMPT_AGENTS.map(agent => {
          const isActive = fragment.agentIds.includes(agent.id);
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => toggleAgent(agent.id)}
              className={`group/tag relative px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all duration-150 flex items-center gap-1 ${isActive
                  ? `${agent.activeBg} border-transparent text-white shadow-sm`
                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'
                }`}
            >
              {agent.short}
              {isActive && (
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); onPreview(agent.id); }}
                  title={`Ver prompt de ${agent.name}`}
                  className="opacity-0 group-hover/tag:opacity-100 transition-opacity cursor-pointer ml-0.5"
                >
                  <Eye size={10} />
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button" onClick={toggleAll}
          className="ml-auto text-[10px] font-bold text-gray-400 hover:text-purple-600 transition-colors flex-shrink-0"
        >
          {fragment.agentIds.length === PROMPT_AGENTS.length ? 'Ninguno' : 'Todos'}
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Componente principal (Controlado)
──────────────────────────────────────────────────────── */
interface PromptWeaverProps {
  fragments: PromptFragment[];
  onFragmentsChange: (fragments: PromptFragment[]) => void;
}

export const PromptWeaver: React.FC<PromptWeaverProps> = ({ fragments, onFragmentsChange }) => {
  const [previewAgentId, setPreviewAgentId] = useState<string | null>(null);

  const add = (index?: number) => {
    const newFragment: PromptFragment = { id: Math.random().toString(36).slice(2, 9), text: '', agentIds: [] };
    const next = typeof index === 'number'
      ? (() => { const n = [...fragments]; n.splice(index, 0, newFragment); return n; })()
      : [...fragments, newFragment];
    onFragmentsChange(next);
  };

  const upd = (id: string, u: Partial<PromptFragment>) =>
    onFragmentsChange(fragments.map(f => (f.id === id ? { ...f, ...u } : f)));

  const del = (id: string) => onFragmentsChange(fragments.filter(f => f.id !== id));

  const moveUp = (id: string) => {
    const i = fragments.findIndex(f => f.id === id);
    if (i <= 0) return;
    const n = [...fragments];[n[i - 1], n[i]] = [n[i], n[i - 1]];
    onFragmentsChange(n);
  };

  const moveDown = (id: string) => {
    const i = fragments.findIndex(f => f.id === id);
    if (i >= fragments.length - 1) return;
    const n = [...fragments];[n[i + 1], n[i]] = [n[i], n[i + 1]];
    onFragmentsChange(n);
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mt-6 border-l-4 border-l-purple-500 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Bot className="text-purple-600" size={20} />
            <h3 className="text-lg font-bold text-gray-800">Cerebro de los Agentes</h3>
            <span className="text-xs text-gray-400 font-medium ml-1">
              ({fragments.length} fragmentos)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {PROMPT_AGENTS.map(agent => {
              const count = fragments.filter(f => f.agentIds.includes(agent.id)).length;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setPreviewAgentId(agent.id)}
                  title={`Ver prompt de ${agent.name}`}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all hover:scale-105 ${count > 0
                      ? `${agent.lightBg} ${agent.border} ${agent.activeText}`
                      : 'bg-white border-gray-200 text-gray-400'
                    }`}
                >
                  <Eye size={11} />
                  {agent.short}
                  {count > 0 && (
                    <span className="bg-white/70 text-[10px] font-black px-1 rounded-full">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2 bg-gray-50">
          {fragments.length === 0 ? (
            <div className="py-14 border-2 border-dashed border-gray-200 rounded-2xl bg-white text-center">
              <FileText size={26} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-500 mb-1">No hay fragmentos aún</p>
              <button
                type="button" onClick={() => add()}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all inline-flex items-center gap-2"
              >
                <Plus size={15} /> Crear primer fragmento
              </button>
            </div>
          ) : (
            <>
              {fragments.map((fragment, index) => (
                <React.Fragment key={fragment.id}>
                  <div className="relative h-4 group/insert -mb-2 -mt-2 z-10">
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/insert:opacity-100 transition-opacity">
                      <div className="w-full h-px bg-purple-200" />
                      <button
                        type="button"
                        onClick={() => add(index)}
                        className="absolute bg-white border border-purple-200 text-purple-600 rounded-full p-1.5 hover:bg-purple-50 hover:scale-110 transition-all shadow-sm flex items-center justify-center"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <FragmentCard
                    fragment={fragment}
                    index={index}
                    total={fragments.length}
                    onUpdate={upd}
                    onDelete={del}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                    onPreview={(agentId) => setPreviewAgentId(agentId)}
                  />
                </React.Fragment>
              ))}

              <div className="mt-4">
                <button
                  type="button" onClick={() => add()}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 text-sm font-bold hover:border-purple-400 hover:text-purple-600 hover:bg-white transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Agregar fragmento al final
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {previewAgentId && (
        <PreviewModal
          initialAgentId={previewAgentId}
          fragments={fragments}
          onClose={() => setPreviewAgentId(null)}
        />
      )}
    </>
  );
};
