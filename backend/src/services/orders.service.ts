import {
  ordersRepository,
  DbOrderDetailRecord,
  DbDashboardMetricsRecord,
} from '../repositories/orders.repository';
import { UserRole } from '../middlewares/authMiddleware';
import { AppError } from '../utils/AppError';
import { assertTransitionAllowed } from '../utils/orderStateMachine';
import {
  getCachedReport,
  setCachedReport,
  invalidateDashboardCache,
} from '../utils/dashboardEvents';

function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatOrderDetail(row: DbOrderDetailRecord) {
  const {
    LineasJSON,
    HistorialEstadosJSON,
    DevolucionesJSON,
    DireccionEntregaSnapshot,
    ...header
  } = row;

  return {
    ...header,
    direccionEntrega: parseJsonSafe(DireccionEntregaSnapshot, null),
    lineas: parseJsonSafe(LineasJSON, []),
    historialEstados: parseJsonSafe(HistorialEstadosJSON, []),
    devoluciones: parseJsonSafe(DevolucionesJSON, []),
  };
}

function formatDashboardMetrics(row: DbDashboardMetricsRecord) {
  const {
    VentasPorDiaJSON,
    VentasPorSemanaJSON,
    VentasPorMesJSON,
    VentasPorCategoriaJSON,
    Top10ProductosJSON,
    ...kpis
  } = row;

  return {
    kpis,
    ventasPorDia: parseJsonSafe(VentasPorDiaJSON, []),
    ventasPorSemana: parseJsonSafe(VentasPorSemanaJSON, []),
    ventasPorMes: parseJsonSafe(VentasPorMesJSON, []),
    ventasPorCategoria: parseJsonSafe(VentasPorCategoriaJSON, []),
    top10Productos: parseJsonSafe(Top10ProductosJSON, []),
  };
}

export class OrdersService {
  async reservarExistencia(data: { idCarrito: number; idUsuario: number }) {
    const row = await ordersRepository.reservarExistencia(data);
    const { DetalleReservaJSON, ...rest } = row;
    return {
      ...rest,
      detalleReserva: parseJsonSafe(DetalleReservaJSON, []),
    };
  }

  async crearPedido(data: {
    idUsuario: number;
    idCarrito: number;
    idDireccionEntrega: number;
    tokenReserva: string;
    claveIdempotencia: string;
    metodoPago: string;
    referenciaPago?: string | null;
    simularFalloPago?: boolean;
  }) {
    // Decisión Abierta DA-06: Simulación determinista de rechazo de pasarela de pago
    if (data.simularFalloPago) {
      throw new AppError(
        402,
        'El pago fue rechazado por el procesador. Su reserva de inventario permanece activa por los minutos restantes para que intente nuevamente.',
        'PAYMENT_DECLINED'
      );
    }

    const row = await ordersRepository.crearPedido({
      idUsuario: data.idUsuario,
      idCarrito: data.idCarrito,
      idDireccionEntrega: data.idDireccionEntrega,
      tokenReserva: data.tokenReserva,
      claveIdempotencia: data.claveIdempotencia,
      metodoPago: data.metodoPago,
      referenciaPago: data.referenciaPago ?? null,
    });

    const formatted = formatOrderDetail(row);
    invalidateDashboardCache('ORDER_CREATED', {
      idPedido: formatted.IDPedido,
      numeroPedido: formatted.NumeroPedido,
      total: formatted.Total,
    });

    return formatted;
  }

  async listarPedidos(filters: {
    idUsuarioEjecutor: number;
    rolEjecutor: UserRole;
    pagina: number;
    tamanoPagina: number;
    estadoPedido?: string;
    idUsuarioFiltro?: number;
    fechaInicio?: Date;
    fechaFin?: Date;
    busqueda?: string;
    ordenarPor?: string;
  }) {
    const rows = await ordersRepository.listarPedidos(filters);
    const totalRegistros = Number(rows[0]?.TotalRegistros ?? 0);
    return {
      items: rows.map(({ TotalRegistros, DireccionEntregaSnapshot, ...rest }) => ({
        ...rest,
        direccionEntrega: parseJsonSafe(DireccionEntregaSnapshot as string | null, null),
      })),
      pagination: {
        pagina: filters.pagina,
        tamanoPagina: filters.tamanoPagina,
        totalRegistros,
        totalPaginas: Math.ceil(totalRegistros / filters.tamanoPagina) || 1,
      },
    };
  }

  async obtenerDetallePedido(data: {
    idPedido: number;
    idUsuarioEjecutor: number;
    rolEjecutor: UserRole;
  }) {
    const row = await ordersRepository.obtenerDetallePedido(data);
    return formatOrderDetail(row);
  }

  async cambiarEstadoPedido(data: {
    idPedido: number;
    idUsuarioEjecutor: number;
    rolEjecutor: UserRole;
    estadoNuevo: string;
    motivoComentario?: string | null;
  }) {
    // 1. Validación en backend (RF-07). obtenerDetallePedido ya aplica la regla
    //    anti-IDOR: un Cliente solo puede leer sus propios pedidos.
    const actual = await ordersRepository.obtenerDetallePedido({
      idPedido: data.idPedido,
      idUsuarioEjecutor: data.idUsuarioEjecutor,
      rolEjecutor: data.rolEjecutor,
    });
    assertTransitionAllowed(actual.EstadoPedido, data.estadoNuevo, data.rolEjecutor);

    // 2. Validación definitiva en BD bajo bloqueo (SP_Pedidos_CambiarEstado)
    const row = await ordersRepository.cambiarEstadoPedido(data);
    const formatted = formatOrderDetail(row);

    invalidateDashboardCache('ORDER_STATE_CHANGED', {
      idPedido: formatted.IDPedido,
      numeroPedido: formatted.NumeroPedido,
      estadoNuevo: formatted.EstadoPedido,
    });

    return formatted;
  }

  async registrarDevolucion(data: {
    idPedido: number;
    idUsuarioEjecutor: number;
    motivoDevolucion: string;
    lineas: Array<{ idDetallePedido: number; cantidadADevolver: number }>;
  }) {
    const row = await ordersRepository.registrarDevolucion({
      idPedido: data.idPedido,
      idUsuarioEjecutor: data.idUsuarioEjecutor,
      motivoDevolucion: data.motivoDevolucion,
      lineasDevolucionJSON: JSON.stringify(data.lineas),
    });

    const formatted = formatOrderDetail(row);
    invalidateDashboardCache('ORDER_RETURN_REGISTERED', {
      idPedido: formatted.IDPedido,
      numeroPedido: formatted.NumeroPedido,
      estadoNuevo: formatted.EstadoPedido,
    });

    return formatted;
  }

  async obtenerMetricasDashboard(filters: { fechaInicio?: Date; fechaFin?: Date }) {
    const cacheKey = `dashboard:${filters.fechaInicio?.toISOString() ?? 'default'}:${filters.fechaFin?.toISOString() ?? 'default'}`;
    const cached = getCachedReport<ReturnType<typeof formatDashboardMetrics>>(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    const row = await ordersRepository.obtenerMetricasDashboard(filters);
    const formatted = formatDashboardMetrics(row);
    setCachedReport(cacheKey, formatted);
    return { ...formatted, fromCache: false };
  }

  async exportarReporteDashboardCSV(filters: {
    fechaInicio?: Date;
    fechaFin?: Date;
  }): Promise<string> {
    const metrics = await this.obtenerMetricasDashboard(filters);
    const lines: string[] = [];

    // BOM UTF-8 para que Microsoft Excel abra tildes y Quetzales perfectamente
    lines.push('REPORTE EJECUTIVO DE VENTAS - SHOPCART (MONEDA: QUETZALES GTQ, IVA 12% INCLUIDO)');
    lines.push(
      `Periodo Inicio,${new Date(metrics.kpis.FechaInicioPeriodo).toISOString()},Periodo Fin,${new Date(metrics.kpis.FechaFinPeriodo).toISOString()}`
    );
    lines.push('');
    lines.push('INDICADOR CLAVE,VALOR');
    lines.push(`Pedidos Completados,${metrics.kpis.TotalPedidosCompletados}`);
    lines.push(`Pedidos Cancelados (Excluidos),${metrics.kpis.TotalPedidosCancelados}`);
    lines.push(`Ventas Brutas (GTQ),Q${Number(metrics.kpis.VentasBrutasGTQ).toFixed(2)}`);
    lines.push(`Descuentos por Cupones (GTQ),Q${Number(metrics.kpis.DescuentosGTQ).toFixed(2)}`);
    lines.push(`Devoluciones Descontadas (GTQ),Q${Number(metrics.kpis.DevolucionesGTQ).toFixed(2)}`);
    lines.push(`Ventas Netas Efectivas (GTQ),Q${Number(metrics.kpis.VentasNetasGTQ).toFixed(2)}`);
    lines.push(`Ticket Promedio (GTQ),Q${Number(metrics.kpis.TicketPromedioGTQ).toFixed(2)}`);
    lines.push(`Carritos Abandonados Activos,${metrics.kpis.TotalCarritosAbandonados}`);
    lines.push('');

    lines.push('VENTAS POR CATEGORIA');
    lines.push('IDCategoria,Categoria,Pedidos,Unidades Netas,Ventas Brutas GTQ,Descuentos GTQ,Devoluciones GTQ,Ventas Netas GTQ');
    for (const cat of metrics.ventasPorCategoria as Array<Record<string, unknown>>) {
      lines.push(
        `${cat.IDCategoria},"${String(cat.NombreCategoria).replace(/"/g, '""')}",${cat.CantidadPedidos},${cat.UnidadesNetasVendidas},${Number(cat.VentasBrutasGTQ).toFixed(2)},${Number(cat.DescuentosGTQ).toFixed(2)},${Number(cat.DevolucionesGTQ).toFixed(2)},${Number(cat.VentasNetasGTQ).toFixed(2)}`
      );
    }
    lines.push('');

    lines.push('TOP 10 PRODUCTOS MAS VENDIDOS DEL PERIODO');
    lines.push('IDProducto,Producto,Categoria,Pedidos,Unidades Compradas,Unidades Devueltas,Unidades Netas,Monto Neto GTQ');
    for (const prod of metrics.top10Productos as Array<Record<string, unknown>>) {
      lines.push(
        `${prod.IDProducto},"${String(prod.NombreProducto).replace(/"/g, '""')}","${String(prod.NombreCategoria).replace(/"/g, '""')}",${prod.TotalPedidosConProducto},${prod.UnidadesBrutasVendidas},${prod.UnidadesDevueltas},${prod.UnidadesNetasVendidas},${Number(prod.MontoNetoVendidoGTQ).toFixed(2)}`
      );
    }

    return '\uFEFF' + lines.join('\r\n');
  }

  async listarCarritosAbandonados(filters: { pagina: number; tamanoPagina: number }) {
    const rows = await ordersRepository.listarCarritosAbandonados(filters);
    const totalRegistros = Number(rows[0]?.TotalRegistros ?? 0);
    return {
      items: rows.map(({ TotalRegistros, ...rest }) => rest),
      pagination: {
        pagina: filters.pagina,
        tamanoPagina: filters.tamanoPagina,
        totalRegistros,
        totalPaginas: Math.ceil(totalRegistros / filters.tamanoPagina) || 1,
      },
    };
  }

  async listarBitacora(filters: {
    pagina: number;
    tamanoPagina: number;
    modulo?: string;
    accion?: string;
    idUsuario?: number;
    fechaInicio?: Date;
    fechaFin?: Date;
    busqueda?: string;
    ordenarPor?: string;
  }) {
    const rows = await ordersRepository.listarBitacora(filters);
    const totalRegistros = Number(rows[0]?.TotalRegistros ?? 0);
    return {
      items: rows.map(({ TotalRegistros, ...rest }) => rest),
      pagination: {
        pagina: filters.pagina,
        tamanoPagina: filters.tamanoPagina,
        totalRegistros,
        totalPaginas: Math.ceil(totalRegistros / filters.tamanoPagina) || 1,
      },
    };
  }
}

export const ordersService = new OrdersService();
