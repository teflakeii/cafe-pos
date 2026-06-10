'use client';

import Link from 'next/link';

type PrintActionsProps = {
  date: string;
};

export function PrintActions({ date }: PrintActionsProps) {
  return (
    <div style={actionsStyle}>
      <button
        type="button"
        onClick={() => window.print()}
        style={buttonStyle}
      >
        چاپ / ذخیره PDF
      </button>
      <Link href={`/admin/reports/daily?date=${encodeURIComponent(date)}`}>
        بازگشت به گزارش روزانه
      </Link>
    </div>
  );
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  fontSize: '0.95rem',
};

const buttonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '10px',
  padding: '10px 14px',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
};
