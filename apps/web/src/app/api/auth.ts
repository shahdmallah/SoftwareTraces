import { apiRequest, setAccessToken } from './client';

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

export async function login(email: string, password: string) {
  const response = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(response.token);
  return response.user;
}

export async function signup(fullName: string, email: string, password: string) {
  await apiRequest<AuthUser>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ full_name: fullName, email, password }),
  });
  return login(email, password);
}

export async function getMe() {
  const response = await apiRequest<{ user: AuthUser }>('/api/auth/me');
  return response.user;
}

export function logout() {
  setAccessToken(null);
}
