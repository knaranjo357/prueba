// src/pages/AdminResultados.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Calendar,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart2,
  MapPin,
  Activity,
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
  fecha: string;
  valor_restaurante: number | string;
  valor_domicilio: number | string;
  metodo_pago: string;
  'detalle pedido'?: string;
}

interface PaymentTotal {
  count: number;
  total: number;
}

interface MonthlyStats {
  key: string; // YYYY-MM
  year: number;
  month: number;
  label: string;
  totalRestaurante: number;
  totalDomicilio: number;
  totalGeneral: number;
  pedidos: number;
  paymentTotals: Record<string, PaymentTotal>;
}

interface DailyStats {
  dateKey: string; // YYYY-MM-DD
  label: string; // DD/MM
  pedidos: number;
  totalRestaurante: number;
  totalDomicilio: number;
  totalGeneral: number;
}

interface ParsedFecha {
  day: number;
  month: number;
  year: number;
  monthKey: string;
  dateKey: string;
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
] as const;

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const formatCOP = (value: number) =>
  copFormatter.format(Number.isFinite(value) ? value : 0);

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const toTitleCase = (value: string) => {
  if (!value) return 'Sin especificar';

  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const normalizePaymentMethod = (value: unknown) => {
  if (typeof value !== 'string') return 'sin_especificar';

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');

  return normalized || 'sin_especificar';
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;

  const cleaned = value.trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';

    normalized = cleaned.split(thousandsSeparator).join('');
    if (decimalSeparator === ',') {
      normalized = normalized.replace(',', '.');
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    normalized =
      parts.length > 1 && parts[parts.length - 1].length !== 3
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (hasDot) {
    const parts = cleaned.split('.');
    normalized =
      parts.length > 1 && parts[parts.length - 1].length !== 3
        ? cleaned.replace(/,/g, '')
        : cleaned.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseFechaParts = (fecha: string): ParsedFecha | null => {
  if (!fecha) return null;

  const [datePart] = fecha.split(' ');
  if (!datePart) return null;

  const [dd, mm, yyyy] = datePart.split('/');
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);

  if (!day || !month || !year) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { day, month, year, monthKey, dateKey };
};

const normalizeHistorialRow = (row: HistorialRow): HistorialRow => ({
  ...row,
  valor_restaurante: toNumber(row.valor_restaurante),
  valor_domicilio: toNumber(row.valor_domicilio),
  metodo_pago: normalizePaymentMethod(row.metodo_pago),
});

const buildMonthlyStats = (historial: HistorialRow[]): MonthlyStats[] => {
  const map = new Map<string, MonthlyStats>();

  for (const rawRow of historial) {
    const row = normalizeHistorialRow(rawRow);
    const parsed = parseFechaParts(row.fecha);

    if (!parsed) continue;

    const { year, month, monthKey } = parsed;
    const label = `${monthNamesEs[month - 1] ?? `Mes ${month}`} ${year}`;

    const vr = toNumber(row.valor_restaurante);
    const vd = toNumber(row.valor_domicilio);
    const total = vr + vd;
    const paymentMethod = normalizePaymentMethod(row.metodo_pago);

    let current = map.get(monthKey);

    if (!current) {
      current = {
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
      map.set(monthKey, current);
    }

    current.totalRestaurante += vr;
    current.totalDomicilio += vd;
    current.totalGeneral += total;
    current.pedidos += 1;

    if (!current.paymentTotals[paymentMethod]) {
      current.paymentTotals[paymentMethod] = { count: 0, total: 0 };
    }

    current.paymentTotals[paymentMethod].count += 1;
    current.paymentTotals[paymentMethod].total += total;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
};

const buildDailyStats = (
  historial: HistorialRow[],
  selectedMonthKey: string | null,
): DailyStats[] => {
  if (!selectedMonthKey) return [];

  const map = new Map<string, DailyStats>();

  for (const rawRow of historial) {
    const row = normalizeHistorialRow(rawRow);
    const parsed = parseFechaParts(row.fecha);

    if (!parsed || parsed.monthKey !== selectedMonthKey) continue;

    const { day, month, dateKey } = parsed;
    const label = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;

    let current = map.get(dateKey);

    if (!current) {
      current = {
        dateKey,
        label,
        pedidos: 0,
        totalRestaurante: 0,
        totalDomicilio: 0,
        totalGeneral: 0,
      };
      map.set(dateKey, current);
    }

    const vr = toNumber(row.valor_restaurante);
    const vd = toNumber(row.valor_domicilio);

    current.pedidos += 1;
    current.totalRestaurante += vr;
    current.totalDomicilio += vd;
    current.totalGeneral += vr + vd;
  }

  return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

const getGlobalStats = (monthlyStats: MonthlyStats[]) => {
  if (monthlyStats.length === 0) {
    return {
      totalPedidos: 0,
      totalVentas: 0,
      mejorMes: null as MonthlyStats | null,
      ticketPromedioGlobal: 0,
    };
  }

  const totalPedidos = monthlyStats.reduce((acc, item) => acc + item.pedidos, 0);
  const totalVentas = monthlyStats.reduce((acc, item) => acc + item.totalGeneral, 0);
  const mejorMes =
    monthlyStats.reduce<MonthlyStats | null>(
      (best, current) =>
        !best || current.totalGeneral > best.totalGeneral ? current : best,
      null,
    ) ?? null;

  return {
    totalPedidos,
    totalVentas,
    mejorMes,
    ticketPromedioGlobal: totalPedidos > 0 ? totalVentas / totalPedidos : 0,
  };
};

const StatCard: React.FC<{
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: React.ReactNode;
}> = ({ title, value, subtitle, icon }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
        {title}
      </span>
      {icon}
    </div>
    <div className="text-sm md:text-lg font-semibold text-gray-900 tabular-nums">
      {value}
    </div>
    {subtitle && <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>}
  </div>
);

const PanelCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, description, right, children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 shadow-sm">
    <div className="flex items-center justify-between mb-3 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-sm text-gray-500">{text}</p>
);

const RefreshButton: React.FC<{
  onClick: () => void;
  loading: boolean;
  small?: boolean;
}> = ({ onClick, loading, small = false }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={cn(
      'inline-flex items-center gap-2 rounded-xl font-semibold shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed',
      small
        ? 'text-xs px-2 py-1 bg-gold text-white hover:bg-gold/90'
        : 'text-sm px-4 py-2 bg-gold text-white hover:bg-gold/90',
    )}
    title="Actualizar historial"
  >
    <RefreshCw size={small ? 14 : 16} className={loading ? 'animate-spin' : ''} />
    {loading ? 'Actualizando...' : 'Actualizar datos'}
  </button>
);

const AdminResultados: React.FC = () => {
  const [historial, setHistorial] = useState<HistorialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const fetchHistorial = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(HISTORIAL_API, { signal });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: unknown = await res.json();

      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor');
      }

      setHistorial((data as HistorialRow[]).map(normalizeHistorialRow));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      console.error(err);
      setError('No se pudo cargar el historial. Intenta nuevamente.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchHistorial(controller.signal);

    return () => controller.abort();
  }, [fetchHistorial]);

  const monthlyStats = useMemo(() => buildMonthlyStats(historial), [historial]);

  const globalStats = useMemo(() => getGlobalStats(monthlyStats), [monthlyStats]);

  useEffect(() => {
    if (monthlyStats.length === 0) {
      if (selectedMonthKey !== null) setSelectedMonthKey(null);
      return;
    }

    const exists = monthlyStats.some((m) => m.key === selectedMonthKey);

    if (!selectedMonthKey || !exists) {
      setSelectedMonthKey(monthlyStats[0].key);
    }
  }, [monthlyStats, selectedMonthKey]);

  const selectedMonth = useMemo(
    () => monthlyStats.find((m) => m.key === selectedMonthKey) ?? null,
    [monthlyStats, selectedMonthKey],
  );

  const dailyStats = useMemo(
    () => buildDailyStats(historial, selectedMonthKey),
    [historial, selectedMonthKey],
  );

  const paymentBreakdown = useMemo(() => {
    if (!selectedMonth) return [];

    const totalMonth = selectedMonth.totalGeneral || 0;

    return Object.entries(selectedMonth.paymentTotals)
      .map(([method, stats]) => ({
        method,
        count: stats.count,
        total: stats.total,
        percentage: totalMonth > 0 ? (stats.total / totalMonth) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [selectedMonth]);

  const ticketPromedioMes = useMemo(() => {
    if (!selectedMonth || selectedMonth.pedidos === 0) return 0;
    return selectedMonth.totalGeneral / selectedMonth.pedidos;
  }, [selectedMonth]);

  const monthlyChartData = useMemo(
    () =>
      [...monthlyStats].reverse().map((m) => ({
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
      <aside className="hidden md:block w-72 shrink-0">
        <div className="sticky top-24 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar size={16} />
              Meses
            </h3>

            <RefreshButton
              onClick={() => fetchHistorial()}
              loading={loading}
              small
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-2 max-h-[calc(100vh-180px)] overflow-y-auto shadow-sm">
            {monthlyStats.length === 0 && !loading && (
              <p className="text-xs text-gray-500 px-1">No hay datos de historial.</p>
            )}

            <div className="space-y-1">
              {monthlyStats.map((m) => {
                const isSelected = selectedMonthKey === m.key;

                return (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMonthKey(m.key)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-xl text-xs md:text-sm border transition shadow-sm hover:shadow-md flex flex-col gap-0.5',
                      isSelected
                        ? 'bg-gold text-white border-gold'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{m.label}</span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full',
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {m.pedidos} pedidos
                      </span>
                    </div>

                    <div
                      className={cn(
                        'text-[11px]',
                        isSelected ? 'text-gray-100' : 'text-gray-500',
                      )}
                    >
                      {formatCOP(m.totalGeneral)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs text-red-600 px-1">{error}</p>}
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-4">
            <RefreshButton
              onClick={() => fetchHistorial()}
              loading={loading}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Ventas históricas"
              value={formatCOP(globalStats.totalVentas)}
              subtitle="Suma de todos los meses registrados"
              icon={<DollarSign size={14} className="text-emerald-500" />}
            />

            <StatCard
              title="Pedidos totales"
              value={globalStats.totalPedidos}
              subtitle="Historial completo del sistema"
              icon={<Activity size={14} className="text-sky-500" />}
            />

            <StatCard
              title="Ticket promedio histórico"
              value={formatCOP(globalStats.ticketPromedioGlobal)}
              subtitle="Promedio por pedido (todos los meses)"
              icon={<TrendingUp size={14} className="text-gold" />}
            />

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

        {monthlyChartData.length > 0 && (
          <PanelCard
            title="Ventas por mes (histórico)"
            description="Restaurante y domicilios apilados, con línea de total."
            icon={<BarChart2 size={18} className="text-gold" />}
            right={
              <span className="text-xs text-gray-500">
                {monthlyStats.length} mes(es) analizado(s)
              </span>
            }
          >
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: number | string) => formatCOP(Number(value))}
                    labelFormatter={(label: string) => `Mes: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="restaurante"
                    name="Restaurante"
                    stackId="ventas"
                    fill="#facc15"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="domicilio"
                    name="Domicilios"
                    stackId="ventas"
                    fill="#38bdf8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </PanelCard>
        )}

        {!selectedMonth && monthlyStats.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="text-sm text-gray-600">
              Aún no hay información de historial para mostrar. Cuando se registren
              pedidos aparecerán aquí.
            </p>
          </div>
        )}

        {selectedMonth && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Mes seleccionado
                  </span>
                  <Calendar size={16} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{selectedMonth.label}</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PanelCard
                title="Ventas diarias del mes"
                description="Total diario (restaurante + domicilio)"
                icon={<TrendingUp size={18} className="text-gold" />}
                right={
                  <span className="text-xs text-gray-500">
                    {dailyStats.length} día(s) con pedidos
                  </span>
                }
              >
                {dailyChartData.length === 0 ? (
                  <EmptyState text="No hay registros diarios para este mes." />
                ) : (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                        />
                        <Tooltip
                          formatter={(value: number | string) => formatCOP(Number(value))}
                          labelFormatter={(label: string) => `Día ${label}`}
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
              </PanelCard>

              <PanelCard
                title="Métodos de pago (total del mes)"
                description="Comparativo por valor cobrado."
                icon={<PieChartIcon size={18} className="text-gold" />}
              >
                {paymentChartData.length === 0 ? (
                  <EmptyState text="No hay información de métodos de pago para este mes." />
                ) : (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={paymentChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                        />
                        <YAxis
                          type="category"
                          dataKey="method"
                          width={120}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value: number | string) => formatCOP(Number(value))}
                          labelFormatter={(label: string) => `Método: ${label}`}
                        />
                        <Bar
                          dataKey="total"
                          name="Total"
                          fill="#0ea5e9"
                          radius={[4, 4, 4, 4]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </PanelCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PanelCard
                title="Detalle por método de pago"
                icon={<PieChartIcon size={18} className="text-gold" />}
              >
                {paymentBreakdown.length === 0 ? (
                  <EmptyState text="No hay información de métodos de pago para este mes." />
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
              </PanelCard>

              <PanelCard
                title="Resultados por día del mes"
                icon={<Calendar size={18} className="text-gold" />}
              >
                {dailyStats.length === 0 ? (
                  <EmptyState text="No hay registros diarios para este mes." />
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
              </PanelCard>
            </div>
          </>
        )}

        {loading && (
          <p className="text-sm text-gray-500">Cargando información de resultados…</p>
        )}
      </div>
    </div>
  );
};

export default AdminResultados;