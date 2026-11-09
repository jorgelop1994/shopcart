import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Package, Search, XCircle } from 'lucide-react';
import { ordersApi } from '../../api/orders.api';
import { HttpError } from '../../api/httpClient';
import { useToast } from '../../context/ToastContext';
import {
  OrderDetailRecord,
  OrderSummaryRecord,
  PaginationMeta,
} from '../../types/api.types';
import { formatDateTimeGT, formatGTQ } from '../../utils/format';
import { ServerDataTable, TableColumn } from '../../components/ui/ServerDataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { FormField } from '../../components/ui/FormField';

export const MyOrdersPage: React.FC = () => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<OrderSummaryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 10,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros y ordenamiento en servidor
  const [estadoFiltro, setEstadoFiltro] = useState<string>('');
  const [busqueda, setBusqueda] = useState<string>('');
  const [ordenarPor, setOrdenarPor] = useState<string>('recientes');

  // Detalle de pedido seleccionado
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [canceling, setCanceling] = useState<boolean>(false);

  const fetchOrders = useCallback(
    async (page = pagination.pagina) => {
      setLoading(true);
      setError(null);
      try {
        const res = await ordersApi.listOrders({
          pagina: page,
          tamanoPagina: 10,
          estadoPedido: estadoFiltro || undefined,
          busqueda: busqueda.trim() || undefined,
          ordenarPor,
        });
        setOrders(res.items);
        setPagination(res.pagination);
      } catch (err) {
        setError(
          err instanceof HttpError ? err.message : 'No fue posible consultar tus pedidos.'
        );
      } finally {
        setLoading(false);
      }
    },
    [pagination.pagina, estadoFiltro, busqueda, ordenarPor]
  );

  useEffect(() => {
    void fetchOrders(1);
  }, [estadoFiltro, ordenarPor, fetchOrders]);

  const handleOpenDetail = async (idPedido: number) => {
    setLoadingDetail(true);
    setCancelReason('');
    try {
      const detail = await ordersApi.getOrderDetail(idPedido);
      setSelectedOrder(detail);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No se pudo cargar el detalle del pedido.',
        'error'
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (cancelReason.trim().length < 5) {
      showToast('Indica un motivo de cancelación de al menos 5 caracteres.', 'warning');
      return;
    }

    setCanceling(true);
    try {
      const updated = await ordersApi.changeOrderState(selectedOrder.IDPedido, {
        estadoNuevo: 'Cancelado',
        motivoComentario: cancelReason.trim(),
      });
      setSelectedOrder(updated);
      setCancelReason('');
      showToast(
        `Pedido ${updated.NumeroPedido} cancelado. Existencia reintegrada a inventario y cupón liberado.`,
        'success'
      );
      await fetchOrders(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No fue posible cancelar el pedido.',
        'error'
      );
    } finally {
      setCanceling(false);
    }
  };

  const handleSortChange = (sortKey: string) => {
    setOrdenarPor((prev) => {
      if (sortKey === 'fecha') return prev === 'recientes' ? 'antiguos' : 'recientes';
      if (sortKey === 'total') return prev === 'total_desc' ? 'total_asc' : 'total_desc';
      if (sortKey === 'estado') return 'estado_asc';
      return 'recientes';
    });
  };

  const columns: TableColumn<OrderSummaryRecord>[] = [
    {
      id: 'numero',
      header: 'N° Pedido',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-slate-900">{row.NumeroPedido}</span>
          {row.CodigoCuponSnapshot && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              {row.CodigoCuponSnapshot}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'fecha',
      header: 'Fecha Creación',
      sortKey: 'fecha',
      render: (row) => <span className="text-xs text-slate-600">{formatDateTimeGT(row.FechaCreacion)}</span>,
    },
    {
      id: 'estado',
      header: 'Estado Actual',
      sortKey: 'estado',
      render: (row) => <StatusBadge status={row.EstadoPedido} />,
    },
    {
      id: 'unidades',
      header: 'Unidades',
      align: 'center',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-900">{row.TotalUnidadesCompradas}</span>
          {row.TotalUnidadesDevueltas > 0 && (
            <span className="text-amber-700 block">(-{row.TotalUnidadesDevueltas} dev.)</span>
          )}
        </div>
      ),
    },
    {
      id: 'total',
      header: 'Total Pagado (GTQ)',
      align: 'right',
      sortKey: 'total',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900">{formatGTQ(row.TotalPagado)}</span>
          {row.MontoReintegradoAcumulado > 0 && (
            <span className="block text-[11px] text-amber-700">
              Neto: {formatGTQ(row.TotalNetoEfectivo)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenDetail(row.IDPedido)}
          disabled={loadingDetail}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          Detalle y Seguimiento
        </button>
      ),
    },
  ];

  const canCustomerCancel =
    selectedOrder &&
    (selectedOrder.EstadoPedido === 'Pagado' || selectedOrder.EstadoPedido === 'EnPreparacion');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Package className="w-6 h-6 text-indigo-600" />
            Mis Pedidos y Seguimiento
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Consulta el estado de tus órdenes, precios congelados en snapshot e historial de
            transiciones (`RF-07`).
          </p>
        </div>
      </div>

      {/* Barra de filtros en servidor */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="my-orders-search" className="block text-xs font-semibold text-slate-700 mb-1">
            Buscar por N° de Pedido
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="my-orders-search"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchOrders(1);
              }}
              placeholder="Ej. PED-2026..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="w-full sm:w-48">
          <label htmlFor="my-orders-status" className="block text-xs font-semibold text-slate-700 mb-1">
            Estado del Pedido
          </label>
          <select
            id="my-orders-status"
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="Pagado">Pagado</option>
            <option value="EnPreparacion">En Preparación</option>
            <option value="Despachado">Despachado</option>
            <option value="Entregado">Entregado</option>
            <option value="DevueltoParcial">Devuelto Parcial</option>
            <option value="DevueltoTotal">Devuelto Total</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>

        <div className="w-full sm:w-52">
          <label htmlFor="my-orders-sort" className="block text-xs font-semibold text-slate-700 mb-1">
            Ordenar en Servidor por
          </label>
          <select
            id="my-orders-sort"
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
          >
            <option value="recientes">Más recientes primero</option>
            <option value="antiguos">Más antiguos primero</option>
            <option value="total_desc">Mayor monto pagado</option>
            <option value="total_asc">Menor monto pagado</option>
            <option value="estado_asc">Estado (A-Z)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => void fetchOrders(1)}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
        >
          Filtrar
        </button>
      </div>

      <ServerDataTable
        caption="Historial de pedidos del cliente"
        columns={columns}
        data={orders}
        keyExtractor={(row) => row.IDPedido}
        pagination={pagination}
        onPageChange={(page) => void fetchOrders(page)}
        sortKey={
          ordenarPor.startsWith('total')
            ? 'total'
            : ordenarPor === 'estado_asc'
              ? 'estado'
              : 'fecha'
        }
        sortDirection={
          ordenarPor === 'antiguos' || ordenarPor === 'total_asc' || ordenarPor === 'estado_asc'
            ? 'asc'
            : 'desc'
        }
        onSortChange={handleSortChange}
        loading={loading}
        error={error}
        onRetry={() => void fetchOrders(pagination.pagina)}
        emptyTitle="Aún no tienes pedidos registrados"
        emptyDescription="Explora nuestro catálogo y realiza tu primera compra con precios en Quetzales (GTQ)."
      />

      {/* Modal de Detalle, Historial de Estados y Cancelación */}
      <ModalDialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder
            ? `Detalle del Pedido ${selectedOrder.NumeroPedido}`
            : 'Detalle del Pedido'
        }
        maxWidthClass="max-w-4xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 block">Estado Actual</span>
                <div className="mt-1">
                  <StatusBadge status={selectedOrder.EstadoPedido} />
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Fecha de Compra</span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatDateTimeGT(selectedOrder.FechaCreacion)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Total Pagado (IVA 12% incl.)</span>
                <span className="text-base font-extrabold text-indigo-700">
                  {formatGTQ(selectedOrder.Total)}
                </span>
              </div>
              {selectedOrder.MontoReintegradoAcumulado > 0 && (
                <div>
                  <span className="text-xs text-amber-700 block">Reintegrado por Devolución</span>
                  <span className="text-sm font-bold text-amber-800">
                    -{formatGTQ(selectedOrder.MontoReintegradoAcumulado)} (Neto:{' '}
                    {formatGTQ(selectedOrder.TotalNetoEfectivo)})
                  </span>
                </div>
              )}
            </div>

            {/* Líneas del Pedido con Snapshot de Precios */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Productos Adquiridos (Precios Congelados en Snapshot)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <th className="py-2.5 px-3">SKU / Producto</th>
                      <th className="py-2.5 px-3 text-center">Comprado</th>
                      <th className="py-2.5 px-3 text-center">Devuelto</th>
                      <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                      <th className="py-2.5 px-3 text-right">Desc. Línea</th>
                      <th className="py-2.5 px-3 text-right">Subtotal Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedOrder.lineas.map((line) => (
                      <tr key={line.IDDetallePedido}>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {line.NombreProductoSnapshot}
                          </div>
                          <div className="font-mono text-slate-500">{line.SKUSnapshot}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          {line.CantidadComprada}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {line.CantidadDevuelta > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                              {line.CantidadDevuelta}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {formatGTQ(line.PrecioUnitarioCongelado)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700">
                          {line.DescuentoProporcionalLinea > 0
                            ? `-${formatGTQ(line.DescuentoProporcionalLinea)}`
                            : 'Q 0.00'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatGTQ(line.TotalLineaNeto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Historial de Estados (Máquina de Estados RF-07) */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Línea de Tiempo y Trazabilidad de Estados (`HistorialEstadosPedido`)
              </h3>
              <div className="space-y-2">
                {selectedOrder.historialEstados.map((hist) => (
                  <div
                    key={hist.IDHistorialEstadoPedido}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {hist.EstadoAnterior ? (
                        <>
                          <StatusBadge status={hist.EstadoAnterior} />
                          <span className="text-slate-400">→</span>
                        </>
                      ) : null}
                      <StatusBadge status={hist.EstadoNuevo} />
                      <span className="font-medium text-slate-800">
                        {hist.MotivoComentario ?? 'Sin comentario adicional'}
                      </span>
                    </div>
                    <div className="text-slate-500 shrink-0">
                      {hist.NombreUsuario} ({hist.RolUsuario}) • {formatDateTimeGT(hist.FechaCambio)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Devoluciones registradas si existen */}
            {selectedOrder.devoluciones.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  Devoluciones Registradas (`Devoluciones`)
                </h3>
                <div className="space-y-2">
                  {selectedOrder.devoluciones.map((dev) => (
                    <div
                      key={dev.IDDevolucion}
                      className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-amber-900">{dev.TipoDevolucion}:</span>{' '}
                        <span className="text-amber-800">{dev.Motivo}</span>
                      </div>
                      <div className="font-bold text-amber-950">
                        Reintegrado: {formatGTQ(dev.MontoReintegrado)} •{' '}
                        {formatDateTimeGT(dev.FechaDevolucion)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancelación por el Cliente (Permitida en Pagado o EnPreparacion según RF-07) */}
            {canCustomerCancel && (
              <form
                onSubmit={handleCancelOrder}
                className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-3"
              >
                <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Cancelar Pedido (Disponible antes de ser Despachado)</span>
                </div>
                <p className="text-xs text-rose-800">
                  Al cancelar el pedido en estado <strong>{selectedOrder.EstadoPedido}</strong>, el
                  sistema reintegrará automáticamente las unidades al Kardex (
                  <code>REINGRESO_CANCELACION</code>) y revertirá el consumo de tu cupón.
                </p>
                <FormField
                  id="customer-cancel-reason"
                  label="Motivo de la cancelación"
                  hint="Mínimo 5 caracteres."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                  minLength={5}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={canceling}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    {canceling ? 'Cancelando pedido...' : 'Confirmar Cancelación de Pedido'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </ModalDialog>
    </div>
  );
};
