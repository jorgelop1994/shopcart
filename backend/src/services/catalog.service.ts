import { catalogRepository } from '../repositories/catalog.repository';

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class CatalogService {
  async listarCategorias(soloActivas: boolean) {
    return catalogRepository.listarCategorias(soloActivas);
  }

  async crearCategoria(data: { idUsuario: number; nombre: string; descripcion?: string | null }) {
    return catalogRepository.crearCategoria(data);
  }

  async actualizarCategoria(data: {
    idUsuario: number;
    idCategoria: number;
    nombre: string;
    descripcion?: string | null;
    activa: boolean;
  }) {
    return catalogRepository.actualizarCategoria(data);
  }

  async listarAtributos() {
    const rows = await catalogRepository.listarAtributos();
    return rows.map((row) => ({
      idAtributo: row.IDAtributo,
      nombreAtributo: row.NombreAtributo,
      activo: row.Activo,
      valores: safeParseJson<Array<{ IDValorAtributo: number; Valor: string }>>(
        row.ValoresJSON,
        []
      ),
    }));
  }

  async guardarAtributoYValor(nombreAtributo: string, valor: string) {
    return catalogRepository.guardarAtributoYValor(nombreAtributo, valor);
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
    const rows = await catalogRepository.listarProductos(filters);
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

  async obtenerProductoDetalle(idProducto: number, soloActivos: boolean) {
    const row = await catalogRepository.obtenerProductoDetalle(idProducto, soloActivos);
    const { ImagenesJSON, VariantesJSON, ...rest } = row;
    return {
      ...rest,
      imagenes: safeParseJson(ImagenesJSON, []),
      variantes: safeParseJson(VariantesJSON, []),
    };
  }

  async crearProducto(data: {
    idUsuario: number;
    idCategoria: number;
    nombre: string;
    descripcion?: string | null;
    marca?: string | null;
    imagenes?: Array<{
      urlImagen: string;
      textoAlternativo?: string;
      orden?: number;
      esPrincipal?: boolean;
    }>;
  }) {
    const row = await catalogRepository.crearProducto({
      idUsuario: data.idUsuario,
      idCategoria: data.idCategoria,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      marca: data.marca ?? null,
      imagenesJSON: data.imagenes ? JSON.stringify(data.imagenes) : null,
    });
    const { ImagenesJSON, VariantesJSON, ...rest } = row;
    return {
      ...rest,
      imagenes: safeParseJson(ImagenesJSON, []),
      variantes: safeParseJson(VariantesJSON, []),
    };
  }

  async actualizarProducto(data: {
    idUsuario: number;
    idProducto: number;
    idCategoria: number;
    nombre: string;
    descripcion?: string | null;
    marca?: string | null;
    activo: boolean;
    imagenes?: Array<{
      urlImagen: string;
      textoAlternativo?: string;
      orden?: number;
      esPrincipal?: boolean;
    }>;
  }) {
    const row = await catalogRepository.actualizarProducto({
      idUsuario: data.idUsuario,
      idProducto: data.idProducto,
      idCategoria: data.idCategoria,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      marca: data.marca ?? null,
      activo: data.activo,
      imagenesJSON: data.imagenes ? JSON.stringify(data.imagenes) : null,
    });
    const { ImagenesJSON, VariantesJSON, ...rest } = row;
    return {
      ...rest,
      imagenes: safeParseJson(ImagenesJSON, []),
      variantes: safeParseJson(VariantesJSON, []),
    };
  }

  async eliminarODesactivarProducto(idUsuario: number, idProducto: number) {
    return catalogRepository.eliminarODesactivarProducto(idUsuario, idProducto);
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
    atributos?: Array<{ idAtributo: number; idValorAtributo: number }>;
  }) {
    return catalogRepository.guardarVariante({
      idUsuario: data.idUsuario,
      idProducto: data.idProducto,
      idVariante: data.idVariante ?? null,
      sku: data.sku,
      nombreVariante: data.nombreVariante,
      precio: data.precio,
      activa: data.activa,
      existenciaInicial: data.existenciaInicial ?? 0,
      atributosJSON: data.atributos ? JSON.stringify(data.atributos) : null,
    });
  }

  async registrarMovimientoInventario(data: {
    idUsuario: number;
    idVariante: number;
    tipoMovimiento: 'ENTRADA_COMPRA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA';
    cantidad: number;
    motivo: string;
  }) {
    return catalogRepository.registrarMovimientoInventario(data);
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
    const rows = await catalogRepository.consultarKardex(filters);
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

  async obtenerExistencias(filters: {
    pagina: number;
    tamanoPagina: number;
    idCategoria?: number;
    idProducto?: number;
    soloBajoStock?: boolean;
    busqueda?: string;
    ordenarPor?: string;
  }) {
    const rows = await catalogRepository.obtenerExistencias(filters);
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

  async liberarReservasVencidas(): Promise<{ reservasExpiradasLiberadas: number }> {
    const count = await catalogRepository.liberarReservasVencidas();
    return { reservasExpiradasLiberadas: count };
  }
}

export const catalogService = new CatalogService();
