import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Save, Bot, CreditCard, Utensils, Soup, Salad, Bean, MessageSquareText, Eye, Download } from 'lucide-react';

const VARS_API = 'https://n8n.alliasoft.com/webhook/luis-res/variables';

// === CONSTANTES DE IMÁGENES (Para referencia visual del agente) ===
const URL_ALMUERZO_SEMANA = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO.png";
const URL_COMIDA = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+COMIDA.png";
const URL_ALMUERZO_SABADO = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+SABADO.png";
const URL_ALMUERZO_DOMINGO = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+DOMINGO.png";
const URL_ALMUERZO_FESTIVO = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+FESTIVOS.png";
const URL_CERRADO = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/CERRADO.jpg";

// Configuración de los 6 Agentes
// 'value' es lo que se envía a la API en el campo 'almuerzo'
// 'image' es lo que se muestra para descargar/ver
const AGENTS_CONFIG = [
  { label: 'Entre Semana', value: 'Almuerzo Entresemana', image: URL_ALMUERZO_SEMANA },
  { label: 'Noche', value: 'Comida (Noche)', image: URL_COMIDA },
  { label: 'Sábado', value: 'Almuerzo Sábado', image: URL_ALMUERZO_SABADO },
  { label: 'Domingo', value: 'Almuerzo Domingo', image: URL_ALMUERZO_DOMINGO },
  { label: 'Festivo', value: 'Almuerzo Festivo', image: URL_ALMUERZO_FESTIVO },
  { label: 'Cerrado', value: 'Cerrado', image: URL_CERRADO },
];

// Agregamos 'frase' a los tipos
type VarKey = 'sopa-dia' | 'ensalada-dia' | 'principio-dia' | 'nequi' | 'almuerzo' | 'frase';
type VarForm = Record<VarKey, string>;

const defaultForm: VarForm = {
  'sopa-dia': '',
  'ensalada-dia': '',
  'principio-dia': '',
  'nequi': '',
  'almuerzo': '', // Aquí se guardará el nombre del agente (ej: "Almuerzo Entresemana")
  'frase': '',    // Notas para el agente
};

const AdminVariables: React.FC = () => {
  const [form, setForm] = useState<VarForm>(defaultForm);
  const [initial, setInitial] = useState<VarForm>(defaultForm);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [ok, setOk] = useState<string>('');

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial]
  );

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
        'nequi': data['nequi'] ?? '',
        'almuerzo': data['almuerzo'] ?? '', // Ahora recibe el nombre del agente
        'frase': data['frase'] ?? '',       // Nuevo campo recibido
      };

      setForm(next);
      setInitial(next);
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
    try {
      const res = await fetch(VARS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'sopa-dia': form['sopa-dia'],
          'ensalada-dia': form['ensalada-dia'],
          'principio-dia': form['principio-dia'],
          'nequi': form['nequi'],
          'almuerzo': form['almuerzo'], // Envía el nombre del agente
          'frase': form['frase'],       // Envía la nota
        }),
      });
      if (!res.ok) throw new Error(`No se pudieron guardar los cambios (${res.status})`);
      setInitial(form);
      setOk('Información actualizada correctamente.');
    } catch (e: any) {
      setError(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [form]);

  useEffect(() => {
    fetchVars();
  }, [fetchVars]);

  const handleChange = (key: VarKey, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Header Sticky */}
      <div className="sticky top-24 z-20 bg-white/90 backdrop-blur border-b border-gray-100 -mx-4 px-4 py-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Configuración del Restaurante</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchVars}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 p-2 rounded-lg shadow-sm transition-colors"
              disabled={loading || saving}
              title="Recargar datos"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={saveVars}
              className={`px-6 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-all ${
                hasChanges && !saving
                  ? 'bg-amber-500 hover:bg-amber-600 text-white transform hover:scale-105'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              disabled={!hasChanges || saving}
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
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
              <Utensils className="text-amber-500" size={20}/> Menú Diario
            </h3>
            <div className="space-y-5">
              {/* Sopa */}
              <div className="relative group">
                <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                  <Soup size={14}/> Sopa
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
                  <Bean size={14}/> Principio
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
                  <Salad size={14}/> Ensalada
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

          {/* Tarjeta Instrucciones para el Agente (NUEVA) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 border-l-4 border-l-purple-500">
             <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2 border-gray-100">
              <MessageSquareText className="text-purple-600" size={20}/> Instrucciones para el Agente
            </h3>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">
                  Notas Especiales (Frase)
                </label>
                <textarea
                  value={form['frase']}
                  onChange={(e) => handleChange('frase', e.target.value)}
                  placeholder="Ej: Hoy no hay servicio a domicilio por lluvia..."
                  className="w-full p-3 bg-purple-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm font-medium text-gray-700 min-h-[100px]"
                  disabled={loading}
                />
                <p className="text-xs text-gray-400 mt-2">
                  * Estas notas serán leídas por el agente para dar contexto adicional.
                </p>
            </div>
          </div>

          {/* Tarjeta Pagos */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
             <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2 border-gray-100">
              <CreditCard className="text-blue-600" size={20}/> Datos de Pago
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
              <Bot className="text-purple-600" size={20}/> Selección de Agente
            </h3>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-100">
              <span className="font-bold">Agente actual:</span> {form.almuerzo || 'Ninguno seleccionado'}
              <p className="text-xs mt-1 text-blue-600/80">Selecciona el escenario que atenderá el agente hoy.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 content-start">
              {AGENTS_CONFIG.map((agent) => {
                const isActive = form['almuerzo'] === agent.value;
                return (
                  <button
                    key={agent.value}
                    onClick={() => handleChange('almuerzo', agent.value)}
                    className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 group text-left ${
                      isActive 
                        ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200' 
                        : 'border-gray-100 hover:border-purple-200 hover:bg-gray-50'
                    }`}
                  >
                    {/* Cabecera de la tarjeta */}
                    <div className="w-full flex justify-between items-center mb-2">
                       <span className={`text-xs font-black uppercase tracking-wider ${isActive ? 'text-purple-700' : 'text-gray-500'}`}>
                         {agent.label}
                       </span>
                       {isActive && (
                        <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse"/>
                       )}
                    </div>

                    {/* Imagen del menú (Preview) */}
                    <div className="w-full aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden relative border border-gray-200">
                      <img 
                        src={agent.image} 
                        alt={agent.label} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      
                      {/* Botón de descarga/ver hover */}
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
                           <span className="text-white text-[10px] font-bold uppercase">AGENTE ACTIVO</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdminVariables;