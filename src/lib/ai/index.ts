/**
 * AIService factory (plan section 17).
 *
 * Resolution order for a request:
 *   1. The user's own saved provider + key + model (Settings page).
 *   2. Server environment (AI_PROVIDER + matching key) as a deployment default.
 *   3. Deterministic mock — ONLY when the account is in demo mode.
 *
 * A real account with no key receives `service: null` and a message asking them
 * to add a key, rather than silently producing mock output.
 */

import type {
  AIProviderName,
  AIService,
  BrainDumpContext,
  GoalDecompositionContext,
  NotesSplitContext,
  QuizQuestion,
} from './types';
import type {
  AISettings,
  AIProviderKey,
  BrainDumpExtraction,
  BrainDumpTask,
  NotesPrepPlan,
} from '../domain';
import { MockProvider } from './providers/mock';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import { GeminiProvider } from './providers/gemini';
import { defaultModelFor, getProvider } from './models';

export type AIStatus = {
  /** Provider chosen by the user, or 'env' when inherited from the server. */
  configured: AIProviderKey;
  /** Provider actually used, or 'none' when a key is required but missing. */
  active: AIProviderKey | 'none';
  source: 'user' | 'env' | 'demo' | 'none';
  model: string;
  mock_fallback: boolean;
  requires_key: boolean;
  demo_mode: boolean;
  message: string;
};

export type ResolvedAI = { service: AIService | null; status: AIStatus };

/** Wraps a primary provider and degrades to the mock (demo only). */
class FallbackAIService implements AIService {
  private primary: AIService;
  private fallback = new MockProvider();
  private failed = false;

  constructor(primary: AIService) {
    this.primary = primary;
  }

  get name(): AIProviderName {
    return this.failed ? 'mock' : this.primary.name;
  }

  get didFallback(): boolean {
    return this.failed;
  }

  private async run<T>(call: (svc: AIService) => Promise<T>): Promise<T> {
    try {
      return await call(this.primary);
    } catch (error) {
      this.failed = true;
      console.error(`[ai] ${this.primary.name} failed, falling back to mock (demo):`, error);
      return call(this.fallback);
    }
  }

  extractBrainDump(text: string, context: BrainDumpContext): Promise<BrainDumpExtraction> {
    return this.run((svc) => svc.extractBrainDump(text, context));
  }
  decomposeGoal(context: GoalDecompositionContext): Promise<BrainDumpTask[]> {
    return this.run((svc) => svc.decomposeGoal(context));
  }
  splitNotes(text: string, context: NotesSplitContext): Promise<NotesPrepPlan> {
    return this.run((svc) => svc.splitNotes(text, context));
  }
  explainRecommendation(input: { title: string; reasons: string[]; minutes: number }) {
    return this.run((svc) => svc.explainRecommendation(input));
  }
  suggestStudyTechniques(input: { topic: string; subjectName: string; knowledgeLevel: number }) {
    return this.run((svc) => svc.suggestStudyTechniques(input));
  }
  generateQuiz(input: { topic: string; subjectName: string; count: number }): Promise<QuizQuestion[]> {
    return this.run((svc) => svc.generateQuiz(input));
  }
}

/** Instantiate a provider for a key + credentials. */
export function createProvider(
  providerKey: AIProviderKey,
  apiKey: string,
  model?: string
): AIService | null {
  const resolvedModel = model || defaultModelFor(providerKey);
  switch (providerKey) {
    case 'openai':
      return new OpenAICompatibleProvider({
        name: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey,
        model: resolvedModel,
        label: 'OpenAI',
      });
    case 'openrouter':
      return new OpenAICompatibleProvider({
        name: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey,
        model: resolvedModel,
        label: 'OpenRouter',
        extraHeaders: {
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Adaptive Academic Companion',
        },
      });
    case 'grok':
      return new OpenAICompatibleProvider({
        name: 'grok',
        baseUrl: 'https://api.x.ai/v1',
        apiKey,
        model: resolvedModel,
        label: 'Grok',
      });
    case 'gemini':
      return new GeminiProvider(apiKey, resolvedModel);
    case 'mock':
      return new MockProvider();
    default:
      return null;
  }
}

/** Provider configured via server environment variables, if any. */
export function envProvider(): { service: AIService; key: AIProviderKey; model: string } | null {
  const requested = (process.env.AI_PROVIDER || '').toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const grokKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;

  if (requested === 'openrouter' && openrouterKey) {
    return {
      service: createProvider('openrouter', openrouterKey, process.env.OPENROUTER_MODEL)!,
      key: 'openrouter',
      model: process.env.OPENROUTER_MODEL || defaultModelFor('openrouter'),
    };
  }
  if (requested === 'grok' && grokKey) {
    return {
      service: createProvider('grok', grokKey, process.env.GROK_MODEL)!,
      key: 'grok',
      model: process.env.GROK_MODEL || defaultModelFor('grok'),
    };
  }
  if (requested === 'openai' && openaiKey) {
    return {
      service: createProvider('openai', openaiKey, process.env.OPENAI_MODEL)!,
      key: 'openai',
      model: process.env.OPENAI_MODEL || defaultModelFor('openai'),
    };
  }
  if (requested === 'gemini' && geminiKey) {
    return {
      service: createProvider('gemini', geminiKey, process.env.GEMINI_MODEL)!,
      key: 'gemini',
      model: process.env.GEMINI_MODEL || defaultModelFor('gemini'),
    };
  }
  return null;
}

/**
 * Resolve the AI service for a request.
 *
 * @param settings the user's saved AI settings (may be null)
 * @param isDemo   whether the account is the demo account / demo mode
 */
export function resolveAI(settings: AISettings | null, isDemo: boolean): ResolvedAI {
  // 1. User-configured provider.
  if (settings && settings.provider !== 'mock' && settings.provider !== 'env' && settings.api_key) {
    const service = createProvider(settings.provider, settings.api_key, settings.model);
    if (service) {
      const wrapped = isDemo ? new FallbackAIService(service) : service;
      return {
        service: wrapped,
        status: {
          configured: settings.provider,
          active: service.name,
          source: 'user',
          model: settings.model || defaultModelFor(settings.provider),
          mock_fallback: false,
          requires_key: false,
          demo_mode: isDemo,
          message: `Using your ${getProvider(settings.provider)?.label ?? settings.provider} key.`,
        },
      };
    }
  }

  // 2. Explicit deterministic choice (works for any account — it is a choice,
  // not a fallback).
  if (settings && settings.provider === 'mock') {
    return {
      service: new MockProvider(),
      status: {
        configured: 'mock',
        active: 'mock',
        source: isDemo ? 'demo' : 'user',
        model: 'deterministic',
        mock_fallback: !isDemo,
        requires_key: false,
        demo_mode: isDemo,
        message: 'Using the built-in deterministic engine (no AI key).',
      },
    };
  }

  // 3. Server environment default.
  const env = envProvider();
  if (env) {
    return {
      service: env.service,
      status: {
        configured: 'env',
        active: env.service.name,
        source: 'env',
        model: env.model,
        mock_fallback: false,
        requires_key: false,
        demo_mode: isDemo,
        message: `Using the server-configured ${env.key} provider.`,
      },
    };
  }

  // 4. Demo account without any key: deterministic mock is allowed.
  if (isDemo) {
    return {
      service: new MockProvider(),
      status: {
        configured: 'mock',
        active: 'mock',
        source: 'demo',
        model: 'deterministic',
        mock_fallback: true,
        requires_key: false,
        demo_mode: true,
        message: 'Demo mode — deterministic extraction, no AI key needed.',
      },
    };
  }

  // 5. Real account without a key: no service. The caller must handle this.
  return {
    service: null,
    status: {
      configured: settings?.provider ?? 'mock',
      active: 'none',
      source: 'none',
      model: '',
      mock_fallback: false,
      requires_key: true,
      demo_mode: false,
      message: 'Add an AI provider key in Settings to use brain dump and notes splitting.',
    },
  };
}

/** Safe, client-facing view of a user's AI settings (never returns the key). */
export function maskKey(key: string): string | null {
  if (!key) return null;
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
