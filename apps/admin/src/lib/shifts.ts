import { api } from './api';
import type { ShiftDetail, ShiftSummary } from '@/types/shift';

export function getShifts(extraHeaders?: HeadersInit) {
  return api<ShiftSummary[]>('/admin/shifts', {
    method: 'GET',
    headers: extraHeaders,
  });
}

export function getShiftById(id: number, extraHeaders?: HeadersInit) {
  return api<ShiftDetail>(`/admin/shifts/${id}`, {
    method: 'GET',
    headers: extraHeaders,
  });
}

export function closeShift(id: number) {
  return api<unknown>(`/admin/shifts/${id}/close`, {
    method: 'POST',
  });
}
