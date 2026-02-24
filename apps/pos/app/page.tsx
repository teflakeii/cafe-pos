import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at top, #e0f2fe 0%, #f8fafc 42%, #e2e8f0 100%)',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
          padding: '24px',
          display: 'grid',
          gap: '18px',
        }}
      >
        <header style={{ display: 'grid', gap: '6px', textAlign: 'center' }}>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <Image
              src="/elma-logo.svg"
              alt="لوگوی Elma Café"
              width={300}
              height={105}
              priority
              style={{ width: '100%', maxWidth: '300px', height: 'auto' }}
            />
          </div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: '#0f172a' }}>
            کافه POS
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
            سامانه مدیریت میزها و پنل مدیریتی
          </p>
        </header>

        <div style={{ display: 'grid', gap: '12px' }}>
          <Link href="/pos/login" style={primaryButtonStyle}>
            ورود به میزها
          </Link>

          <a href="http://localhost:3002/login" style={secondaryButtonStyle}>
            ورود به ادمین
          </a>
        </div>
      </section>
    </main>
  );
}

const baseButtonStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '56px',
  borderRadius: '14px',
  textDecoration: 'none',
  fontSize: '1rem',
  fontWeight: 800,
};

const primaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background: '#0ea5e9',
  color: '#ffffff',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  background: '#0f172a',
  color: '#ffffff',
};
