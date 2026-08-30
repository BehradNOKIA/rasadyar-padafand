import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { Redis } from '@upstash/redis';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
const MAX_SESSIONS_PER_USER = 10;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_FAILURES = 5;

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

let redisClient: Redis | null = null;

function redis(): Redis {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new RasadyarAuthError('redis-not-configured', 503);
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function prefix(): string {
  return process.env.RASADYAR_AUTH_REDIS_PREFIX?.trim() || 'rasadyar:auth:v1';
}

function usersIndexKey(): string {
  return `${prefix()}:users`;
}

function userKeyFromNormalized(normalizedUsername: string): string {
  return `${prefix()}:user:${encodeURIComponent(normalizedUsername)}`;
}

function userSessionsKey(normalizedUsername: string): string {
  return `${prefix()}:user-sessions:${encodeURIComponent(normalizedUsername)}`;
}

function sessionKey(tokenHash: string): string {
  return `${prefix()}:session:${tokenHash}`;
}

function loginFailureKey(identity: string): string {
  const digest = createHash('sha256').update(identity, 'utf8').digest('hex');
  return `${prefix()}:login-fail:${digest}`;
}

function nowIso(): string {
  return new Date().toISOString();
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

async function readUserByNormalized(
  normalizedUsername: string,
): Promise<StoredUser | null> {
  return redis().get<StoredUser>(userKeyFromNormalized(normalizedUsername));
}

async function readUser(username: string): Promise<StoredUser | null> {
  return readUserByNormalized(usernameKey(username));
}

async function writeUser(user: StoredUser): Promise<void> {
  await redis().set(userKeyFromNormalized(usernameKey(user.username)), user);
}

async function allStoredUsers(): Promise<StoredUser[]> {
  const members = (await redis().smembers(usersIndexKey())) as string[];
  if (!members.length) return [];

  const users = await Promise.all(
    members.map((member) => readUserByNormalized(String(member))),
  );

  return users.filter((user): user is StoredUser => Boolean(user));
}

async function revokeUserSessionsByNormalized(
  normalizedUsername: string,
): Promise<void> {
  const indexKey = userSessionsKey(normalizedUsername);
  const tokenHashes = (await redis().zrange(indexKey, 0, -1)) as string[];

  if (tokenHashes.length) {
    await Promise.all(
      tokenHashes.map((tokenHash) => redis().del(sessionKey(String(tokenHash)))),
    );
  }

  await redis().del(indexKey);
}

async function revokeUserSessions(username: string): Promise<void> {
  await revokeUserSessionsByNormalized(usernameKey(username));
}

async function pruneUserSessions(
  normalizedUsername: string,
): Promise<void> {
  const indexKey = userSessionsKey(normalizedUsername);

  await redis().zremrangebyscore(indexKey, 0, Date.now());

  const count = Number(await redis().zcard(indexKey));
  const excess = count - MAX_SESSIONS_PER_USER;
  if (excess <= 0) return;

  const oldest = (await redis().zrange(indexKey, 0, excess - 1)) as string[];
  if (!oldest.length) return;

  await Promise.all(
    oldest.map((tokenHash) => redis().del(sessionKey(String(tokenHash)))),
  );

  for (const tokenHash of oldest) {
    await redis().zrem(indexKey, String(tokenHash));
  }
}

export async function getAuthStatus(): Promise<{ initialized: boolean }> {
  return { initialized: Number(await redis().scard(usersIndexKey())) > 0 };
}

/**
 * Production intentionally refuses plaintext browser migration.
 * Use scripts/rasadyar-auth-migrate-to-redis.ts to copy the already-hashed
 * local store into Redis before first production login.
 */
export async function migrateLegacyUsers(
  _inputUsers: LegacyUserInput[],
): Promise<{ migrated: number }> {
  throw new RasadyarAuthError('migration-not-allowed', 403);
}

export async function loginUser(
  usernameInput: string,
  passwordInput: string,
): Promise<LoginResult | null> {
  const username = normalizeUsername(usernameInput);
  const password = String(passwordInput ?? '');

  if (!username || !password) return null;

  const freshUser = await readUser(username);
  if (!freshUser || freshUser.active === false) return null;
  if (!(await verifyPassword(password, freshUser))) return null;

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const session: StoredSession = {
    tokenHash,
    username: freshUser.username,
    sessionVersion: freshUser.sessionVersion,
    createdAt,
    expiresAt,
  };

  await redis().set(sessionKey(tokenHash), session, {
    ex: SESSION_TTL_SECONDS,
  });

  const normalized = usernameKey(freshUser.username);
  const sessionIndex = userSessionsKey(normalized);
  await redis().zadd(sessionIndex, {
    score: Date.parse(expiresAt),
    member: tokenHash,
  });
  await redis().expire(sessionIndex, SESSION_TTL_SECONDS * 2);
  await pruneUserSessions(normalized);

  return {
    user: publicUser(freshUser),
    sessionToken: token,
    expiresAt,
  };
}

export async function getUserForSessionToken(
  token: string | null | undefined,
): Promise<PublicUser | null> {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await redis().get<StoredSession>(sessionKey(tokenHash));

  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await redis().del(sessionKey(tokenHash));
    return null;
  }

  const user = await readUser(session.username);
  if (!user || user.active === false) return null;
  if (user.sessionVersion !== session.sessionVersion) return null;

  return publicUser(user);
}

export async function logoutSession(
  token: string | null | undefined,
): Promise<void> {
  if (!token) return;

  const tokenHash = hashSessionToken(token);
  const session = await redis().get<StoredSession>(sessionKey(tokenHash));

  await redis().del(sessionKey(tokenHash));

  if (session?.username) {
    await redis().zrem(
      userSessionsKey(usernameKey(session.username)),
      tokenHash,
    );
  }
}

export async function listUsersForAdmin(
  actor: PublicUser,
): Promise<PublicUser[]> {
  assertManageRole(actor.role);

  return (await allStoredUsers())
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

  const normalized = usernameKey(username);
  const { salt, hash } = await hashPassword(password);
  const timestamp = nowIso();

  const user: StoredUser = {
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
  };

  const created = await redis().set(
    userKeyFromNormalized(normalized),
    user,
    { nx: true },
  );

  if (created !== 'OK') {
    throw new RasadyarAuthError('duplicate', 409);
  }

  try {
    await redis().sadd(usersIndexKey(), normalized);
  } catch (error) {
    await redis().del(userKeyFromNormalized(normalized));
    throw error;
  }

  return listUsersForAdmin(actor);
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

  const target = await readUser(targetUsername);
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
  }

  await writeUser(target);

  if (revokeSessions) {
    await revokeUserSessions(target.username);
  }

  return listUsersForAdmin(actor);
}

export async function deleteManagedUser(
  actor: PublicUser,
  targetUsername: string,
): Promise<void> {
  assertManageRole(actor.role);

  const target = await readUser(targetUsername);
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

  const normalized = usernameKey(target.username);
  await redis().del(userKeyFromNormalized(normalized));
  await redis().srem(usersIndexKey(), normalized);
  await revokeUserSessionsByNormalized(normalized);
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

  const target = await readUser(targetUsername);
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

  await writeUser(target);
  await revokeUserSessions(target.username);

  return listUsersForAdmin(actor);
}

export async function assertLoginAllowed(identity: string): Promise<void> {
  const count = Number(await redis().get<number>(loginFailureKey(identity)) ?? 0);
  if (count >= LOGIN_MAX_FAILURES) {
    throw new RasadyarAuthError('too-many-attempts', 429);
  }
}

export async function recordLoginFailure(identity: string): Promise<void> {
  const key = loginFailureKey(identity);
  const count = Number(await redis().incr(key));
  if (count === 1) {
    await redis().expire(key, LOGIN_WINDOW_SECONDS);
  }
}

export async function clearLoginFailures(identity: string): Promise<void> {
  await redis().del(loginFailureKey(identity));
}

interface SeedStoreShape {
  version?: unknown;
  users?: unknown;
  sessions?: unknown;
}

function validateSeedUser(value: unknown): StoredUser {
  if (!value || typeof value !== 'object') {
    throw new RasadyarAuthError('invalid-seed-user', 400);
  }

  const candidate = value as Record<string, unknown>;

  if ('password' in candidate) {
    throw new RasadyarAuthError('plaintext-password-in-seed', 400);
  }

  const username = normalizeUsername(candidate.username);
  const name = normalizeName(candidate.name);
  const role = normalizeRole(candidate.role);
  const active = candidate.active !== false;
  const passwordAlgorithm = candidate.passwordAlgorithm;
  const passwordSalt = String(candidate.passwordSalt ?? '');
  const passwordHash = String(candidate.passwordHash ?? '');
  const passwordChangedAt = String(candidate.passwordChangedAt ?? '');
  const sessionVersion = Number(candidate.sessionVersion);

  if (!username || username.length > 120) {
    throw new RasadyarAuthError('invalid-username', 400);
  }
  if (!name || name.length > 200) {
    throw new RasadyarAuthError('invalid-name', 400);
  }
  if (!role) {
    throw new RasadyarAuthError('invalid-role', 400);
  }
  if (passwordAlgorithm !== 'scrypt-v1') {
    throw new RasadyarAuthError('invalid-password-algorithm', 400);
  }
  if (!/^[a-f0-9]{32}$/i.test(passwordSalt)) {
    throw new RasadyarAuthError('invalid-password-salt', 400);
  }
  if (!/^[a-f0-9]{128}$/i.test(passwordHash)) {
    throw new RasadyarAuthError('invalid-password-hash', 400);
  }
  if (!passwordChangedAt || !Number.isFinite(Date.parse(passwordChangedAt))) {
    throw new RasadyarAuthError('invalid-password-changed-at', 400);
  }
  if (!Number.isInteger(sessionVersion) || sessionVersion < 1) {
    throw new RasadyarAuthError('invalid-session-version', 400);
  }

  return {
    username,
    name,
    role,
    active,
    createdAt:
      typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
    updatedAt:
      typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
    passwordAlgorithm: 'scrypt-v1',
    passwordSalt,
    passwordHash,
    passwordChangedAt,
    sessionVersion,
  };
}

/**
 * One-time administrative seed used by the migration script.
 * It accepts only the already-hashed local store. Browser/API callers never use it.
 */
export async function seedHashedStore(
  rawStore: SeedStoreShape,
): Promise<{ migrated: number }> {
  if (!rawStore || !Array.isArray(rawStore.users) || rawStore.users.length === 0) {
    throw new RasadyarAuthError('migration-empty', 400);
  }

  if (rawStore.users.length > 500) {
    throw new RasadyarAuthError('migration-too-large', 400);
  }

  if (Number(await redis().scard(usersIndexKey())) > 0) {
    throw new RasadyarAuthError('already-initialized', 409);
  }

  const users = rawStore.users.map(validateSeedUser);
  const normalized = users.map((user) => usernameKey(user.username));

  if (new Set(normalized).size !== normalized.length) {
    throw new RasadyarAuthError('duplicate', 409);
  }

  if (!users.some((user) => user.role === 'superadmin' || user.role === 'admin')) {
    throw new RasadyarAuthError('migration-needs-admin', 400);
  }

  const records: Record<string, StoredUser> = {};
  for (let i = 0; i < users.length; i += 1) {
    records[userKeyFromNormalized(normalized[i])] = users[i];
  }

  const inserted = await redis().msetnx(records);
  if (!inserted) {
    throw new RasadyarAuthError('redis-seed-conflict', 409);
  }

  try {
    await redis().sadd(usersIndexKey(), ...normalized);
  } catch (error) {
    await Promise.all(Object.keys(records).map((key) => redis().del(key)));
    throw error;
  }

  return { migrated: users.length };
}
