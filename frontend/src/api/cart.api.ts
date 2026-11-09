import { apiRequest } from './httpClient';
import { CartDetailRecord, CouponRecord, PaginatedResult } from '../types/api.types';

export const cartApi = {
  async getCart(): Promise<CartDetailRecord> {
    return apiRequest<CartDetailRecord>('/cart');
  },

  async addItem(idVariante: number, cantidad: number): Promise<CartDetailRecord> {
    return apiRequest<CartDetailRecord>('/cart/items', {
      method: 'POST',
      body: { idVariante, cantidad, esIncremento: true },
    });
  },

  async setItemQuantity(idVariante: number, cantidad: number): Promise<CartDetailRecord> {
    return apiRequest<CartDetailRecord>('/cart/items', {
      method: 'PUT',
      body: { idVariante, cantidad, esIncremento: false },
    });
  },

  async removeItem(idVariante: number): Promise<CartDetailRecord> {
    return apiRequest<CartDetailRecord>(`/cart/items/${idVariante}`, {
      method: 'DELETE',
    });
  },

  async clearCart(): Promise<CartDetailRecord> {
    return apiRequest<CartDetailRecord>('/cart', { method: 'DELETE' });
  },

  async applyCoupon(codigoCupon: string): Promise<CartDetailRecord> {
    return apiRequest<CartDetailRecord>('/cart/coupon', {
      method: 'POST',
      body: { codigoCupon },
    });
  },

  async removeCoupon(): Promise<CartDetailRecord> {
    return apiRequest<CartDetailRecord>('/cart/coupon', { method: 'DELETE' });
  },

  // --- Administración de Cupones (RF-05 Admin) ---
  async listCoupons(params: {
    pagina?: number;
    tamanoPagina?: number;
    activo?: boolean;
    busqueda?: string;
    ordenarPor?: string;
  }): Promise<PaginatedResult<CouponRecord>> {
    return apiRequest<PaginatedResult<CouponRecord>>('/coupons', { query: params });
  },

  async saveCoupon(data: {
    idCupon?: number | null;
    codigo: string;
    descripcion: string;
    tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO';
    valorDescuento: number;
    idCategoria?: number | null;
    montoMinimoCompra: number;
    limiteUsoTotal: number;
    limiteUsoPorCliente: number;
    fechaInicio: string;
    fechaFin: string;
    activo: boolean;
  }): Promise<CouponRecord> {
    if (data.idCupon) {
      return apiRequest<CouponRecord>(`/coupons/${data.idCupon}`, {
        method: 'PUT',
        body: data,
      });
    }
    return apiRequest<CouponRecord>('/coupons', { method: 'POST', body: data });
  },
};
