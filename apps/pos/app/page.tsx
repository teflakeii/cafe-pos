import type { CSSProperties } from 'react';
import Image from 'next/image';
import logo from '../Logo.png';

export default function HomePage() {
  return (
    <main style={mainStyle} dir="rtl">
      <section style={cardStyle}>
        <Image
          src={logo}
          alt="لوگوی کافه"
          priority
          style={{ width: '100%', height: 'auto', maxWidth: '340px' }}
        />

        <a href="http://localhost:3001/tables" style={tableButtonStyle}>
          ورود به میزها
        </a>

        <a href="http://localhost:3002" style={adminButtonStyle}>
          پنل مدیریت
        </a>
      </section>
    </main>
  );
}

const mainStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  background:
    'radial-gradient(circle at top, #f7f1df 0%, #f3ebd4 45%, #ecdfbe 100%)',
};

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  display: 'grid',
  gap: '16px',
  placeItems: 'center',
  padding: '28px 24px',
  borderRadius: '20px',
  background: '#fffaf0',
  border: '1px solid #d5c7a1',
  boxShadow: '0 18px 38px rgba(55, 92, 62, 0.18)',
};

const sharedButtonStyle: CSSProperties = {
  width: '100%',
  textAlign: 'center',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '1.15rem',
  padding: '16px 18px',
  borderRadius: '14px',
  transition: 'transform 0.12s ease',
};

const tableButtonStyle: CSSProperties = {
  ...sharedButtonStyle,
  background: '#2f7d32',
  color: '#fffef6',
};

const adminButtonStyle: CSSProperties = {
  ...sharedButtonStyle,
  background: '#1f5e27',
  color: '#fffef6',
};
