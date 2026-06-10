import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { CloseShiftButton } from '@/components/admin/CloseShiftButton';
import { ApiError } from '@/lib/api';
import { getIntegrityStatus } from '@/lib/integrity';
import { getShiftById } from '@/lib/shifts';

type ShiftDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const formatter = new Intl.NumberFormat('fa-IR');

function formatMoney(value: number): string {
  return `${formatter.format(value)} تومان`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('fa-IR');
}

export default async function ShiftDetailPage({ params }: ShiftDetailPageProps) {
  const { id } = await params;
  const shiftId = Number(id);

  if (!Number.isInteger(shiftId) || shiftId <= 0) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get('cookie');

  let detail;
  try {
    detail = await getShiftById(
      shiftId,
      cookieHeader ? { Cookie: cookieHeader } : undefined,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  let closeDisabledByLedger = false;
  try {
    const integrity = await getIntegrityStatus();
    closeDisabledByLedger = !integrity.ledgerBalanced;
  } catch {
    closeDisabledByLedger = false;
  }

  const cards = [
    { label: 'فروش کل', value: formatMoney(detail.totalSales) },
    { label: 'درآمد بازی', value: formatMoney(detail.totalGameRevenue) },
    { label: 'درآمد سفارش', value: formatMoney(detail.totalOrderRevenue) },
    { label: 'پرداخت‌ها', value: formatMoney(detail.totalPayments) },
    { label: 'تخفیف', value: formatMoney(detail.totalDiscount) },
    { label: 'هزینه', value: formatMoney(detail.totalExpense) },
    { label: 'بدهی معوق', value: formatMoney(detail.outstandingAmount) },
    { label: 'دلتا', value: formatter.format(detail.delta) },
  ] as const;

  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <header style={{ display: 'grid', gap: '6px' }}>
        <Link href="/admin/shifts" style={{ color: '#2563eb', textDecoration: 'none' }}>
          بازگشت به لیست شیفت‌ها
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>جزئیات شیفت #{detail.id}</h1>
        <p style={{ margin: 0, color: '#6b7280' }}>
          شروع: {formatDate(detail.openedAt)} | پایان: {formatDate(detail.closedAt)} | وضعیت:{' '}
          {detail.status === 'OPEN' ? 'باز' : 'بسته'}
        </p>
      </header>

      {detail.status === 'OPEN' ? (
        <CloseShiftButton
          shiftId={detail.id}
          disabled={closeDisabledByLedger}
          disabledMessage="به دلیل عدم توازن Ledger، بستن شیفت موقتاً غیرفعال است."
        />
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        {cards.map((card) => (
          <article
            key={card.label}
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '14px',
              padding: '14px',
              display: 'grid',
              gap: '8px',
            }}
          >
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>{card.label}</span>
            <strong
              style={{
                fontSize: '1.15rem',
                color:
                  card.label === 'بدهی معوق' && detail.outstandingAmount > 0
                    ? '#b91c1c'
                    : '#111827',
              }}
            >
              {card.value}
            </strong>
          </article>
        ))}
      </div>
    </section>
  );
}
