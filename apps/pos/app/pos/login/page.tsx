'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, posGetMe, posLogin } from '@/lib/api';
import { clearPosAccessToken, hasPosAccessToken, setPosAccessToken } from '@/lib/pos-auth';

function isPosAllowedRole(role: string): boolean {
  return role === 'CASHIER' || role === 'MANAGER' || role === 'OWNER';
}

export default function PosLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPending(true);
    setError(null);

    try {
      const loginResponse = await posLogin(email, password);
      setPosAccessToken(loginResponse.accessToken);

      const me = await posGetMe();
      if (!isPosAllowedRole(me.role)) {
        clearPosAccessToken();
        setError('این کاربر دسترسی بخش میزها را ندارد');
        return;
      }

      router.replace('/pos/tables');
      router.refresh();
    } catch (err) {
      clearPosAccessToken();
      setError(err instanceof ApiError ? err.message : 'ورود ناموفق بود');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto mt-8 max-w-md rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">ورود بخش میزها</h1>
        <p className="mt-1 text-sm text-slate-600">
          با کاربر صندوق یا مدیر وارد شوید
        </p>

        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">ایمیل</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-12 rounded-xl border border-slate-300 px-3"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">رمز عبور</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-12 rounded-xl border border-slate-300 px-3"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-xl bg-blue-600 px-4 text-base font-black text-white disabled:opacity-60"
          >
            {pending ? 'در حال ورود...' : 'ورود'}
          </button>

          {hasPosAccessToken() ? (
            <button
              type="button"
              onClick={() => {
                clearPosAccessToken();
                setError('نشست قبلی پاک شد. دوباره وارد شوید.');
              }}
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
            >
              پاک‌کردن نشست قبلی
            </button>
          ) : null}
        </form>
      </div>
    </main>
  );
}
