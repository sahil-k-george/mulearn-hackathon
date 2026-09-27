import { json, readBody, route, HttpError } from '@/lib/server/http';
import { SESSION_COOKIE, SESSION_TTL_DAYS, validateEmail, validatePassword } from '@/lib/server/auth';
import { createSession, createUser, findUserByEmail } from '@/lib/server/repo';
import { createStarterData } from '@/lib/server/seed';
import { readDbSeeded, transact } from '@/lib/server/store';

export async function POST(request: Request) {
  return route(async () => {
    const body = await readBody<{
      name?: string;
      email?: string;
      password?: string;
      timezone?: string;
    }>(request);

    const name = body.name?.trim() ?? '';
    const email = body.email?.trim() ?? '';
    const password = body.password ?? '';

    if (name.length < 2) throw new HttpError('Please enter your name.', 400);
    if (!validateEmail(email)) throw new HttpError('Please enter a valid email address.', 400);
    const passwordError = validatePassword(password);
    if (passwordError) throw new HttpError(passwordError, 400);

    await readDbSeeded();

    const existing = await transact((db) => Boolean(findUserByEmail(db, email)));
    if (existing) throw new HttpError('An account with that email already exists.', 409);

    const { user, token } = await transact((db) => {
      const created = createUser(db, { name, email, password, timezone: body.timezone });
      createStarterData(db, created.id);
      return { user: created, token: createSession(db, created.id) };
    });

    const response = json({ user });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_DAYS * 86_400,
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  });
}
