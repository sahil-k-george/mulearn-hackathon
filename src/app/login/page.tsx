'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/lib/store';

export default function Login() {
  const router = useRouter();
  const { signIn } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemo = () => {
    setEmail('sahil@university.edu');
    setPassword('demo1234');
    setError(null);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '64px auto', padding: '0 16px' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="font-brand" style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '8px' }}>
            Adaptive.
          </h1>
          <p className="font-body" style={{ color: 'var(--text-secondary)' }}>
            Welcome back to your academic companion.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <Link href="/forgot-password" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none' }}>
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--accent-warning)', fontSize: '14px', marginBottom: '8px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '8px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 size={18} className="spin" /> : null}
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', marginTop: '12px' }}
            onClick={fillDemo}
          >
            Use demo account
          </button>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/onboarding" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
