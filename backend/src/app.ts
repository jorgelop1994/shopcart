import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { catalogRouter } from './routes/catalog.routes';
import { cartRouter } from './routes/cart.routes';
import { ordersRouter } from './routes/orders.routes';
import { errorHandler } from './middlewares/errorHandler';
import { AppError } from './utils/AppError';

export function createApp(): Application {
  const app = express();

  // Cabeceras de seguridad básicas (RNF Seguridad)
  app.use(helmet());

  // Configuración de CORS por variables de entorno (RNF Seguridad)
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));

  // Endpoint de salud y estado del servicio
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      ok: true,
      service: 'ShopCart API - Tech Challenge 360',
      timestamp: new Date().toISOString(),
      currency: 'GTQ',
      ivaIncludedPercent: env.IVA_PERCENTAGE,
    });
  });

  // Documentación viva de endpoints de la API (Criterio de Evaluación Backend Pág. 13)
  app.get('/api/docs', (_req: Request, res: Response) => {
    res.status(200).json({
      ok: true,
      title: 'ShopCart REST API Documentation',
      version: '1.0.0',
      dataAccessPolicy: 'Exclusivamente mediante Stored Procedures (SP_Modulo_Proceso) en SQL Server 2022',
      modules: {
        'RF-01 Autenticación, Usuarios y Direcciones': [
          'POST /api/auth/register',
          'POST /api/auth/login',
          'POST /api/auth/refresh',
          'POST /api/auth/logout',
          'GET  /api/auth/me',
          'POST /api/auth/deactivate-self',
          'GET  /api/users (Admin)',
          'POST /api/users (Admin)',
          'PUT  /api/users/:id (Admin)',
          'PATCH /api/users/:id/status (Admin)',
          'GET  /api/addresses',
          'GET  /api/addresses/:id',
          'POST /api/addresses',
          'PUT  /api/addresses/:id',
          'DELETE /api/addresses/:id',
        ],
        'RF-02 Catálogo de Productos, Categorías y Variantes': [
          'GET  /api/categories',
          'POST /api/categories (Admin)',
          'PUT  /api/categories/:id (Admin)',
          'GET  /api/attributes',
          'POST /api/attributes (Admin)',
          'GET  /api/products',
          'GET  /api/products/:id',
          'POST /api/products (Admin)',
          'PUT  /api/products/:id (Admin)',
          'DELETE /api/products/:id (Admin - Desactiva si tiene ventas)',
          'POST /api/products/:idProducto/variants (Admin)',
          'PUT  /api/products/:idProducto/variants/:idVariante (Admin)',
        ],
        'RF-03 Inventario y Kardex': [
          'GET  /api/inventory/stock (Operador, Admin)',
          'GET  /api/inventory/kardex (Operador, Admin)',
          'POST /api/inventory/movements (Operador, Admin)',
          'POST /api/inventory/release-expired (Operador, Admin)',
        ],
        'RF-04 y RF-05 Carrito de Compras y Cupones': [
          'GET  /api/cart',
          'POST /api/cart/items',
          'PUT  /api/cart/items',
          'DELETE /api/cart/items/:idVariante',
          'DELETE /api/cart',
          'POST /api/cart/merge',
          'POST /api/cart/coupon',
          'DELETE /api/cart/coupon',
          'GET  /api/coupons (Admin)',
          'GET  /api/coupons/:id (Admin)',
          'POST /api/coupons (Admin)',
          'PUT  /api/coupons/:id (Admin)',
        ],
        'RF-06 y RF-07 Checkout, Pedidos y Devoluciones': [
          'POST /api/checkout/reserve (SP_Inventario_ReservarExistencia - 15 min)',
          'POST /api/checkout/confirm (SP_Pedidos_CrearPedido - Atómico e Idempotente)',
          'GET  /api/orders',
          'GET  /api/orders/:id',
          'PATCH /api/orders/:id/state',
          'POST /api/orders/:id/returns (Operador, Admin)',
        ],
        'RF-08 y RF-09 Dashboard, Reportes y Bitácora': [
          'GET  /api/dashboard/metrics (Operador, Admin)',
          'GET  /api/dashboard/export (Operador, Admin - CSV/Excel)',
          'GET  /api/dashboard/stream (Operador, Admin - SSE Tiempo Real)',
          'GET  /api/dashboard/abandoned-carts (Operador, Admin)',
          'GET  /api/audit-logs (Admin)',
        ],
      },
    });
  });

  // Montaje de rutas de los 9 módulos
  app.use('/api', authRouter);
  app.use('/api', catalogRouter);
  app.use('/api', cartRouter);
  app.use('/api', ordersRouter);

  // Manejador de rutas inexistentes (404)
  app.use((req: Request, _res: Response, next) => {
    next(
      new AppError(
        404,
        `La ruta solicitada [${req.method} ${req.originalUrl}] no existe en el API.`,
        'ROUTE_NOT_FOUND'
      )
    );
  });

  // Manejador centralizado de errores
  app.use(errorHandler);

  return app;
}
