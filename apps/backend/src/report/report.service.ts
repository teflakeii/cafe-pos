import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  AccountType,
  OrderItemType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { SYSTEM_ACCOUNT_CODES } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

type DailyReportResponse = {
  totalSales: number;
  totalMenuSales: number;
  totalGameSales: number;
  invoiceCount: number;
  totalCash: number;
  totalCard: number;
  totalManual: number;
  outstanding: number;
  byCategory: Array<{
    category: string;
    total: number;
  }>;
  byItem: Array<{
    name: string;
    quantity: number;
    total: number;
  }>;
};

type TrialBalanceAccount = {
  code: string;
  name: string;
  type: AccountType;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type TrialBalanceResponse = {
  accounts: TrialBalanceAccount[];
  summary: {
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  };
};

type ProfitLossLine = {
  code: string;
  name: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type ProfitLossResponse = {
  revenues: ProfitLossLine[];
  expenses: ProfitLossLine[];
  summary: {
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
  };
};

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trialBalance(from?: Date, to?: Date): Promise<TrialBalanceResponse> {
    const createdAtFilter = this.buildJournalDateFilter(from, to);

    const accounts = await this.prisma.account.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
    });

    const trialAccounts = await Promise.all(
      accounts.map(async (account) => {
        const aggregate = await this.prisma.ledgerEntry.aggregate({
          where: {
            accountId: account.id,
            ...(createdAtFilter
              ? {
                  journalEntry: {
                    createdAt: createdAtFilter,
                  },
                }
              : {}),
          },
          _sum: {
            debit: true,
            credit: true,
          },
        });

        const totalDebit = aggregate._sum.debit ?? 0;
        const totalCredit = aggregate._sum.credit ?? 0;

        return {
          code: account.code,
          name: account.name,
          type: account.type,
          totalDebit,
          totalCredit,
          balance: totalDebit - totalCredit,
        };
      }),
    );

    const grandTotalDebit = trialAccounts.reduce(
      (sum, account) => sum + account.totalDebit,
      0,
    );
    const grandTotalCredit = trialAccounts.reduce(
      (sum, account) => sum + account.totalCredit,
      0,
    );
    const isBalanced = grandTotalDebit === grandTotalCredit;

    if (!isBalanced) {
      throw new InternalServerErrorException('Ledger out of balance');
    }

    return {
      accounts: trialAccounts,
      summary: {
        totalDebit: grandTotalDebit,
        totalCredit: grandTotalCredit,
        isBalanced,
      },
    };
  }

  async profitLoss(from?: Date, to?: Date): Promise<ProfitLossResponse> {
    const createdAtFilter = this.buildJournalDateFilter(from, to);

    const accounts = await this.prisma.account.findMany({
      where: {
        type: {
          in: [AccountType.REVENUE, AccountType.EXPENSE],
        },
      },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
    });

    const rows = await Promise.all(
      accounts.map(async (account) => {
        const aggregate = await this.prisma.ledgerEntry.aggregate({
          where: {
            accountId: account.id,
            ...(createdAtFilter
              ? {
                  journalEntry: {
                    createdAt: createdAtFilter,
                  },
                }
              : {}),
          },
          _sum: {
            debit: true,
            credit: true,
          },
        });

        const totalDebit = aggregate._sum.debit ?? 0;
        const totalCredit = aggregate._sum.credit ?? 0;
        const balance = totalDebit - totalCredit;

        return {
          code: account.code,
          name: account.name,
          type: account.type,
          totalDebit,
          totalCredit,
          balance,
        };
      }),
    );

    const revenues = rows
      .filter((row) => row.type === AccountType.REVENUE)
      .map((row) => ({
        code: row.code,
        name: row.name,
        totalDebit: row.totalDebit,
        totalCredit: row.totalCredit,
        balance: row.balance,
      }));

    const expenses = rows
      .filter((row) => row.type === AccountType.EXPENSE)
      .map((row) => ({
        code: row.code,
        name: row.name,
        totalDebit: row.totalDebit,
        totalCredit: row.totalCredit,
        balance: row.balance,
      }));

    const totalRevenue = revenues.reduce(
      (sum, account) => sum + (account.totalCredit - account.totalDebit),
      0,
    );
    const totalExpense = expenses.reduce(
      (sum, account) => sum + (account.totalDebit - account.totalCredit),
      0,
    );
    const netProfit = totalRevenue - totalExpense;

    return {
      revenues,
      expenses,
      summary: {
        totalRevenue,
        totalExpense,
        netProfit,
      },
    };
  }

  async getDailyReport(): Promise<DailyReportResponse> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const closedOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CLOSED,
        closedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
      },
    });

    const invoiceCount = closedOrders.length;
    const orderIds = closedOrders.map((order) => order.id);

    if (orderIds.length === 0) {
      return {
        totalSales: 0,
        totalMenuSales: 0,
        totalGameSales: 0,
        invoiceCount: 0,
        totalCash: 0,
        totalCard: 0,
        totalManual: 0,
        outstanding: 0,
        byCategory: [],
        byItem: [],
      };
    }

    const [salesAccount, cashAccount, bankAccount] = await Promise.all([
      this.prisma.account.findUnique({
        where: { code: SYSTEM_ACCOUNT_CODES.SALES_REVENUE },
        select: { id: true },
      }),
      this.prisma.account.findUnique({
        where: { code: SYSTEM_ACCOUNT_CODES.CASH },
        select: { id: true },
      }),
      this.prisma.account.findUnique({
        where: { code: SYSTEM_ACCOUNT_CODES.BANK },
        select: { id: true },
      }),
    ]);

    if (!salesAccount || !cashAccount || !bankAccount) {
      throw new Error('Required ledger accounts are missing');
    }

    const ledgerFilter = {
      where: {
        journalEntry: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
    };

    const [salesAgg, cashAgg, bankAgg] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        ...ledgerFilter,
        where: {
          ...ledgerFilter.where,
          accountId: salesAccount.id,
        },
        _sum: {
          debit: true,
          credit: true,
        },
      }),
      this.prisma.ledgerEntry.aggregate({
        ...ledgerFilter,
        where: {
          ...ledgerFilter.where,
          accountId: cashAccount.id,
        },
        _sum: {
          debit: true,
          credit: true,
        },
      }),
      this.prisma.ledgerEntry.aggregate({
        ...ledgerFilter,
        where: {
          ...ledgerFilter.where,
          accountId: bankAccount.id,
        },
        _sum: {
          debit: true,
          credit: true,
        },
      }),
    ]);

    const totalSales = (salesAgg._sum.credit ?? 0) - (salesAgg._sum.debit ?? 0);
    const totalCash = (cashAgg._sum.debit ?? 0) - (cashAgg._sum.credit ?? 0);
    const totalCard = (bankAgg._sum.debit ?? 0) - (bankAgg._sum.credit ?? 0);
    const totalManual = 0;
    const totalCollected = totalCash + totalCard + totalManual;

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        orderId: {
          in: orderIds,
        },
      },
      select: {
        type: true,
        qty: true,
        lineTotal: true,
        menuItem: {
          select: {
            name: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const totalGameSales = orderItems
      .filter((item) => item.type === OrderItemType.GAME)
      .reduce((sum, item) => sum + item.lineTotal, 0);
    const totalMenuSales = totalSales - totalGameSales;

    const categoryTotals = new Map<string, number>();
    const itemTotals = new Map<string, { quantity: number; total: number }>();

    for (const item of orderItems) {
      if (item.type === OrderItemType.GAME || !item.menuItem) {
        continue;
      }

      const categoryName = item.menuItem.category.name;
      const itemName = item.menuItem.name;
      const quantity = item.qty;

      categoryTotals.set(
        categoryName,
        (categoryTotals.get(categoryName) ?? 0) + item.lineTotal,
      );

      const previous = itemTotals.get(itemName) ?? { quantity: 0, total: 0 };
      itemTotals.set(itemName, {
        quantity: previous.quantity + quantity,
        total: previous.total + item.lineTotal,
      });
    }

    const outstanding = totalSales - totalCollected;

    this.assertInvariants({
      totalSales,
      totalMenuSales,
      totalGameSales,
      totalCollected,
      totalCash,
      totalCard,
      totalManual,
    });

    const byCategory = Array.from(categoryTotals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort(
        (a, b) => b.total - a.total || a.category.localeCompare(b.category),
      );

    const byItem = Array.from(itemTotals.entries())
      .map(([name, summary]) => ({
        name,
        quantity: summary.quantity,
        total: summary.total,
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return {
      totalSales,
      totalMenuSales,
      totalGameSales,
      invoiceCount,
      totalCash,
      totalCard,
      totalManual,
      outstanding,
      byCategory,
      byItem,
    };
  }

  private assertInvariants(input: {
    totalSales: number;
    totalMenuSales: number;
    totalGameSales: number;
    totalCollected: number;
    totalCash: number;
    totalCard: number;
    totalManual: number;
  }): void {
    const checks = {
      collectedLeTotalSales: input.totalCollected <= input.totalSales,
      nonNegativeTotalSales: input.totalSales >= 0,
      paymentMethodSum:
        input.totalCollected ===
        input.totalCash + input.totalCard + input.totalManual,
    };

    if (
      checks.collectedLeTotalSales &&
      checks.nonNegativeTotalSales &&
      checks.paymentMethodSum
    ) {
      return;
    }

    const payload = {
      checks,
      totals: input,
    };

    this.logger.warn(
      JSON.stringify({
        level: 'warn',
        context: ReportService.name,
        userId: null,
        action: 'DAILY_REPORT_INVARIANT_MISMATCH',
        metadata: payload,
      }),
    );

    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        `Daily report invariant mismatch: ${JSON.stringify(payload)}`,
      );
    }
  }

  private buildJournalDateFilter(
    from?: Date,
    to?: Date,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) {
      return undefined;
    }

    const filter: Prisma.DateTimeFilter = {};

    if (from) {
      filter.gte = from;
    }

    if (to) {
      filter.lte = to;
    }

    return filter;
  }
}
