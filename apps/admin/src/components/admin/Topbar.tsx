'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { logout } from '@/lib/auth';
import { ApiError } from '@/lib/api';

type TopbarProps = {
  email?: string;
};

export function Topbar({ email }: TopbarProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setPending(true);
    setError(null);

    try {
      await logout();
      router.replace('/login');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در خروج از حساب');
    } finally {
      setPending(false);
    }
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '14px 18px',
      }}
    >
      <div style={{ display: 'grid', gap: '4px' }}>
        <strong style={{ fontSize: '0.95rem' }}>پنل مدیریت</strong>
        {email ? (
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{email}</span>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: '6px', justifyItems: 'end' }}>
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          style={{
            border: '1px solid #d1d5db',
            background: pending ? '#f3f4f6' : '#ffffff',
            borderRadius: '10px',
            padding: '8px 12px',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'در حال خروج...' : 'خروج'}
        </button>

        {error ? (
          <span style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{error}</span>
        ) : null}
      </div>
    </header>
  );
}
