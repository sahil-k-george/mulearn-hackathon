/**
 * Server-side AI resolution per user.
 *
 * Wraps the pure `resolveAI` with the user's stored settings and the demo-mode
 * flag, and turns "no service" into a clean HTTP error for real accounts.
 */

import type { UserProfile } from '../database.types';
import type { AppDatabase } from './store';
import { resolveAI, type AIStatus, type ResolvedAI } from '../ai';
import { HttpError } from './http';
import { getAISettings, isDemoUser } from './repo';

export function isDemo(db: AppDatabase, user: UserProfile): boolean {
  void db;
  return isDemoUser(user);
}

export function resolveAIForUser(db: AppDatabase, user: UserProfile): ResolvedAI {
  return resolveAI(getAISettings(db, user.id), isDemoUser(user));
}

/**
 * Resolve the AI service, or throw a helpful 402 when a real account has not
 * configured a key. Demo accounts always resolve to the deterministic engine.
 */
export function requireAIService(db: AppDatabase, user: UserProfile): {
  service: NonNullable<ResolvedAI['service']>;
  status: AIStatus;
} {
  const resolved = resolveAIForUser(db, user);
  if (!resolved.service) {
    throw new HttpError(resolved.status.message, 402);
  }
  return { service: resolved.service, status: resolved.status };
}
