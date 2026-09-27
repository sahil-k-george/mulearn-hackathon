/**
 * Authentication primitives.
 *
 * Passwords are hashed with scrypt (Node built-in). Sessions and reset tokens
 * are opaque random strings persisted server-side. No secret is ever exposed
 * to the client bundle.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'adaptive_session';
export const SESSION_TTL_DAYS = 30;

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function sessionExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString();
}

/** Basic but real validation (plan section 19). */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
}
