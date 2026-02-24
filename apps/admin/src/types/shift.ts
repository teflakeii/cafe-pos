export type ShiftSummary = {
  id: number;
  openedAt: string;
  closedAt: string | null;
  status: 'OPEN' | 'CLOSED';
  openedBy: string;
  closedBy: string | null;
};

export type ShiftDetail = {
  id: number;
  openedAt: string;
  closedAt: string | null;
  status: 'OPEN' | 'CLOSED';
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstandingAmount: number;
  delta: number;
};
