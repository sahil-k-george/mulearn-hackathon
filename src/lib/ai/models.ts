/**
 * Provider + model catalog for the AI settings UI.
 *
 * Kept intentionally small and curated, with a "custom model" option in the UI
 * so users are not locked to this list.
 */

import type { AIProviderKey } from '../domain';

export type ProviderMeta = {
  key: AIProviderKey;
  label: string;
  requires_key: boolean;
  base_url: string | null;
  key_hint: string;
  docs_url: string;
  models: { id: string; label: string }[];
  default_model: string;
};

export const PROVIDERS: ProviderMeta[] = [
  {
    key: 'openrouter',
    label: 'OpenRouter',
    requires_key: true,
    base_url: 'https://openrouter.ai/api/v1',
    key_hint: 'sk-or-v1-…',
    docs_url: 'https://openrouter.ai/keys',
    default_model: 'openai/gpt-4o-mini',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { id: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5' },
      { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' },
    ],
  },
  {
    key: 'grok',
    label: 'Grok (xAI)',
    requires_key: true,
    base_url: 'https://api.x.ai/v1',
    key_hint: 'xai-…',
    docs_url: 'https://console.x.ai',
    default_model: 'grok-2-latest',
    models: [
      { id: 'grok-2-latest', label: 'Grok 2 (latest)' },
      { id: 'grok-2-1212', label: 'Grok 2 (1212)' },
      { id: 'grok-beta', label: 'Grok beta' },
      { id: 'grok-3', label: 'Grok 3' },
      { id: 'grok-3-mini', label: 'Grok 3 mini' },
    ],
  },
  {
    key: 'openai',
    label: 'OpenAI',
    requires_key: true,
    base_url: 'https://api.openai.com/v1',
    key_hint: 'sk-…',
    docs_url: 'https://platform.openai.com/api-keys',
    default_model: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
    ],
  },
  {
    key: 'gemini',
    label: 'Google Gemini',
    requires_key: true,
    base_url: 'https://generativelanguage.googleapis.com',
    key_hint: 'AIza…',
    docs_url: 'https://aistudio.google.com/app/apikey',
    default_model: 'gemini-1.5-flash',
    models: [
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  {
    key: 'mock',
    label: 'Deterministic (no key)',
    requires_key: false,
    base_url: null,
    key_hint: '',
    docs_url: '',
    default_model: 'deterministic',
    models: [{ id: 'deterministic', label: 'Built-in deterministic engine' }],
  },
];

export function getProvider(key: AIProviderKey): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.key === key);
}

export function providerRequiresKey(key: AIProviderKey): boolean {
  return getProvider(key)?.requires_key ?? false;
}

export function defaultModelFor(key: AIProviderKey): string {
  return getProvider(key)?.default_model ?? 'deterministic';
}
