const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('auth_token');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = (body && body.error) || res.statusText;
    throw new Error(error);
  }
  return res.json();
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
