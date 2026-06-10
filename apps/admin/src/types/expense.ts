export type AdminExpense = {
  id: number;
  shiftId: number;
  shiftStatus: 'OPEN' | 'CLOSED';
  amount: number;
  category: string;
  description: string;
  method: 'CASH' | 'CARD' | 'MANUAL';
  isVoided: boolean;
  createdAt: string;
  createdBy: number | null;
  createdByEmail: string | null;
  voidedAt: string | null;
  voidedBy: number | null;
  voidedByEmail: string | null;
};

export type CreateExpenseInput = {
  shiftId: number;
  amount: number;
  category: string;
  description: string;
  method?: 'CASH' | 'CARD';
};
