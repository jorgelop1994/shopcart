import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { authRepository, DbUserRecord, DbAddressRecord } from '../repositories/auth.repository';
import { executeStoredProcedure, sql } from '../config/database';
import { AppError } from '../utils/AppError';
import { AuthenticatedUser, UserRole } from '../middlewares/authMiddleware';

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: {
    idUsuario: number;
    nombreCompleto: string;
    correo: string;
    rol: UserRole;
    telefono: string | null;
  };
}

function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateAccessToken(user: AuthenticatedUser): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(
    {
      idUsuario: user.idUsuario,
      rol: user.rol,
      correo: user.correo,
      nombreCompleto: user.nombreCompleto,
    },
    env.JWT_ACCESS_SECRET,
    options
  );
}

function generateRawRefreshToken(idUsuario: number, familiaToken: string): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  return jwt.sign(
    {
      idUsuario,
      familiaToken,
      nonce,
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: `${env.JWT_REFRESH_EXPIRES_DAYS}d` }
  );
}

export class AuthService {
  async registrarCliente(data: {
    nombreCompleto: string;
    correo: string;
    password: string;
    telefono?: string | null;
    tokenInvitado?: string | null;
  }): Promise<AuthTokensResponse> {
    const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);
    const createdUser = await authRepository.registrarCliente({
      nombreCompleto: data.nombreCompleto,
      correo: data.correo,
      passwordHash,
      telefono: data.telefono ?? null,
    });

    if (data.tokenInvitado) {
      await executeStoredProcedure('SP_Carrito_FusionarInvitado', [
        { name: 'IDUsuario', type: sql.Int, value: createdUser.IDUsuario },
        { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado },
      ]);
    }

    return this.emitirSesion(createdUser);
  }

  async iniciarSesion(data: {
    correo: string;
    password: string;
    tokenInvitado?: string | null;
  }): Promise<AuthTokensResponse> {
    const user = await authRepository.obtenerUsuarioPorCorreo(data.correo);

    if (!user || !user.PasswordHash) {
      throw new AppError(401, 'Credenciales inválidas: correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
    }

    if (!user.Activo) {
      throw new AppError(
        401,
        'Su cuenta se encuentra desactivada. Contacte al administrador.',
        'USER_INACTIVE'
      );
    }

    const passwordValida = await bcrypt.compare(data.password, user.PasswordHash);
    if (!passwordValida) {
      throw new AppError(401, 'Credenciales inválidas: correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
    }

    if (data.tokenInvitado && user.NombreRol === 'Cliente') {
      await executeStoredProcedure('SP_Carrito_FusionarInvitado', [
        { name: 'IDUsuario', type: sql.Int, value: user.IDUsuario },
        { name: 'TokenInvitado', type: sql.NVarChar(100), value: data.tokenInvitado },
      ]);
    }

    return this.emitirSesion(user);
  }

  async rotarRefreshToken(rawRefreshToken: string): Promise<AuthTokensResponse> {
    try {
      jwt.verify(rawRefreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError(
        401,
        'El refresh token es inválido o ha expirado.',
        'INVALID_REFRESH_TOKEN'
      );
    }

    const tokenHashActual = hashRefreshToken(rawRefreshToken);
    const decoded = jwt.decode(rawRefreshToken) as { idUsuario: number; familiaToken: string } | null;
    const familiaToken = decoded?.familiaToken ?? crypto.randomUUID();
    const idUsuario = decoded?.idUsuario ?? 0;

    const nuevoRefreshToken = generateRawRefreshToken(idUsuario, familiaToken);
    const tokenHashNuevo = hashRefreshToken(nuevoRefreshToken);
    const fechaExpiracionNueva = new Date(
      Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    const rotated = await authRepository.rotarRefreshToken({
      tokenHashActual,
      tokenHashNuevo,
      fechaExpiracionNueva,
    });

    const accessToken = generateAccessToken({
      idUsuario: rotated.IDUsuario,
      rol: rotated.NombreRol,
      correo: rotated.Correo,
      nombreCompleto: rotated.NombreCompleto,
    });

    return {
      accessToken,
      refreshToken: nuevoRefreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      user: {
        idUsuario: rotated.IDUsuario,
        nombreCompleto: rotated.NombreCompleto,
        correo: rotated.Correo,
        rol: rotated.NombreRol,
        telefono: null,
      },
    };
  }

  async cerrarSesion(data: {
    refreshToken?: string | null;
    idUsuario?: number | null;
    revocarTodas?: boolean;
  }): Promise<{ tokensRevocados: number }> {
    const tokenHash = data.refreshToken ? hashRefreshToken(data.refreshToken) : null;
    const tokensRevocados = await authRepository.revocarRefreshToken({
      tokenHash,
      idUsuario: data.idUsuario ?? null,
      revocarTodas: data.revocarTodas ?? false,
    });
    return { tokensRevocados };
  }

  async listarUsuarios(filters: {
    pagina: number;
    tamanoPagina: number;
    nombreRol?: string;
    activo?: boolean;
    busqueda?: string;
  }) {
    const rows = await authRepository.listarUsuarios(filters);
    const totalRegistros = rows[0]?.TotalRegistros ?? 0;
    return {
      items: rows.map(({ TotalRegistros, PasswordHash, ...rest }) => rest),
      pagination: {
        pagina: filters.pagina,
        tamanoPagina: filters.tamanoPagina,
        totalRegistros,
        totalPaginas: Math.ceil(totalRegistros / filters.tamanoPagina) || 1,
      },
    };
  }

  async obtenerPerfil(idUsuario: number) {
    const user = await authRepository.obtenerUsuarioPorId(idUsuario);
    const { PasswordHash, ...safeUser } = user;
    return safeUser;
  }

  async crearUsuarioInterno(data: {
    idUsuarioAdmin: number;
    nombreRol: UserRole;
    nombreCompleto: string;
    correo: string;
    password: string;
    telefono?: string | null;
  }) {
    const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);
    return authRepository.crearUsuarioInterno({
      idUsuarioAdmin: data.idUsuarioAdmin,
      nombreRol: data.nombreRol,
      nombreCompleto: data.nombreCompleto,
      correo: data.correo,
      passwordHash,
      telefono: data.telefono ?? null,
    });
  }

  async actualizarUsuario(data: {
    idUsuarioEjecutor: number;
    idUsuarioObjetivo: number;
    nombreCompleto: string;
    telefono?: string | null;
    nombreRol?: UserRole | null;
  }) {
    return authRepository.actualizarUsuario(data);
  }

  async cambiarEstadoUsuario(data: {
    idUsuarioEjecutor: number;
    idUsuarioObjetivo: number;
    activo: boolean;
  }) {
    return authRepository.cambiarEstadoActivo(data);
  }

  async listarDirecciones(idUsuario: number): Promise<DbAddressRecord[]> {
    return authRepository.listarDireccionesPorCliente(idUsuario);
  }

  async obtenerDireccion(idDireccion: number, idUsuario: number): Promise<DbAddressRecord> {
    return authRepository.obtenerDireccionPorId(idDireccion, idUsuario);
  }

  async crearDireccion(data: {
    idUsuario: number;
    alias: string;
    nombreReceptor: string;
    telefonoContacto: string;
    departamento: string;
    municipio: string;
    direccionExacta: string;
    referencias?: string | null;
    esPredeterminada?: boolean;
  }): Promise<DbAddressRecord> {
    return authRepository.crearDireccion(data);
  }

  async actualizarDireccion(data: {
    idDireccion: number;
    idUsuario: number;
    alias: string;
    nombreReceptor: string;
    telefonoContacto: string;
    departamento: string;
    municipio: string;
    direccionExacta: string;
    referencias?: string | null;
    esPredeterminada?: boolean;
  }): Promise<DbAddressRecord> {
    return authRepository.actualizarDireccion(data);
  }

  async eliminarDireccion(idDireccion: number, idUsuario: number): Promise<void> {
    await authRepository.eliminarDireccion(idDireccion, idUsuario);
  }

  private async emitirSesion(user: DbUserRecord): Promise<AuthTokensResponse> {
    const familiaToken = crypto.randomUUID();
    const rawRefreshToken = generateRawRefreshToken(user.IDUsuario, familiaToken);
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const fechaExpiracion = new Date(
      Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    await authRepository.guardarRefreshToken({
      idUsuario: user.IDUsuario,
      tokenHash,
      familiaToken,
      fechaExpiracion,
    });

    const accessToken = generateAccessToken({
      idUsuario: user.IDUsuario,
      rol: user.NombreRol,
      correo: user.Correo,
      nombreCompleto: user.NombreCompleto,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      user: {
        idUsuario: user.IDUsuario,
        nombreCompleto: user.NombreCompleto,
        correo: user.Correo,
        rol: user.NombreRol,
        telefono: user.Telefono ?? null,
      },
    };
  }
}

export const authService = new AuthService();
