import { executeStoredProcedure, sql } from '../config/database';
import { UserRole } from '../middlewares/authMiddleware';

export interface DbUserRecord {
  IDUsuario: number;
  IDRol: number;
  NombreRol: UserRole;
  NombreCompleto: string;
  Correo: string;
  PasswordHash?: string;
  Telefono: string | null;
  Activo: boolean;
  FechaCreacion: Date;
  FechaModificacion?: Date;
  TotalRegistros?: number;
}

export interface DbAddressRecord {
  IDDireccion: number;
  IDUsuario: number;
  Alias: string;
  NombreReceptor: string;
  TelefonoContacto: string;
  Departamento: string;
  Municipio: string;
  DireccionExacta: string;
  Referencias: string | null;
  EsPredeterminada: boolean;
  Activa: boolean;
  FechaCreacion: Date;
}

export class AuthRepository {
  async registrarCliente(data: {
    nombreCompleto: string;
    correo: string;
    passwordHash: string;
    telefono?: string | null;
  }): Promise<DbUserRecord> {
    const result = await executeStoredProcedure<DbUserRecord>('SP_Auth_RegistrarCliente', [
      { name: 'NombreCompleto', type: sql.NVarChar(150), value: data.nombreCompleto },
      { name: 'Correo', type: sql.NVarChar(150), value: data.correo },
      { name: 'PasswordHash', type: sql.NVarChar(255), value: data.passwordHash },
      { name: 'Telefono', type: sql.NVarChar(30), value: data.telefono ?? null },
    ]);
    return result.recordset[0];
  }

  async obtenerUsuarioPorCorreo(correo: string): Promise<DbUserRecord | null> {
    const result = await executeStoredProcedure<DbUserRecord>('SP_Auth_ObtenerUsuarioPorCorreo', [
      { name: 'Correo', type: sql.NVarChar(150), value: correo },
    ]);
    return result.recordset[0] ?? null;
  }

  async guardarRefreshToken(data: {
    idUsuario: number;
    tokenHash: string;
    familiaToken: string;
    fechaExpiracion: Date;
  }): Promise<void> {
    await executeStoredProcedure('SP_Auth_GuardarRefreshToken', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'TokenHash', type: sql.NVarChar(128), value: data.tokenHash },
      { name: 'FamiliaToken', type: sql.NVarChar(64), value: data.familiaToken },
      { name: 'FechaExpiracion', type: sql.DateTime2(3), value: data.fechaExpiracion },
    ]);
  }

  async rotarRefreshToken(data: {
    tokenHashActual: string;
    tokenHashNuevo: string;
    fechaExpiracionNueva: Date;
  }): Promise<{
    IDUsuario: number;
    NombreRol: UserRole;
    NombreCompleto: string;
    Correo: string;
    FamiliaToken: string;
    FechaExpiracion: Date;
  }> {
    const result = await executeStoredProcedure<{
      IDUsuario: number;
      NombreRol: UserRole;
      NombreCompleto: string;
      Correo: string;
      FamiliaToken: string;
      FechaExpiracion: Date;
    }>('SP_Auth_RotarRefreshToken', [
      { name: 'TokenHashActual', type: sql.NVarChar(128), value: data.tokenHashActual },
      { name: 'TokenHashNuevo', type: sql.NVarChar(128), value: data.tokenHashNuevo },
      { name: 'FechaExpiracionNueva', type: sql.DateTime2(3), value: data.fechaExpiracionNueva },
    ]);
    return result.recordset[0];
  }

  async revocarRefreshToken(data: {
    tokenHash?: string | null;
    idUsuario?: number | null;
    revocarTodas?: boolean;
  }): Promise<number> {
    const result = await executeStoredProcedure<{ TokensRevocados: number }>(
      'SP_Auth_RevocarRefreshToken',
      [
        { name: 'TokenHash', type: sql.NVarChar(128), value: data.tokenHash ?? null },
        { name: 'IDUsuario', type: sql.Int, value: data.idUsuario ?? null },
        { name: 'RevocarTodas', type: sql.Bit, value: data.revocarTodas ? 1 : 0 },
      ]
    );
    return result.recordset[0]?.TokensRevocados ?? 0;
  }

  async listarUsuarios(filters: {
    pagina: number;
    tamanoPagina: number;
    nombreRol?: string;
    activo?: boolean;
    busqueda?: string;
  }): Promise<DbUserRecord[]> {
    const result = await executeStoredProcedure<DbUserRecord>('SP_Usuarios_Listar', [
      { name: 'Pagina', type: sql.Int, value: filters.pagina },
      { name: 'TamanoPagina', type: sql.Int, value: filters.tamanoPagina },
      { name: 'NombreRol', type: sql.NVarChar(30), value: filters.nombreRol ?? null },
      {
        name: 'Activo',
        type: sql.Bit,
        value: typeof filters.activo === 'boolean' ? (filters.activo ? 1 : 0) : null,
      },
      { name: 'Busqueda', type: sql.NVarChar(100), value: filters.busqueda ?? null },
    ]);
    return result.recordset;
  }

  async obtenerUsuarioPorId(idUsuario: number): Promise<DbUserRecord> {
    const result = await executeStoredProcedure<DbUserRecord>('SP_Usuarios_ObtenerPorID', [
      { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    ]);
    return result.recordset[0];
  }

  async crearUsuarioInterno(data: {
    idUsuarioAdmin: number;
    nombreRol: UserRole;
    nombreCompleto: string;
    correo: string;
    passwordHash: string;
    telefono?: string | null;
  }): Promise<DbUserRecord> {
    const result = await executeStoredProcedure<DbUserRecord>('SP_Usuarios_CrearInterno', [
      { name: 'IDUsuarioAdmin', type: sql.Int, value: data.idUsuarioAdmin },
      { name: 'NombreRol', type: sql.NVarChar(30), value: data.nombreRol },
      { name: 'NombreCompleto', type: sql.NVarChar(150), value: data.nombreCompleto },
      { name: 'Correo', type: sql.NVarChar(150), value: data.correo },
      { name: 'PasswordHash', type: sql.NVarChar(255), value: data.passwordHash },
      { name: 'Telefono', type: sql.NVarChar(30), value: data.telefono ?? null },
    ]);
    return result.recordset[0];
  }

  async actualizarUsuario(data: {
    idUsuarioEjecutor: number;
    idUsuarioObjetivo: number;
    nombreCompleto: string;
    telefono?: string | null;
    nombreRol?: UserRole | null;
  }): Promise<DbUserRecord> {
    const result = await executeStoredProcedure<DbUserRecord>('SP_Usuarios_Actualizar', [
      { name: 'IDUsuarioEjecutor', type: sql.Int, value: data.idUsuarioEjecutor },
      { name: 'IDUsuarioObjetivo', type: sql.Int, value: data.idUsuarioObjetivo },
      { name: 'NombreCompleto', type: sql.NVarChar(150), value: data.nombreCompleto },
      { name: 'Telefono', type: sql.NVarChar(30), value: data.telefono ?? null },
      { name: 'NombreRol', type: sql.NVarChar(30), value: data.nombreRol ?? null },
    ]);
    return result.recordset[0];
  }

  async cambiarEstadoActivo(data: {
    idUsuarioEjecutor: number;
    idUsuarioObjetivo: number;
    activo: boolean;
  }): Promise<DbUserRecord> {
    const result = await executeStoredProcedure<DbUserRecord>('SP_Usuarios_CambiarEstadoActivo', [
      { name: 'IDUsuarioEjecutor', type: sql.Int, value: data.idUsuarioEjecutor },
      { name: 'IDUsuarioObjetivo', type: sql.Int, value: data.idUsuarioObjetivo },
      { name: 'Activo', type: sql.Bit, value: data.activo ? 1 : 0 },
    ]);
    return result.recordset[0];
  }

  async listarDireccionesPorCliente(idUsuario: number): Promise<DbAddressRecord[]> {
    const result = await executeStoredProcedure<DbAddressRecord>(
      'SP_Direcciones_ListarPorCliente',
      [{ name: 'IDUsuario', type: sql.Int, value: idUsuario }]
    );
    return result.recordset;
  }

  async obtenerDireccionPorId(idDireccion: number, idUsuario: number): Promise<DbAddressRecord> {
    const result = await executeStoredProcedure<DbAddressRecord>('SP_Direcciones_ObtenerPorID', [
      { name: 'IDDireccion', type: sql.Int, value: idDireccion },
      { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    ]);
    return result.recordset[0];
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
    const result = await executeStoredProcedure<DbAddressRecord>('SP_Direcciones_Crear', [
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'Alias', type: sql.NVarChar(50), value: data.alias },
      { name: 'NombreReceptor', type: sql.NVarChar(150), value: data.nombreReceptor },
      { name: 'TelefonoContacto', type: sql.NVarChar(30), value: data.telefonoContacto },
      { name: 'Departamento', type: sql.NVarChar(80), value: data.departamento },
      { name: 'Municipio', type: sql.NVarChar(80), value: data.municipio },
      { name: 'DireccionExacta', type: sql.NVarChar(300), value: data.direccionExacta },
      { name: 'Referencias', type: sql.NVarChar(250), value: data.referencias ?? null },
      { name: 'EsPredeterminada', type: sql.Bit, value: data.esPredeterminada ? 1 : 0 },
    ]);
    return result.recordset[0];
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
    const result = await executeStoredProcedure<DbAddressRecord>('SP_Direcciones_Actualizar', [
      { name: 'IDDireccion', type: sql.Int, value: data.idDireccion },
      { name: 'IDUsuario', type: sql.Int, value: data.idUsuario },
      { name: 'Alias', type: sql.NVarChar(50), value: data.alias },
      { name: 'NombreReceptor', type: sql.NVarChar(150), value: data.nombreReceptor },
      { name: 'TelefonoContacto', type: sql.NVarChar(30), value: data.telefonoContacto },
      { name: 'Departamento', type: sql.NVarChar(80), value: data.departamento },
      { name: 'Municipio', type: sql.NVarChar(80), value: data.municipio },
      { name: 'DireccionExacta', type: sql.NVarChar(300), value: data.direccionExacta },
      { name: 'Referencias', type: sql.NVarChar(250), value: data.referencias ?? null },
      { name: 'EsPredeterminada', type: sql.Bit, value: data.esPredeterminada ? 1 : 0 },
    ]);
    return result.recordset[0];
  }

  async eliminarDireccion(idDireccion: number, idUsuario: number): Promise<void> {
    await executeStoredProcedure('SP_Direcciones_Eliminar', [
      { name: 'IDDireccion', type: sql.Int, value: idDireccion },
      { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    ]);
  }
}

export const authRepository = new AuthRepository();
