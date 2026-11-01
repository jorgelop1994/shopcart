import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno desde la raíz del proyecto o carpeta backend
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_USER: z.string().min(1).default('sa'),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1).default('ShopCartDB'),
  DB_ENCRYPT: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  DB_TRUST_SERVER_CERTIFICATE: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(14).default(10),

  CHECKOUT_RESERVATION_MINUTES: z.coerce.number().int().positive().default(15),
  ABANDONED_CART_THRESHOLD_MINUTES: z.coerce.number().int().positive().default(120),
  IVA_PERCENTAGE: z.coerce.number().positive().default(12.0),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Error en la configuración de variables de entorno:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
