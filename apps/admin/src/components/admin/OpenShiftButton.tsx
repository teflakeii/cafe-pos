'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { openShift } from '@/lib/shifts';

function toPersianError(error: ApiError): string {
  if (error.status === 400) {
    if (error.message === 'Another shift is already open') {
      return 'در حال حاضر یک شیفت باز وجود دارد.';
    }

    if (error.message === 'Opening cash must be non-negative integer') {
      return 'مقدار موجودی اولیه نامعتبر است.';
    }
  }

  if (error.status === 401) {
    return 'نشست شما منقضی شده است. دوباره وارد شوید.';
  }

  if (error.status === 403) {
    return 'شما دسترسی لازم برای باز کردن شیفت را ندارید.';
  }

  return `خطا در باز کردن شیفت: ${error.message}`;
}

export function OpenShiftButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenShift() {
    setPending(true);
    setError(null);

    try {
      await openShift(0);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(toPersianError(err));
      } else {
        setError('خطای ناشناخته در باز کردن شیفت');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '8px', justifyItems: 'start' }}>
      <button
        type="button"
        onClick={handleOpenShift}
        disabled={pending}
        style={{
          border: 'none',
          background: pending ? '#93c5fd' : '#2563eb',
          color: '#ffffff',
          borderRadius: '10px',
          padding: '10px 14px',
          fontWeight: 700,
          cursor: pending ? 'not-allowed' : 'pointer',
        }}
      >
        {pending ? 'در حال باز کردن شیفت...' : 'باز کردن شیفت'}
      </button>

      {error ? (
        <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem' }}>{error}</p>
      ) : null}
    </div>
  );
}
