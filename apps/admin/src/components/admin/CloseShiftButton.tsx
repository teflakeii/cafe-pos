'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { closeShift } from '@/lib/shifts';

type CloseShiftButtonProps = {
  shiftId: number;
  disabled?: boolean;
  disabledMessage?: string;
};

export function CloseShiftButton({
  shiftId,
  disabled = false,
  disabledMessage,
}: CloseShiftButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCloseShift() {
    setPending(true);
    setError(null);

    try {
      await closeShift(shiftId);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message);
      } else if (err instanceof ApiError) {
        setError(`خطا: ${err.message}`);
      } else {
        setError('خطای ناشناخته در بستن شیفت');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <button
        type="button"
        onClick={handleCloseShift}
        disabled={pending || disabled}
        style={{
          border: 'none',
          background: disabled ? '#9ca3af' : pending ? '#fca5a5' : '#dc2626',
          color: '#ffffff',
          borderRadius: '10px',
          padding: '10px 14px',
          fontWeight: 700,
          cursor: pending || disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {disabled
          ? 'بستن شیفت غیرفعال است'
          : pending
            ? 'در حال بستن شیفت...'
            : 'بستن شیفت'}
      </button>

      {disabled && disabledMessage ? (
        <p style={{ margin: 0, color: '#9a3412', fontSize: '0.9rem' }}>
          {disabledMessage}
        </p>
      ) : null}

      {error ? (
        <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.9rem' }}>{error}</p>
      ) : null}
    </div>
  );
}
