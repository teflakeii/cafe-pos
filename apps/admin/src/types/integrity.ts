export type FinancialIntegrityStatus = {
  ledgerBalanced: boolean;
  ledgerDelta: number;
  hasOrphanOrders: boolean;
  hasNegativeOutstanding: boolean;
  revenueMismatch: boolean;
  shiftDeltaMismatch: boolean;
  issues: string[];
};
