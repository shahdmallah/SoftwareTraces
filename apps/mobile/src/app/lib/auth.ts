// Updated to share API base URL logic and store auth sessions securely for automatic mobile API authentication.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

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
  android: 'http://10.0.2.2:3001',
  default: 'http://localhost:3001',
});

const DEFAULT_API_PORT = '3001';

function getExpoExtraApiUrl() {
  const candidates = [
    {
      source: 'expoConfig.extra.apiUrl',
      value: Constants.expoConfig?.extra?.apiUrl,
    },
    {
      source: 'manifest.extra.apiUrl',
      value: (Constants.manifest as { extra?: { apiUrl?: unknown } } | null)?.extra?.apiUrl,
    },
    {
      source: 'manifest2.extra.apiUrl',
      value: (
        Constants.manifest2 as { extra?: { apiUrl?: unknown } } | null
      )?.extra?.apiUrl,
    },
    {
      source: 'manifest2.extra.expoClient.extra.apiUrl',
      value: (
        Constants.manifest2 as {
          extra?: { expoClient?: { extra?: { apiUrl?: unknown } } };
        } | null
      )?.extra?.expoClient?.extra?.apiUrl,
    },
    {
      source: 'process.env.EXPO_PUBLIC_API_URL',
      value: process.env.EXPO_PUBLIC_API_URL,
    },
  ];

  const resolved = candidates.find(
    (candidate) => typeof candidate.value === 'string' && candidate.value.trim().length > 0,
  );

  if (__DEV__) {
    console.log(
      '[auth] API URL candidates:',
      candidates.map((candidate) => ({
        source: candidate.source,
        value: typeof candidate.value === 'string' ? candidate.value : null,
      })),
    );
  }

  return typeof resolved?.value === 'string' ? resolved.value.trim() : '';
}

function getExpoExtraApiPort() {
  const candidates = [
    Constants.expoConfig?.extra?.apiPort,
    (Constants.manifest as { extra?: { apiPort?: unknown } } | null)?.extra?.apiPort,
    (Constants.manifest2 as { extra?: { apiPort?: unknown } } | null)?.extra?.apiPort,
    (
      Constants.manifest2 as {
        extra?: { expoClient?: { extra?: { apiPort?: unknown } } };
      } | null
    )?.extra?.expoClient?.extra?.apiPort,
    process.env.EXPO_PUBLIC_API_PORT,
  ];

  const resolved = candidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  );

  return typeof resolved === 'string' ? resolved.trim() : DEFAULT_API_PORT;
}

function getHostFromUrl(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

function getExpoDevHost() {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants.expoGoConfig as { debuggerHost?: string; hostUri?: string } | null)?.debuggerHost,
    (Constants.expoGoConfig as { debuggerHost?: string; hostUri?: string } | null)?.hostUri,
    Constants.linkingUri,
    (Constants.manifest as { debuggerHost?: string; hostUri?: string } | null)?.debuggerHost,
    (Constants.manifest as { debuggerHost?: string; hostUri?: string } | null)?.hostUri,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      continue;
    }

    const directHost = getHostFromUrl(candidate);
    if (directHost) {
      return directHost;
    }

    const hostWithPort = candidate.replace(/^[^:]+:\/\//, '').split('/')[0];
    const host = hostWithPort.split(':')[0]?.trim();
    if (host) {
      return host;
    }
  }

  return '';
}

function getAutoDetectedApiUrl() {
  const host = getExpoDevHost();

  if (!host) {
    return '';
  }

  const protocol = host === 'localhost' || host === '127.0.0.1' ? 'http' : 'http';
  return `${protocol}://${host}:${getExpoExtraApiPort()}`;
}

const EXPLICIT_API_URL = getExpoExtraApiUrl() || process.env.EXPO_PUBLIC_API_URL?.trim();
const AUTO_DETECTED_API_URL = getAutoDetectedApiUrl();
const API_BASE_URL = (EXPLICIT_API_URL || AUTO_DETECTED_API_URL || DEFAULT_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const IS_USING_FALLBACK_API_URL = !EXPLICIT_API_URL;
const AUTH_SESSION_KEY = 'traces.auth.session';

if (__DEV__ && IS_USING_FALLBACK_API_URL) {
  console.warn(
    `[auth] EXPO_PUBLIC_API_URL is not set. Using ${API_BASE_URL}. ` +
      'This is auto-detected from the Expo dev host when available.',
  );
}

if (__DEV__) {
  console.log(`[auth] API base URL: ${API_BASE_URL}`);
}

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
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      const hint = IS_USING_FALLBACK_API_URL
        ? `If auto-detection misses, set EXPO_PUBLIC_API_URL manually, for example http://192.168.1.X:${getExpoExtraApiPort()}.`
        : 'Check that the API is running and reachable from this device.';

      throw new Error(`Couldn't reach ${getApiBaseUrl()}. ${hint}`);
    }

    throw error;
  }

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

export async function refresh(refreshToken: string): Promise<{ token: string }> {
  return request<{ token: string }>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function logout(): Promise<void> {
  await request<void>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function me(): Promise<{ user: AuthUser }> {
  const token = await getAccessToken();

  return request<{ user: AuthUser }>('/api/auth/me', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function persistSession(session: AuthSession | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    return;
  }

  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function getStoredSession(): Promise<AuthSession | null> {
  const rawValue = await SecureStore.getItemAsync(AUTH_SESSION_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthSession;
  } catch {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    return null;
  }
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}

export async function getAccessToken() {
  const session = await getStoredSession();
  return session?.token ?? null;
}
