type Primitive = string | number | boolean;
type QueryValue = Primitive | null | undefined;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN_KEY = 'traces.web.token';

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function getErrorMessage(payload: unknown) {
  if (payload && typeof payload === 'object') {
    const error = 'error' in payload ? payload.error : undefined;
    const details = 'details' in payload ? payload.details : undefined;
    if (typeof details === 'string') return details;
    if (typeof error === 'string') return error;
  }
  return 'Request failed.';
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, QueryValue>,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const token = getAccessToken();
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, query), { ...init, headers });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload), response.status);
  }

  return payload as T;
}
