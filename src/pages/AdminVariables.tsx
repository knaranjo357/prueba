import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Save, Image as ImageIcon, CreditCard, Utensils, Soup, Salad, Bean } from 'lucide-react';

const VARS_API = 'https://n8n.alliasoft.com/webhook/luis-res/variables';

// === CONSTANTES DE IMÁGENES ===
const URL_ALMUERZO_SEMANA = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO.png";
const URL_COMIDA = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+COMIDA.png";
const URL_ALMUERZO_SABADO = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+SABADO.png";
const URL_ALMUERZO_DOMINGO = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+DOMINGO.png";
const URL_ALMUERZO_FESTIVO = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+FESTIVOS.png";
const URL_CERRADO = "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/CERRADO.jpg";

// Opciones visuales para el selector
const MENU_IMAGES = [
  { label: 'Almuerzo Entresemana', value: URL_ALMUERZO_SEMANA },
  { label: 'Comida (Noche)', value: URL_COMIDA },
  { label: 'Almuerzo Sábado', value: URL_ALMUERZO_SABADO },
  { label: 'Almuerzo Domingo', value: URL_ALMUERZO_DOMINGO },
  { label: 'Almuerzo Festivo', value: URL_ALMUERZO_FESTIVO },
  { label: 'Cerrado', value: URL_CERRADO },
];

type VarKey = 'sopa-dia' | 'ensalada-dia' | 'principio-dia' | 'nequi' | 'almuerzo';
type VarForm = Record<VarKey, string>;

const defaultForm: VarForm = {
  'sopa-dia': '',
  'ensalada-dia': '',
  'principio-dia': '',
  'nequi': '',
  'almuerzo': '',
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
      // Corrección: La API devuelve un array, tomamos el primer elemento
      const data = Array.isArray(json) ? json[0] : json;

      if (!data) throw new Error('No llegaron datos válidos');

      const next: VarForm = {
        'sopa-dia': data['sopa-dia'] ?? '',
        'ensalada-dia': data['ensalada-dia'] ?? '',
        'principio-dia': data['principio-dia'] ?? '',
        'nequi': data['nequi'] ?? '',
        'almuerzo': data['almuerzo'] ?? '',
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
          'almuerzo': form['almuerzo'],
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
          <h2 className="text-xl font-bold text-gray-900">Información del Día</h2>
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
        {/* === SECCIÓN 1: MENÚ DEL DÍA Y PAGOS === */}
        <div className="space-y-6">
          {/* Tarjeta Menú */}
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

        {/* === SECCIÓN 2: SELECTOR DE IMAGEN (GRID) === */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col h-full">
           <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2 border-gray-100">
              <ImageIcon className="text-purple-600" size={20}/> Menú Visual Activo
            </h3>
            
            <p className="text-sm text-gray-500 mb-4">
              Selecciona la imagen que verán los clientes hoy. <br/>
              <span className="text-xs text-purple-600 font-bold">URL Actual:</span> 
              <span className="text-xs text-gray-400 truncate block">{form.almuerzo || 'Ninguna'}</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 content-start">
              {MENU_IMAGES.map((opt) => {
                const isActive = form['almuerzo'] === opt.value;
                return (
                  <button
                    key={opt.label}
                    onClick={() => handleChange('almuerzo', opt.value)}
                    className={`relative flex flex-col items-center p-2 rounded-xl border-2 transition-all duration-200 group ${
                      isActive 
                        ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200' 
                        : 'border-gray-100 hover:border-purple-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-full aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden mb-2 relative border border-gray-200">
                      <img 
                        src={opt.value} 
                        alt={opt.label} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {isActive && (
                        <div className="absolute inset-0 bg-purple-900/30 flex items-center justify-center backdrop-blur-[1px]">
                           <div className="bg-white text-purple-700 text-xs font-black px-3 py-1 rounded-full shadow-lg uppercase tracking-widest border border-purple-200">ACTIVO</div>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs font-bold text-center ${isActive ? 'text-purple-800' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                    
                    {isActive && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-purple-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
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