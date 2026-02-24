'use client';

import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { getAdminSettings } from '@/lib/settings';
import type { AdminSettings } from '@/types/settings';

type HealthStatus = {
  status: 'ok';
  db: 'connected';
  ledgerBalanced: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setError(null);

        const [settingsData, healthData] = await Promise.all([
          getAdminSettings(),
          api<HealthStatus>('/health', { method: 'GET' }),
        ]);

        if (!mounted) {
          return;
        }

        setSettings(settingsData);
        setHealth(healthData);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err instanceof ApiError ? err.message : 'بارگذاری تنظیمات ناموفق بود');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p>در حال بارگذاری تنظیمات...</p>;
  }

  if (error) {
    return (
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
    );
  }

  return (
    <section style={{ display: 'grid', gap: '16px' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>تنظیمات سیستم</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
          وضعیت عملیاتی و تنظیمات اجرایی پنل
        </p>
      </header>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px' }}>
        <h2 style={{ marginTop: 0 }}>سلامت سیستم</h2>
        <p style={{ margin: '8px 0' }}>API: {health?.status ?? '-'}</p>
        <p style={{ margin: '8px 0' }}>Database: {health?.db ?? '-'}</p>
        <p style={{ margin: '8px 0' }}>
          Ledger: {health?.ledgerBalanced ? 'Balanced' : 'Unbalanced'}
        </p>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px' }}>
        <h2 style={{ marginTop: 0 }}>پیکربندی اجرایی</h2>
        <p style={{ margin: '8px 0' }}>نام برنامه: {settings?.app.name}</p>
        <p style={{ margin: '8px 0' }}>محیط: {settings?.app.environment}</p>
        <p style={{ margin: '8px 0' }}>پورت API: {settings?.api.port}</p>
        <p style={{ margin: '8px 0' }}>
          CORS Origins: {settings?.api.corsOrigins.join(', ')}
        </p>
        <p style={{ margin: '8px 0' }}>
          انقضای JWT (ساعت): {settings?.auth.jwtExpiryHours}
        </p>
        <p style={{ margin: '8px 0' }}>
          شروع شیفت توسط cashier: {settings?.pos.allowCashierOpenShift ? 'فعال' : 'غیرفعال'}
        </p>
      </div>
    </section>
  );
}
