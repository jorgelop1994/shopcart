import { createApp } from './app';
import { env } from './config/env';
import { getDbPool, closeDbPool } from './config/database';
import { catalogService } from './services/catalog.service';

async function bootstrap(): Promise<void> {
  try {
    await getDbPool();
    console.log(`✅ Conectado a Microsoft SQL Server (${env.DB_HOST}:${env.DB_PORT} / ${env.DB_NAME})`);

    const app = createApp();
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 ShopCart Backend API ejecutándose en http://localhost:${env.PORT}`);
      console.log(`📘 Documentación de endpoints en http://localhost:${env.PORT}/api/docs`);
    });

    // Tarea periódica ligera cada 60s para marcar formalmente reservas de 15 min vencidas (RF-07)
    const cleanupTimer = setInterval(async () => {
      try {
        await catalogService.liberarReservasVencidas();
      } catch (err) {
        console.error('Error en limpieza automática de reservas vencidas:', err);
      }
    }, 60_000);
    cleanupTimer.unref();

    const shutdown = async () => {
      clearInterval(cleanupTimer);
      server.close(async () => {
        await closeDbPool();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

bootstrap();
