import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  ClipboardList,
  Eye,
  RotateCcw,
  Search,
} from 'lucide-react';
import { ordersApi } from '../../api/orders.api';
import { HttpError } from '../../api/httpClient';
import { useToast } from '../../context/ToastContext';
import {
  OrderDetailRecord,
  OrderState,
  OrderSummaryRecord,
  PaginationMeta,
} from '../../types/api.types';
import { formatDateTimeGT, formatGTQ } from '../../utils/format';
import { ServerDataTable, TableColumn } from '../../components/ui/ServerDataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ModalDialog } from '../../components/ui/ModalDialog';
import { FormField } from '../../components/ui/FormField';

const ALLOWED_TRANSITIONS: Record<OrderState, OrderState[]> = {
  Pagado: ['EnPreparacion', 'Cancelado'],
  EnPreparacion: ['Despachado', 'Cancelado'],
  Despachado: ['Entregado'],
  Entregado: [],
  DevueltoParcial: [],
  DevueltoTotal: [],
  Cancelado: [],
};

export const OrdersManagementPage: React.FC = () => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<OrderSummaryRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    pagina: 1,
    tamanoPagina: 12,
    totalRegistros: 0,
    totalPaginas: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros en servidor
  const [busqueda, setBusqueda] = useState<string>('');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [ordenarPor, setOrdenarPor] = useState<string>('recientes');

  // Detalle y gestión de estado
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [targetState, setTargetState] = useState<OrderState | ''>('');
  const [stateComment, setStateComment] = useState<string>('');
  const [updatingState, setUpdatingState] = useState<boolean>(false);

  // Gestión de devolución parcial/total (RF-07)
  const [returnModalOpen, setReturnModalOpen] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [submittingReturn, setSubmittingReturn] = useState<boolean>(false);

  const fetchOrders = useCallback(
    async (page = pagination.pagina) => {
      setLoading(true);
      setError(null);
      try {
        const res = await ordersApi.listOrders({
          pagina: page,
          tamanoPagina: 12,
          estadoPedido: estadoFiltro || undefined,
          fechaInicio: fechaInicio ? `${fechaInicio}T00:00:00` : undefined,
          fechaFin: fechaFin ? `${fechaFin}T23:59:59` : undefined,
          busqueda: busqueda.trim() || undefined,
          ordenarPor,
        });
        setOrders(res.items);
        setPagination(res.pagination);
      } catch (err) {
        setError(
          err instanceof HttpError
            ? err.message
            : 'No fue posible consultar el listado operativo de pedidos.'
        );
      } finally {
        setLoading(false);
      }
    },
    [pagination.pagina, estadoFiltro, fechaInicio, fechaFin, busqueda, ordenarPor]
  );

  useEffect(() => {
    void fetchOrders(1);
  }, [estadoFiltro, ordenarPor, fetchOrders]);

  const handleOpenOrder = async (idPedido: number) => {
    setLoadingDetail(true);
    try {
      const detail = await ordersApi.getOrderDetail(idPedido);
      setSelectedOrder(detail);
      const validNext = ALLOWED_TRANSITIONS[detail.EstadoPedido] ?? [];
      setTargetState(validNext[0] ?? '');
      setStateComment('');
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No se pudo cargar el detalle del pedido.',
        'error'
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStateTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !targetState) return;
    if (targetState === 'Cancelado' && stateComment.trim().length < 5) {
      showToast('Para cancelar un pedido es obligatorio indicar el motivo (>= 5 caracteres).', 'warning');
      return;
    }

    setUpdatingState(true);
    try {
      const updated = await ordersApi.changeOrderState(selectedOrder.IDPedido, {
        estadoNuevo: targetState,
        motivoComentario: stateComment.trim() || `Cambio operativo a ${targetState}`,
      });
      setSelectedOrder(updated);
      const nextAllowed = ALLOWED_TRANSITIONS[updated.EstadoPedido] ?? [];
      setTargetState(nextAllowed[0] ?? '');
      setStateComment('');
      showToast(
        `Estado del pedido ${updated.NumeroPedido} actualizado a ${updated.EstadoPedido}.`,
        'success'
      );
      await fetchOrders(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError
          ? err.message
          : 'Error al aplicar la transición de estado del pedido.',
        'error'
      );
    } finally {
      setUpdatingState(false);
    }
  };

  const handleOpenReturnModal = () => {
    if (!selectedOrder) return;
    const initialMap: Record<number, number> = {};
    for (const line of selectedOrder.lineas) {
      initialMap[line.IDDetallePedido] = 0;
    }
    setReturnQuantities(initialMap);
    setReturnReason('');
    setReturnModalOpen(true);
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const linesToReturn = Object.entries(returnQuantities)
      .map(([idDetalle, qty]) => ({
        idDetallePedido: Number(idDetalle),
        cantidadADevolver: Number(qty),
      }))
      .filter((item) => item.cantidadADevolver > 0);

    if (linesToReturn.length === 0) {
      showToast('Selecciona al menos 1 unidad a devolver en las líneas del pedido.', 'warning');
      return;
    }

    if (returnReason.trim().length < 5) {
      showToast('El motivo de la devolución debe tener al menos 5 caracteres.', 'warning');
      return;
    }

    setSubmittingReturn(true);
    try {
      const updated = await ordersApi.registerReturn(selectedOrder.IDPedido, {
        motivoDevolucion: returnReason.trim(),
        lineas: linesToReturn,
      });
      setSelectedOrder(updated);
      setReturnModalOpen(false);
      showToast(
        `Devolución procesada exitosamente. Nuevo estado: ${updated.EstadoPedido}. Inventario reintegrado al Kardex.`,
        'success'
      );
      await fetchOrders(pagination.pagina);
    } catch (err) {
      showToast(
        err instanceof HttpError ? err.message : 'No fue posible registrar la devolución.',
        'error'
      );
    } finally {
      setSubmittingReturn(false);
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
          <span className="block text-[11px] text-slate-500">{row.MetodoPago}</span>
        </div>
      ),
    },
    {
      id: 'cliente',
      header: 'Cliente',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.NombreCliente}</span>
          <span className="text-xs text-slate-500">{row.CorreoCliente}</span>
        </div>
      ),
    },
    {
      id: 'fecha',
      header: 'Fecha',
      sortKey: 'fecha',
      render: (row) => (
        <span className="text-xs text-slate-600">{formatDateTimeGT(row.FechaCreacion)}</span>
      ),
    },
    {
      id: 'estado',
      header: 'Estado',
      sortKey: 'estado',
      render: (row) => <StatusBadge status={row.EstadoPedido} />,
    },
    {
      id: 'unidades',
      header: 'Unidades',
      align: 'center',
      render: (row) => (
        <div className="text-xs">
          <span className="font-bold text-slate-900">{row.TotalUnidadesCompradas}</span>
          {row.TotalUnidadesDevueltas > 0 && (
            <span className="block text-amber-700 font-semibold">
              -{row.TotalUnidadesDevueltas} dev.
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'total',
      header: 'Total (GTQ)',
      align: 'right',
      sortKey: 'total',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900">{formatGTQ(row.TotalPagado)}</span>
          {row.MontoReintegradoAcumulado > 0 && (
            <span className="block text-[11px] text-amber-700 font-semibold">
              Neto: {formatGTQ(row.TotalNetoEfectivo)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'acciones',
      header: 'Gestión',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => void handleOpenOrder(row.IDPedido)}
          disabled={loadingDetail}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          Gestionar
        </button>
      ),
    },
  ];

  const validTransitions = selectedOrder
    ? ALLOWED_TRANSITIONS[selectedOrder.EstadoPedido] ?? []
    : [];

  const canRegisterReturn =
    selectedOrder &&
    (selectedOrder.EstadoPedido === 'Entregado' ||
      selectedOrder.EstadoPedido === 'DevueltoParcial') &&
    selectedOrder.lineas.some((l) => l.CantidadDisponibleDevolver > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            Gestión Operativa de Pedidos y Devoluciones
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Control de máquina de estados (`Pagado → EnPreparacion → Despachado → Entregado`),
            cancelaciones y devoluciones parciales o totales con reintegro a Kardex (`RF-07`).
          </p>
        </div>
      </div>

      {/* Filtros en servidor */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div className="lg:col-span-2">
          <label htmlFor="ops-orders-search" className="block text-xs font-semibold text-slate-700 mb-1">
            Buscar (N° Pedido, Cliente o Correo)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="ops-orders-search"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchOrders(1);
              }}
              placeholder="Ej. PED-2026 o nombre del cliente..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ops-orders-state" className="block text-xs font-semibold text-slate-700 mb-1">
            Estado del Pedido
          </label>
          <select
            id="ops-orders-state"
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

        <div>
          <label htmlFor="ops-orders-sort" className="block text-xs font-semibold text-slate-700 mb-1">
            Ordenar por
          </label>
          <select
            id="ops-orders-sort"
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none"
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="total_desc">Mayor monto (GTQ)</option>
            <option value="total_asc">Menor monto (GTQ)</option>
            <option value="estado_asc">Estado (A-Z)</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchOrders(1)}
            className="flex-1 py-2 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Aplicar
          </button>
          {(busqueda || estadoFiltro || fechaInicio || fechaFin) && (
            <button
              type="button"
              onClick={() => {
                setBusqueda('');
                setEstadoFiltro('');
                setFechaInicio('');
                setFechaFin('');
                void fetchOrders(1);
              }}
              className="py-2 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <ServerDataTable
        caption="Tabla operativa de pedidos del sistema"
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
        emptyTitle="No se encontraron pedidos con los criterios seleccionados"
        emptyDescription="Prueba ajustando el filtro de estado o el término de búsqueda."
      />

      {/* Modal de Detalle y Transición de Estado */}
      <ModalDialog
        open={Boolean(selectedOrder) && !returnModalOpen}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder
            ? `Gestión del Pedido ${selectedOrder.NumeroPedido} (${selectedOrder.NombreCliente})`
            : 'Gestión de Pedido'
        }
        maxWidthClass="max-w-4xl"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 block">Estado Actual</span>
                <div className="mt-1">
                  <StatusBadge status={selectedOrder.EstadoPedido} />
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Cliente</span>
                <span className="text-xs font-bold text-slate-900 block">
                  {selectedOrder.NombreCliente}
                </span>
                <span className="text-[11px] text-slate-500">{selectedOrder.CorreoCliente}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Total Pagado</span>
                <span className="text-sm font-extrabold text-indigo-700">
                  {formatGTQ(selectedOrder.Total)}
                </span>
                {selectedOrder.CodigoCuponSnapshot && (
                  <span className="block text-[11px] text-emerald-700 font-semibold">
                    Cupón: {selectedOrder.CodigoCuponSnapshot} (-
                    {formatGTQ(selectedOrder.MontoDescuento)})
                  </span>
                )}
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Total Neto Efectivo</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatGTQ(selectedOrder.TotalNetoEfectivo)}
                </span>
                {selectedOrder.MontoReintegradoAcumulado > 0 && (
                  <span className="block text-[11px] text-amber-700">
                    Reintegrado: {formatGTQ(selectedOrder.MontoReintegradoAcumulado)}
                  </span>
                )}
              </div>
            </div>

            {/* Panel de Máquina de Estados o Devolución */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {validTransitions.length > 0 ? (
                <form
                  onSubmit={handleStateTransition}
                  className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3"
                >
                  <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                    <span>Avanzar Estado (`SP_Pedidos_CambiarEstado`)</span>
                  </div>
                  <div>
                    <label
                      htmlFor="ops-next-state"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Nuevo Estado Permitido
                    </label>
                    <select
                      id="ops-next-state"
                      value={targetState}
                      onChange={(e) => setTargetState(e.target.value as OrderState)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                    >
                      {validTransitions.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FormField
                    id="ops-state-comment"
                    label="Comentario / Guía de Despacho o Motivo"
                    value={stateComment}
                    onChange={(e) => setStateComment(e.target.value)}
                    placeholder="Ej. Empacado en bodega central / Guía Cargo Expreso #8821..."
                    required={targetState === 'Cancelado'}
                  />
                  <button
                    type="submit"
                    disabled={updatingState}
                    className="w-full py-2 px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {updatingState
                      ? 'Aplicando transición...'
                      : `Cambiar Estado a ${targetState}`}
                  </button>
                </form>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                  <span className="text-xs font-bold text-slate-700">
                    Máquina de Estados (`RF-07`)
                  </span>
                  <p className="text-xs text-slate-600 mt-1">
                    El pedido se encuentra en estado <strong>{selectedOrder.EstadoPedido}</strong> y
                    no tiene más transiciones ordinarias de despacho pendientes.
                  </p>
                </div>
              )}

              {canRegisterReturn ? (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                      <RotateCcw className="w-4 h-4 text-amber-700" />
                      <span>Devolución Parcial o Total (`SP_Pedidos_RegistrarDevolucion`)</span>
                    </div>
                    <p className="text-xs text-amber-900 mt-1">
                      Este pedido fue entregado y tiene unidades disponibles para devolución con
                      reintegro automático al Kardex (<code>DEVOLUCION_CLIENTE</code>).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenReturnModal}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 cursor-pointer"
                  >
                    Registrar Devolución Parcial o Total
                  </button>
                </div>
              ) : null}
            </div>

            {/* Tabla de líneas del pedido */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Líneas del Pedido (Precios Congelados en Snapshot)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                      <th className="py-2 px-3">SKU / Producto</th>
                      <th className="py-2 px-3 text-center">Compradas</th>
                      <th className="py-2 px-3 text-center">Devueltas</th>
                      <th className="py-2 px-3 text-center">Disp. Devolver</th>
                      <th className="py-2 px-3 text-right">Precio Congelado</th>
                      <th className="py-2 px-3 text-right">Total Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedOrder.lineas.map((line) => (
                      <tr key={line.IDDetallePedido}>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block">
                            {line.NombreProductoSnapshot}
                          </span>
                          <span className="font-mono text-slate-500">{line.SKUSnapshot}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold">
                          {line.CantidadComprada}
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-700 font-bold">
                          {line.CantidadDevuelta}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-emerald-700">
                          {line.CantidadDisponibleDevolver}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {formatGTQ(line.PrecioUnitarioCongelado)}
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

            {/* Historial de Estados */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Bitácora de Transiciones de Estado
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedOrder.historialEstados.map((h) => (
                  <div
                    key={h.IDHistorialEstadoPedido}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      {h.EstadoAnterior && (
                        <>
                          <StatusBadge status={h.EstadoAnterior} />
                          <span>→</span>
                        </>
                      )}
                      <StatusBadge status={h.EstadoNuevo} />
                      <span className="text-slate-700">{h.MotivoComentario}</span>
                    </div>
                    <span className="text-slate-500">
                      {h.NombreUsuario} ({h.RolUsuario}) • {formatDateTimeGT(h.FechaCambio)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Modal para Registrar Devolución Parcial o Total */}
      <ModalDialog
        open={returnModalOpen && Boolean(selectedOrder)}
        onClose={() => setReturnModalOpen(false)}
        title={
          selectedOrder
            ? `Registrar Devolución — Pedido ${selectedOrder.NumeroPedido}`
            : 'Registrar Devolución'
        }
        maxWidthClass="max-w-3xl"
      >
        {selectedOrder && (
          <form onSubmit={handleProcessReturn} className="space-y-5">
            <p className="text-xs text-slate-600">
              Selecciona las cantidades a devolver por cada línea. El procedimiento almacenado{' '}
              <code>SP_Pedidos_RegistrarDevolucion</code> calculará el reintegro proporcional,
              incrementará la existencia física en Kardex y cambiará el estado a{' '}
              <strong>DevueltoParcial</strong> o <strong>DevueltoTotal</strong>.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <th className="py-2.5 px-3">Producto / SKU</th>
                    <th className="py-2.5 px-3 text-center">Disp. Devolver</th>
                    <th className="py-2.5 px-3 text-right">Precio Neto Unit.</th>
                    <th className="py-2.5 px-3 text-center">Cantidad a Devolver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedOrder.lineas.map((line) => {
                    const unitNet = line.TotalLineaNeto / line.CantidadComprada;
                    const currentQty = returnQuantities[line.IDDetallePedido] ?? 0;
                    return (
                      <tr key={line.IDDetallePedido}>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block">
                            {line.NombreProductoSnapshot}
                          </span>
                          <span className="font-mono text-slate-500">{line.SKUSnapshot}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {line.CantidadDisponibleDevolver}
                        </td>
                        <td className="py-2.5 px-3 text-right">{formatGTQ(unitNet)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={line.CantidadDisponibleDevolver}
                            disabled={line.CantidadDisponibleDevolver === 0}
                            value={currentQty}
                            onChange={(e) => {
                              const val = Math.max(
                                0,
                                Math.min(
                                  line.CantidadDisponibleDevolver,
                                  Number(e.target.value) || 0
                                )
                              );
                              setReturnQuantities((prev) => ({
                                ...prev,
                                [line.IDDetallePedido]: val,
                              }));
                            }}
                            aria-label={`Cantidad a devolver de ${line.NombreProductoSnapshot}`}
                            className="w-20 text-center rounded-lg border border-slate-300 px-2 py-1 text-sm font-bold"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <FormField
              id="return-reason-input"
              label="Motivo de la Devolución"
              hint="Mínimo 5 caracteres. Quedará registrado en Devoluciones, Kardex y Bitácora."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              required
              minLength={5}
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Volver al Detalle
              </button>
              <button
                type="submit"
                disabled={submittingReturn}
                className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                {submittingReturn ? 'Procesando devolución...' : 'Confirmar Devolución y Reintegro'}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
};
