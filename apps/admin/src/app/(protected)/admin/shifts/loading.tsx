export default function ShiftsLoading() {
  return (
    <section style={{ display: 'grid', gap: '12px' }}>
      <h1 style={{ margin: 0, fontSize: '1.2rem' }}>در حال بارگذاری شیفت‌ها...</h1>
      <div
        style={{
          height: '220px',
          borderRadius: '14px',
          background: '#e5e7eb',
          opacity: 0.8,
        }}
      />
    </section>
  );
}
