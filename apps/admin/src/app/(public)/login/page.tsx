'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { login } from '@/lib/auth';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await login({ email: email.trim(), password });
      router.replace('/admin/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ورود انجام نشد');
    } finally {
      setPending(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 12px 24px rgba(0,0,0,0.06)',
          padding: '20px',
          display: 'grid',
          gap: '12px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>ورود مدیر</h1>

        <label style={{ display: 'grid', gap: '6px' }}>
          <span>ایمیل</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="owner@cafe.local"
            required
            autoComplete="email"
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              padding: '10px 12px',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '6px' }}>
          <span>رمز عبور</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              padding: '10px 12px',
            }}
          />
        </label>

        {error ? (
          <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem' }}>{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          style={{
            border: 'none',
            background: pending ? '#93c5fd' : '#2563eb',
            color: '#ffffff',
            borderRadius: '10px',
            padding: '10px 12px',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'در حال ورود...' : 'ورود'}
        </button>
      </form>
    </main>
  );
}
