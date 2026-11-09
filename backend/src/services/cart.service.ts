import { cartRepository, DbCartSummaryRecord } from '../repositories/cart.repository';

function formatCartResponse(row: DbCartSummaryRecord) {
  let items: unknown[] = [];
  if (row.ItemsJSON) {
    try {
      items = JSON.parse(row.ItemsJSON) as unknown[];
    } catch {
      items = [];
    }
  }

  const { ItemsJSON, ...summary } = row;
  return {
    ...summary,
    items,
  };
}

export class CartService {
  async obtenerDetalle(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
    idCarrito?: number | null;
  }) {
    const row = await cartRepository.obtenerDetalle(data);
    return formatCartResponse(row);
  }

  async agregarOModificarItem(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
    idVariante: number;
    cantidad: number;
    esIncremento: boolean;
  }) {
    const row = await cartRepository.agregarOModificarItem(data);
    return formatCartResponse(row);
  }

  async eliminarItem(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
    idVariante: number;
  }) {
    const row = await cartRepository.eliminarItem(data);
    return formatCartResponse(row);
  }

  async vaciarCarrito(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
  }) {
    const row = await cartRepository.vaciarCarrito(data);
    return formatCartResponse(row);
  }

  async fusionarCarritoInvitado(data: { idUsuario: number; tokenInvitado: string }) {
    const row = await cartRepository.fusionarCarritoInvitado(data);
    return formatCartResponse(row);
  }

  async aplicarCupon(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
    codigoCupon: string;
  }) {
    const row = await cartRepository.aplicarCupon(data);
    return formatCartResponse(row);
  }

  async removerCupon(data: {
    idUsuario?: number | null;
    tokenInvitado?: string | null;
  }) {
    const row = await cartRepository.removerCupon(data);
    return formatCartResponse(row);
  }

  async listarCupones(filters: {
    pagina: number;
    tamanoPagina: number;
    activo?: boolean;
    busqueda?: string;
    ordenarPor?: string;
  }) {
    const rows = await cartRepository.listarCupones(filters);
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

  async obtenerCuponPorId(idCupon: number) {
    return cartRepository.obtenerCuponPorId(idCupon);
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
    return cartRepository.guardarCupon(data);
  }
}

export const cartService = new CartService();
