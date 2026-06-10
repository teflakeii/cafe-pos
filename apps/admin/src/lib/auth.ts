import { api } from './api';
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  readAccessTokenFromCookieString,
} from './auth-token';
import type { Session } from '@/types/auth';

type LoginInput = {
  email: string;
  password: string;
};

type LoginResponse = {
  accessToken: string;
};

type MeResponse = {
  id: number;
  email: string;
  role: Session['user']['role'];
  active?: boolean;
};

const ACCESS_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

function writeAccessTokenCookie(token: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie =
    `${ADMIN_ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ` +
    `Path=/; Max-Age=${ACCESS_TOKEN_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function clearAccessTokenCookie(): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie =
    `${ADMIN_ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readAccessTokenFromCookieHeader(
  cookieHeader?: string | null,
): string | null {
  return readAccessTokenFromCookieString(cookieHeader);
}

export async function login(input: LoginInput) {
  const result = await api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input,
  });

  writeAccessTokenCookie(result.accessToken);

  return result;
}

export async function logout(extraHeaders?: HeadersInit) {
  try {
    await api<void>('/auth/logout', {
      method: 'POST',
      headers: extraHeaders,
    });
  } finally {
    clearAccessTokenCookie();
  }
}

export async function me(extraHeaders?: HeadersInit): Promise<Session> {
  const payload = await api<MeResponse>('/auth/me', {
    method: 'GET',
    headers: extraHeaders,
  });

  return {
    user: {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      active: payload.active,
    },
  };
}
