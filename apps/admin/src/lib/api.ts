import { readAccessTokenFromCookieString } from './auth-token';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
  }

  return API_BASE_URL.replace(/\/+$/, '');
}

function toUrl(path: string): string {
  return `${getApiBaseUrl()}/${path.replace(/^\/+/, '')}`;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof FormData) &&
    !(value instanceof URLSearchParams) &&
    !(value instanceof Blob)
  );
}

function extractMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof (payload as { message?: unknown }).message === 'string'
  ) {
    return (payload as { message: string }).message;
  }

  return fallback;
}

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

type ApiRequestInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export async function api<T>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (!headers.has('Authorization')) {
    const cookieHeader = headers.get('Cookie');
    const serverToken = readAccessTokenFromCookieString(cookieHeader);
    const browserToken =
      typeof document !== 'undefined'
        ? readAccessTokenFromCookieString(document.cookie)
        : null;
    const accessToken = serverToken ?? browserToken;

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  let body: BodyInit | undefined;
  if (isJsonRecord(init.body) || Array.isArray(init.body)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.body);
  } else if (init.body !== undefined && init.body !== null) {
    body = init.body as BodyInit;
  }

  const response = await fetch(toUrl(path), {
    ...init,
    method: init.method ?? 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers,
    body,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  let payload: unknown;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      extractMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }

  return payload as T;
}
