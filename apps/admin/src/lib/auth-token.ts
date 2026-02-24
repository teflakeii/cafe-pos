export const ADMIN_ACCESS_TOKEN_COOKIE = 'admin_access_token';

export function readAccessTokenFromCookieString(
  cookieHeader?: string | null,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName !== ADMIN_ACCESS_TOKEN_COOKIE) {
      continue;
    }

    const joined = rawValue.join('=');
    if (!joined) {
      return null;
    }

    try {
      return decodeURIComponent(joined);
    } catch {
      return joined;
    }
  }

  return null;
}
