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
  estado?: string;
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
  pedidosConDomicilio: number;
  pedidosSinDomicilio: number;
  paymentTotals: Record<string, PaymentTotal>;
  statusTotals: Record<string, number>;
}

interface DailyStats {
  dateKey: string; // YYYY-MM-DD
  label: string; // Lunes 03/03
  shortLabel: string; // Lun 03
  dayName: string;
  pedidos: number;
  pedidosConDomicilio: number;
  pedidosSinDomicilio: number;
  totalRestaurante: number;
  totalDomicilio: number;
  totalGeneral: number;
  isClosed: boolean;
  statusTotals: Record<string, number>;
}

interface ParsedFecha {
  day: number;
  month: number;
  year: number;
  monthKey: string;
  dateKey: string;
  dayName: string;
  shortDayName: string;
}

type ActiveTab = 'general' | 'mes';

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

const weekdayNamesEs = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

const weekdayShortNamesEs = [
  'Dom',
  'Lun',
  'Mar',
  'Mié',
  'Jue',
  'Vie',
  'Sáb',
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

const normalizeKey = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, '_');

  return normalized || fallback;
};

const normalizePaymentMethod = (value: unknown) =>
  normalizeKey(value, 'sin_especificar');

const normalizeOrderStatus = (value: unknown) =>
  normalizeKey(value, 'sin_estado');

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

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
    2,
    '0',
  )}`;

  return {
    day,
    month,
    year,
    monthKey,
    dateKey,
    dayName: weekdayNamesEs[date.getDay()],
    shortDayName: weekdayShortNamesEs[date.getDay()],
  };
};

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

const createEmptyDailyStat = (year: number, month: number, day: number): DailyStats => {
  const date = new Date(year, month - 1, day);
  const dayName = weekdayNamesEs[date.getDay()];
  const shortDayName = weekdayShortNamesEs[date.getDay()];
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');

  return {
    dateKey: `${year}-${mm}-${dd}`,
    label: `${dayName} ${dd}/${mm}`,
    shortLabel: `${shortDayName} ${dd}`,
    dayName,
    pedidos: 0,
    pedidosConDomicilio: 0,
    pedidosSinDomicilio: 0,
    totalRestaurante: 0,
    totalDomicilio: 0,
    totalGeneral: 0,
    isClosed: true,
    statusTotals: {},
  };
};

const normalizeHistorialRow = (row: HistorialRow): HistorialRow => ({
  ...row,
  valor_restaurante: toNumber(row.valor_restaurante),
  valor_domicilio: toNumber(row.valor_domicilio),
  metodo_pago: normalizePaymentMethod(row.metodo_pago),
  estado: normalizeOrderStatus(row.estado),
});

const buildStatusBreakdown = (
  statusTotals: Record<string, number>,
  totalBase: number,
) =>
  Object.entries(statusTotals)
    .map(([status, count]) => ({
      status,
      count,
      percentage: totalBase > 0 ? (count / totalBase) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));

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
    const orderStatus = normalizeOrderStatus(row.estado);
    const tieneDomicilio = vd > 0;

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
        pedidosConDomicilio: 0,
        pedidosSinDomicilio: 0,
        paymentTotals: {},
        statusTotals: {},
      };
      map.set(monthKey, current);
    }

    current.totalRestaurante += vr;
    current.totalDomicilio += vd;
    current.totalGeneral += total;
    current.pedidos += 1;

    if (tieneDomicilio) {
      current.pedidosConDomicilio += 1;
    } else {
      current.pedidosSinDomicilio += 1;
    }

    if (!current.paymentTotals[paymentMethod]) {
      current.paymentTotals[paymentMethod] = { count: 0, total: 0 };
    }

    current.paymentTotals[paymentMethod].count += 1;
    current.paymentTotals[paymentMethod].total += total;

    current.statusTotals[orderStatus] = (current.statusTotals[orderStatus] ?? 0) + 1;
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

  const [yearStr, monthStr] = selectedMonthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!year || !month) return [];

  const map = new Map<string, DailyStats>();
  const daysInMonth = getDaysInMonth(year, month);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const emptyDay = createEmptyDailyStat(year, month, day);
    map.set(emptyDay.dateKey, emptyDay);
  }

  for (const rawRow of historial) {
    const row = normalizeHistorialRow(rawRow);
    const parsed = parseFechaParts(row.fecha);

    if (!parsed || parsed.monthKey !== selectedMonthKey) continue;

    const current = map.get(parsed.dateKey);
    if (!current) continue;

    const vr = toNumber(row.valor_restaurante);
    const vd = toNumber(row.valor_domicilio);
    const tieneDomicilio = vd > 0;
    const orderStatus = normalizeOrderStatus(row.estado);

    current.isClosed = false;
    current.pedidos += 1;
    current.totalRestaurante += vr;
    current.totalDomicilio += vd;
    current.totalGeneral += vr + vd;

    if (tieneDomicilio) {
      current.pedidosConDomicilio += 1;
    } else {
      current.pedidosSinDomicilio += 1;
    }

    current.statusTotals[orderStatus] = (current.statusTotals[orderStatus] ?? 0) + 1;
  }

  return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

const getGlobalStats = (monthlyStats: MonthlyStats[]) => {
  if (monthlyStats.length === 0) {
    return {
      totalPedidos: 0,
      totalPedidosConDomicilio: 0,
      totalPedidosSinDomicilio: 0,
      totalVentas: 0,
      mejorMes: null as MonthlyStats | null,
      ticketPromedioGlobal: 0,
    };
  }

  const totalPedidos = monthlyStats.reduce((acc, item) => acc + item.pedidos, 0);
  const totalPedidosConDomicilio = monthlyStats.reduce(
    (acc, item) => acc + item.pedidosConDomicilio,
    0,
  );
  const totalPedidosSinDomicilio = monthlyStats.reduce(
    (acc, item) => acc + item.pedidosSinDomicilio,
    0,
  );
  const totalVentas = monthlyStats.reduce((acc, item) => acc + item.totalGeneral, 0);
  const mejorMes =
    monthlyStats.reduce<MonthlyStats | null>(
      (best, current) =>
        !best || current.totalGeneral > best.totalGeneral ? current : best,
      null,
    ) ?? null;

  return {
    totalPedidos,
    totalPedidosConDomicilio,
    totalPedidosSinDomicilio,
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');

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

  const monthStatusBreakdown = useMemo(() => {
    if (!selectedMonth) return [];
    return buildStatusBreakdown(selectedMonth.statusTotals, selectedMonth.pedidos);
  }, [selectedMonth]);

  const globalStatusBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};

    monthlyStats.forEach((month) => {
      Object.entries(month.statusTotals).forEach(([status, count]) => {
        totals[status] = (totals[status] ?? 0) + count;
      });
    });

    return buildStatusBreakdown(totals, globalStats.totalPedidos);
  }, [monthlyStats, globalStats.totalPedidos]);

  const ticketPromedioMes = useMemo(() => {
    if (!selectedMonth || selectedMonth.pedidos === 0) return 0;
    return selectedMonth.totalGeneral / selectedMonth.pedidos;
  }, [selectedMonth]);

  const closedDaysCount = useMemo(
    () => dailyStats.filter((d) => d.isClosed).length,
    [dailyStats],
  );

  const monthlyChartData = useMemo(
    () =>
      [...monthlyStats].reverse().map((m) => ({
        name: `${(monthNamesEs[m.month - 1] || '').slice(0, 3)} ${String(m.year).slice(2)}`,
        restaurante: Math.round(m.totalRestaurante),
        domicilio: Math.round(m.totalDomicilio),
        total: Math.round(m.totalGeneral),
        pedidos: m.pedidos,
        pedidosConDomicilio: m.pedidosConDomicilio,
        pedidosSinDomicilio: m.pedidosSinDomicilio,
      })),
    [monthlyStats],
  );

  const dailyChartData = useMemo(
    () =>
      dailyStats.map((d) => ({
        name: d.shortLabel,
        fullLabel: d.label,
        total: Math.round(d.totalGeneral),
        restaurante: Math.round(d.totalRestaurante),
        domicilio: Math.round(d.totalDomicilio),
        pedidos: d.pedidos,
        conDomicilio: d.pedidosConDomicilio,
        sinDomicilio: d.pedidosSinDomicilio,
        isClosed: d.isClosed,
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

  const monthStatusChartData = useMemo(
    () =>
      monthStatusBreakdown.map((item) => ({
        status: toTitleCase(item.status),
        count: item.count,
      })),
    [monthStatusBreakdown],
  );

  const globalStatusChartData = useMemo(
    () =>
      globalStatusBreakdown.map((item) => ({
        status: toTitleCase(item.status),
        count: item.count,
      })),
    [globalStatusBreakdown],
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-200">
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('general')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold border transition',
              activeTab === 'general'
                ? 'bg-gold text-white border-gold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
            )}
          >
            General
          </button>

          <button
            onClick={() => setActiveTab('mes')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold border transition',
              activeTab === 'mes'
                ? 'bg-gold text-white border-gold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
            )}
          >
            Mes
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
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
              title="Con domicilio"
              value={globalStats.totalPedidosConDomicilio}
              subtitle="Pedidos con costo de domicilio"
              icon={<MapPin size={14} className="text-blue-500" />}
            />

            <StatCard
              title="Sin domicilio"
              value={globalStats.totalPedidosSinDomicilio}
              subtitle="Recogen / domicilio en 0"
              icon={<Activity size={14} className="text-amber-500" />}
            />

            <StatCard
              title="Ticket promedio histórico"
              value={formatCOP(globalStats.ticketPromedioGlobal)}
              subtitle="Promedio por pedido"
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

          {monthlyChartData.length > 0 ? (
            <PanelCard
              title="Ventas por mes (histórico)"
              description="Gráfica general de todos los meses."
              icon={<BarChart2 size={18} className="text-gold" />}
              right={
                <span className="text-xs text-gray-500">
                  {monthlyStats.length} mes(es) analizado(s)
                </span>
              }
            >
              <div className="w-full h-80">
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
          ) : (
            !loading && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="text-sm text-gray-600">
                  Aún no hay información histórica para mostrar.
                </p>
              </div>
            )
          )}

          <PanelCard
            title="Resumen por mes"
            description="Incluye pedidos con domicilio y sin domicilio."
            icon={<Calendar size={18} className="text-gold" />}
          >
            {monthlyStats.length === 0 ? (
              <EmptyState text="No hay meses disponibles." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                      <th className="py-2 pr-2">Mes</th>
                      <th className="py-2 px-2 text-right">Pedidos</th>
                      <th className="py-2 px-2 text-right">Con dom.</th>
                      <th className="py-2 px-2 text-right">Sin dom.</th>
                      <th className="py-2 px-2 text-right">Restaurante</th>
                      <th className="py-2 px-2 text-right">Domicilio</th>
                      <th className="py-2 pl-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyStats.map((m) => (
                      <tr key={m.key} className="border-b last:border-0">
                        <td className="py-2 pr-2 text-gray-800 font-medium">{m.label}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{m.pedidos}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {m.pedidosConDomicilio}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {m.pedidosSinDomicilio}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {formatCOP(m.totalRestaurante)}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {formatCOP(m.totalDomicilio)}
                        </td>
                        <td className="py-2 pl-2 text-right font-medium tabular-nums">
                          {formatCOP(m.totalGeneral)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PanelCard
              title="Estados del pedido (histórico)"
              description="Conteo acumulado por etapa en todo el historial."
              icon={<Activity size={18} className="text-gold" />}
            >
              {globalStatusChartData.length === 0 ? (
                <EmptyState text="No hay estados registrados en el historial." />
              ) : (
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={globalStatusChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="status"
                        width={140}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number | string) => [
                          `${Number(value)} pedido(s)`,
                          'Cantidad',
                        ]}
                        labelFormatter={(label: string) => `Estado: ${label}`}
                      />
                      <Bar
                        dataKey="count"
                        name="Pedidos"
                        fill="#0f172a"
                        radius={[4, 4, 4, 4]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </PanelCard>

            <PanelCard
              title="Detalle histórico por estado"
              description="Distribución total de pedidos por etapa."
              icon={<PieChartIcon size={18} className="text-gold" />}
            >
              {globalStatusBreakdown.length === 0 ? (
                <EmptyState text="No hay estados registrados en el historial." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                        <th className="py-2 pr-2">Estado</th>
                        <th className="py-2 px-2 text-right">Cantidad</th>
                        <th className="py-2 pl-2 text-right">% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalStatusBreakdown.map((item) => (
                        <tr key={item.status} className="border-b last:border-0">
                          <td className="py-2 pr-2">
                            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              {toTitleCase(item.status)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {item.count}
                          </td>
                          <td className="py-2 pl-2 text-right tabular-nums">
                            {item.percentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </PanelCard>
          </div>
        </div>
      )}

      {activeTab === 'mes' && (
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
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-6">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
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
                        Con domicilio
                      </span>
                      <MapPin size={16} className="text-cyan-500" />
                    </div>
                    <p className="text-lg font-bold text-gray-900 tabular-nums">
                      {selectedMonth.pedidosConDomicilio}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Pedidos con domicilio mayor a 0
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Sin domicilio
                      </span>
                      <Activity size={16} className="text-amber-500" />
                    </div>
                    <p className="text-lg font-bold text-gray-900 tabular-nums">
                      {selectedMonth.pedidosSinDomicilio}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Recogen / domicilio en 0
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Ticket promedio
                      </span>
                      <TrendingUp size={16} className="text-gold" />
                    </div>
                    <p className="text-lg font-bold text-gray-900 tabular-nums">
                      {formatCOP(ticketPromedioMes)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Promedio por pedido del mes
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PanelCard
                    title="Ventas diarias del mes"
                    description="Incluye todos los días del mes; si no hubo pedidos se muestra en 0."
                    icon={<TrendingUp size={18} className="text-gold" />}
                    right={
                      <span className="text-xs text-gray-500">
                        {dailyStats.length} día(s) · {closedDaysCount} cerrado(s)
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
                              formatter={(value: number | string, name: string, item: any) => {
                                if (name === 'Total' && item?.payload?.isClosed) {
                                  return [`${formatCOP(Number(value))} · Cerrado`, name];
                                }
                                return [formatCOP(Number(value)), name];
                              }}
                              labelFormatter={(_label: string, payload: any[]) => {
                                const fullLabel = payload?.[0]?.payload?.fullLabel;
                                return fullLabel ? `Día: ${fullLabel}` : 'Día';
                              }}
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
                    title="Pedidos por día"
                    description="Con domicilio vs sin domicilio. Los días cerrados aparecen en 0."
                    icon={<BarChart2 size={18} className="text-gold" />}
                  >
                    {dailyChartData.length === 0 ? (
                      <EmptyState text="No hay pedidos registrados para este mes." />
                    ) : (
                      <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                              formatter={(value: number | string) => Number(value)}
                              labelFormatter={(_label: string, payload: any[]) => {
                                const current = payload?.[0]?.payload;
                                if (!current) return 'Día';
                                return current.isClosed
                                  ? `Día: ${current.fullLabel} · Cerrado`
                                  : `Día: ${current.fullLabel}`;
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar
                              dataKey="conDomicilio"
                              name="Con domicilio"
                              fill="#38bdf8"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="sinDomicilio"
                              name="Sin domicilio"
                              fill="#facc15"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </PanelCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                              formatter={(value: number | string) =>
                                formatCOP(Number(value))
                              }
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
                                <td className="py-2 px-2 text-right tabular-nums">
                                  {p.count}
                                </td>
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PanelCard
                    title="Estados del pedido (mes)"
                    description="Conteo por etapa para el mes seleccionado."
                    icon={<Activity size={18} className="text-gold" />}
                  >
                    {monthStatusChartData.length === 0 ? (
                      <EmptyState text="No hay estados registrados para este mes." />
                    ) : (
                      <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthStatusChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                            <YAxis
                              type="category"
                              dataKey="status"
                              width={140}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(value: number | string) => [
                                `${Number(value)} pedido(s)`,
                                'Cantidad',
                              ]}
                              labelFormatter={(label: string) => `Estado: ${label}`}
                            />
                            <Bar
                              dataKey="count"
                              name="Pedidos"
                              fill="#16a34a"
                              radius={[4, 4, 4, 4]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </PanelCard>

                  <PanelCard
                    title="Detalle por estado del mes"
                    icon={<PieChartIcon size={18} className="text-gold" />}
                  >
                    {monthStatusBreakdown.length === 0 ? (
                      <EmptyState text="No hay estados registrados para este mes." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                              <th className="py-2 pr-2">Estado</th>
                              <th className="py-2 px-2 text-right">Cantidad</th>
                              <th className="py-2 pl-2 text-right">% del mes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthStatusBreakdown.map((item) => (
                              <tr key={item.status} className="border-b last:border-0">
                                <td className="py-2 pr-2">
                                  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                    {toTitleCase(item.status)}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums">
                                  {item.count}
                                </td>
                                <td className="py-2 pl-2 text-right tabular-nums">
                                  {item.percentage.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </PanelCard>
                </div>

                <PanelCard
                  title="Resultados por día del mes"
                  description="Se muestran todos los días del mes. Si no hubo pedidos aparece como cerrado."
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
                            <th className="py-2 px-2 text-right">Con dom.</th>
                            <th className="py-2 px-2 text-right">Sin dom.</th>
                            <th className="py-2 px-2 text-right">Restaurante</th>
                            <th className="py-2 px-2 text-right">Domicilio</th>
                            <th className="py-2 px-2 text-center">Estado día</th>
                            <th className="py-2 pl-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyStats.map((d) => (
                            <tr
                              key={d.dateKey}
                              className={cn(
                                'border-b last:border-0',
                                d.isClosed && 'bg-gray-50/80',
                              )}
                            >
                              <td className="py-2 pr-2 text-gray-800">
                                <div className="font-medium">{d.label}</div>
                                {d.isClosed && (
                                  <div className="text-[11px] text-gray-500">Sin pedidos</div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {d.pedidos}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {d.pedidosConDomicilio}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {d.pedidosSinDomicilio}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {formatCOP(d.totalRestaurante)}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {formatCOP(d.totalDomicilio)}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {d.isClosed ? (
                                  <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                                    Cerrado
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                    Abierto
                                  </span>
                                )}
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
              </>
            )}

            {loading && (
              <p className="text-sm text-gray-500">Cargando información de resultados…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminResultados;