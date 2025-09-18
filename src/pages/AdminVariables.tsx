import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { RefreshCw, Save } from 'lucide-react';

const VARS_API = 'https://n8n.alliasoft.com/webhook/luis-res/variables';

type VarKey = 'sopa-dia' | 'ensalada-dia' | 'principio-dia';
type VarForm = Record<VarKey, string>;

const defaultForm: VarForm = {
  'sopa-dia': '',
  'ensalada-dia': '',
  'principio-dia': '',
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
      const data = await res.json();

      const next: VarForm = {
        'sopa-dia': data['sopa-dia'] ?? '',
        'ensalada-dia': data['ensalada-dia'] ?? '',
        'principio-dia': data['principio-dia'] ?? '',
      };

      setForm(next);
      setInitial(next);
    } catch (e: any) {
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
        // Enviamos solo las tres variables que queremos actualizar
        body: JSON.stringify({
          'sopa-dia': form['sopa-dia'],
          'ensalada-dia': form['ensalada-dia'],
          'principio-dia': form['principio-dia'],
        }),
      });
      if (!res.ok) throw new Error(`No se pudieron guardar los cambios (${res.status})`);
      setInitial(form);
      setOk('Cambios guardados correctamente.');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Información del día</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchVars}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            disabled={loading || saving}
            title="Recargar"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Recargar
          </button>
          <button
            onClick={saveVars}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium shadow-sm ${
              hasChanges && !saving
                ? 'bg-gold hover:bg-gold/90'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
            disabled={!hasChanges || saving}
            title="Guardar cambios"
          >
            <Save size={16} />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3">
          {ok}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sopa del día */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sopa del día
            </label>
            <input
              type="text"
              value={form['sopa-dia']}
              onChange={(e) => handleChange('sopa-dia', e.target.value)}
              placeholder="Ej: Arroz"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/40 focus:border-gold/40"
              disabled={loading}
            />
          </div>

          {/* Ensalada del día */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ensalada del día
            </label>
            <input
              type="text"
              value={form['ensalada-dia']}
              onChange={(e) => handleChange('ensalada-dia', e.target.value)}
              placeholder="Ej: cebolla, tomate, lechuga y zanahoria"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/40 focus:border-gold/40"
              disabled={loading}
            />
          </div>

          {/* Principio del día */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Principio del día
            </label>
            <input
              type="text"
              value={form['principio-dia']}
              onChange={(e) => handleChange('principio-dia', e.target.value)}
              placeholder="Ej: Lentejas"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/40 focus:border-gold/40"
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminVariables;
