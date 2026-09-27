import { json, route, getSessionToken } from '@/lib/server/http';
import { SESSION_COOKIE } from '@/lib/server/auth';
import { deleteSession } from '@/lib/server/repo';
import { transact } from '@/lib/server/store';

export async function POST() {
  return route(async () => {
    const token = await getSessionToken();
    if (token) {
      await transact((db) => {
        deleteSession(db, token);
      });
    }
    const response = json({ success: true });
    response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  });
}
