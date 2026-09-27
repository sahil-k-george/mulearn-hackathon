'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/lib/store';

export default function Onboarding() {
  const router = useRouter();
  const { signUp } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '48px auto', padding: '0 16px' }}>
      <h1 className="font-heading" style={{ fontSize: '2.5rem', marginBottom: '12px', textAlign: 'center' }}>
        Welcome to Adaptive
      </h1>
      <p className="font-body" style={{ color: 'var(--text-secondary)', marginBottom: '40px', textAlign: 'center' }}>
        Create your account so we can personalise your study plans.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 className="font-heading" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>
            Your details
          </h2>

          <div className="form-group">
            <label className="form-label" htmlFor="name">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              className="input-field"
              placeholder="Sahil Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>

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
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="At least 8 characters, with a number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="timezone">
              Timezone
            </label>
            <select
              id="timezone"
              className="input-field"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option>Asia/Kolkata (IST)</option>
              <option>America/New_York (EST)</option>
              <option>Europe/London (GMT)</option>
              <option>Asia/Singapore (SGT)</option>
              <option>UTC</option>
            </select>
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--accent-warning)', fontSize: '14px' }}>
              {error}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <Link href="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '14px' }}>
            Already have an account?
          </Link>
          <button
            type="submit"
            className="btn-primary"
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 size={18} className="spin" />}
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}
