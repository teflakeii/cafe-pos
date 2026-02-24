import { api } from './api';
import type { AdminSettings } from '@/types/settings';

export function getAdminSettings() {
  return api<AdminSettings>('/admin/settings', {
    method: 'GET',
  });
}
