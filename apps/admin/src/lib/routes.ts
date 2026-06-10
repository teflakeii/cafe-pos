import type { Role } from '@/types/auth';

export const ADMIN_ROLES: ReadonlySet<Role> = new Set(['OWNER', 'MANAGER']);

export function isAdminRole(role: Role | null | undefined): role is 'OWNER' | 'MANAGER' {
  return role !== undefined && role !== null && ADMIN_ROLES.has(role);
}

export const ADMIN_NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'داشبورد' },
  { href: '/admin/menu', label: 'منو' },
  { href: '/admin/users', label: 'کاربران' },
  { href: '/admin/shifts', label: 'شیفت‌ها' },
  { href: '/admin/expenses', label: 'هزینه‌ها' },
  { href: '/admin/reports', label: 'گزارش‌ها' },
  { href: '/admin/settings', label: 'تنظیمات' },
] as const;
