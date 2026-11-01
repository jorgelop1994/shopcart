import { Router } from 'express';
import { z } from 'zod';
import { ordersController } from '../controllers/orders.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { validateSchema } from '../middlewares/validateSchema';
import { authenticateJWT, requireRoles } from '../middlewares/authMiddleware';

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const reserveStockSchema = z.object({
  idCarrito: z.coerce.number().int().positive('El IDCarrito es obligatorio para reservar existencia.'),
});

const createOrderSchema = z.object({
  idCarrito: z.coerce.number().int().positive('El IDCarrito es obligatorio.'),
  idDireccionEntrega: z.coerce.number().int().positive('Debe seleccionar una dirección de entrega.'),
  tokenReserva: z.string().trim().min(5, 'El TokenReserva de 15 minutos es obligatorio.').max(64),
  claveIdempotencia: z.string().trim().min(5, 'La ClaveIdempotencia es obligatoria para evitar doble cobro.').max(100).optional(),
  metodoPago: z.string().trim().min(2).max(40).optional().default('TARJETA_CREDITO'),
  referenciaPago: z.string().trim().max(100).optional().nullable(),
  simularFalloPago: z.boolean().optional().default(false),
});

const changeStateSchema = z.object({
  estadoNuevo: z.enum([
    'Pagado',
    'EnPreparacion',
    'Despachado',
    'Entregado',
    'Cancelado',
    'DevueltoParcial',
    'DevueltoTotal',
  ]),
  motivoComentario: z.string().trim().max(300).optional().nullable(),
});

const registerReturnSchema = z.object({
  motivoDevolucion: z
    .string()
    .trim()
    .min(3, 'El motivo de la devolución es obligatorio (mínimo 3 caracteres).')
    .max(300),
  lineas: z
    .array(
      z.object({
        idDetallePedido: z.coerce.number().int().positive(),
        cantidadADevolver: z.coerce.number().int().positive('La cantidad a devolver debe ser mayor a cero.'),
      })
    )
    .min(1, 'Debe especificar al menos una línea de pedido para devolver.'),
});

export const ordersRouter = Router();

// --- Checkout y Reserva de Existencia por 15 Minutos (RF-06) ---
ordersRouter.post(
  '/checkout/reserve',
  authenticateJWT,
  validateSchema({ body: reserveStockSchema }),
  asyncHandler((req, res) => ordersController.reservarExistencia(req, res))
);

ordersRouter.post(
  '/checkout/confirm',
  authenticateJWT,
  validateSchema({ body: createOrderSchema }),
  asyncHandler((req, res) => ordersController.crearPedido(req, res))
);

// --- Gestión de Pedidos, Máquina de Estados y Devoluciones (RF-07) ---
ordersRouter.get(
  '/orders',
  authenticateJWT,
  asyncHandler((req, res) => ordersController.listarPedidos(req, res))
);

ordersRouter.get(
  '/orders/:id',
  authenticateJWT,
  validateSchema({ params: idParamSchema }),
  asyncHandler((req, res) => ordersController.obtenerDetallePedido(req, res))
);

ordersRouter.patch(
  '/orders/:id/state',
  authenticateJWT,
  validateSchema({ params: idParamSchema, body: changeStateSchema }),
  asyncHandler((req, res) => ordersController.cambiarEstadoPedido(req, res))
);

ordersRouter.post(
  '/orders/:id/returns',
  authenticateJWT,
  requireRoles('Operador', 'Administrador'),
  validateSchema({ params: idParamSchema, body: registerReturnSchema }),
  asyncHandler((req, res) => ordersController.registrarDevolucion(req, res))
);

// --- Dashboard y Reportes (RF-08 + Extras: Caché, SSE y Exportación CSV/Excel) ---
ordersRouter.get(
  '/dashboard/metrics',
  authenticateJWT,
  requireRoles('Administrador', 'Operador'),
  asyncHandler((req, res) => ordersController.obtenerMetricasDashboard(req, res))
);

ordersRouter.get(
  '/dashboard/export',
  authenticateJWT,
  requireRoles('Administrador', 'Operador'),
  asyncHandler((req, res) => ordersController.exportarReporteDashboard(req, res))
);

ordersRouter.get(
  '/dashboard/stream',
  authenticateJWT,
  requireRoles('Administrador', 'Operador'),
  asyncHandler((req, res) => ordersController.suscribirStreamDashboard(req, res))
);

ordersRouter.get(
  '/dashboard/abandoned-carts',
  authenticateJWT,
  requireRoles('Administrador', 'Operador'),
  asyncHandler((req, res) => ordersController.listarCarritosAbandonados(req, res))
);

// --- Bitácora Inmutable (RF-09: Exclusivo Administrador) ---
ordersRouter.get(
  '/audit-logs',
  authenticateJWT,
  requireRoles('Administrador'),
  asyncHandler((req, res) => ordersController.listarBitacora(req, res))
);
