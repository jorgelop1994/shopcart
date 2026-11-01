import sql, { ConnectionPool, ISqlType, IProcedureResult } from 'mssql';
import { env } from './env';

export interface StoredProcParam {
  name: string;
  type: ISqlType | (() => ISqlType);
  value: unknown;
}

const sqlConfig: sql.config = {
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: env.DB_ENCRYPT,
    trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
    enableArithAbort: true,
  },
};

let poolPromise: Promise<ConnectionPool> | null = null;

export async function getDbPool(): Promise<ConnectionPool> {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(sqlConfig);
    pool.on('error', (err) => {
      console.error('❌ Error en el pool de conexiones de SQL Server:', err);
      poolPromise = null;
    });
    poolPromise = pool.connect();
  }
  return poolPromise;
}

/**
 * Ejecuta exclusivamente un Stored Procedure en SQL Server usando parámetros tipados.
 * Cumple los requerimientos técnicos obligatorios:
 * - Cero ORM y cero consultas SQL en el backend.
 * - Prevención total de SQL Injection mediante request.input() tipado y request.execute().
 */
export async function executeStoredProcedure<T = Record<string, unknown>>(
  procedureName: string,
  params: StoredProcParam[] = []
): Promise<IProcedureResult<T>> {
  const normalizedName = procedureName.startsWith('dbo.')
    ? procedureName
    : `dbo.${procedureName}`;

  if (!/^dbo\.SP_[A-Za-z0-9_]+$/.test(normalizedName)) {
    throw new Error(
      `Violación de arquitectura: Solo se permite ejecutar Stored Procedures con prefijo SP_ (${normalizedName}).`
    );
  }

  const pool = await getDbPool();
  const request = pool.request();

  for (const param of params) {
    request.input(param.name, param.type, param.value);
  }

  return request.execute<T>(normalizedName);
}

export async function closeDbPool(): Promise<void> {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = null;
  }
}

export { sql };
