import { ApiError } from '@/lib/api';
import { getDashboardSummary } from '@/lib/dashboard';
import { getIntegrityStatus } from '@/lib/integrity';

const numberFormatter = new Intl.NumberFormat('fa-IR');

const cardBaseStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '16px',
  boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
  display: 'grid',
  gap: '8px',
};

function formatInt(value: number): string {
  return numberFormatter.format(value);
}

export default async function DashboardPage() {
  try {
    const [summary, integrity] = await Promise.all([
      getDashboardSummary(),
      getIntegrityStatus(),
    ]);

    const hasIntegrityIssue =
      !integrity.ledgerBalanced ||
      integrity.hasOrphanOrders ||
      integrity.hasNegativeOutstanding ||
      integrity.revenueMismatch ||
      integrity.shiftDeltaMismatch ||
      integrity.issues.length > 0;

    const cards: Array<{ title: string; value: string; tone?: 'danger' | 'normal' }> = [
      {
        title: 'فروش امروز',
        value: `${formatInt(summary.totalSalesToday)} تومان`,
      },
      {
        title: 'فروش این شیفت',
        value: `${formatInt(summary.totalSalesShift)} تومان`,
      },
      {
        title: 'درآمد بازی',
        value: `${formatInt(summary.totalGameRevenue)} تومان`,
      },
      {
        title: 'درآمد سفارش',
        value: `${formatInt(summary.totalOrderRevenue)} تومان`,
      },
      {
        title: 'بدهی کل',
        value: `${formatInt(summary.outstandingAmount)} تومان`,
        tone: summary.outstandingAmount > 0 ? 'danger' : 'normal',
      },
      {
        title: 'سفارش‌های باز',
        value: formatInt(summary.openOrdersCount),
      },
      {
        title: 'میزهای فعال',
        value: formatInt(summary.activeTables),
      },
      {
        title: 'وضعیت شیفت',
        value: summary.shiftStatus === 'OPEN' ? 'باز' : 'بسته',
      },
    ];

    return (
      <section style={{ display: 'grid', gap: '16px' }}>
        <header>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>داشبورد مدیریت</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            خلاصه شاخص‌های عملیاتی و مالی
          </p>
        </header>

        {hasIntegrityIssue ? (
          <section
            style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '14px',
              padding: '14px',
              display: 'grid',
              gap: '8px',
            }}
          >
            <strong style={{ color: '#9f1239' }}>
              ⚠ Financial Integrity Issue Detected
            </strong>
            {integrity.issues.length > 0 ? (
              <ul style={{ margin: 0, paddingInlineStart: '20px', color: '#881337' }}>
                {integrity.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <span style={{ color: '#881337' }}>
                ناسازگاری مالی شناسایی شد. لطفاً لاگ‌های مالی بررسی شوند.
              </span>
            )}
          </section>
        ) : (
          <section
            style={{
              background: '#ecfdf5',
              border: '1px solid #86efac',
              borderRadius: '14px',
              padding: '12px 14px',
              color: '#166534',
              fontWeight: 700,
            }}
          >
            System Financial State: Healthy
          </section>
        )}

        <div
          style={{
            display: 'grid',
            gap: '12px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          }}
        >
          {cards.map((card) => (
            <article key={card.title} style={cardBaseStyle}>
              <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>{card.title}</span>
              <strong
                style={{
                  fontSize: '1.35rem',
                  color: card.tone === 'danger' ? '#b91c1c' : '#111827',
                }}
              >
                {card.value}
              </strong>
            </article>
          ))}
        </div>
      </section>
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? `دریافت اطلاعات داشبورد ناموفق بود: ${error.message}`
        : 'دریافت اطلاعات داشبورد ناموفق بود';

    return (
      <section
        style={{
          background: '#ffffff',
          border: '1px solid #fecaca',
          borderRadius: '14px',
          padding: '16px',
          color: '#991b1b',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: '8px', fontSize: '1.2rem' }}>
          خطا در بارگذاری داشبورد
        </h1>
        <p style={{ margin: 0 }}>{message}</p>
      </section>
    );
  }
}
