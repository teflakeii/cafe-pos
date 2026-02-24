'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/lib/api';
import { deleteExpense, getExpenses } from '@/lib/expenses';
import { getShifts } from '@/lib/shifts';
import type { AdminExpense } from '@/types/expense';
import type { ShiftSummary } from '@/types/shift';

const numberFormatter = new Intl.NumberFormat('fa-IR');

function formatMoney(value: number): string {
  return `${numberFormatter.format(value)} تومان`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('fa-IR');
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<AdminExpense[]>([]);
  const [shifts, setShifts] = useState<ShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const openShift = useMemo(
    () => shifts.find((shift) => shift.status === 'OPEN') ?? null,
    [shifts],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [expenseRows, shiftRows] = await Promise.all([getExpenses(), getShifts()]);
      setExpenses(expenseRows);
      setShifts(shiftRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بارگذاری هزینه‌ها ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleDelete(id: number) {
    if (!confirm('آیا از حذف (Void) این هزینه مطمئن هستید؟')) {
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      await deleteExpense(id);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حذف هزینه ناموفق بود');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem' }}>هزینه‌ها</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            ثبت و مدیریت هزینه‌های عملیاتی شیفت
          </p>
        </div>

        {openShift ? (
          <Link
            href="/admin/expenses/new"
            style={{
              textDecoration: 'none',
              background: '#2563eb',
              color: '#fff',
              borderRadius: '10px',
              padding: '9px 14px',
            }}
          >
            افزودن هزینه
          </Link>
        ) : (
          <span
            style={{
              background: '#f3f4f6',
              color: '#6b7280',
              borderRadius: '10px',
              padding: '9px 14px',
            }}
            title="شیفت باز موجود نیست"
          >
            افزودن هزینه (غیرفعال)
          </span>
        )}
      </header>

      {error ? (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fff1f2',
            color: '#9f1239',
            borderRadius: '12px',
            padding: '10px 12px',
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['ID', 'شیفت', 'مبلغ', 'دسته‌بندی', 'توضیحات', 'تاریخ', 'اقدامات'].map((header) => (
                <th
                  key={header}
                  style={{
                    textAlign: 'right',
                    padding: '10px 12px',
                    color: '#6b7280',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '14px 12px', color: '#6b7280' }}>
                  در حال بارگذاری...
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '14px 12px', color: '#6b7280' }}>
                  هزینه‌ای ثبت نشده است
                </td>
              </tr>
            ) : (
              expenses.map((expense) => {
                const canDelete = !expense.isVoided && expense.shiftStatus === 'OPEN';

                return (
                  <tr key={expense.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px' }}>{expense.id}</td>
                    <td style={{ padding: '10px 12px' }}>
                      #{expense.shiftId}{' '}
                      <span style={{ color: expense.shiftStatus === 'OPEN' ? '#166534' : '#6b7280' }}>
                        ({expense.shiftStatus === 'OPEN' ? 'باز' : 'بسته'})
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatMoney(expense.amount)}</td>
                    <td style={{ padding: '10px 12px' }}>{expense.category}</td>
                    <td style={{ padding: '10px 12px' }}>{expense.description}</td>
                    <td style={{ padding: '10px 12px' }}>{formatDate(expense.createdAt)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {expense.isVoided ? (
                        <span style={{ color: '#b45309', fontWeight: 700 }}>باطل‌شده</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canDelete || deletingId === expense.id}
                          onClick={() => handleDelete(expense.id)}
                          style={{
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            background: canDelete ? '#dc2626' : '#9ca3af',
                            color: '#fff',
                            cursor: canDelete ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {deletingId === expense.id ? '...' : 'حذف'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
