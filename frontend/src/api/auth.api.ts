import {
  apiRequest,
  getOrCreateGuestToken,
  resetGuestToken,
  setStoredSession,
  getStoredSession,
} from './httpClient';
import {
  AddressRecord,
  AuthSession,
  AuthUser,
  PaginatedResult,
  UserRecord,
  UserRole,
} from '../types/api.types';

interface RawAddressRecord extends Partial<AddressRecord> {
  IDDireccion: number;
  IDUsuario: number;
  Alias: string;
  NombreReceptor?: string;
  NombreDestinatario?: string;
  TelefonoContacto: string;
  Departamento: string;
  Municipio: string;
  ZonaOCodigoPostal?: string | null;
  DireccionExacta: string;
  Referencias?: string | null;
  Referencia?: string | null;
  EsPredeterminada: boolean;
  Activa: boolean;
  FechaCreacion: string;
}

function normalizeAddress(raw: RawAddressRecord): AddressRecord {
  return {
    IDDireccion: raw.IDDireccion,
    IDUsuario: raw.IDUsuario,
    Alias: raw.Alias,
    NombreDestinatario: raw.NombreDestinatario ?? raw.NombreReceptor ?? '',
    TelefonoContacto: raw.TelefonoContacto,
    Departamento: raw.Departamento,
    Municipio: raw.Municipio,
    ZonaOCodigoPostal: raw.ZonaOCodigoPostal ?? null,
    DireccionExacta: raw.DireccionExacta,
    Referencia: raw.Referencia ?? raw.Referencias ?? null,
    EsPredeterminada: Boolean(raw.EsPredeterminada),
    Activa: Boolean(raw.Activa),
    FechaCreacion: raw.FechaCreacion,
  };
}

export const authApi = {
  async login(correo: string, password: string): Promise<AuthSession> {
    const tokenInvitado = getOrCreateGuestToken();
    const session = await apiRequest<AuthSession>('/auth/login', {
      method: 'POST',
      body: { correo, password, tokenInvitado },
      skipAuthRefresh: true,
    });
    setStoredSession(session);
    if (session.user.rol === 'Cliente') {
      resetGuestToken();
    }
    return session;
  },

  async register(data: {
    nombreCompleto: string;
    correo: string;
    password: string;
    telefono?: string;
  }): Promise<AuthSession> {
    const tokenInvitado = getOrCreateGuestToken();
    const session = await apiRequest<AuthSession>('/auth/register', {
      method: 'POST',
      body: { ...data, tokenInvitado },
      skipAuthRefresh: true,
    });
    setStoredSession(session);
    resetGuestToken();
    return session;
  },

  async logout(): Promise<void> {
    const current = getStoredSession();
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: { refreshToken: current?.refreshToken ?? null, revocarTodas: false },
        skipAuthRefresh: true,
      });
    } finally {
      setStoredSession(null);
    }
  },

  async getMe(): Promise<AuthUser> {
    const user = await apiRequest<{
      IDUsuario: number;
      NombreCompleto: string;
      Correo: string;
      NombreRol: UserRole;
      Telefono: string | null;
    }>('/auth/me');
    return {
      idUsuario: user.IDUsuario,
      nombreCompleto: user.NombreCompleto,
      correo: user.Correo,
      rol: user.NombreRol,
      telefono: user.Telefono,
    };
  },

  // --- Administración de Usuarios (RF-01 Admin) ---
  async listUsers(params: {
    pagina?: number;
    tamanoPagina?: number;
    rol?: string;
    activo?: boolean;
    busqueda?: string;
    ordenarPor?: string;
  }): Promise<PaginatedResult<UserRecord>> {
    return apiRequest<PaginatedResult<UserRecord>>('/users', { query: params });
  },

  async createInternalUser(data: {
    rol?: UserRole;
    nombreRol?: UserRole;
    nombreCompleto: string;
    correo: string;
    password: string;
    telefono?: string | null;
  }): Promise<UserRecord> {
    return apiRequest<UserRecord>('/users', {
      method: 'POST',
      body: {
        rol: data.rol ?? data.nombreRol ?? 'Operador',
        nombreCompleto: data.nombreCompleto,
        correo: data.correo,
        password: data.password,
        telefono: data.telefono ?? null,
      },
    });
  },

  async updateUser(
    idUsuario: number,
    data: {
      nombreCompleto: string;
      telefono?: string | null;
      rol?: UserRole;
      nombreRol?: UserRole;
      activo?: boolean;
    }
  ): Promise<UserRecord> {
    let updated = await apiRequest<UserRecord>(`/users/${idUsuario}`, {
      method: 'PUT',
      body: {
        nombreCompleto: data.nombreCompleto,
        telefono: data.telefono ?? null,
        rol: data.rol ?? data.nombreRol,
      },
    });
    if (data.activo !== undefined && updated.Activo !== data.activo) {
      updated = await this.toggleUserActive(idUsuario, data.activo);
    }
    return updated;
  },

  async toggleUserActive(idUsuario: number, activo: boolean): Promise<UserRecord> {
    return apiRequest<UserRecord>(`/users/${idUsuario}/status`, {
      method: 'PATCH',
      body: { activo },
    });
  },

  // --- Direcciones de Entrega (RF-01 Cliente) ---
  async listAddresses(): Promise<AddressRecord[]> {
    const rawList = await apiRequest<RawAddressRecord[]>('/addresses');
    return rawList.map(normalizeAddress);
  },

  async createAddress(data: {
    alias: string;
    nombreDestinatario: string;
    telefonoContacto: string;
    departamento: string;
    municipio: string;
    zonaOCodigoPostal?: string | null;
    direccionExacta: string;
    referencia?: string | null;
    esPredeterminada?: boolean;
  }): Promise<AddressRecord> {
    const raw = await apiRequest<RawAddressRecord>('/addresses', {
      method: 'POST',
      body: {
        alias: data.alias,
        nombreReceptor: data.nombreDestinatario,
        telefonoContacto: data.telefonoContacto,
        departamento: data.departamento,
        municipio: data.municipio,
        direccionExacta: data.zonaOCodigoPostal
          ? `${data.direccionExacta} (${data.zonaOCodigoPostal})`
          : data.direccionExacta,
        referencias: data.referencia ?? null,
        esPredeterminada: Boolean(data.esPredeterminada),
      },
    });
    return normalizeAddress(raw);
  },

  async updateAddress(
    idDireccion: number,
    data: {
      alias: string;
      nombreDestinatario: string;
      telefonoContacto: string;
      departamento: string;
      municipio: string;
      zonaOCodigoPostal?: string | null;
      direccionExacta: string;
      referencia?: string | null;
      esPredeterminada?: boolean;
    }
  ): Promise<AddressRecord> {
    const raw = await apiRequest<RawAddressRecord>(`/addresses/${idDireccion}`, {
      method: 'PUT',
      body: {
        alias: data.alias,
        nombreReceptor: data.nombreDestinatario,
        telefonoContacto: data.telefonoContacto,
        departamento: data.departamento,
        municipio: data.municipio,
        direccionExacta: data.zonaOCodigoPostal
          ? `${data.direccionExacta} (${data.zonaOCodigoPostal})`
          : data.direccionExacta,
        referencias: data.referencia ?? null,
        esPredeterminada: Boolean(data.esPredeterminada),
      },
    });
    return normalizeAddress(raw);
  },

  async deleteAddress(idDireccion: number): Promise<void> {
    await apiRequest(`/addresses/${idDireccion}`, { method: 'DELETE' });
  },
};
