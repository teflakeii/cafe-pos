import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AccountType,
  OrderStatus,
  Prisma,
  ShiftStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { SYSTEM_ACCOUNT_CODES } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

type TrialBalanceSnapshotLine = {
  code: string;
  name: string;
  type: AccountType;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type TrialBalanceSnapshot = {
  accounts: TrialBalanceSnapshotLine[];
  summary: {
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  };
};

type ProfitLossSnapshotLine = {
  code: string;
  name: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type ProfitLossSnapshot = {
  revenues: ProfitLossSnapshotLine[];
  expenses: ProfitLossSnapshotLine[];
  summary: {
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
  };
};

type ShiftCloseControls = {
  totalRevenue: number;
  totalPayments: number;
  expectedCash: number;
};

type ShiftScopedOrder = {
  id: number;
  orderNo: string;
  status: OrderStatus;
  total: number;
};

type ShiftSnapshot = {
  trialBalance: TrialBalanceSnapshot;
  profitLoss: ProfitLossSnapshot;
  metadata: {
    generatedAt: string;
    from: string;
    to: string;
    controls: ShiftCloseControls;
  };
};

type ShiftCloseOptions = {
  countedCash: number | 'EXPECTED';
  requireZeroDelta: boolean;
};

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async openShift(openingCash: number, userId?: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingOpen = await tx.shift.findFirst({
          where: { status: ShiftStatus.OPEN },
          select: { id: true },
        });

        if (existingOpen) {
          throw new BadRequestException('Another shift is already open');
        }

        if (!Number.isInteger(openingCash) || openingCash < 0) {
          throw new BadRequestException(
            'Opening cash must be non-negative integer',
          );
        }

        const shift = await tx.shift.create({
          data: {
            openingCash,
            status: ShiftStatus.OPEN,
            userId,
          },
        });

        await this.auditService.logInTx(tx, AuditAction.SHIFT_OPENED, {
          entityType: 'Shift',
          entityId: shift.id,
          userId,
        });

        return shift;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Another shift is already open');
      }
      throw error;
    }
  }

  async closeShift(id: number, countedCash: number, userId?: number) {
    return this.closeShiftWithOptions(
      id,
      {
        countedCash,
        requireZeroDelta: false,
      },
      userId,
    );
  }

  async closeShiftByAdmin(id: number, userId?: number) {
    return this.closeShiftWithOptions(
      id,
      {
        countedCash: 'EXPECTED',
        requireZeroDelta: true,
      },
      userId,
    );
  }

  private async closeShiftWithOptions(
    id: number,
    options: ShiftCloseOptions,
    userId?: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({
        where: { id },
        select: {
          id: true,
          openedAt: true,
          openingCash: true,
          snapshot: true,
          status: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found');
      }

      this.logger.log(
        JSON.stringify({
          level: 'log',
          context: ShiftsService.name,
          userId: userId ?? null,
          shiftId: shift.id,
          action: 'SHIFT_CLOSE_ATTEMPT',
          metadata: {
            countedCashMode: options.countedCash === 'EXPECTED' ? 'EXPECTED' : 'MANUAL',
            requireZeroDelta: options.requireZeroDelta,
          },
        }),
      );

      if (shift.status === ShiftStatus.CLOSED) {
        throw new BadRequestException('Shift already closed');
      }

      if (
        options.countedCash !== 'EXPECTED' &&
        (!Number.isInteger(options.countedCash) || options.countedCash < 0)
      ) {
        throw new BadRequestException(
          'Counted cash must be non-negative integer',
        );
      }

      const closedAt = new Date();
      const scope = this.buildShiftOrderScope(
        shift.id,
        shift.openedAt,
        closedAt,
      );
      const scopedOrders = await tx.order.findMany({
        where: scope,
        select: {
          id: true,
          orderNo: true,
          status: true,
          total: true,
        },
      });

      const paidByOrder = await this.getPaidTotalsByOrder(
        tx,
        scopedOrders.map((order) => order.id),
      );

      this.assertNoOrphanOrders(scopedOrders, paidByOrder);

      const controls = await this.calculateCloseControls(
        tx,
        shift.openingCash,
        shift.openedAt,
        closedAt,
        scopedOrders,
        paidByOrder,
      );

      this.assertStoredSnapshotConsistency(shift.snapshot, controls);

      const snapshot = await this.generateShiftSnapshot(
        tx,
        shift.openedAt,
        closedAt,
        controls,
      );
      this.assertGeneratedSnapshotConsistency(snapshot, controls);

      const countedCash =
        options.countedCash === 'EXPECTED'
          ? controls.expectedCash
          : options.countedCash;
      const difference = countedCash - controls.expectedCash;

      if (options.requireZeroDelta && difference !== 0) {
        this.logger.warn(
          JSON.stringify({
            level: 'warn',
            context: ShiftsService.name,
            userId: userId ?? null,
            shiftId: shift.id,
            action: 'SHIFT_CLOSE_BLOCKED_DELTA',
            metadata: {
              difference,
              expectedCash: controls.expectedCash,
              countedCash,
            },
          }),
        );
        throw new ConflictException('Shift delta must be zero');
      }

      const updated = await tx.shift.updateMany({
        where: {
          id,
          status: ShiftStatus.OPEN,
        },
        data: {
          status: ShiftStatus.CLOSED,
          closedAt,
          expectedCash: controls.expectedCash,
          countedCash,
          difference,
          snapshot,
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('Shift state changed during close');
      }

      await tx.shiftAudit.create({
        data: {
          shiftId: shift.id,
          closedBy: userId,
          closedAt,
          revenue: controls.totalRevenue,
          difference,
          anomalyFlag: false,
        },
      });

      await this.auditService.logInTx(tx, AuditAction.SHIFT_CLOSED, {
        entityType: 'Shift',
        entityId: shift.id,
        userId,
        metadata: {
          difference,
        },
      });

      this.logger.log(
        JSON.stringify({
          level: 'log',
          context: ShiftsService.name,
          userId: userId ?? null,
          shiftId: shift.id,
          action: 'SHIFT_CLOSED',
          metadata: {
            totalRevenue: controls.totalRevenue,
            totalPayments: controls.totalPayments,
            expectedCash: controls.expectedCash,
            countedCash,
            difference,
          },
        }),
      );

      return tx.shift.findUnique({
        where: { id },
      });
    });
  }

  async getShiftReport(id: number) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      select: {
        status: true,
        snapshot: true,
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    if (shift.status === ShiftStatus.OPEN) {
      throw new BadRequestException('Shift is still open');
    }

    if (!shift.snapshot) {
      throw new InternalServerErrorException('Shift snapshot is missing');
    }

    return shift.snapshot;
  }

  private async generateShiftSnapshot(
    tx: Tx,
    from: Date,
    to: Date,
    controls: ShiftCloseControls,
  ): Promise<Prisma.InputJsonValue> {
    const [trialBalance, profitLoss] = await Promise.all([
      this.generateTrialBalance(tx, from, to),
      this.generateProfitLoss(tx, from, to),
    ]);

    const snapshot: ShiftSnapshot = {
      trialBalance,
      profitLoss,
      metadata: {
        generatedAt: to.toISOString(),
        from: from.toISOString(),
        to: to.toISOString(),
        controls,
      },
    };

    return snapshot as Prisma.InputJsonValue;
  }

  private buildShiftOrderScope(
    shiftId: number,
    openedAt: Date,
    closedAt: Date,
  ): Prisma.OrderWhereInput {
    return {
      OR: [
        {
          shiftId,
        },
        {
          shiftId: null,
          openedAt: {
            gte: openedAt,
            lte: closedAt,
          },
        },
      ],
    };
  }

  private async getPaidTotalsByOrder(
    tx: Tx,
    orderIds: number[],
  ): Promise<Map<number, number>> {
    const paidByOrder = new Map<number, number>();
    if (orderIds.length === 0) {
      return paidByOrder;
    }

    const grouped = await tx.payment.groupBy({
      by: ['orderId'],
      where: {
        orderId: {
          in: orderIds,
        },
      },
      _sum: {
        amount: true,
      },
    });

    grouped.forEach((row) => {
      paidByOrder.set(row.orderId, row._sum.amount ?? 0);
    });

    return paidByOrder;
  }

  private assertNoOrphanOrders(
    orders: ShiftScopedOrder[],
    paidByOrder: Map<number, number>,
  ): void {
    const orphanDetails = orders
      .map((order) => {
        const paid = paidByOrder.get(order.id) ?? 0;
        const debt = order.total - paid;
        const isOrphan =
          order.status === OrderStatus.OPEN ||
          order.status === OrderStatus.SETTLING ||
          debt > 0;

        if (!isOrphan) {
          return null;
        }

        return `${order.orderNo}(id=${order.id},status=${order.status},debt=${debt})`;
      })
      .filter((value): value is string => value !== null);

    if (orphanDetails.length > 0) {
      throw new ConflictException(
        `Cannot close shift. Orphan orders detected: ${orphanDetails.join(', ')}`,
      );
    }
  }

  private async calculateCloseControls(
    tx: Tx,
    openingCash: number,
    openedAt: Date,
    closedAt: Date,
    orders: ShiftScopedOrder[],
    paidByOrder: Map<number, number>,
  ): Promise<ShiftCloseControls> {
    const totalRevenueFromOrders = orders
      .filter((order) => order.status === OrderStatus.CLOSED)
      .reduce((sum, order) => sum + order.total, 0);

    const totalPaymentsFromOrders = Array.from(paidByOrder.values()).reduce(
      (sum, amount) => sum + amount,
      0,
    );

    const revenueAggregate = await tx.ledgerEntry.aggregate({
      where: {
        account: {
          type: AccountType.REVENUE,
        },
        journalEntry: {
          createdAt: {
            gte: openedAt,
            lte: closedAt,
          },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
    const totalRevenueFromLedger =
      (revenueAggregate._sum.credit ?? 0) - (revenueAggregate._sum.debit ?? 0);

    if (totalRevenueFromOrders !== totalRevenueFromLedger) {
      throw new ConflictException(
        `Shift revenue mismatch: orders=${totalRevenueFromOrders}, ledger=${totalRevenueFromLedger}`,
      );
    }

    const paymentAggregate = await tx.ledgerEntry.aggregate({
      where: {
        account: {
          code: SYSTEM_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        },
        journalEntry: {
          createdAt: {
            gte: openedAt,
            lte: closedAt,
          },
          reference: {
            startsWith: 'PAYMENT-',
          },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
    const totalPaymentsFromLedger =
      (paymentAggregate._sum.credit ?? 0) - (paymentAggregate._sum.debit ?? 0);

    if (totalPaymentsFromOrders !== totalPaymentsFromLedger) {
      throw new ConflictException(
        `Shift payment mismatch: payments=${totalPaymentsFromOrders}, ledger=${totalPaymentsFromLedger}`,
      );
    }

    const cashAccount = await tx.account.findUnique({
      where: {
        code: SYSTEM_ACCOUNT_CODES.CASH,
      },
      select: {
        id: true,
      },
    });

    if (!cashAccount) {
      throw new BadRequestException('Cash account not configured');
    }

    const cashEntries = await tx.ledgerEntry.findMany({
      where: {
        accountId: cashAccount.id,
        journalEntry: {
          createdAt: {
            gte: openedAt,
            lte: closedAt,
          },
        },
      },
      select: {
        debit: true,
        credit: true,
      },
    });

    const cashMovement = cashEntries.reduce(
      (sum, entry) => sum + entry.debit - entry.credit,
      0,
    );

    return {
      totalRevenue: this.asInt(totalRevenueFromLedger, 'totalRevenue'),
      totalPayments: this.asInt(totalPaymentsFromLedger, 'totalPayments'),
      expectedCash: this.asInt(openingCash + cashMovement, 'expectedCash'),
    };
  }

  private assertStoredSnapshotConsistency(
    storedSnapshot: Prisma.JsonValue | null,
    controls: ShiftCloseControls,
  ): void {
    if (!storedSnapshot) {
      return;
    }

    const storedControls = this.extractSnapshotControls(storedSnapshot);
    if (!storedControls) {
      throw new ConflictException('Stored shift snapshot controls are missing');
    }

    if (
      storedControls.totalRevenue !== controls.totalRevenue ||
      storedControls.totalPayments !== controls.totalPayments ||
      storedControls.expectedCash !== controls.expectedCash
    ) {
      throw new ConflictException(
        'Stored shift snapshot mismatch detected. Close operation blocked',
      );
    }
  }

  private assertGeneratedSnapshotConsistency(
    snapshot: Prisma.InputJsonValue,
    controls: ShiftCloseControls,
  ): void {
    const snapshotRevenue = this.readJsonInt(snapshot, [
      'profitLoss',
      'summary',
      'totalRevenue',
    ]);
    const snapshotPayments = this.readJsonInt(snapshot, [
      'metadata',
      'controls',
      'totalPayments',
    ]);
    const snapshotExpectedCash = this.readJsonInt(snapshot, [
      'metadata',
      'controls',
      'expectedCash',
    ]);

    if (
      snapshotRevenue === null ||
      snapshotPayments === null ||
      snapshotExpectedCash === null
    ) {
      throw new InternalServerErrorException(
        'Generated shift snapshot controls are missing',
      );
    }

    if (
      snapshotRevenue !== controls.totalRevenue ||
      snapshotPayments !== controls.totalPayments ||
      snapshotExpectedCash !== controls.expectedCash
    ) {
      throw new InternalServerErrorException(
        'Generated shift snapshot controls mismatch detected',
      );
    }
  }

  private extractSnapshotControls(
    snapshot: Prisma.JsonValue | Prisma.InputJsonValue,
  ): ShiftCloseControls | null {
    const totalRevenue = this.readJsonInt(snapshot, [
      'metadata',
      'controls',
      'totalRevenue',
    ]);
    const totalPayments = this.readJsonInt(snapshot, [
      'metadata',
      'controls',
      'totalPayments',
    ]);
    const expectedCash = this.readJsonInt(snapshot, [
      'metadata',
      'controls',
      'expectedCash',
    ]);

    if (
      totalRevenue === null ||
      totalPayments === null ||
      expectedCash === null
    ) {
      return null;
    }

    return {
      totalRevenue,
      totalPayments,
      expectedCash,
    };
  }

  private readJsonInt(
    value: Prisma.JsonValue | Prisma.InputJsonValue,
    path: string[],
  ): number | null {
    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }

    if (current === null || current === undefined) {
      return null;
    }

    if (typeof current !== 'number' || !Number.isInteger(current)) {
      throw new InternalServerErrorException(
        `Invalid integer in snapshot at path: ${path.join('.')}`,
      );
    }

    return current;
  }

  private asInt(value: number, field: string): number {
    if (!Number.isInteger(value)) {
      throw new InternalServerErrorException(
        `Expected integer value for ${field}`,
      );
    }
    return value;
  }

  private async generateTrialBalance(
    tx: Tx,
    from: Date,
    to: Date,
  ): Promise<TrialBalanceSnapshot> {
    const accounts = await tx.account.findMany({
      orderBy: {
        code: 'asc',
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
    });

    const accountRows = await Promise.all(
      accounts.map(async (account) => {
        const aggregate = await tx.ledgerEntry.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              createdAt: {
                gte: from,
                lte: to,
              },
            },
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

    const totalDebit = accountRows.reduce(
      (sum, row) => sum + row.totalDebit,
      0,
    );
    const totalCredit = accountRows.reduce(
      (sum, row) => sum + row.totalCredit,
      0,
    );
    const isBalanced = totalDebit === totalCredit;

    if (!isBalanced) {
      throw new InternalServerErrorException('Ledger out of balance');
    }

    return {
      accounts: accountRows,
      summary: {
        totalDebit,
        totalCredit,
        isBalanced,
      },
    };
  }

  private async generateProfitLoss(
    tx: Tx,
    from: Date,
    to: Date,
  ): Promise<ProfitLossSnapshot> {
    const accounts = await tx.account.findMany({
      where: {
        type: {
          in: [AccountType.REVENUE, AccountType.EXPENSE],
        },
      },
      orderBy: {
        code: 'asc',
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
    });

    const rows = await Promise.all(
      accounts.map(async (account) => {
        const aggregate = await tx.ledgerEntry.aggregate({
          where: {
            accountId: account.id,
            journalEntry: {
              createdAt: {
                gte: from,
                lte: to,
              },
            },
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
      (sum, row) => sum + (row.totalCredit - row.totalDebit),
      0,
    );
    const totalExpense = expenses.reduce(
      (sum, row) => sum + (row.totalDebit - row.totalCredit),
      0,
    );

    return {
      revenues,
      expenses,
      summary: {
        totalRevenue,
        totalExpense,
        netProfit: totalRevenue - totalExpense,
      },
    };
  }
}
