import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export type UserRole = 'Cliente' | 'Operador' | 'Administrador';

export interface AuthenticatedUser {
  idUsuario: number;
  rol: UserRole;
  correo: string;
  nombreCompleto: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticateJWT(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(
      new AppError(
        401,
        'Autenticación requerida: debe enviar un Bearer token válido.',
        'MISSING_AUTH_TOKEN'
      )
    );
    return;
  }

  const token = authHeader.slice(7).trim();

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthenticatedUser & jwt.JwtPayload;
    req.user = {
      idUsuario: Number(payload.idUsuario),
      rol: payload.rol,
      correo: payload.correo,
      nombreCompleto: payload.nombreCompleto,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuthenticateJWT(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7).trim();

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthenticatedUser & jwt.JwtPayload;
    req.user = {
      idUsuario: Number(payload.idUsuario),
      rol: payload.rol,
      correo: payload.correo,
      nombreCompleto: payload.nombreCompleto,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Autenticación requerida.', 'UNAUTHORIZED'));
      return;
    }

    if (!allowedRoles.includes(req.user.rol)) {
      next(
        new AppError(
          403,
          `Acceso denegado: se requiere rol [${allowedRoles.join(', ')}] para realizar esta operación.`,
          'FORBIDDEN_ROLE'
        )
      );
      return;
    }

    next();
  };
}
