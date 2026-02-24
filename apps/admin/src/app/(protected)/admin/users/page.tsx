'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Role } from '@/types/auth';
import { ApiError } from '@/lib/api';
import { createUser, getUsers, updateUserActive, updateUserRole } from '@/lib/users';
import type { AdminUser } from '@/types/user';

const ROLE_OPTIONS: Role[] = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'CASHIER'];

type CreateUserForm = {
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
};

const EMPTY_FORM: CreateUserForm = {
  email: '',
  password: '',
  role: 'CASHIER',
  isActive: true,
};

export default function UsersPage() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUserForm>(EMPTY_FORM);

  async function loadRows() {
    try {
      setError(null);
      const data = await getUsers();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بارگذاری کاربران ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();

    if (!form.email.trim() || form.password.trim().length < 8) {
      setError('ایمیل و رمز عبور معتبر (حداقل ۸ کاراکتر) الزامی است');
      return;
    }

    try {
      setPending(true);
      setError(null);
      await createUser({
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        isActive: form.isActive,
      });
      setForm(EMPTY_FORM);
      await loadRows();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ایجاد کاربر ناموفق بود');
    } finally {
      setPending(false);
    }
  }

  async function onToggleActive(user: AdminUser) {
    try {
      setPending(true);
      setError(null);
      await updateUserActive(user.id, !user.active);
      await loadRows();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر وضعیت کاربر ناموفق بود');
    } finally {
      setPending(false);
    }
  }

  async function onChangeRole(user: AdminUser, role: Role) {
    if (role === user.role) {
      return;
    }

    try {
      setPending(true);
      setError(null);
      await updateUserRole(user.id, role);
      await loadRows();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر نقش ناموفق بود');
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>مدیریت کاربران</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
          ایجاد کاربر جدید، تغییر نقش و فعال/غیرفعال کردن حساب‌ها
        </p>
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

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px' }}>
        <h2 style={{ marginTop: 0 }}>ایجاد کاربر</h2>
        <form onSubmit={onCreate} style={{ display: 'grid', gap: '8px', maxWidth: '420px' }}>
          <input
            type="email"
            placeholder="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
          />
          <input
            type="password"
            placeholder="password"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
          />
          <select
            value={form.role}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, role: event.target.value as Role }))
            }
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px' }}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isActive: event.target.checked }))
              }
            />
            فعال باشد
          </label>
          <button
            type="submit"
            disabled={pending}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              background: '#2563eb',
              color: '#fff',
              width: 'fit-content',
            }}
          >
            ثبت کاربر
          </button>
        </form>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '10px', textAlign: 'right' }}>ایمیل</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>نقش</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>وضعیت</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>تاریخ ایجاد</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '12px' }}>در حال بارگذاری...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '12px' }}>کاربری ثبت نشده است</td>
              </tr>
            ) : (
              rows.map((user) => (
                <tr key={user.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px' }}>{user.email}</td>
                  <td style={{ padding: '10px' }}>
                    <select
                      value={user.role}
                      disabled={pending}
                      onChange={(event) =>
                        void onChangeRole(user, event.target.value as Role)
                      }
                      style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 8px' }}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '10px' }}>{user.active ? 'فعال' : 'غیرفعال'}</td>
                  <td style={{ padding: '10px' }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleString('fa-IR') : '-'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void onToggleActive(user)}
                      style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 10px' }}
                    >
                      {user.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
