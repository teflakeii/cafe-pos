'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/api';
import { createExpense } from '@/lib/expenses';
import { getShifts } from '@/lib/shifts';
import type { ShiftSummary } from '@/types/shift';

const CATEGORIES = [
  'مواد اولیه',
  'حقوق',
  'اجاره',
  'قبوض',
  'نگهداری',
  'سایر',
] as const;

export default function NewExpensePage() {
  const router = useRouter();

  const [shifts, setShifts] = useState<ShiftSummary[]>([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [pending, setPending] = useState(false);
  const [loadingShift, setLoadingShift] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openShift = useMemo(
    () => shifts.find((shift) => shift.status === 'OPEN') ?? null,
    [shifts],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadShifts() {
      setLoadingShift(true);
      try {
        const rows = await getShifts();
        if (!cancelled) {
          setShifts(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'بارگذاری شیفت ناموفق بود');
        }
      } finally {
        if (!cancelled) {
          setLoadingShift(false);
        }
      }
    }

    void loadShifts();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openShift) {
      setError('شیفت باز موجود نیست');
      return;
    }

    const parsedAmount = Number.parseInt(amount, 10);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setError('مبلغ باید عدد صحیح بزرگ‌تر از صفر باشد');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await createExpense({
        shiftId: openShift.id,
        amount: parsedAmount,
        category,
        description: description.trim(),
        method,
      });
      router.replace('/admin/expenses');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت هزینه ناموفق بود');
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '16px', maxWidth: '640px' }}>
      <header style={{ display: 'grid', gap: '8px' }}>
        <Link href="/admin/expenses" style={{ color: '#2563eb', textDecoration: 'none' }}>
          بازگشت به هزینه‌ها
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>ثبت هزینه جدید</h1>
      </header>

      <form
        onSubmit={handleSubmit}
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '16px',
          display: 'grid',
          gap: '12px',
        }}
      >
        <label style={{ display: 'grid', gap: '6px' }}>
          شیفت فعال
          <input
            value={
              loadingShift ? 'در حال بارگذاری...' : openShift ? `#${openShift.id}` : 'شیفت باز موجود نیست'
            }
            readOnly
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              padding: '9px 10px',
              background: '#f9fafb',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '6px' }}>
          مبلغ
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              padding: '9px 10px',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '6px' }}>
          دسته‌بندی
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              padding: '9px 10px',
            }}
          >
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '6px' }}>
          روش پرداخت
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as 'CASH' | 'CARD')}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              padding: '9px 10px',
            }}
          >
            <option value="CASH">نقدی</option>
            <option value="CARD">بانک</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: '6px' }}>
          توضیحات
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            rows={4}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              padding: '9px 10px',
              resize: 'vertical',
            }}
          />
        </label>

        {error ? <p style={{ margin: 0, color: '#b91c1c' }}>{error}</p> : null}

        <button
          type="submit"
          disabled={pending || loadingShift || !openShift}
          style={{
            border: 'none',
            borderRadius: '10px',
            padding: '10px 14px',
            background: pending || loadingShift || !openShift ? '#9ca3af' : '#2563eb',
            color: '#fff',
            cursor: pending || loadingShift || !openShift ? 'not-allowed' : 'pointer',
            fontWeight: 700,
          }}
        >
          {pending ? 'در حال ثبت...' : 'ثبت هزینه'}
        </button>
      </form>
    </section>
  );
}
