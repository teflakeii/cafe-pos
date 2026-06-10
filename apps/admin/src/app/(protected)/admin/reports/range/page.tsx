import Link from 'next/link';
import { headers } from 'next/headers';

import { getRangeReport } from '@/lib/reports';

type RangeReportPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat('fa-IR');

function formatMoney(value: number): string {
  return `${numberFormatter.format(value)} تومان`;
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function RangeReportPage({ searchParams }: RangeReportPageProps) {
  const params = await searchParams;
  const today = toDateValue(new Date());
  const from = params.from ?? today;
  const to = params.to ?? today;

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get('cookie');

  const report = await getRangeReport(
    from,
    to,
    cookieHeader ? { Cookie: cookieHeader } : undefined,
  );

  const rows = [
    { label: 'فروش کل', value: formatMoney(report.totalSales) },
    { label: 'درآمد بازی', value: formatMoney(report.totalGameRevenue) },
    { label: 'درآمد سفارش', value: formatMoney(report.totalOrderRevenue) },
    { label: 'پرداخت‌ها', value: formatMoney(report.totalPayments) },
    { label: 'تخفیف', value: formatMoney(report.totalDiscount) },
    { label: 'هزینه', value: formatMoney(report.totalExpense) },
    { label: 'بدهی', value: formatMoney(report.outstanding) },
    { label: 'سود', value: formatMoney(report.profit) },
  ] as const;

  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <header style={{ display: 'grid', gap: '8px' }}>
        <Link href="/admin/reports" style={{ color: '#2563eb', textDecoration: 'none' }}>
          بازگشت به گزارش‌ها
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>گزارش بازه زمانی</h1>
      </header>

      <form method="get" style={formStyle}>
        <label style={labelStyle}>
          از تاریخ
          <input type="date" name="from" defaultValue={from} required style={inputStyle} />
        </label>
        <label style={labelStyle}>
          تا تاریخ
          <input type="date" name="to" defaultValue={to} required style={inputStyle} />
        </label>
        <button type="submit" style={buttonStyle}>
          نمایش
        </button>
      </form>

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

const formStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '14px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  alignItems: 'end',
};

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontSize: '0.9rem',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  padding: '8px 10px',
};

const buttonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  padding: '9px 14px',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '14px',
  display: 'grid',
  gap: '8px',
};
