import { Router } from 'express';
import { z } from 'zod';
import { catalogController } from '../controllers/catalog.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { validateSchema } from '../middlewares/validateSchema';
import {
  authenticateJWT,
  optionalAuthenticateJWT,
  requireRoles,
} from '../middlewares/authMiddleware';

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const categoryBodySchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre de la categoría es obligatorio.').max(100),
  descripcion: z.string().trim().max(300).optional().nullable(),
  activa: z.boolean().optional().default(true),
});

const attributeValueBodySchema = z.object({
  nombreAtributo: z.string().trim().min(2).max(60),
  valor: z.string().trim().min(1).max(80),
});

const productImageSchema = z.object({
  urlImagen: z.string().trim().min(5).max(500),
  textoAlternativo: z.string().trim().max(150).optional().nullable(),
  orden: z.coerce.number().int().positive().optional().default(1),
  esPrincipal: z.boolean().optional().default(false),
});

const productBodySchema = z.object({
  idCategoria: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(2, 'El nombre del producto es obligatorio.').max(150),
  descripcion: z.string().trim().optional().nullable(),
  marca: z.string().trim().max(80).optional().nullable(),
  activo: z.boolean().optional().default(true),
  imagenes: z.array(productImageSchema).optional(),
});

const variantBodySchema = z.object({
  idVariante: z.coerce.number().int().positive().optional().nullable(),
  sku: z.string().trim().min(3, 'El SKU debe tener al menos 3 caracteres.').max(60),
  nombreVariante: z.string().trim().min(1, 'El nombre de la variante es obligatorio.').max(150),
  precio: z.coerce.number().nonnegative('El precio no puede ser negativo.'),
  activa: z.boolean().optional().default(true),
  existenciaInicial: z.coerce.number().int().nonnegative().optional().default(0),
  atributos: z
    .array(
      z.object({
        idAtributo: z.coerce.number().int().positive(),
        idValorAtributo: z.coerce.number().int().positive(),
      })
    )
    .optional(),
});

const inventoryMovementSchema = z.object({
  idVariante: z.coerce.number().int().positive(),
  tipoMovimiento: z.enum(['ENTRADA_COMPRA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA']),
  cantidad: z.coerce.number().int().positive('La cantidad debe ser un entero mayor a cero.'),
  motivo: z.string().trim().min(3, 'El motivo del movimiento es obligatorio (mínimo 3 caracteres).').max(300),
});

export const catalogRouter = Router();

// --- Categorías (RF-02) ---
catalogRouter.get(
  '/categories',
  optionalAuthenticateJWT,
  asyncHandler((req, res) => catalogController.listarCategorias(req, res))
);

catalogRouter.post(
  '/categories',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ body: categoryBodySchema }),
  asyncHandler((req, res) => catalogController.crearCategoria(req, res))
);

catalogRouter.put(
  '/categories/:id',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ params: idParamSchema, body: categoryBodySchema }),
  asyncHandler((req, res) => catalogController.actualizarCategoria(req, res))
);

// --- Atributos de Variantes (RF-02) ---
catalogRouter.get(
  '/attributes',
  optionalAuthenticateJWT,
  asyncHandler((req, res) => catalogController.listarAtributos(req, res))
);

catalogRouter.post(
  '/attributes',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ body: attributeValueBodySchema }),
  asyncHandler((req, res) => catalogController.guardarAtributoYValor(req, res))
);

// --- Productos y Variantes (RF-02) ---
catalogRouter.get(
  '/products',
  optionalAuthenticateJWT,
  asyncHandler((req, res) => catalogController.listarProductos(req, res))
);

catalogRouter.get(
  '/products/:id',
  optionalAuthenticateJWT,
  validateSchema({ params: idParamSchema }),
  asyncHandler((req, res) => catalogController.obtenerProductoDetalle(req, res))
);

catalogRouter.post(
  '/products',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ body: productBodySchema }),
  asyncHandler((req, res) => catalogController.crearProducto(req, res))
);

catalogRouter.put(
  '/products/:id',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ params: idParamSchema, body: productBodySchema }),
  asyncHandler((req, res) => catalogController.actualizarProducto(req, res))
);

catalogRouter.delete(
  '/products/:id',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ params: idParamSchema }),
  asyncHandler((req, res) => catalogController.eliminarODesactivarProducto(req, res))
);

catalogRouter.post(
  '/products/:idProducto/variants',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({
    params: z.object({ idProducto: z.coerce.number().int().positive() }),
    body: variantBodySchema,
  }),
  asyncHandler((req, res) => catalogController.guardarVariante(req, res))
);

catalogRouter.put(
  '/products/:idProducto/variants/:idVariante',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({
    params: z.object({
      idProducto: z.coerce.number().int().positive(),
      idVariante: z.coerce.number().int().positive(),
    }),
    body: variantBodySchema,
  }),
  asyncHandler((req, res) => catalogController.guardarVariante(req, res))
);

// --- Inventario y Kardex (RF-03: Operador y Administrador) ---
catalogRouter.get(
  '/inventory/stock',
  authenticateJWT,
  requireRoles('Operador', 'Administrador'),
  asyncHandler((req, res) => catalogController.obtenerExistencias(req, res))
);

catalogRouter.get(
  '/inventory/kardex',
  authenticateJWT,
  requireRoles('Operador', 'Administrador'),
  asyncHandler((req, res) => catalogController.consultarKardex(req, res))
);

catalogRouter.post(
  '/inventory/movements',
  authenticateJWT,
  requireRoles('Operador', 'Administrador'),
  validateSchema({ body: inventoryMovementSchema }),
  asyncHandler((req, res) => catalogController.registrarMovimientoInventario(req, res))
);

catalogRouter.post(
  '/inventory/release-expired',
  authenticateJWT,
  requireRoles('Operador', 'Administrador'),
  asyncHandler((req, res) => catalogController.liberarReservasVencidas(req, res))
);
