import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export async function generateRedisStack(projectPath: string, appType: string): Promise<void> {
    console.log(chalk.cyan('\n⚡ Setting up Redis caching layer...\n'));

    // Create Redis client utility
    const redisClientCode = `import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
  url: REDIS_URL,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Connect lazily
let isConnected = false;

export async function getRedisClient() {
  if (!isConnected) {
    await redisClient.connect();
    isConnected = true;
  }
  return redisClient;
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttl: number = 3600): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('Redis SET error:', error);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.del(key);
  } catch (error) {
    console.error('Redis DELETE error:', error);
  }
}

export default redisClient;
`;

    const libDir = path.join(projectPath, 'src', 'lib');
    await fs.ensureDir(libDir);
    await fs.writeFile(path.join(libDir, 'redis.ts'), redisClientCode);

    console.log(chalk.green('✅ Created Redis client utility'));

    // Create session store for auth apps
    if (appType.includes('auth') || appType.includes('user')) {
        const sessionStoreCode = `import { cacheGet, cacheSet, cacheDelete } from './redis';

export interface Session {
  userId: string;
  email: string;
  createdAt: number;
}

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days

export async function createSession(userId: string, email: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const session: Session = {
    userId,
    email,
    createdAt: Date.now(),
  };
  
  await cacheSet(\`session:\${sessionId}\`, session, SESSION_TTL);
  return sessionId;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  return await cacheGet<Session>(\`session:\${sessionId}\`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await cacheDelete(\`session:\${sessionId}\`);
}
`;

        await fs.writeFile(path.join(libDir, 'session-store.ts'), sessionStoreCode);
        console.log(chalk.green('✅ Created Redis session store'));
    }

    console.log(chalk.cyan('\n📦 Redis setup complete\n'));
}
