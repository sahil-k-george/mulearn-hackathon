import { json, optionalUser, route } from '@/lib/server/http';
import { resolveAI } from '@/lib/ai';
import { resolveAIForUser } from '@/lib/server/ai';
import { getPreferences } from '@/lib/server/repo';
import { getActiveStoreName, isSupabaseConfigured, readDb } from '@/lib/server/store';

export async function GET() {
  return route(async () => {
    const user = await optionalUser();

    let preferences = null;
    let ai = resolveAI(null, false).status;

    if (user) {
      const db = await readDb();
      preferences = getPreferences(db, user.id);
      ai = resolveAIForUser(db, user).status;
    }

    return json({
      user,
      preferences,
      ai,
      store: {
        active: getActiveStoreName(),
        supabase_configured: isSupabaseConfigured(),
      },
    });
  });
}
