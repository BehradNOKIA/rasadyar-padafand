import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  RasadyarAuthError,
  seedHashedStore,
} from '../server/rasadyar-auth/store-redis';

async function main(): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set before migration.',
    );
  }

  const sourcePath = resolve(
    process.env.RASADYAR_AUTH_STORE?.trim() ||
      resolve(process.cwd(), '.rasadyar', 'auth-store.json'),
  );

  const raw = await readFile(sourcePath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if ('password' in parsed) {
    throw new Error('Refusing to migrate a plaintext root password field.');
  }

  const users = Array.isArray(parsed.users) ? parsed.users : [];
  for (const user of users) {
    if (user && typeof user === 'object' && 'password' in user) {
      throw new Error('Refusing to migrate plaintext user passwords.');
    }
  }

  const result = await seedHashedStore(parsed);

  console.log(
    `[rasadyar-auth] Migrated ${result.migrated} hashed users to Redis. Sessions were intentionally not copied.`,
  );
}

main().catch((error: unknown) => {
  if (error instanceof RasadyarAuthError) {
    console.error(`[rasadyar-auth] ${error.code} (HTTP ${error.status})`);
  } else {
    console.error(
      '[rasadyar-auth] migration failed:',
      error instanceof Error ? error.message : String(error),
    );
  }
  process.exitCode = 1;
});
