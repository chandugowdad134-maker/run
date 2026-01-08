import { Capacitor } from '@capacitor/core';
import { db } from './db';

// Use environment variable for API URL, but allow mobile build override
const MOBILE_DEV_IP = 'http://192.168.0.117:4000';
const rawApiUrl = import.meta.env.VITE_API_URL;
const mobileApiUrl = import.meta.env.VITE_MOBILE_API_URL;
const isMobileBuildFlag = import.meta.env.VITE_MOBILE_BUILD === true || import.meta.env.VITE_MOBILE_BUILD === 'true';
const isNativePlatform = Capacitor?.isNativePlatform?.() ?? (Capacitor.getPlatform?.() !== 'web');
const isMobileRuntime = isMobileBuildFlag || isNativePlatform;

const isLocalhostUrl = (url: string) => /localhost|127\.0\.0\.1|::1/.test(url);

// On mobile/native, never use localhost; fall back to a LAN/explicit mobile URL.
let API_URL: string;
if (isMobileRuntime) {
  if (rawApiUrl && !isLocalhostUrl(rawApiUrl)) {
    API_URL = rawApiUrl;
  } else if (mobileApiUrl) {
    API_URL = mobileApiUrl;
  } else {
    API_URL = MOBILE_DEV_IP;
  }
} else {
  API_URL = rawApiUrl || 'http://localhost:4000';
}

function getToken() {
  return localStorage.getItem('auth_token');
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function getApiErrorMessage(err: unknown, fallback: string) {
  if (isApiError(err)) return err.message || fallback;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message || fallback;
  }
  return fallback;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  try {
    const token = getToken();
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

    if (!res.ok) {
      const message =
        (body && typeof body === 'object' && 'error' in body && typeof (body as any).error === 'string'
          ? (body as any).error
          : res.statusText) ||
        'Request failed';
      throw new ApiError(message, res.status, body);
    }

    return body;
  } catch (err: any) {
    // fetch() network errors are typically TypeError; normalize to ApiError for consistent UI
    if (isApiError(err)) throw err;
    throw new ApiError(err?.message || 'Network error', 0, undefined);
  }
}

// Lightweight API helper to mirror axios-style calls used in pages
export const api = {
  get: (path: string) => apiFetch(path, { method: 'GET' }),
  post: (path: string, body?: unknown) =>
    apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) =>
    apiFetch(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) =>
    apiFetch(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => apiFetch(path, { method: 'DELETE' }),
};

export function setToken(token: string | null) {
  if (!token) {
    localStorage.removeItem('auth_token');
  } else {
    localStorage.setItem('auth_token', token);
  }
}

// Sync pending runs to server
export async function syncRuns(): Promise<{ synced: number; errors: number }> {
  const pendingRuns = await db.syncQueue.where('type').equals('run').sortBy('timestamp');
  if (pendingRuns.length === 0) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  // Group by user or send all at once
  const runsData = pendingRuns.map(item => item.data);

  try {
    await api.post('/runs/sync', { runs: runsData });
    // On success, mark as synced and remove from queue
    for (const item of pendingRuns) {
      await db.syncQueue.delete(item.id!);
      // Also mark run as synced
      if (item.data.runId) {
        await db.runs.update(item.data.runId, { synced: true });
      }
    }
    synced = pendingRuns.length;
  } catch (err) {
    console.error('Sync failed:', err);
    errors = pendingRuns.length;
  }

  return { synced, errors };
}
