// src/pages/AdminResultados.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Calendar,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart2,
  MapPin,
  Activity,
  Info,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const HISTORIAL_API = 'https://n8n.alliasoft.com/webhook/luis-res/historial';

interface HistorialRow {
  fecha: string; // "14/08/2025 10:08:36"
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  'detalle pedido'?: string;
}

interface MonthlyStats {
  key: string; // "2025-08"
  year: number;
  month: number;
  label: string; // "Agosto 2025"
  totalRestaurante: number;
  totalDomicilio: number;
  totalGeneral: number;
  pedidos: number;
  paymentTotals: Record<
    string,
    {
      count: number;
      total: number;
    }
  >;
}

interface DailyStats {
  dateKey: string; // "2025-08-14"
  label: string; // "14/08"
  pedidos: number;
  totalRestaurante: number;
  totalDomicilio: number;
  totalGeneral: number;
}

const monthNamesEs = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const formatCOP = (n: number) => `$${(n || 0).toLocaleString('es-CO')}`;

const parseFechaParts = (fecha: string) => {
  if (!fecha) return null;
  const [datePart] = fecha.split(' ');
  if (!datePart) return null;
  const [dd, mm, yyyy] = datePart.split('/');
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (!day || !month || !year) return null;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { day, month, year, monthKey, dateKey };
};

const toTitleCase = (value: string) => {
  if (!value) return '';
  return value
    .split('_')
    .join(' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const AdminResultados: React.FC = () => {
  const [historial, setHistorial] = useState<HistorialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(HISTORIAL_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistorial(data as HistorialRow[]);
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (e) {
      console.error(e);
      setError('No se pudo cargar el historial. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, []);

  const monthlyStats = useMemo<MonthlyStats[]>(() => {
    const map = new Map<string, MonthlyStats>();

    historial.forEach((row) => {
      const parsed = parseFechaParts(row.fecha);
      if (!parsed) return;

      const { year, month, monthKey } = parsed;
      const label = `${monthNamesEs[month - 1] ?? `Mes ${month}`} ${year}`;

      let m = map.get(monthKey);
      if (!m) {
        m = {
          key: monthKey,
          year,
          month,
          label,
          totalRestaurante: 0,
          totalDomicilio: 0,
          totalGeneral: 0,
          pedidos: 0,
          paymentTotals: {},
        };
        map.set(monthKey, m);
      }

      const vr = row.valor_restaurante || 0;
      const vd = row.valor_domicilio || 0;
      const total = vr + vd;
      const mp = (row.metodo_pago || 'sin_especificar').toLowerCase();

      m.totalRestaurante += vr;
      m.totalDomicilio += vd;
      m.totalGeneral += total;
      m.pedidos += 1;

      if (!m.paymentTotals[mp]) {
        m.paymentTotals[mp] = { count: 0, total: 0 };
      }
      m.paymentTotals[mp].count += 1;
      m.paymentTotals[mp].total += total;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year === b.year) return b.month - a.month; // más nuevo primero
      return b.year - a.year;
    });
  }, [historial]);

  // Stats globales (todo el historial)
  const globalStats = useMemo(() => {
    if (monthlyStats.length === 0) {
      return {
        totalPedidos: 0,
        totalVentas: 0,
        mejorMes: null as MonthlyStats | null,
        ticketPromedioGlobal: 0,
      };
    }

    let totalPedidos = 0;
    let totalVentas = 0;
    let mejorMes: MonthlyStats | null = monthlyStats[0];

    monthlyStats.forEach((m) => {
      totalPedidos += m.pedidos;
      totalVentas += m.totalGeneral;
      if (!mejorMes || m.totalGeneral > mejorMes.totalGeneral) {
        mejorMes = m;
      }
    });

    const ticketPromedioGlobal = totalPedidos > 0 ? totalVentas / totalPedidos : 0;

    return { totalPedidos, totalVentas, mejorMes, ticketPromedioGlobal };
  }, [monthlyStats]);

  // Seleccionar automáticamente el mes más reciente
  useEffect(() => {
    if (!selectedMonthKey && monthlyStats.length > 0) {
      setSelectedMonthKey(monthlyStats[0].key);
    }
  }, [monthlyStats, selectedMonthKey]);

  const selectedMonth = useMemo(
    () => monthlyStats.find((m) => m.key === selectedMonthKey) || null,
    [monthlyStats, selectedMonthKey],
  );

  const dailyStats = useMemo<DailyStats[]>(() => {
    if (!selectedMonthKey) return [];
    const map = new Map<string, DailyStats>();

    historial.forEach((row) => {
      const parsed = parseFechaParts(row.fecha);
      if (!parsed || parsed.monthKey !== selectedMonthKey) return;

      const { day, dateKey, month } = parsed;
      const label = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;

      let d = map.get(dateKey);
      if (!d) {
        d = {
          dateKey,
          label,
          pedidos: 0,
          totalRestaurante: 0,
          totalDomicilio: 0,
          totalGeneral: 0,
        };
        map.set(dateKey, d);
      }

      const vr = row.valor_restaurante || 0;
      const vd = row.valor_domicilio || 0;
      d.pedidos += 1;
      d.totalRestaurante += vr;
      d.totalDomicilio += vd;
      d.totalGeneral += vr + vd;
    });

    return Array.from(map.values()).sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  }, [historial, selectedMonthKey]);

  const paymentBreakdown = useMemo(() => {
    if (!selectedMonth) return [];
    const totalGeneral = selectedMonth.totalGeneral || 0;
    const entries = Object.entries(selectedMonth.paymentTotals);
    return entries
      .map(([method, stats]) => ({
        method,
        count: stats.count,
        total: stats.total,
        percentage: totalGeneral > 0 ? (stats.total / totalGeneral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [selectedMonth]);

  const ticketPromedioMes =
    selectedMonth && selectedMonth.pedidos > 0
      ? selectedMonth.totalGeneral / selectedMonth.pedidos
      : 0;

  // Datos para gráficos
  const monthlyChartData = useMemo(
    () =>
      monthlyStats
        .slice()
        .reverse() // más viejo a la izquierda
        .map((m) => ({
          name: `${(monthNamesEs[m.month - 1] || '').slice(0, 3)} ${String(m.year).slice(2)}`,
          restaurante: Math.round(m.totalRestaurante),
          domicilio: Math.round(m.totalDomicilio),
          total: Math.round(m.totalGeneral),
        })),
    [monthlyStats],
  );

  const dailyChartData = useMemo(
    () =>
      dailyStats.map((d) => ({
        name: d.label,
        total: Math.round(d.totalGeneral),
        restaurante: Math.round(d.totalRestaurante),
        domicilio: Math.round(d.totalDomicilio),
        pedidos: d.pedidos,
      })),
    [dailyStats],
  );

  const paymentChartData = useMemo(
    () =>
      paymentBreakdown.map((p) => ({
        method: toTitleCase(p.method),
        total: Math.round(p.total),
      })),
    [paymentBreakdown],
  );

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar de meses (desktop / tablet) */}
      <aside className="hidden md:block w-72 shrink-0">
        <div className="sticky top-24 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar size={16} />
              Meses
            </h3>
            <button
              onClick={fetchHistorial}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gold text-white hover:bg-gold/90 shadow-sm transition"
              title="Actualizar historial"
            >
              <RefreshCw size={14} />
              Actualizar
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-2 max-h-[calc(100vh-180px)] overflow-y-auto shadow-sm">
            {monthlyStats.length === 0 && !loading && (
              <p className="text-xs text-gray-500 px-1">No hay datos de historial.</p>
            )}

            <div className="space-y-1">
              {monthlyStats.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMonthKey(m.key)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs md:text-sm border transition shadow-sm hover:shadow-md flex flex-col gap-0.5 ${
                    selectedMonthKey === m.key
                      ? 'bg-gold text-white border-gold'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{m.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100">
                      {m.pedidos} pedidos
                    </span>
                  </div>
                  <div
                    className={`text-[11px] ${
                      selectedMonthKey === m.key ? 'text-gray-100' : 'text-gray-500'
                    }`}
                  >
                    {formatCOP(m.totalGeneral)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {loading && <p className="text-xs text-gray-500 px-1">Cargando historial…</p>}
          {error && <p className="text-xs text-red-600 px-1">{error}</p>}
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Encabezado + resumen global */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700 mb-2">
                <Activity size={14} />
                <span>Dashboard de resultados</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart2 size={22} className="text-gold" />
                Rendimiento de ventas
              </h2>
              <p className="text-sm text-gray-600 mt-1 max-w-xl">
                Visualiza el desempeño del restaurante y los domicilios por mes, día y método
                de pago en una vista clara y profesional.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <button
                onClick={fetchHistorial}
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition"
              >
                <RefreshCw size={16} />
                Actualizar datos
              </button>
              <div className="flex items-center gap-1 text-[11px] text-gray-500">
                <Info size={12} />
                <span>Fuente: webhook n8n · Historial de pedidos</span>
              </div>
            </div>
          </div>

          {/* Resumen global (histórico) */}
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Ventas históricas
                </span>
                <DollarSign size={14} className="text-emerald-500" />
              </div>
              <p className="text-sm md:text-lg font-semibold text-gray-900 tabular-nums">
                {formatCOP(globalStats.totalVentas)}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Suma de todos los meses registrados
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Pedidos totales
                </span>
                <Activity size={14} className="text-sky-500" />
              </div>
              <p className="text-sm md:text-lg font-semibold text-gray-900 tabular-nums">
                {globalStats.totalPedidos}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Historial completo del sistema
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Ticket promedio histórico
                </span>
                <TrendingUp size={14} className="text-gold" />
              </div>
              <p className="text-sm md:text-lg font-semibold text-gray-900 tabular-nums">
                {formatCOP(globalStats.ticketPromedioGlobal)}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Promedio por pedido (todos los meses)
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Mejor mes
                </span>
                <Calendar size={14} className="text-rose-400" />
              </div>
              {globalStats.mejorMes ? (
                <>
                  <p className="text-xs font-semibold text-gray-900">
                    {globalStats.mejorMes.label}
                  </p>
                  <p className="text-sm md:text-base font-medium text-gold mt-1 tabular-nums">
                    {formatCOP(globalStats.mejorMes.totalGeneral)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Sin datos aún</p>
              )}
            </div>
          </div>
        </div>

        {/* Selector de mes en móviles */}
        <div className="md:hidden bg-white rounded-2xl border border-gray-200 p-3 shadow-sm flex items-center gap-3">
          <div className="flex-shrink-0 rounded-full bg-gray-100 p-2">
            <Filter size={16} className="text-gold" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mes seleccionado
            </label>
            <select
              value={selectedMonthKey ?? ''}
              onChange={(e) => setSelectedMonthKey(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-gold/60 focus:border-gold"
            >
              {monthlyStats.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} — {m.pedidos} pedidos
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gráfico global por mes (Restaurante + Domicilio + Total) */}
        {monthlyChartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={18} className="text-gold" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Ventas por mes (histórico)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Restaurante y domicilios apilados, con línea de total.
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-500">
                {monthlyStats.length} mes(es) analizado(s)
              </span>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCOP(Number(value))}
                    labelFormatter={(label) => `Mes: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="restaurante"
                    name="Restaurante"
                    stackId="ventas"
                    fill="#facc15" // dorado
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="domicilio"
                    name="Domicilios"
                    stackId="ventas"
                    fill="#38bdf8" // azul claro
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#0f172a" // gris muy oscuro
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!selectedMonth && monthlyStats.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="text-sm text-gray-600">
              Aún no hay información de historial para mostrar. Cuando se registren pedidos
              aparecerán aquí.
            </p>
          </div>
        )}

        {selectedMonth && (
          <>
            {/* Resumen del mes seleccionado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Mes seleccionado
                  </span>
                  <Calendar size={16} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedMonth.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedMonth.pedidos} pedidos en total
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Restaurante
                  </span>
                  <DollarSign size={16} className="text-emerald-500" />
                </div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">
                  {formatCOP(selectedMonth.totalRestaurante)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Ventas dentro del restaurante
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Domicilios
                  </span>
                  <MapPin size={16} className="text-blue-500" />
                </div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">
                  {formatCOP(selectedMonth.totalDomicilio)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Cobros por servicio de domicilio
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Ticket promedio (mes)
                  </span>
                  <TrendingUp size={16} className="text-gold" />
                </div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">
                  {formatCOP(ticketPromedioMes)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Promedio por pedido (restaurante + domicilio)
                </p>
              </div>
            </div>

            {/* Gráficos del mes seleccionado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Línea de ventas diarias */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-gold" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        Ventas diarias del mes
                      </h3>
                      <p className="text-xs text-gray-500">
                        Total diario (restaurante + domicilio)
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {dailyStats.length} día(s) con pedidos
                  </span>
                </div>

                {dailyChartData.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No hay registros diarios para este mes.
                  </p>
                ) : (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: any) => formatCOP(Number(value))}
                          labelFormatter={(label) => `Día ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          name="Total"
                          stroke="#0f172a"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Gráfico de métodos de pago */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PieChartIcon size={18} className="text-gold" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        Métodos de pago (total del mes)
                      </h3>
                      <p className="text-xs text-gray-500">
                        Comparativo por valor cobrado.
                      </p>
                    </div>
                  </div>
                </div>

                {paymentChartData.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No hay información de métodos de pago para este mes.
                  </p>
                ) : (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={paymentChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <YAxis
                          type="category"
                          dataKey="method"
                          width={110}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value: any) => formatCOP(Number(value))}
                          labelFormatter={(label) => `Método: ${label}`}
                        />
                        <Bar
                          dataKey="total"
                          name="Total"
                          fill="#0ea5e9" // azul
                          radius={[4, 4, 4, 4]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Tablas: métodos de pago + totales diarios */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tabla métodos de pago */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PieChartIcon size={18} className="text-gold" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Detalle por método de pago
                    </h3>
                  </div>
                </div>

                {paymentBreakdown.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No hay información de métodos de pago para este mes.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                          <th className="py-2 pr-2">Método</th>
                          <th className="py-2 px-2 text-right">Pedidos</th>
                          <th className="py-2 px-2 text-right">Total</th>
                          <th className="py-2 pl-2 text-right">% del mes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentBreakdown.map((p) => (
                          <tr key={p.method} className="border-b last:border-0">
                            <td className="py-2 pr-2">
                              <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                {toTitleCase(p.method)}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">{p.count}</td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {formatCOP(p.total)}
                            </td>
                            <td className="py-2 pl-2 text-right tabular-nums">
                              {p.percentage.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Tabla totales por día */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-gold" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Resultados por día del mes
                    </h3>
                  </div>
                </div>

                {dailyStats.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No hay registros diarios para este mes.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                          <th className="py-2 pr-2">Día</th>
                          <th className="py-2 px-2 text-right">Pedidos</th>
                          <th className="py-2 px-2 text-right">Restaurante</th>
                          <th className="py-2 px-2 text-right">Domicilio</th>
                          <th className="py-2 pl-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyStats.map((d) => (
                          <tr key={d.dateKey} className="border-b last:border-0">
                            <td className="py-2 pr-2 text-gray-800">{d.label}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{d.pedidos}</td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {formatCOP(d.totalRestaurante)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {formatCOP(d.totalDomicilio)}
                            </td>
                            <td className="py-2 pl-2 text-right font-medium tabular-nums">
                              {formatCOP(d.totalGeneral)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {loading && (
          <p className="text-sm text-gray-500">
            Cargando información de resultados…
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminResultados;
