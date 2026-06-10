import 'server-only';

import { headers } from 'next/headers';

import { api } from './api';
import type { FinancialIntegrityStatus } from '@/types/integrity';

export async function getIntegrityStatus(): Promise<FinancialIntegrityStatus> {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get('cookie');

  return api<FinancialIntegrityStatus>('/admin/integrity', {
    method: 'GET',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
}
