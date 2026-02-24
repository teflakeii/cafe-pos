import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AccountType, Prisma, ShiftStatus } from '@prisma/client';
import { SYSTEM_ACCOUNT_CODES } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

type DashboardSummaryResponse = {
  today: {
    revenue: number;
    cash: number;
    card: number;
  };
  openShift: {
    id: number;
    openedAt: string;
    openingCash: number;
  } | null;
  arOutstanding: number;
  lastShift: {
    id: number;
    closedAt: string;
    difference: number;
    revenue: number;
  } | null;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummaryResponse> {
    const { startOfToday, endOfToday } = this.getTodayRange();

    return this.prisma.$transaction(async (tx) => {
      const [revenueAgg, cashAgg, cardAgg, arAgg, openShift, lastClosedShift] =
        await Promise.all([
          tx.ledgerEntry.aggregate({
            where: {
              account: {
                type: AccountType.REVENUE,
              },
              journalEntry: {
                createdAt: {
                  gte: startOfToday,
                  lte: endOfToday,
                },
              },
            },
            _sum: {
              debit: true,
              credit: true,
            },
          }),
          tx.ledgerEntry.aggregate({
            where: {
              account: {
                code: SYSTEM_ACCOUNT_CODES.CASH,
                type: AccountType.ASSET,
              },
              journalEntry: {
                createdAt: {
                  gte: startOfToday,
                  lte: endOfToday,
                },
              },
            },
            _sum: {
              debit: true,
              credit: true,
            },
          }),
          tx.ledgerEntry.aggregate({
            where: {
              account: {
                code: SYSTEM_ACCOUNT_CODES.BANK,
                type: AccountType.ASSET,
              },
              journalEntry: {
                createdAt: {
                  gte: startOfToday,
                  lte: endOfToday,
                },
              },
            },
            _sum: {
              debit: true,
              credit: true,
            },
          }),
          tx.ledgerEntry.aggregate({
            where: {
              account: {
                code: SYSTEM_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
              },
            },
            _sum: {
              debit: true,
              credit: true,
            },
          }),
          tx.shift.findFirst({
            where: {
              status: ShiftStatus.OPEN,
            },
            orderBy: {
              openedAt: 'desc',
            },
            select: {
              id: true,
              openedAt: true,
              openingCash: true,
            },
          }),
          tx.shift.findFirst({
            where: {
              status: ShiftStatus.CLOSED,
            },
            orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              closedAt: true,
              difference: true,
              snapshot: true,
            },
          }),
        ]);

      const todayRevenue = this.asInt(
        (revenueAgg._sum.credit ?? 0) - (revenueAgg._sum.debit ?? 0),
      );
      const todayCash = this.asInt(
        (cashAgg._sum.debit ?? 0) - (cashAgg._sum.credit ?? 0),
      );
      const todayCard = this.asInt(
        (cardAgg._sum.debit ?? 0) - (cardAgg._sum.credit ?? 0),
      );
      const arOutstanding = this.asInt(
        (arAgg._sum.debit ?? 0) - (arAgg._sum.credit ?? 0),
      );

      return {
        today: {
          revenue: todayRevenue,
          cash: todayCash,
          card: todayCard,
        },
        openShift: openShift
          ? {
              id: openShift.id,
              openedAt: openShift.openedAt.toISOString(),
              openingCash: this.asInt(openShift.openingCash),
            }
          : null,
        arOutstanding,
        lastShift: this.mapLastShift(lastClosedShift),
      };
    });
  }

  private mapLastShift(
    shift: {
      id: number;
      closedAt: Date | null;
      difference: number | null;
      snapshot: Prisma.JsonValue | null;
    } | null,
  ): DashboardSummaryResponse['lastShift'] {
    if (!shift || !shift.closedAt) {
      return null;
    }

    const revenue = this.extractSnapshotRevenue(shift.snapshot);
    const differenceFromSnapshot = this.extractSnapshotDifference(
      shift.snapshot,
    );
    const difference =
      shift.difference !== null
        ? this.asInt(shift.difference)
        : differenceFromSnapshot;

    return {
      id: shift.id,
      closedAt: shift.closedAt.toISOString(),
      difference,
      revenue,
    };
  }

  private extractSnapshotRevenue(snapshot: Prisma.JsonValue | null): number {
    const fromProfitLoss = this.readSnapshotInt(snapshot, [
      'profitLoss',
      'summary',
      'totalRevenue',
    ]);
    if (fromProfitLoss !== null) {
      return fromProfitLoss;
    }

    const fromLegacySummary = this.readSnapshotInt(snapshot, [
      'summary',
      'totalRevenue',
    ]);
    return fromLegacySummary ?? 0;
  }

  private extractSnapshotDifference(snapshot: Prisma.JsonValue | null): number {
    const value = this.readSnapshotInt(snapshot, ['difference']);
    return value ?? 0;
  }

  private readSnapshotInt(
    snapshot: Prisma.JsonValue | null,
    path: string[],
  ): number | null {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return null;
    }

    let current: unknown = snapshot;
    for (const key of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return null;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (current === undefined || current === null) {
      return null;
    }

    if (typeof current !== 'number' || !Number.isInteger(current)) {
      throw new InternalServerErrorException(
        `Invalid snapshot integer at path: ${path.join('.')}`,
      );
    }

    return current;
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
    if (!Number.isInteger(value)) {
      throw new InternalServerErrorException('Expected integer ledger value');
    }

    return value;
  }
}
