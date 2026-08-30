import {
  RasadyarAuthError,
  assertLoginAllowed,
  clearLoginFailures,
  createManagedUser,
  deleteManagedUser,
  getAuthStatus,
  getUserForSessionToken,
  listUsersForAdmin,
  loginUser,
  logoutSession,
  migrateLegacyUsers,
  recordLoginFailure,
  resetManagedPassword,
  updateManagedUser,
  type PublicUser,
} from '../server/rasadyar-auth/store-redis';

const SESSION_COOKIE = 'rasadyar_session';
const MAX_BODY_BYTES = 64 * 1024;

function json(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  });

  return new Response(JSON.stringify(body), { status, headers });
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('cookie') ?? '';
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

function sessionCookie(token: string, expiresAt: string): string {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((Date.parse(expiresAt) - Date.now()) / 1000),
  );

  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Secure',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

function expiredSessionCookie(): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Secure',
    'Max-Age=0',
  ].join('; ');
}

function assertSameOrigin(request: Request): void {
  const fetchSite = String(request.headers.get('sec-fetch-site') ?? '').toLowerCase();
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new RasadyarAuthError('csrf-rejected', 403);
  }

  const origin = request.headers.get('origin');
  if (!origin) return;

  if (origin !== new URL(request.url).origin) {
    throw new RasadyarAuthError('csrf-rejected', 403);
  }
}

async function readJsonBody(request: Request): Promise<any> {
  const raw = await request.text();
  if (!raw) return {};

  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw new RasadyarAuthError('payload-too-large', 413);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new RasadyarAuthError('invalid-json', 400);
  }
}

function routeParts(request: Request): string[] {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get('path') ?? '';

  return rawPath
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}

function clientAddress(request: Request): string {
  return String(request.headers.get('x-forwarded-for') ?? '')
    .split(',')[0]
    .trim() || 'unknown';
}

function loginIdentity(request: Request, username: string): string {
  return `${clientAddress(request)}:${username.trim().toLocaleLowerCase('en-US')}`;
}

async function requireSession(request: Request): Promise<PublicUser> {
  const token = parseCookies(request)[SESSION_COOKIE];
  const user = await getUserForSessionToken(token);
  if (!user) throw new RasadyarAuthError('unauthorized', 401);
  return user;
}

async function handleAuthRequest(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();
  const parts = routeParts(request);

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'GET, POST, PATCH, DELETE, OPTIONS',
        'Cache-Control': 'no-store',
      },
    });
  }

  if (method === 'GET' && parts.length === 1 && parts[0] === 'status') {
    return json(200, { ok: true, ...(await getAuthStatus()) });
  }

  if (method === 'POST' && parts.length === 1 && parts[0] === 'migrate') {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const result = await migrateLegacyUsers(body?.users);
    return json(200, { ok: true, ...result });
  }

  if (method === 'POST' && parts.length === 1 && parts[0] === 'login') {
    assertSameOrigin(request);

    const body = await readJsonBody(request);
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    const identity = loginIdentity(request, username);

    await assertLoginAllowed(identity);

    const result = await loginUser(username, password);
    if (!result) {
      await recordLoginFailure(identity);
      throw new RasadyarAuthError('invalid-credentials', 401);
    }

    await clearLoginFailures(identity);

    return json(
      200,
      { ok: true, user: result.user },
      { 'Set-Cookie': sessionCookie(result.sessionToken, result.expiresAt) },
    );
  }

  if (method === 'POST' && parts.length === 1 && parts[0] === 'logout') {
    assertSameOrigin(request);

    const token = parseCookies(request)[SESSION_COOKIE];
    await logoutSession(token);

    return json(
      200,
      { ok: true },
      { 'Set-Cookie': expiredSessionCookie() },
    );
  }

  if (method === 'GET' && parts.length === 1 && parts[0] === 'me') {
    const user = await requireSession(request);
    return json(200, { ok: true, user });
  }

  if (parts[0] === 'users') {
    const actor = await requireSession(request);

    if (method === 'GET' && parts.length === 1) {
      return json(200, {
        ok: true,
        users: await listUsersForAdmin(actor),
      });
    }

    assertSameOrigin(request);

    if (method === 'POST' && parts.length === 1) {
      const body = await readJsonBody(request);
      return json(201, {
        ok: true,
        users: await createManagedUser(actor, body),
      });
    }

    if (parts.length >= 2) {
      const username = parts[1];

      if (method === 'PATCH' && parts.length === 2) {
        const body = await readJsonBody(request);
        return json(200, {
          ok: true,
          users: await updateManagedUser(actor, username, body),
        });
      }

      if (method === 'DELETE' && parts.length === 2) {
        await deleteManagedUser(actor, username);
        return json(200, { ok: true });
      }

      if (method === 'POST' && parts.length === 3 && parts[2] === 'password') {
        const body = await readJsonBody(request);
        return json(200, {
          ok: true,
          users: await resetManagedPassword(actor, username, body?.password),
        });
      }
    }
  }

  throw new RasadyarAuthError('not-found', 404);
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await handleAuthRequest(request);
    } catch (error: unknown) {
      if (error instanceof RasadyarAuthError) {
        return json(error.status, {
          ok: false,
          code: error.code,
          message: error.code,
        });
      }

      console.error('[rasadyar-auth] production error:', error);
      return json(500, {
        ok: false,
        code: 'internal-error',
        message: 'internal-error',
      });
    }
  },
};
