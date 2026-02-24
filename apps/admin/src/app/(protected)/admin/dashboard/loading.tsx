export default function DashboardLoading() {
  return (
    <section style={{ display: 'grid', gap: '12px' }}>
      <h1 style={{ margin: 0, fontSize: '1.2rem' }}>در حال بارگذاری داشبورد...</h1>
      <div
        style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        }}
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: '98px',
              background: '#e5e7eb',
              borderRadius: '14px',
              opacity: 0.8,
            }}
          />
        ))}
      </div>
    </section>
  );
}
