// Updated to provide a shared mobile API client that uses the env base URL and automatically attaches the stored auth token.
import { getAccessToken, getApiBaseUrl } from '../lib/auth';

type Primitive = string | number | boolean;
type QueryValue = Primitive | null | undefined;

export type ApiErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  } | string | null;
} | null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${getApiBaseUrl()}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value == null || value === '') {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

function getErrorMessage(payload: ApiErrorPayload, fallback: string) {
  if (typeof payload?.details === 'string' && payload.details) {
    return payload.details;
  }

  if (payload?.error && payload.error !== 'Validation failed') {
    return payload.error;
  }

  const formError = payload?.details && typeof payload.details !== 'string'
    ? payload.details.formErrors?.find(Boolean)
    : null;

  if (formError) {
    return formError;
  }

  const fieldError = payload?.details && typeof payload.details !== 'string' && payload.details.fieldErrors
    ? Object.values(payload.details.fieldErrors).flat().find(Boolean)
    : null;

  if (fieldError) {
    return fieldError;
  }

  if (payload?.error) {
    return payload.error;
  }

  return fallback;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, QueryValue>,
): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers ?? {});
  const hasBody = init.body != null;

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers,
  });

  const payload = (await response.json().catch(() => null)) as T | ApiErrorPayload;

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload as ApiErrorPayload, 'Request failed.'),
      response.status,
    );
  }

  return payload as T;
}

export async function apiTextRequest(
  path: string,
  init: RequestInit = {},
  query?: Record<string, QueryValue>,
): Promise<string> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers ?? {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers,
  });

  const body = await response.text();

  if (!response.ok) {
    let payload: ApiErrorPayload = null;

    try {
      payload = JSON.parse(body) as ApiErrorPayload;
    } catch {
      payload = body ? { error: body } : null;
    }

    throw new ApiError(
      getErrorMessage(payload, 'Request failed.'),
      response.status,
    );
  }

  return body;
}
