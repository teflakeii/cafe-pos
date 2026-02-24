import { redirect } from 'next/navigation';

type ShiftSelectorPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function ShiftSelectorPage({ searchParams }: ShiftSelectorPageProps) {
  const params = await searchParams;
  const id = Number(params.id);

  if (Number.isInteger(id) && id > 0) {
    redirect(`/admin/reports/shift/${id}`);
  }

  return (
    <section style={{ display: 'grid', gap: '14px' }}>
      <h1 style={{ margin: 0, fontSize: '1.3rem' }}>گزارش شیفت</h1>
      <form method="get" style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: '6px' }}>
          شناسه شیفت
          <input
            type="number"
            min={1}
            name="id"
            required
            style={{ border: '1px solid #d1d5db', borderRadius: '10px', padding: '8px 10px' }}
          />
        </label>
        <button
          type="submit"
          style={{
            border: 'none',
            borderRadius: '10px',
            padding: '9px 14px',
            background: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          مشاهده
        </button>
      </form>
    </section>
  );
}
