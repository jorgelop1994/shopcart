import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { asyncHandler } from '../utils/asyncHandler';
import { validateSchema } from '../middlewares/validateSchema';
import { authenticateJWT, optionalAuthenticateJWT, requireRoles } from '../middlewares/authMiddleware';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 60, // límite por IP en ventana de 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de autenticación desde esta dirección IP. Intente más tarde.',
      details: null,
    },
  },
});

const registerSchema = z.object({
  nombreCompleto: z.string().trim().min(2, 'El nombre completo debe tener al menos 2 caracteres.').max(150),
  correo: z.string().trim().email('Debe proporcionar un correo electrónico válido.').max(150),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').max(100),
  telefono: z.string().trim().max(30).optional().nullable(),
  tokenInvitado: z.string().trim().max(100).optional().nullable(),
});

const loginSchema = z.object({
  correo: z.string().trim().email('Correo electrónico inválido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
  tokenInvitado: z.string().trim().max(100).optional().nullable(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'El refresh token es obligatorio.'),
});

const createInternalUserSchema = z.object({
  rol: z.enum(['Cliente', 'Operador', 'Administrador']),
  nombreCompleto: z.string().trim().min(2).max(150),
  correo: z.string().trim().email().max(150),
  password: z.string().min(6).max(100),
  telefono: z.string().trim().max(30).optional().nullable(),
});

const updateUserSchema = z.object({
  nombreCompleto: z.string().trim().min(2).max(150),
  telefono: z.string().trim().max(30).optional().nullable(),
  rol: z.enum(['Cliente', 'Operador', 'Administrador']).optional().nullable(),
});

const toggleStatusSchema = z.object({
  activo: z.boolean(),
});

const addressSchema = z.object({
  alias: z.string().trim().min(2, 'El alias de la dirección es obligatorio.').max(50),
  nombreReceptor: z.string().trim().min(2, 'El nombre del receptor es obligatorio.').max(150),
  telefonoContacto: z.string().trim().min(4, 'El teléfono de contacto es obligatorio.').max(30),
  departamento: z.string().trim().min(2, 'El departamento es obligatorio.').max(80),
  municipio: z.string().trim().min(2, 'El municipio es obligatorio.').max(80),
  direccionExacta: z.string().trim().min(5, 'La dirección exacta debe tener al menos 5 caracteres.').max(300),
  referencias: z.string().trim().max(250).optional().nullable(),
  esPredeterminada: z.boolean().optional().default(false),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const authRouter = Router();

// --- Autenticación pública y rotación de tokens ---
authRouter.post(
  '/auth/register',
  authLimiter,
  validateSchema({ body: registerSchema }),
  asyncHandler((req, res) => authController.registrarCliente(req, res))
);

authRouter.post(
  '/auth/login',
  authLimiter,
  validateSchema({ body: loginSchema }),
  asyncHandler((req, res) => authController.iniciarSesion(req, res))
);

authRouter.post(
  '/auth/refresh',
  authLimiter,
  validateSchema({ body: refreshSchema }),
  asyncHandler((req, res) => authController.rotarRefreshToken(req, res))
);

authRouter.post(
  '/auth/logout',
  optionalAuthenticateJWT,
  asyncHandler((req, res) => authController.cerrarSesion(req, res))
);

authRouter.get(
  '/auth/me',
  authenticateJWT,
  asyncHandler((req, res) => authController.obtenerMiPerfil(req, res))
);

authRouter.post(
  '/auth/deactivate-self',
  authenticateJWT,
  asyncHandler((req, res) => authController.desactivarMiCuenta(req, res))
);

// --- Administración de Usuarios (Exclusivo Administrador) ---
authRouter.get(
  '/users',
  authenticateJWT,
  requireRoles('Administrador'),
  asyncHandler((req, res) => authController.listarUsuarios(req, res))
);

authRouter.post(
  '/users',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ body: createInternalUserSchema }),
  asyncHandler((req, res) => authController.crearUsuarioInterno(req, res))
);

authRouter.put(
  '/users/:id',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler((req, res) => authController.actualizarUsuario(req, res))
);

authRouter.patch(
  '/users/:id/status',
  authenticateJWT,
  requireRoles('Administrador'),
  validateSchema({ params: idParamSchema, body: toggleStatusSchema }),
  asyncHandler((req, res) => authController.cambiarEstadoUsuario(req, res))
);

// --- Direcciones del Cliente (Validación anti-IDOR por propietario en Backend y BD) ---
authRouter.get(
  '/addresses',
  authenticateJWT,
  asyncHandler((req, res) => authController.listarDirecciones(req, res))
);

authRouter.get(
  '/addresses/:id',
  authenticateJWT,
  validateSchema({ params: idParamSchema }),
  asyncHandler((req, res) => authController.obtenerDireccion(req, res))
);

authRouter.post(
  '/addresses',
  authenticateJWT,
  validateSchema({ body: addressSchema }),
  asyncHandler((req, res) => authController.crearDireccion(req, res))
);

authRouter.put(
  '/addresses/:id',
  authenticateJWT,
  validateSchema({ params: idParamSchema, body: addressSchema }),
  asyncHandler((req, res) => authController.actualizarDireccion(req, res))
);

authRouter.delete(
  '/addresses/:id',
  authenticateJWT,
  validateSchema({ params: idParamSchema }),
  asyncHandler((req, res) => authController.eliminarDireccion(req, res))
);
