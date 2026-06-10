export type DailyReport = {
  date: string;
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstanding: number;
  profit: number;
  delta: number;
};

export type ShiftReport = {
  shiftId: number;
  openedAt: string;
  closedAt: string | null;
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstanding: number;
  profit: number;
  delta: number;
};

export type RangeReport = {
  from: string;
  to: string;
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstanding: number;
  profit: number;
};
