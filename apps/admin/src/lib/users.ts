import { api } from './api';
import type { AdminUser, CreateAdminUserInput } from '@/types/user';
import type { Role } from '@/types/auth';

export function getUsers() {
  return api<AdminUser[]>('/admin/users', {
    method: 'GET',
  });
}

export function createUser(input: CreateAdminUserInput) {
  return api<AdminUser>('/admin/users', {
    method: 'POST',
    body: input,
  });
}

export function updateUserRole(id: number, role: Role) {
  return api<AdminUser>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

export function updateUserActive(id: number, active: boolean) {
  return api<AdminUser>(`/admin/users/${id}/active`, {
    method: 'PATCH',
    body: { active },
  });
}
