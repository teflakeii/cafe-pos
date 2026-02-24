const POS_ACCESS_TOKEN_KEY = 'pos-access-token';

function normalizeStoredToken(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  let token = raw.trim();
  if (!token) {
    return null;
  }

  try {
    const parsed = JSON.parse(token) as unknown;
    if (typeof parsed === 'string') {
      token = parsed.trim();
    }
  } catch {
    // Keep raw value
  }

  if (/^Bearer\s+/i.test(token)) {
    token = token.replace(/^Bearer\s+/i, '').trim();
  }

  token = token.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '').trim();

  return token || null;
}

export function getPosAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = normalizeStoredToken(
    window.localStorage.getItem(POS_ACCESS_TOKEN_KEY),
  );

  if (!token) {
    return null;
  }

  return token;
}

export function hasPosAccessToken(): boolean {
  return getPosAccessToken() !== null;
}

export function setPosAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeStoredToken(token);
  if (!normalized) {
    return;
  }

  window.localStorage.setItem(POS_ACCESS_TOKEN_KEY, normalized);
  window.localStorage.setItem('accessToken', normalized);
}

export function clearPosAccessToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(POS_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem('accessToken');
}
