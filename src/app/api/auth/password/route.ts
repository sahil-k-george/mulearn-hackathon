import { json, readBody, route, HttpError } from '@/lib/server/http';
import { validateEmail, validatePassword } from '@/lib/server/auth';
import { consumeResetToken, createResetToken, findUserByEmail } from '@/lib/server/repo';
import { readDbSeeded, transact } from '@/lib/server/store';

/**
 * Forgot password.
 *
 * No email provider is configured in the prototype, so the reset token is
 * returned directly and the UI shows it. This is documented in the README as
 * the single place that must change when real email is added.
 */
export async function POST(request: Request) {
  return route(async () => {
    const body = await readBody<{ email?: string }>(request);
    const email = body.email?.trim() ?? '';
    if (!validateEmail(email)) throw new HttpError('Please enter a valid email address.', 400);

    await readDbSeeded();
    const token = await transact((db) => {
      const user = findUserByEmail(db, email);
      if (!user) return null; // Do not reveal whether an account exists.
      return createResetToken(db, user.id);
    });

    return json({
      success: true,
      message: 'If that email is registered, a reset link has been created.',
      // Prototype only: surfaced so the flow is usable without an email service.
      reset_token: token,
    });
  });
}

/** Reset password with a token. */
export async function PUT(request: Request) {
  return route(async () => {
    const body = await readBody<{ token?: string; password?: string }>(request);
    const token = body.token?.trim() ?? '';
    const password = body.password ?? '';
    if (!token) throw new HttpError('A reset token is required.', 400);
    const passwordError = validatePassword(password);
    if (passwordError) throw new HttpError(passwordError, 400);

    const ok = await transact((db) => consumeResetToken(db, token, password));
    if (!ok) throw new HttpError('That reset token is invalid or has expired.', 400);
    return json({ success: true, message: 'Your password has been updated. You can sign in now.' });
  });
}
