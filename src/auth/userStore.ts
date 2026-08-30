import {
  getRolePermissions,
  type RasadyarPermission,
  type RasadyarRole,
} from './permissions';

import {
  can,
  type RasadyarAccessUser,
} from './accessControl';

/**
 * Legacy browser key. It is read ONLY for the one-time migration to the
 * server-side secure store and then removed. No new password is ever written
 * to this key.
 */
export const USER_STORE = 'rasadyar_users';

/**
 * Non-sensitive UI cache. This contains only the current user's public profile
 * (username/name/role/active/permissions). It never contains a password,
 * password hash, session token, or secret.
 */
export const CURRENT_USER_STORE = 'rasadyar_user';

const LEGACY_CURRENT_USER_STORE = 'user';
const AUTH_API = '/api/rasadyar-auth';

export type RasadyarStoredUser = {
  username: string;
  name: string;
  role: RasadyarRole | string;
  active?: boolean;
  permissions?: RasadyarPermission[];
  createdAt?: string;
  updatedAt?: string;
};

type ApiEnvelope = {
  ok?: boolean;
  code?: string;
  message?: string;
  initialized?: boolean;
  user?: unknown;
  users?: unknown;
  migrated?: number;
};

let migrationPromise: Promise<void> | null = null;

function normalizeUsername(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizePublicUser(value: any): RasadyarStoredUser | null {
  if (!value || typeof value !== 'object') return null;

  const username = normalizeUsername(value.username);
  if (!username) return null;

  const name = String(value.name ?? '').trim() || username;
  const role = String(value.role ?? '').trim();

  return {
    username,
    name,
    role,
    active: value.active !== false,
    permissions: getRolePermissions(role),
    createdAt:
      typeof value.createdAt === 'string' ? value.createdAt : undefined,
    updatedAt:
      typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

function normalizePublicUsers(value: unknown): RasadyarStoredUser[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizePublicUser)
    .filter((user): user is RasadyarStoredUser => Boolean(user));
}

function clearLegacyUserList(): void {
  try {
    localStorage.removeItem(USER_STORE);
  } catch {
    // Storage can be unavailable in hardened/sandboxed browser contexts.
  }
}

function readLegacyUsers(): any[] | null {
  try {
    const raw = localStorage.getItem(USER_STORE);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function parseApiResponse(response: Response): Promise<ApiEnvelope> {
  let body: ApiEnvelope = {};

  try {
    body = (await response.json()) as ApiEnvelope;
  } catch {
    body = {};
  }

  if (!response.ok) {
    const error = new Error(body.code || `http-${response.status}`);
    (error as any).status = response.status;
    throw error;
  }

  return body;
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope> {
  const headers = new Headers(init.headers);

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${AUTH_API}${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  return parseApiResponse(response);
}

/**
 * One-time migration from the old plaintext browser store.
 *
 * The server accepts this migration only while its secure user store is empty
 * and only from a loopback request. On success the plaintext browser copy is
 * removed immediately. If the server is already initialized, any stale legacy
 * browser copy is also deleted.
 */
export async function ensureLegacyUserMigration(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const status = await apiFetch('/status');

    if (status.initialized === true) {
      clearLegacyUserList();
      return;
    }

    const legacyUsers = readLegacyUsers();

    if (!legacyUsers || legacyUsers.length === 0) {
      throw new Error('auth-not-initialized');
    }

    try {
      await apiFetch('/migrate', {
        method: 'POST',
        body: JSON.stringify({ users: legacyUsers }),
      });
    } catch (error) {
      // A parallel tab may have completed migration between /status and /migrate.
      if (error instanceof Error && error.message === 'already-initialized') {
        clearLegacyUserList();
        return;
      }
      throw error;
    }

    clearLegacyUserList();
  })().catch((error) => {
    migrationPromise = null;
    throw error;
  });

  return migrationPromise;
}

export function setCurrentUser(user: unknown): void {
  const normalized = normalizePublicUser(user);

  try {
    if (!normalized) {
      localStorage.removeItem(CURRENT_USER_STORE);
      localStorage.removeItem(LEGACY_CURRENT_USER_STORE);
      return;
    }

    localStorage.setItem(CURRENT_USER_STORE, JSON.stringify(normalized));
    localStorage.removeItem(LEGACY_CURRENT_USER_STORE);
  } catch {
    // UI cache failure must not create or expose an authentication secret.
  }
}

export function getCurrentUser(): RasadyarStoredUser | null {
  try {
    const raw =
      localStorage.getItem(CURRENT_USER_STORE) ??
      localStorage.getItem(LEGACY_CURRENT_USER_STORE);

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const normalized = normalizePublicUser(parsed);

    if (!normalized) {
      localStorage.removeItem(CURRENT_USER_STORE);
      localStorage.removeItem(LEGACY_CURRENT_USER_STORE);
      return null;
    }

    // Re-write a strict whitelist so a legacy cached user cannot retain the old
    // plaintext password or any other secret field.
    localStorage.setItem(CURRENT_USER_STORE, JSON.stringify(normalized));
    localStorage.removeItem(LEGACY_CURRENT_USER_STORE);

    return normalized;
  } catch {
    return null;
  }
}

export async function refreshCurrentUser(): Promise<RasadyarStoredUser | null> {
  try {
    await ensureLegacyUserMigration();
    const body = await apiFetch('/me');
    const user = normalizePublicUser(body.user);
    setCurrentUser(user);
    return user;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';

    if (code === 'unauthorized' || code === 'http-401') {
      setCurrentUser(null);
      return null;
    }

    throw error;
  }
}

export async function authenticate(
  username: string,
  password: string,
): Promise<RasadyarStoredUser | undefined> {
  await ensureLegacyUserMigration();

  try {
    const body = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify({
        username: normalizeUsername(username),
        password: String(password ?? ''),
      }),
    });

    const user = normalizePublicUser(body.user);
    if (!user) throw new Error('invalid-server-user');

    setCurrentUser(user);
    return user;
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid-credentials') {
      return undefined;
    }
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await apiFetch('/logout', { method: 'POST' });
  } catch (error) {
    // Even if the network is unavailable, clear the local display cache. The
    // server session remains HttpOnly and will be revalidated on next load.
    console.warn('[RasadyarAuth] Server logout request failed:', error);
  } finally {
    setCurrentUser(null);
  }
}

export async function getUsers(): Promise<RasadyarStoredUser[]> {
  await ensureLegacyUserMigration();
  const body = await apiFetch('/users');
  return normalizePublicUsers(body.users);
}

/**
 * Kept only so stale imports fail explicitly instead of silently writing
 * passwords back into localStorage. Secure user management is server-owned.
 */
export function saveUsers(_users: unknown[]): never {
  throw new Error('server-managed-users');
}

export async function addUser(user: any): Promise<RasadyarStoredUser[]> {
  await ensureLegacyUserMigration();

  const body = await apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      username: normalizeUsername(user?.username),
      name: String(user?.name ?? '').trim(),
      password: String(user?.password ?? ''),
      role: user?.role,
    }),
  });

  return normalizePublicUsers(body.users);
}

export async function deleteUser(
  username: string,
  _currentUsername?: string,
): Promise<void> {
  await ensureLegacyUserMigration();
  await apiFetch(`/users/${encodeURIComponent(normalizeUsername(username))}`, {
    method: 'DELETE',
  });
}

export async function updateUser(
  username: string,
  data: any,
): Promise<RasadyarStoredUser[]> {
  await ensureLegacyUserMigration();

  const payload: Record<string, unknown> = {};

  if (data?.role !== undefined) payload.role = data.role;
  if (data?.name !== undefined) payload.name = data.name;
  if (data?.active !== undefined) payload.active = Boolean(data.active);

  const body = await apiFetch(
    `/users/${encodeURIComponent(normalizeUsername(username))}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );

  return normalizePublicUsers(body.users);
}

export async function setUserActive(
  username: string,
  active: boolean,
): Promise<RasadyarStoredUser[]> {
  return updateUser(username, { active: Boolean(active) });
}

export async function resetUserPassword(
  username: string,
  newPassword: string,
): Promise<RasadyarStoredUser[]> {
  await ensureLegacyUserMigration();

  const body = await apiFetch(
    `/users/${encodeURIComponent(normalizeUsername(username))}/password`,
    {
      method: 'POST',
      body: JSON.stringify({ password: String(newPassword ?? '') }),
    },
  );

  return normalizePublicUsers(body.users);
}

export function hasPermission(
  user: RasadyarAccessUser,
  permission: RasadyarPermission,
): boolean {
  return can(user, permission);
}
