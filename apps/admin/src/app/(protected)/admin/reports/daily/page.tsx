import Link from 'next/link';
import { headers } from 'next/headers';

import { getIntegrityStatus } from '@/lib/integrity';
import { getDailyReport } from '@/lib/reports';

type DailyPageProps = {
  searchParams: Promise<{
    date?: string;
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

export default async function DailyReportPage({ searchParams }: DailyPageProps) {
  const params = await searchParams;
  const selectedDate = params.date ?? toDateValue(new Date());
  const exportHref = `/api/reports/daily/export?date=${encodeURIComponent(selectedDate)}`;
  const pdfHref = `/admin/reports/daily/pdf?date=${encodeURIComponent(selectedDate)}`;

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get('cookie');

  const report = await getDailyReport(
    selectedDate,
    cookieHeader ? { Cookie: cookieHeader } : undefined,
  );
  const integrity = await getIntegrityStatus();
  const exportDisabled = !integrity.ledgerBalanced;

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
        <Link href="/admin/reports" style={{ color: '#2563eb', textDecoration: 'none' }}>
          بازگشت به گزارش‌ها
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>گزارش روزانه</h1>
      </header>

      <form method="get" style={formStyle}>
        <label style={labelStyle}>
          تاریخ
          <input type="date" name="date" defaultValue={selectedDate} required style={inputStyle} />
        </label>
        <button type="submit" style={buttonStyle}>
          نمایش
        </button>
        {exportDisabled ? (
          <>
            <span
              style={{
                ...linkButtonStyle,
                color: '#9ca3af',
                borderColor: '#d1d5db',
                cursor: 'not-allowed',
              }}
              title="به دلیل عدم تراز دفتر کل، خروجی گزارش غیرفعال است."
            >
              دانلود CSV (غیرفعال)
            </span>
            <span
              style={{
                ...linkButtonStyle,
                color: '#9ca3af',
                borderColor: '#d1d5db',
                cursor: 'not-allowed',
              }}
              title="به دلیل عدم تراز دفتر کل، خروجی گزارش غیرفعال است."
            >
              دانلود PDF (غیرفعال)
            </span>
          </>
        ) : (
          <>
            <a href={exportHref} style={linkButtonStyle}>
              دانلود CSV
            </a>
            <Link href={pdfHref} target="_blank" style={linkButtonStyle}>
              دانلود PDF
            </Link>
          </>
        )}
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

      <div style={tableContainerStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map((row) => (
              <tr key={`table-${row.label}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={tdLabelStyle}>{row.label}</td>
                <td style={tdValueStyle}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

const linkButtonStyle: React.CSSProperties = {
  textDecoration: 'none',
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  padding: '8px 14px',
  color: '#111827',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '14px',
  display: 'grid',
  gap: '8px',
};

const tableContainerStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  overflow: 'hidden',
};

const tdLabelStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#6b7280',
};

const tdValueStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 700,
};
