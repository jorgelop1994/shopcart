import { executeStoredProcedure, sql } from '../config/database';
import { UserRole } from '../middlewares/authMiddleware';

export interface DbReservationRecord {
  TokenReserva: string;
  IDCarrito: number;
  IDUsuario: number;
  FechaInicioReserva: Date;
  FechaExpiracion: Date;
  MinutosVigencia: number;
  DetalleReservaJSON: string | null;
}

export interface DbOrderDetailRecord {
  IDPedido: number;
  NumeroPedido: string;
  IDUsuario: number;
  NombreCliente: string;
  CorreoCliente: string;
  IDDireccionEntrega: number;
  IDCupon: number | null;
  CodigoCuponSnapshot: string | null;
  EstadoPedido: string;
  Subtotal: number;
  MontoDescuento: number;
  PorcentajeIVA: number;
  MontoIVAIncluido: number;
  Total: number;
  MontoReintegradoAcumulado: number;
  TotalNetoEfectivo: number;
  TotalLineas: number;
  TotalUnidadesCompradas: number;
  TotalUnidadesDevueltas: number;
  MetodoPago: string;
  ReferenciaPago: string;
  DireccionEntregaSnapshot: string;
  FechaCreacion: Date;
  FechaModificacion: Date;
  LineasJSON: string | null;
  HistorialEstadosJSON: string | null;
  DevolucionesJSON: string | null;
}

export interface DbDashboardMetricsRecord {
  FechaInicioPeriodo: Date;
  FechaFinPeriodo: Date;
  TotalPedidosCompletados: number;
  TotalPedidosCancelados: number;
  VentasBrutasGTQ: number;
  DescuentosGTQ: number;
  DevolucionesGTQ: number;
  VentasNetasGTQ: number;
  TicketPromedioGTQ: number;
  TotalCarritosAbandonados: number;
  MontoPotencialCarritosAbandonadosGTQ: number;
  VentasPorDiaJSON: string | null;
  VentasPorSemanaJSON: string | null;
  VentasPorMesJSON: string | null;
  VentasPorCategoriaJSON: string | null;
  Top10ProductosJSON: string | null;
}

export class OrdersRepository {
  async reservarExistencia(data: {
    idCarrito: number;
    idUsuario: number;
  }): Promise<DbReservationRecord> {
    const result = await executeStoredProcedure<DbReservationRecord>(
      'SP_Inventario_ReservarExistencia',
      [
        { name: 'IDCarrito', type: sql.Int, value: data.idCarrito },
        { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      ]
    );
    return result.recordset[0];
  }

  async crearPedido(data: {
    idUsuario: number;
    idCarrito: number;
    idDireccionEntrega: number;
    tokenReserva: string;
    claveIdempotencia: string;
    metodoPago: string;
    referenciaPago?: string | null;
  }): Promise<DbOrderDetailRecord> {
    const result = await executeStoredProcedure<DbOrderDetailRecord>('SP_Pedidos_CrearPedido', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'IDCarrito', type: sql.Int, value: data.idCarrito },
      { name: 'IDDireccionEntrega', type: sql.Int, value: data.idDireccionEntrega },
      { name: 'TokenReserva', type: sql.NVarChar(64), value: data.tokenReserva },
      { name: 'ClaveIdempotencia', type: sql.NVarChar(100), value: data.claveIdempotencia },
      { name: 'MetodoPago', type: sql.NVarChar(40), value: data.metodoPago },
      { name: 'ReferenciaPago', type: sql.NVarChar(100), value: data.referenciaPago ?? null },
    ]);
    return result.recordset[0];
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
    const result = await executeStoredProcedure<Record<string, unknown> & { TotalRegistros?: number }>(
      'SP_Pedidos_Listar',
      [
        { name: 'IDUsuarioEjecutor', type: sql.Int, value: filters.idUsuarioEjecutor },
        { name: 'RolEjecutor', type: sql.NVarChar(30), value: filters.rolEjecutor },
        { name: 'Pagina', type: sql.Int, value: filters.pagina },
        { name: 'TamanoPagina', type: sql.Int, value: filters.tamanoPagina },
        { name: 'EstadoPedido', type: sql.NVarChar(30), value: filters.estadoPedido ?? null },
        { name: 'IDUsuarioFiltro', type: sql.Int, value: filters.idUsuarioFiltro ?? null },
        { name: 'FechaInicio', type: sql.DateTime2(3), value: filters.fechaInicio ?? null },
        { name: 'FechaFin', type: sql.DateTime2(3), value: filters.fechaFin ?? null },
        { name: 'Busqueda', type: sql.NVarChar(100), value: filters.busqueda ?? null },
        { name: 'OrdenarPor', type: sql.NVarChar(30), value: filters.ordenarPor ?? 'recientes' },
      ]
    );
    return result.recordset;
  }

  async obtenerDetallePedido(data: {
    idPedido: number;
    idUsuarioEjecutor: number;
    rolEjecutor: UserRole;
  }): Promise<DbOrderDetailRecord> {
    const result = await executeStoredProcedure<DbOrderDetailRecord>(
      'SP_Pedidos_ObtenerDetalle',
      [
        { name: 'IDPedido', type: sql.Int, value: data.idPedido },
        { name: 'IDUsuarioEjecutor', type: sql.Int, value: data.idUsuarioEjecutor },
        { name: 'RolEjecutor', type: sql.NVarChar(30), value: data.rolEjecutor },
      ]
    );
    return result.recordset[0];
  }

  async cambiarEstadoPedido(data: {
    idPedido: number;
    idUsuarioEjecutor: number;
    rolEjecutor: UserRole;
    estadoNuevo: string;
    motivoComentario?: string | null;
  }): Promise<DbOrderDetailRecord> {
    const result = await executeStoredProcedure<DbOrderDetailRecord>('SP_Pedidos_CambiarEstado', [
      { name: 'IDPedido', type: sql.Int, value: data.idPedido },
      { name: 'IDUsuarioEjecutor', type: sql.Int, value: data.idUsuarioEjecutor },
      { name: 'RolEjecutor', type: sql.NVarChar(30), value: data.rolEjecutor },
      { name: 'EstadoNuevo', type: sql.NVarChar(30), value: data.estadoNuevo },
      {
        name: 'MotivoComentario',
        type: sql.NVarChar(300),
        value: data.motivoComentario ?? null,
      },
    ]);
    return result.recordset[0];
  }

  async registrarDevolucion(data: {
    idPedido: number;
    idUsuarioEjecutor: number;
    motivoDevolucion: string;
    lineasDevolucionJSON: string;
  }): Promise<DbOrderDetailRecord> {
    const result = await executeStoredProcedure<DbOrderDetailRecord>(
      'SP_Pedidos_RegistrarDevolucion',
      [
        { name: 'IDPedido', type: sql.Int, value: data.idPedido },
        { name: 'IDUsuarioEjecutor', type: sql.Int, value: data.idUsuarioEjecutor },
        { name: 'MotivoDevolucion', type: sql.NVarChar(300), value: data.motivoDevolucion },
        {
          name: 'LineasDevolucionJSON',
          type: sql.NVarChar(sql.MAX),
          value: data.lineasDevolucionJSON,
        },
      ]
    );
    return result.recordset[0];
  }

  async obtenerMetricasDashboard(filters: {
    fechaInicio?: Date;
    fechaFin?: Date;
  }): Promise<DbDashboardMetricsRecord> {
    const result = await executeStoredProcedure<DbDashboardMetricsRecord>(
      'SP_Dashboard_ObtenerMetricas',
      [
        { name: 'FechaInicio', type: sql.DateTime2(3), value: filters.fechaInicio ?? null },
        { name: 'FechaFin', type: sql.DateTime2(3), value: filters.fechaFin ?? null },
      ]
    );
    return result.recordset[0];
  }

  async listarCarritosAbandonados(filters: { pagina: number; tamanoPagina: number }) {
    const result = await executeStoredProcedure<Record<string, unknown> & { TotalRegistros?: number }>(
      'SP_Dashboard_ListarCarritosAbandonados',
      [
        { name: 'Pagina', type: sql.Int, value: filters.pagina },
        { name: 'TamanoPagina', type: sql.Int, value: filters.tamanoPagina },
      ]
    );
    return result.recordset;
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
    const result = await executeStoredProcedure<Record<string, unknown> & { TotalRegistros?: number }>(
      'SP_Bitacora_Listar',
      [
        { name: 'Pagina', type: sql.Int, value: filters.pagina },
        { name: 'TamanoPagina', type: sql.Int, value: filters.tamanoPagina },
        { name: 'Modulo', type: sql.NVarChar(40), value: filters.modulo ?? null },
        { name: 'Accion', type: sql.NVarChar(40), value: filters.accion ?? null },
        { name: 'IDUsuario', type: sql.Int, value: filters.idUsuario ?? null },
        { name: 'FechaInicio', type: sql.DateTime2(3), value: filters.fechaInicio ?? null },
        { name: 'FechaFin', type: sql.DateTime2(3), value: filters.fechaFin ?? null },
        { name: 'Busqueda', type: sql.NVarChar(100), value: filters.busqueda ?? null },
        { name: 'OrdenarPor', type: sql.NVarChar(30), value: filters.ordenarPor ?? 'recientes' },
      ]
    );
    return result.recordset;
  }
}

export const ordersRepository = new OrdersRepository();
