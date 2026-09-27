/**
 * Route-handler helpers: JSON responses, session lookup, auth enforcement and
 * uniform error handling. Every private route goes through `requireUser`.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { UserProfile } from '../database.types';
import { SESSION_COOKIE } from './auth';
import { RepoError, getUserForSession } from './repo';
import { readDb, readDbSeeded } from './store';

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as object, { status });
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError || error instanceof RepoError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('[api] unexpected error:', error);
  return NextResponse.json({ error: 'Something went wrong on our side.' }, { status: 500 });
}

/** Wrap a handler so thrown HttpError/RepoError become clean JSON responses. */
export async function route(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError('Request body must be valid JSON', 400);
  }
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/** Resolve the authenticated user without throwing. */
export async function optionalUser(): Promise<UserProfile | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const db = await readDb();
  return getUserForSession(db, token);
}

/** Resolve the authenticated user or throw a 401. */
export async function requireUser(): Promise<UserProfile> {
  const token = await getSessionToken();
  if (!token) throw new HttpError('You must be signed in.', 401);
  // Make sure the demo database exists before the first lookup.
  await readDbSeeded();
  const db = await readDb();
  const user = getUserForSession(db, token);
  if (!user) throw new HttpError('Your session has expired. Please sign in again.', 401);
  return user;
}
