import { Response } from 'express';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const dashboardCache = new Map<string, CacheEntry<unknown>>();
const sseClients = new Set<Response>();

const CACHE_TTL_MS = 60_000; // 60 segundos de caché o hasta invalidación por evento

export function getCachedReport<T>(key: string): T | null {
  const entry = dashboardCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    dashboardCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedReport<T>(key: string, data: T): void {
  dashboardCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateDashboardCache(reason: string, payload?: unknown): void {
  dashboardCache.clear();
  broadcastDashboardEvent(reason, payload);
}

export function registerSseClient(res: Response): void {
  sseClients.add(res);
  res.on('close', () => {
    sseClients.delete(res);
  });
}

export function broadcastDashboardEvent(eventType: string, payload?: unknown): void {
  const message = JSON.stringify({
    eventType,
    timestamp: new Date().toISOString(),
    payload: payload ?? null,
  });

  for (const client of sseClients) {
    client.write(`event: dashboard_update\ndata: ${message}\n\n`);
  }
}
