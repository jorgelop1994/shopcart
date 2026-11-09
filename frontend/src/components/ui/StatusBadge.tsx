import React from 'react';
import { OrderState, UserRole } from '../../types/api.types';

const statusBadgeMap: Record<string, { bg: string; label: string }> = {
  Pagado: {
    bg: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
    label: 'Pagado',
  },
  EnPreparacion: {
    bg: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20',
    label: 'En Preparación',
  },
  Despachado: {
    bg: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20',
    label: 'Despachado',
  },
  Entregado: {
    bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    label: 'Entregado',
  },
  Cancelado: {
    bg: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
    label: 'Cancelado',
  },
  DevueltoParcial: {
    bg: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
    label: 'Devuelto Parcial',
  },
  DevueltoTotal: {
    bg: 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-600/20',
    label: 'Devuelto Total',
  },
  ACTIVO: {
    bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    label: 'Activo',
  },
  INACTIVO: {
    bg: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20',
    label: 'Inactivo',
  },
  VIGENTE: {
    bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    label: 'Vigente',
  },
  PROGRAMADO: {
    bg: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20',
    label: 'Programado',
  },
  VENCIDO: {
    bg: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
    label: 'Vencido',
  },
  AGOTADO: {
    bg: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20',
    label: 'Agotado',
  },
  ENTRADA_COMPRA: {
    bg: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    label: 'ENTRADA_COMPRA',
  },
  SALIDA_VENTA: {
    bg: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20',
    label: 'SALIDA_VENTA',
  },
  AJUSTE_POSITIVO: {
    bg: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20',
    label: 'AJUSTE_POSITIVO',
  },
  AJUSTE_NEGATIVO: {
    bg: 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/20',
    label: 'AJUSTE_NEGATIVO',
  },
  SALIDA_MERMA: {
    bg: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
    label: 'SALIDA_MERMA',
  },
  DEVOLUCION_CLIENTE: {
    bg: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
    label: 'DEVOLUCION_CLIENTE',
  },
  REINGRESO_CANCELACION: {
    bg: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20',
    label: 'REINGRESO_CANCELACION',
  },
};

export const StatusBadge: React.FC<{ status: OrderState | string }> = ({ status }) => {
  const cfg = statusBadgeMap[status] ?? {
    bg: 'bg-slate-100 text-slate-700',
    label: status,
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
};

export const OrderStatusBadge: React.FC<{ state: OrderState | string }> = ({ state }) => (
  <StatusBadge status={state} />
);

export const RoleBadge: React.FC<{ role: UserRole | string }> = ({ role }) => {
  const styles =
    role === 'Administrador'
      ? 'bg-purple-50 text-purple-700 ring-purple-600/20'
      : role === 'Operador'
        ? 'bg-amber-50 text-amber-800 ring-amber-600/20'
        : 'bg-sky-50 text-sky-700 ring-sky-600/20';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles}`}>
      {role}
    </span>
  );
};

export const ActiveBadge: React.FC<{ active: boolean; activeText?: string; inactiveText?: string }> = ({
  active,
  activeText = 'Activo',
  inactiveText = 'Inactivo',
}) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
      active
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
        : 'bg-slate-100 text-slate-600 ring-slate-500/20'
    }`}
  >
    {active ? activeText : inactiveText}
  </span>
);
