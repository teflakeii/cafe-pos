import Link from 'next/link';
import { headers } from 'next/headers';

import { OpenShiftButton } from '@/components/admin/OpenShiftButton';
import { getShifts } from '@/lib/shifts';

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('fa-IR');
}

export default async function ShiftsPage() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get('cookie');
  const shifts = await getShifts(cookieHeader ? { Cookie: cookieHeader } : undefined);
  const hasOpenShift = shifts.some((shift) => shift.status === 'OPEN');

  return (
    <section style={{ display: 'grid', gap: '14px' }}>
      <header style={{ display: 'grid', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>شیفت‌ها</h1>
        {!hasOpenShift ? <OpenShiftButton /> : null}
      </header>

      <div
        style={{
          overflowX: 'auto',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>زمان شروع</th>
              <th style={thStyle}>زمان پایان</th>
              <th style={thStyle}>وضعیت</th>
              <th style={thStyle}>باز شده توسط</th>
              <th style={thStyle}>بسته شده توسط</th>
              <th style={thStyle}>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{shift.id}</td>
                <td style={tdStyle}>{formatDate(shift.openedAt)}</td>
                <td style={tdStyle}>{formatDate(shift.closedAt)}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background: shift.status === 'OPEN' ? '#dcfce7' : '#e5e7eb',
                      color: shift.status === 'OPEN' ? '#166534' : '#374151',
                    }}
                  >
                    {shift.status === 'OPEN' ? 'باز' : 'بسته'}
                  </span>
                </td>
                <td style={tdStyle}>{shift.openedBy}</td>
                <td style={tdStyle}>{shift.closedBy ?? '-'}</td>
                <td style={tdStyle}>
                  <Link href={`/admin/shifts/${shift.id}`} style={viewLinkStyle}>
                    مشاهده
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '12px',
  fontSize: '0.85rem',
  color: '#4b5563',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px',
  whiteSpace: 'nowrap',
  fontSize: '0.92rem',
};

const viewLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  padding: '6px 10px',
  color: '#111827',
  display: 'inline-flex',
};
