'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/lib/store';

export default function ForgotPassword() {
  const router = useRouter();
  const { requestPasswordReset, resetPassword } = useApp();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result.message);
      if (result.reset_token) {
        setToken(result.reset_token);
        setStep('reset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await resetPassword(token.trim(), password);
      setMessage(result);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '64px auto', padding: '0 16px' }}>
      <div className="card">
        <h1 className="font-heading" style={{ fontSize: '1.6rem', marginBottom: '8px' }}>
          Reset your password
        </h1>
        <p className="font-body" style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
          {step === 'request'
            ? 'Enter your account email and we will create a reset token.'
            : step === 'reset'
            ? 'Your reset token is shown below. Choose a new password.'
            : 'Your password has been updated.'}
        </p>

        {step === 'request' && (
          <form onSubmit={handleRequest}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p style={{ color: 'var(--accent-warning)', fontSize: '14px' }}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={18} className="spin" />} Create reset token
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset}>
            <div className="form-group">
              <label className="form-label" htmlFor="token">
                Reset token
              </label>
              <input
                id="token"
                className="input-field"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error && <p style={{ color: 'var(--accent-warning)', fontSize: '14px' }}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isSubmitting}>
              {isSubmitting && <Loader2 size={18} className="spin" />} Set new password
            </button>
          </form>
        )}

        {message && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '16px' }}>{message}</p>
        )}

        {step === 'done' && (
          <button className="btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={() => router.push('/login')}>
            Back to sign in
          </button>
        )}

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
          <Link href="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
