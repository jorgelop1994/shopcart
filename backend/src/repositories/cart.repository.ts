import { executeStoredProcedure, sql } from '../config/database';

export interface DbCartSummaryRecord {
  IDCarrito: number;
  IDUsuario: number | null;
  TokenInvitado: string | null;
  EstadoCarrito: string;
  FechaCreacion: Date;
  FechaUltimaActividad: Date;
  CantidadItemsDistintos: number;
  CantidadTotalUnidades: number;
  Subtotal: number;
  IDCupon: number | null;
  CodigoCupon: string | null;
  CuponEsValido: boolean;
  MensajeCupon: string | null;
  MontoDescuento: number;
  PorcentajeIVA: number;
  SubtotalSinIVA: number;
  MontoIVAIncluido: number;
  Total: number;
  ItemsJSON: string | null;
}

export class CartRepository {
  async obtenerDetalle(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
    idCarrito?: number | null;
  }): Promise<DbCartSummaryRecord> {
    const result = await executeStoredProcedure<DbCartSummaryRecord>(
      'SP_Carrito_ObtenerDetalle',
      [
        { name: 'IDUsuario', type: sql.Int, value: data.idUsuario ?? null },
        { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado ?? null },
        { name: 'IDCarrito', type: sql.Int, value: data.idCarrito ?? null },
      ]
    );
    return result.recordset[0];
  }

  async agregarOModificarItem(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
    idVariante: number;
    cantidad: number;
    esIncremento: boolean;
  }): Promise<DbCartSummaryRecord> {
    const result = await executeStoredProcedure<DbCartSummaryRecord>(
      'SP_Carrito_AgregarOModificarItem',
      [
        { name: 'IDUsuario', type: sql.Int, value: data.idUsuario ?? null },
        { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado ?? null },
        { name: 'IDVariante', type: sql.Int, value: data.idVariante },
        { name: 'Cantidad', type: sql.Int, value: data.cantidad },
        { name: 'EsIncremento', type: sql.Bit, value: data.esIncremento ? 1 : 0 },
      ]
    );
    return result.recordset[0];
  }

  async eliminarItem(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
    idVariante: number;
  }): Promise<DbCartSummaryRecord> {
    const result = await executeStoredProcedure<DbCartSummaryRecord>('SP_Carrito_EliminarItem', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario ?? null },
      { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado ?? null },
      { name: 'IDVariante', type: sql.Int, value: data.idVariante },
    ]);
    return result.recordset[0];
  }

  async vaciarCarrito(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
  }): Promise<DbCartSummaryRecord> {
    const result = await executeStoredProcedure<DbCartSummaryRecord>('SP_Carrito_Vaciar', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario ?? null },
      { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado ?? null },
    ]);
    return result.recordset[0];
  }

  async fusionarCarritoInvitado(data: {
    idUsuario: number;
    tokenInvitado: string;
  }): Promise<DbCartSummaryRecord> {
    const result = await executeStoredProcedure<DbCartSummaryRecord>(
      'SP_Carrito_FusionarInvitado',
      [
        { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
        { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado },
      ]
    );
    return result.recordset[0];
  }

  async aplicarCupon(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
    codigoCupon: string;
  }): Promise<DbCartSummaryRecord> {
    const result = await executeStoredProcedure<DbCartSummaryRecord>('SP_Carrito_AplicarCupon', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario ?? null },
      { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado ?? null },
      { name: 'CodigoCupon', type: sql.NVarChar(40), value: data.codigoCupon },
    ]);
    return result.recordset[0];
  }

  async removerCupon(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
  }): Promise<DbCartSummaryRecord> {
    const result = await executeStoredProcedure<DbCartSummaryRecord>('SP_Carrito_RemoverCupon', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario ?? null },
      { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado ?? null },
    ]);
    return result.recordset[0];
  }

  async listarCupones(filters: {
    pagina: number;
    tamanoPagina: number;
    activo?: boolean;
    busqueda?: string;
    ordenarPor?: string;
  }) {
    const result = await executeStoredProcedure<Record<string, unknown> & { TotalRegistros?: number }>(
      'SP_Cupones_Listar',
      [
        { name: 'Pagina', type: sql.Int, value: filters.pagina },
        { name: 'TamanoPagina', type: sql.Int, value: filters.tamanoPagina },
        {
          name: 'Activo',
          type: sql.Bit,
          value: typeof filters.activo === 'boolean' ? (filters.activo ? 1 : 0) : null,
        },
        { name: 'Busqueda', type: sql.NVarChar(80), value: filters.busqueda ?? null },
        { name: 'OrdenarPor', type: sql.NVarChar(30), value: filters.ordenarPor ?? 'recientes' },
      ]
    );
    return result.recordset;
  }

  async obtenerCuponPorId(idCupon: number) {
    const result = await executeStoredProcedure('SP_Cupones_ObtenerPorID', [
      { name: 'IDCupon', type: sql.Int, value: idCupon },
    ]);
    return result.recordset[0];
  }

  async guardarCupon(data: {
    idUsuario: number;
    idCupon?: number | null;
    codigo: string;
    descripcion: string;
    tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO';
    valorDescuento: number;
    idCategoria?: number | null;
    montoMinimoCompra: number;
    limiteUsoTotal: number;
    limiteUsoPorCliente: number;
    fechaInicio: Date;
    fechaFin: Date;
    activo: boolean;
  }) {
    const result = await executeStoredProcedure('SP_Cupones_Guardar', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'IDCupon', type: sql.Int, value: data.idCupon ?? null },
      { name: 'Codigo', type: sql.NVarChar(40), value: data.codigo },
      { name: 'Descripcion', type: sql.NVarChar(200), value: data.descripcion },
      { name: 'TipoDescuento', type: sql.NVarChar(20), value: data.tipoDescuento },
      { name: 'ValorDescuento', type: sql.Decimal(12, 2), value: data.valorDescuento },
      { name: 'IDCategoria', type: sql.Int, value: data.idCategoria ?? null },
      { name: 'MontoMinimoCompra', type: sql.Decimal(12, 2), value: data.montoMinimoCompra },
      { name: 'LimiteUsoTotal', type: sql.Int, value: data.limiteUsoTotal },
      { name: 'LimiteUsoPorCliente', type: sql.Int, value: data.limiteUsoPorCliente },
      { name: 'FechaInicio', type: sql.DateTime2(3), value: data.fechaInicio },
      { name: 'FechaFin', type: sql.DateTime2(3), value: data.fechaFin },
      { name: 'Activo', type: sql.Bit, value: data.activo ? 1 : 0 },
    ]);
    return result.recordset[0];
  }
}

export const cartRepository = new CartRepository();
