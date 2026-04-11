import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  RefreshCw,
  Save,
  Bot,
  CreditCard,
  Utensils,
  Soup,
  Salad,
  Bean,
  MessageSquareText,
  Eye,
  Download,
} from 'lucide-react';
import { PromptWeaver, PromptFragment, PROMPT_AGENTS } from '../components/PromptWeaver';

const VARS_API = 'https://n8n.alliasoft.com/webhook/luis-res/variables';
const WPP_API = 'https://n8n.alliasoft.com/webhook/luis-res/wpp';

// === CONSTANTES DE IMÁGENES (Para referencia visual del agente) ===
const URL_ALMUERZO_SEMANA =
  'https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO.png';
const URL_COMIDA =
  'https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+COMIDA.png';
const URL_ALMUERZO_SABADO =
  'https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+SABADO.png';
const URL_ALMUERZO_DOMINGO =
  'https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+DOMINGO.png';
const URL_ALMUERZO_FESTIVO =
  'https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+FESTIVOS.png';
const URL_CERRADO =
  'https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/CERRADO.jpg';

// Configuración de los 6 Agentes
const AGENTS_CONFIG = [
  { label: 'Entre Semana', value: 'Almuerzo Entresemana', image: URL_ALMUERZO_SEMANA },
  { label: 'Noche', value: 'Comida (Noche)', image: URL_COMIDA },
  { label: 'Sábado', value: 'Almuerzo Sábado', image: URL_ALMUERZO_SABADO },
  { label: 'Domingo', value: 'Almuerzo Domingo', image: URL_ALMUERZO_DOMINGO },
  { label: 'Festivo', value: 'Almuerzo Festivo', image: URL_ALMUERZO_FESTIVO },
  { label: 'Cerrado', value: 'Cerrado', image: URL_CERRADO },
];

type VarKey = 'sopa-dia' | 'ensalada-dia' | 'principio-dia' | 'nequi' | 'almuerzo';
type VarForm = Record<VarKey, string>;

const defaultForm: VarForm = {
  'sopa-dia': '',
  'ensalada-dia': '',
  'principio-dia': '',
  nequi: '',
  almuerzo: '',
};

const AdminVariables: React.FC = () => {
  const [form, setForm] = useState<VarForm>(defaultForm);
  const [initial, setInitial] = useState<VarForm>(defaultForm);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [ok, setOk] = useState<string>('');

  const [wppModalOpen, setWppModalOpen] = useState<boolean>(false);
  const [wppLoading, setWppLoading] = useState<boolean>(false);
  const [wppError, setWppError] = useState<string>('');
  const [wppQr, setWppQr] = useState<string | null>(null);
  const [wppConnected, setWppConnected] = useState<boolean>(false);

  const [fragments, setFragments] = useState<PromptFragment[]>([]);
  const [initialFragments, setInitialFragments] = useState<PromptFragment[]>([]);

  const hasChanges = useMemo(() => {
    const basicChanged = JSON.stringify(form) !== JSON.stringify(initial);
    const fragmentsChanged = JSON.stringify(fragments) !== JSON.stringify(initialFragments);
    return basicChanged || fragmentsChanged;
  }, [form, initial, fragments, initialFragments]);

  const fetchVars = useCallback(async () => {
    setLoading(true);
    setError('');
    setOk('');

    try {
      const res = await fetch(VARS_API, { method: 'GET' });
      if (!res.ok) throw new Error(`Error al obtener variables (${res.status})`);

      const json = await res.json();
      const data = Array.isArray(json) ? json[0] : json;

      if (!data) throw new Error('No llegaron datos válidos');

      const next: VarForm = {
        'sopa-dia': data['sopa-dia'] ?? '',
        'ensalada-dia': data['ensalada-dia'] ?? '',
        'principio-dia': data['principio-dia'] ?? '',
        nequi: data['nequi'] ?? '',
        almuerzo: data['almuerzo'] ?? '',
      };

      setForm(next);
      setInitial(next);

      if (data.agentes) {
        try {
          const parsed = JSON.parse(data.agentes);
          if (Array.isArray(parsed)) {
            setFragments(parsed);
            setInitialFragments(parsed);
          }
        } catch (e) {
          console.error("Error parsing agentes", e);
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Error al cargar las variables');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveVars = useCallback(async () => {
    setSaving(true);
    setError('');
    setOk('');

    const compiledPrompts: Record<string, string> = {};
    PROMPT_AGENTS.forEach(({ id }) => {
      compiledPrompts[id] = fragments
        .filter(f => f.agentIds.includes(id))
        .map(f => f.text)
        .filter(t => t.trim())
        .join('\n\n');
    });

    try {
      const res = await fetch(VARS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'sopa-dia': form['sopa-dia'],
          'ensalada-dia': form['ensalada-dia'],
          'principio-dia': form['principio-dia'],
          nequi: form['nequi'],
          almuerzo: form['almuerzo'],
          agentes: JSON.stringify(fragments),
          ...compiledPrompts
        }),
      });

      if (!res.ok) throw new Error(`No se pudieron guardar los cambios (${res.status})`);

      setInitial(form);
      setInitialFragments([...fragments]);
      setOk('Toda la información ha sido actualizada correctamente.');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [form, fragments]);

  const openWppModal = useCallback(async () => {
    setWppModalOpen(true);
    setWppLoading(true);
    setWppError('');
    setWppQr(null);
    setWppConnected(false);

    try {
      const res = await fetch(WPP_API, { method: 'GET' });
      if (!res.ok) throw new Error(`No se pudo consultar WhatsApp (${res.status})`);

      const json = await res.json();
      const data = Array.isArray(json) ? json[0] : json;
      const base64 = data?.base64 ?? null;

      if (base64) {
        setWppQr(base64);
        setWppConnected(false);
      } else {
        setWppQr(null);
        setWppConnected(true);
      }
    } catch (e: any) {
      console.error(e);
      setWppError(e?.message || 'Error al consultar la conexión de WhatsApp');
    } finally {
      setWppLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVars();
  }, [fetchVars]);

  const handleChange = (key: VarKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header Sticky */}
      <div className="sticky top-14 md:top-14 z-20 bg-white/90 backdrop-blur border-b border-gray-100 -mx-4 px-4 py-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Configuración</h2>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchVars}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 p-2 rounded-lg shadow-sm transition-colors"
              disabled={loading || saving || wppLoading}
              title="Recargar datos"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={openWppModal}
              className="px-4 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all bg-green-600 hover:bg-green-700 text-white disabled:bg-green-300 disabled:cursor-not-allowed text-sm"
              disabled={loading || saving || wppLoading}
            >
              <MessageSquareText size={16} />
              {wppLoading ? 'Conectando...' : 'Conectar WPP'}
            </button>

            <button
              onClick={saveVars}
              className={`px-5 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all text-sm ${
                hasChanges && !saving
                  ? 'bg-gray-900 hover:bg-black text-white transform hover:scale-105'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              disabled={!hasChanges || saving}
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Mensajes de estado */}
      <div className="space-y-4 mb-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 flex items-center gap-2 animate-in slide-in-from-top-2">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {ok && (
          <div className="rounded-xl border border-green-200 bg-green-50 text-green-700 px-4 py-3 flex items-center gap-2 animate-in slide-in-from-top-2">
            <span className="font-bold">¡Éxito!</span> {ok}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* === SECCIÓN 1: INFORMACIÓN MANUAL === */}
        <div className="space-y-6">
          {/* Tarjeta Menú del Día */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2 border-gray-100">
              <Utensils className="text-amber-500" size={20} /> Menú Diario
            </h3>

            <div className="space-y-5">
              {/* Sopa */}
              <div className="relative group">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                  <Soup size={14} /> Sopa
                </label>
                <input
                  type="text"
                  value={form['sopa-dia']}
                  onChange={(e) => handleChange('sopa-dia', e.target.value)}
                  placeholder="Ej: Sancocho..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium text-gray-800"
                  disabled={loading}
                />
              </div>

              {/* Principio */}
              <div className="relative group">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                  <Bean size={14} /> Principio
                </label>
                <input
                  type="text"
                  value={form['principio-dia']}
                  onChange={(e) => handleChange('principio-dia', e.target.value)}
                  placeholder="Ej: Frijoles..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium text-gray-800"
                  disabled={loading}
                />
              </div>

              {/* Ensalada */}
              <div className="relative group">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                  <Salad size={14} /> Ensalada
                </label>
                <input
                  type="text"
                  value={form['ensalada-dia']}
                  onChange={(e) => handleChange('ensalada-dia', e.target.value)}
                  placeholder="Ej: Tomate y cebolla..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium text-gray-800"
                  disabled={loading}
                />
              </div>
            </div>
          </div>


          {/* Tarjeta Pagos */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2 border-gray-100">
              <CreditCard className="text-blue-600" size={20} /> Datos de Pago
            </h3>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">
                Información Nequi / Bancolombia
              </label>
              <textarea
                value={form['nequi']}
                onChange={(e) => handleChange('nequi', e.target.value)}
                placeholder="Ej: 300 123 4567 (A nombre de...)"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium text-gray-700 min-h-[80px]"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* === SECCIÓN 2: SELECCIÓN DE AGENTE (GRID) === */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col h-full">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2 border-gray-100">
            <Bot className="text-purple-600" size={20} /> Selección de Agente
          </h3>

          <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
            {/* Toggle Comodín */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-700">Activar Comodín</span>
                <span className="text-xs text-gray-400">Modo de respuesta comodín</span>
              </div>
              <button
                onClick={() => handleChange('almuerzo', form.almuerzo === 'comodin' ? '' : 'comodin')}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  form.almuerzo === 'comodin' ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.almuerzo === 'comodin' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="h-px bg-gray-200" />

            {/* Toggle Festivo */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-700">Activar Festivo</span>
                <span className="text-xs text-gray-400">Modo de respuesta para días festivos</span>
              </div>
              <button
                onClick={() => handleChange('almuerzo', form.almuerzo === 'festivo' ? '' : 'festivo')}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  form.almuerzo === 'festivo' ? 'bg-amber-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.almuerzo === 'festivo' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
            <span className="font-bold">Agente actual:</span> {form.almuerzo || 'Ninguno seleccionado'}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 content-start">
            {AGENTS_CONFIG.map((agent) => {
              const isActive = form['almuerzo'] === agent.value;

              return (
                <div
                  key={agent.value}
                  className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 group text-left ${
                    isActive
                      ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200'
                      : 'border-gray-100'
                  }`}
                >
                  <div className="w-full flex justify-between items-center mb-2">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        isActive ? 'text-purple-700' : 'text-gray-500'
                      }`}
                    >
                      {agent.label}
                    </span>

                    {isActive && <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse" />}
                  </div>

                  <div className="w-full aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden relative border border-gray-200">
                    <img
                      src={agent.image}
                      alt={agent.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                      <a
                        href={agent.image}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/20 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-sm transition-all"
                        onClick={(e) => e.stopPropagation()}
                        title="Ver Imagen"
                      >
                        <Eye size={18} />
                      </a>

                      <a
                        href={agent.image}
                        download
                        className="p-2 bg-white/20 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-sm transition-all"
                        onClick={(e) => e.stopPropagation()}
                        title="Descargar Imagen"
                      >
                        <Download size={18} />
                      </a>
                    </div>

                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 bg-purple-900/80 p-1 text-center backdrop-blur-sm">
                        <span className="text-white text-[10px] font-bold uppercase">
                          AGENTE ACTIVO
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* === SECCIÓN 3: PROMPT WEAVER === */}
      <PromptWeaver
        fragments={fragments}
        onFragmentsChange={setFragments}
      />

      {/* Modal Conectar WPP */}
      {wppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Conectar WhatsApp</h3>
              <button
                onClick={() => setWppModalOpen(false)}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5">
              {wppLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-green-600 mb-4" />
                  <p className="text-sm text-gray-600">Consultando estado de WhatsApp...</p>
                </div>
              )}

              {!wppLoading && wppError && (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                  <span className="font-bold">Error:</span> {wppError}
                </div>
              )}

              {!wppLoading && !wppError && wppConnected && (
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <MessageSquareText className="text-green-600" size={28} />
                  </div>
                  <h4 className="text-lg font-bold text-green-700">WhatsApp ya está conectado</h4>
                  <p className="text-sm text-gray-500 mt-2">
                    No es necesario escanear un nuevo código QR.
                  </p>
                </div>
              )}

              {!wppLoading && !wppError && !wppConnected && wppQr && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Escanea este código QR con el WhatsApp que vas a conectar.
                  </p>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex justify-center">
                    <img
                      src={wppQr}
                      alt="Código QR de WhatsApp"
                      className="w-full max-w-[280px] h-auto rounded-lg border border-gray-200 bg-white"
                    />
                  </div>

                  <p className="text-xs text-gray-400 mt-3">
                    Si el QR expira, cierra este modal y vuelve a oprimir “Conectar WPP”.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVariables;
