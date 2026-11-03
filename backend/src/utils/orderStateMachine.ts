import { UserRole } from '../middlewares/authMiddleware';
import { AppError } from './AppError';

/**
 * Máquina de estados del pedido (RF-07) — capa de backend.
 *
 * Es el espejo de la tabla dbo.TransicionesEstadoPedido. La regla se valida en
 * dos niveles (defensa en profundidad, según el criterio de aceptación de RF-07):
 *   1. Backend: este módulo rechaza la transición antes de llegar a la BD.
 *   2. Base de datos: SP_Pedidos_CambiarEstado vuelve a validar contra la tabla
 *      bajo bloqueo (UPDLOCK, HOLDLOCK), lo que cubre carreras entre solicitudes.
 */
export type OrderState =
  | 'Pagado'
  | 'EnPreparacion'
  | 'Despachado'
  | 'Entregado'
  | 'Cancelado'
  | 'DevueltoParcial'
  | 'DevueltoTotal';

export const ORDER_STATES: readonly OrderState[] = [
  'Pagado',
  'EnPreparacion',
  'Despachado',
  'Entregado',
  'Cancelado',
  'DevueltoParcial',
  'DevueltoTotal',
] as const;

type TransitionRule = { to: OrderState; roles: readonly UserRole[] };

const STAFF: readonly UserRole[] = ['Operador', 'Administrador'];
const ALL: readonly UserRole[] = ['Cliente', 'Operador', 'Administrador'];

export const ALLOWED_TRANSITIONS: Readonly<Record<OrderState, readonly TransitionRule[]>> = {
  Pagado: [
    { to: 'EnPreparacion', roles: STAFF },
    { to: 'Cancelado', roles: ALL },
  ],
  EnPreparacion: [
    { to: 'Despachado', roles: STAFF },
    { to: 'Cancelado', roles: ALL },
  ],
  Despachado: [{ to: 'Entregado', roles: STAFF }],
  Entregado: [
    { to: 'DevueltoParcial', roles: STAFF },
    { to: 'DevueltoTotal', roles: STAFF },
  ],
  DevueltoParcial: [
    { to: 'DevueltoParcial', roles: STAFF },
    { to: 'DevueltoTotal', roles: STAFF },
  ],
  Cancelado: [],
  DevueltoTotal: [],
};

function isOrderState(value: string): value is OrderState {
  return (ORDER_STATES as readonly string[]).includes(value);
}

/**
 * Lanza AppError 422 si la transición no existe, o 403 si existe pero el rol
 * del ejecutor no está autorizado para realizarla.
 */
export function assertTransitionAllowed(from: string, to: string, role: UserRole): void {
  if (!isOrderState(from) || !isOrderState(to)) {
    throw new AppError(422, `Estado de pedido desconocido: ${from} -> ${to}.`, 'INVALID_ORDER_STATE_TRANSITION');
  }

  const rule = ALLOWED_TRANSITIONS[from].find((r) => r.to === to);
  if (!rule) {
    throw new AppError(
      422,
      `Transición de estado no permitida: ${from} -> ${to}.`,
      'INVALID_ORDER_STATE_TRANSITION',
      { estadoActual: from, estadoSolicitado: to }
    );
  }

  if (!rule.roles.includes(role)) {
    throw new AppError(
      403,
      `El rol ${role} no puede realizar la transición ${from} -> ${to}.`,
      'FORBIDDEN_ORDER_STATE_TRANSITION'
    );
  }
}
