import { Platform } from 'react-native';

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

const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

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
