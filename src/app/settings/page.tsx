'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { PROVIDERS, defaultModelFor, getProvider } from '@/lib/ai/models';
import type { AIProviderKey } from '@/lib/domain';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

const CUSTOM = '__custom__';

export default function Settings() {
  const { isLoaded, aiSettings, aiStatus, demoMode, saveAISettings } = useApp();

  const [provider, setProvider] = useState<AIProviderKey>('openrouter');
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!aiSettings) return;
    setProvider(aiSettings.provider === 'env' ? 'openrouter' : aiSettings.provider);
    const meta = getProvider(aiSettings.provider);
    const known = meta?.models.some((m) => m.id === aiSettings.model) ?? false;
    setModel(aiSettings.model || defaultModelFor(aiSettings.provider));
    setCustomModel(Boolean(aiSettings.model) && !known && aiSettings.provider !== 'mock');
  }, [aiSettings]);

  if (!isLoaded) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <LoadingSkeleton type="cards" />
      </div>
    );
  }

  const meta = getProvider(provider);
  const requiresKey = meta?.requires_key ?? false;

  const handleProviderChange = (next: AIProviderKey) => {
    setProvider(next);
    const nextMeta = getProvider(next);
    const modelIsKnown = nextMeta?.models.some((m) => m.id === model) ?? false;
    if (!modelIsKnown) {
      setModel(defaultModelFor(next));
      setCustomModel(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await saveAISettings({
        provider,
        api_key: apiKey.trim() || undefined,
        model: model.trim() || defaultModelFor(provider),
      });
      setApiKey('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your AI settings.');
    } finally {
      setBusy(false);
    }
  };

  const handleClearKey = async () => {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await saveAISettings({ provider, model: model.trim() || defaultModelFor(provider), clear_key: true });
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear the key.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: '760px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 className="font-brand" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '8px' }}>
          AI Settings
        </h1>
        <p className="font-body" style={{ color: 'var(--text-secondary)' }}>
          Bring your own API key. It is stored server-side and never sent back to the browser.
        </p>
      </header>

      {demoMode && (
        <div className="card-static" style={{ padding: '18px', marginBottom: '24px', borderColor: 'var(--accent-info)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <Sparkles size={16} color="var(--accent-info)" />
            Demo account — the deterministic engine is used when no key is configured.
          </p>
        </div>
      )}

      {aiStatus && (
        <div
          className="card-static"
          style={{
            padding: '18px',
            marginBottom: '24px',
            borderColor: aiStatus.requires_key ? 'var(--accent-warning)' : 'var(--border-light)',
          }}
        >
          <p style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            {aiStatus.requires_key ? (
              <AlertTriangle size={16} color="var(--accent-warning)" />
            ) : (
              <CheckCircle2 size={16} color="var(--accent-success)" />
            )}
            {aiStatus.message}
          </p>
          {!aiStatus.requires_key && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Active provider: {aiStatus.active} · model: {aiStatus.model || defaultModelFor(provider)}
            </p>
          )}
        </div>
      )}

      <form className="card-static" style={{ padding: '28px' }} onSubmit={handleSave}>
        <div className="form-group">
          <label className="form-label" htmlFor="provider">
            Provider
          </label>
          <select
            id="provider"
            className="input-field"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AIProviderKey)}
          >
            {PROVIDERS.filter((p) => p.key !== 'env').map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          {meta?.docs_url && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              <a
                href={meta.docs_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Get a {meta.label} key <ExternalLink size={12} />
              </a>
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            className="input-field"
            value={customModel ? CUSTOM : model}
            onChange={(e) => {
              if (e.target.value === CUSTOM) {
                setCustomModel(true);
              } else {
                setCustomModel(false);
                setModel(e.target.value);
              }
            }}
          >
            {(meta?.models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value={CUSTOM}>Custom model…</option>
          </select>
          {customModel && (
            <input
              className="input-field"
              style={{ marginTop: '8px' }}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. anthropic/claude-3-opus"
              aria-label="Custom model id"
            />
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="api-key">
            API key {requiresKey ? '' : '(not needed)'}
          </label>
          <input
            id="api-key"
            type="password"
            className="input-field"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={!requiresKey}
            placeholder={
              aiSettings?.has_key
                ? `Stored: ${aiSettings.masked_key} — leave blank to keep`
                : meta?.key_hint || 'Paste your API key'
            }
            autoComplete="off"
          />
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            The key is stored on the server for your account only. Clearing it removes it.
          </p>
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--accent-warning)', fontSize: '14px' }}>
            {error}
          </p>
        )}
        {saved && (
          <p style={{ color: 'var(--accent-success)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} /> Settings saved.
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <KeyRound size={18} />} Save settings
          </button>
          {aiSettings?.has_key && (
            <button type="button" className="btn-secondary" onClick={handleClearKey} disabled={busy}>
              Clear stored key
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
