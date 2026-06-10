'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  AdminMenuItem,
  createMenuItem,
  getMenuItemsAll,
  toggleMenuItem,
  updateMenuItem,
} from '@/lib/menu';

type MenuFormState = {
  name: string;
  category: string;
  price: string;
};

const EMPTY_FORM: MenuFormState = {
  name: '',
  category: '',
  price: '',
};

function toPositiveInt(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default function MenuPage() {
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<MenuFormState>(EMPTY_FORM);

  const [editingItem, setEditingItem] = useState<AdminMenuItem | null>(null);
  const [editForm, setEditForm] = useState<MenuFormState>(EMPTY_FORM);

  async function loadItems() {
    try {
      setError(null);
      const rows = await getMenuItemsAll();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'بارگذاری منو ناموفق بود';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    const price = toPositiveInt(createForm.price);

    if (!createForm.name.trim() || !createForm.category.trim() || price === null) {
      setError('نام، دسته و قیمت معتبر الزامی است');
      return;
    }

    try {
      setPending(true);
      setError(null);
      await createMenuItem({
        name: createForm.name.trim(),
        category: createForm.category.trim(),
        price,
      });
      setCreateForm(EMPTY_FORM);
      setShowCreate(false);
      await loadItems();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ایجاد آیتم ناموفق بود');
    } finally {
      setPending(false);
    }
  }

  function openEdit(item: AdminMenuItem) {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
    });
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingItem) {
      return;
    }

    const price = toPositiveInt(editForm.price);
    if (!editForm.name.trim() || !editForm.category.trim() || price === null) {
      setError('نام، دسته و قیمت معتبر الزامی است');
      return;
    }

    try {
      setPending(true);
      setError(null);
      await updateMenuItem(editingItem.id, {
        name: editForm.name.trim(),
        category: editForm.category.trim(),
        price,
      });
      setEditingItem(null);
      await loadItems();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ویرایش آیتم ناموفق بود');
    } finally {
      setPending(false);
    }
  }

  async function onToggle(id: number) {
    try {
      setPending(true);
      setError(null);
      await toggleMenuItem(id);
      await loadItems();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر وضعیت ناموفق بود');
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>مدیریت منو</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>ایجاد، ویرایش و فعال/غیرفعال آیتم‌ها</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowCreate(true)}
          style={{
            border: 'none',
            borderRadius: '10px',
            padding: '10px 14px',
            background: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          افزودن آیتم
        </button>
      </header>

      {error ? (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            borderRadius: '10px',
            padding: '10px 12px',
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '10px', textAlign: 'right' }}>نام</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>دسته</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>قیمت</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>وضعیت</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '12px' }}>در حال بارگذاری...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '12px' }}>آیتمی ثبت نشده است</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px' }}>{item.name}</td>
                  <td style={{ padding: '10px' }}>{item.category}</td>
                  <td style={{ padding: '10px' }}>{item.price.toLocaleString()} تومان</td>
                  <td style={{ padding: '10px' }}>{item.isActive ? 'فعال' : 'غیرفعال'}</td>
                  <td style={{ padding: '10px', display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openEdit(item)}
                      style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 10px' }}
                    >
                      ویرایش
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void onToggle(item.id)}
                      style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 10px' }}
                    >
                      {item.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px' }}>
          <h2 style={{ marginTop: 0 }}>افزودن آیتم</h2>
          <form onSubmit={submitCreate} style={{ display: 'grid', gap: '8px', maxWidth: '420px' }}>
            <input
              placeholder="نام"
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, name: event.target.value }))
              }
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
            />
            <input
              placeholder="دسته"
              value={createForm.category}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, category: event.target.value }))
              }
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
            />
            <input
              type="number"
              min={1}
              placeholder="قیمت"
              value={createForm.price}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, price: event.target.value }))
              }
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={pending} style={{ border: 'none', borderRadius: '8px', padding: '8px 12px', background: '#2563eb', color: '#fff' }}>
                ثبت
              </button>
              <button type="button" disabled={pending} onClick={() => setShowCreate(false)} style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px' }}>
                انصراف
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingItem ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px' }}>
          <h2 style={{ marginTop: 0 }}>ویرایش آیتم</h2>
          <form onSubmit={submitEdit} style={{ display: 'grid', gap: '8px', maxWidth: '420px' }}>
            <input
              placeholder="نام"
              value={editForm.name}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, name: event.target.value }))
              }
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
            />
            <input
              placeholder="دسته"
              value={editForm.category}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, category: event.target.value }))
              }
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
            />
            <input
              type="number"
              min={1}
              placeholder="قیمت"
              value={editForm.price}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, price: event.target.value }))
              }
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={pending} style={{ border: 'none', borderRadius: '8px', padding: '8px 12px', background: '#2563eb', color: '#fff' }}>
                ذخیره
              </button>
              <button type="button" disabled={pending} onClick={() => setEditingItem(null)} style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px' }}>
                انصراف
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
