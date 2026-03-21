// Shared auth utilities for TidySnap
// Used by /api/auth and /api/subscription

import { v4 as uuidv4 } from 'uuid';

// In-memory store (MVP only - resets on serverless cold start)
// TODO: Replace with Vercel KV or database for production
export const users = new Map<string, UserRecord>();
export const sessions = new Map<string, SessionRecord>();

export interface UserRecord {
  id: string;
  email: string;
  createdAt: number;
  subscription: 'free' | 'lifetime';
  analysisCount: number;
  provider: 'google' | 'email';
}

export interface SessionRecord {
  userId: string;
  createdAt: number;
}

export function getCookieValue(cookieString: string, name: string): string | null {
  if (!cookieString) return null;
  // Cookies are separated by "; " (semicolon + space)
  const cookies = cookieString.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const eqIndex = cookie.indexOf('=');
    if (eqIndex > 0 && cookie.substring(0, eqIndex) === name) {
      return cookie.substring(eqIndex + 1);
    }
  }
  return null;
}

export function createSession(userId: string): string {
  const sessionId = uuidv4();
  sessions.set(sessionId, { userId, createdAt: Date.now() });
  return sessionId;
}

export function getUserFromSession(sessionId: string): UserRecord | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  for (const user of users.values()) {
    if (user.id === session.userId) return user;
  }
  return null;
}

export function findUserByEmail(email: string): UserRecord | null {
  return users.get(email.toLowerCase().trim()) || null;
}

export function createOrUpdateUser(email: string, provider: 'google' | 'email'): UserRecord {
  const existing = users.get(email.toLowerCase().trim());
  if (existing) return existing;

  const userId = uuidv4();
  const user: UserRecord = {
    id: userId,
    email: email.toLowerCase().trim(),
    createdAt: Date.now(),
    subscription: 'free',
    analysisCount: 0,
    provider,
  };
  users.set(email.toLowerCase().trim(), user);
  return user;
}

export function upgradeToLifetime(email: string): boolean {
  const user = users.get(email.toLowerCase().trim());
  if (!user) return false;
  user.subscription = 'lifetime';
  return true;
}

export function incrementAnalysisCount(email: string): void {
  const user = users.get(email.toLowerCase().trim());
  if (user) {
    user.analysisCount++;
  }
}
