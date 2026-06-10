import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { ApiError } from '@/lib/api';
import { getShiftReport } from '@/lib/reports';

type ShiftReportPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat('fa-IR');

function formatMoney(value: number): string {
  return `${numberFormatter.format(value)} تومان`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('fa-IR');
}

export default async function ShiftReportPage({ params }: ShiftReportPageProps) {
  const { id } = await params;
  const shiftId = Number(id);

  if (!Number.isInteger(shiftId) || shiftId <= 0) {
    notFound();
  }

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get('cookie');

  let report;
  try {
    report = await getShiftReport(
      shiftId,
      cookieHeader ? { Cookie: cookieHeader } : undefined,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const rows = [
    { label: 'فروش کل', value: formatMoney(report.totalSales) },
    { label: 'درآمد بازی', value: formatMoney(report.totalGameRevenue) },
    { label: 'درآمد سفارش', value: formatMoney(report.totalOrderRevenue) },
    { label: 'پرداخت‌ها', value: formatMoney(report.totalPayments) },
    { label: 'تخفیف', value: formatMoney(report.totalDiscount) },
    { label: 'هزینه', value: formatMoney(report.totalExpense) },
    { label: 'بدهی', value: formatMoney(report.outstanding) },
    { label: 'سود', value: formatMoney(report.profit) },
    { label: 'دلتا', value: numberFormatter.format(report.delta) },
  ] as const;

  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <header style={{ display: 'grid', gap: '8px' }}>
        <Link href="/admin/reports/shift" style={{ color: '#2563eb', textDecoration: 'none' }}>
          انتخاب شیفت دیگر
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>گزارش شیفت #{report.shiftId}</h1>
        <p style={{ margin: 0, color: '#6b7280' }}>
          شروع: {formatDate(report.openedAt)} | پایان: {formatDate(report.closedAt)}
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        {rows.map((row) => (
          <article key={row.label} style={cardStyle}>
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>{row.label}</span>
            <strong style={{ fontSize: '1.1rem' }}>{row.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '14px',
  display: 'grid',
  gap: '8px',
};
