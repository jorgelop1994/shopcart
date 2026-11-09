import React, { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  Download,
  Printer,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Award,
  Layers,
} from 'lucide-react';
import { ordersApi } from '../../api/orders.api';
import { HttpError } from '../../api/httpClient';
import { useToast } from '../../context/ToastContext';
import {
  AbandonedCartRecord,
  DashboardMetricsResponse,
  PaginationMeta,
} from '../../types/api.types';
import { formatDateTimeGT, formatGTQ } from '../../utils/format';
import { ServerDataTable, TableColumn } from '../../components/ui/ServerDataTable';
import { ErrorState, LoadingState } from '../../components/ui/EmptyAndErrorStates';

export const DashboardPage: React.FC = () => {
  const { showToast } = useToast();

  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de rango de fechas
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [granularity, setGranularity] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);

  // Estado de conexión SSE en tiempo real (+5 pts Extra)
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<string | null>(null);

  // Carritos abandonados (>24h)
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCartRecord[]>([]);
  const [abandonedPagination, setAbandonedPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 8,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loadingAbandoned, setLoadingAbandoned] = useState<boolean>(true);

  const fetchDashboardData = useCallback(
    async (abandonedPage = abandonedPagination.pagina) => {
      setLoading(true);
      setError(null);
      try {
        const [metricsData, abandonedData] = await Promise.all([
          ordersApi.getDashboardMetrics({
            fechaInicio: fechaInicio ? `${fechaInicio}T00:00:00` : undefined,
            fechaFin: fechaFin ? `${fechaFin}T23:59:59` : undefined,
          }),
          ordersApi.listAbandonedCarts({
            pagina: abandonedPage,
            tamanoPagina: 8,
          }),
        ]);
        setMetrics(metricsData);
        setAbandonedCarts(abandonedData.items);
        setAbandonedPagination(abandonedData.pagination);
      } catch (err) {
        setError(
          err instanceof HttpError
            ? err.message
            : 'No fue posible cargar las métricas analíticas del dashboard.'
        );
      } finally {
        setLoading(false);
        setLoadingAbandoned(false);
      }
    },
    [fechaInicio, fechaFin, abandonedPagination.pagina]
  );

  useEffect(() => {
    void fetchDashboardData(1);
  }, [fetchDashboardData]);

  // Suscripción en tiempo real mediante Server-Sent Events (SSE)
  useEffect(() => {
    const streamUrl = ordersApi.getDashboardStreamUrl();
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('connected', () => {
      setSseConnected(true);
    });

    eventSource.addEventListener('dashboard_update', (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(event.data)) as { type?: string; timestamp?: string };
        setLastRealtimeEvent(
          `${parsed.type ?? 'ACTUALIZACION'} (${new Date().toLocaleTimeString('es-GT')})`
        );
        void fetchDashboardData(abandonedPagination.pagina);
      } catch {
        void fetchDashboardData(abandonedPagination.pagina);
      }
    });

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [fetchDashboardData, abandonedPagination.pagina]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await ordersApi.downloadDashboardCsv({
        fechaInicio: fechaInicio ? `${fechaInicio}T00:00:00` : undefined,
        fechaFin: fechaFin ? `${fechaFin}T23:59:59` : undefined,
      });
      showToast('Reporte CSV de ventas descargado correctamente.', 'success');
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'Error al exportar el reporte CSV.',
        'error'
      );
    } finally {
      setExportingCsv(false);
    }
  };

  const abandonedColumns: TableColumn<AbandonedCartRecord>[] = [
    {
      id: 'id',
      header: 'ID Carrito',
      render: (row) => <span className="font-mono font-bold text-slate-900">#{row.IDCarrito}</span>,
    },
    {
      id: 'cliente',
      header: 'Cliente / Invitado',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.NombreCliente}</span>
          <span className="text-xs text-slate-500">
            {row.CorreoCliente ?? `Token: ${row.TokenInvitado?.slice(0, 12) ?? 'N/A'}...`}
          </span>
        </div>
      ),
    },
    {
      id: 'items',
      header: 'Ítems / Unidades',
      align: 'center',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-800">
          {row.CantidadItemsDistintos} ítems ({row.CantidadTotalUnidades} u.)
        </span>
      ),
    },
    {
      id: 'monto',
      header: 'Monto Potencial (GTQ)',
      align: 'right',
      render: (row) => (
        <span className="font-bold text-amber-800">{formatGTQ(row.MontoPotencialGTQ)}</span>
      ),
    },
    {
      id: 'inactividad',
      header: 'Tiempo de Inactividad',
      align: 'center',
      render: (row) => (
        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
          {row.HorasInactividad} h ({row.MinutosInactividad} min)
        </span>
      ),
    },
    {
      id: 'ultima',
      header: 'Última Actividad',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {formatDateTimeGT(row.FechaUltimaActividad)}
        </span>
      ),
    },
  ];

  if (loading && !metrics) {
    return <LoadingState message="Calculando indicadores gerenciales en SQL Server..." />;
  }

  if (error || !metrics) {
    return (
      <ErrorState
        message={error ?? 'No se pudieron obtener las métricas.'}
        onRetry={() => void fetchDashboardData(1)}
      />
    );
  }

  const timeSeriesData =
    granularity === 'dia'
      ? metrics.ventasPorDia.map((d) => ({
          etiqueta: d.Fecha,
          VentasNetasGTQ: d.VentasNetasGTQ,
          NumeroPedidos: d.NumeroPedidos,
        }))
      : granularity === 'semana'
        ? metrics.ventasPorSemana.map((s) => ({
            etiqueta: s.EtiquetaSemana,
            VentasNetasGTQ: s.VentasNetasGTQ,
            NumeroPedidos: s.NumeroPedidos,
          }))
        : metrics.ventasPorMes.map((m) => ({
            etiqueta: m.Mes,
            VentasNetasGTQ: m.VentasNetasGTQ,
            NumeroPedidos: m.NumeroPedidos,
          }));

  return (
    <div className="space-y-6">
      {/* Encabezado y Controles de Exportación / Tiempo Real */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900">
              Dashboard Gerencial y Analítica en Tiempo Real
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                sseConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${sseConnected ? 'text-emerald-600 animate-pulse' : ''}`} />
              {sseConnected ? 'Stream SSE Activo' : 'SSE Reconectando...'}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Ventas netas (descontando cancelaciones y devoluciones), categorías, Top 10 productos y
            carritos abandonados (`RF-08`).
            {lastRealtimeEvent && (
              <span className="ml-2 text-indigo-700 font-semibold">
                • Último evento en vivo: {lastRealtimeEvent}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {exportingCsv ? 'Exportando...' : 'Exportar CSV / Excel'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </button>
          <button
            type="button"
            onClick={() => void fetchDashboardData(abandonedPagination.pagina)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtro de Rango de Fechas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="dash-start" className="block text-xs font-semibold text-slate-700 mb-1">
            Fecha Inicio
          </label>
          <input
            id="dash-start"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="dash-end" className="block text-xs font-semibold text-slate-700 mb-1">
            Fecha Fin
          </label>
          <input
            id="dash-end"
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void fetchDashboardData(1)}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
        >
          Aplicar Período
        </button>
        {(fechaInicio || fechaFin) && (
          <button
            type="button"
            onClick={() => {
              setFechaInicio('');
              setFechaFin('');
            }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Restablecer (Últimos 90 días)
          </button>
        )}
      </div>

      {/* Tarjetas de KPIs Financieros y Operativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            Ventas Netas Efectivas (GTQ)
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {formatGTQ(metrics.kpis.VentasNetasGTQ)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex justify-between">
            <span>Brutas: {formatGTQ(metrics.kpis.VentasBrutasGTQ)}</span>
            <span className="text-amber-700">
              Dev.: -{formatGTQ(metrics.kpis.DevolucionesGTQ)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Pedidos Completados y Ticket
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {metrics.kpis.TotalPedidosCompletados} pedidos
          </div>
          <div className="text-xs text-slate-500 mt-2 flex justify-between">
            <span>Ticket Prom.: {formatGTQ(metrics.kpis.TicketPromedioGTQ)}</span>
            <span className="text-rose-600">
              Cancelados: {metrics.kpis.TotalPedidosCancelados}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
            Descuentos por Cupones (GTQ)
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {formatGTQ(metrics.kpis.DescuentosGTQ)}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Ahorro total otorgado en órdenes válidas del período.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/30 shadow-xs p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Carritos Abandonados (&gt;24h)
          </span>
          <div className="text-2xl font-extrabold text-amber-950 mt-1">
            {metrics.kpis.TotalCarritosAbandonados} carritos
          </div>
          <p className="text-xs text-amber-800 mt-2 font-semibold">
            Potencial retenido: {formatGTQ(metrics.kpis.MontoPotencialCarritosAbandonadosGTQ)}
          </p>
        </div>
      </div>

      {/* Gráfico 1: Serie Temporal de Ventas Netas y Pedidos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Evolución de Ventas Netas (GTQ) y Volumen de Pedidos
              </h2>
              <p className="text-xs text-slate-500">
                Agrupación dinámica calculada en servidor (`SP_Dashboard_ObtenerMetricas`).
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {(['dia', 'semana', 'mes'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  granularity === g
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {g === 'dia' ? 'Por Día' : g === 'semana' ? 'Por Semana' : 'Por Mes'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(val: number) => `Q${val}`}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [
                  name === 'Ventas Netas (GTQ)' ? formatGTQ(Number(value)) : Number(value),
                  String(name),
                ]}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="VentasNetasGTQ"
                name="Ventas Netas (GTQ)"
                fill="#4f46e5"
                radius={[6, 6, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="NumeroPedidos"
                name="N° Pedidos"
                stroke="#059669"
                strokeWidth={2.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficos 2 y 3: Ventas por Categoría y Top 10 Productos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por Categoría */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ventas Netas por Categoría (GTQ)
              </h2>
              <p className="text-xs text-slate-500">
                Desempeño comercial por línea de negocio descontando devoluciones.
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.ventasPorCategoria} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `Q${v}`} />
                <YAxis
                  type="category"
                  dataKey="NombreCategoria"
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(val: unknown) => formatGTQ(Number(val))} />
                <Bar
                  dataKey="VentasNetasGTQ"
                  name="Ventas Netas (GTQ)"
                  fill="#0ea5e9"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2 px-3">Categoría</th>
                  <th className="py-2 px-3 text-center">Unid. Netas</th>
                  <th className="py-2 px-3 text-right">Ventas Netas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {metrics.ventasPorCategoria.map((cat) => (
                  <tr key={cat.IDCategoria}>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {cat.NombreCategoria}
                    </td>
                    <td className="py-2 px-3 text-center">{cat.UnidadesNetasVendidas}</td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-700">
                      {formatGTQ(cat.VentasNetasGTQ)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Productos Más Vendidos */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Top 10 Productos Más Vendidos
              </h2>
              <p className="text-xs text-slate-500">
                Ranking por unidades netas vendidas y facturación efectiva en Quetzales.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2 px-3"># / Producto</th>
                  <th className="py-2 px-3 text-center">Vendidas</th>
                  <th className="py-2 px-3 text-center">Devueltas</th>
                  <th className="py-2 px-3 text-center">Netas</th>
                  <th className="py-2 px-3 text-right">Monto Neto (GTQ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {metrics.top10Productos.map((prod, idx) => (
                  <tr key={prod.IDProducto}>
                    <td className="py-2 px-3">
                      <span className="font-bold text-indigo-600 mr-1.5">#{idx + 1}</span>
                      <span className="font-semibold text-slate-900">{prod.NombreProducto}</span>
                      <span className="block text-[11px] text-slate-500">
                        {prod.NombreCategoria}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">{prod.UnidadesBrutasVendidas}</td>
                    <td className="py-2 px-3 text-center text-amber-700">
                      {prod.UnidadesDevueltas}
                    </td>
                    <td className="py-2 px-3 text-center font-extrabold text-emerald-700">
                      {prod.UnidadesNetasVendidas}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatGTQ(prod.MontoNetoVendidoGTQ)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabla de Carritos Abandonados (> 24 horas) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-amber-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Monitor de Carritos Abandonados (&gt; 24 horas de inactividad)
            </h2>
            <p className="text-xs text-slate-600">
              Carritos abiertos con ítems pendientes de conversión (`SP_Dashboard_ListarCarritosAbandonados`).
            </p>
          </div>
        </div>

        <ServerDataTable
          caption="Listado paginado de carritos abandonados con más de 24 horas de inactividad"
          columns={abandonedColumns}
          data={abandonedCarts}
          keyExtractor={(row) => row.IDCarrito}
          pagination={abandonedPagination}
          onPageChange={(page) => void fetchDashboardData(page)}
          loading={loadingAbandoned}
          emptyTitle="No hay carritos abandonados mayores a 24 horas"
          emptyDescription="Todos los carritos activos han tenido actividad reciente o ya fueron convertidos en pedidos."
        />
      </div>
    </div>
  );
};
