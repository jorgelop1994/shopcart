import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

interface SqlErrorLike {
  number?: number;
  message?: string;
  procName?: string;
}

function mapSqlErrorToHttp(sqlNumber: number): { statusCode: number; code: string } {
  switch (sqlNumber) {
    case 50001:
      return { statusCode: 400, code: 'VALIDATION_ERROR' };
    case 50002:
      return { statusCode: 404, code: 'RESOURCE_NOT_FOUND' };
    case 50003:
      return { statusCode: 409, code: 'DUPLICATE_RESOURCE' };
    case 50004:
      return { statusCode: 403, code: 'FORBIDDEN_RESOURCE_OWNERSHIP' };
    case 50010:
      return { statusCode: 401, code: 'UNAUTHORIZED_CREDENTIALS_OR_TOKEN' };
    case 50011:
      return { statusCode: 401, code: 'REFRESH_TOKEN_REUSE_DETECTED' };
    case 50020:
      return { statusCode: 422, code: 'INVALID_INVENTORY_ADJUSTMENT' };
    case 50021:
      return { statusCode: 409, code: 'INSUFFICIENT_STOCK' };
    case 50022:
      return { statusCode: 409, code: 'RESERVATION_EXPIRED' };
    case 50030:
      return { statusCode: 422, code: 'COUPON_NOT_FOUND_OR_INACTIVE' };
    case 50031:
      return { statusCode: 422, code: 'COUPON_EXPIRED_OR_NOT_STARTED' };
    case 50032:
      return { statusCode: 422, code: 'COUPON_USAGE_LIMIT_REACHED' };
    case 50033:
      return { statusCode: 422, code: 'COUPON_CLIENT_LIMIT_REACHED' };
    case 50034:
      return { statusCode: 422, code: 'COUPON_MINIMUM_OR_CATEGORY_NOT_MET' };
    case 50040:
      return { statusCode: 422, code: 'INVALID_ORDER_STATE_TRANSITION' };
    case 50041:
      return { statusCode: 422, code: 'INVALID_RETURN_QUANTITY' };
    case 50099:
      return { statusCode: 403, code: 'IMMUTABLE_AUDIT_RECORD' };
    default:
      return { statusCode: 400, code: `SQL_BUSINESS_ERROR_${sqlNumber}` };
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      ok: false,
      error: {
        code: 'SCHEMA_VALIDATION_ERROR',
        message: fieldErrors[0]?.message ?? 'Datos de entrada inválidos.',
        details: fieldErrors,
      },
    });
    return;
  }

  const sqlErr = err as SqlErrorLike;
  if (typeof sqlErr?.number === 'number' && sqlErr.number >= 50000 && sqlErr.number <= 50099) {
    const mapped = mapSqlErrorToHttp(sqlErr.number);
    res.status(mapped.statusCode).json({
      ok: false,
      error: {
        code: mapped.code,
        message: sqlErr.message ?? 'Error de regla de negocio en base de datos.',
        details: { sqlErrorCode: sqlErr.number, procedure: sqlErr.procName ?? null },
      },
    });
    return;
  }

  if (err instanceof Error && (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError')) {
    res.status(401).json({
      ok: false,
      error: {
        code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message:
          err.name === 'TokenExpiredError'
            ? 'El token de acceso ha expirado.'
            : 'El token de acceso es inválido.',
        details: null,
      },
    });
    return;
  }

  console.error('❌ Error no controlado en el servidor:', err);
  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error interno al procesar la solicitud.',
      details: null,
    },
  });
}
