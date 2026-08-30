import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  RasadyarAuthError,
  createManagedUser,
  deleteManagedUser,
  getAuthStatus,
  getUserForSessionToken,
  listUsersForAdmin,
  loginUser,
  logoutSession,
  migrateLegacyUsers,
  resetManagedPassword,
  updateManagedUser,
  type PublicUser,
} from './store';

const API_PREFIX = '/api/rasadyar-auth';
const SESSION_COOKIE = 'rasadyar_session';
const MAX_BODY_BYTES = 64 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

interface LoginAttempt {
  count: number;
  firstFailureAt: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }

  res.end(JSON.stringify(body));
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie ?? '';
  const result: Record<string, string> = {};

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }

  return result;
}

function isHttps(req: IncomingMessage): boolean {
  const forwarded = String(req.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  return forwarded === 'https' || Boolean((req.socket as any).encrypted);
}

function sessionCookie(
  req: IncomingMessage,
  token: string,
  expiresAt: string,
): string {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
  );

  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

function expiredSessionCookie(req: IncomingMessage): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];

  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

function requestOrigin(req: IncomingMessage): string {
  const protocol = isHttps(req) ? 'https' : 'http';
  const host = req.headers.host ?? 'localhost';
  return `${protocol}://${host}`;
}

function assertSameOrigin(req: IncomingMessage): void {
  const fetchSite = String(req.headers['sec-fetch-site'] ?? '').toLowerCase();
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new RasadyarAuthError('csrf-rejected', 403);
  }

  const origin = req.headers.origin;
  if (!origin) return;

  if (origin !== requestOrigin(req)) {
    throw new RasadyarAuthError('csrf-rejected', 403);
  }
}

function isLoopbackAddress(value: string | undefined): boolean {
  if (!value) return false;
  const address = value.toLowerCase();
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new RasadyarAuthError('payload-too-large', 413);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RasadyarAuthError('invalid-json', 400);
  }
}

function routeParts(pathname: string): string[] {
  return pathname
    .slice(API_PREFIX.length)
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}

function clientAddress(req: IncomingMessage): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function loginKey(req: IncomingMessage, username: string): string {
  return `${clientAddress(req)}:${username.trim().toLocaleLowerCase('en-US')}`;
}

function assertLoginAllowed(key: string): void {
  const attempt = loginAttempts.get(key);
  if (!attempt) return;

  const now = Date.now();
  if (now - attempt.firstFailureAt >= LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return;
  }

  if (attempt.count >= LOGIN_MAX_FAILURES) {
    throw new RasadyarAuthError('too-many-attempts', 429);
  }
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const existing = loginAttempts.get(key);

  if (!existing || now - existing.firstFailureAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstFailureAt: now });
    return;
  }

  existing.count += 1;
}

async function requireSession(req: IncomingMessage): Promise<PublicUser> {
  const token = parseCookies(req)[SESSION_COOKIE];
  const user = await getUserForSessionToken(token);
  if (!user) throw new RasadyarAuthError('unauthorized', 401);
  return user;
}

async function handleAuthRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const base = requestOrigin(req);
  const url = new URL(req.url ?? '/', base);
  const path = url.pathname;
  const method = String(req.method ?? 'GET').toUpperCase();
  const parts = routeParts(path);

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.end();
    return;
  }

  if (method === 'GET' && parts.length === 1 && parts[0] === 'status') {
    json(res, 200, { ok: true, ...(await getAuthStatus()) });
    return;
  }

  if (method === 'POST' && parts.length === 1 && parts[0] === 'migrate') {
    assertSameOrigin(req);

    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      throw new RasadyarAuthError('migration-not-allowed', 403);
    }

    const body = await readJsonBody(req);
    const result = await migrateLegacyUsers(body?.users);
    json(res, 200, { ok: true, ...result });
    return;
  }

  if (method === 'POST' && parts.length === 1 && parts[0] === 'login') {
    assertSameOrigin(req);
    const body = await readJsonBody(req);
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    const key = loginKey(req, username);

    assertLoginAllowed(key);

    const result = await loginUser(username, password);
    if (!result) {
      recordLoginFailure(key);
      throw new RasadyarAuthError('invalid-credentials', 401);
    }

    loginAttempts.delete(key);
    json(
      res,
      200,
      { ok: true, user: result.user },
      { 'Set-Cookie': sessionCookie(req, result.sessionToken, result.expiresAt) },
    );
    return;
  }

  if (method === 'POST' && parts.length === 1 && parts[0] === 'logout') {
    assertSameOrigin(req);
    const token = parseCookies(req)[SESSION_COOKIE];
    await logoutSession(token);
    json(
      res,
      200,
      { ok: true },
      { 'Set-Cookie': expiredSessionCookie(req) },
    );
    return;
  }

  if (method === 'GET' && parts.length === 1 && parts[0] === 'me') {
    const user = await requireSession(req);
    json(res, 200, { ok: true, user });
    return;
  }

  if (parts[0] === 'users') {
    const actor = await requireSession(req);

    if (method === 'GET' && parts.length === 1) {
      json(res, 200, { ok: true, users: await listUsersForAdmin(actor) });
      return;
    }

    assertSameOrigin(req);

    if (method === 'POST' && parts.length === 1) {
      const body = await readJsonBody(req);
      json(res, 201, {
        ok: true,
        users: await createManagedUser(actor, body),
      });
      return;
    }

    if (parts.length >= 2) {
      const username = parts[1];

      if (method === 'PATCH' && parts.length === 2) {
        const body = await readJsonBody(req);
        json(res, 200, {
          ok: true,
          users: await updateManagedUser(actor, username, body),
        });
        return;
      }

      if (method === 'DELETE' && parts.length === 2) {
        await deleteManagedUser(actor, username);
        json(res, 200, { ok: true });
        return;
      }

      if (method === 'POST' && parts.length === 3 && parts[2] === 'password') {
        const body = await readJsonBody(req);
        json(res, 200, {
          ok: true,
          users: await resetManagedPassword(actor, username, body?.password),
        });
        return;
      }
    }
  }

  throw new RasadyarAuthError('not-found', 404);
}

function authMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  if (!req.url) return next();

  let pathname: string;
  try {
    pathname = new URL(req.url, requestOrigin(req)).pathname;
  } catch {
    return next();
  }

  if (!pathname.startsWith(API_PREFIX)) return next();

  void handleAuthRequest(req, res).catch((error: unknown) => {
    if (error instanceof RasadyarAuthError) {
      json(res, error.status, {
        ok: false,
        code: error.code,
        message: error.code,
      });
      return;
    }

    console.error('[rasadyar-auth] unexpected error:', error);
    json(res, 500, {
      ok: false,
      code: 'internal-error',
      message: 'internal-error',
    });
  });
}

export function rasadyarAuthPlugin(): Plugin {
  return {
    name: 'rasadyar-secure-auth',
    configureServer(server) {
      server.middlewares.use(authMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(authMiddleware);
    },
  };
}
