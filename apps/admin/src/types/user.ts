import type { Role } from './auth';

export type AdminUser = {
  id: number;
  email: string;
  name?: string | null;
  role: Role;
  active: boolean;
  createdAt?: string;
};

export type CreateAdminUserInput = {
  email: string;
  password: string;
  role: Role;
  isActive?: boolean;
};
