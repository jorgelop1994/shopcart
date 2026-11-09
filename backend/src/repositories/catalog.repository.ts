import { executeStoredProcedure, sql } from '../config/database';

export class CatalogRepository {
  async listarCategorias(soloActivas: boolean) {
    const result = await executeStoredProcedure('SP_Catalogo_ListarCategorias', [
      { name: 'SoloActivas', type: sql.Bit, value: soloActivas ? 1 : 0 },
    ]);
    return result.recordset;
  }

  async crearCategoria(data: { idUsuario: number; nombre: string; descripcion?: string | null }) {
    const result = await executeStoredProcedure('SP_Catalogo_CrearCategoria', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'Nombre', type: sql.NVarChar(100), value: data.nombre },
      { name: 'Descripcion', type: sql.NVarChar(300), value: data.descripcion ?? null },
    ]);
    return result.recordset[0];
  }

  async actualizarCategoria(data: {
    idUsuario: number;
    idCategoria: number;
    nombre: string;
    descripcion?: string | null;
    activa: boolean;
  }) {
    const result = await executeStoredProcedure('SP_Catalogo_ActualizarCategoria', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'IDCategoria', type: sql.Int, value: data.idCategoria },
      { name: 'Nombre', type: sql.NVarChar(100), value: data.nombre },
      { name: 'Descripcion', type: sql.NVarChar(300), value: data.descripcion ?? null },
      { name: 'Activa', type: sql.Bit, value: data.activa ? 1 : 0 },
    ]);
    return result.recordset[0];
  }

  async listarAtributos() {
    const result = await executeStoredProcedure<{
      IDAtributo: number;
      NombreAtributo: string;
      Activo: boolean;
      ValoresJSON: string | null;
    }>('SP_Catalogo_ListarAtributos');
    return result.recordset;
  }

  async guardarAtributoYValor(nombreAtributo: string, valor: string) {
    const result = await executeStoredProcedure('SP_Catalogo_GuardarAtributoYValor', [
      { name: 'NombreAtributo', type: sql.NVarChar(60), value: nombreAtributo },
      { name: 'Valor', type: sql.NVarChar(80), value: valor },
    ]);
    return result.recordset[0];
  }

  async listarProductos(filters: {
    pagina: number;
    tamanoPagina: number;
    busqueda?: string;
    idCategoria?: number;
    precioMin?: number;
    precioMax?: number;
    soloDisponibles?: boolean;
    soloActivos?: boolean;
    ordenarPor?: string;
  }) {
    const result = await executeStoredProcedure<Record<string, unknown> & { TotalRegistros?: number }>(
      'SP_Catalogo_ListarProductos',
      [
        { name: 'Pagina', type: sql.Int, value: filters.pagina },
        { name: 'TamanoPagina', type: sql.Int, value: filters.tamanoPagina },
        { name: 'Busqueda', type: sql.NVarChar(150), value: filters.busqueda ?? null },
        { name: 'IDCategoria', type: sql.Int, value: filters.idCategoria ?? null },
        {
          name: 'PrecioMin',
          type: sql.Decimal(12, 2),
          value: filters.precioMin !== undefined ? filters.precioMin : null,
        },
        {
          name: 'PrecioMax',
          type: sql.Decimal(12, 2),
          value: filters.precioMax !== undefined ? filters.precioMax : null,
        },
        { name: 'SoloDisponibles', type: sql.Bit, value: filters.soloDisponibles ? 1 : 0 },
        { name: 'SoloActivos', type: sql.Bit, value: filters.soloActivos !== false ? 1 : 0 },
        { name: 'OrdenarPor', type: sql.NVarChar(30), value: filters.ordenarPor ?? 'recientes' },
      ]
    );
    return result.recordset;
  }

  async obtenerProductoDetalle(idProducto: number, soloActivos: boolean) {
    const result = await executeStoredProcedure<{
      IDProducto: number;
      IDCategoria: number;
      NombreCategoria: string;
      Nombre: string;
      Descripcion: string | null;
      Marca: string | null;
      Activo: boolean;
      FechaCreacion: Date;
      FechaModificacion: Date;
      ImagenesJSON: string | null;
      VariantesJSON: string | null;
    }>('SP_Catalogo_ObtenerProductoDetalle', [
      { name: 'IDProducto', type: sql.Int, value: idProducto },
      { name: 'SoloActivos', type: sql.Bit, value: soloActivos ? 1 : 0 },
    ]);
    return result.recordset[0];
  }

  async crearProducto(data: {
    idUsuario: number;
    idCategoria: number;
    nombre: string;
    descripcion?: string | null;
    marca?: string | null;
    imagenesJSON?: string | null;
  }) {
    const result = await executeStoredProcedure<{
      IDProducto: number;
      IDCategoria: number;
      NombreCategoria: string;
      Nombre: string;
      Descripcion: string | null;
      Marca: string | null;
      Activo: boolean;
      FechaCreacion: Date;
      FechaModificacion: Date;
      ImagenesJSON: string | null;
      VariantesJSON: string | null;
    }>('SP_Catalogo_CrearProducto', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'IDCategoria', type: sql.Int, value: data.idCategoria },
      { name: 'Nombre', type: sql.NVarChar(150), value: data.nombre },
      { name: 'Descripcion', type: sql.NVarChar(sql.MAX), value: data.descripcion ?? null },
      { name: 'Marca', type: sql.NVarChar(80), value: data.marca ?? null },
      { name: 'ImagenesJSON', type: sql.NVarChar(sql.MAX), value: data.imagenesJSON ?? null },
    ]);
    return result.recordset[0];
  }

  async actualizarProducto(data: {
    idUsuario: number;
    idProducto: number;
    idCategoria: number;
    nombre: string;
    descripcion?: string | null;
    marca?: string | null;
    activo: boolean;
    imagenesJSON?: string | null;
  }) {
    const result = await executeStoredProcedure<{
      IDProducto: number;
      IDCategoria: number;
      NombreCategoria: string;
      Nombre: string;
      Descripcion: string | null;
      Marca: string | null;
      Activo: boolean;
      FechaCreacion: Date;
      FechaModificacion: Date;
      ImagenesJSON: string | null;
      VariantesJSON: string | null;
    }>('SP_Catalogo_ActualizarProducto', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'IDProducto', type: sql.Int, value: data.idProducto },
      { name: 'IDCategoria', type: sql.Int, value: data.idCategoria },
      { name: 'Nombre', type: sql.NVarChar(150), value: data.nombre },
      { name: 'Descripcion', type: sql.NVarChar(sql.MAX), value: data.descripcion ?? null },
      { name: 'Marca', type: sql.NVarChar(80), value: data.marca ?? null },
      { name: 'Activo', type: sql.Bit, value: data.activo ? 1 : 0 },
      { name: 'ImagenesJSON', type: sql.NVarChar(sql.MAX), value: data.imagenesJSON ?? null },
    ]);
    return result.recordset[0];
  }

  async eliminarODesactivarProducto(idUsuario: number, idProducto: number) {
    const result = await executeStoredProcedure('SP_Catalogo_EliminarODesactivarProducto', [
      { name: 'IDUsuario', type: sql.Int, value: idUsuario },
      { name: 'IDProducto', type: sql.Int, value: idProducto },
    ]);
    return result.recordset[0];
  }

  async guardarVariante(data: {
    idUsuario: number;
    idProducto: number;
    idVariante?: number | null;
    sku: string;
    nombreVariante: string;
    precio: number;
    activa: boolean;
    existenciaInicial?: number;
    atributosJSON?: string | null;
  }) {
    const result = await executeStoredProcedure('SP_Catalogo_GuardarVariante', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'IDProducto', type: sql.Int, value: data.idProducto },
      { name: 'IDVariante', type: sql.Int, value: data.idVariante ?? null },
      { name: 'SKU', type: sql.NVarChar(60), value: data.sku },
      { name: 'NombreVariante', type: sql.NVarChar(150), value: data.nombreVariante },
      { name: 'Precio', type: sql.Decimal(12, 2), value: data.precio },
      { name: 'Activa', type: sql.Bit, value: data.activa ? 1 : 0 },
      { name: 'ExistenciaInicial', type: sql.Int, value: data.existenciaInicial ?? 0 },
      { name: 'AtributosJSON', type: sql.NVarChar(sql.MAX), value: data.atributosJSON ?? null },
    ]);
    return result.recordset[0];
  }

  async registrarMovimientoInventario(data: {
    idUsuario: number;
    idVariante: number;
    tipoMovimiento: 'ENTRADA_COMPRA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA';
    cantidad: number;
    motivo: string;
  }) {
    const result = await executeStoredProcedure('SP_Inventario_RegistrarMovimiento', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'IDVariante', type: sql.Int, value: data.idVariante },
      { name: 'TipoMovimiento', type: sql.NVarChar(30), value: data.tipoMovimiento },
      { name: 'Cantidad', type: sql.Int, value: data.cantidad },
      { name: 'Motivo', type: sql.NVarChar(300), value: data.motivo },
    ]);
    return result.recordset[0];
  }

  async consultarKardex(filters: {
    pagina: number;
    tamanoPagina: number;
    idVariante?: number;
    idProducto?: number;
    tipoMovimiento?: string;
    fechaInicio?: Date;
    fechaFin?: Date;
    busqueda?: string;
    ordenarPor?: string;
  }) {
    const result = await executeStoredProcedure<Record<string, unknown> & { TotalRegistros?: number }>(
      'SP_Inventario_ConsultarKardex',
      [
        { name: 'Pagina', type: sql.Int, value: filters.pagina },
        { name: 'TamanoPagina', type: sql.Int, value: filters.tamanoPagina },
        { name: 'IDVariante', type: sql.Int, value: filters.idVariante ?? null },
        { name: 'IDProducto', type: sql.Int, value: filters.idProducto ?? null },
        { name: 'TipoMovimiento', type: sql.NVarChar(30), value: filters.tipoMovimiento ?? null },
        { name: 'FechaInicio', type: sql.DateTime2(3), value: filters.fechaInicio ?? null },
        { name: 'FechaFin', type: sql.DateTime2(3), value: filters.fechaFin ?? null },
        { name: 'Busqueda', type: sql.NVarChar(100), value: filters.busqueda ?? null },
        { name: 'OrdenarPor', type: sql.NVarChar(30), value: filters.ordenarPor ?? 'recientes' },
      ]
    );
    return result.recordset;
  }

  async obtenerExistencias(filters: {
    pagina: number;
    tamanoPagina: number;
    idCategoria?: number;
    idProducto?: number;
    soloBajoStock?: boolean;
    busqueda?: string;
    ordenarPor?: string;
  }) {
    const result = await executeStoredProcedure<Record<string, unknown> & { TotalRegistros?: number }>(
      'SP_Inventario_ObtenerExistencias',
      [
        { name: 'Pagina', type: sql.Int, value: filters.pagina },
        { name: 'TamanoPagina', type: sql.Int, value: filters.tamanoPagina },
        { name: 'IDCategoria', type: sql.Int, value: filters.idCategoria ?? null },
        { name: 'IDProducto', type: sql.Int, value: filters.idProducto ?? null },
        { name: 'SoloBajoStock', type: sql.Bit, value: filters.soloBajoStock ? 1 : 0 },
        { name: 'Busqueda', type: sql.NVarChar(100), value: filters.busqueda ?? null },
        { name: 'OrdenarPor', type: sql.NVarChar(30), value: filters.ordenarPor ?? 'disponible_asc' },
      ]
    );
    return result.recordset;
  }

  async liberarReservasVencidas(): Promise<number> {
    const result = await executeStoredProcedure<{ ReservasExpiradasLiberadas: number }>(
      'SP_Inventario_LiberarReservasVencidas'
    );
    return result.recordset[0]?.ReservasExpiradasLiberadas ?? 0;
  }
}

export const catalogRepository = new CatalogRepository();
