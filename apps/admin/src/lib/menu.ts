import { api } from './api';

export type AdminMenuItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminMenuItemInput = {
  name: string;
  category: string;
  price: number;
};

export function getMenuItemsAll() {
  return api<AdminMenuItem[]>('/menu-items/all', {
    method: 'GET',
  });
}

export function createMenuItem(input: AdminMenuItemInput) {
  return api<AdminMenuItem>('/menu-items', {
    method: 'POST',
    body: input,
  });
}

export function updateMenuItem(
  id: number,
  input: Partial<AdminMenuItemInput>,
) {
  return api<AdminMenuItem>(`/menu-items/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function toggleMenuItem(id: number) {
  return api<AdminMenuItem>(`/menu-items/${id}/toggle`, {
    method: 'PATCH',
  });
}
