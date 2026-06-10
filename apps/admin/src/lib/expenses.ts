import { api } from './api';
import type { AdminExpense, CreateExpenseInput } from '@/types/expense';

export function getExpenses(shiftId?: number, extraHeaders?: HeadersInit) {
  const query = new URLSearchParams();
  if (shiftId !== undefined) {
    query.set('shiftId', String(shiftId));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return api<AdminExpense[]>(`/admin/expenses${suffix}`, {
    method: 'GET',
    headers: extraHeaders,
  });
}

export function createExpense(input: CreateExpenseInput) {
  return api<AdminExpense>('/admin/expenses', {
    method: 'POST',
    body: input,
  });
}

export function deleteExpense(id: number) {
  return api<AdminExpense>(`/admin/expenses/${id}`, {
    method: 'DELETE',
  });
}
