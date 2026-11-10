import { apiRequest } from './httpClient';
import {
  AttributeGroup,
  CategoryRecord,
  InventoryStockRecord,
  KardexMovementRecord,
  PaginatedResult,
  ProductDetailRecord,
  ProductSummaryRecord,
} from '../types/api.types';

export const catalogApi = {
  // --- Categorías (RF-02) ---
  async listCategories(soloActivas?: boolean): Promise<CategoryRecord[]> {
    return apiRequest<CategoryRecord[]>('/categories', {
      query: soloActivas !== undefined ? { soloActivas } : undefined,
    });
  },

  async createCategory(data: {
    nombre: string;
    descripcion?: string | null;
  }): Promise<CategoryRecord> {
    return apiRequest<CategoryRecord>('/categories', { method: 'POST', body: data });
  },

  async updateCategory(
    idCategoria: number,
    data: { nombre: string; descripcion?: string | null; activa: boolean }
  ): Promise<CategoryRecord> {
    return apiRequest<CategoryRecord>(`/categories/${idCategoria}`, {
      method: 'PUT',
      body: data,
    });
  },

  async saveCategory(data: {
    idCategoria?: number;
    nombre: string;
    descripcion?: string | null;
    activa: boolean;
  }): Promise<CategoryRecord> {
    if (data.idCategoria) {
      return this.updateCategory(data.idCategoria, {
        nombre: data.nombre,
        descripcion: data.descripcion ?? undefined,
        activa: data.activa,
      });
    }
    return this.createCategory({
      nombre: data.nombre,
      descripcion: data.descripcion ?? undefined,
    });
  },

  // --- Atributos de Variantes (RF-02) ---
  async listAttributes(): Promise<AttributeGroup[]> {
    return apiRequest<AttributeGroup[]>('/attributes');
  },

  async saveAttributeValue(
    nombreAtributoOrObj: string | { nombreAtributo: string; valor: string },
    valor?: string
  ): Promise<unknown> {
    const body =
      typeof nombreAtributoOrObj === 'string'
        ? { nombreAtributo: nombreAtributoOrObj, valor: valor ?? '' }
        : nombreAtributoOrObj;
    return apiRequest('/attributes', {
      method: 'POST',
      body,
    });
  },

  // --- Productos y Variantes (RF-02) ---
  async listProducts(params: {
    pagina?: number;
    tamanoPagina?: number;
    busqueda?: string;
    idCategoria?: number;
    precioMin?: number;
    precioMax?: number;
    soloDisponibles?: boolean;
    soloActivos?: boolean;
    ordenarPor?: string;
  }): Promise<PaginatedResult<ProductSummaryRecord>> {
    const raw = await apiRequest<
      PaginatedResult<
        ProductSummaryRecord & {
          UrlImagenPrincipal?: string | null;
          TotalVariantes?: number;
        }
      >
    >('/products', { query: params });

    return {
      ...raw,
      items: (raw.items ?? []).map((item) => ({
        ...item,
        ImagenPrincipal: item.ImagenPrincipal ?? item.UrlImagenPrincipal ?? null,
        TotalVariantesActivas: item.TotalVariantesActivas ?? item.TotalVariantes ?? 0,
        TieneDisponibilidad:
          item.TieneDisponibilidad ?? Number(item.ExistenciaDisponibleTotal ?? 0) > 0,
      })),
    };
  },

  async getProductDetail(idProducto: number): Promise<ProductDetailRecord> {
    return apiRequest<ProductDetailRecord>(`/products/${idProducto}`);
  },

  async getProductById(idProducto: number): Promise<ProductDetailRecord> {
    return this.getProductDetail(idProducto);
  },

  async createProduct(data: {
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
  }): Promise<ProductDetailRecord> {
    return apiRequest<ProductDetailRecord>('/products', { method: 'POST', body: data });
  },

  async updateProduct(
    idProducto: number,
    data: {
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
    }
  ): Promise<ProductDetailRecord> {
    return apiRequest<ProductDetailRecord>(`/products/${idProducto}`, {
      method: 'PUT',
      body: data,
    });
  },

  async saveProduct(data: {
    idProducto?: number;
    idCategoria: number;
    nombre: string;
    descripcion?: string | null;
    marca?: string | null;
    activo: boolean;
  }): Promise<ProductDetailRecord> {
    if (data.idProducto) {
      return this.updateProduct(data.idProducto, data);
    }
    return this.createProduct(data);
  },

  async addProductImage(
    idProducto: number,
    image: {
      urlImagen: string;
      textoAlternativo?: string;
      orden?: number;
      esPrincipal?: boolean;
    }
  ): Promise<ProductDetailRecord> {
    const current = await this.getProductDetail(idProducto);
    const existingImages = (current.imagenes ?? []).map((img) => ({
      urlImagen: img.UrlImagen,
      textoAlternativo: img.TextoAlternativo ?? undefined,
      orden: img.Orden,
      esPrincipal: image.esPrincipal ? false : img.EsPrincipal,
    }));
    return this.updateProduct(idProducto, {
      idCategoria: current.IDCategoria,
      nombre: current.Nombre,
      descripcion: current.Descripcion,
      marca: current.Marca,
      activo: current.Activo,
      imagenes: [...existingImages, image],
    });
  },

  async deleteOrDeactivateProduct(idProducto: number): Promise<{
    IDProducto: number;
    AccionTomada: 'ELIMINADO_FISICO' | 'DESACTIVADO_POR_VENTAS';
    AccionAplicada?: string;
    TieneVentasAsociadas: boolean;
    Mensaje: string;
  }> {
    return apiRequest(`/products/${idProducto}`, { method: 'DELETE' });
  },

  async saveVariant(
    idProductoOrData:
      | number
      | {
          idProducto: number;
          idVariante?: number | null;
          sku: string;
          nombreVariante: string;
          precio: number;
          activa?: boolean;
          existenciaInicial?: number;
          atributos?: Array<{ idAtributo: number; idValorAtributo: number }>;
          idsValoresAtributo?: number[];
        },
    maybeData?: {
      idVariante?: number | null;
      sku: string;
      nombreVariante: string;
      precio: number;
      activa?: boolean;
      existenciaInicial?: number;
      atributos?: Array<{ idAtributo: number; idValorAtributo: number }>;
    }
  ): Promise<ProductDetailRecord> {
    const idProducto =
      typeof idProductoOrData === 'number' ? idProductoOrData : idProductoOrData.idProducto;
    const data = typeof idProductoOrData === 'number' ? maybeData! : idProductoOrData;
    if (data.idVariante) {
      return apiRequest<ProductDetailRecord>(
        `/products/${idProducto}/variants/${data.idVariante}`,
        { method: 'PUT', body: data }
      );
    }
    return apiRequest<ProductDetailRecord>(`/products/${idProducto}/variants`, {
      method: 'POST',
      body: data,
    });
  },

  // --- Inventario y Kardex (RF-03) ---
  async getInventoryStock(params: {
    pagina?: number;
    tamanoPagina?: number;
    idCategoria?: number;
    idProducto?: number;
    soloBajoStock?: boolean;
    soloStockBajo?: boolean;
    busqueda?: string;
    ordenarPor?: string;
  }): Promise<PaginatedResult<InventoryStockRecord>> {
    return apiRequest<PaginatedResult<InventoryStockRecord>>('/inventory/stock', {
      query: {
        ...params,
        soloBajoStock: params.soloBajoStock ?? params.soloStockBajo,
      },
    });
  },

  async listInventoryStock(params: {
    pagina?: number;
    tamanoPagina?: number;
    idCategoria?: number;
    idProducto?: number;
    soloBajoStock?: boolean;
    soloStockBajo?: boolean;
    busqueda?: string;
    ordenarPor?: string;
  }): Promise<PaginatedResult<InventoryStockRecord>> {
    return this.getInventoryStock(params);
  },

  async getKardex(params: {
    pagina?: number;
    tamanoPagina?: number;
    idVariante?: number;
    idProducto?: number;
    tipoMovimiento?: string;
    fechaInicio?: string;
    fechaFin?: string;
    busqueda?: string;
    ordenarPor?: string;
  }): Promise<PaginatedResult<KardexMovementRecord>> {
    return apiRequest<PaginatedResult<KardexMovementRecord>>('/inventory/kardex', {
      query: params,
    });
  },

  async listKardex(params: {
    pagina?: number;
    tamanoPagina?: number;
    idVariante?: number;
    idProducto?: number;
    tipoMovimiento?: string;
    fechaInicio?: string;
    fechaFin?: string;
    busqueda?: string;
    ordenarPor?: string;
  }): Promise<PaginatedResult<KardexMovementRecord>> {
    return this.getKardex(params);
  },

  async registerMovement(data: {
    idVariante: number;
    tipoMovimiento: 'ENTRADA_COMPRA' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA';
    cantidad: number;
    motivo: string;
  }): Promise<KardexMovementRecord> {
    return apiRequest<KardexMovementRecord>('/inventory/movements', {
      method: 'POST',
      body: data,
    });
  },

  async releaseExpiredReservations(): Promise<{
    reservasExpiradasLiberadas: number;
    TotalReservasLiberadas?: number;
    TotalUnidadesLiberadas?: number;
  }> {
    return apiRequest('/inventory/release-expired', {
      method: 'POST',
    });
  },
};
