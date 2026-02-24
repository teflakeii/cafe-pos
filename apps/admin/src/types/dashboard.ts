export type DashboardSummary = {
  totalSalesToday: number;
  totalSalesShift: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  outstandingAmount: number;
  openOrdersCount: number;
  activeTables: number;
  shiftStatus: 'OPEN' | 'CLOSED';
};
