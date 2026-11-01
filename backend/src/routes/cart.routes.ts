import { Router } from 'express';
import { z } from 'zod';
import { cartController } from '../controllers/cart.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { validateSchema } from '../middlewares/validateSchema';
import {
  authenticateJWT,
  optionalAuthenticateJWT,
  requireRoles,
} from '../middlewares/authMiddleware';

const cartItemSchema = z.object({
  idVariante: z.coerce.number().int().positive('El identificador de la variante es obligatorio.'),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser un entero positivo mayor a cero.'),
  esIncremento: z.boolean().optional().default(false),
  tokenInvitado: z.string().trim().max(100).optional().nullable(),
});

const applyCouponSchema = z.object({
  codigoCupon: z.string().trim().min(2, 'Debe ingresar un código de cupón válido.').max(40),
  tokenInvitado: z.string().trim().max(100).optional().nullable(),
});

const mergeGuestCartSchema = z.object({
  tokenInvitado: z.string().trim().min(3, 'El token de invitado es requerido para la fusión.').max(100),
});

const couponBodySchema = z.object({
  idCupon: z.coerce.number().int().positive().optional().nullable(),
  codigo: z.string().trim().min(3, 'El código del cupón debe tener al menos 3 caracteres.').max(40),
  descripcion: z.string().trim().min(3, 'La descripción es obligatoria.').max(200),
  tipoDescuento: z.enum(['PORCENTAJE', 'MONTO_FIJO']),
  valorDescuento: z.coerce.number().positive('El valor del descuento debe ser mayor a cero.'),
  idCategoria: z.coerce.number().int().positive().optional().nullable(),
  montoMinimoCompra: z.coerce.number().nonnegative().optional().default(0),
  limiteUsoTotal: z.coerce.number().int().positive('El límite de usos total debe ser mayor a cero.'),
  limiteUsoPorCliente: z.coerce.number().int().positive().optional().default(1),
  fechaInicio: z.string().min(8, 'La fecha de inicio es obligatoria.'),
  fechaFin: z.string().min(8, 'La fecha de fin es obligatoria.'),
  activo: z.boolean().optional().default(true),
});

export const cartRouter = Router();

// --- Carrito de Compras (RF-04: Autenticado o Invitado mediante x-guest-token) ---
cartRouter.get(
  '/cart',
  optionalAuthenticateJWT,
  asyncHandler((req, res) => cartController.obtenerCarrito(req, res))
);

cartRouter.post(
  '/cart/items',
  optionalAuthenticateJWT,
  validateSchema({ body: cartItemSchema }),
  asyncHandler((req, res) => cartController.agregarOModificarItem(req, res))
);

cartRouter.put(
  '/cart/items',
  optionalAuthenticateJWT,
  validateSchema({ body: cartItemSchema }),
  asyncHandler((req, res) => cartController.agregarOModificarItem(req, res))
);

cartRouter.delete(
  '/cart/items/:idVariante',
  optionalAuthenticateJWT,
  validateSchema({
    params: z.object({ idVariante: z.coerce.number().int().positive() }),
  }),
  asyncHandler((req, res) => cartController.eliminarItem(req, res))
);

cartRouter.delete(
  '/cart',
  optionalAuthenticateJWT,
  asyncHandler((req, res) => cartController.vaciarCarrito(req, res))
);

cartRouter.post(
  '/cart/merge',
  authenticateJWT,
  validateSchema({ body: mergeGuestCartSchema }),
  asyncHandler((req, res) => cartController.fusionarInvitado(req, res))
);

cartRouter.post(
  '/cart/coupon',
  optionalAuthenticateJWT,
  validateSchema({ body: applyCouponSchema }),
  asyncHandler((req, res) => cartController.aplicarCupon(req, res))
);

cartRouter.delete(
  '/cart/coupon',
  optionalAuthenticateJWT,
  asyncHandler((req, res) => cartController.removerCupon(req, res))
);

// --- Administración de Cupones (RF-05: Exclusivo Administrador) ---
cartRouter.get(
  '/coupons',
  authenticateJWT,
  requireRoles('Administrador'),
  asyncHandler((req, res) => cartController.listarCupones(req, res))
);

cartRouter.get(
  '/coupons/:id',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ params: z.object({ id: z.coerce.number().int().positive() }) }),
  asyncHandler((req, res) => cartController.obtenerCuponPorId(req, res))
);

cartRouter.post(
  '/coupons',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ body: couponBodySchema }),
  asyncHandler((req, res) => cartController.guardarCupon(req, res))
);

cartRouter.put(
  '/coupons/:id',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: couponBodySchema,
  }),
  asyncHandler((req, res) => cartController.guardarCupon(req, res))
);
