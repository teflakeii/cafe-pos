import { api } from './api';
import type { DailyReport, RangeReport, ShiftReport } from '@/types/report';

export function getDailyReport(date: string, extraHeaders?: HeadersInit) {
  const query = new URLSearchParams({ date });
  return api<DailyReport>(`/admin/reports/daily?${query.toString()}`, {
    method: 'GET',
    headers: extraHeaders,
  });
}

export function getShiftReport(id: number, extraHeaders?: HeadersInit) {
  return api<ShiftReport>(`/admin/reports/shift/${id}`, {
    method: 'GET',
    headers: extraHeaders,
  });
}

export function getRangeReport(
  from: string,
  to: string,
  extraHeaders?: HeadersInit,
) {
  const query = new URLSearchParams({ from, to });
  return api<RangeReport>(`/admin/reports/range?${query.toString()}`, {
    method: 'GET',
    headers: extraHeaders,
  });
}
