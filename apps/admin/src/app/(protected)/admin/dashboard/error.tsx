'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid #fecaca',
        borderRadius: '14px',
        padding: '16px',
        color: '#991b1b',
        display: 'grid',
        gap: '10px',
      }}
    >
      <h2 style={{ margin: 0 }}>خطا در دریافت داشبورد</h2>
      <p style={{ margin: 0 }}>{error.message || 'یک خطای ناشناخته رخ داد'}</p>
      <button
        type="button"
        onClick={reset}
        style={{
          justifySelf: 'start',
          border: '1px solid #d1d5db',
          borderRadius: '10px',
          padding: '8px 12px',
          background: '#ffffff',
          cursor: 'pointer',
        }}
      >
        تلاش مجدد
      </button>
    </section>
  );
}
