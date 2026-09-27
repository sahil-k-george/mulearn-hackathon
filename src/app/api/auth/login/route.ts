import { json, readBody, route, HttpError } from '@/lib/server/http';
import { SESSION_COOKIE, SESSION_TTL_DAYS } from '@/lib/server/auth';
import { authenticate, createSession } from '@/lib/server/repo';
import { readDbSeeded, transact } from '@/lib/server/store';

export async function POST(request: Request) {
  return route(async () => {
    const body = await readBody<{ email?: string; password?: string }>(request);
    const email = body.email?.trim() ?? '';
    const password = body.password ?? '';
    if (!email || !password) throw new HttpError('Email and password are required.', 400);

    // Guarantees the demo account exists on a fresh machine.
    await readDbSeeded();

    const result = await transact((db) => {
      const user = authenticate(db, email, password);
      if (!user) return null;
      return { user, token: createSession(db, user.id) };
    });

    if (!result) throw new HttpError('Incorrect email or password.', 401);

    const response = json({ user: result.user });
    response.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_DAYS * 86_400,
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  });
}
