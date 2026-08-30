import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const STORE_VERSION = 1;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 10;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

export type RasadyarServerRole =
  | 'superadmin'
  | 'admin'
  | 'analyst'
  | 'viewer';

export interface PublicUser {
  username: string;
  name: string;
  role: RasadyarServerRole;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface StoredUser extends PublicUser {
  passwordAlgorithm: 'scrypt-v1';
  passwordSalt: string;
  passwordHash: string;
  passwordChangedAt: string;
  sessionVersion: number;
}

interface StoredSession {
  tokenHash: string;
  username: string;
  sessionVersion: number;
  createdAt: string;
  expiresAt: string;
}

interface AuthStoreFile {
  version: number;
  users: StoredUser[];
  sessions: StoredSession[];
  createdAt: string;
  updatedAt: string;
}

export interface LegacyUserInput {
  username?: unknown;
  password?: unknown;
  name?: unknown;
  role?: unknown;
  active?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LoginResult {
  user: PublicUser;
  sessionToken: string;
  expiresAt: string;
}

export class RasadyarAuthError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'RasadyarAuthError';
    this.code = code;
    this.status = status;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function getStorePath(): string {
  const configured = process.env.RASADYAR_AUTH_STORE?.trim();
  return configured
    ? resolve(configured)
    : resolve(process.cwd(), '.rasadyar', 'auth-store.json');
}

function emptyStore(): AuthStoreFile {
  const timestamp = nowIso();
  return {
    version: STORE_VERSION,
    users: [],
    sessions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeUsername(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeName(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeRole(value: unknown): RasadyarServerRole | null {
  if (
    value === 'superadmin' ||
    value === 'admin' ||
    value === 'analyst' ||
    value === 'viewer'
  ) {
    return value;
  }
  return null;
}

function usernameKey(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function publicUser(user: StoredUser): PublicUser {
  return {
    username: user.username,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function derivePasswordKey(
  password: string,
  salt: string,
  keyLength = SCRYPT_KEY_LENGTH,
): Promise<Buffer> {
  return new Promise((resolveKey, rejectKey) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) {
          rejectKey(error);
          return;
        }
        resolveKey(derivedKey);
      },
    );
  });
}

async function hashPassword(password: string): Promise<{
  salt: string;
  hash: string;
}> {
  const salt = randomBytes(16).toString('hex');
  const derived = await derivePasswordKey(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
  );

  return {
    salt,
    hash: derived.toString('hex'),
  };
}

async function verifyPassword(
  password: string,
  user: StoredUser,
): Promise<boolean> {
  if (user.passwordAlgorithm !== 'scrypt-v1') return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(user.passwordHash, 'hex');
  } catch {
    return false;
  }

  if (expected.length !== SCRYPT_KEY_LENGTH) return false;

  const derived = await derivePasswordKey(
    password,
    user.passwordSalt,
    expected.length,
  );

  return timingSafeEqual(derived, expected);
}

function cleanExpiredSessions(store: AuthStoreFile): void {
  const now = Date.now();
  store.sessions = store.sessions.filter((session) => {
    const expires = Date.parse(session.expiresAt);
    return Number.isFinite(expires) && expires > now;
  });
}

async function readStore(): Promise<AuthStoreFile> {
  const path = getStorePath();

  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AuthStoreFile>;

    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.sessions)) {
      throw new Error('invalid-auth-store');
    }

    const store: AuthStoreFile = {
      version: Number(parsed.version) || STORE_VERSION,
      users: parsed.users as StoredUser[],
      sessions: parsed.sessions as StoredSession[],
      createdAt:
        typeof parsed.createdAt === 'string' ? parsed.createdAt : nowIso(),
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
    };

    cleanExpiredSessions(store);
    return store;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return emptyStore();
    throw error;
  }
}

async function writeStore(store: AuthStoreFile): Promise<void> {
  const path = getStorePath();
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });

  store.version = STORE_VERSION;
  store.updatedAt = nowIso();
  cleanExpiredSessions(store);

  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  const body = `${JSON.stringify(store, null, 2)}\n`;

  await writeFile(temporaryPath, body, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporaryPath, path);
}

let mutationQueue: Promise<void> = Promise.resolve();

async function mutateStore<T>(
  operation: (store: AuthStoreFile) => Promise<T> | T,
): Promise<T> {
  let release!: () => void;
  const previous = mutationQueue;
  mutationQueue = new Promise<void>((resolveQueue) => {
    release = resolveQueue;
  });

  await previous;
  try {
    const store = await readStore();
    const result = await operation(store);
    await writeStore(store);
    return result;
  } finally {
    release();
  }
}

function assertPasswordPolicy(password: string): void {
  if (password.length < 8) {
    throw new RasadyarAuthError('weak-password', 400);
  }

  if (password.length > 512) {
    throw new RasadyarAuthError('password-too-long', 400);
  }
}

function assertManageRole(role: RasadyarServerRole): void {
  if (role !== 'superadmin' && role !== 'admin') {
    throw new RasadyarAuthError('forbidden', 403);
  }
}

function findUser(
  store: AuthStoreFile,
  username: string,
): StoredUser | undefined {
  const key = usernameKey(username);
  return store.users.find((user) => usernameKey(user.username) === key);
}

function revokeUserSessions(store: AuthStoreFile, username: string): void {
  const key = usernameKey(username);
  store.sessions = store.sessions.filter(
    (session) => usernameKey(session.username) !== key,
  );
}

export async function getAuthStatus(): Promise<{ initialized: boolean }> {
  const store = await readStore();
  return { initialized: store.users.length > 0 };
}

export async function migrateLegacyUsers(
  inputUsers: LegacyUserInput[],
): Promise<{ migrated: number }> {
  if (!Array.isArray(inputUsers) || inputUsers.length === 0) {
    throw new RasadyarAuthError('migration-empty', 400);
  }

  if (inputUsers.length > 500) {
    throw new RasadyarAuthError('migration-too-large', 400);
  }

  return mutateStore(async (store) => {
    if (store.users.length > 0) {
      throw new RasadyarAuthError('already-initialized', 409);
    }

    const users: StoredUser[] = [];
    const seen = new Set<string>();

    for (const candidate of inputUsers) {
      const username = normalizeUsername(candidate?.username);
      const name = normalizeName(candidate?.name) || username;
      const password = String(candidate?.password ?? '');
      const role = normalizeRole(candidate?.role);

      if (!username || username.length > 120) {
        throw new RasadyarAuthError('invalid-username', 400);
      }
      if (!name || name.length > 200) {
        throw new RasadyarAuthError('invalid-name', 400);
      }
      if (password.length < 6 || password.length > 512) {
        throw new RasadyarAuthError('invalid-password', 400);
      }
      if (!role) {
        throw new RasadyarAuthError('invalid-role', 400);
      }

      const key = usernameKey(username);
      if (seen.has(key)) {
        throw new RasadyarAuthError('duplicate', 409);
      }
      seen.add(key);

      const { salt, hash } = await hashPassword(password);
      const timestamp = nowIso();

      users.push({
        username,
        name,
        role,
        active: candidate?.active !== false,
        createdAt:
          typeof candidate?.createdAt === 'string'
            ? candidate.createdAt
            : timestamp,
        updatedAt:
          typeof candidate?.updatedAt === 'string'
            ? candidate.updatedAt
            : timestamp,
        passwordAlgorithm: 'scrypt-v1',
        passwordSalt: salt,
        passwordHash: hash,
        passwordChangedAt: timestamp,
        sessionVersion: 1,
      });
    }

    if (
      !users.some(
        (user) => user.role === 'superadmin' || user.role === 'admin',
      )
    ) {
      throw new RasadyarAuthError('migration-needs-admin', 400);
    }

    store.users = users;
    store.sessions = [];
    return { migrated: users.length };
  });
}

export async function loginUser(
  usernameInput: string,
  passwordInput: string,
): Promise<LoginResult | null> {
  const username = normalizeUsername(usernameInput);
  const password = String(passwordInput ?? '');

  if (!username || !password) return null;

  return mutateStore(async (store) => {
    const freshUser = findUser(store, username);
    if (!freshUser || freshUser.active === false) return null;
    if (!(await verifyPassword(password, freshUser))) return null;

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashSessionToken(token);
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const key = usernameKey(freshUser.username);
    const sameUserSessions = store.sessions
      .filter((session) => usernameKey(session.username) === key)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const keep = new Set(
      sameUserSessions
        .slice(0, Math.max(0, MAX_SESSIONS_PER_USER - 1))
        .map((session) => session.tokenHash),
    );

    store.sessions = store.sessions.filter(
      (session) =>
        usernameKey(session.username) !== key || keep.has(session.tokenHash),
    );

    store.sessions.push({
      tokenHash,
      username: freshUser.username,
      sessionVersion: freshUser.sessionVersion,
      createdAt,
      expiresAt,
    });

    return {
      user: publicUser(freshUser),
      sessionToken: token,
      expiresAt,
    };
  });
}

export async function getUserForSessionToken(
  token: string | null | undefined,
): Promise<PublicUser | null> {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const store = await readStore();
  const session = store.sessions.find((item) => item.tokenHash === tokenHash);

  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) return null;

  const user = findUser(store, session.username);
  if (!user || user.active === false) return null;
  if (user.sessionVersion !== session.sessionVersion) return null;

  return publicUser(user);
}

export async function logoutSession(
  token: string | null | undefined,
): Promise<void> {
  if (!token) return;
  const tokenHash = hashSessionToken(token);

  await mutateStore((store) => {
    store.sessions = store.sessions.filter(
      (session) => session.tokenHash !== tokenHash,
    );
  });
}

export async function listUsersForAdmin(
  actor: PublicUser,
): Promise<PublicUser[]> {
  assertManageRole(actor.role);
  const store = await readStore();
  return store.users
    .map(publicUser)
    .sort((a, b) => a.username.localeCompare(b.username));
}

export async function createManagedUser(
  actor: PublicUser,
  input: {
    username?: unknown;
    name?: unknown;
    password?: unknown;
    role?: unknown;
  },
): Promise<PublicUser[]> {
  assertManageRole(actor.role);

  const username = normalizeUsername(input?.username);
  const name = normalizeName(input?.name);
  const password = String(input?.password ?? '');
  const role = normalizeRole(input?.role);

  if (!username || username.length > 120) {
    throw new RasadyarAuthError('invalid-username', 400);
  }
  if (!name || name.length > 200) {
    throw new RasadyarAuthError('invalid-name', 400);
  }
  assertPasswordPolicy(password);
  if (role !== 'analyst' && role !== 'viewer') {
    throw new RasadyarAuthError('invalid-role', 400);
  }

  const { salt, hash } = await hashPassword(password);

  return mutateStore((store) => {
    if (findUser(store, username)) {
      throw new RasadyarAuthError('duplicate', 409);
    }

    const timestamp = nowIso();
    store.users.push({
      username,
      name,
      role,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      passwordAlgorithm: 'scrypt-v1',
      passwordSalt: salt,
      passwordHash: hash,
      passwordChangedAt: timestamp,
      sessionVersion: 1,
    });

    return store.users.map(publicUser);
  });
}

export async function updateManagedUser(
  actor: PublicUser,
  targetUsername: string,
  input: {
    role?: unknown;
    name?: unknown;
    active?: unknown;
  },
): Promise<PublicUser[]> {
  assertManageRole(actor.role);

  return mutateStore((store) => {
    const target = findUser(store, targetUsername);
    if (!target) throw new RasadyarAuthError('not-found', 404);
    if (target.role === 'superadmin') {
      throw new RasadyarAuthError('protected-superadmin', 403);
    }
    if (target.role === 'admin' && actor.role !== 'superadmin') {
      throw new RasadyarAuthError('protected-admin', 403);
    }

    let revokeSessions = false;

    if (input.role !== undefined) {
      const role = normalizeRole(input.role);
      if (role !== 'analyst' && role !== 'viewer') {
        throw new RasadyarAuthError('invalid-role', 400);
      }
      if (target.role !== role) {
        target.role = role;
        revokeSessions = true;
      }
    }

    if (input.name !== undefined) {
      const name = normalizeName(input.name);
      if (!name || name.length > 200) {
        throw new RasadyarAuthError('invalid-name', 400);
      }
      target.name = name;
    }

    if (input.active !== undefined) {
      const active = Boolean(input.active);
      if (target.active !== active) {
        target.active = active;
        revokeSessions = true;
      }
    }

    target.updatedAt = nowIso();

    if (revokeSessions) {
      target.sessionVersion += 1;
      revokeUserSessions(store, target.username);
    }

    return store.users.map(publicUser);
  });
}

export async function deleteManagedUser(
  actor: PublicUser,
  targetUsername: string,
): Promise<void> {
  assertManageRole(actor.role);

  await mutateStore((store) => {
    const target = findUser(store, targetUsername);
    if (!target) throw new RasadyarAuthError('not-found', 404);
    if (target.role === 'superadmin') {
      throw new RasadyarAuthError('protected-superadmin', 403);
    }
    if (target.role === 'admin' && actor.role !== 'superadmin') {
      throw new RasadyarAuthError('protected-admin', 403);
    }
    if (usernameKey(target.username) === usernameKey(actor.username)) {
      throw new RasadyarAuthError('cannot-delete-current-user', 400);
    }

    const key = usernameKey(target.username);
    store.users = store.users.filter(
      (user) => usernameKey(user.username) !== key,
    );
    revokeUserSessions(store, target.username);
  });
}

export async function resetManagedPassword(
  actor: PublicUser,
  targetUsername: string,
  newPasswordInput: unknown,
): Promise<PublicUser[]> {
  assertManageRole(actor.role);

  const newPassword = String(newPasswordInput ?? '');
  assertPasswordPolicy(newPassword);
  const { salt, hash } = await hashPassword(newPassword);

  return mutateStore((store) => {
    const target = findUser(store, targetUsername);
    if (!target) throw new RasadyarAuthError('not-found', 404);
    if (target.role === 'superadmin') {
      throw new RasadyarAuthError('protected-superadmin', 403);
    }
    if (target.role === 'admin' && actor.role !== 'superadmin') {
      throw new RasadyarAuthError('protected-admin', 403);
    }

    target.passwordAlgorithm = 'scrypt-v1';
    target.passwordSalt = salt;
    target.passwordHash = hash;
    target.passwordChangedAt = nowIso();
    target.updatedAt = nowIso();
    target.sessionVersion += 1;
    revokeUserSessions(store, target.username);

    return store.users.map(publicUser);
  });
}
