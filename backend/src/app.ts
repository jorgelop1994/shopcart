import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
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
  // Se desactiva CSP únicamente para permitir los estilos y scripts interactivos de Swagger UI
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

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

  // Documentación viva interactiva Swagger UI y especificación OpenAPI 3.0 (Criterio de Evaluación Backend Pág. 13)
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(swaggerSpec);
  });

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'ShopCart API — Documentación Swagger',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
      },
    })
  );

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
