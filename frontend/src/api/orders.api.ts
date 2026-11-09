import { apiRequest, buildApiUrl, getStoredSession } from './httpClient';
import {
  AbandonedCartRecord,
  AuditLogRecord,
  CheckoutReservationResponse,
  DashboardMetricsResponse,
  OrderDetailRecord,
  OrderState,
  OrderSummaryRecord,
  PaginatedResult,
} from '../types/api.types';

export const ordersApi = {
  // --- Checkout y Reserva (RF-06) ---
  async reserveStock(idCarrito?: number): Promise<CheckoutReservationResponse> {
    return apiRequest<CheckoutReservationResponse>('/checkout/reserve', {
      method: 'POST',
      body: idCarrito ? { idCarrito } : {},
    });
  },

  async confirmCheckout(data: {
    idCarrito?: number;
    idDireccionEntrega: number;
    tokenReserva: string;
    claveIdempotencia: string;
    metodoPago: string;
    referenciaPago?: string;
    simularFalloPago?: boolean;
  }): Promise<OrderDetailRecord> {
    return apiRequest<OrderDetailRecord>('/checkout/confirm', {
      method: 'POST',
      headers: {
        'Idempotency-Key': data.claveIdempotencia,
      },
      body: data,
    });
  },

  // --- Pedidos y Devoluciones (RF-07) ---
  async listOrders(params: {
    pagina?: number;
    tamanoPagina?: number;
    estadoPedido?: string;
    idUsuario?: number;
    fechaInicio?: string;
    fechaFin?: string;
    busqueda?: string;
    ordenarPor?: string;
  }): Promise<PaginatedResult<OrderSummaryRecord>> {
    return apiRequest<PaginatedResult<OrderSummaryRecord>>('/orders', { query: params });
  },

  async getOrderDetail(idPedido: number): Promise<OrderDetailRecord> {
    return apiRequest<OrderDetailRecord>(`/orders/${idPedido}`);
  },

  async changeOrderState(
    idPedido: number,
    data: { estadoNuevo: OrderState; motivoComentario?: string }
  ): Promise<OrderDetailRecord> {
    return apiRequest<OrderDetailRecord>(`/orders/${idPedido}/state`, {
      method: 'PATCH',
      body: data,
    });
  },

  async registerReturn(
    idPedido: number,
    data: {
      motivoDevolucion: string;
      lineas: Array<{ idDetallePedido: number; cantidadADevolver: number }>;
    }
  ): Promise<OrderDetailRecord> {
    return apiRequest<OrderDetailRecord>(`/orders/${idPedido}/returns`, {
      method: 'POST',
      body: data,
    });
  },

  // --- Dashboard y Reportes (RF-08) ---
  async getDashboardMetrics(params?: {
    fechaInicio?: string;
    fechaFin?: string;
  }): Promise<DashboardMetricsResponse> {
    return apiRequest<DashboardMetricsResponse>('/dashboard/metrics', { query: params });
  },

  getDashboardStreamUrl(): string {
    const session = getStoredSession();
    return buildApiUrl('/dashboard/stream', {
      token: session?.accessToken ?? '',
    });
  },

  async downloadDashboardCsv(params?: {
    fechaInicio?: string;
    fechaFin?: string;
  }): Promise<void> {
    const session = getStoredSession();
    const url = buildApiUrl('/dashboard/export', params);
    const response = await fetch(url, {
      headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
    });
    if (!response.ok) {
      throw new Error('No fue posible exportar el reporte CSV.');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `reporte-ventas-shopcart-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },

  async listAbandonedCarts(params: {
    pagina?: number;
    tamanoPagina?: number;
  }): Promise<PaginatedResult<AbandonedCartRecord>> {
    return apiRequest<PaginatedResult<AbandonedCartRecord>>('/dashboard/abandoned-carts', {
      query: params,
    });
  },

  // --- Bitácora Inmutable (RF-09) ---
  async listAuditLogs(params: {
    pagina?: number;
    tamanoPagina?: number;
    modulo?: string;
    accion?: string;
    idUsuario?: number;
    fechaInicio?: string;
    fechaFin?: string;
    busqueda?: string;
    ordenarPor?: string;
  }): Promise<PaginatedResult<AuditLogRecord>> {
    return apiRequest<PaginatedResult<AuditLogRecord>>('/audit-logs', { query: params });
  },
};
