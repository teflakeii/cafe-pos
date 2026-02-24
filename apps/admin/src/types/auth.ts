export type Role = 'OWNER' | 'MANAGER' | 'ACCOUNTANT' | 'CASHIER';

export type SessionUser = {
  id: number;
  email: string;
  name?: string | null;
  role: Role;
  active?: boolean;
};

export type Session = {
  user: SessionUser;
};
