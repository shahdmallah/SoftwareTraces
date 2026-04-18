export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

type SignupPayload = {
  email: string;
  password: string;
  full_name: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type ErrorPayload = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
} | null;

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const AUTH_STORAGE_KEY = 'traces.auth';

function getErrorMessage(payload: ErrorPayload): string {
  if (payload?.error && payload.error !== 'Validation failed') {
    return payload.error;
  }

  const formError = payload?.details?.formErrors?.find(Boolean);
  if (formError) {
    return formError;
  }

  const fieldError = payload?.details?.fieldErrors
    ? Object.values(payload.details.fieldErrors).flat().find(Boolean)
    : null;

  if (fieldError) {
    return fieldError;
  }

  if (payload?.error) {
    return payload.error;
  }

  return 'Authentication request failed.';
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as ErrorPayload;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
}

export async function signup(payload: SignupPayload): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function persistSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
