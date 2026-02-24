import Link from 'next/link';

import { ADMIN_NAV_ITEMS } from '@/lib/routes';

export function Sidebar() {
  return (
    <aside
      style={{
        background: '#111827',
        color: '#f9fafb',
        padding: '20px 16px',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <h2 style={{ margin: 0, marginBottom: '20px', fontSize: '1.1rem' }}>
        مدیریت کافه
      </h2>

      <nav style={{ display: 'grid', gap: '8px' }}>
        {ADMIN_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              color: '#e5e7eb',
              textDecoration: 'none',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
