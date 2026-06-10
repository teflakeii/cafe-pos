export default function ShiftDetailLoading() {
  return (
    <section style={{ display: 'grid', gap: '12px' }}>
      <h1 style={{ margin: 0, fontSize: '1.2rem' }}>در حال بارگذاری جزئیات شیفت...</h1>
      <div
        style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: '98px',
              borderRadius: '14px',
              background: '#e5e7eb',
              opacity: 0.8,
            }}
          />
        ))}
      </div>
    </section>
  );
}
