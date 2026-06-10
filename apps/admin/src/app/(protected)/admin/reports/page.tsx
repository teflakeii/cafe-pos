import Link from 'next/link';

const cards = [
  {
    title: 'گزارش روزانه',
    description: 'نمایش فروش، هزینه، سود و دلتا برای یک روز مشخص',
    href: '/admin/reports/daily',
  },
  {
    title: 'گزارش شیفت',
    description: 'نمایش گزارش کامل برای یک شیفت مشخص',
    href: '/admin/reports/shift',
  },
  {
    title: 'گزارش بازه زمانی',
    description: 'تحلیل مالی بر اساس بازه تاریخ شروع تا پایان',
    href: '/admin/reports/range',
  },
] as const;

export default function ReportsIndexPage() {
  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>گزارش‌ها</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
          نوع گزارش مورد نظر را انتخاب کنید
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              textDecoration: 'none',
              color: '#111827',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '14px',
              padding: '16px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
              display: 'grid',
              gap: '8px',
            }}
          >
            <strong style={{ fontSize: '1.05rem' }}>{card.title}</strong>
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>{card.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
