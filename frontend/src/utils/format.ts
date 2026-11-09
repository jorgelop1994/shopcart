import { OrderState, UserRole } from '../types/api.types';

const gtqFormatter = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatGTQ(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return 'Q 0.00';
  return gtqFormatter.format(num);
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat('es-GT', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export const formatDateTimeGT = formatDateTime;

export function formatDateShort(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat('es-GT', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export const formatDateGT = formatDateShort;

export function formatJsonPretty(raw: string | null | undefined): string {
  if (!raw) return '— (Sin valor previo/posterior)';
  try {
    const parsed: unknown = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export const ORDER_ALLOWED_TRANSITIONS: Record<
  OrderState,
  Array<{ to: OrderState; label: string; roles: UserRole[] }>
> = {
  Pagado: [
    {
      to: 'EnPreparacion',
      label: 'Iniciar Preparación en Bodega',
      roles: ['Operador', 'Administrador'],
    },
    {
      to: 'Cancelado',
      label: 'Cancelar Pedido (Reintegra Stock)',
      roles: ['Cliente', 'Operador', 'Administrador'],
    },
  ],
  EnPreparacion: [
    {
      to: 'Despachado',
      label: 'Marcar como Despachado a Ruta',
      roles: ['Operador', 'Administrador'],
    },
    {
      to: 'Cancelado',
      label: 'Cancelar Pedido antes de Despacho',
      roles: ['Cliente', 'Operador', 'Administrador'],
    },
  ],
  Despachado: [
    {
      to: 'Entregado',
      label: 'Confirmar Entrega al Cliente',
      roles: ['Operador', 'Administrador'],
    },
  ],
  Entregado: [],
  DevueltoParcial: [],
  DevueltoTotal: [],
  Cancelado: [],
};
