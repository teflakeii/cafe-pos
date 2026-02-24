import { headers } from 'next/headers';

import { getDailyReport } from '@/lib/reports';
import { AutoPrint } from './auto-print';
import { PrintActions } from './print-actions';

type DailyPdfPageProps = {
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

export default async function DailyReportPdfPage({
  searchParams,
}: DailyPdfPageProps) {
  const params = await searchParams;
  const selectedDate = params.date ?? toDateValue(new Date());

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get('cookie');
  const report = await getDailyReport(
    selectedDate,
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
    { label: 'دلتا', value: numberFormatter.format(report.delta) },
  ] as const;

  return (
    <main dir="rtl" style={pageStyle}>
      <AutoPrint />

      <section style={sheetStyle}>
        <header style={headerStyle}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>گزارش روزانه کافه</h1>
          <p style={{ margin: 0, color: '#4b5563' }}>تاریخ: {report.date}</p>
        </header>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>شاخص</th>
              <th style={thStyle}>مقدار</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td style={tdLabelStyle}>{row.label}</td>
                <td style={tdValueStyle}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer style={footerStyle}>
          <span>نسخه چاپی گزارش روزانه</span>
          <span>{new Date().toLocaleString('fa-IR')}</span>
        </footer>
      </section>

      <PrintActions date={report.date} />
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f3f4f6',
  padding: '24px',
  display: 'grid',
  gap: '16px',
  justifyItems: 'center',
};

const sheetStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '760px',
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '18px',
  padding: '20px',
  boxShadow: '0 8px 25px rgba(15, 23, 42, 0.08)',
};

const headerStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  marginBottom: '16px',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  border: '1px solid #e5e7eb',
};

const thStyle: React.CSSProperties = {
  borderBottom: '1px solid #e5e7eb',
  padding: '10px',
  textAlign: 'right',
  background: '#f8fafc',
};

const tdLabelStyle: React.CSSProperties = {
  borderTop: '1px solid #f1f5f9',
  padding: '10px',
  color: '#475569',
  width: '38%',
};

const tdValueStyle: React.CSSProperties = {
  borderTop: '1px solid #f1f5f9',
  padding: '10px',
  fontWeight: 700,
};

const footerStyle: React.CSSProperties = {
  marginTop: '14px',
  display: 'flex',
  justifyContent: 'space-between',
  color: '#6b7280',
  fontSize: '0.85rem',
};
