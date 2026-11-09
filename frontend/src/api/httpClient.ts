import { ApiEnvelope, AuthSession } from '../types/api.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const STORAGE_KEYS = {
  SESSION: 'shopcart_auth_session_v1',
  GUEST_TOKEN: 'shopcart_guest_token_v1',
} as const;

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const HttpError = ApiClientError;
export type HttpError = ApiClientError;

export function getOrCreateGuestToken(): string {
  let token = localStorage.getItem(STORAGE_KEYS.GUEST_TOKEN);
  if (!token) {
    token = `guest-${crypto.randomUUID()}`;
    localStorage.setItem(STORAGE_KEYS.GUEST_TOKEN, token);
  }
  return token;
}

export function resetGuestToken(): string {
  const token = `guest-${crypto.randomUUID()}`;
  localStorage.setItem(STORAGE_KEYS.GUEST_TOKEN, token);
  return token;
}

export function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    return null;
  }
}

export function setStoredSession(session: AuthSession | null): void {
  if (!session) {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  } else {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  }
  window.dispatchEvent(new CustomEvent('shopcart:auth-changed', { detail: session }));
}

/**
 * Renovación transparente del Access Token usando el Refresh Token rotativo (RF-01 y Pág. 9).
 * Si múltiples peticiones simultáneas reciben 401 al mismo tiempo, se encolan sobre
 * la misma promesa de refresh para no disparar la detección de reúso de token en BD.
 */
let refreshPromise: Promise<AuthSession | null> | null = null;

async function refreshAccessTokenSingleFlight(): Promise<AuthSession | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const current = getStoredSession();
  if (!current?.refreshToken) {
    return null;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });

      if (!response.ok) {
        setStoredSession(null);
        return null;
      }

      const json = (await response.json()) as ApiEnvelope<AuthSession>;
      if (json.ok && json.data) {
        setStoredSession(json.data);
        return json.data;
      }

      setStoredSession(null);
      return null;
    } catch {
      setStoredSession(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  skipAuthRefresh?: boolean;
}

export function buildApiUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${cleanPath}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val));
      }
    });
  }
  return url.pathname + url.search;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const url = buildApiUrl(path, options.query);
  const session = getStoredSession();
  const guestToken = getOrCreateGuestToken();

  const buildHeaders = (accessToken?: string): Record<string, string> => {
    const headers: Record<string, string> = {
      'X-Guest-Token': guestToken,
      ...(options.headers ?? {}),
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
  };

  let response = await fetch(url, {
    method,
    headers: buildHeaders(session?.accessToken),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // Renovación transparente ante 401 si existe un refreshToken activo
  if (
    response.status === 401 &&
    !options.skipAuthRefresh &&
    session?.refreshToken &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/register') &&
    !path.startsWith('/auth/refresh')
  ) {
    const refreshedSession = await refreshAccessTokenSingleFlight();
    if (refreshedSession?.accessToken) {
      response = await fetch(url, {
        method,
        headers: buildHeaders(refreshedSession.accessToken),
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    }
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        `Error de comunicación con el servidor (HTTP ${response.status}).`
      );
    }
  }

  if (!response.ok || !payload?.ok) {
    throw new ApiClientError(
      response.status,
      payload?.error?.message || `Error inesperado (HTTP ${response.status}).`,
      payload?.error?.code || 'HTTP_ERROR',
      payload?.error?.details
    );
  }

  return payload.data;
}
