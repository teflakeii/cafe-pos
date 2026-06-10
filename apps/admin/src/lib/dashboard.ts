import 'server-only';

import { headers } from 'next/headers';

import { api } from './api';
import type { DashboardSummary } from '@/types/dashboard';

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get('cookie');

  return api<DashboardSummary>('/admin/dashboard/summary', {
    method: 'GET',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
}
