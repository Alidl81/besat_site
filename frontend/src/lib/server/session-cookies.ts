import "server-only";

export const sessionCookieNames = {
  access: 'besat_access',
  refresh: 'besat_refresh',
} as const;

type SessionTokens = {
  access: string;
  refresh: string;
};

function cookieAttributes(maxAge: number) {
  const attributes = [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  return attributes.join('; ');
}

function serializeCookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; ${cookieAttributes(maxAge)}`;
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const entry = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function appendSessionCookies(headers: Headers, tokens: SessionTokens) {
  headers.append(
    'set-cookie',
    serializeCookie(sessionCookieNames.access, tokens.access, 30 * 60),
  );
  headers.append(
    'set-cookie',
    serializeCookie(sessionCookieNames.refresh, tokens.refresh, 7 * 24 * 60 * 60),
  );
}

export function clearSessionCookies(headers: Headers) {
  headers.append('set-cookie', serializeCookie(sessionCookieNames.access, '', 0));
  headers.append('set-cookie', serializeCookie(sessionCookieNames.refresh, '', 0));
}
