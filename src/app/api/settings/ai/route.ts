import { json, readBody, requireUser, route, HttpError } from '@/lib/server/http';
import { getAISettings, saveAISettings, toPublicAISettings, isDemoUser } from '@/lib/server/repo';
import { readDb, transact } from '@/lib/server/store';
import { PROVIDERS, defaultModelFor, getProvider, providerRequiresKey } from '@/lib/ai/models';
import { resolveAI } from '@/lib/ai';
import type { AIProviderKey } from '@/lib/domain';

const SELECTABLE = PROVIDERS.filter((p) => p.key !== 'env').map((p) => p.key);

export async function GET() {
  return route(async () => {
    const user = await requireUser();
    const db = await readDb();
    const settings = getAISettings(db, user.id);
    const { status } = resolveAI(settings, isDemoUser(user));

    return json({
      settings: toPublicAISettings(settings),
      providers: PROVIDERS,
      status,
      demo_mode: isDemoUser(user),
    });
  });
}

export async function PATCH(request: Request) {
  return route(async () => {
    const user = await requireUser();
    const body = await readBody<{
      provider?: AIProviderKey;
      api_key?: string;
      model?: string;
      clear_key?: boolean;
    }>(request);

    if (!body.provider || !SELECTABLE.includes(body.provider)) {
      throw new HttpError('Choose a valid AI provider.', 400);
    }

    const provider: AIProviderKey = body.provider;
    const meta = getProvider(provider);
    if (!meta) throw new HttpError('Unknown provider.', 400);

    const saved = await transact((db) => {
      const existing = getAISettings(db, user.id);
      const willHaveKey =
        !body.clear_key && Boolean((body.api_key && body.api_key.trim()) || existing?.api_key);

      // Real accounts must end up with a key; the demo account may stay keyless.
      if (providerRequiresKey(provider) && !willHaveKey && !isDemoUser(user)) {
        throw new HttpError(
          `${meta.label} needs an API key. Paste one to continue, or use the demo account.`,
          400
        );
      }

      return saveAISettings(db, user.id, {
        provider,
        api_key: body.api_key,
        model: body.model && body.model.trim() ? body.model.trim() : defaultModelFor(provider),
        clear_key: body.clear_key,
      });
    });

    const db = await readDb();
    const { status } = resolveAI(saved, isDemoUser(user));
    return json({ settings: toPublicAISettings(saved), status });
  });
}
