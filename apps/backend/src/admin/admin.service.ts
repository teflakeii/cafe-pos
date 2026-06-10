import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderItemType,
  OrderStatus,
  Prisma,
  ShiftStatus,
  TableStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftsService } from '../shifts/shifts.service';

type AdminDashboardSummary = {
  totalSalesToday: number;
  totalSalesShift: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  outstandingAmount: number;
  openOrdersCount: number;
  activeTables: number;
  shiftStatus: 'CLOSED' | 'OPEN';
};

type AdminShiftSummary = {
  id: number;
  openedAt: Date;
  closedAt: Date | null;
  status: ShiftStatus;
  openedBy: string;
  closedBy: string | null;
};

type AdminShiftDetail = {
  id: number;
  openedAt: Date;
  closedAt: Date | null;
  status: ShiftStatus;
  totalSales: number;
  totalGameRevenue: number;
  totalOrderRevenue: number;
  totalPayments: number;
  totalDiscount: number;
  totalExpense: number;
  outstandingAmount: number;
  delta: number;
};

type AdminShiftDetailComputed = AdminShiftDetail & {
  openOrdersCount: number;
};

type FinancialIntegrityStatus = {
  ledgerBalanced: boolean;
  ledgerDelta: number;
  hasOrphanOrders: boolean;
  hasNegativeOutstanding: boolean;
  revenueMismatch: boolean;
  shiftDeltaMismatch: boolean;
  issues: string[];
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftsService: ShiftsService,
  ) {}

  async getDashboardSummary(): Promise<AdminDashboardSummary> {
    const { startOfToday, endOfToday } = this.getTodayRange();

    return this.prisma.$transaction(async (tx) => {
      const openShift = await tx.shift.findFirst({
        where: {
          status: ShiftStatus.OPEN,
        },
        orderBy: {
          openedAt: 'desc',
        },
        select: {
          id: true,
        },
      });

      const shiftStatus: AdminDashboardSummary['shiftStatus'] = openShift
        ? 'OPEN'
        : 'CLOSED';

      const closedOrdersTodayWhere: Prisma.OrderWhereInput = {
        status: OrderStatus.CLOSED,
        closedAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      };

      const closedOrdersInCurrentShiftWhere: Prisma.OrderWhereInput = openShift
        ? { shiftId: openShift.id, status: OrderStatus.CLOSED }
        : { id: -1 };

      const openOrderStatuses: OrderStatus[] = [
        OrderStatus.OPEN,
        OrderStatus.SETTLING,
      ];

      const openOrdersWhere: Prisma.OrderWhereInput = openShift
        ? {
            shiftId: openShift.id,
            status: {
              in: openOrderStatuses,
            },
          }
        : {
            status: {
              in: openOrderStatuses,
            },
          };

      const [
        totalSalesTodayAggregate,
        totalSalesShiftAggregate,
        totalGameRevenueAggregate,
        openOrdersCount,
        activeTablesCount,
        outstandingOrdersAggregate,
        outstandingPaymentsAggregate,
      ] = await Promise.all([
        tx.order.aggregate({
          where: closedOrdersTodayWhere,
          _sum: { total: true },
        }),
        tx.order.aggregate({
          where: closedOrdersInCurrentShiftWhere,
          _sum: { total: true },
        }),
        tx.gameCharge.aggregate({
          where: {
            order: {
              is: closedOrdersInCurrentShiftWhere,
            },
          },
          _sum: { finalPrice: true },
        }),
        tx.order.count({
          where: openOrdersWhere,
        }),
        tx.cafeTable.count({
          where: {
            isActive: true,
            status: TableStatus.SETTLING,
          },
        }),
        tx.order.aggregate({
          where: openOrdersWhere,
          _sum: { total: true },
        }),
        tx.payment.aggregate({
          where: {
            order: {
              is: openOrdersWhere,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      const totalSalesToday = totalSalesTodayAggregate._sum.total ?? 0;
      const totalSalesShift = totalSalesShiftAggregate._sum.total ?? 0;
      const totalGameRevenue = totalGameRevenueAggregate._sum.finalPrice ?? 0;
      const totalOrderRevenue = Math.max(totalSalesShift - totalGameRevenue, 0);
      const outstandingRaw =
        (outstandingOrdersAggregate._sum.total ?? 0) -
        (outstandingPaymentsAggregate._sum.amount ?? 0);

      return {
        totalSalesToday: this.asInt(totalSalesToday),
        totalSalesShift: this.asInt(totalSalesShift),
        totalGameRevenue: this.asInt(totalGameRevenue),
        totalOrderRevenue: this.asInt(totalOrderRevenue),
        outstandingAmount: this.asInt(Math.max(outstandingRaw, 0)),
        openOrdersCount: this.asInt(openOrdersCount),
        activeTables: this.asInt(activeTablesCount),
        shiftStatus,
      };
    });
  }

  async getIntegrityStatus(): Promise<FinancialIntegrityStatus> {
    return this.prisma.$transaction(async (tx) => {
      const issues: string[] = [];

      const ledgerAggregate = await tx.ledgerEntry.aggregate({
        _sum: {
          debit: true,
          credit: true,
        },
      });

      const totalDebit = ledgerAggregate._sum.debit ?? 0;
      const totalCredit = ledgerAggregate._sum.credit ?? 0;
      const ledgerDelta = this.asInt(totalDebit - totalCredit);
      const ledgerBalanced = ledgerDelta === 0;

      if (!ledgerBalanced) {
        issues.push(
          `Ledger out of balance: debit=${totalDebit}, credit=${totalCredit}, delta=${ledgerDelta}`,
        );
      }

      const closedShiftsWithDelta = await tx.shift.findMany({
        where: {
          status: ShiftStatus.CLOSED,
          OR: [{ difference: { not: 0 } }, { difference: null }],
        },
        select: {
          id: true,
          difference: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      const shiftDeltaMismatch = closedShiftsWithDelta.length > 0;
      if (shiftDeltaMismatch) {
        const summary = closedShiftsWithDelta
          .slice(0, 5)
          .map((shift) => `#${shift.id}(delta=${shift.difference ?? 'null'})`)
          .join(', ');
        issues.push(
          `Closed shifts with non-zero delta detected (${closedShiftsWithDelta.length}): ${summary}`,
        );
      }

      const orphanOrders = await tx.order.findMany({
        where: {
          status: {
            in: [OrderStatus.OPEN, OrderStatus.SETTLING],
          },
          shift: {
            is: {
              status: ShiftStatus.CLOSED,
            },
          },
        },
        select: {
          id: true,
          orderNo: true,
          status: true,
          shiftId: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      const hasOrphanOrders = orphanOrders.length > 0;
      if (hasOrphanOrders) {
        const summary = orphanOrders
          .slice(0, 5)
          .map(
            (order) =>
              `${order.orderNo}(id=${order.id},status=${order.status},shiftId=${order.shiftId})`,
          )
          .join(', ');
        issues.push(`Orphan orders detected (${orphanOrders.length}): ${summary}`);
      }

      const [orders, paymentByOrder, menuByOrder, gameByOrder] = await Promise.all([
        tx.order.findMany({
          select: {
            id: true,
            orderNo: true,
            status: true,
            total: true,
            discountAmount: true,
          },
          orderBy: {
            id: 'asc',
          },
        }),
        tx.payment.groupBy({
          by: ['orderId'],
          _sum: {
            amount: true,
          },
        }),
        tx.orderItem.groupBy({
          by: ['orderId'],
          where: {
            type: OrderItemType.MENU,
          },
          _sum: {
            lineTotal: true,
          },
        }),
        tx.gameCharge.groupBy({
          by: ['orderId'],
          _sum: {
            finalPrice: true,
          },
        }),
      ]);

      const paidMap = new Map<number, number>();
      paymentByOrder.forEach((row) => {
        paidMap.set(row.orderId, row._sum.amount ?? 0);
      });

      const menuMap = new Map<number, number>();
      menuByOrder.forEach((row) => {
        menuMap.set(row.orderId, row._sum.lineTotal ?? 0);
      });

      const gameMap = new Map<number, number>();
      gameByOrder.forEach((row) => {
        gameMap.set(row.orderId, row._sum.finalPrice ?? 0);
      });

      const negativeOutstandingOrders: string[] = [];
      const revenueMismatchOrders: string[] = [];

      for (const order of orders) {
        const paid = paidMap.get(order.id) ?? 0;
        const outstanding = order.total - paid;
        if (outstanding < 0) {
          negativeOutstandingOrders.push(
            `${order.orderNo}(id=${order.id},outstanding=${outstanding})`,
          );
        }

        if (order.status !== OrderStatus.CLOSED) {
          continue;
        }

        const menuSubtotal = menuMap.get(order.id) ?? 0;
        const gameRevenue = gameMap.get(order.id) ?? 0;
        const orderRevenue = Math.max(menuSubtotal - order.discountAmount, 0);
        const reconstructedTotal = orderRevenue + gameRevenue;

        if (reconstructedTotal !== order.total) {
          revenueMismatchOrders.push(
            `${order.orderNo}(id=${order.id},total=${order.total},reconstructed=${reconstructedTotal})`,
          );
        }
      }

      const hasNegativeOutstanding = negativeOutstandingOrders.length > 0;
      if (hasNegativeOutstanding) {
        issues.push(
          `Negative outstanding detected (${negativeOutstandingOrders.length}): ${negativeOutstandingOrders
            .slice(0, 5)
            .join(', ')}`,
        );
      }

      const revenueMismatch = revenueMismatchOrders.length > 0;
      if (revenueMismatch) {
        issues.push(
          `Revenue mismatch detected (${revenueMismatchOrders.length}): ${revenueMismatchOrders
            .slice(0, 5)
            .join(', ')}`,
        );
      }

      if (issues.length > 0) {
        this.logger.warn(
          JSON.stringify({
            level: 'warn',
            context: AdminService.name,
            userId: null,
            action: 'INTEGRITY_FAILURE',
            metadata: {
              ledgerDelta,
              issueCount: issues.length,
              issues,
            },
          }),
        );
      }

      return {
        ledgerBalanced,
        ledgerDelta,
        hasOrphanOrders,
        hasNegativeOutstanding,
        revenueMismatch,
        shiftDeltaMismatch,
        issues,
      };
    });
  }

  async getShifts(): Promise<AdminShiftSummary[]> {
    const shifts = await this.prisma.shift.findMany({
      orderBy: {
        openedAt: 'desc',
      },
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        status: true,
        user: {
          select: {
            email: true,
          },
        },
        audits: {
          orderBy: {
            closedAt: 'desc',
          },
          take: 1,
          select: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    return shifts.map((shift) => ({
      id: shift.id,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      status: shift.status,
      openedBy: shift.user?.email ?? 'SYSTEM',
      closedBy: shift.audits[0]?.user?.email ?? null,
    }));
  }

  async getShiftById(id: number): Promise<AdminShiftDetail> {
    const detail = await this.getShiftDetailComputed(id);

    return {
      id: detail.id,
      openedAt: detail.openedAt,
      closedAt: detail.closedAt,
      status: detail.status,
      totalSales: detail.totalSales,
      totalGameRevenue: detail.totalGameRevenue,
      totalOrderRevenue: detail.totalOrderRevenue,
      totalPayments: detail.totalPayments,
      totalDiscount: detail.totalDiscount,
      totalExpense: detail.totalExpense,
      outstandingAmount: detail.outstandingAmount,
      delta: detail.delta,
    };
  }

  async closeShift(id: number, userId?: number) {
    const detail = await this.getShiftDetailComputed(id);

    if (detail.status !== ShiftStatus.OPEN) {
      throw new ConflictException('Only OPEN shifts can be closed');
    }

    if (detail.openOrdersCount > 0) {
      throw new ConflictException('Cannot close shift. Open orders detected');
    }

    if (detail.delta !== 0) {
      throw new ConflictException('Cannot close shift. Delta must be zero');
    }

    if (detail.outstandingAmount !== 0) {
      throw new ConflictException(
        'Cannot close shift. Outstanding amount must be zero',
      );
    }

    try {
      return await this.shiftsService.closeShiftByAdmin(id, userId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  private async getShiftDetailComputed(
    id: number,
  ): Promise<AdminShiftDetailComputed> {
    return this.prisma.$transaction((tx) => this.getShiftDetailComputedInTx(tx, id));
  }

  private async getShiftDetailComputedInTx(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<AdminShiftDetailComputed> {
    const shift = await tx.shift.findUnique({
      where: { id },
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        status: true,
        difference: true,
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    const rangeEnd = shift.closedAt ?? new Date();
    const shiftOrderScope = this.buildShiftOrderScope(shift.id, shift.openedAt, rangeEnd);

    const openStatuses: OrderStatus[] = [OrderStatus.OPEN, OrderStatus.SETTLING];
    const openOrdersWhere: Prisma.OrderWhereInput = {
      AND: [
        shiftOrderScope,
        {
          status: {
            in: openStatuses,
          },
        },
      ],
    };

    const [
      orderAggregate,
      paymentAggregate,
      gameAggregate,
      expenseAggregate,
      openOrdersCount,
    ] = await Promise.all([
      tx.order.aggregate({
        where: shiftOrderScope,
        _sum: {
          total: true,
          discountAmount: true,
        },
      }),
      tx.payment.aggregate({
        where: {
          order: {
            is: shiftOrderScope,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      tx.gameCharge.aggregate({
        where: {
          order: {
            is: shiftOrderScope,
          },
        },
        _sum: {
          finalPrice: true,
        },
      }),
      tx.expense.aggregate({
        where: {
          shiftId: shift.id,
          isVoided: false,
        },
        _sum: {
          amount: true,
        },
      }),
      tx.order.count({
        where: openOrdersWhere,
      }),
    ]);

    const totalSales = orderAggregate._sum.total ?? 0;
    const totalDiscount = orderAggregate._sum.discountAmount ?? 0;
    const totalPayments = paymentAggregate._sum.amount ?? 0;
    const totalGameRevenue = gameAggregate._sum.finalPrice ?? 0;
    const totalOrderRevenue = Math.max(totalSales - totalGameRevenue, 0);
    const outstandingAmount = Math.max(totalSales - totalPayments, 0);

    const liveDelta = totalSales - totalPayments - outstandingAmount;
    const closedDelta = shift.difference ?? 0;
    const delta =
      shift.status === ShiftStatus.CLOSED ? this.asInt(closedDelta) : this.asInt(liveDelta);

    return {
      id: shift.id,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      status: shift.status,
      totalSales: this.asInt(totalSales),
      totalGameRevenue: this.asInt(totalGameRevenue),
      totalOrderRevenue: this.asInt(totalOrderRevenue),
      totalPayments: this.asInt(totalPayments),
      totalDiscount: this.asInt(totalDiscount),
      totalExpense: this.asInt(expenseAggregate._sum.amount ?? 0),
      outstandingAmount: this.asInt(outstandingAmount),
      delta,
      openOrdersCount: this.asInt(openOrdersCount),
    };
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

  private getTodayRange(): { startOfToday: Date; endOfToday: Date } {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return {
      startOfToday,
      endOfToday,
    };
  }

  private asInt(value: number): number {
    return Number.isInteger(value) ? value : Math.round(value);
  }
}
