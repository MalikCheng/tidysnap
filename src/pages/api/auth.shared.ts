// Shared auth utilities for TidySnap
// Used by /api/auth and /api/subscription
// Storage: Vercel KV (Upstash Redis) with in-memory fallback for local dev

import { v4 as uuidv4 } from 'uuid';

// ── Types ──────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  createdAt: number;
  subscription: 'free' | 'lifetime';
  analysisCount: number;
  provider: 'google' | 'email' | 'stripe_checkout';
}

// Session stored with email directly to avoid ID lookup issue
export interface SessionRecord {
  email: string;
  createdAt: number;
}

// ── In-Memory Store (fallback for local dev) ───────────────────

export const users = new Map<string, UserRecord>();
export const sessions = new Map<string, SessionRecord>();

// ── Vercel KV Store ────────────────────────────────────────────

type KVClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ttl?: number }): Promise<void>;
  del(key: string): Promise<void>;
};

let _kv: KVClient | null = null;

async function getKV(): Promise<KVClient | null> {
  if (_kv) return _kv;
  if (!import.meta.env.KV_REST_API_URL || !import.meta.env.KV_REST_API_TOKEN) {
    return null; // Not configured — use in-memory fallback
  }
  try {
    const { createClient } = await import('@vercel/kv');
    _kv = createClient({
      url: import.meta.env.KV_REST_API_URL,
      token: import.meta.env.KV_REST_API_TOKEN,
    }) as unknown as KVClient;
    return _kv;
  } catch {
    return null;
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKV();
  if (!kv) return null;
  try {
    return await kv.get<T>(key);
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    await kv.set(key, value, ttlSeconds ? { ttl: ttlSeconds } : undefined);
  } catch {
    // Silently fail — in-memory fallback will handle it
  }
}

async function kvDel(key: string): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    await kv.del(key);
  } catch {
    // Silently fail
  }
}

// ── User Functions ─────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.toLowerCase().trim();
  // Try KV first
  const kvUser = await kvGet<UserRecord>(`user:${normalized}`);
  if (kvUser) return kvUser;
  // Fallback to in-memory
  return users.get(normalized) || null;
}

export async function createOrUpdateUser(
  email: string,
  provider: 'google' | 'email' | 'stripe_checkout'
): Promise<UserRecord> {
  const normalized = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalized);
  if (existing) return existing;

  const userId = uuidv4();
  const user: UserRecord = {
    id: userId,
    email: normalized,
    createdAt: Date.now(),
    subscription: 'free',
    analysisCount: 0,
    provider,
  };

  // Write to KV (primary) + memory (fallback)
  await kvSet(`user:${normalized}`, user, 60 * 60 * 24 * 365); // 1 year
  users.set(normalized, user);
  return user;
}

export async function upgradeToLifetime(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const user = await findUserByEmail(normalized);
  if (!user) return false;

  user.subscription = 'lifetime';
  await kvSet(`user:${normalized}`, user, 60 * 60 * 24 * 365);
  users.set(normalized, user);
  return true;
}

export async function incrementAnalysisCount(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const user = await findUserByEmail(normalized);
  if (user) {
    user.analysisCount++;
    await kvSet(`user:${normalized}`, user, 60 * 60 * 24 * 365);
    users.set(normalized, user);
  }
}

// ── Session Functions ──────────────────────────────────────────

export async function createSession(email: string): Promise<string> {
  const sessionId = uuidv4();
  const record: SessionRecord = { email, createdAt: Date.now() };

  // Write to KV (primary) + memory (fallback)
  await kvSet(`session:${sessionId}`, record, 60 * 60 * 24 * 30); // 30 days
  sessions.set(sessionId, record);
  return sessionId;
}

export async function getUserFromSession(sessionId: string): Promise<UserRecord | null> {
  // Try KV first
  const kvSession = await kvGet<SessionRecord>(`session:${sessionId}`);
  const session = kvSession || sessions.get(sessionId);
  if (!session) return null;

  return await findUserByEmail(session.email);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await kvDel(`session:${sessionId}`);
  sessions.delete(sessionId);
}

// ── Cookie Helpers ─────────────────────────────────────────────

export function getCookieValue(cookieString: string, name: string): string | null {
  if (!cookieString) return null;
  const cookies = cookieString.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const eqIndex = cookie.indexOf('=');
    if (eqIndex > 0 && cookie.substring(0, eqIndex) === name) {
      return cookie.substring(eqIndex + 1);
    }
  }
  return null;
}
